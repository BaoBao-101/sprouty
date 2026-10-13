/**
 * The last step of a parcel: arriving.
 *
 * Either side may say it arrived — the customer ("Đã nhận được hàng") or staff
 * (the carrier reported it, or the customer rang). If nobody does, a parcel
 * sent a week ago is taken to have arrived, so an order never hangs at "Đang
 * giao" forever and the customer is never asked about it again.
 */
export const AUTO_RECEIVE_DAYS = 7;

let lastRun = 0;

/**
 * Completes parcels sent more than AUTO_RECEIVE_DAYS ago that nobody has
 * confirmed. Run lazily from the routes that list orders, at most once a
 * minute, rather than by a scheduler the deployment would have to keep alive.
 * Orders shipped before `shippedAt` existed fall back to `updatedAt`, the
 * moment their status last changed.
 */
export async function settleArrived(prisma, now = new Date()) {
  if (now.getTime() - lastRun < 60_000) return 0;
  lastRun = now.getTime();
  const before = new Date(now.getTime() - AUTO_RECEIVE_DAYS * 86_400_000);
  const { count } = await prisma.order.updateMany({
    where: {
      status: 'shipped',
      OR: [{ shippedAt: { lt: before } }, { shippedAt: null, updatedAt: { lt: before } }],
    },
    data: { status: 'delivered', deliveredAt: now, deliveredBy: 'auto' },
  });
  return count;
}

/** For tests: forget the last run so the next call does its work. */
export function resetSettleClock() {
  lastRun = 0;
}
