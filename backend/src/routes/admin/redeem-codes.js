import { randomBytes } from 'crypto';
import { z } from 'zod';
import { requireAdmin, requireCsrf } from '../../middleware/rbac.js';
import { parseOrThrow } from '../../utils/validation.js';
import { auditLog } from '../../services/audit.js';
import { adminRedeemCreateSchema, hashRedeemCode } from '../redeem.js';

const updateSchema = z.object({
  label: z.string().min(2).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  status: z.enum(['active', 'disabled', 'expired']).optional(),
  maxUses: z.number().int().positive().optional().nullable(),
  perUserLimit: z.number().int().positive().max(100).optional(),
  startsAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
});

function generateCode() {
  return `SPR-${randomBytes(4).toString('hex').toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

export default async function adminRedeemCodeRoutes(fastify) {
  fastify.get('/redeem-codes', { preHandler: [requireAdmin] }, async () => {
    const codes = await fastify.prisma.redeemCode.findMany({
      include: {
        product: { select: { id: true, name: true } },
        _count: { select: { redemptions: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return { codes };
  });

  fastify.post('/redeem-codes', { preHandler: [requireAdmin, requireCsrf] }, async (req, reply) => {
    const data = parseOrThrow(adminRedeemCreateSchema, req.body);
    const created = [];
    for (let i = 0; i < data.quantity; i += 1) {
      let plaintext = generateCode();
      let codeHash = hashRedeemCode(plaintext);
      let attempts = 0;
      while (await fastify.prisma.redeemCode.findUnique({ where: { codeHash } })) {
        attempts += 1;
        if (attempts > 5) throw new Error('Unable to generate unique redeem code');
        plaintext = generateCode();
        codeHash = hashRedeemCode(plaintext);
      }
      const code = await fastify.prisma.redeemCode.create({
        data: {
          codeHash,
          label: data.label,
          description: data.description || null,
          features: data.features,
          productId: data.productId || null,
          maxUses: data.maxUses || null,
          perUserLimit: data.perUserLimit,
          startsAt: data.startsAt ? new Date(data.startsAt) : null,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
          createdByUserId: req.user.id,
        },
      });
      created.push({ code: plaintext, redeemCode: code });
      await auditLog(fastify.prisma, req.user.id, 'redeem_code.create', 'RedeemCode', code.id, {
        features: data.features,
        productId: data.productId || null,
      });
    }
    reply.code(201);
    return { codes: created };
  });

  fastify.patch('/redeem-codes/:id', { preHandler: [requireAdmin, requireCsrf] }, async (req, reply) => {
    const parsed = parseOrThrow(updateSchema, req.body);
    const existing = await fastify.prisma.redeemCode.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.code(404).send({ message: 'Không tìm thấy mã.' });
    const code = await fastify.prisma.redeemCode.update({
      where: { id: existing.id },
      data: {
        ...parsed,
        startsAt: parsed.startsAt === undefined ? undefined : parsed.startsAt ? new Date(parsed.startsAt) : null,
        expiresAt: parsed.expiresAt === undefined ? undefined : parsed.expiresAt ? new Date(parsed.expiresAt) : null,
      },
    });
    await auditLog(fastify.prisma, req.user.id, 'redeem_code.update', 'RedeemCode', code.id, parsed);
    return { code };
  });

  fastify.delete('/redeem-codes/:id', { preHandler: [requireAdmin, requireCsrf] }, async (req, reply) => {
    const existing = await fastify.prisma.redeemCode.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.code(404).send({ message: 'Không tìm thấy mã.' });
    const code = await fastify.prisma.redeemCode.update({
      where: { id: existing.id },
      data: { status: 'disabled' },
    });
    await auditLog(fastify.prisma, req.user.id, 'redeem_code.disable', 'RedeemCode', code.id, {});
    return { code };
  });

  fastify.get('/redeem-codes/:id/redemptions', { preHandler: [requireAdmin] }, async (req) => {
    const redemptions = await fastify.prisma.redeemCodeRedemption.findMany({
      where: { redeemCodeId: req.params.id },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { redeemedAt: 'desc' },
      take: 200,
    });
    return { redemptions };
  });

  // Revoke a single redemption after admin has verified (e.g. against order /
  // shipping records) that the account which claimed it isn't the legitimate
  // buyer. Frees the code back up (decrements usedCount) so the rightful
  // owner can redeem it, and strips the entitlements the fraudulent
  // redemption granted.
  fastify.delete('/redeem-codes/:id/redemptions/:redemptionId', { preHandler: [requireAdmin, requireCsrf] }, async (req, reply) => {
    const { id, redemptionId } = req.params;
    const redemption = await fastify.prisma.redeemCodeRedemption.findUnique({ where: { id: redemptionId } });
    if (!redemption || redemption.redeemCodeId !== id) {
      return reply.code(404).send({ message: 'Không tìm thấy lượt kích hoạt.' });
    }
    await fastify.prisma.$transaction(async (tx) => {
      await tx.userEntitlement.deleteMany({ where: { source: 'redeem_code', sourceId: redemptionId } });
      await tx.redeemCodeRedemption.delete({ where: { id: redemptionId } });
      await tx.redeemCode.updateMany({
        where: { id, usedCount: { gt: 0 } },
        data: { usedCount: { decrement: 1 } },
      });
    });
    await auditLog(fastify.prisma, req.user.id, 'redeem_code.revoke_redemption', 'RedeemCode', id, {
      redemptionId,
      revokedUserId: redemption.userId,
    });
    return { message: 'Đã thu hồi lượt kích hoạt.' };
  });
}
