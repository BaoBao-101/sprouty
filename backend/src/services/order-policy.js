/** Employees fulfil paid orders; financial adjustments belong to administrators. */
export function allowedOrderTransitions(order) {
  if (order.status === 'pending') return order.paidAt ? ['processing'] : ['cancelled'];
  if (!order.paidAt) return [];
  if (order.status === 'processing') return ['shipped'];
  if (order.status === 'shipped') return ['delivered'];
  return [];
}
