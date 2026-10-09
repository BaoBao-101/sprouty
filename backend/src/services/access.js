import { AppError } from '../utils/errors.js';
import { isVipNow } from './membership.js';

export async function hasPurchasedProduct(prisma, userId, productId) {
  if (!userId || !productId) return false;
  const item = await prisma.orderItem.findFirst({
    where: {
      productId: Number(productId),
      order: {
        userId,
        paidAt: { not: null },
        status: { not: 'cancelled' },
      },
    },
    select: { id: true },
  });
  return Boolean(item);
}

// VIP = the account's vipUntil is still ahead of us. It is written by
// services/membership.js from the paid membership orders, so a monthly plan
// now runs out after its month instead of lasting forever.
export async function isVipUser(prisma, userId) {
  return isVipNow(prisma, userId);
}

export async function hasEntitlement(prisma, userId, feature, productId = null) {
  if (!userId || !feature) return false;
  const now = new Date();
  const entitlement = await prisma.userEntitlement.findFirst({
    where: {
      userId,
      feature,
      OR: productId ? [{ productId: Number(productId) }, { productId: null }] : [{ productId: null }],
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      ],
    },
    select: { id: true },
  });
  return Boolean(entitlement);
}

/**
 * Whether this customer already grows this kit.
 *
 * A plant only exists because an activation code was redeemed, so it is the
 * strongest proof of ownership there is — stronger than the order lookup,
 * which misses a kit received as a gift, and stronger than the entitlement
 * rows, which an admin grant or a revocation can leave out of step.
 */
export async function hasPlantForProduct(prisma, userId, productId) {
  if (!userId || !productId) return false;
  const plant = await prisma.virtualPlant.findUnique({
    where: { userId_productId: { userId, productId: Number(productId) } },
    select: { id: true },
  });
  return Boolean(plant);
}

export async function canAccessProductFeature(prisma, user, productId, feature) {
  if (!user) return false;
  if (['employee', 'admin'].includes(user.role)) return true;
  if (await hasPurchasedProduct(prisma, user.id, productId)) return true;
  // Growing the plant is owning the kit. Without this a customer who activated
  // a gifted code could raise a plant but not open its own photo album.
  if (await hasPlantForProduct(prisma, user.id, productId)) return true;
  return hasEntitlement(prisma, user.id, feature, productId);
}

export function requireFeatureAccess(feature, options = {}) {
  return async function featureAccessPreHandler(req) {
    if (!req.user) throw new AppError('Bạn cần đăng nhập để thực hiện thao tác này.', 401);
    const prisma = this?.prisma || req.server?.prisma;
    if (!prisma) throw new AppError('Không thể kiểm tra quyền truy cập.', 500);
    const productId = options.productId
      ? options.productId(req)
      : req.params?.productId || req.body?.productId || null;
    const ok = productId
      ? await canAccessProductFeature(prisma, req.user, productId, feature)
      : await hasEntitlement(prisma, req.user.id, feature);
    if (!ok) throw new AppError('Bạn chưa có quyền sử dụng tính năng này.', 403);
  };
}

export async function activeEntitlements(prisma, userId) {
  const now = new Date();
  return prisma.userEntitlement.findMany({
    where: {
      userId,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });
}
