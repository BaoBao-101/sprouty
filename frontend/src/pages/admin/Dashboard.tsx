import { useEffect, useState } from 'react';
import { ProductIcon } from '@/components/ProductIcon';
import { API } from '@/services/api';
import { ORDER_STATUS_VN, ORDER_STATUSES, shortOrderId, type OrderStatus } from '@/types/order';
import { formatPrice } from '@/types/product';

interface Stats {
  totals: {
    users: number;
    newUsers7d: number;
    orders: number;
    products: number;
    revenue7d: number;
    revenue30d: number;
  };
  ordersByStatus?: Partial<Record<OrderStatus, number>>;
  topProducts?: Array<{ product?: { name?: string }; totalQty: number; totalRevenue?: number }>;
  recentOrders?: Array<{
    id: string;
    shippingName: string;
    total: number;
    createdAt: string;
    status: OrderStatus;
    user?: { email?: string };
  }>;
}

/** Compact money for the stat tiles: 1.2M / 340K / 900. */
function compactVnd(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toLocaleString('vi-VN');
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    API.admin
      .stats()
      .then((data: any) => !cancelled && setStats(data))
      .catch((err: any) => !cancelled && setError(err?.message || 'Không tải được số liệu.'));
    return () => {
      cancelled = true;
    };
  }, []);

  const totals = stats?.totals;
  const topProducts = (stats?.topProducts || []).slice(0, 5);
  const recentOrders = (stats?.recentOrders || []).slice(0, 8);

  return (
    <>
      <div className="page-head" style={{ marginBottom: 22 }}>
        <h1>Dashboard</h1>
        <p>Tổng quan hoạt động của Sprouty</p>
      </div>

      <div className="stat-grid">
        <div className="stat-card" style={{ '--accent': 'var(--orange)' } as React.CSSProperties}>
          <div className="stat-num">{totals?.users ?? '—'}</div>
          <div className="stat-label">Người dùng</div>
          <div className="stat-sub">{totals ? `+${totals.newUsers7d} tuần này` : ''}</div>
        </div>
        <div className="stat-card" style={{ '--accent': 'var(--green)' } as React.CSSProperties}>
          <div className="stat-num">{totals?.orders ?? '—'}</div>
          <div className="stat-label">Đơn hàng</div>
        </div>
        <div className="stat-card" style={{ '--accent': 'var(--blue)' } as React.CSSProperties}>
          <div className="stat-num">{totals?.products ?? '—'}</div>
          <div className="stat-label">Sản phẩm</div>
        </div>
        <div className="stat-card" style={{ '--accent': 'var(--amber)' } as React.CSSProperties}>
          <div className="stat-num">{totals ? `${compactVnd(totals.revenue7d)}đ` : '—'}</div>
          <div className="stat-label">Doanh thu 7 ngày</div>
        </div>
        <div className="stat-card" style={{ '--accent': 'var(--terracotta)' } as React.CSSProperties}>
          <div className="stat-num">{totals ? `${compactVnd(totals.revenue30d)}đ` : '—'}</div>
          <div className="stat-label">Doanh thu 30 ngày</div>
        </div>
      </div>

      <div className="admin-grid-2">
        <div className="admin-card">
          <div className="admin-card-header">
            <h3>Đơn hàng theo trạng thái</h3>
          </div>
          <div style={{ padding: 16 }}>
            {ORDER_STATUSES.map((status) => (
              <div className="stat-line" key={status}>
                <span style={{ fontSize: '.83rem' }}>{ORDER_STATUS_VN[status]}</span>
                <strong style={{ fontFamily: 'var(--font-h)' }}>
                  {stats?.ordersByStatus?.[status] ?? 0}
                </strong>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card-header">
            <h3>Top 5 sản phẩm bán chạy</h3>
          </div>
          <div style={{ padding: 16 }}>
            {topProducts.length === 0 && <div className="admin-empty-line">Chưa có dữ liệu</div>}
            {topProducts.map((item, i) => (
              <div className="stat-line" key={i}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ProductIcon name={item.product?.name || ''} />
                  <div>
                    <div className="top-product-name">
                      {i + 1}. {item.product?.name || 'Sản phẩm'}
                    </div>
                    <div className="top-product-qty">×{item.totalQty} bán ra</div>
                  </div>
                </div>
                <div className="top-product-revenue">{formatPrice(item.totalRevenue || 0)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h3>Đơn hàng gần đây</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Khách hàng</th>
                <th>Tổng tiền</th>
                <th>Ngày đặt</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {error && (
                <tr>
                  <td colSpan={5} className="admin-cell-error">
                    {error}
                  </td>
                </tr>
              )}
              {!error && !stats && (
                <tr>
                  <td colSpan={5} className="admin-cell-empty">
                    Đang tải...
                  </td>
                </tr>
              )}
              {!error && stats && recentOrders.length === 0 && (
                <tr>
                  <td colSpan={5} className="admin-cell-empty">
                    Chưa có đơn hàng
                  </td>
                </tr>
              )}
              {recentOrders.map((order) => (
                <tr key={order.id}>
                  <td className="admin-order-id">#{shortOrderId(order.id)}</td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: '.84rem' }}>{order.shippingName}</div>
                    <div className="admin-cell-sub">{order.user?.email}</div>
                  </td>
                  <td className="admin-money">{formatPrice(order.total)}</td>
                  <td className="admin-cell-sub">
                    {new Date(order.createdAt).toLocaleDateString('vi-VN')}
                  </td>
                  <td style={{ fontSize: '.78rem', fontWeight: 600 }}>
                    {ORDER_STATUS_VN[order.status] ?? order.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
