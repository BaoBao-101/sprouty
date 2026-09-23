import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { requireLogin } from './LoginModal';
import { useEffect } from 'react';

/**
 * Gates a branch of the route tree. Note this is a convenience for the user,
 * not a security boundary — every protected endpoint is also checked on the
 * server. Anyone can read the bundle and render these components.
 */
export function ProtectedRoute({ role }: { role?: 'employee' | 'admin' }) {
  const { ready, isLoggedIn, isEmployee, isAdmin } = useAuth();

  const allowed = role === 'admin' ? isAdmin : role === 'employee' ? isEmployee : isLoggedIn;

  useEffect(() => {
    if (ready && !isLoggedIn) requireLogin();
  }, [ready, isLoggedIn]);

  if (!ready) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <div style={{ fontSize: '2rem', marginBottom: 12 }}>⏳</div>
        <p>Đang kiểm tra quyền truy cập...</p>
      </div>
    );
  }

  if (!isLoggedIn) return <Navigate to="/" replace />;

  if (!allowed) {
    return (
      <div style={{ padding: '80px 0', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>🔒</div>
        <h2>Truy cập bị từ chối</h2>
        <p>Bạn không có quyền xem trang này.</p>
        <a href="/" className="btn btn-primary" style={{ marginTop: 16, display: 'inline-block' }}>
          Về trang chủ
        </a>
      </div>
    );
  }

  return <Outlet />;
}
