import { z } from 'zod';
import { createHash, createHmac } from 'crypto';
import { AppError } from '../utils/errors.js';
import { requireAuth, requireCsrf } from '../middleware/rbac.js';

// Build the payment-instruction payload for an order. Returns null in dev when
// SePay isn't configured, so the existing flow still works without payments.
function buildPaymentInfo(order) {
  const acc = process.env.SEPAY_ACCOUNT_NUMBER;
  const bank = process.env.SEPAY_BANK_CODE;
  const name = process.env.SEPAY_ACCOUNT_NAME;
  if (!acc || !bank) return null;
  const memo = 'SPROUTY' + order.id.slice(-8).toUpperCase();
  const qrUrl = `https://qr.sepay.vn/img?acc=${encodeURIComponent(acc)}&bank=${encodeURIComponent(bank)}&amount=${order.total}&des=${encodeURIComponent(memo)}`;
  return {
    qrUrl,
    bankCode: bank,
    accountNumber: acc,
    accountName: name || '',
    memo,
    amount: order.total,
  };
}

const orderItemSchema = z.object({
  productId: z.number().int().positive(),
  qty: z.number().int().min(1).max(99),
  // 'smart' only valid when the product actually offers a Smart variant
  // (product.smartPriceDelta is set) — validated server-side below, never
  // trust the client for pricing.
  variant: z.enum(['standard', 'smart']).optional(),
});

const noHtml = (label) => z.string().refine(
  s => !/[<>]/.test(s),
  { message: `${label} không được chứa ký tự < hoặc >.` }
);

// shippingAddress is validated conditionally in the route handler, not here —
// it's only required when the cart contains a physical (non-membership)
// product. VIP is a digital-only purchase, nothing is ever shipped for it.
const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1, 'Giỏ hàng trống.').max(50, 'Giỏ hàng không được vượt quá 50 sản phẩm.'),
  shippingName: noHtml('Tên người nhận').and(z.string().min(2, 'Tên người nhận không hợp lệ.').max(100)),
  shippingPhone: z.string().regex(/^[0-9]{9,11}$/, 'Số điện thoại không hợp lệ.'),
  shippingAddress: noHtml('Địa chỉ').and(z.string().max(500)).optional(),
  note: noHtml('Ghi chú').and(z.string().max(500)).optional(),
});

const NO_SHIPPING_PLACEHOLDER = 'Không áp dụng — sản phẩm không cần giao hàng.';

/** Delivery details, for correcting them after checkout. */
const shippingSchema = z.object({
  shippingName: noHtml('Tên người nhận').and(
    z.string().min(2, 'Tên người nhận không hợp lệ.').max(100, 'Tên người nhận tối đa 100 ký tự.'),
  ),
  shippingPhone: z.string().regex(/^[0-9]{9,11}$/, 'Số điện thoại không hợp lệ (9–11 chữ số).'),
  shippingAddress: noHtml('Địa chỉ').and(
    z.string().max(500, 'Địa chỉ tối đa 500 ký tự.'),
  ).optional(),
});

function normalizePurchaseCode(code) {
  return String(code || '').trim().toUpperCase().replace(/\s+/g, '');
}

function hashPurchaseCode(code) {
  return createHash('sha256').update(normalizePurchaseCode(code)).digest('hex');
}

function buildPurchaseRedeemCode(orderId, userId, productId) {
  // Finding F-12: the fallback below is a value that ships in the repository, so
  // anyone reading it could mint valid redeem codes for any order. Harmless in
  // development, fatal in production — so refuse to start down that path there
  // instead of silently using a public secret.
  const secret = process.env.REDEEM_CODE_SECRET || process.env.COOKIE_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new AppError('Máy chủ chưa được cấu hình đúng (REDEEM_CODE_SECRET).', 500);
    }
    return buildWithSecret('sprouty-dev-redeem-code-secret', orderId, userId, productId);
  }
  return buildWithSecret(secret, orderId, userId, productId);
}

