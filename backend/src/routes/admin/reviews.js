import { z } from 'zod';
import { requireAdmin, requireCsrf } from '../../middleware/rbac.js';
import { AppError } from '../../utils/errors.js';
import { noHtml } from '../../utils/validation.js';
import { auditLog } from '../../services/audit.js';
import { recomputeProductRating, reviewerName } from '../../services/reviews.js';
import { readPaging, paged } from './paging.js';

/**
 * Reviews, from the shop's side: read them all, answer customers in public,
 * and hide what breaks the rules. Hiding takes a review out of the score; it
 * never edits what the customer wrote.
 *
 * Product reviews and workshop reviews are moderated the same way, so both
 * are served by one set of routes, each under its own path.
 */

const writeAuth = [requireAdmin, requireCsrf];

const replySchema = z.object({
  reply: noHtml('Phản hồi').and(z.string().trim().max(1000, 'Phản hồi tối đa 1000 ký tự.')),
});
const statusSchema = z.object({
  status: z.enum(['published', 'hidden'], { errorMap: () => ({ message: 'Trạng thái không hợp lệ.' }) }),
  reason: noHtml('Lý do').and(z.string().trim().max(300, 'Lý do tối đa 300 ký tự.')).optional(),
});

function parse(schema, body) {
  const parsed = schema.safeParse(body || {});
  if (!parsed.success) throw new AppError(parsed.error.errors[0]?.message || 'Dữ liệu không hợp lệ.', 400);
  return parsed.data;
}

/** What every review row carries, whatever it is about. */
function baseReview(r) {
  return {
    id: r.id,
    rating: r.rating,
    content: r.content || '',
    tags: r.tags,
    images: r.images,
    anonymous: r.anonymous,
    publicName: reviewerName(r.user?.name, r.anonymous),
    status: r.status,
    hiddenReason: r.hiddenReason,
    reply: r.reply,
    repliedAt: r.repliedAt,
    edited: Boolean(r.editedAt),
    createdAt: r.createdAt,
    customer: r.user ? { id: r.user.id, name: r.user.name, email: r.user.email } : null,
  };
}

const user = { select: { id: true, name: true, email: true } };

const KINDS = {
  product: {
    path: '/reviews',
    model: (prisma) => prisma.productReview,
    targetType: 'ProductReview',
    action: 'review',
    include: { product: { select: { id: true, name: true, images: true } }, user },
    toDto: (r) => ({
      ...baseReview(r),
      product: r.product ? { id: r.product.id, name: r.product.name, image: r.product.images?.[0] || null } : null,
      orderId: r.orderId,
    }),
    /** ?productId */
    scope(query) {
      const id = Number.parseInt(query.productId, 10);
      return Number.isInteger(id) ? { productId: id } : {};
    },
    search: (q) => [{ product: { name: { contains: q, mode: 'insensitive' } } }],
    meta: (r) => ({ productId: r.productId }),
    // The product row keeps its own score; a workshop's is read live.
    afterChange: (prisma, r) => recomputeProductRating(prisma, r.productId),
  },
  workshop: {
    path: '/workshop-reviews',
    model: (prisma) => prisma.workshopReview,
    targetType: 'WorkshopReview',
    action: 'review.workshop',
    include: {
      workshop: { select: { id: true, title: true, imageUrl: true, dateTime: true, endTime: true, location: true } },
      registration: { select: { id: true, childCount: true, attendedCount: true, checkedInAt: true } },
      user,
    },
    toDto: (r) => ({
      ...baseReview(r),
      workshop: r.workshop
        ? {
          id: r.workshop.id,
          title: r.workshop.title,
          image: r.workshop.imageUrl || null,
          dateTime: r.workshop.dateTime,
          endTime: r.workshop.endTime,
          location: r.workshop.location,
        }
        : null,
      registration: r.registration
        ? {
          id: r.registration.id,
          children: r.registration.attendedCount ?? r.registration.childCount,
          checkedInAt: r.registration.checkedInAt,
        }
        : null,
    }),
    /** ?workshopId */
    scope(query) {
      const id = String(query.workshopId || '').trim();
      return id ? { workshopId: id } : {};
    },
    search: (q) => [{ workshop: { title: { contains: q, mode: 'insensitive' } } }],
    meta: (r) => ({ workshopId: r.workshopId }),
    afterChange: async () => {},
  },
};

