import { timingSafeEqual } from 'crypto';

// Memo we instruct customers to use looks like: SPROUTYPXYZ12345
// where the suffix is the last 8 chars of the cuid Order.id (uppercased).
// SePay's "code" field auto-extracts this when its dashboard regex is set
// to /SPROUTY([A-Z0-9]+)/. We also regex-fallback on the raw "content".
const MEMO_RE = /SPROUTY([A-Z0-9]{6,16})/i;

/**
 * Credits a workshop booking. Mirrors the order path: exact amount only,
 * unpaid rows only, and the unique index on sepayTransactionId is what stops a
 * retried delivery from crediting the same transfer twice.
 */
async function creditWorkshop(fastify, suffix, { txId, amount, body }) {
  if (!suffix) return { ok: true, unmatched: true };

  const candidate = await fastify.prisma.workshopRegistration.findFirst({
    where: {
      id: { endsWith: suffix },
      paidAt: null,
      sepayTransactionId: null,
      status: { not: 'cancelled' },
    },
    select: { id: true, amount: true, userId: true, workshopId: true },
  });
  if (!candidate) {
    fastify.log.info({ txId, suffix }, 'SePay webhook: no matching unpaid workshop registration');
    return { ok: true, unmatched: true };
  }

  if (amount !== candidate.amount) {
    fastify.log.warn(
      { txId, registrationId: candidate.id, expected: candidate.amount, received: amount },
      'SePay webhook: workshop amount mismatch',
    );
    return { ok: true, mismatch: true };
  }

  try {
    const updated = await fastify.prisma.workshopRegistration.update({
      where: { id: candidate.id },
      data: {
        paidAt: new Date(),
        sepayTransactionId: txId,
        paymentMethod: 'online',
        // `status` deliberately untouched: paying *is* the confirmation, so
        // paidAt is the single signal. A separate "confirmed" flag would be a
        // second source of truth for the same fact.
      },
      select: { id: true },
    });
    // actorUserId is required, so a guest booking has no audit row to write.
    if (candidate.userId) {
      await fastify.prisma.auditLog.create({
        data: {
          actorUserId: candidate.userId,
          action: 'workshop.payment.received',
          targetType: 'WorkshopRegistration',
          targetId: updated.id,
          metadata: { txId, amount, workshopId: candidate.workshopId, gateway: body.gateway },
        },
      }).catch(() => {});
    }
    return { ok: true, registrationId: updated.id };
  } catch (err) {
    if (err.code === 'P2002') return { ok: true, alreadyProcessed: true };
    throw err;
  }
}

