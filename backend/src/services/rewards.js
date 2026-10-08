/**
 * "Mua 3 sản phẩm trồng cây — tặng 1 buổi workshop miễn phí (tuỳ chọn)."
 *
 * Earned rewards are rows rather than a number derived on the fly. A customer
 * who claims a free seat and then buys three more kits must not have the first
 * reward silently returned to them, and staff need to see which booking each
 * free seat was spent on — neither of which a computed count can express.
 *
 * `syncWorkshopRewards` is therefore idempotent and safe to call from anywhere:
 * it only ever inserts the milestones a customer has reached but does not yet
 * have a row for. It runs after a payment, and again whenever the customer
 * looks at their rewards, which is what makes a missed webhook self-heal.
 */

import { AppError } from '../utils/errors.js';

/** Qualifying purchases per free workshop. */
export function rewardThreshold() {
  const raw = Number(process.env.WORKSHOP_REWARD_THRESHOLD || 3);
  if (!Number.isInteger(raw) || raw < 1) return 3;
  return raw;
}

/**
 * Units of planting product this customer has actually paid for.
 *
 * Counted in units, not orders: three kits in one basket is the promotion
 * working as advertised, and three separate orders must count the same. Only
 * the 'kit' category qualifies — a VIP membership is not a planting product.
 */
export async function paidKitUnits(prisma, userId) {
  const result = await prisma.orderItem.aggregate({
    where: {
      product: { category: 'kit' },
      order: { userId, paidAt: { not: null }, status: { not: 'cancelled' } },
    },
    _sum: { qty: true },
  });
  return result._sum.qty || 0;
}

/**
 * Mints any reward the customer has earned but not yet been given, and returns
 * the full picture for the progress UI.
 */
export async function syncWorkshopRewards(prisma, userId) {
  const threshold = rewardThreshold();
  const units = await paidKitUnits(prisma, userId);
  const earned = Math.floor(units / threshold);

  const existing = await prisma.reward.findMany({
    where: { userId, type: 'free_workshop' },
    orderBy: { milestone: 'asc' },
  });
  const have = new Set(existing.map((r) => r.milestone));

  const missing = [];
  for (let milestone = 1; milestone <= earned; milestone += 1) {
    if (!have.has(milestone)) missing.push({ userId, type: 'free_workshop', milestone });
  }
  if (missing.length) {
    // skipDuplicates: two payments landing at once would otherwise race on the
    // unique index and turn a webhook ack into a 500.
    await prisma.reward.createMany({ data: missing, skipDuplicates: true });
  }

  const rewards = missing.length
    ? await prisma.reward.findMany({
        where: { userId, type: 'free_workshop' },
        orderBy: { milestone: 'asc' },
      })
    : existing;

  const available = rewards.filter((r) => r.status === 'available');
  return {
    threshold,
    units,
    earned,
    // Where they are inside the current set of three.
    progressInCycle: units % threshold,
    unitsToNext: earned >= 0 ? threshold - (units % threshold) : threshold,
    availableCount: available.length,
    claimedCount: rewards.length - available.length,
    newlyEarned: missing.length,
    rewards: rewards.map(rewardDto),
  };
}

export function rewardDto(reward) {
  return {
    id: reward.id,
    type: reward.type,
    status: reward.status,
    milestone: reward.milestone,
    claimedRegistrationId: reward.claimedRegistrationId,
    claimedAt: reward.claimedAt,
    createdAt: reward.createdAt,
  };
}

/**
 * Spends one available reward on a workshop registration, inside the caller's
 * transaction.
 *
 * The guarded `updateMany` is the whole point: two bookings submitted at once
 * would both have read the same "available" row, and only one of them can win.
 * A caller that sees `null` must charge the customer normally.
 */

/**
 * Claims up to `count` rewards for one booking.
 *
 * All or nothing: the caller is pricing a booking against the number it
 * asked for, so claiming three of four and carrying on would charge the
 * customer for a seat they had a reward for. Returning fewer than asked
 * means the transaction should roll back.
 *
 * Each row is claimed with a guarded updateMany rather than a plain
 * update, so two tabs spending the same reward cannot both succeed —
 * the second sees count 0 and the whole claim fails.
 */
export async function claimRewardsTx(tx, userId, registrationId, count) {
  if (count < 1) return [];

  const candidates = await tx.reward.findMany({
    where: { userId, type: 'free_workshop', status: 'available' },
    orderBy: { milestone: 'asc' },
    take: count,
    select: { id: true },
  });
  if (candidates.length < count) return [];

  const claimed = [];
  for (const candidate of candidates) {
    const result = await tx.reward.updateMany({
      where: { id: candidate.id, status: 'available' },
      data: { status: 'claimed', claimedRegistrationId: registrationId, claimedAt: new Date() },
    });
    if (result.count !== 1) return [];
    claimed.push(candidate.id);
  }
  return claimed;
}

/**
 * Gives a reward back when the free booking it paid for is cancelled.
 *
 * Without this, cancelling a free seat would quietly burn the reward — the
 * customer paid for three kits and would end up with nothing to show for it.
 */
export async function releaseRewardForRegistration(prisma, registrationId) {
  // Every reward the booking spent, not the first one found. A booking can
  // carry several now, and releasing one of three left the other two stuck
  // as claimed against a registration that no longer exists — the customer
  // bought the kits, earned the seats, cancelled once and lost them.
  const released = await prisma.reward.updateMany({
    where: { claimedRegistrationId: registrationId, status: 'claimed' },
    data: { status: 'available', claimedRegistrationId: null, claimedAt: null },
  });
  return released.count;
}

/** Throws unless the customer has a free seat to spend. */
export async function assertRewardAvailable(prisma, userId, wanted = 1) {
  const count = await prisma.reward.count({
    where: { userId, type: 'free_workshop', status: 'available' },
  });
  if (count < 1) {
    throw new AppError(
      `Bạn chưa có suất workshop miễn phí. Mua ${rewardThreshold()} sản phẩm trồng cây để được tặng 1 suất.`,
      409,
    );
  }
  if (count < wanted) {
    throw new AppError(`Bạn chỉ còn ${count} suất miễn phí, không đủ ${wanted} suất.`, 409);
  }
}
