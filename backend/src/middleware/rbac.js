import { AppError } from '../utils/errors.js';

export function requireAuth(req, reply, done) {
  if (!req.user) return done(new AppError('Bạn cần đăng nhập để thực hiện thao tác này.', 401));
  done();
}

export function requireCsrf(req, reply, done) {
  const token = req.headers['x-csrf-token'];
  const expected = req.session?.data?.csrfToken;
  if (!token || token !== expected) {
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
export function requireEmployee(req, reply, done) {
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
