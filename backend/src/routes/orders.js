import { z } from 'zod';
import { createHash, createHmac } from 'crypto';
import { AppError } from '../utils/errors.js';
import { requireCustomer, requireCsrf } from '../middleware/rbac.js';
import { auditLog } from '../services/audit.js';
import { syncWorkshopRewards } from '../services/rewards.js';
import { reconcile, pollingConfigured } from '../services/sepay.js';
import { paymentMemo } from '../services/payment-memo.js';
import {
  hasMembershipItem,
  membershipDaysFor,
  syncMembership,
  tierOf,
} from '../services/membership.js';

/**
 * Whether this deployment will credit a payment nobody made.
 *
 * Two independent conditions, both required. `NODE_ENV === 'production'` alone
 * would be enough if it were always set correctly, and `ALLOW_FAKE_PAYMENTS`
 * alone would be enough if nobody ever copied a .env to the server — so the
 * endpoint demands both, because either mistake on its own gives away the shop.
 */
export function fakePaymentsAllowed() {
  return process.env.NODE_ENV !== 'production'
    && process.env.ALLOW_FAKE_PAYMENTS === 'true';
}

// Build the payment-instruction payload for an order. Returns null in dev when
// SePay isn't configured, so the existing flow still works without payments.
export function buildPaymentInfo(order) {
  const acc = process.env.SEPAY_ACCOUNT_NUMBER;
  const bank = process.env.SEPAY_BANK_CODE;
  const name = process.env.SEPAY_ACCOUNT_NAME;
  if (!acc || !bank) return null;
  const memo = paymentMemo(bank, order.id);
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

// shippingAddress is optional, and no longer asked for at checkout: Sprouty
// sells simulated plants now, so there is no parcel for any product in the
// catalogue. The column and this field stay because historic orders carry real
// addresses, and because `requiresShipping` below is the one place to change
// if a physical product is ever introduced again.
const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1, 'Giỏ hàng trống.').max(50, 'Giỏ hàng không được vượt quá 50 sản phẩm.'),
  shippingName: noHtml('Tên người nhận').and(z.string().min(2, 'Tên người nhận không hợp lệ.').max(100)),
  shippingPhone: z.string().regex(/^[0-9]{9,11}$/, 'Số điện thoại không hợp lệ.'),
  shippingAddress: noHtml('Địa chỉ').and(z.string().max(500)).optional(),
  note: noHtml('Ghi chú').and(z.string().max(500)).optional(),
});

const NO_SHIPPING_PLACEHOLDER = 'Không áp dụng — sản phẩm số, kích hoạt ngay trên web.';

/**
 * Whether anything in this basket has to be delivered.
 *
 * Nothing does. Every product is digital: a kit unlocks a simulated plant that
 * is activated with a code and lived with on the site, and a membership was
 * always digital. This is a function rather than an inlined `false` so that
 * reintroducing a physical product is one edit in one place, instead of a hunt
 * through the checkout, the address form and the post-purchase emails.
 */
