import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export interface SidebarItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}

export interface SidebarGroup {
  title: string;
  items: SidebarItem[];
}

/**
 * Shared chrome for the admin and employee areas: brand pinned on top, the nav
 * scrolls, logout pinned at the bottom. Below 900px it becomes a drawer — the
 * old pages simply hid the sidebar, leaving staff with no navigation at all on
 * a phone.
 */
export function StaffSidebar({ subtitle, groups }: { subtitle: string; groups: SidebarGroup[] }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  return (
    <>
      <button className="sb-toggle" onClick={() => setOpen((v) => !v)} aria-label="Mở menu">
        ☰
      </button>
      <div className={`sb-backdrop${open ? ' open' : ''}`} onClick={close} />

      <aside className={`staff-sidebar${open ? ' open' : ''}`}>
        <div className="sb-brand">
          <img src="/assets/images/logo-footer.png" alt="Sprouty" className="sb-logo" />
          <span className="brand-sub">{subtitle}</span>
        </div>

        <nav className="sb-nav">
          {groups.map((group) => (
            <div key={group.title}>
              <span className="sb-group">{group.title}</span>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => (isActive ? 'active' : '')}
                  onClick={close}
                >
                  <span className="sb-ico">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}

          <span className="sb-group">Hệ thống</span>
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              close();
              navigate('/');
            }}
          >
            <span className="sb-ico">🏠</span>Trang chủ
          </a>
        </nav>

        <div className="sb-foot">
          <a
            href="#"
            className="sb-logout"
            onClick={(e) => {
              e.preventDefault();
              close();
              void logout();
            }}
          >
            <span className="sb-ico">🚪</span>Đăng xuất
          </a>
        </div>
      </aside>
    </>
  );
}
