/**
 * Product reviews: who may write one, how a reviewer is named in public, and
 * the score a product carries.
 *
 * A review is earned by receiving the product — an order in `delivered` — so
 * the site only ever shows verified buyers. The product row keeps the average
 * and count of its published reviews, refreshed whenever one changes, so the
 * shop can put stars on every card without counting reviews per listing.
 *
 * Workshop sessions are reviewed the same way, earned at the door instead of
 * the doorstep: a booking staff checked in. Sessions end and leave the
 * schedule, so their score is read across all of them, not stored per row.
 */

export const RATING_LABELS = {
  1: 'Rất tệ',
  2: 'Chưa hài lòng',
  3: 'Bình thường',
  4: 'Hài lòng',
  5: 'Tuyệt vời',
};

/**
 * Quick remarks a customer can tick instead of typing. The good ones are
 * offered from four stars, the bad ones up to two, both at three. A fixed list
 * keeps them comparable across reviews, and the server refuses anything else.
 */
export const REVIEW_TAGS = {
  good: [
    'Bé rất thích',
    'Hạt nảy mầm tốt',
    'Hướng dẫn dễ hiểu',
    'Cây 3D sinh động',
    'Đóng gói cẩn thận',
    'Giao hàng nhanh',
    'Đáng tiền',
  ],
  bad: [
    'Hạt khó nảy mầm',
    'Thiếu đồ trong hộp',
    'Hướng dẫn khó hiểu',
    'Hộp bị móp, hư hỏng',
    'Giao hàng chậm',
    'Chưa đáng tiền',
  ],
};

/** The same idea for a workshop session: the day itself, not a parcel. */
export const WORKSHOP_REVIEW_TAGS = {
  good: [
    'Bé rất vui',
    'Bé học được nhiều điều',
    'Hướng dẫn viên nhiệt tình',
    'Hoạt động hấp dẫn',
    'Tổ chức chu đáo',
    'Không gian thoải mái',
    'Đúng giờ',
  ],
  bad: [
    'Bắt đầu trễ',
    'Lớp quá đông',
    'Hoạt động chưa hợp tuổi',
    'Thiếu dụng cụ',
    'Khó tìm địa điểm',
    'Chưa đáng tiền',
  ],
};

const tagSet = (list) => new Set([...list.good, ...list.bad]);
const PRODUCT_TAGS = tagSet(REVIEW_TAGS);
const WORKSHOP_TAGS = tagSet(WORKSHOP_REVIEW_TAGS);

export const MAX_REVIEW_IMAGES = 4;
export const MAX_REVIEW_LENGTH = 1000;

/** Unknown tags dropped, duplicates removed, order kept. */
export function cleanTags(tags, kind = 'product') {
  const allowed = kind === 'workshop' ? WORKSHOP_TAGS : PRODUCT_TAGS;
  return [...new Set((tags || []).map((t) => String(t).trim()))].filter((t) => allowed.has(t));
}

/**
 * How a reviewer appears to everyone else.
 *
 * Vietnamese names put the family name first, so "Nguyễn Mai Anh" becomes
 * "Mai Anh N.": enough to read as a real person, not enough to find them.
 * Anonymous reviews are signed by the shop's customers as a whole.
 */
export function reviewerName(fullName, anonymous) {
  if (anonymous) return 'Khách hàng Sprouty';
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Khách hàng Sprouty';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(1).join(' ')} ${parts[0].charAt(0).toUpperCase()}.`;
}

/** The review as anyone may see it. */
export function publicReview(r) {
  const name = reviewerName(r.user?.name, r.anonymous);
  return {
    id: r.id,
    rating: r.rating,
    content: r.content || '',
    tags: r.tags || [],
    images: r.images || [],
    author: name,
    initial: name.charAt(0).toUpperCase(),
    verified: true,
    edited: Boolean(r.editedAt),
    createdAt: r.createdAt,
    reply: r.reply ? { content: r.reply, at: r.repliedAt } : null,
  };
}

/** The customer's own review: what everyone sees, plus its moderation state. */
export function ownReview(r) {
  return {
    ...publicReview(r),
    productId: r.productId,
    anonymous: r.anonymous,
    status: r.status,
    hiddenReason: r.status === 'hidden' ? r.hiddenReason || null : null,
  };
}

