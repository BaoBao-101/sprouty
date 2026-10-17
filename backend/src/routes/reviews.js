import { z } from 'zod';
import { requireCustomer, requireCsrf } from '../middleware/rbac.js';
import { AppError } from '../utils/errors.js';
import { multipartFields, noHtml } from '../utils/validation.js';
import { createAsset } from '../services/storage/index.js';
import {
  MAX_REVIEW_IMAGES,
  MAX_REVIEW_LENGTH,
  RATING_LABELS,
  REVIEW_TAGS,
  WORKSHOP_REVIEW_TAGS,
  cleanTags,
  ownReview,
  ownWorkshopReview,
  publicReview,
  publicWorkshopReview,
  ratingSummary,
  recomputeProductRating,
  reviewableProducts,
  reviewableWorkshops,
  workshopRatingSummary,
} from '../services/reviews.js';

/**
 * Reviews: read by anyone on the product and workshop pages, written by
 * customers about what they received and the sessions their child attended.
 */

const customer = [requireCustomer, requireCsrf];

const contentSchema = noHtml('Nội dung đánh giá').and(
  z.string().trim().max(MAX_REVIEW_LENGTH, `Nội dung tối đa ${MAX_REVIEW_LENGTH} ký tự.`),
);

const reviewFields = {
  rating: z.coerce.number({ invalid_type_error: 'Chọn số sao.' })
    .int('Chọn số sao.')
    .min(1, 'Chọn từ 1 đến 5 sao.')
    .max(5, 'Chọn từ 1 đến 5 sao.'),
  content: contentSchema.optional().nullable().or(z.literal('')),
  tags: z.array(z.string().max(60)).max(13).optional(),
  images: z.array(z.string().max(512)).max(MAX_REVIEW_IMAGES, `Tối đa ${MAX_REVIEW_IMAGES} ảnh.`).optional(),
  anonymous: z.boolean().optional(),
};

const createSchema = z.object({
  productId: z.coerce.number({ invalid_type_error: 'Sản phẩm không hợp lệ.' }).int().positive('Sản phẩm không hợp lệ.'),
  ...reviewFields,
});
const updateSchema = z.object(reviewFields).partial();
const workshopCreateSchema = z.object({
  workshopId: z.string({ invalid_type_error: 'Buổi workshop không hợp lệ.' }).min(1, 'Buổi workshop không hợp lệ.').max(64),
  ...reviewFields,
});

function parse(schema, body) {
  const parsed = schema.safeParse(body || {});
  if (!parsed.success) throw new AppError(parsed.error.errors[0]?.message || 'Dữ liệu không hợp lệ.', 400);
  return parsed.data;
}

/**
 * A review's photos must be ones this customer uploaded for a review, so a
 * review cannot point at another customer's album or at anything off-site.
 */
async function assertOwnPhotos(prisma, userId, images) {
  const wanted = [...new Set(images || [])];
  if (!wanted.length) return [];
  const mine = await prisma.asset.count({ where: { url: { in: wanted }, ownerUserId: userId, kind: 'review_photo' } });
  if (mine !== wanted.length) throw new AppError('Ảnh đánh giá không hợp lệ — vui lòng tải ảnh lên lại.', 400);
  return wanted;
}

/**
 * Limits per account, counted once the session is known. Keyed on the address
 * instead, every family behind one school or office network would share a
 * single allowance.
 */
const perCustomer = (max) => ({
  max,
  timeWindow: '1 hour',
  hook: 'preHandler',
  keyGenerator: (req) => `review:${req.user?.id || req.ip}`,
});

const SORTS = {
  newest: [{ createdAt: 'desc' }],
  highest: [{ rating: 'desc' }, { createdAt: 'desc' }],
  lowest: [{ rating: 'asc' }, { createdAt: 'desc' }],
};

