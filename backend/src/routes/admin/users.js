import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { AppError } from '../../utils/errors.js';
import { requireAdmin, requireCsrf } from '../../middleware/rbac.js';
import { isVipUser } from '../../services/access.js';

const createUserSchema = z.object({
  name: z.string().min(2, 'Tên phải có ít nhất 2 ký tự.').max(100)
    .refine(s => !/[<>]/.test(s), { message: 'Tên không được chứa ký tự < hoặc >.' }),
  email: z.string().email('Email không hợp lệ.'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự.').max(200),
  role: z.enum(['customer', 'employee', 'admin']),
  status: z.enum(['active', 'disabled']).optional().default('active'),
});

const updateUserSchema = z.object({
  role: z.enum(['customer', 'employee', 'admin']).optional(),
  status: z.enum(['active', 'disabled']).optional(),
  name: z.string().min(2).max(100).optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'Không có thay đổi nào.' });

async function logAudit(prisma, actorId, action, targetType, targetId, metadata) {
  await prisma.auditLog.create({
    data: { actorUserId: actorId, action, targetType, targetId, metadata },
  }).catch(() => {});
}

export default async function adminUserRoutes(fastify) {
  const auth = [requireAdmin, requireCsrf];

  // GET /api/v1/admin/users
  fastify.get('/users', { preHandler: [requireAdmin] }, async (req) => {
    const users = await fastify.prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    // One query for all VIP userIds instead of N+1 isVipUser() calls.
    const vipRows = await fastify.prisma.orderItem.findMany({
      where: {
        product: { category: 'membership' },
        order: { paidAt: { not: null }, status: { not: 'cancelled' } },
      },
      select: { order: { select: { userId: true } } },
    });
    const vipUserIds = new Set(vipRows.map(r => r.order.userId));
    return { users: users.map(u => ({ ...u, isVip: vipUserIds.has(u.id) })) };
  });

  // POST /api/v1/admin/users/:id/grant-vip — manual-test helper: books a paid
  // order for a membership product on the user's behalf, since VIP status is
  // derived purely from "has a paid membership order" (see isVipUser in
  // services/access.js) rather than a separate flag on User.
  fastify.post('/users/:id/grant-vip', { preHandler: auth }, async (req, reply) => {
    const target = await fastify.prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return reply.code(404).send({ message: 'Không tìm thấy người dùng.' });

    if (await isVipUser(fastify.prisma, target.id)) {
      return { message: `${target.name} đã là VIP rồi.`, alreadyVip: true };
    }

    const membership = await fastify.prisma.product.findFirst({
      where: { category: 'membership', status: 'published' },
      orderBy: { price: 'asc' },
    });
    if (!membership) throw new AppError('Không có sản phẩm membership nào trong catalog.', 400);

    const order = await fastify.prisma.order.create({
      data: {
        userId: target.id,
        total: membership.price,
        status: 'processing',
        paidAt: new Date(),
        shippingName: target.name,
        shippingPhone: '0000000000',
        shippingAddress: 'Cấp bởi admin để test — không giao hàng thật.',
        note: 'admin.grant_vip',
        items: { create: [{ productId: membership.id, qty: 1, unitPrice: membership.price }] },
      },
    });

    await logAudit(fastify.prisma, req.user.id, 'user.grant_vip', 'User', target.id, {
      orderId: order.id,
      productId: membership.id,
      productName: membership.name,
    });

    return { message: `Đã cấp VIP cho ${target.name} (${membership.name}).`, orderId: order.id };
  });

  // DELETE /api/v1/admin/users/:id/grant-vip — revoke: cancel every paid
  // membership order for this user so isVipUser() goes back to false.
  fastify.delete('/users/:id/grant-vip', { preHandler: auth }, async (req, reply) => {
    const target = await fastify.prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return reply.code(404).send({ message: 'Không tìm thấy người dùng.' });

    const { count } = await fastify.prisma.order.updateMany({
      where: {
        userId: target.id,
        status: { not: 'cancelled' },
        paidAt: { not: null },
        items: { some: { product: { category: 'membership' } } },
      },
      data: { status: 'cancelled' },
    });

    await logAudit(fastify.prisma, req.user.id, 'user.revoke_vip', 'User', target.id, { ordersCancelled: count });

    return { message: count > 0 ? `Đã thu hồi VIP của ${target.name}.` : `${target.name} không có VIP để thu hồi.`, ordersCancelled: count };
  });

  // POST /api/v1/admin/users — create a user with any role and an initial password.
  fastify.post('/users', { preHandler: auth }, async (req, reply) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0]?.message || 'Dữ liệu không hợp lệ.', 400);
    }

    const { name, email, password, role, status } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await fastify.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) throw new AppError('Email đã được sử dụng.', 409);

    const passwordHash = await bcrypt.hash(password, 12);
    const created = await fastify.prisma.user.create({
      data: { name: name.trim(), email: normalizedEmail, passwordHash, role, status },
      select: { id: true, email: true, name: true, role: true, status: true, createdAt: true },
    });

    await logAudit(fastify.prisma, req.user.id, 'user.create', 'User', created.id, {
      role: created.role,
      status: created.status,
    });

    reply.code(201);
    return { user: created };
  });

  // PATCH /api/v1/admin/users/:id
  fastify.patch('/users/:id', { preHandler: auth }, async (req, reply) => {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0]?.message || 'Dữ liệu không hợp lệ.', 400);
    }

    const { id } = req.params;
    if (id === req.user.id && parsed.data.role && parsed.data.role !== 'admin') {
      throw new AppError('Không thể tự hạ quyền của mình.', 400);
    }
    if (id === req.user.id && parsed.data.status === 'disabled') {
      throw new AppError('Không thể tự vô hiệu hóa tài khoản của mình.', 400);
    }

    const target = await fastify.prisma.user.findUnique({ where: { id } });
    if (!target) return reply.code(404).send({ message: 'Không tìm thấy người dùng.' });

    // Last-admin guard: refuse changes that would remove the only active admin.
    // Only fires when the target is currently an active admin AND the patch
    // either demotes them or disables them.
    const targetIsActiveAdmin = target.role === 'admin' && target.status === 'active';
    const removesAdminStatus =
      (parsed.data.role && parsed.data.role !== 'admin') ||
      parsed.data.status === 'disabled';
    if (targetIsActiveAdmin && removesAdminStatus) {
      const activeAdmins = await fastify.prisma.user.count({
        where: { role: 'admin', status: 'active' },
      });
      if (activeAdmins <= 1) {
        throw new AppError('Không thể thực hiện: hệ thống cần ít nhất một quản trị viên đang hoạt động.', 400);
      }
    }

    const updated = await fastify.prisma.user.update({
      where: { id },
      data: parsed.data,
      select: { id: true, email: true, name: true, role: true, status: true },
    });

    await logAudit(fastify.prisma, req.user.id, 'user.update', 'User', id, {
      changes: parsed.data,
      before: { role: target.role, status: target.status },
    });

    // Invalidate sessions if disabled
    if (parsed.data.status === 'disabled') {
      await fastify.prisma.session.deleteMany({ where: { userId: id } });
    }

    return { user: updated };
  });
}