function registerKind(fastify, kind) {
  // Resolved per request: the client is decorated onto the instance by then.
  const model = () => kind.model(fastify.prisma);

  /**
   * GET /api/v1/admin/reviews and /api/v1/admin/workshop-reviews
   * ?view=all|needs_reply|low|hidden|photos, ?rating=1..5, ?productId or
   * ?workshopId, ?search, ?page
   *
   * The stats and counts follow ?productId / ?workshopId, so a single
   * session's reviews come with that session's score.
   */
  fastify.get(kind.path, { preHandler: [requireAdmin] }, async (req) => {
    const paging = readPaging(req.query);
    const scope = kind.scope(req.query);
    const where = { ...scope };
    switch (req.query.view) {
      case 'needs_reply': Object.assign(where, { status: 'published', reply: null }); break;
      case 'low': Object.assign(where, { rating: { lte: 3 } }); break;
      case 'hidden': Object.assign(where, { status: 'hidden' }); break;
      case 'photos': Object.assign(where, { images: { isEmpty: false } }); break;
      default: break;
    }
    const rating = Number.parseInt(req.query.rating, 10);
    if (rating >= 1 && rating <= 5) where.rating = rating;
    const search = String(req.query.search || '').trim();
    if (search) {
      where.OR = [
        { content: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        ...kind.search(search),
      ];
    }

    const published = { ...scope, status: 'published' };
    const [rows, total, all, average, needsReply, low, hidden, photos, positive] = await Promise.all([
      model().findMany({ where, include: kind.include, orderBy: { createdAt: 'desc' }, skip: paging.skip, take: paging.take }),
      model().count({ where }),
      model().count({ where: scope }),
      model().aggregate({ where: published, _avg: { rating: true }, _count: { _all: true } }),
      model().count({ where: { ...published, reply: null } }),
      model().count({ where: { ...scope, rating: { lte: 3 } } }),
      model().count({ where: { ...scope, status: 'hidden' } }),
      model().count({ where: { ...scope, images: { isEmpty: false } } }),
      model().count({ where: { ...published, rating: { gte: 4 } } }),
    ]);
    const publishedCount = average._count._all;

    return {
      ...paged(rows.map(kind.toDto), total, paging, 'reviews'),
      stats: {
        average: publishedCount ? Math.round(average._avg.rating * 10) / 10 : 0,
        published: publishedCount,
        positivePercent: publishedCount ? Math.round((positive / publishedCount) * 100) : 0,
        needsReply,
      },
      counts: { all, needs_reply: needsReply, low, hidden, photos },
    };
  });

  /** PATCH …/:id/reply — answer in public; empty removes the answer. */
  fastify.patch(`${kind.path}/:id/reply`, { preHandler: writeAuth }, async (req, reply) => {
    const { reply: text } = parse(replySchema, req.body);
    const review = await model().findUnique({ where: { id: req.params.id } });
    if (!review) return reply.code(404).send({ message: 'Không tìm thấy đánh giá.' });

    const updated = await model().update({
      where: { id: review.id },
      data: text
        ? { reply: text, repliedAt: new Date(), repliedById: req.user.id }
        : { reply: null, repliedAt: null, repliedById: null },
      include: kind.include,
    });
    await auditLog(fastify.prisma, req.user.id, `${kind.action}.${text ? 'reply' : 'reply.remove'}`, kind.targetType, review.id, {
      ...kind.meta(review),
      rating: review.rating,
    });
    return { review: kind.toDto(updated), message: text ? 'Đã gửi phản hồi.' : 'Đã gỡ phản hồi.' };
  });

  /** PATCH …/:id/status — hide (with a reason) or show again. */
  fastify.patch(`${kind.path}/:id/status`, { preHandler: writeAuth }, async (req, reply) => {
    const { status, reason } = parse(statusSchema, req.body);
    if (status === 'hidden' && !reason) throw new AppError('Nhập lý do ẩn đánh giá.', 400);
    const review = await model().findUnique({ where: { id: req.params.id } });
    if (!review) return reply.code(404).send({ message: 'Không tìm thấy đánh giá.' });

    const updated = await model().update({
      where: { id: review.id },
      data: { status, hiddenReason: status === 'hidden' ? reason : null },
      include: kind.include,
    });
    await kind.afterChange(fastify.prisma, review);
    await auditLog(fastify.prisma, req.user.id, `${kind.action}.${status === 'hidden' ? 'hide' : 'show'}`, kind.targetType, review.id, {
      ...kind.meta(review),
      rating: review.rating,
      ...(reason ? { reason } : {}),
    });
    return { review: kind.toDto(updated), message: status === 'hidden' ? 'Đã ẩn đánh giá.' : 'Đã hiện lại đánh giá.' };
  });
}

export default async function adminReviewRoutes(fastify) {
  registerKind(fastify, KINDS.product);
  registerKind(fastify, KINDS.workshop);
}
