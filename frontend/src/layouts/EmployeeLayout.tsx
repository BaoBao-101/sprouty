import { useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { useStackedTables } from '@/services/stacked-tables';
import { StaffSidebar, type SidebarGroup } from './StaffSidebar';
import { AdminIcon } from '@/components/icons/AdminIcon';

export function EmployeeLayout() {
  const main = useRef<HTMLElement>(null);
  useStackedTables(main);

  const groups: SidebarGroup[] = [
    {
      title: 'Công việc',
      items: [
        { to: '/employee/orders', label: 'Đơn hàng', icon: <AdminIcon name="orders" size={19} /> },
        { to: '/employee/products', label: 'Sản phẩm', icon: <AdminIcon name="products" size={19} /> },
        {
          to: '/employee/workshops',
          // More than the door now: the duty rota, tickets, cash at the desk.
          label: 'Workshop',
          icon: <AdminIcon name="workshop" size={19} />,
        },
      ],
    },
  ];

  return (
    <div className="staff-root">
      <StaffSidebar subtitle="Nhân viên" groups={groups} />
      <main className="staff-main" ref={main}>
        <Outlet />
      </main>
    </div>
  );
}
