import { Outlet } from 'react-router-dom';
import { StaffSidebar, type SidebarGroup } from './StaffSidebar';
import { AdminIcon } from '@/components/icons/AdminIcon';

export function EmployeeLayout() {

  const groups: SidebarGroup[] = [
    {
      title: 'Công việc',
      items: [
        { to: '/employee/orders', label: 'Đơn hàng', icon: <AdminIcon name="orders" size={19} /> },
        { to: '/employee/products', label: 'Sản phẩm', icon: <AdminIcon name="products" size={19} /> },
        {
          to: '/employee/attendance',
          label: 'Điểm danh',
          icon: <AdminIcon name="check" size={19} />,
        },
      ],
    },
  ];

  return (
    <div className="staff-root">
      <StaffSidebar subtitle="Nhân viên" groups={groups} />
      <main className="staff-main">
        <Outlet />
      </main>
    </div>
  );
}
