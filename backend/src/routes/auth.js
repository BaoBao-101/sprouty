import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { AppError } from '../utils/errors.js';
import { requireAuth, requireCsrf } from '../middleware/rbac.js';

const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ.'),
  password: z.string().min(1, 'Mật khẩu không được để trống.'),
});

const registerSchema = z.object({
  name: z.string().min(2, 'Tên phải có ít nhất 2 ký tự.').max(100)
    .refine(s => !/[<>]/.test(s), { message: 'Tên không được chứa ký tự < hoặc >.' }),
  email: z.string().email('Email không hợp lệ.'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự.').max(200),
});

export default async function authRoutes(fastify) {
  // GET /api/v1/auth/me
  fastify.get('/me', async (req) => {
    if (!req.user) return { user: null };
    return { user: req.user };
  });

  // GET /api/v1/auth/csrf — return CSRF token for current session
  fastify.get('/csrf', { preHandler: [requireAuth] }, async (req) => {
    return { csrfToken: req.session?.data?.csrfToken || null };
  });

  // POST /api/v1/auth/login
  fastify.post('/login', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message || 'Dữ liệu không hợp lệ.';
      throw new AppError(msg, 400);
    }

    const { email, password } = parsed.data;
    const user = await fastify.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AppError('Email hoặc mật khẩu không đúng.', 401);
    }
    if (user.status === 'disabled') {
      throw new AppError('Tài khoản đã bị vô hiệu hóa. Liên hệ quản trị viên.', 403);
    }

    const { csrfToken } = await fastify.setSession(reply, user.id);
    return {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      csrfToken,
    };
  });

  // POST /api/v1/auth/register
  fastify.post('/register', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message || 'Dữ liệu không hợp lệ.';
      throw new AppError(msg, 400);
    }

    const { name, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await fastify.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) throw new AppError('Email đã được sử dụng.', 409);

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await fastify.prisma.user.create({
      data: { name: name.trim(), email: normalizedEmail, passwordHash, role: 'customer' },
    });

    const { csrfToken } = await fastify.setSession(reply, user.id);
    reply.code(201);
    return {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      csrfToken,
    };
  });

  // POST /api/v1/auth/logout
  fastify.post('/logout', { preHandler: [requireAuth, requireCsrf] }, async (req, reply) => {
    await fastify.clearSession(req, reply);
    return { message: 'Đã đăng xuất.' };
  });
}
