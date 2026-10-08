import { timingSafeEqual } from 'crypto';
import { applyTransaction } from '../../services/sepay.js';

/**
 * SePay's inbound notification.
 *
 * This route is now only the doorway: authenticate the caller, check the
 * payload is the shape we expect, and hand the transfer to applyTransaction,
 * which is also what the outbound reconciliation poll calls. Crediting a
 * payment lives in one place because two copies of that logic would drift,
 * and it moves money.
 */

function safeApiKeyEqual(provided, expected) {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export default async function sepayWebhookRoutes(fastify) {
  // POST /api/v1/webhooks/sepay
  fastify.post(
    '/sepay',
    {
      // No auth/CSRF preHandlers — this is server-to-server. We auth by Apikey header.
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const expected = process.env.SEPAY_API_KEY;
      if (!expected) {
        // Belt-and-braces: server.js fails fast in production, but in dev a
        // missing key means we should not pretend to authenticate.
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

      // Bad payloads still 200 so SePay does not hammer retries — we log them.
      if (body.transferType !== 'in') {
        fastify.log.info({ body }, 'SePay webhook ignored (outflow)');
        return { ok: true, ignored: 'outflow' };
      }

      return applyTransaction(fastify, {
        id: body.id,
        amount: body.transferAmount,
        code: body.code,
        content: body.content,
        gateway: body.gateway,
        referenceCode: body.referenceCode,
      });
    },
  );
}
