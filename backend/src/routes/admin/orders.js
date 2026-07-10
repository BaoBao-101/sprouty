import { z } from 'zod';
import { AppError } from '../../utils/errors.js';
import { requireEmployee, requireCsrf } from '../../middleware/rbac.js';

const updateStatusSchema = z.object({
  status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']),
});

export default async function adminOrderRoutes(fastify) {
  // GET /api/v1/admin/orders
  fastify.get('/orders', { preHandler: [requireEmployee] }, async (req) => {
    const { status, search, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const where = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { shippingName: { contains: search, mode: 'insensitive' } },
        { shippingPhone: { contains: search } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [orders, total] = await Promise.all([
      fastify.prisma.order.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, name: true } },
          items: {
            include: { product: { select: { id: true, name: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
      }),
      fastify.prisma.order.count({ where }),
    ]);

    return { orders, total, page: pageNum, limit: pageSize, pages: Math.ceil(total / pageSize) };
  });

  // PATCH /api/v1/admin/orders/:id/status
  fastify.patch('/orders/:id/status', { preHandler: [requireEmployee, requireCsrf] }, async (req, reply) => {
    const parsed = updateStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0]?.message || 'Trạng thái không hợp lệ.', 400);
    }

    const order = await fastify.prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return reply.code(404).send({ message: 'Không tìm thấy đơn hàng.' });

    const updated = await fastify.prisma.order.update({
      where: { id: req.params.id },
      data: { status: parsed.data.status },
    });

    return { order: updated };
  });
}
