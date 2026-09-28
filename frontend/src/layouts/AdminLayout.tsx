import { Outlet } from 'react-router-dom';
import { StaffSidebar, type SidebarGroup } from './StaffSidebar';

const icon = (file: string) => <img src={`/assets/images/sprouty-icons/${file}`} alt="" />;

const GROUPS: SidebarGroup[] = [
  {
    title: 'Tổng quan',
    items: [{ to: '/admin', label: 'Dashboard', icon: '📊', end: true }],
  },
  {
    title: 'Kinh doanh',
    items: [
      { to: '/admin/orders', label: 'Đơn hàng', icon: '📦' },
      { to: '/admin/sales', label: 'Báo cáo bán hàng', icon: '💰' },
      { to: '/admin/redeem', label: 'Mã kích hoạt', icon: icon('RedeemCode.png') },
    ],
  },
  {
    title: 'Nội dung',
    items: [
      { to: '/admin/workshops', label: 'Workshop', icon: icon('Workshop.png') },
      { to: '/admin/blog', label: 'Blog', icon: '📝' },
      { to: '/admin/user-images', label: 'Ảnh người dùng', icon: icon('AddPhoto.png') },
      { to: '/admin/products', label: 'Quản lý sản phẩm', icon: '🎨' },
    ],
  },
  {
    title: 'Người dùng',
    items: [{ to: '/admin/users', label: 'Người dùng', icon: '👥' }],
  },
  {
    // Not "Hệ thống": StaffSidebar already renders a group by that name for the
    // back-to-site link, and two identical headings read as a rendering bug.
    title: 'Giám sát',
    items: [{ to: '/admin/audit', label: 'Nhật ký hoạt động', icon: '🗒' }],
  },
];

export function AdminLayout() {
  return (
    <>
      <StaffSidebar subtitle="Admin Dashboard" groups={GROUPS} />
      <main className="staff-main">
        <Outlet />
      </main>
    </>
  );
}
