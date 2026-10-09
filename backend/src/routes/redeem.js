import { z } from 'zod';
import { requireAuth, requireCsrf } from '../middleware/rbac.js';
import { activeEntitlements, isVipUser } from '../services/access.js';
import { hashRedeemCode, normalizeCode, redeemCode } from '../services/redeem.js';
import { noHtml, parseOrThrow } from '../utils/validation.js';
import { plantCardDto } from '../services/plants.js';

// Re-exported for admin/redeem-codes.js, which hashes a code it is minting.
// The implementation lives in services/redeem.js now that the plant activation
// form shares it.
export { hashRedeemCode, normalizeCode };

const redeemSchema = z.object({
  code: z.string().min(4).max(128),
  // Optional: the activation form on the plant page lets a child name their
  // plant as they activate it.
  nickname: noHtml('Tên cây').and(z.string().min(1).max(40)).optional(),
});

export default async function redeemRoutes(fastify) {
  fastify.post('/redeem', { preHandler: [requireAuth, requireCsrf] }, async (req) => {
    const { code, nickname } = parseOrThrow(redeemSchema, req.body);
    const result = await redeemCode(fastify.prisma, req.user.id, code, {
      ip: req.ip,
      nickname: nickname || null,
    });

    return {
      message: result.alreadyRedeemed
        ? 'Mã này đã được kích hoạt cho tài khoản của bạn rồi.'
        : result.plantCreated
          ? 'Đã kích hoạt mã — cây của bạn đã được gieo hạt!'
          : 'Đã kích hoạt mã.',
      alreadyRedeemed: result.alreadyRedeemed,
      features: result.features,
      productId: result.productId,
      entitlements: result.entitlements,
      // The caller redirects straight to the plant when one was planted.
      plant: result.plant ? plantCardDto(result.plant) : null,
      plantCreated: result.plantCreated,
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
      // All signed-in accounts receive a daily allowance; VIP increases it.
      aiRequiresEntitlement: false,
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
