/**
 * Whether anything in this basket has to be delivered.
 *
 * Decided by PHYSICAL_CATEGORIES (comma-separated product categories, e.g.
 * "kit"). Empty means every product is digital: a kit unlocks a simulated
 * plant activated with a code, and a membership was always digital. Kept here,
 * in one place, so checkout, the customer's order page and the staff queue
 * cannot disagree about it.
 */
export function requiresShipping(products) {
  const physical = (process.env.PHYSICAL_CATEGORIES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (physical.length === 0) return false;
  return products.some((p) => p && physical.includes(p.category));
}

/** Whether an order (with its items' products loaded) has a parcel to send. */
export function orderNeedsShipping(order) {
  const products = (order.items || []).map((i) => i.product).filter(Boolean);
  // Without the items there is nothing to decide on: assume the parcel, the
  // careful answer, so a step is never skipped by accident.
  if (!products.length) return true;
  return requiresShipping(products);
}

/**
 * Employees fulfil paid orders; financial adjustments belong to administrators.
 *
 * A paid order with something to post goes processing → shipped → delivered.
 * One with nothing to post (a VIP plan, or codes only) goes straight from
 * processing to delivered: handing over the code was the delivery, and
 * making staff press "đang giao" for it described something that never
 * happened.
 */
export function allowedOrderTransitions(order) {
  if (order.status === 'pending') return order.paidAt ? ['processing'] : ['cancelled'];
  if (!order.paidAt) return [];
  if (order.status === 'processing') return orderNeedsShipping(order) ? ['shipped'] : ['delivered'];
  if (order.status === 'shipped') return ['delivered'];
  return [];
}
