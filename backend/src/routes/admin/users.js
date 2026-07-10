import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { AppError } from '../../utils/errors.js';
import { requireAdmin, requireCsrf } from '../../middleware/rbac.js';

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
    return { users };
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
