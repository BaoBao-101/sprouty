import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { loginHref } from '@/services/auth-nav';
import { tierLabel } from '@/services/membership';

const ROLE_VN = { customer: 'Khách hàng', employee: 'Nhân viên', admin: 'Quản trị viên' } as const;

// The assistant is no longer a place you go: it floats on every page as
// AiBubble, so a link up here would only send you away from whatever raised
// the question. /ai still exists, and the bubble links to it.
const LINKS = [
  { to: '/', label: 'Trang chủ', end: true },
  { to: '/shop', label: 'Sản phẩm' },
  { to: '/workshop', label: 'Workshop' },
  { to: '/blog', label: 'Blog' },
  { to: '/about', label: 'Giới thiệu' },
  { to: '/vip', label: 'VIP' },
];

function UserMenu({ onClose }: { onClose: () => void }) {
  const { user, isAdmin, isEmployee, logout } = useAuth();
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Defer so the click that opened the menu does not immediately close it.
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const id = setTimeout(() => document.addEventListener('click', handler), 10);
    return () => {
      clearTimeout(id);
      document.removeEventListener('click', handler);
    };
  }, [onClose]);

  if (!user) return null;

  const go = (to: string) => {
    navigate(to);
    onClose();
  };

  const items: Array<{ label: React.ReactNode; onClick: () => void }> = [
    {
      label: (
        <>
          <img src="/assets/images/sprouty-icons/MyTree.png" alt="Cây" className="menu-item-icon" /> Cây của tôi
        </>
      ),
      onClick: () => go('/my-plants'),
    },
    { label: '📦 Đơn hàng của tôi', onClick: () => go('/account') },
    { label: '🎪 Workshop của tôi', onClick: () => go('/my-workshops') },
    {
      label: (
        <>
          <img src="/assets/images/sprouty-icons/VIP.png" alt="" className="menu-item-icon" />
          {user.isVip ? 'Gói VIP của tôi' : 'Nâng cấp VIP'}
        </>
      ),
      onClick: () => go('/vip'),
    },
    ...(isEmployee ? [{ label: '👷 Cổng nhân viên', onClick: () => go('/employee/orders') }] : []),
    ...(isAdmin ? [{ label: '⚙️ Quản trị', onClick: () => go('/admin') }] : []),
    {
      label: '🚪 Đăng xuất',
      onClick: () => {
        onClose();
        void logout();
      },
    },
  ];

  return (
    <div className="user-menu-popup" ref={ref}>
      <div className="user-menu-head">
        <strong>{user.name}</strong>
        <div className="user-menu-email">{user.email}</div>
        {/* A customer's standing is their tier; staff have a role instead.
            This used to print the raw role key — "customer" — in English. */}
        {user.role === 'customer' ? (
          <div className={`user-menu-tier${user.isVip ? ' is-vip' : ''}`}>{tierLabel(user)}</div>
        ) : (
          <div className="user-menu-role">{ROLE_VN[user.role] ?? user.role}</div>
        )}
      </div>
      {items.map((item, i) => (
        <div key={i} className="user-menu-item" onClick={item.onClick}>
          {item.label}
        </div>
      ))}
    </div>
  );
}

export function Header() {
  const { user, isLoggedIn } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="site-header">
        <div className="container navbar">
          <Link className="brand" to="/">
            <img
              className="brand-logo"
              src="/assets/images/logo.png"
              alt="Sprouty"
              loading="eager"
              onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
            />
          </Link>

          <nav className="nav-links">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="nav-right">
            <button className="nav-cart-btn" onClick={() => navigate('/cart')} title="Giỏ hàng">
              <img src="/assets/images/sprouty-icons/Cart.png" alt="Giỏ hàng" className="nav-cart-icon" />
              <span className={`cart-count${count > 0 ? ' show' : ''}`}>{count}</span>
            </button>

            {isLoggedIn ? (
              <button
                className={`nav-user visible${user!.isVip ? ' is-vip' : ''}`}
                onClick={() => setMenuOpen((v) => !v)}
                title={user!.isVip ? 'Thành viên VIP Garden' : undefined}
              >
                <span className="nav-user-avatar">
                  {user!.name.charAt(0).toUpperCase()}
                  {user!.isVip && (
                    <img className="nav-user-vip" src="/assets/images/sprouty-icons/VIP.png" alt="VIP" />
                  )}
                </span>
                <span className="nav-user-name">{user!.name.split(' ').slice(-1)[0]}</span>
              </button>
            ) : (
              <button className="btn-login" onClick={() => navigate(loginHref())}>
                Đăng nhập
              </button>
            )}

            <button
              className={`nav-hamburger${drawerOpen ? ' open' : ''}`}
              onClick={() => setDrawerOpen((v) => !v)}
              aria-label="Mở menu"
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      {menuOpen && <UserMenu onClose={() => setMenuOpen(false)} />}

      <nav className={`nav-drawer${drawerOpen ? ' open' : ''}`}>
        {LINKS.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) => (isActive ? 'active' : '')}
            onClick={() => setDrawerOpen(false)}
          >
            {l.label}
          </NavLink>
        ))}
        <div className="nav-drawer-divider" />
        {!isLoggedIn && (
          <button
            className="btn-login"
            style={{ width: '100%', textAlign: 'center' }}
            onClick={() => {
              navigate(loginHref());
              setDrawerOpen(false);
            }}
          >
            Đăng nhập
          </button>
        )}
      </nav>
    </>
  );
}
