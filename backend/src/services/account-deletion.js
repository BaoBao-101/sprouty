import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { AppError } from '../utils/errors.js';
import { recomputeProductRating } from './reviews.js';
import { storageProvider } from './storage/index.js';

/*
 * "Xoá tài khoản" — a customer closing their own account.
 *
 * The App Store requires an app that lets people sign up to let them delete the
 * account from inside it, and a parent is owed it anyway: the garden is photos
 * of their child.
 *
 * What goes: everything that is about the family — the plants and their
 * albums, uploaded photos (the files too), reviews, rewards, entitlements and
 * every session. The account row stays as a disabled, nameless husk, because
 * orders and workshop bookings point at it and those are the shop's books: a
 * paid order is revenue an accountant will ask about. Those records keep their
 * amounts and dates and lose the name, phone and address on them.
 *
 * Refused while something is still owed in either direction — a box packed or
 * on its way, a paid seat at a session that has not happened — because
 * deleting then would strand a parcel with no address or a refund with nobody
 * to send it to.
 */

/** What the husk is called afterwards. Unique per account, never deliverable. */
export const deletedEmail = (userId) => `deleted-${userId}@deleted.sprouty.invalid`;
export const DELETED_NAME = 'Tài khoản đã xoá';

/** Why the account cannot go yet, or null. */
export async function deletionBlocker(prisma, userId, now = new Date()) {
  const inFlight = await prisma.order.count({
    where: { userId, status: { in: ['processing', 'shipped'] } },
  });
  if (inFlight > 0) {
    return 'Bạn còn đơn hàng đang chuẩn bị hoặc đang giao. Hãy nhận hàng xong rồi xoá tài khoản nhé.';
  }

  const paidSeats = await prisma.workshopRegistration.count({
    where: {
      userId,
      status: { not: 'cancelled' },
      paidAt: { not: null },
      amount: { gt: 0 },
      checkedInAt: null,
      workshop: { dateTime: { gt: now }, status: { not: 'cancelled' } },
    },
  });
  if (paidSeats > 0) {
    return 'Bạn còn suất workshop đã thanh toán chưa diễn ra. Hãy liên hệ Sprouty để huỷ và hoàn tiền trước khi xoá tài khoản.';
  }
  return null;
}

/**
 * Deletes the account. Checks the password and the blockers first, so a
 * mistyped password or a parcel in transit changes nothing.
 */
export async function deleteCustomerAccount(prisma, { userId, password, now = new Date() }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== 'active') throw new AppError('Không tìm thấy tài khoản.', 404);
  if (user.role !== 'customer') {
    throw new AppError('Tài khoản nhân sự không tự xoá được. Vui lòng liên hệ quản trị viên.', 403);
  }
  if (!password || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AppError('Mật khẩu không đúng.', 400);
  }

  const blocker = await deletionBlocker(prisma, userId, now);
  if (blocker) throw new AppError(blocker, 409);

  // Collected before the rows go, so the files can be removed afterwards.
  const assets = await prisma.asset.findMany({
    where: { ownerUserId: userId, kind: { in: ['user_image', 'review_photo'] } },
    select: { id: true, key: true },
  });
  const reviewed = await prisma.productReview.findMany({ where: { userId }, select: { productId: true } });

  const husk = {
    email: deletedEmail(userId),
    name: DELETED_NAME,
    // Nobody knows this password, so the husk can never be signed into.
    passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 12),
    status: 'disabled',
    vipUntil: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
  };

  await prisma.$transaction(async (tx) => {
    await tx.session.deleteMany({ where: { userId } });

    // Nothing has been paid on these, so nothing is owed back.
    await tx.order.updateMany({ where: { userId, status: 'pending', paidAt: null }, data: { status: 'cancelled' } });
    await tx.workshopRegistration.updateMany({
      where: { userId, status: { not: 'cancelled' }, paidAt: null, workshop: { dateTime: { gt: now } } },
      data: { status: 'cancelled' },
    });

    // The books keep the money; the family's details come off them.
    await tx.order.updateMany({
      where: { userId },
      data: { shippingName: DELETED_NAME, shippingPhone: '', shippingAddress: '', note: null },
    });
    await tx.workshopRegistration.updateMany({
      where: { userId },
      data: { guestName: DELETED_NAME, guestPhone: null, guestEmail: null, note: null },
    });

    await tx.productReview.deleteMany({ where: { userId } });
    await tx.workshopReview.deleteMany({ where: { userId } });
    await tx.userProductImage.deleteMany({ where: { userId } });
    await tx.virtualPlant.deleteMany({ where: { userId } });
    await tx.userVideoProgress.deleteMany({ where: { userId } });
    await tx.userEntitlement.deleteMany({ where: { userId } });
    await tx.reward.deleteMany({ where: { userId } });
    await tx.aiDailyUsage.deleteMany({ where: { userId } });
    await tx.gardenPreference.deleteMany({ where: { userId } });
    if (assets.length) await tx.asset.deleteMany({ where: { id: { in: assets.map((a) => a.id) } } });

    await tx.user.update({ where: { id: userId }, data: husk });
    await tx.auditLog.create({
      data: {
        actorUserId: userId,
        action: 'user.account.delete',
        targetType: 'User',
        targetId: userId,
        metadata: { files: assets.length },
      },
    });
  });

  // After the commit: a file left behind is a little wasted disk, whereas a
  // file removed for a deletion that then rolled back is a photo lost.
  const storage = storageProvider();
  for (const asset of assets) {
    await storage.deleteObject({ key: asset.key }).catch(() => {});
  }
  for (const productId of new Set(reviewed.map((r) => r.productId))) {
    await recomputeProductRating(prisma, productId).catch(() => {});
  }

  return { files: assets.length };
}
