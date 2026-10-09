import { syncWorkshopRewards } from './rewards.js';
import { paymentSuffix } from './payment-memo.js';

/**
 * Crediting a bank transfer, and asking SePay what has arrived.
 *
 * There are two ways a payment reaches us and they need the same answer:
 *
 *   inbound   SePay POSTs a webhook the moment the bank notifies it. Instant,
 *             but it only works where SePay can reach us — a public URL. On a
 *             laptop there is no such thing, so a developer paying a real QR
 *             watched the page spin forever.
 *
 *   outbound  We ask SePay for recent transactions. Slower, but it is an
 *             ordinary HTTPS call, so it works from a laptop, from a VPS, from
 *             anywhere. It is also the safety net in production for the day a
 *             webhook is missed, retried into a timeout, or pointed at a URL
 *             somebody changed.
 *
 * Both funnel into applyTransaction, which is the only place that decides a
 * transfer has paid for something. Two implementations of that would drift,
 * and this one moves money.
 */

/*
 * The memo we tell customers to send looks like SPROUTYH2A0XWFD, where the
 * suffix is the tail of the order id. SePay's dashboard regex extracts it into
 * `code`; we re-derive it from the raw content when that is not set.
 */

/** Keeps the poll off SePay's rate limit when several customers are waiting. */
const MIN_POLL_GAP_MS = 4000;
let lastPollAt = 0;
let inFlight = null;

/* ── Crediting ──────────────────────────────────────────────────────────── */

/**
 * A workshop booking. Mirrors the order path: exact amount only, unpaid rows
 * only, and the unique index on sepayTransactionId is what stops a retried
 * delivery crediting the same transfer twice.
 */
async function creditWorkshop(fastify, suffix, { txId, amount, gateway }) {
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
    fastify.log.info({ txId, suffix }, 'SePay: no matching unpaid workshop registration');
    return { ok: true, unmatched: true };
  }

  if (amount !== candidate.amount) {
    fastify.log.warn(
      { txId, registrationId: candidate.id, expected: candidate.amount, received: amount },
      'SePay: workshop amount mismatch',
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
      await fastify.prisma.auditLog
        .create({
          data: {
            actorUserId: candidate.userId,
            action: 'workshop.payment.received',
            targetType: 'WorkshopRegistration',
            targetId: updated.id,
            metadata: { txId, amount, workshopId: candidate.workshopId, gateway },
          },
        })
        .catch(() => {});
    }
    return { ok: true, registrationId: updated.id };
  } catch (err) {
    if (err.code === 'P2002') return { ok: true, alreadyProcessed: true };
    throw err;
  }
}

/**
 * Credits one transfer against an order or a workshop booking.
 *
 * `tx` is already normalised: `{ id, amount, code, content, gateway,
 * referenceCode }`. Returns a plain result rather than throwing on a miss —
 * an unmatched transfer is a fact to log, not an error, and the webhook has to
 * acknowledge it or SePay retries forever.
 */
export async function applyTransaction(fastify, tx) {
  const txId = Number(tx.id);
  const amount = Number(tx.amount);
  if (!Number.isInteger(txId) || !Number.isFinite(amount)) {
    return { ok: true, ignored: 'bad-shape' };
  }

  // Already booked? Both tables are checked: a transaction id is unique across
  // the account, and a workshop payment must not fall through to the order
  // lookup below.
  const [existingOrder, existingRegistration] = await Promise.all([
    fastify.prisma.order.findUnique({ where: { sepayTransactionId: txId }, select: { id: true } }),
    fastify.prisma.workshopRegistration.findUnique({
      where: { sepayTransactionId: txId },
      select: { id: true },
    }),
  ]);
  if (existingOrder) return { ok: true, alreadyProcessed: true, orderId: existingOrder.id };
  if (existingRegistration) {
    return { ok: true, alreadyProcessed: true, registrationId: existingRegistration.id };
  }

  const suffix = paymentSuffix(tx.code, tx.content);
  if (!suffix) {
    fastify.log.info({ txId, content: tx.content }, 'SePay: no order code matched');
    return { ok: true, unmatched: true };
  }

  // A workshop memo carries a "WS" marker before the id suffix. Without it a
  // workshop payment could be credited against an order whose id happened to
  // end with the same characters.
  if (/^ws/i.test(suffix)) {
    return creditWorkshop(fastify, suffix.slice(2).toLowerCase(), {
      txId,
      amount,
      gateway: tx.gateway,
    });
  }

  const candidate = await fastify.prisma.order.findFirst({
    where: { id: { endsWith: suffix.toLowerCase() }, status: 'pending', sepayTransactionId: null },
    select: { id: true, total: true, userId: true },
  });
  if (!candidate) {
    fastify.log.info({ txId, suffix }, 'SePay: no matching pending order');
    return { ok: true, unmatched: true };
  }

  // Exact amount only. A mismatch stays pending so staff can investigate.
  if (amount !== candidate.total) {
    fastify.log.warn(
      { txId, orderId: candidate.id, expected: candidate.total, received: amount },
      'SePay: amount mismatch',
    );
    await fastify.prisma.auditLog
      .create({
        data: {
          actorUserId: candidate.userId,
          action: 'payment.amount_mismatch',
          targetType: 'Order',
          targetId: candidate.id,
          metadata: { txId, expected: candidate.total, received: amount },
        },
      })
      .catch(() => {});
    return { ok: true, mismatch: true };
  }

  try {
    const updated = await fastify.prisma.order.update({
      where: { id: candidate.id },
      data: { status: 'processing', paidAt: new Date(), sepayTransactionId: txId },
      select: { id: true },
    });

    await fastify.prisma.auditLog
      .create({
        data: {
          actorUserId: candidate.userId,
          action: 'payment.received',
          targetType: 'Order',
          targetId: updated.id,
          metadata: { txId, amount, gateway: tx.gateway, referenceCode: tx.referenceCode },
        },
      })
      .catch(() => {});

    // "Mua 3 tặng 1 workshop" is earned the moment the money lands. Failure is
    // logged and swallowed, and the sync runs again whenever the customer opens
    // their rewards page: a reward we could not mint must not turn a credited
    // payment into an error SePay keeps retrying.
    await syncWorkshopRewards(fastify.prisma, candidate.userId).catch((err) => {
      fastify.log.error({ err, orderId: updated.id }, 'Reward sync after payment failed');
    });

    return { ok: true, orderId: updated.id };
  } catch (err) {
    // P2002 = unique constraint — a concurrent delivery already booked it.
    if (err.code === 'P2002') return { ok: true, alreadyProcessed: true };
    throw err;
  }
}

