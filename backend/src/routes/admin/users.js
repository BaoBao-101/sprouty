import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { AppError } from '../../utils/errors.js';
import { requireAdmin, requireCsrf } from '../../middleware/rbac.js';
import { isVipUser } from '../../services/access.js';
import { recomputeVipUntil, syncMembership, tierOf } from '../../services/membership.js';
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

    // VIP is the account's vipUntil (services/membership.js), so it filters
    // like any other column and an expired plan drops out on its own.
    const now = new Date();
    const where = {};
    if (role) where.role = String(role);
    if (status) where.status = String(status);
    if (vip === '1' || vip === 'true') { where.role = 'customer'; where.vipUntil = { gt: now }; }
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { email: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const [users, total, roleCounts] = await Promise.all([
      fastify.prisma.user.findMany({
        where,
        select: { id: true, email: true, name: true, role: true, status: true, createdAt: true, vipUntil: true },
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
    const [disabledCount, vipCount] = await Promise.all([
      fastify.prisma.user.count({ where: { status: 'disabled' } }),
      fastify.prisma.user.count({ where: { role: 'customer', vipUntil: { gt: now } } }),
    ]);

    return {
      users: users.map(({ vipUntil, ...u }) => ({ ...u, ...tierOf({ vipUntil: u.role === 'customer' ? vipUntil : null }, now) })),
      total,
      page: pageNum,
      limit: pageSize,
      pages: Math.ceil(total / pageSize),
      counts: {
        ...counts,
        vip: vipCount,
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

    if (target.id === req.user.id) throw new AppError('Hãy sử dụng chức năng đổi mật khẩu cá nhân.', 400);
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

  // A complimentary membership uses a zero-value order for the same entitlement replay.
  fastify.post('/users/:id/grant-vip', { preHandler: auth }, async (req, reply) => {
    try {
      return await fastify.prisma.$transaction(async (tx) => {
        const target = await tx.user.findUnique({ where: { id: req.params.id } });
        if (!target) throw new AppError('Không tìm thấy người dùng.', 404);

        if (target.role !== 'customer' || target.status !== 'active') throw new AppError('Chỉ cấp VIP cho khách hàng đang hoạt động.', 400);

        if (await isVipUser(tx, target.id)) {
          return { message: `${target.name} đã là VIP rồi.`, alreadyVip: true };
        }

        const membership = await tx.product.findFirst({
          where: { category: 'membership', status: 'published' },
          orderBy: { price: 'asc' },
        });
        if (!membership) throw new AppError('Không có sản phẩm membership nào trong catalog.', 400);

        const order = await tx.order.create({
          data: {
            userId: target.id,
            total: 0,
            status: 'delivered',
            paidAt: new Date(),
            shippingName: target.name,
            shippingPhone: '',
            shippingAddress: 'Cấp bởi admin — gói thành viên, không giao hàng.',
            note: 'admin.grant_vip',
            items: { create: [{ productId: membership.id, qty: 1, unitPrice: 0 }] },
          },
        });
        const vipUntil = await syncMembership(tx, order.id);

        await logAudit(tx, req.user.id, 'user.grant_vip', 'User', target.id, {
          orderId: order.id,
          productId: membership.id,
          productName: membership.name,
        });

        const until = vipUntil ? ` — đến ${vipUntil.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}` : '';
        return { message: `Đã cấp VIP cho ${target.name} (${membership.name})${until}.`, orderId: order.id, vipUntil };
      }, { isolationLevel: 'Serializable' });
    } catch (err) {
      if (err.code === 'P2034') throw new AppError('Quyền VIP vừa thay đổi. Vui lòng tải lại và thử lại.', 409);
      throw err;
    }
  });

  // Revoke complimentary grants only; purchased membership orders remain intact.
  fastify.delete('/users/:id/grant-vip', { preHandler: auth }, async (req, reply) => {
    try {
      return await fastify.prisma.$transaction(async (tx) => {
        const target = await tx.user.findUnique({ where: { id: req.params.id } });
        if (!target) throw new AppError('Không tìm thấy người dùng.', 404);

        if (target.role !== 'customer') throw new AppError('VIP chỉ áp dụng cho khách hàng.', 400);
        const { count } = await tx.order.updateMany({
          where: {
            userId: target.id,
            note: 'admin.grant_vip',
            status: { not: 'cancelled' },
            paidAt: { not: null },
            items: { some: { product: { category: 'membership' } } },
          },
          data: { status: 'cancelled' },
        });

        // Recompute from remaining orders, including purchased memberships.
        await recomputeVipUntil(tx, target.id);

        await logAudit(tx, req.user.id, 'user.revoke_vip', 'User', target.id, { ordersCancelled: count });

        return { message: count > 0 ? `Đã thu hồi VIP được cấp tặng của ${target.name}.` : `${target.name} không có VIP được cấp tặng để thu hồi.`, ordersCancelled: count };
      }, { isolationLevel: 'Serializable' });
    } catch (err) {
      if (err.code === 'P2034') throw new AppError('Quyền VIP vừa thay đổi. Vui lòng tải lại và thử lại.', 409);
      throw err;
    }
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

    try {
      return await fastify.prisma.$transaction(async (tx) => {
        const target = await tx.user.findUnique({ where: { id } });
        if (!target) return reply.code(404).send({ message: 'Không tìm thấy người dùng.' });

        // Last-admin guard: refuse changes that would remove the only active admin.
        // Only fires when the target is currently an active admin AND the patch
        // either demotes them or disables them.
        const targetIsActiveAdmin = target.role === 'admin' && target.status === 'active';
        const removesAdminStatus =
          (parsed.data.role && parsed.data.role !== 'admin') ||
          parsed.data.status === 'disabled';
        if (targetIsActiveAdmin && removesAdminStatus) {
          const activeAdmins = await tx.user.count({
            where: { role: 'admin', status: 'active' },
          });
          if (activeAdmins <= 1) {
            throw new AppError('Không thể thực hiện: hệ thống cần ít nhất một quản trị viên đang hoạt động.', 400);
          }
        }

        if (parsed.data.role && parsed.data.role !== target.role && target.role === 'customer' && target.vipUntil > new Date()) {
          throw new AppError('Khách hàng còn VIP. Hãy dùng tài khoản nhân sự riêng để giữ quyền lợi đã mua.', 409);
        }

        const updated = await tx.user.update({
          where: { id },
          data: parsed.data,
          select: { id: true, email: true, name: true, role: true, status: true },
        });

        await logAudit(tx, req.user.id, 'user.update', 'User', id, {
          changes: parsed.data,
          before: { role: target.role, status: target.status },
        });

        // Invalidate sessions when disabled or moved to another workspace.
        if (parsed.data.status === 'disabled' || (parsed.data.role && parsed.data.role !== target.role)) {
          await tx.session.deleteMany({ where: { userId: id } });
        }

        return { user: updated };
      }, { isolationLevel: 'Serializable' });
    } catch (err) {
      if (err.code === 'P2034') throw new AppError('Tài khoản vừa được cập nhật. Vui lòng tải lại và thử lại.', 409);
      throw err;
    }
  });
}
