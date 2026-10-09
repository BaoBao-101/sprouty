import { AppError } from '../utils/errors.js';
import { isVipNow } from './membership.js';

export const aiLimit = (vip) => vip ? null : 5;
export const leafLimit = (vip) => vip ? null : 10;
export const usageDay = (now = new Date()) => new Date(now.getTime() + 7 * 3600000).toISOString().slice(0, 10);
export const effectiveGarden = (vip, pref = {}) => ({
  scene: vip ? (pref.scene || 'natural') : 'natural',
  decoration: vip ? (pref.decoration || 'plain') : 'plain',
});

export async function benefitsFor(prisma, userId) {
  const vip = await isVipNow(prisma, userId);
  const day = usageDay();
  const [usage, prefs] = await Promise.all([
    prisma.$queryRaw`SELECT "used" FROM "AiDailyUsage" WHERE "userId" = ${userId} AND "day" = ${day}`,
    prisma.$queryRaw`SELECT "scene", "decoration" FROM "GardenPreference" WHERE "userId" = ${userId}`,
  ]);
  return { vip, maxLeaves: leafLimit(vip), aiLimit: aiLimit(vip), aiUsed: usage[0]?.used || 0,
    resetsTimezone: 'Asia/Ho_Chi_Minh', ...effectiveGarden(vip, prefs[0]) };
}

export async function saveGarden(prisma, userId, { scene, decoration }) {
  const current = await benefitsFor(prisma, userId);
  if (!current.vip && (scene !== 'natural' || decoration !== 'plain')) {
    throw new AppError('Nâng cấp VIP để chọn cảnh và chậu trang trí.', 403);
  }
  await prisma.$executeRaw`
    INSERT INTO "GardenPreference" ("userId", "scene", "decoration") VALUES (${userId}, ${scene}, ${decoration})
    ON CONFLICT ("userId") DO UPDATE SET "scene" = EXCLUDED."scene", "decoration" = EXCLUDED."decoration"`;
  return benefitsFor(prisma, userId);
}

// A database reservation makes simultaneous requests and multiple workers share
// one allowance. Failed provider calls return their reserved turn.
export async function reserveAi(prisma, userId) {
  const limit = aiLimit(await isVipNow(prisma, userId));
  const day = usageDay();
  const rows = await prisma.$queryRaw`
    INSERT INTO "AiDailyUsage" ("userId", "day", "used") VALUES (${userId}, ${day}, 1)
    ON CONFLICT ("userId", "day") DO UPDATE SET "used" = "AiDailyUsage"."used" + 1
    WHERE ${limit === null} OR "AiDailyUsage"."used" < ${limit ?? 0} RETURNING "used"`;
  if (!rows.length) throw new AppError(`Bạn đã dùng hết ${limit} lượt AI hôm nay. Lượt mới mở lúc 00:00 giờ Việt Nam. VIP được hỏi AI không giới hạn.`, 429);
  let released = false;
  return async () => {
    if (released) return;
    released = true;
    await prisma.$executeRaw`UPDATE "AiDailyUsage" SET "used" = GREATEST(0, "used" - 1) WHERE "userId" = ${userId} AND "day" = ${day}`;
  };
}
