import { z } from 'zod';
import { requireEmployee, requireCsrf } from '../../middleware/rbac.js';
import { parseOrThrow } from '../../utils/validation.js';
import { auditLog } from '../../services/audit.js';

const statusSchema = z.object({
  status: z.enum(['active', 'hidden', 'deleted']),
});

export default async function adminUserImageRoutes(fastify) {
  fastify.get('/user-images', { preHandler: [requireEmployee] }, async (req) => {
    const where = {};
    if (req.query.productId) where.productId = Number(req.query.productId);
    if (req.query.userId) where.userId = String(req.query.userId);
    if (req.query.status) where.status = String(req.query.status);
    const images = await fastify.prisma.userProductImage.findMany({
      where,
      include: {
        asset: true,
        product: { select: { id: true, name: true } },
        user: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return { images };
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
