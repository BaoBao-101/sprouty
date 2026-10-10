import { z } from 'zod';
import { requireAdmin, requireCsrf } from '../../middleware/rbac.js';
import { AppError } from '../../utils/errors.js';
import { parseOrThrow } from '../../utils/validation.js';
import { speciesFor, stageLabel, STAGES } from '../../services/plant-sim.js';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.enum(['active', 'hidden', 'deleted']).optional(),
  search: z.string().trim().max(100).optional(),
  media: z.enum(['image', 'video']).optional(),
  stage: z.string().refine(value => STAGES.some(stage => stage.id === value), 'Giai đoạn không hợp lệ.').optional(),
  sort: z.enum(['newest', 'oldest']).default('newest'),
  productId: z.coerce.number().int().positive().optional(),
  userId: z.string().min(1).optional(),
});
const statusSchema = z.object({
  status: z.enum(['active', 'hidden']),
  expectedStatus: z.enum(['active', 'hidden']).optional(),
  reason: z.string().trim().max(500).optional(),
}).refine(data => data.status !== 'hidden' || (data.reason?.length || 0) >= 5, { message: 'Nhập lý do ẩn nội dung (ít nhất 5 ký tự).' });
const include = {
  asset: { select: { url: true, mimeType: true, sizeBytes: true, originalName: true } },
  product: { select: { id: true, name: true, speciesKey: true, category: true } },
  user: { select: { id: true, email: true, name: true } },
};
export function imageJourney(row, plant = null) {
  return { ...row, plant, species: row.product?.category === 'kit' ? speciesFor(row.product).label : null,
    stageLabel: row.stage ? stageLabel(row.stage, row.product) : null };
}

export default async function adminUserImageRoutes(fastify) {
  fastify.get('/user-images', { preHandler: [requireAdmin] }, async (req) => {
    const query = parseOrThrow(querySchema, req.query);
    const { page, limit, sort, search, status, stage, media, productId, userId } = query;
    const where = { ...(status && { status }), ...(stage && { stage }), ...(productId && { productId }), ...(userId && { userId }),
      ...(media && { asset: { mimeType: { startsWith: `${media}/` } } }) };
    if (search) {
      const contains = { contains: search, mode: 'insensitive' };
      const plants = await fastify.prisma.virtualPlant.findMany({ where: { nickname: contains }, select: { userId: true, productId: true } });
      where.OR = [{ title: contains }, { note: contains }, { user: { name: contains } }, { user: { email: contains } }, { product: { name: contains } }, ...plants.map(plant => ({ userId: plant.userId, productId: plant.productId }))];
    }
    const [total, groups] = await Promise.all([
      fastify.prisma.userProductImage.count({ where }),
      fastify.prisma.userProductImage.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    const pages = Math.max(1, Math.ceil(total / limit));
    const currentPage = Math.min(page, pages);
    const images = await fastify.prisma.userProductImage.findMany({ where, include,
      orderBy: [{ createdAt: sort === 'oldest' ? 'asc' : 'desc' }, { id: sort === 'oldest' ? 'asc' : 'desc' }], skip: (currentPage - 1) * limit, take: limit });
    const plants = images.length ? await fastify.prisma.virtualPlant.findMany({
      where: { OR: images.map(image => ({ userId: image.userId, productId: image.productId })) },
      select: { id: true, userId: true, productId: true, nickname: true, stage: true, activatedAt: true },
    }) : [];
    const plantMap = new Map(plants.map(plant => [`${plant.userId}:${plant.productId}`, plant]));
    const counts = { active: 0, hidden: 0, deleted: 0 };
    for (const group of groups) counts[group.status] = group._count._all;
    return { images: images.map(image => imageJourney(image, plantMap.get(`${image.userId}:${image.productId}`) || null)),
      total, page: currentPage, limit, pages, counts, all: counts.active + counts.hidden + counts.deleted,
      stages: STAGES.map(stage => ({ id: stage.id, label: stage.label })) };
  });

  fastify.get('/user-images/counts', { preHandler: [requireAdmin] }, async () => {
    const rows = await fastify.prisma.userProductImage.groupBy({ by: ['status'], _count: { _all: true } });
    const counts = { active: 0, hidden: 0, deleted: 0 };
    for (const row of rows) counts[row.status] = row._count._all;
    return { counts, total: counts.active + counts.hidden + counts.deleted };
  });

  fastify.patch('/user-images/:imageId/status', { preHandler: [requireAdmin, requireCsrf] }, async (req) => {
    const { status, expectedStatus, reason } = parseOrThrow(statusSchema, req.body);
    return fastify.prisma.$transaction(async tx => {
      const existing = await tx.userProductImage.findUnique({ where: { id: req.params.imageId } });
      if (!existing) throw new AppError('Không tìm thấy nội dung.', 404);
      if (existing.status === 'deleted') throw new AppError('Nội dung đã xóa không được khôi phục hoặc kiểm duyệt lại.', 409);
      if (expectedStatus && existing.status !== expectedStatus) throw new AppError('Trạng thái vừa thay đổi. Vui lòng tải lại thư viện.', 409);
      if (existing.status === status) return { image: { id: existing.id, status } };
      const result = await tx.userProductImage.updateMany({ where: { id: existing.id, status: existing.status }, data: { status } });
      if (!result.count) throw new AppError('Nội dung vừa được thay đổi hoặc xóa. Vui lòng tải lại.', 409);
      await tx.auditLog.create({ data: { actorUserId: req.user.id, action: `user_image.${status}`, targetType: 'UserProductImage', targetId: existing.id,
        metadata: { previousStatus: existing.status, productId: existing.productId, userId: existing.userId, reason: reason || null } } });
      return { image: { id: existing.id, status } };
    });
  });
}
