import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
// Both staff areas render this shell, so it is where their stylesheets belong.
// They used to be imported by AdminLayout alone, even though the employee pages
// reuse the same tables, panels and modals.
import { AdminIcon } from '@/components/icons/AdminIcon';
import './admin.css';
import './admin-ui.css';
// Redefines the tokens the two above use, so the staff area reads as a tool
// rather than as the storybook site whose stylesheet it shares.
import './admin-theme.css';

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
        <AdminIcon name="menu" size={20} />
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
            <span className="sb-ico">
              <AdminIcon name="home" size={19} />
            </span>
            Trang chủ
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
            <span className="sb-ico">
              <AdminIcon name="logout" size={19} />
            </span>
            Đăng xuất
          </a>
        </div>
      </aside>
    </>
  );
}