function buildWithSecret(secret, orderId, userId, productId) {
  const digest = createHmac('sha256', secret)
    .update(`${orderId}:${userId}:${productId}`)
    .digest('hex')
    .slice(0, 16)
    .toUpperCase();
  return `SPR-${digest.slice(0, 4)}-${digest.slice(4, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}`;
}

async function ensurePurchaseRedeemCodes(prisma, order) {
  if (!order?.paidAt || order.status === 'cancelled') return [];
  const seen = new Set();
  const codes = [];
  for (const item of order.items || []) {
    if (seen.has(item.productId)) continue;
    seen.add(item.productId);
    const plaintext = buildPurchaseRedeemCode(order.id, order.userId, item.productId);
    const codeHash = hashPurchaseCode(plaintext);
    const existing = await prisma.redeemCode.findUnique({ where: { codeHash } });
    const redeemCode = existing || await prisma.redeemCode.create({
      data: {
        codeHash,
        label: `Mã sau mua hàng ${order.id.slice(-8).toUpperCase()}`,
        description: 'Mã kích hoạt tự động sau khi thanh toán đơn hàng.',
        features: ['instruction_videos', 'image_uploads'],
        productId: item.productId,
        maxUses: 1,
        perUserLimit: 1,
        createdByUserId: order.userId,
      },
    });
    codes.push({
      code: plaintext,
      productId: item.productId,
      productName: item.product?.name || null,
      features: redeemCode.features,
      usedCount: redeemCode.usedCount,
      maxUses: redeemCode.maxUses,
      status: redeemCode.status,
    });
  }
  return codes;
}

