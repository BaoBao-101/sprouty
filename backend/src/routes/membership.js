import { z } from 'zod';
import { benefitsFor, saveGarden } from '../services/benefits.js';
import { AppError } from '../utils/errors.js';
import { requireAuth, requireCsrf } from '../middleware/rbac.js';
import { auditLog } from '../services/audit.js';
import { buildPaymentInfo } from './orders.js';
import { MEMBERSHIP_CATEGORY, membershipDaysFor, tierOf } from '../services/membership.js';

/**
 * VIP Garden's own checkout.
 *
 * Not the cart. A VIP plan is one thing bought on its own, with nothing to
 * deliver and no address to ask for, and what the customer gets is a change
 * to their account rather than a code. So it gets its own order — one line,
 * one plan — paid through the same bank transfer as any other, and switched
 * on by services/membership.js the moment the transfer is credited.
 */

const checkoutSchema = z.object({
  productId: z.number({ invalid_type_error: 'Gói VIP không hợp lệ.' }).int().positive(),
});

/** An unpaid VIP order younger than this is offered again instead of a new one. */
const REUSE_PENDING_MS = 24 * 60 * 60 * 1000;

const ORDER_NOTE = 'vip.checkout';
const NO_DELIVERY = 'Gói thành viên VIP Garden — tự động nâng cấp tài khoản, không giao hàng.';

function planDto(product) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    oldPrice: product.oldPrice,
    images: product.images,
    includes: product.includes,
    badge: product.badge,
    days: membershipDaysFor(product),
  };
}

export default async function membershipRoutes(fastify) {
  fastify.get('/me/benefits', { preHandler: [requireAuth] }, async (req) =>
    benefitsFor(fastify.prisma, req.user.id));

  fastify.put('/me/garden', { preHandler: [requireAuth, requireCsrf] }, async (req) => {
    const parsed = z.object({
      scene: z.enum(['natural', 'night', 'autumn', 'sakura']),
      decoration: z.enum(['plain', 'terracotta', 'ceramic', 'porcelain']),
    }).safeParse(req.body);
    if (!parsed.success) throw new AppError('Lựa chọn khu vườn không hợp lệ.', 400);
    return saveGarden(fastify.prisma, req.user.id, parsed.data);
  });
  // GET /api/v1/membership/plans — public: the VIP page shows prices before
  // anyone signs in.
  fastify.get('/membership/plans', async () => {
    const plans = await fastify.prisma.product.findMany({
      where: { category: MEMBERSHIP_CATEGORY, status: 'published' },
      orderBy: { price: 'asc' },
    });
    return { plans: plans.map(planDto) };
  });

  // GET /api/v1/me/membership — the account's tier, plus an unpaid VIP order
  // if there is one, so the VIP page can offer to finish paying it instead of
  // starting a second.
  fastify.get('/me/membership', { preHandler: [requireAuth] }, async (req) => {
    const [user, pending] = await Promise.all([
      fastify.prisma.user.findUnique({ where: { id: req.user.id }, select: { vipUntil: true } }),
      fastify.prisma.order.findFirst({
        where: {
          userId: req.user.id,
          status: 'pending',
          paidAt: null,
          items: { some: { product: { category: MEMBERSHIP_CATEGORY } } },
          createdAt: { gt: new Date(Date.now() - REUSE_PENDING_MS) },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          total: true,
          createdAt: true,
          items: { select: { product: { select: { id: true, name: true } } } },
        },
      }),
    ]);

    return {
      ...tierOf(user),
      pendingOrder: pending
        ? {
            id: pending.id,
            total: pending.total,
            createdAt: pending.createdAt,
            planId: pending.items[0]?.product?.id ?? null,
            planName: pending.items[0]?.product?.name ?? null,
          }
        : null,
    };
  });

  // POST /api/v1/membership/checkout — start paying for a plan.
  fastify.post('/membership/checkout', {
    preHandler: [requireAuth, requireCsrf],
  }, async (req, reply) => {
    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0]?.message || 'Gói VIP không hợp lệ.', 400);
    }

    const plan = await fastify.prisma.product.findFirst({
      where: { id: parsed.data.productId, category: MEMBERSHIP_CATEGORY, status: 'published' },
    });
    if (!plan) throw new AppError('Gói VIP này không còn được bán.', 404);

    // Pressing "Nâng cấp" twice, or coming back to it from another tab, should
    // land on the same transfer rather than leave a trail of unpaid orders —
    // and a second QR for the same plan is a second chance to pay twice.
    const existing = await fastify.prisma.order.findFirst({
      where: {
        userId: req.user.id,
        status: 'pending',
        paidAt: null,
        total: plan.price,
        note: ORDER_NOTE,
        items: { every: { productId: plan.id } },
        createdAt: { gt: new Date(Date.now() - REUSE_PENDING_MS) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      return { order: existing, payment: buildPaymentInfo(existing), reused: true };
    }

    const order = await fastify.prisma.order.create({
      data: {
        userId: req.user.id,
        total: plan.price,
        // Nothing is shipped. The columns are required, so they carry the
        // account holder and a line saying why there is no address.
        shippingName: req.user.name,
        shippingPhone: '',
        shippingAddress: NO_DELIVERY,
        note: ORDER_NOTE,
        items: { create: [{ productId: plan.id, qty: 1, unitPrice: plan.price }] },
      },
    });

    await auditLog(fastify.prisma, req.user.id, 'membership.checkout', 'Order', order.id, {
      productId: plan.id,
      price: plan.price,
      days: membershipDaysFor(plan),
    });

    reply.code(201);
    return { order, payment: buildPaymentInfo(order), reused: false };
  });
}
