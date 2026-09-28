import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { AppError } from '../../utils/errors.js';
import { requireAdmin, requireCsrf } from '../../middleware/rbac.js';
import { isVipUser } from '../../services/access.js';
import { passwordSchema } from '../../utils/password.js';

const createUserSchema = z.object({
  name: z.string().min(2, 'Tên phải có ít nhất 2 ký tự.').max(100)
    .refine(s => !/[<>]/.test(s), { message: 'Tên không được chứa ký tự < hoặc >.' }),
  email: z.string().email('Email không hợp lệ.'),
  password: passwordSchema,
  role: z.enum(['customer', 'employee', 'admin']),
  status: z.enum(['active', 'disabled']).optional().default('active'),
});

const resetPasswordSchema = z.object({
  password: passwordSchema,
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
    // Paged: this used to return every row, so the response grew without bound
    // and the admin table had no way to reach an older account.
    const { search, role, status, vip, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    // VIP is derived from a paid membership order, not a column, so the ids have
    // to be resolved before the page query — filtering after it would only
    // filter the 20 rows in hand.
    const vipRows = await fastify.prisma.orderItem.findMany({
      where: {
        product: { category: 'membership' },
        order: { paidAt: { not: null }, status: { not: 'cancelled' } },
      },
      select: { order: { select: { userId: true } } },
    });
    const vipUserIds = new Set(vipRows.map(r => r.order.userId).filter(Boolean));

    const where = {};
    if (role) where.role = String(role);
    if (status) where.status = String(status);
    if (vip === '1' || vip === 'true') where.id = { in: [...vipUserIds] };
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { email: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const [users, total, roleCounts] = await Promise.all([
      fastify.prisma.user.findMany({
        where,
        select: { id: true, email: true, name: true, role: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
      }),
      fastify.prisma.user.count({ where }),
      // Counts span the whole table, not the current filter — they label the
      // filter buttons, so they must not change as you click between them.
      fastify.prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    ]);

    const counts = { customer: 0, employee: 0, admin: 0 };
    for (const row of roleCounts) counts[row.role] = row._count._all;
    const disabledCount = await fastify.prisma.user.count({ where: { status: 'disabled' } });

    return {
      users: users.map(u => ({ ...u, isVip: vipUserIds.has(u.id) })),
      total,
      page: pageNum,
      limit: pageSize,
      pages: Math.ceil(total / pageSize),
      counts: {
        ...counts,
        vip: vipUserIds.size,
        disabled: disabledCount,
        all: counts.customer + counts.employee + counts.admin,
      },
    };
  });

  // POST /api/v1/admin/users/:id/reset-password
  //
  // Its own route rather than a field on PATCH /users/:id, because that handler
  // writes `changes: parsed.data` into the audit log — a password passed through
  // it would be stored in plaintext in AuditLog forever.
  //
  // Until this existed the FAQ's promise that support can reset a forgotten
  // password (data/faq.ts) could not actually be kept by anyone.
  fastify.post('/users/:id/reset-password', { preHandler: auth }, async (req, reply) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0]?.message || 'Dữ liệu không hợp lệ.', 400);
    }

    const target = await fastify.prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return reply.code(404).send({ message: 'Không tìm thấy người dùng.' });

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    await fastify.prisma.user.update({
      where: { id: target.id },
      // Clear the lockout too: an admin resetting a password is exactly how a
      // user locked out by failed attempts gets back in.
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    });

    // Every existing session for that account dies — if the reset is because
    // the account was compromised, leaving them alive defeats the point.
    await fastify.prisma.session.deleteMany({ where: { userId: target.id } });

    // Metadata deliberately records only *that* it happened, never the password.
    await logAudit(fastify.prisma, req.user.id, 'user.password.reset', 'User', target.id, {
      targetEmail: target.email,
    });

    return { message: `Đã đặt lại mật khẩu cho ${target.name}. Mọi phiên đăng nhập của họ đã bị đăng xuất.` };
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