/** ?page, ?limit (6 by default, at most 20), ?rating=1..5, ?photos=1, ?sort */
function listQuery(query, base) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(20, Math.max(1, Number.parseInt(query.limit, 10) || 6));
  const where = { ...base, status: 'published' };
  const rating = Number.parseInt(query.rating, 10);
  if (rating >= 1 && rating <= 5) where.rating = rating;
  if (query.photos === '1') where.images = { isEmpty: false };
  return { page, limit, where, orderBy: SORTS[query.sort] || SORTS.newest };
}

const withAuthor = { user: { select: { name: true } } };
const withSession = { ...withAuthor, workshop: { select: { id: true, title: true, dateTime: true } } };

export default async function reviewRoutes(fastify) {
  /**
   * GET /api/v1/products/:id/reviews — the score panel and a page of reviews.
   * ?rating=1..5, ?photos=1, ?sort=newest|highest|lowest, ?page, ?limit
   */
  fastify.get('/products/:id/reviews', async (req, reply) => {
    const productId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(productId)) return reply.code(400).send({ message: 'ID không hợp lệ.' });
    const product = await fastify.prisma.product.findFirst({ where: { id: productId, status: 'published' }, select: { id: true } });
    if (!product) return reply.code(404).send({ message: 'Không tìm thấy sản phẩm.' });

    const { page, limit, where, orderBy } = listQuery(req.query, { productId });
    const [summary, total, rows] = await Promise.all([
      ratingSummary(fastify.prisma, productId),
      fastify.prisma.productReview.count({ where }),
      fastify.prisma.productReview.findMany({ where, include: withAuthor, orderBy, skip: (page - 1) * limit, take: limit }),
    ]);

    return {
      summary,
      reviews: rows.map(publicReview),
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    };
  });

  /**
   * GET /api/v1/me/reviews — what this customer has reviewed, what they still
   * can, and the choices the review form offers.
   */
  fastify.get('/me/reviews', { preHandler: [requireCustomer] }, async (req) => {
    const [mine, eligible] = await Promise.all([
      fastify.prisma.productReview.findMany({
        where: { userId: req.user.id },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      reviewableProducts(fastify.prisma, req.user.id),
    ]);
    return {
      reviews: mine.map(ownReview),
      eligible: [...eligible.values()],
      options: { labels: RATING_LABELS, tags: REVIEW_TAGS, maxImages: MAX_REVIEW_IMAGES, maxLength: MAX_REVIEW_LENGTH },
    };
  });

  /** POST /api/v1/me/reviews — review a product that arrived. */
  fastify.post('/me/reviews', {
    preHandler: customer,
    config: { rateLimit: perCustomer(20) },
  }, async (req, reply) => {
    const data = parse(createSchema, req.body);
    const eligible = await reviewableProducts(fastify.prisma, req.user.id);
    const source = eligible.get(data.productId);
    if (!source) {
      return reply.code(403).send({ message: 'Bạn có thể đánh giá sau khi đã nhận được sản phẩm này.' });
    }
    const existing = await fastify.prisma.productReview.findUnique({
      where: { userId_productId: { userId: req.user.id, productId: data.productId } },
      select: { id: true },
    });
    if (existing) {
      return reply.code(409).send({ message: 'Bạn đã đánh giá sản phẩm này — hãy sửa đánh giá cũ.', reviewId: existing.id });
    }
    const images = await assertOwnPhotos(fastify.prisma, req.user.id, data.images);

    let review;
    try {
      review = await fastify.prisma.productReview.create({
        data: {
          productId: data.productId,
          userId: req.user.id,
          orderId: source.orderId,
          rating: data.rating,
          content: data.content?.trim() || null,
          tags: cleanTags(data.tags),
          images,
          anonymous: Boolean(data.anonymous),
        },
        include: { user: { select: { name: true } } },
      });
    } catch (err) {
      // Two submits at once: the unique index lets one through.
      if (err?.code === 'P2002') return reply.code(409).send({ message: 'Bạn đã đánh giá sản phẩm này.' });
      throw err;
    }
    const rating = await recomputeProductRating(fastify.prisma, data.productId);
    reply.code(201);
    return { review: ownReview(review), product: { id: data.productId, ...rating }, message: 'Cảm ơn bạn đã đánh giá!' };
  });

  /** PATCH /api/v1/me/reviews/:id — change one's own review. */
  fastify.patch('/me/reviews/:id', { preHandler: customer }, async (req, reply) => {
    const review = await fastify.prisma.productReview.findUnique({ where: { id: req.params.id } });
    if (!review || review.userId !== req.user.id) return reply.code(404).send({ message: 'Không tìm thấy đánh giá.' });
    const data = parse(updateSchema, req.body);

    const changes = {};
    if (data.rating !== undefined) changes.rating = data.rating;
    if (data.content !== undefined) changes.content = data.content?.trim() || null;
    if (data.tags !== undefined) changes.tags = cleanTags(data.tags);
    if (data.images !== undefined) changes.images = await assertOwnPhotos(fastify.prisma, req.user.id, data.images);
    if (data.anonymous !== undefined) changes.anonymous = data.anonymous;
    if (!Object.keys(changes).length) return { review: ownReview({ ...review, user: { name: req.user.name } }) };

    const updated = await fastify.prisma.productReview.update({
      where: { id: review.id },
      data: { ...changes, editedAt: new Date() },
      include: { user: { select: { name: true } } },
    });
    const rating = await recomputeProductRating(fastify.prisma, review.productId);
    return { review: ownReview(updated), product: { id: review.productId, ...rating }, message: 'Đã cập nhật đánh giá.' };
  });

  /** DELETE /api/v1/me/reviews/:id — take one's own review down. */
  fastify.delete('/me/reviews/:id', { preHandler: customer }, async (req, reply) => {
    const review = await fastify.prisma.productReview.findUnique({ where: { id: req.params.id } });
    if (!review || review.userId !== req.user.id) return reply.code(404).send({ message: 'Không tìm thấy đánh giá.' });
    await fastify.prisma.productReview.delete({ where: { id: review.id } });
    const rating = await recomputeProductRating(fastify.prisma, review.productId);
    return { product: { id: review.productId, ...rating }, message: 'Đã xoá đánh giá.' };
  });

  /**
   * POST /api/v1/me/review-images — upload a photo for a review and get its
   * URL back; the form sends the URLs with the review.
   */
  fastify.post('/me/review-images', {
    preHandler: customer,
    config: { rateLimit: perCustomer(40) },
  }, async (req, reply) => {
    const { file } = await multipartFields(req);
    if (!file) return reply.code(400).send({ message: 'Chưa chọn ảnh.' });
    const asset = await createAsset(fastify.prisma, {
      ownerUserId: req.user.id,
      kind: 'review_photo',
      file,
      category: 'image',
    });
    reply.code(201);
    return { url: asset.url };
  });

  // ── Workshop sessions ──────────────────────────────────────────────────

  /**
   * GET /api/v1/workshop-reviews — what parents said about the sessions their
   * child attended, across all of them: a session ends and leaves the
   * schedule, and the experience is what a new parent is choosing.
   * Same filters as a product's reviews.
   */
  fastify.get('/workshop-reviews', async (req) => {
    const { page, limit, where, orderBy } = listQuery(req.query, {});
    const [summary, total, rows] = await Promise.all([
      workshopRatingSummary(fastify.prisma),
      fastify.prisma.workshopReview.count({ where }),
      fastify.prisma.workshopReview.findMany({ where, include: withSession, orderBy, skip: (page - 1) * limit, take: limit }),
    ]);
    return {
      summary,
      reviews: rows.map(publicWorkshopReview),
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    };
  });

  /**
   * GET /api/v1/me/workshop-reviews — the sessions this parent has reviewed,
   * the ones they still can, and the choices the form offers.
   */
  fastify.get('/me/workshop-reviews', { preHandler: [requireCustomer] }, async (req) => {
    const [mine, eligible] = await Promise.all([
      fastify.prisma.workshopReview.findMany({
        where: { userId: req.user.id },
        include: withSession,
        orderBy: { createdAt: 'desc' },
      }),
      reviewableWorkshops(fastify.prisma, req.user.id),
    ]);
    return {
      reviews: mine.map(ownWorkshopReview),
      eligible: [...eligible.values()],
      options: { labels: RATING_LABELS, tags: WORKSHOP_REVIEW_TAGS, maxImages: MAX_REVIEW_IMAGES, maxLength: MAX_REVIEW_LENGTH },
    };
  });

  /** POST /api/v1/me/workshop-reviews — review a session the child attended. */
  fastify.post('/me/workshop-reviews', {
    preHandler: customer,
    config: { rateLimit: perCustomer(20) },
  }, async (req, reply) => {
    const data = parse(workshopCreateSchema, req.body);
    const eligible = await reviewableWorkshops(fastify.prisma, req.user.id);
    const source = eligible.get(data.workshopId);
    if (!source) {
      return reply.code(403).send({ message: 'Bạn có thể đánh giá sau khi bé đã tham gia buổi này và được nhân viên điểm danh.' });
    }
    const existing = await fastify.prisma.workshopReview.findUnique({
      where: { userId_workshopId: { userId: req.user.id, workshopId: data.workshopId } },
      select: { id: true },
    });
    if (existing) {
      return reply.code(409).send({ message: 'Bạn đã đánh giá buổi này — hãy sửa đánh giá cũ.', reviewId: existing.id });
    }
    const images = await assertOwnPhotos(fastify.prisma, req.user.id, data.images);

    let review;
    try {
      review = await fastify.prisma.workshopReview.create({
        data: {
          workshopId: data.workshopId,
          userId: req.user.id,
          registrationId: source.registrationId,
          rating: data.rating,
          content: data.content?.trim() || null,
          tags: cleanTags(data.tags, 'workshop'),
          images,
          anonymous: Boolean(data.anonymous),
        },
        include: withSession,
      });
    } catch (err) {
      // Two submits at once: the unique index lets one through.
      if (err?.code === 'P2002') return reply.code(409).send({ message: 'Bạn đã đánh giá buổi này.' });
      throw err;
    }
    reply.code(201);
    return { review: ownWorkshopReview(review), message: 'Cảm ơn bạn đã đánh giá buổi học!' };
  });

  /** PATCH /api/v1/me/workshop-reviews/:id — change one's own review. */
  fastify.patch('/me/workshop-reviews/:id', { preHandler: customer }, async (req, reply) => {
    const review = await fastify.prisma.workshopReview.findUnique({ where: { id: req.params.id }, include: withSession });
    if (!review || review.userId !== req.user.id) return reply.code(404).send({ message: 'Không tìm thấy đánh giá.' });
    const data = parse(updateSchema, req.body);

    const changes = {};
    if (data.rating !== undefined) changes.rating = data.rating;
    if (data.content !== undefined) changes.content = data.content?.trim() || null;
    if (data.tags !== undefined) changes.tags = cleanTags(data.tags, 'workshop');
    if (data.images !== undefined) changes.images = await assertOwnPhotos(fastify.prisma, req.user.id, data.images);
    if (data.anonymous !== undefined) changes.anonymous = data.anonymous;
    if (!Object.keys(changes).length) return { review: ownWorkshopReview(review) };

    const updated = await fastify.prisma.workshopReview.update({
      where: { id: review.id },
      data: { ...changes, editedAt: new Date() },
      include: withSession,
    });
    return { review: ownWorkshopReview(updated), message: 'Đã cập nhật đánh giá.' };
  });

  /** DELETE /api/v1/me/workshop-reviews/:id — take one's own review down. */
  fastify.delete('/me/workshop-reviews/:id', { preHandler: customer }, async (req, reply) => {
    const review = await fastify.prisma.workshopReview.findUnique({ where: { id: req.params.id }, select: { id: true, userId: true } });
    if (!review || review.userId !== req.user.id) return reply.code(404).send({ message: 'Không tìm thấy đánh giá.' });
    await fastify.prisma.workshopReview.delete({ where: { id: review.id } });
    return { message: 'Đã xoá đánh giá.' };
  });
}
