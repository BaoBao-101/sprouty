import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { SproutyIcon } from '@/components/icons/SproutyIcon';

/**
 * Gates a branch of the route tree. Note this is a convenience for the user,
 * not a security boundary — every protected endpoint is also checked on the
 * server. Anyone can read the bundle and render these components.
 *
 * A signed-out visitor is sent to /login with the page they wanted in `next`,
 * so signing in returns them to it. This used to pop a modal and then redirect
 * to the home page, which quietly threw away where they were trying to go.
 */
export function ProtectedRoute({ role }: { role?: 'employee' | 'admin' }) {
  const { ready, isLoggedIn, isEmployee, isAdmin } = useAuth();
  const location = useLocation();

  const allowed = role === 'admin' ? isAdmin : role === 'employee' ? isEmployee : isLoggedIn;

  if (!ready) {
    return (
      <div className="route-gate">
        <span className="route-gate-icon">
          <SproutyIcon name="clock" size={30} />
        </span>
        <p>Đang kiểm tra quyền truy cập…</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  // Signed in, but not as the right kind of account. This is a different
  // problem from being signed out, and sending them to the login form would
  // only invite them to try the same account again.
  if (!allowed) {
    return (
      <div className="route-gate">
        <span className="route-gate-icon denied">
          <SproutyIcon name="lock" size={30} />
        </span>
        <h2>Trang này không dành cho tài khoản của bạn</h2>
        <p>
          Bạn cần tài khoản {role === 'admin' ? 'quản trị viên' : 'nhân viên'} để xem trang này.
        </p>
        <Link to="/" className="btn btn-primary">
          Về trang chủ
        </Link>
      </div>
    );
  }

  return <Outlet />;
}
