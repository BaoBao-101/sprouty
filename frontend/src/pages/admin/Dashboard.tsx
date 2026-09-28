import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProductIcon } from '@/components/ProductIcon';
import {
  MeterBar,
  PageHeader,
  Panel,
  Pill,
  StatCard,
  StatGrid,
  TableStates,
  type LoadState,
} from '@/components/admin/ui';
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

const STATUS_TONE: Record<OrderStatus, string> = {
  pending: 'amber',
  processing: 'blue',
  shipped: 'orange',
  delivered: 'green',
  cancelled: 'rose',
};

const RANK_MEDAL = ['🥇', '🥈', '🥉'];

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setState('loading');
    API.admin
      .stats()
      .then((data: any) => {
        setStats(data);
        setState('ready');
      })
      .catch((err: any) => {
        setError(err?.message || 'Không tải được số liệu.');
        setState('error');
      });
  }, []);

  useEffect(load, [load]);

  const totals = stats?.totals;
  const loading = state === 'loading';
  const topProducts = (stats?.topProducts || []).slice(0, 5);
  const recentOrders = (stats?.recentOrders || []).slice(0, 8);

  const byStatus = stats?.ordersByStatus || {};
  const statusTotal = ORDER_STATUSES.reduce((sum, s) => sum + (byStatus[s] ?? 0), 0);
  const topQty = Math.max(1, ...topProducts.map((p) => p.totalQty || 0));

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Tổng quan hoạt động của Sprouty"
        actions={
          <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
            {loading ? 'Đang tải…' : '↻ Làm mới'}
          </button>
        }
      />

      <StatGrid>
        <StatCard
          icon="👥"
          tone="blue"
          loading={loading}
          value={totals?.users ?? '—'}
          label="Người dùng"
          hint={totals ? `+${totals.newUsers7d} trong 7 ngày` : undefined}
        />
        <StatCard
          icon="📦"
          tone="orange"
          loading={loading}
          value={totals?.orders ?? '—'}
          label="Đơn hàng"
          hint={statusTotal ? `${byStatus.pending ?? 0} chờ xác nhận` : undefined}
        />
        <StatCard
          icon="🎨"
          tone="green"
          loading={loading}
          value={totals?.products ?? '—'}
          label="Sản phẩm"
        />
        <StatCard
          icon="💰"
          tone="amber"
          loading={loading}
          value={totals ? `${compactVnd(totals.revenue7d)}đ` : '—'}
          label="Doanh thu 7 ngày"
        />
        <StatCard
          icon="📈"
          tone="rose"
          loading={loading}
          value={totals ? `${compactVnd(totals.revenue30d)}đ` : '—'}
          label="Doanh thu 30 ngày"
        />
      </StatGrid>

      <div className="ad-split">
        <Panel
          title="Đơn hàng theo trạng thái"
          action={
            <Link className="btn btn-ghost btn-sm" to="/admin/orders">
              Xem tất cả →
            </Link>
          }
        >
          {/* A bar next to each count shows the shape of the queue at a glance —
              a column of bare numbers did not. */}
          {ORDER_STATUSES.map((status) => {
            const count = byStatus[status] ?? 0;
            return (
              <Link className="dash-status" to={`/admin/orders?status=${status}`} key={status}>
                <span className="dash-status-label">{ORDER_STATUS_VN[status]}</span>
                <MeterBar value={count} max={Math.max(1, statusTotal)} tone={STATUS_TONE[status]} />
                <strong className="dash-status-count">{count}</strong>
              </Link>
            );
          })}
        </Panel>

        <Panel
          title="Top 5 sản phẩm bán chạy"
          action={
            <Link className="btn btn-ghost btn-sm" to="/admin/sales">
              Báo cáo →
            </Link>
          }
        >
          {topProducts.length === 0 && (
            <div className="ad-blank">
              <span className="ad-blank-icon">🌱</span>
              <p className="ad-blank-title">Chưa có dữ liệu bán hàng</p>
              <p className="ad-blank-hint">Số liệu xuất hiện sau đơn hàng đã thanh toán đầu tiên.</p>
            </div>
          )}
          {topProducts.map((item, i) => (
            <div className="dash-top" key={i}>
              <span className="dash-top-rank">{RANK_MEDAL[i] ?? i + 1}</span>
              <ProductIcon name={item.product?.name || ''} />
              <div className="dash-top-main">
                <div className="ad-cell-main">{item.product?.name || 'Sản phẩm'}</div>
                <MeterBar value={item.totalQty || 0} max={topQty} tone="orange" />
              </div>
              <div className="dash-top-right">
                <div className="dash-top-money">{formatPrice(item.totalRevenue || 0)}</div>
                <div className="ad-cell-sub">×{item.totalQty} bán ra</div>
              </div>
            </div>
          ))}
        </Panel>
      </div>

      <Panel
        title="Đơn hàng gần đây"
        flush
        action={
          <Link className="btn btn-ghost btn-sm" to="/admin/orders">
            Quản lý đơn →
          </Link>
        }
      >
        <table className="admin-table">
          <thead>
            <tr>
              <th>Mã đơn</th>
              <th>Khách hàng</th>
              <th style={{ textAlign: 'right' }}>Tổng tiền</th>
              <th>Ngày đặt</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            <TableStates
              state={state}
              error={error}
              isEmpty={recentOrders.length === 0}
              columns={5}
              emptyIcon="📦"
              emptyTitle="Chưa có đơn hàng"
              emptyHint="Đơn hàng mới nhất sẽ hiện ở đây."
              onRetry={load}
            />
            {state === 'ready' &&
              recentOrders.map((order) => (
                <tr key={order.id}>
                  <td className="admin-order-id">#{shortOrderId(order.id)}</td>
                  <td>
                    <div className="ad-cell-main">{order.shippingName}</div>
                    <div className="ad-cell-sub">{order.user?.email}</div>
                  </td>
                  <td className="ad-num">{formatPrice(order.total)}</td>
                  <td className="ad-cell-sub">
                    {new Date(order.createdAt).toLocaleDateString('vi-VN')}
                  </td>
                  <td>
                    <Pill tone={STATUS_TONE[order.status] ?? 'grey'}>
                      {ORDER_STATUS_VN[order.status] ?? order.status}
                    </Pill>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