export default async function orderRoutes(fastify) {
  // POST /api/v1/orders
  fastify.post('/orders', {
    preHandler: [requireAuth, requireCsrf],
    bodyLimit: 65536, // 64 KB — well above legitimate 50-item payload, blocks bulk-row attacks
  }, async (req, reply) => {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0]?.message || 'Dữ liệu không hợp lệ.', 400);
    }

    const { items, shippingName, shippingPhone, note } = parsed.data;
    let { shippingAddress } = parsed.data;

    // Verify all products exist and are published. Same product can appear
    // twice with different variants (e.g. Bean Standard + Bean Smart), so
    // dedupe before comparing counts — findMany naturally returns one row
    // per unique id regardless of how many cart lines reference it.
    const uniqueProductIds = [...new Set(items.map(i => i.productId))];
    const products = await fastify.prisma.product.findMany({
      where: { id: { in: uniqueProductIds }, status: 'published' },
      select: { id: true, price: true, name: true, smartPriceDelta: true, category: true },
    });

    if (products.length !== uniqueProductIds.length) {
      throw new AppError('Một số sản phẩm không tồn tại hoặc đã ngừng bán.', 400);
    }

    const productMap = new Map(products.map(p => [p.id, p]));
    let total = 0;
    const orderItems = items.map(item => {
      const product = productMap.get(item.productId);
      if (item.variant === 'smart' && product.smartPriceDelta == null) {
        throw new AppError(`${product.name} không có bản Smart.`, 400);
      }
      const unitPrice = product.price + (item.variant === 'smart' ? product.smartPriceDelta : 0);
      total += unitPrice * item.qty;
      return { productId: item.productId, qty: item.qty, unitPrice, variant: item.variant || null };
    });

    // Only physical (non-membership) products need a real shipping address —
    // VIP is digital-only, activates immediately on payment, nothing is ever
    // shipped for it.
    const needsShipping = products.some(p => p.category !== 'membership');
    if (needsShipping) {
      if (!shippingAddress || shippingAddress.length < 10) {
        throw new AppError('Địa chỉ không hợp lệ.', 400);
      }
    } else {
      shippingAddress = shippingAddress || NO_SHIPPING_PLACEHOLDER;
    }

    const order = await fastify.prisma.order.create({
      data: {
        userId: req.user.id,
        total,
        shippingName,
        shippingPhone,
        shippingAddress,
        note,
        items: { create: orderItems },
      },
      include: {
        items: { include: { product: { select: { id: true, name: true, emoji: true } } } },
      },
    });

    reply.code(201);
    return { order, payment: buildPaymentInfo(order) };
  });

  // GET /api/v1/orders
  fastify.get('/orders', { preHandler: [requireAuth] }, async (req) => {
    const orders = await fastify.prisma.order.findMany({
      where: { userId: req.user.id },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, emoji: true, images: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    const ordersWithCodes = await Promise.all(orders.map(async (order) => ({
      ...order,
      redeemCodes: await ensurePurchaseRedeemCodes(fastify.prisma, order),
    })));
    return { orders: ordersWithCodes };
  });

  // GET /api/v1/orders/:id
  fastify.get('/orders/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const order = await fastify.prisma.order.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, emoji: true, images: true } } },
        },
      },
    });
    if (!order) return reply.code(404).send({ message: 'Không tìm thấy đơn hàng.' });
    // Show payment info while still pending; once paid the customer doesn't need it.
    const payment = order.status === 'pending' ? buildPaymentInfo(order) : null;
    const redeemCodes = await ensurePurchaseRedeemCodes(fastify.prisma, order);
    return { order: { ...order, redeemCodes }, payment };
  });

  // PATCH /api/v1/orders/:id/shipping — fix the delivery details.
  //
  // The address was collected once at checkout and then frozen. A customer who
  // spotted a typo on the payment page — the one screen where they actually
  // read it back — had no way to correct it, and neither did they have one
  // afterwards. Restricted to unpaid orders: once we are packing, a silent
  // address change would send the parcel somewhere nobody is expecting it.
  fastify.patch('/orders/:id/shipping', { preHandler: [requireAuth, requireCsrf] }, async (req, reply) => {
    const parsed = shippingSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0]?.message || 'Dữ liệu không hợp lệ.', 400);
    }

    const order = await fastify.prisma.order.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { items: { include: { product: { select: { category: true } } } } },
    });
    if (!order) return reply.code(404).send({ message: 'Không tìm thấy đơn hàng.' });
    if (order.status !== 'pending' || order.paidAt) {
      return reply.code(409).send({
        message: 'Đơn đã được xử lý — vui lòng liên hệ Sprouty để đổi địa chỉ giao hàng.',
      });
    }

    // Same rule as checkout: only a physical product needs a real address.
    const needsShipping = order.items.some(i => i.product.category !== 'membership');
    let shippingAddress = parsed.data.shippingAddress?.trim() || '';
    if (needsShipping) {
      if (shippingAddress.length < 10) {
        throw new AppError('Địa chỉ quá ngắn, vui lòng nhập đầy đủ.', 400);
      }
    } else {
      shippingAddress = shippingAddress || NO_SHIPPING_PLACEHOLDER;
    }

    const updated = await fastify.prisma.order.update({
      where: { id: order.id },
      data: {
        shippingName: parsed.data.shippingName.trim(),
        shippingPhone: parsed.data.shippingPhone.trim(),
        shippingAddress,
      },
      include: { items: { include: { product: { select: { id: true, name: true, emoji: true, images: true } } } } },
    });

    return { order: updated, message: 'Đã cập nhật thông tin giao hàng.' };
  });

  // PATCH /api/v1/orders/:id/cancel — customer cancels their own order before payment
  fastify.patch('/orders/:id/cancel', { preHandler: [requireAuth, requireCsrf] }, async (req, reply) => {
    const order = await fastify.prisma.order.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!order) return reply.code(404).send({ message: 'Không tìm thấy đơn hàng.' });
    if (order.status !== 'pending') {
      return reply.code(409).send({ message: 'Chỉ có thể hủy đơn hàng đang chờ thanh toán.' });
    }
    const updated = await fastify.prisma.order.update({
      where: { id: order.id },
      data: { status: 'cancelled' },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, emoji: true, images: true } } },
        },
      },
    });
    return { order: updated };
  });
}