function requiresShipping(products) {
  const physical = (process.env.PHYSICAL_CATEGORIES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (physical.length === 0) return false;
  return products.some((p) => physical.includes(p.category));
}

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

/**
 * Closes an order that has nothing left to happen to it.
 *
 * The status ladder was built for parcels: pending, processing, shipped,
 * delivered. An order whose only deliverable is an activation code never
 * reaches a courier, so nothing ever moved it past `processing` — a
 * customer who had paid, received their code, redeemed it and grown the
 * plant was still looking at "đang xử lý" with no step left to take.
 *
 * Handing over the code is the delivery. Orders that do contain something
 * physical keep the manual ladder, because for those the status is a claim
 * about the real world that only a person can make.
 */
async function settleIfNothingToShip(prisma, order) {
  if (order?.status !== 'processing' || !order.paidAt) return order;

  const products = (order.items || []).map((i) => i.product).filter(Boolean);
  if (!products.length || requiresShipping(products)) return order;

  await prisma.order.update({
    where: { id: order.id },
    data: { status: 'delivered' },
  });
  // Mutated rather than re-read: the caller already holds the row and is
  // about to serialise it.
  order.status = 'delivered';
  return order;
}

async function ensurePurchaseRedeemCodes(prisma, order) {
  if (!order?.paidAt || order.status === 'cancelled') return [];

  // Which of this order's kits the customer has already activated. Looked up
  // once for the whole order rather than per code: the orders list renders
  // every order a customer has, and a query per code turned one page load into
  // dozens of round trips.
  //
  // Keyed on the plant, not on the redeem code's usedCount, because the plant
  // is the thing the customer is being offered a link to — and a code redeemed
  // and then somehow left without a plant should still read as "activate".
  const productIds = [...new Set((order.items || []).map((i) => i.productId))];
  const plants = productIds.length
    ? await prisma.virtualPlant.findMany({
        where: { userId: order.userId, productId: { in: productIds } },
        select: { id: true, productId: true, nickname: true, stage: true, activatedAt: true },
      })
    : [];
  const plantByProduct = new Map(plants.map((p) => [p.productId, p]));

  const seen = new Set();
  const codes = [];
  for (const item of order.items || []) {
    if (seen.has(item.productId)) continue;
    seen.add(item.productId);

    // VIP is switched on by the payment itself (services/membership.js).
    // Issuing a code for it asked the customer to activate something that
    // was already active — or, before that, that nothing actually read.
    if (item.product?.category === 'membership') continue;
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
    const plant = plantByProduct.get(item.productId) || null;

    // A kit code is spent when its plant exists; that is the thing the
    // customer is offered a link to. A membership code has no plant, ever,
    // so keying it on the plant left it looking unused forever — the
    // "gieo hạt" button kept coming back after the membership was already
    // active, and pressing it could only fail. Those are spent when this
    // account has a redemption for them.
    //
    // An unknown category keeps the old plant-based reading rather than
    // guessing, so a caller that did not select it behaves as before.
    const category = item.product?.category;
    const isKit = category ? category === 'kit' : true;

    let redemption = null;
    if (!isKit && redeemCode.usedCount > 0) {
      redemption = await prisma.redeemCodeRedemption.findFirst({
        where: { redeemCodeId: redeemCode.id, userId: order.userId },
        select: { redeemedAt: true },
      });
    }

    codes.push({
      code: plaintext,
      productId: item.productId,
      productName: item.product?.name || null,
      kind: isKit ? 'kit' : 'membership',
      features: redeemCode.features,
      usedCount: redeemCode.usedCount,
      maxUses: redeemCode.maxUses,
      status: redeemCode.status,
      // So the orders page can say "đã kích hoạt" and link to the plant,
      // instead of offering an activate button for a code that is spent.
      redeemed: isKit ? Boolean(plant) : Boolean(redemption),
      plantId: plant?.id || null,
      plantNickname: plant?.nickname || null,
      activatedAt: isKit ? plant?.activatedAt || null : redemption?.redeemedAt || null,
    });
  }
  return codes;
}

export default async function orderRoutes(fastify) {
  // POST /api/v1/orders
  fastify.post('/orders', {
    preHandler: [requireCustomer, requireCsrf],
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

    // VIP has its own checkout on /vip (routes/membership.js). Sold from the
    // cart it rode along with the kits, came back as a code, and needed a
    // second step to switch on; bought there, paying is the upgrade.
    if (products.some((p) => p.category === 'membership')) {
      throw new AppError(
        'Gói VIP Garden được mua riêng ở trang VIP. Vui lòng xoá gói này khỏi giỏ hàng.',
        400,
      );
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

    const needsShipping = requiresShipping(products);
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
  // GET /api/v1/orders — the customer's own order history, paged.
  //
  // Paged because it only grows, and because each row costs a redeem-code
  // check: returning every order a long-standing customer ever placed meant
  // doing that work for all of them to render the ten they were looking at.
  // The counts are over the whole history, so the tabs do not renumber
  // themselves as you click between them.
  fastify.get('/orders', { preHandler: [requireCustomer] }, async (req) => {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));

    const where = { userId: req.user.id };
    if (req.query.status) where.status = String(req.query.status);

    const [orders, total, statusCounts] = await Promise.all([
      fastify.prisma.order.findMany({
        where,
        include: {
          items: {
            include: { product: { select: { id: true, name: true, emoji: true, images: true, category: true, membershipDays: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      fastify.prisma.order.count({ where }),
      fastify.prisma.order.groupBy({
        by: ['status'],
        where: { userId: req.user.id },
        _count: { _all: true },
      }),
    ]);

    const ordersWithCodes = await Promise.all(
      orders.map(async (order) => {
        const redeemCodes = await ensurePurchaseRedeemCodes(fastify.prisma, order);
        await settleIfNothingToShip(fastify.prisma, order);
        return { ...order, redeemCodes };
      }),
    );

    return {
      orders: ordersWithCodes,
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
      counts: Object.fromEntries(statusCounts.map((r) => [r.status, r._count._all])),
    };
  });

  // GET /api/v1/orders/:id
  fastify.get('/orders/:id', { preHandler: [requireCustomer] }, async (req, reply) => {
    // The payment page polls this every second and a half while it waits. If
    // SePay cannot reach us — which is every laptop, and any production day
    // the webhook is missed or misrouted — this is the other direction: ask
    // SePay what has arrived before answering. Throttled and shared across
    // callers inside reconcile(), so one API call serves everyone waiting.
    if (pollingConfigured()) {
      const pending = await fastify.prisma.order.findFirst({
        where: { id: req.params.id, userId: req.user.id, status: 'pending' },
        select: { id: true },
      });
      if (pending) await reconcile(fastify);
    }

    const order = await fastify.prisma.order.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, emoji: true, images: true, category: true, membershipDays: true } } },
        },
      },
    });
    if (!order) return reply.code(404).send({ message: 'Không tìm thấy đơn hàng.' });
    // Show payment info while still pending; once paid the customer doesn't need it.
    const payment = order.status === 'pending' ? buildPaymentInfo(order) : null;
    const redeemCodes = await ensurePurchaseRedeemCodes(fastify.prisma, order);
    await settleIfNothingToShip(fastify.prisma, order);

    // A VIP order answers with the account's tier, so the page that just
    // watched the money land can say "VIP đến ngày …" without a second call.
    // It also re-runs the grant: idempotent, and the safety net for a
    // payment path that failed to (see services/membership.js).
    let membership = null;
    if (hasMembershipItem(order)) {
      if (order.paidAt) await syncMembership(fastify.prisma, order.id);
      const user = await fastify.prisma.user.findUnique({
        where: { id: req.user.id },
        select: { vipUntil: true },
      });
      const days = order.items
        .filter((i) => i.product?.category === 'membership')
        .reduce((sum, i) => sum + membershipDaysFor(i.product) * i.qty, 0);
      membership = { days, ...tierOf(user) };
    }

    return {
      order: { ...order, redeemCodes },
      payment,
      membership,
      // Whether the payment page should offer the "pay without paying" button.
      // Decided here rather than from a build-time flag on the client, so the
      // button cannot appear against a server that would refuse it.
      canSimulatePayment: fakePaymentsAllowed() && order.status === 'pending' && !order.paidAt,
    };
  });

  // PATCH /api/v1/orders/:id/shipping — fix the delivery details.
  //
  // The address was collected once at checkout and then frozen. A customer who
  // spotted a typo on the payment page — the one screen where they actually
  // read it back — had no way to correct it, and neither did they have one
  // afterwards. Restricted to unpaid orders: once we are packing, a silent
  // address change would send the parcel somewhere nobody is expecting it.
  fastify.patch('/orders/:id/shipping', { preHandler: [requireCustomer, requireCsrf] }, async (req, reply) => {
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

    // Same rule as checkout.
    const needsShipping = requiresShipping(order.items.map(i => i.product));
    let shippingAddress = parsed.data.shippingAddress?.trim() || '';
    if (needsShipping) {
      if (shippingAddress.length < 10) {
        throw new AppError('Địa chỉ quá ngắn, vui lòng nhập đầy đủ.', 400);
      }
    } else {
      // The payment page no longer has an address field, so a customer fixing
      // a typo in their name sends none. Keep whatever the order already had —
      // orders placed before Sprouty went digital carry a real address, and
      // overwriting it with the placeholder would destroy a delivery record
      // staff may still need.
      shippingAddress = shippingAddress || order.shippingAddress || NO_SHIPPING_PLACEHOLDER;
    }

    const updated = await fastify.prisma.order.update({
      where: { id: order.id },
      data: {
        shippingName: parsed.data.shippingName.trim(),
        shippingPhone: parsed.data.shippingPhone.trim(),
        shippingAddress,
      },
      include: { items: { include: { product: { select: { id: true, name: true, emoji: true, images: true, category: true, membershipDays: true } } } } },
    });

    return { order: updated, message: 'Đã cập nhật thông tin giao hàng.' };
  });

  // PATCH /api/v1/orders/:id/cancel — customer cancels their own order before payment
  fastify.patch('/orders/:id/cancel', { preHandler: [requireCustomer, requireCsrf] }, async (req, reply) => {
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
          include: { product: { select: { id: true, name: true, emoji: true, images: true, category: true, membershipDays: true } } },
        },
      },
    });
    return { order: updated };
  });

  // POST /api/v1/orders/:id/simulate-payment
  //
  // Credits an order as if the bank had paid it. This exists because the real
  // flow cannot be exercised without a live SePay account: an order sits at
  // "chờ thanh toán" forever, so nothing downstream — the activation code, the
  // plant, the workshop reward — can be tested or demonstrated at all.
  //
  // It is refused unless BOTH NODE_ENV is non-production AND ALLOW_FAKE_PAYMENTS
  // is explicitly "true" (see fakePaymentsAllowed). Every call writes an audit
  // row naming it as fake, so a credited order can always be told apart from a
  // real one. sepayTransactionId stays null — no bank transaction backs this.
  fastify.post('/orders/:id/simulate-payment', {
    preHandler: [requireCustomer, requireCsrf],
  }, async (req, reply) => {
    if (!fakePaymentsAllowed()) {
      // Deliberately a 404, not a 403: on a production host this route should
      // look like it does not exist rather than like a locked door.
      return reply.code(404).send({ message: 'Không tìm thấy.' });
    }

    const order = await fastify.prisma.order.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!order) return reply.code(404).send({ message: 'Không tìm thấy đơn hàng.' });
    if (order.paidAt) {
      return reply.code(409).send({ message: 'Đơn này đã được thanh toán rồi.' });
    }
    if (order.status === 'cancelled') {
      return reply.code(409).send({ message: 'Không thể thanh toán cho đơn đã huỷ.' });
    }

    const updated = await fastify.prisma.order.update({
      where: { id: order.id },
      data: { paidAt: new Date(), status: 'processing' },
      include: {
        items: { include: { product: { select: { id: true, name: true, emoji: true, images: true, category: true, membershipDays: true } } } },
      },
    });

    await auditLog(fastify.prisma, req.user.id, 'payment.simulated', 'Order', order.id, {
      total: order.total,
      fake: true,
      ip: req.ip,
    });
    await syncMembership(fastify.prisma, order.id);

    // Same downstream work the webhook does, so a simulated payment exercises
    // the real path rather than a shortcut through it.
    const [redeemCodes, rewards] = await Promise.all([
      ensurePurchaseRedeemCodes(fastify.prisma, updated),
      syncWorkshopRewards(fastify.prisma, order.userId).catch((err) => {
        fastify.log.error({ err, orderId: order.id }, 'Reward sync after simulated payment failed');
        return null;
      }),
    ]);

    return {
      message: 'Đã ghi nhận thanh toán (chế độ thử nghiệm).',
      order: { ...updated, redeemCodes },
      redeemCodes,
      rewardsEarned: rewards?.newlyEarned ?? 0,
      simulated: true,
    };
  });
}
