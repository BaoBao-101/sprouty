import { Outlet } from 'react-router-dom';
import { StaffSidebar, type SidebarGroup } from './StaffSidebar';
import './admin.css';

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
