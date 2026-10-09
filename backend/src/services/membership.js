/**
 * VIP Garden: who has it, and until when.
 *
 * A membership used to be a shop product like any other. It went in the cart
 * next to the kits, paid through the same order, and produced the same kind of
 * redeem code — which the customer then had to type in to "activate" a VIP
 * status that was really decided by something else entirely (any paid
 * membership order, with no end date). Buying a month of VIP made you VIP for
 * life, and the code you were asked to enter did nothing that mattered.
 *
 * Now the paid order is the whole story. Every place that marks an order paid
 * or cancels one calls syncMembership, which replays the account's membership
 * orders and writes the date it runs until onto the user. There is no code and
 * no second step: the money arriving is the upgrade.
 *
 * Replaying rather than adding is deliberate. Adding days on each payment is
 * one line, but it cannot be undone — a cancelled or refunded order would need
 * its days subtracted by something that remembers they were added. A replay
 * has nothing to remember, so running it twice, or after a cancellation, or
 * from two payment paths at once, always lands on the same date.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const MEMBERSHIP_CATEGORY = 'membership';

/** One unit's length. The column wins; the name is the fallback for old rows. */
export function membershipDaysFor(product) {
  if (product?.membershipDays && product.membershipDays > 0) return product.membershipDays;
  return /annual|năm/i.test(product?.name || '') ? 365 : 30;
}

/** True when an order has anything VIP in it. Needs items with product.category. */
export function hasMembershipItem(order) {
  return (order?.items || []).some((i) => i.product?.category === MEMBERSHIP_CATEGORY);
}

/** True when an order is a VIP purchase and nothing else — the VIP checkout's orders. */
export function isMembershipOrder(order) {
  const items = order?.items || [];
  return items.length > 0 && items.every((i) => i.product?.category === MEMBERSHIP_CATEGORY);
}

/**
 * The tier, from the user row. Expired is its own state so the account page
 * can say "đã hết hạn ngày …" instead of pretending they were never VIP.
 */
export function tierOf(user, now = new Date()) {
  const until = user?.vipUntil ? new Date(user.vipUntil) : null;
  const isVip = Boolean(until && until > now);
  return {
    tier: isVip ? 'vip' : 'regular',
    isVip,
    vipUntil: until ? until.toISOString() : null,
    vipExpired: Boolean(until && !isVip),
  };
}

/**
 * Recomputes vipUntil from the account's paid, uncancelled membership orders.
 *
 * Each purchase starts where the previous one ends, or on the day it was paid
 * if the previous one had already run out — so renewing early never loses the
 * days left, and coming back after a gap does not backdate the new month.
 */
export async function recomputeVipUntil(prisma, userId) {
  if (!userId) return null;

  const items = await prisma.orderItem.findMany({
    where: {
      product: { category: MEMBERSHIP_CATEGORY },
      order: { userId, paidAt: { not: null }, status: { not: 'cancelled' } },
    },
    select: {
      qty: true,
      product: { select: { name: true, membershipDays: true } },
      order: { select: { id: true, paidAt: true } },
    },
  });

  const byOrder = new Map();
  for (const item of items) {
    const entry = byOrder.get(item.order.id) || { paidAt: item.order.paidAt, days: 0 };
    entry.days += membershipDaysFor(item.product) * item.qty;
    byOrder.set(item.order.id, entry);
  }

  let until = null;
  for (const { paidAt, days } of [...byOrder.values()].sort((a, b) => a.paidAt - b.paidAt)) {
    const start = until && until > paidAt ? until : paidAt;
    until = new Date(start.getTime() + days * DAY_MS);
  }

  await prisma.user.update({ where: { id: userId }, data: { vipUntil: until } });
  return until;
}

/**
 * Call after an order's payment or cancellation changes. Does nothing for an
 * order with no membership in it, so every payment path can call it blindly.
 *
 * Takes an id rather than a row because the callers rarely hold the items:
 * the webhook only selected the total, the admin routes only the status.
 */
export async function syncMembership(prisma, orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      userId: true,
      items: { select: { product: { select: { category: true } } } },
    },
  });
  if (!order || !hasMembershipItem(order)) return null;
  return recomputeVipUntil(prisma, order.userId);
}

/** For a user row read elsewhere — `{ vipUntil }` is all it needs. */
export async function isVipNow(prisma, userId) {
  if (!userId) return false;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { vipUntil: true } });
  return tierOf(user).isVip;
}
