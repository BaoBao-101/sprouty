import { timingSafeEqual } from 'crypto';
import { AppError } from '../utils/errors.js';

export function requireAuth(req, reply, done) {
  if (!req.user) return done(new AppError('Bạn cần đăng nhập để thực hiện thao tác này.', 401));
  done();
}

/**
 * `===` on secrets returns as soon as two bytes differ, so how long the compare
 * takes leaks how much of the prefix was right (finding F-08). timingSafeEqual
 * is constant time, but throws unless both buffers are the same length — so
 * compare the lengths first, which is not secret.
 */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function requireCsrf(req, reply, done) {
  const token = req.headers['x-csrf-token'];
  const expected = req.session?.data?.csrfToken;
  if (!expected || !safeEqual(token, expected)) {
    return done(new AppError('CSRF token không hợp lệ.', 403));
  }
  done();
}

export function requireRole(...roles) {
  return (req, reply, done) => {
    if (!req.user) return done(new AppError('Bạn cần đăng nhập.', 401));
    if (!roles.includes(req.user.role)) {
      return done(new AppError('Bạn không có quyền thực hiện thao tác này.', 403));
    }
    done();
  };
}

// employee or admin
export function requireStaff(req, reply, done) {
  if (!req.user) return done(new AppError('Bạn cần đăng nhập.', 401));
  if (!['employee', 'admin'].includes(req.user.role)) {
    return done(new AppError('Chỉ nhân viên hoặc quản trị viên mới có thể truy cập.', 403));
  }
  done();
}

export function requireAdmin(req, reply, done) {
  if (!req.user) return done(new AppError('Bạn cần đăng nhập.', 401));
  if (req.user.role !== 'admin') {
    return done(new AppError('Chỉ quản trị viên mới có thể truy cập.', 403));
  }
  done();
}

export const requireCustomer = requireRole('customer');
export const requireEmployee = requireRole('employee');
