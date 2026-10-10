import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ProfilePanel } from '@/components/account/ProfilePanel';
import './Profile.css';

/**
 * "Thông tin tài khoản" — its own page, reached from the account menu.
 *
 * It used to be the second tab of "Đơn hàng của tôi", which is the last place
 * anyone looks for their name or password: the orders page answers "what did
 * I buy", this one answers "who am I here and what can I change".
 */
export default function Profile() {
  const { refreshUser } = useAuth();

  // The tier may have changed since the session was read — a VIP payment in
  // another tab, or a plan that ran out overnight.
  useEffect(() => {
    void refreshUser();
    document.title = 'Thông tin tài khoản — Sprouty';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="prof-hero">
        <div className="container">
          <div className="breadcrumb prof-hero-crumb">
            <Link to="/">Trang chủ</Link> › Thông tin tài khoản
          </div>
          <h1>Thông tin tài khoản</h1>
          <p>Hồ sơ, gói thành viên và bảo mật của bạn.</p>
        </div>
      </div>
      <div className="container prof-body">
        <ProfilePanel />
      </div>
    </>
  );
}
