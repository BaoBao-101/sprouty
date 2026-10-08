import { useCallback, useEffect, useMemo, useState } from 'react';
import { ProductIcon } from '@/components/ProductIcon';
import {
  MeterBar,
  PageHeader,
  Panel,
  Pill,
  SearchBox,
  StatCard,
  StatGrid,
  TableStates,
  Toolbar,
  type LoadState,
} from '@/components/admin/ui';
import { API } from '@/services/api';
import { formatPrice } from '@/types/product';
import { AdminIcon } from '@/components/icons/AdminIcon';

interface SalesRow {
  id: number;
  name: string;
  price: number;
  totalQty?: number;
  orderCount?: number;
  totalRevenue?: number;
  status: string;
}

const STATUS_LABEL: Record<string, string> = {
  published: 'Đang bán',
  draft: 'Bản nháp',
  archived: 'Lưu trữ',
};

const STATUS_TONE: Record<string, string> = {
  published: 'green',
  draft: 'amber',
  archived: 'grey',
};

type SortKey = 'revenue' | 'qty' | 'orders' | 'name';

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'revenue', label: 'Doanh thu' },
  { key: 'qty', label: 'Đã bán' },
  { key: 'orders', label: 'Số đơn' },
  { key: 'name', label: 'Tên' },
];

function compactVnd(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toLocaleString('vi-VN');
}

export default function Sales() {
  const [rows, setRows] = useState<SalesRow[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('revenue');

  const load = useCallback(() => {
    setState('loading');
    API.admin.products
      .sales()
      .then((data: any) => {
        setRows(data.products || []);
        setState('ready');
      })
      .catch((err: any) => {
        setError(err?.message || 'Không tải được báo cáo.');
        setState('error');
      });
  }, []);

  useEffect(load, [load]);

  // The report is the whole catalogue in one response, so filtering and sorting
  // happen here rather than costing a round trip each time.
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term ? rows.filter((r) => r.name.toLowerCase().includes(term)) : rows;
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, 'vi');
      if (sort === 'qty') return (b.totalQty || 0) - (a.totalQty || 0);
      if (sort === 'orders') return (b.orderCount || 0) - (a.orderCount || 0);
      return (b.totalRevenue || 0) - (a.totalRevenue || 0);
    });
    return sorted;
  }, [rows, search, sort]);

  const summary = useMemo(() => {
    const revenue = rows.reduce((sum, r) => sum + (r.totalRevenue || 0), 0);
    const qty = rows.reduce((sum, r) => sum + (r.totalQty || 0), 0);
    const best = rows.reduce<SalesRow | null>(
      (top, r) => ((r.totalRevenue || 0) > (top?.totalRevenue || 0) ? r : top),
      null,
    );
    const selling = rows.filter((r) => (r.totalQty || 0) > 0).length;
    return { revenue, qty, best, selling };
  }, [rows]);

  const topRevenue = Math.max(1, ...rows.map((r) => r.totalRevenue || 0));
  const loading = state === 'loading';

  return (
    <>
      <PageHeader
        title="Báo cáo bán hàng"
        subtitle="Số lượng bán ra và doanh thu theo từng sản phẩm"
        actions={
          <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
            <AdminIcon name="refresh" size={16} /> Làm mới
          </button>
        }
      />

      <StatGrid>
        <StatCard
          icon={<AdminIcon name="sales" />}
          tone="orange"
          loading={loading}
          value={`${compactVnd(summary.revenue)}đ`}
          label="Tổng doanh thu"
        />
        <StatCard
          icon={<AdminIcon name="orders" />}
          tone="blue"
          loading={loading}
          value={summary.qty.toLocaleString('vi-VN')}
          label="Sản phẩm đã bán"
        />
        <StatCard
          icon={<AdminIcon name="star" />}
          tone="amber"
          loading={loading}
          value={summary.best?.name || '—'}
          label="Bán chạy nhất"
          hint={summary.best ? formatPrice(summary.best.totalRevenue || 0) : undefined}
        />
        <StatCard
          icon={<AdminIcon name="seed" />}
          tone="green"
          loading={loading}
          value={`${summary.selling}/${rows.length}`}
          label="Sản phẩm có đơn"
        />
      </StatGrid>

      <Toolbar>
        <div className="ad-pills">
          <span className="ad-sort-label">Sắp xếp theo</span>
          {SORTS.map((option) => (
            <button
              key={option.key}
              className={`ad-pill${sort === option.key ? ' active' : ''}`}
              onClick={() => setSort(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <SearchBox value={search} placeholder="Tìm sản phẩm…" onChange={setSearch} />
      </Toolbar>

      <Panel flush>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Sản phẩm</th>
              <th>Tỷ trọng doanh thu</th>
              <th style={{ textAlign: 'right' }}>Đã bán</th>
              <th style={{ textAlign: 'right' }}>Số đơn</th>
              <th style={{ textAlign: 'right' }}>Doanh thu</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            <TableStates
              state={state}
              error={error}
              isEmpty={visible.length === 0}
              columns={6}
              emptyIcon={<AdminIcon name="chart" size={24} />}
              emptyTitle={search ? 'Không tìm thấy sản phẩm' : 'Chưa có sản phẩm'}
              emptyHint={search ? 'Thử một từ khoá khác.' : undefined}
              onRetry={load}
            />
            {state === 'ready' &&
              visible.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <ProductIcon name={row.name} size={22} />
                      <div>
                        <div className="ad-cell-main">{row.name}</div>
                        <div className="ad-cell-sub">{formatPrice(row.price || 0)}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ minWidth: 120 }}>
                    <MeterBar value={row.totalRevenue || 0} max={topRevenue} tone="orange" />
                  </td>
                  <td className="ad-num">{(row.totalQty || 0).toLocaleString('vi-VN')}</td>
                  <td className="ad-num" style={{ fontWeight: 400 }}>
                    {(row.orderCount || 0).toLocaleString('vi-VN')}
                  </td>
                  <td className="ad-num" style={{ color: 'var(--orange)' }}>
                    {formatPrice(row.totalRevenue || 0)}
                  </td>
                  <td>
                    <Pill tone={STATUS_TONE[row.status] ?? 'grey'}>
                      {STATUS_LABEL[row.status] ?? row.status}
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