function safeApiKeyEqual(provided, expected) {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export default async function sepayWebhookRoutes(fastify) {
  // POST /api/v1/webhooks/sepay
  // Receives bank-transfer notifications from SePay. Idempotent via the
  // unique index on Order.sepayTransactionId.
  fastify.post('/sepay', {
    // No auth/CSRF preHandlers — this is server-to-server. We auth by Apikey header.
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const expected = process.env.SEPAY_API_KEY;
    if (!expected) {
      // Belt-and-braces: server.js fails-fast in prod, but in dev a missing key
      // means we shouldn't pretend to authenticate.
      fastify.log.error('SePay webhook hit but SEPAY_API_KEY is not set');
      return reply.code(503).send({ message: 'Payment webhook not configured.' });
    }

    // SePay sends: Authorization: Apikey <key>
    const auth = req.headers.authorization || '';
    const provided = auth.startsWith('Apikey ') ? auth.slice(7).trim() : '';
    if (!safeApiKeyEqual(provided, expected)) {
      fastify.log.warn({ ip: req.ip }, 'SePay webhook auth failed');
      return reply.code(401).send({ message: 'Unauthorized.' });
    }

    const body = req.body || {};
    const txId = Number(body.id);
    const amount = Number(body.transferAmount);

    // Sanity-check the payload shape. Bad payloads still 200 so SePay doesn't
    // hammer retries — we just log them.
    if (!Number.isInteger(txId) || !Number.isFinite(amount) || body.transferType !== 'in') {
      fastify.log.info({ body }, 'SePay webhook ignored (bad shape or outflow)');
      return { ok: true, ignored: 'bad-shape-or-outflow' };
    }

    // Idempotency short-circuit: if we've already booked this transaction, ack.
    // Both tables are checked — a transaction id is unique across the account,
    // and a workshop payment must not fall through to the order lookup below.
    const [existingOrder, existingRegistration] = await Promise.all([
      fastify.prisma.order.findUnique({
        where: { sepayTransactionId: txId },
        select: { id: true },
      }),
      fastify.prisma.workshopRegistration.findUnique({
        where: { sepayTransactionId: txId },
        select: { id: true },
      }),
    ]);
    if (existingOrder) {
      return { ok: true, alreadyProcessed: true, orderId: existingOrder.id };
    }
    if (existingRegistration) {
      return { ok: true, alreadyProcessed: true, registrationId: existingRegistration.id };
    }

    // Resolve order code: prefer SePay's parsed `code`, else regex on `content`.
    let suffix = (body.code || '').trim();
    if (!suffix) {
      const m = (body.content || '').match(MEMO_RE);
      if (m) suffix = m[1];
    }
    if (!suffix) {
      fastify.log.info({ txId, content: body.content }, 'SePay webhook: no order code matched');
      return { ok: true, unmatched: true };
    }

    // A workshop memo carries a "WS" marker before the id suffix. Without it a
    // workshop payment could be credited against an order whose id happened to
    // end with the same eight characters.
    if (/^ws/i.test(suffix)) {
      return creditWorkshop(fastify, suffix.slice(2).toLowerCase(), { txId, amount, body });
    }

    // Match a pending order whose id ends with the lowercase suffix.
    const lower = suffix.toLowerCase();
    const candidate = await fastify.prisma.order.findFirst({
      where: { id: { endsWith: lower }, status: 'pending', sepayTransactionId: null },
      select: { id: true, total: true, userId: true },
    });
    if (!candidate) {
      fastify.log.info({ txId, suffix }, 'SePay webhook: no matching pending order');
      return { ok: true, unmatched: true };
    }

    // Amount must equal the order total exactly. Mismatches stay pending so
    // staff can investigate; we still 200 to acknowledge receipt.
    if (amount !== candidate.total) {
      fastify.log.warn({ txId, orderId: candidate.id, expected: candidate.total, received: amount },
        'SePay webhook: amount mismatch');
      await fastify.prisma.auditLog.create({
        data: {
          actorUserId: candidate.userId,
          action: 'payment.amount_mismatch',
          targetType: 'Order',
          targetId: candidate.id,
          metadata: { txId, expected: candidate.total, received: amount },
        },
      }).catch(() => {});
      return { ok: true, mismatch: true };
    }

    // Mark paid + advance status. The unique index on sepayTransactionId is the
    // last-line defense against double-credit if SePay retries before we ack.
    try {
      const updated = await fastify.prisma.order.update({
        where: { id: candidate.id },
        data: {
          status: 'processing',
          paidAt: new Date(),
          sepayTransactionId: txId,
        },
        select: { id: true },
      });
      await fastify.prisma.auditLog.create({
        data: {
          actorUserId: candidate.userId,
          action: 'payment.received',
          targetType: 'Order',
          targetId: updated.id,
          metadata: { txId, amount, gateway: body.gateway, referenceCode: body.referenceCode },
        },
      }).catch(() => {});
      return { ok: true, orderId: updated.id };
    } catch (err) {
      // P2002 = unique constraint — concurrent webhook delivery already booked it.
      if (err.code === 'P2002') return { ok: true, alreadyProcessed: true };
      throw err;
    }
  });
}
