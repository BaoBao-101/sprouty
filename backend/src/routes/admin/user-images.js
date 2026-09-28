import { z } from 'zod';
import { requireEmployee, requireCsrf } from '../../middleware/rbac.js';
import { parseOrThrow } from '../../utils/validation.js';
import { auditLog } from '../../services/audit.js';

const statusSchema = z.object({
  status: z.enum(['active', 'hidden', 'deleted']),
});

export default async function adminUserImageRoutes(fastify) {
  // Paged rather than a flat `take: 200` — past the 200th upload the oldest
  // images became unreachable, which for a moderation queue means unreviewable.
  fastify.get('/user-images', { preHandler: [requireEmployee] }, async (req) => {
    const { page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const where = {};
    if (req.query.productId) where.productId = Number(req.query.productId);
    if (req.query.userId) where.userId = String(req.query.userId);
    if (req.query.status) where.status = String(req.query.status);

    const [images, total] = await Promise.all([
      fastify.prisma.userProductImage.findMany({
        where,
        include: {
          asset: true,
          product: { select: { id: true, name: true } },
          user: { select: { id: true, email: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
      }),
      fastify.prisma.userProductImage.count({ where }),
    ]);

    return { images, total, page: pageNum, limit: pageSize, pages: Math.ceil(total / pageSize) };
  });

  // Counts per status, so the filter tabs can show how much is waiting without
  // a request per tab.
  fastify.get('/user-images/counts', { preHandler: [requireEmployee] }, async () => {
    const rows = await fastify.prisma.userProductImage.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const counts = { active: 0, hidden: 0, deleted: 0 };
    for (const row of rows) counts[row.status] = row._count._all;
    return { counts, total: counts.active + counts.hidden + counts.deleted };
  });

  fastify.patch('/user-images/:imageId/status', { preHandler: [requireEmployee, requireCsrf] }, async (req, reply) => {
    const { status } = parseOrThrow(statusSchema, req.body);
    const existing = await fastify.prisma.userProductImage.findUnique({ where: { id: req.params.imageId } });
    if (!existing) return reply.code(404).send({ message: 'Không tìm thấy ảnh.' });
    const image = await fastify.prisma.userProductImage.update({
      where: { id: existing.id },
      data: { status },
      include: { asset: true, product: true, user: { select: { id: true, email: true, name: true } } },
    });
    await auditLog(fastify.prisma, req.user.id, `user_image.${status}`, 'UserProductImage', image.id, {
      previousStatus: existing.status,
      productId: image.productId,
      userId: image.userId,
    });
    return { image };
  });
}
