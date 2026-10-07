/**
 * Claiming an activation code.
 *
 * This moved out of routes/redeem.js when activation stopped being only about
 * entitlements: a kit code now also plants the virtual plant it unlocks, and
 * the plant page has its own activation form. Two copies of a transaction that
 * increments a use counter is exactly the kind of duplication that ends with
 * one of them forgetting a guard.
 */

import { createHash } from 'crypto';
import { AppError } from '../utils/errors.js';
import { auditLog } from './audit.js';
import { createPlantForProduct } from './plants.js';

export function normalizeCode(code) {
  return String(code || '').trim().toUpperCase().replace(/\s+/g, '');
}

export function hashRedeemCode(code) {
  return createHash('sha256').update(normalizeCode(code)).digest('hex');
}

function assertCodeUsable(code, redemptionsForUser) {
  const now = new Date();
  if (code.status !== 'active') throw new AppError('Mã này không còn hoạt động.', 400);
  if (code.startsAt && code.startsAt > now) throw new AppError('Mã này chưa bắt đầu hiệu lực.', 400);
  if (code.expiresAt && code.expiresAt <= now) throw new AppError('Mã này đã hết hạn.', 400);
  if (code.maxUses !== null && code.usedCount >= code.maxUses) {
    throw new AppError('Mã này đã hết lượt sử dụng.', 409);
  }
  if (redemptionsForUser >= code.perUserLimit) {
    throw new AppError('Bạn đã sử dụng hết lượt cho mã này.', 409);
  }
}

/**
 * Redeems `code` for `userId`: grants the entitlements it carries and, when it
 * names a kit, plants the virtual plant that kit unlocks.
 *
 * The plant is created outside the redemption transaction on purpose. Holding
 * a transaction open across the plant and device inserts would widen the window
 * in which two concurrent submits of the same code contend on the use counter,
 * and `createPlantForProduct` is idempotent — a plant that already exists is
 * returned rather than duplicated — so there is nothing to roll back.
 */
export async function redeemCode(prisma, userId, code, { ip = null, nickname = null } = {}) {
  const codeHash = hashRedeemCode(code);
  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      const found = await tx.redeemCode.findUnique({ where: { codeHash } });
      if (!found) throw new AppError('Mã không hợp lệ.', 404);
      const userUses = await tx.redeemCodeRedemption.count({
        where: { redeemCodeId: found.id, userId },
      });
      assertCodeUsable(found, userUses);
      if (found.maxUses !== null) {
        const updated = await tx.redeemCode.updateMany({
          where: { id: found.id, usedCount: { lt: found.maxUses } },
          data: { usedCount: { increment: 1 } },
        });
        if (updated.count !== 1) throw new AppError('Mã này đã hết lượt sử dụng.', 409);
      } else {
        await tx.redeemCode.update({
          where: { id: found.id },
          data: { usedCount: { increment: 1 } },
        });
      }
      const redemption = await tx.redeemCodeRedemption.create({
        data: { redeemCodeId: found.id, userId },
      });
      const entitlements = [];
      for (const feature of found.features) {
        entitlements.push(await tx.userEntitlement.create({
          data: {
            userId,
            feature,
            productId: found.productId,
            source: 'redeem_code',
            sourceId: redemption.id,
            startsAt: found.startsAt,
            expiresAt: found.expiresAt,
          },
        }));
      }
      return { redeemCode: found, redemption, entitlements };
    });
  } catch (err) {
    // 409 here means the code was already claimed by someone (possibly this
    // same user hitting perUserLimit, or a different account racing a kit
    // that's already been activated). Either way, leave a trail so admin can
    // investigate who the legitimate buyer is via order records — without this,
    // a fraudulent second activation attempt left no trace.
    if (err instanceof AppError && err.statusCode === 409) {
      const found = await prisma.redeemCode.findUnique({ where: { codeHash } });
      await auditLog(
        prisma, userId, 'redeem_code.duplicate_attempt', 'RedeemCode',
        found?.id || codeHash, { ip },
      );
    }
    throw err;
  }

  await auditLog(prisma, userId, 'redeem_code.redeem', 'RedeemCode', result.redeemCode.id, {
    redemptionId: result.redemption.id,
    features: result.redeemCode.features,
    productId: result.redeemCode.productId,
  });

  // A code tied to a kit is what activates a plant. One tied to no product (a
  // promotional AI-assistant code, say) grants its features and nothing more.
  let plant = null;
  let plantCreated = false;
  if (result.redeemCode.productId) {
    const product = await prisma.product.findUnique({
      where: { id: result.redeemCode.productId },
      select: { category: true },
    });
    if (product?.category === 'kit') {
      const planted = await createPlantForProduct(
        prisma, userId, result.redeemCode.productId, { nickname },
      );
      plant = planted.plant;
      plantCreated = planted.created;
      if (plantCreated) {
        await auditLog(prisma, userId, 'plant.activated', 'VirtualPlant', plant.id, {
          productId: plant.productId,
          redeemCodeId: result.redeemCode.id,
        });
      }
    }
  }

  return {
    features: result.redeemCode.features,
    productId: result.redeemCode.productId,
    entitlements: result.entitlements,
    plant,
    plantCreated,
  };
}
