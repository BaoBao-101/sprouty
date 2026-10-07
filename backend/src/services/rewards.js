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
export async function claimRewardTx(tx, userId, registrationId) {
  const candidate = await tx.reward.findFirst({
    where: { userId, type: 'free_workshop', status: 'available' },
    orderBy: { milestone: 'asc' },
    select: { id: true },
  });
  if (!candidate) return null;

  const claimed = await tx.reward.updateMany({
    where: { id: candidate.id, status: 'available' },
    data: { status: 'claimed', claimedRegistrationId: registrationId, claimedAt: new Date() },
  });
  if (claimed.count !== 1) return null;
  return candidate.id;
}

/**
 * Gives a reward back when the free booking it paid for is cancelled.
 *
 * Without this, cancelling a free seat would quietly burn the reward — the
 * customer paid for three kits and would end up with nothing to show for it.
 */
export async function releaseRewardForRegistration(prisma, registrationId) {
  const reward = await prisma.reward.findFirst({
    where: { claimedRegistrationId: registrationId, status: 'claimed' },
    select: { id: true },
  });
  if (!reward) return null;
  await prisma.reward.update({
    where: { id: reward.id },
    data: { status: 'available', claimedRegistrationId: null, claimedAt: null },
  });
  return reward.id;
}

/** Throws unless the customer has a free seat to spend. */
export async function assertRewardAvailable(prisma, userId) {
  const count = await prisma.reward.count({
    where: { userId, type: 'free_workshop', status: 'available' },
  });
  if (count < 1) {
    throw new AppError(
      `Bạn chưa có suất workshop miễn phí. Mua ${rewardThreshold()} sản phẩm trồng cây để được tặng 1 suất.`,
      409,
    );
  }
}