/**
 * The products this customer may review, each with the delivered order that
 * qualifies it (the latest one). Plans are not reviewable: there is no thing
 * that arrived to have an opinion about.
 */
export async function reviewableProducts(prisma, userId) {
  const items = await prisma.orderItem.findMany({
    where: {
      order: { userId, status: 'delivered' },
      product: { category: { not: 'membership' } },
    },
    select: {
      productId: true,
      order: { select: { id: true, deliveredAt: true, createdAt: true } },
      product: { select: { id: true, name: true, images: true } },
    },
    orderBy: { order: { createdAt: 'desc' } },
  });
  const byProduct = new Map();
  for (const item of items) {
    if (byProduct.has(item.productId)) continue;
    byProduct.set(item.productId, {
      productId: item.productId,
      orderId: item.order.id,
      deliveredAt: item.order.deliveredAt,
      product: { id: item.product.id, name: item.product.name, image: item.product.images?.[0] || null },
    });
  }
  return byProduct;
}

/** Refreshes the product's stored score from its published reviews. */
export async function recomputeProductRating(prisma, productId) {
  const agg = await prisma.productReview.aggregate({
    where: { productId, status: 'published' },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const count = agg._count._all;
  const avg = count ? Math.round(agg._avg.rating * 100) / 100 : 0;
  await prisma.product.update({ where: { id: productId }, data: { ratingAvg: avg, ratingCount: count } });
  return { ratingAvg: avg, ratingCount: count };
}

/**
 * The score panel: average, count, how many at each star, how many with
 * photos, and the share that would recommend it (four stars or more).
 */
export async function ratingSummary(prisma, productId) {
  return summarize(prisma.productReview, { productId, status: 'published' });
}

/** The same panel over workshop reviews — every session, or one. */
export async function workshopRatingSummary(prisma, workshopId) {
  return summarize(prisma.workshopReview, { ...(workshopId ? { workshopId } : {}), status: 'published' });
}

async function summarize(model, where) {
  const [groups, withPhotos] = await Promise.all([
    model.groupBy({ by: ['rating'], where, _count: { _all: true } }),
    model.count({ where: { ...where, images: { isEmpty: false } } }),
  ]);
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const g of groups) distribution[g.rating] = g._count._all;
  const count = Object.values(distribution).reduce((a, b) => a + b, 0);
  const sum = Object.entries(distribution).reduce((a, [star, n]) => a + Number(star) * n, 0);
  return {
    average: count ? Math.round((sum / count) * 10) / 10 : 0,
    count,
    distribution,
    withPhotos,
    recommendPercent: count ? Math.round(((distribution[4] + distribution[5]) / count) * 100) : 0,
  };
}

/** A workshop review as anyone may see it: the review, and which session. */
export function publicWorkshopReview(r) {
  return {
    ...publicReview(r),
    workshop: r.workshop ? { id: r.workshop.id, title: r.workshop.title, dateTime: r.workshop.dateTime } : null,
  };
}

/** The parent's own workshop review, with its moderation state. */
export function ownWorkshopReview(r) {
  return {
    ...publicWorkshopReview(r),
    workshopId: r.workshopId,
    anonymous: r.anonymous,
    status: r.status,
    hiddenReason: r.status === 'hidden' ? r.hiddenReason || null : null,
  };
}

/**
 * The sessions this parent may review: bookings of theirs that staff checked
 * in at the door. A seat that was paid for but never used says nothing about
 * the day, so it does not count; neither does a session Sprouty called off.
 */
export async function reviewableWorkshops(prisma, userId) {
  const rows = await prisma.workshopRegistration.findMany({
    where: {
      userId,
      status: { not: 'cancelled' },
      checkedInAt: { not: null },
      workshop: { status: { not: 'cancelled' } },
    },
    select: {
      id: true,
      checkedInAt: true,
      workshop: { select: { id: true, title: true, imageUrl: true, dateTime: true, endTime: true, location: true } },
    },
    orderBy: { checkedInAt: 'desc' },
  });
  const byWorkshop = new Map();
  for (const r of rows) {
    if (byWorkshop.has(r.workshop.id)) continue;
    byWorkshop.set(r.workshop.id, {
      workshopId: r.workshop.id,
      registrationId: r.id,
      checkedInAt: r.checkedInAt,
      workshop: r.workshop,
    });
  }
  return byWorkshop;
}
