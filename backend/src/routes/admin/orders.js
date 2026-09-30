import { z } from 'zod';
import { AppError } from '../../utils/errors.js';
import { requireEmployee, requireCsrf } from '../../middleware/rbac.js';
import { auditLog } from '../../services/audit.js';

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

  // GET /api/v1/admin/orders/counts — how many orders sit in each status, so the
  // filter tabs can show the size of each queue without one request per tab.
  fastify.get('/orders/counts', { preHandler: [requireEmployee] }, async () => {
    const rows = await fastify.prisma.order.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const counts = { pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 };
    let total = 0;
    for (const row of rows) {
      counts[row.status] = row._count._all;
      total += row._count._all;
    }
    return { counts, total };
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

  // POST /api/v1/admin/orders/:id/mark-paid
  //
  // Recording a payment that did not arrive through the webhook. Changing the
  // status alone never set `paidAt`, so an order moved to "processing" by hand
  // still read as unpaid everywhere it mattered: the payment page span forever,
  // and the post-purchase redeem codes — which are generated from a paid order
  // — were never issued.
  //
  // This is not an edge case. A customer who mistypes the transfer reference,
  // pays in cash, or transfers from an account SePay does not watch, all end up
  // here, and until now there was no way to record any of them.
  fastify.post('/orders/:id/mark-paid', { preHandler: [requireEmployee, requireCsrf] }, async (req, reply) => {
    const order = await fastify.prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return reply.code(404).send({ message: 'Không tìm thấy đơn hàng.' });
    if (order.paidAt) {
      return reply.code(409).send({ message: 'Đơn này đã được ghi nhận thanh toán rồi.' });
    }
    if (order.status === 'cancelled') {
      return reply.code(409).send({ message: 'Không thể ghi nhận thanh toán cho đơn đã huỷ.' });
    }

    const updated = await fastify.prisma.order.update({
      where: { id: order.id },
      data: {
        paidAt: new Date(),
        // Only nudge a pending order forward; an order already further along
        // keeps whatever stage it had reached.
        ...(order.status === 'pending' ? { status: 'processing' } : {}),
      },
    });

    // sepayTransactionId stays null on purpose — no bank transaction backs this,
    // and the audit row records who vouched for it instead.
    await auditLog(fastify.prisma, req.user.id, 'order.marked_paid', 'Order', order.id, {
      total: order.total,
      previousStatus: order.status,
    });

    return { order: updated, message: 'Đã ghi nhận thanh toán.' };
  });
}
