import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { AppError } from '../utils/errors.js';
import { requireAuth, requireCsrf } from '../middleware/rbac.js';
import { passwordSchema } from '../utils/password.js';
import { auditLog } from '../services/audit.js';
import { tierOf } from '../services/membership.js';

/**
 * The signed-in user as the client sees it. The tier rides along so the
 * header and account page can show "Thường" or "VIP" without a second call.
 * vipUntil itself is replaced by tierOf's ISO string and flags.
 */
function publicUser(user) {
  const { vipUntil, ...rest } = user;
  return { ...rest, ...tierOf({ vipUntil }) };
}

// Per-account brute-force lockout, independent of the per-IP rate limit — this
// is what blunts a distributed (many-IP) guessing attack against one account.
const LOGIN_MAX_FAILED_ATTEMPTS = Number(process.env.LOGIN_MAX_FAILED_ATTEMPTS || 10);
const LOGIN_LOCKOUT_MINUTES = Number(process.env.LOGIN_LOCKOUT_MINUTES || 15);

// Record a failed attempt; lock the account once the threshold is reached.
async function registerFailedLogin(prisma, user) {
  const attempts = user.failedLoginAttempts + 1;
  const data = { failedLoginAttempts: attempts };
  if (attempts >= LOGIN_MAX_FAILED_ATTEMPTS) {
    data.lockedUntil = new Date(Date.now() + LOGIN_LOCKOUT_MINUTES * 60_000);
    data.failedLoginAttempts = 0; // reset the counter now that the lock is armed
  }
  await prisma.user.update({ where: { id: user.id }, data });
}

const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ.'),
  password: z.string().min(1, 'Mật khẩu không được để trống.'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Nhập mật khẩu hiện tại.'),
  newPassword: passwordSchema,
});

/** Your own display name. The e-mail is the login and stays as it is. */
const profileSchema = z.object({
  name: z.string()
    .trim()
    .min(2, 'Họ tên phải có ít nhất 2 ký tự.')
    .max(100, 'Họ tên tối đa 100 ký tự.')
    .refine((v) => !/[<>]/.test(v), { message: 'Họ tên không được chứa ký tự < hoặc >.' }),
});

const registerSchema = z.object({
  name: z.string().min(2, 'Tên phải có ít nhất 2 ký tự.').max(100)
    .refine(s => !/[<>]/.test(s), { message: 'Tên không được chứa ký tự < hoặc >.' }),
  email: z.string().email('Email không hợp lệ.'),
  password: passwordSchema,
});

export default async function authRoutes(fastify) {
  // GET /api/v1/auth/me
  fastify.get('/me', async (req) => {
    if (!req.user) return { user: null };
    return { user: publicUser(req.user) };
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

    // Reject locked accounts before doing any password work.
    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new AppError(`Tài khoản tạm thời bị khóa do đăng nhập sai quá nhiều. Thử lại sau ${mins} phút.`, 429);
    }

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      if (user) await registerFailedLogin(fastify.prisma, user);
      throw new AppError('Email hoặc mật khẩu không đúng.', 401);
    }
    if (user.status === 'disabled') {
      throw new AppError('Tài khoản đã bị vô hiệu hóa. Liên hệ quản trị viên.', 403);
    }

    // Successful login — clear any accumulated failed attempts / lock.
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await fastify.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    const { csrfToken } = await fastify.setSession(req, reply, user.id);
    return {
      user: publicUser({ id: user.id, email: user.email, name: user.name, role: user.role, vipUntil: user.vipUntil, createdAt: user.createdAt }),
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

    const { csrfToken } = await fastify.setSession(req, reply, user.id);
    reply.code(201);
    return {
      user: publicUser({ id: user.id, email: user.email, name: user.name, role: user.role, vipUntil: user.vipUntil, createdAt: user.createdAt }),
      csrfToken,
    };
  });

  // POST /api/v1/auth/logout
  fastify.post('/logout', { preHandler: [requireAuth, requireCsrf] }, async (req, reply) => {
    await fastify.clearSession(req, reply);
    return { message: 'Đã đăng xuất.' };
  });

  // PATCH /api/v1/auth/profile — change your own name.
  //
  // The account page showed the name with no way to fix it; a typo made at
  // sign-up was on every order and every greeting for good.
  fastify.patch('/profile', { preHandler: [requireAuth, requireCsrf] }, async (req) => {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0]?.message || 'Dữ liệu không hợp lệ.', 400);
    }
    const updated = await fastify.prisma.user.update({
      where: { id: req.user.id },
      data: { name: parsed.data.name },
      select: { id: true, email: true, name: true, role: true, status: true, vipUntil: true, createdAt: true },
    });
    await auditLog(fastify.prisma, req.user.id, 'user.profile.update', 'User', req.user.id, {
      from: req.user.name,
      to: updated.name,
    });
    return { user: publicUser(updated), message: 'Đã cập nhật họ tên.' };
  });

  // POST /api/v1/auth/change-password — rotate your own password.
  //
  // There was no way to change a password anywhere in the product: customers
  // were stuck with whatever they first chose, and staff accounts created by an
  // admin were stuck on the temporary password they were handed.
  fastify.post('/change-password', {
    preHandler: [requireAuth, requireCsrf],
    // Verifying the current password is a guessing oracle, so rate-limit it the
    // way login is rather than leaving it on the global default.
    config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
  }, async (req) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0]?.message || 'Dữ liệu không hợp lệ.', 400);
    }

    const { currentPassword, newPassword } = parsed.data;
    if (currentPassword === newPassword) {
      throw new AppError('Mật khẩu mới phải khác mật khẩu hiện tại.', 400);
    }

    const user = await fastify.prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) throw new AppError('Không tìm thấy tài khoản.', 404);

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new AppError('Mật khẩu hiện tại không đúng.', 400);

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await fastify.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    });

    // Anyone else holding a session for this account — the reason people change
    // a password in the first place — is signed out. The caller keeps theirs.
    await fastify.prisma.session.deleteMany({
      where: { userId: user.id, id: { not: req.session?.id } },
    });

    await auditLog(fastify.prisma, user.id, 'user.password.change', 'User', user.id, {});
    return { message: 'Đã đổi mật khẩu. Các phiên đăng nhập khác đã bị đăng xuất.' };
  });
}
