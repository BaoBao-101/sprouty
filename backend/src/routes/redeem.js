import { createHash } from 'crypto';
import { z } from 'zod';
import { requireAuth, requireCsrf } from '../middleware/rbac.js';
import { AppError } from '../utils/errors.js';
import { activeEntitlements, isVipUser } from '../services/access.js';
import { noHtml, parseOrThrow } from '../utils/validation.js';
import { auditLog } from '../services/audit.js';

const redeemSchema = z.object({
  code: z.string().min(4).max(128),
});

export function normalizeCode(code) {
  return String(code || '').trim().toUpperCase().replace(/\s+/g, '');
}

export function hashRedeemCode(code) {
  return createHash('sha256').update(normalizeCode(code)).digest('hex');
}

function assertCodeUsable(code, redemptionsForUser) {
  const now = new Date();
  if (code.status !== 'active') throw new AppError('Mã này không còn hoạt động.', 400);
  if (code.startsAt && code.startsAt > now) throw new AppError('Mã này chưa bắt đầu hiệu lực.', 400);
  if (code.expiresAt && code.expiresAt <= now) throw new AppError('Mã này đã hết hạn.', 400);
  if (code.maxUses !== null && code.usedCount >= code.maxUses) throw new AppError('Mã này đã hết lượt sử dụng.', 409);
  if (redemptionsForUser >= code.perUserLimit) throw new AppError('Bạn đã sử dụng hết lượt cho mã này.', 409);
}

export default async function redeemRoutes(fastify) {
  fastify.post('/redeem', { preHandler: [requireAuth, requireCsrf] }, async (req) => {
    const { code } = parseOrThrow(redeemSchema, req.body);
    const codeHash = hashRedeemCode(code);
    let result;
    try {
      result = await fastify.prisma.$transaction(async (tx) => {
        const redeemCode = await tx.redeemCode.findUnique({ where: { codeHash } });
        if (!redeemCode) throw new AppError('Mã không hợp lệ.', 404);
        const userUses = await tx.redeemCodeRedemption.count({
          where: { redeemCodeId: redeemCode.id, userId: req.user.id },
        });
        assertCodeUsable(redeemCode, userUses);
        if (redeemCode.maxUses !== null) {
          const updated = await tx.redeemCode.updateMany({
            where: { id: redeemCode.id, usedCount: { lt: redeemCode.maxUses } },
            data: { usedCount: { increment: 1 } },
          });
          if (updated.count !== 1) throw new AppError('Mã này đã hết lượt sử dụng.', 409);
        } else {
          await tx.redeemCode.update({ where: { id: redeemCode.id }, data: { usedCount: { increment: 1 } } });
        }
        const redemption = await tx.redeemCodeRedemption.create({
          data: { redeemCodeId: redeemCode.id, userId: req.user.id },
        });
        const entitlements = [];
        for (const feature of redeemCode.features) {
          entitlements.push(await tx.userEntitlement.create({
            data: {
              userId: req.user.id,
              feature,
              productId: redeemCode.productId,
              source: 'redeem_code',
              sourceId: redemption.id,
              startsAt: redeemCode.startsAt,
              expiresAt: redeemCode.expiresAt,
            },
          }));
        }
        return { redeemCode, redemption, entitlements };
      });
    } catch (err) {
      // 409 here means the code was already claimed by someone (possibly this
      // same user hitting perUserLimit, or a different account racing a kit
      // that's already been activated). Either way, leave a trail so admin can
      // investigate who the legitimate buyer is via order/shipping records —
      // without this, a fraudulent second activation attempt left no trace.
      if (err instanceof AppError && err.statusCode === 409) {
        const redeemCode = await fastify.prisma.redeemCode.findUnique({ where: { codeHash } });
        await auditLog(fastify.prisma, req.user.id, 'redeem_code.duplicate_attempt', 'RedeemCode', redeemCode?.id || codeHash, {
          ip: req.ip,
        });
      }
      throw err;
    }
    await auditLog(fastify.prisma, req.user.id, 'redeem_code.redeem', 'RedeemCode', result.redeemCode.id, {
      redemptionId: result.redemption.id,
      features: result.redeemCode.features,
      productId: result.redeemCode.productId,
    });
    return {
      message: 'Đã kích hoạt mã.',
      features: result.redeemCode.features,
      productId: result.redeemCode.productId,
      entitlements: result.entitlements,
    };
  });

  fastify.get('/me/entitlements', { preHandler: [requireAuth] }, async (req) => {
    const [entitlements, isVip] = await Promise.all([
      activeEntitlements(fastify.prisma, req.user.id),
      isVipUser(fastify.prisma, req.user.id),
    ]);
    const features = {
      ai_assistant: entitlements.some(e => e.feature === 'ai_assistant'),
      instruction_videos: entitlements.some(e => e.feature === 'instruction_videos'),
      image_uploads: entitlements.some(e => e.feature === 'image_uploads'),
    };
    return {
      entitlements,
      features,
      isVip,
      aiRequiresEntitlement: process.env.AI_REQUIRES_ENTITLEMENT === 'true',
    };
  });
}

export const adminRedeemCreateSchema = z.object({
  label: noHtml('Nhãn').and(z.string().min(2).max(200)),
  description: noHtml('Mô tả').and(z.string().max(1000)).optional().nullable(),
  features: z.array(z.enum(['ai_assistant', 'instruction_videos', 'image_uploads'])).min(1).max(3),
  productId: z.number().int().positive().optional().nullable(),
  maxUses: z.number().int().positive().optional().nullable(),
  perUserLimit: z.number().int().positive().max(100).optional().default(1),
  startsAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  quantity: z.number().int().min(1).max(500).optional().default(1),
});
