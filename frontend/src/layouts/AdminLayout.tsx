import { Outlet } from 'react-router-dom';
import { StaffSidebar, type SidebarGroup } from './StaffSidebar';
import { AdminIcon, type AdminIconName } from '@/components/icons/AdminIcon';

/** One stroke weight across the nav; see components/icons/AdminIcon. */
const icon = (name: AdminIconName) => <AdminIcon name={name} size={19} />;

const GROUPS: SidebarGroup[] = [
  {
    title: 'Tổng quan',
    items: [{ to: '/admin', label: 'Tổng quan', icon: icon('dashboard'), end: true }],
  },
  {
    title: 'Kinh doanh',
    items: [
      { to: '/admin/orders', label: 'Đơn hàng', icon: icon('orders') },
      { to: '/admin/sales', label: 'Báo cáo bán hàng', icon: icon('sales') },
      { to: '/admin/redeem', label: 'Mã kích hoạt', icon: icon('redeem') },
    ],
  },
  {
    title: 'Nội dung',
    items: [
      { to: '/admin/workshops', label: 'Workshop', icon: icon('workshop') },
      { to: '/employee/attendance', label: 'Điểm danh', icon: icon('check') },
      { to: '/admin/blog', label: 'Blog', icon: icon('blog') },
      { to: '/admin/user-images', label: 'Ảnh người dùng', icon: icon('images') },
      { to: '/admin/products', label: 'Sản phẩm', icon: icon('products') },
    ],
  },
  {
    title: 'Người dùng',
    items: [{ to: '/admin/users', label: 'Người dùng', icon: icon('users') }],
  },
  {
    // Not "Hệ thống": StaffSidebar already renders a group by that name for the
    // back-to-site link, and two identical headings read as a rendering bug.
    title: 'Giám sát',
    items: [{ to: '/admin/audit', label: 'Nhật ký hoạt động', icon: icon('audit') }],
  },
];

export function AdminLayout() {
  return (
    <div className="staff-root">
      <StaffSidebar subtitle="Quản trị" groups={GROUPS} />
      <main className="staff-main">
        <Outlet />
      </main>
    </div>
  );
}