/* ── Asking SePay ───────────────────────────────────────────────────────── */

export function pollingConfigured() {
  return Boolean(process.env.SEPAY_API_TOKEN);
}

/**
 * Recent incoming transfers, newest first.
 *
 * Scoped to the last `sinceMinutes` so a busy account does not have its whole
 * history pulled every few seconds; an order nobody is watching gets picked up
 * by the webhook, or by the next person who opens the page.
 */
async function fetchRecent({ sinceMinutes = 60, limit = 50 } = {}) {
  const token = process.env.SEPAY_API_TOKEN;
  if (!token) return [];

  const params = new URLSearchParams({ limit: String(limit) });
  if (process.env.SEPAY_ACCOUNT_NUMBER) {
    params.set('account_number', process.env.SEPAY_ACCOUNT_NUMBER);
  }

  const since = new Date(Date.now() - sinceMinutes * 60_000);
  // SePay expects 'YYYY-MM-DD HH:mm:ss' in the account's own timezone, which
  // is the server's. toISOString would silently shift it to UTC and skip the
  // transfers made in the last few hours — exactly the ones being waited for.
  const pad = (n) => String(n).padStart(2, '0');
  params.set(
    'transaction_date_min',
    `${since.getFullYear()}-${pad(since.getMonth() + 1)}-${pad(since.getDate())} ` +
      `${pad(since.getHours())}:${pad(since.getMinutes())}:${pad(since.getSeconds())}`,
  );

  const res = await fetch(`https://my.sepay.vn/userapi/transactions/list?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`SePay API ${res.status}`);

  const body = await res.json();
  const rows = Array.isArray(body?.transactions) ? body.transactions : [];

  return rows
    // amount_in is the money that arrived; a withdrawal has it at "0".
    .filter((r) => Number(r.amount_in) > 0)
    .map((r) => ({
      id: r.id,
      amount: Number(r.amount_in),
      code: r.code,
      content: r.transaction_content,
      gateway: r.bank_brand_name,
      referenceCode: r.reference_number,
    }));
}

/**
 * Pulls recent transfers and credits whatever matches.
 *
 * Throttled and de-duplicated across callers: every customer waiting on a
 * payment page polls every 1.5 seconds, and one SePay call answers all of
 * them. Failures are swallowed — the page should keep waiting on a webhook
 * rather than show an error because a reconciliation call timed out.
 */
export async function reconcile(fastify, { force = false } = {}) {
  if (!pollingConfigured()) return { skipped: 'not-configured' };

  if (inFlight) return inFlight;
  if (!force && Date.now() - lastPollAt < MIN_POLL_GAP_MS) return { skipped: 'throttled' };

  lastPollAt = Date.now();
  inFlight = (async () => {
    try {
      const transactions = await fetchRecent();
      let credited = 0;
      for (const tx of transactions) {
        const result = await applyTransaction(fastify, tx);
        if (result.orderId || result.registrationId) credited += 1;
      }
      if (credited) fastify.log.info({ credited }, 'SePay reconcile credited payments');
      return { checked: transactions.length, credited };
    } catch (err) {
      fastify.log.warn({ err: err.message }, 'SePay reconcile failed');
      return { error: err.message };
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
