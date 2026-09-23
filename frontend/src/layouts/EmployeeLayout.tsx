import { Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { StaffSidebar, type SidebarGroup } from './StaffSidebar';

export function EmployeeLayout() {
  const { isAdmin } = useAuth();

  const groups: SidebarGroup[] = [
    {
      title: 'Công việc',
      items: [
        { to: '/employee/orders', label: 'Đơn hàng', icon: '📦' },
        { to: '/employee/products', label: 'Sản phẩm', icon: '🎨' },
      ],
    },
    ...(isAdmin
      ? [{ title: 'Khác', items: [{ to: '/admin', label: 'Trang quản trị', icon: '🛠' }] }]
      : []),
  ];

  return (
    <>
      <StaffSidebar subtitle="Sprouty Staff" groups={groups} />
      <main className="staff-main">
        <Outlet />
      </main>
    </>
  );
}
