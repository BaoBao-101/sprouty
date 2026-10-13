import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ProductIcon } from '@/components/ProductIcon';
import { PageHeader, Pagination, Panel, SearchBox, TableStates, type LoadState } from '@/components/admin/ui';
import { API } from '@/services/api';
import { formatPrice } from '@/types/product';
import { AdminIcon, type AdminIconName } from '@/components/icons/AdminIcon';
import { revenueShare, salesPage, salesSummary, type SalesRow, type SalesSort } from '@/services/sales-report';
import './Sales.css';

const STATUS_LABEL: Record<string, string> = { published: 'Đang bán', draft: 'Bản nháp', archived: 'Lưu trữ' };
const SORTS: Array<{ key: SalesSort; label: string }> = [
  { key: 'revenue', label: 'Doanh thu cao nhất' },
  { key: 'qty', label: 'Bán nhiều nhất' },
  { key: 'orders', label: 'Nhiều đơn nhất' },
  { key: 'name', label: 'Tên A–Z' },
];
const number = (value: number) => value.toLocaleString('vi-VN');
const percent = (value: number) => `${value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`;

/**
 * The products that brought in the most, as bars from one baseline. One
 * series, so one colour and no legend; the value sits at each bar's tip in
 * ink, and hovering (or focusing) a row gives its quantity, orders and share.
 */
function TopRevenue({ rows, total }: { rows: SalesRow[]; total: number }) {
  const top = useMemo(
    () => rows.filter((r) => (r.totalRevenue || 0) > 0)
      .sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0) || a.id - b.id)
      .slice(0, 6),
    [rows],
  );
  const [active, setActive] = useState<number | null>(null);
  if (!top.length) return <p className="sr-chart-empty">Chưa có doanh thu để vẽ biểu đồ.</p>;
  const max = top[0].totalRevenue || 1;
  return (
    <div className="sr-chart" aria-label="Sáu sản phẩm có doanh thu cao nhất">
      {top.map((r) => {
        const value = r.totalRevenue || 0;
        return (
          <div
            key={r.id}
            className={`sr-bar-row${active === r.id ? ' is-active' : ''}`}
            tabIndex={0}
            onMouseEnter={() => setActive(r.id)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(r.id)}
            onBlur={() => setActive(null)}
          >
            <span className="sr-bar-name" title={r.name}>{r.name}</span>
            <span className="sr-bar-track">
              <span className="sr-bar" style={{ width: `${Math.max(1.5, (value / max) * 100)}%` }} />
            </span>
            <span className="sr-bar-value">{formatPrice(value)}</span>
            {active === r.id && (
              <span className="sr-tip" role="tooltip">
                <strong>{r.name}</strong>
                <span>{number(r.totalQty || 0)} đã bán · {number(r.orderCount || 0)} đơn</span>
                <span>{percent(revenueShare(value, total))} tổng doanh thu</span>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Sales() {
  const [rows, setRows] = useState<SalesRow[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SalesSort>('revenue');
  const [page, setPage] = useState(1);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const requestId = useRef(0);
  const load = useCallback(() => {
    const id = ++requestId.current;
    setState('loading');
    setError('');
    API.admin.products.sales().then((data: { products: SalesRow[] }) => {
      if (id !== requestId.current) return;
      setRows(data.products || []);
      setUpdatedAt(new Date());
      setState('ready');
    }).catch((err: Error) => {
      if (id !== requestId.current) return;
      setError(err.message || 'Không tải được báo cáo.');
      setState('error');
    });
  }, []);
  useEffect(load, [load]);
  const summary = useMemo(() => salesSummary(rows), [rows]);
  const result = useMemo(() => salesPage(rows, search, sort, page), [rows, search, sort, page]);
  useEffect(() => { setPage(result.page); }, [result.page]);
  const loading = state === 'loading';
  const ready = state === 'ready';

  const kpis: Array<{ icon: AdminIconName; tone: string; value: string; label: string; hint: string }> = [
    { icon: 'sales', tone: 'green', value: ready ? formatPrice(summary.revenue) : '—', label: 'Doanh thu', hint: 'Theo giá bán trên đơn' },
    { icon: 'orders', tone: 'blue', value: ready ? number(summary.qty) : '—', label: 'Sản phẩm đã bán', hint: 'Tổng số lượng' },
    {
      icon: 'star', tone: 'amber', value: ready ? summary.best?.name || 'Chưa có' : '—', label: 'Dẫn đầu',
      hint: ready && summary.best ? formatPrice(summary.best.totalRevenue || 0) : 'Doanh thu cao nhất',
    },
    { icon: 'products', tone: 'rose', value: ready ? `${number(summary.selling)}/${number(rows.length)}` : '—', label: 'Sản phẩm có bán', hint: 'Trên toàn danh mục' },
  ];

  return (
    <div className="sales-report">
      <PageHeader
        title="Báo cáo bán hàng"
        subtitle="Doanh thu và hiệu quả của từng sản phẩm"
        actions={
          <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
            <AdminIcon name="refresh" size={16} /> {loading ? 'Đang cập nhật…' : 'Làm mới'}
          </button>
        }
      />
      <div className="sr-context">
        <span className="sr-period"><AdminIcon name="calendar" size={15} /> Toàn thời gian</span>
        <span>Chỉ tính đơn đã thanh toán, chưa huỷ; không tính VIP cấp tặng.</span>
        {updatedAt && ready && <span className="sr-updated">Cập nhật {updatedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>}
      </div>

      <div className="ax-kpis">
        {kpis.map((k) => (
          <div key={k.label} className={`ax-kpi tone-${k.tone} is-static`}>
            <span className="ax-kpi-icon"><AdminIcon name={k.icon} size={18} /></span>
            <span className="ax-kpi-body">
              {loading ? <span className="ad-skel w-60" /> : <b title={k.value}>{k.value}</b>}
              <strong>{k.label}</strong>
              <em>{k.hint}</em>
            </span>
          </div>
        ))}
      </div>

      <Panel title="Dẫn đầu doanh thu" action={<span className="sr-panel-note">6 sản phẩm cao nhất</span>}>
        {loading ? <div className="sr-chart-skel"><span className="ad-skel" /><span className="ad-skel" /><span className="ad-skel" /></div> : <TopRevenue rows={rows} total={summary.revenue} />}
      </Panel>

      <Panel title="Chi tiết theo sản phẩm" flush>
        <div className="sr-controls">
          <SearchBox value={search} placeholder="Tìm tên sản phẩm…" onChange={(value) => { setSearch(value); setPage(1); }} />
          <div className="sr-sorts" role="tablist" aria-label="Sắp xếp">
            {SORTS.map((option) => (
              <button
                key={option.key}
                type="button"
                role="tab"
                aria-selected={sort === option.key}
                className={`sr-sort${sort === option.key ? ' is-active' : ''}`}
                onClick={() => { setSort(option.key); setPage(1); }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="sr-table-scroll" role="region" aria-label="Báo cáo doanh thu theo sản phẩm" tabIndex={0}>
          <table className="admin-table sr-table">
            <thead>
              <tr>
                <th scope="col">Sản phẩm</th>
                <th scope="col" className="sr-num">Đã bán</th>
                <th scope="col" className="sr-num">Số đơn</th>
                <th scope="col" className="sr-num">Doanh thu</th>
                <th scope="col">Tỷ trọng</th>
                <th scope="col">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              <TableStates
                state={state}
                error={error}
                isEmpty={result.total === 0}
                columns={6}
                emptyIcon={<AdminIcon name="chart" size={24} />}
                emptyTitle={search ? 'Không tìm thấy sản phẩm' : 'Chưa có sản phẩm'}
                emptyHint={search ? 'Thử đổi tên sản phẩm hoặc xoá từ khoá tìm kiếm.' : 'Báo cáo sẽ xuất hiện khi danh mục có sản phẩm.'}
                onRetry={load}
              />
              {ready && result.rows.map((row) => {
                const share = revenueShare(row.totalRevenue || 0, summary.revenue);
                const none = !(row.totalQty || 0);
                return (
                  <tr key={row.id} className={none ? 'is-quiet' : ''}>
                    <td>
                      <div className="sr-product">
                        <span className="sr-product-icon"><ProductIcon name={row.name} species={row.speciesKey} category={row.category} size={24} /></span>
                        <span>
                          <span className="sr-main">{row.name}</span>
                          <span className="sr-sub">Giá {formatPrice(row.price || 0)}</span>
                        </span>
                      </div>
                    </td>
                    <td className="sr-num">{number(row.totalQty || 0)}</td>
                    <td className="sr-num">{number(row.orderCount || 0)}</td>
                    <td className="sr-num sr-revenue">{none ? '—' : formatPrice(row.totalRevenue || 0)}</td>
                    <td>
                      <div className="sr-share">
                        <span className="sr-share-track"><span style={{ width: `${Math.min(100, share)}%` }} /></span>
                        <span className="sr-share-value">{percent(share)}</span>
                      </div>
                    </td>
                    <td><span className={`sr-status is-${row.status}`}>{STATUS_LABEL[row.status] || row.status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {ready && (
          <div className="sr-foot">
            <span>
              {result.total ? `${result.from}–${result.to} trong ${number(result.total)} sản phẩm` : '0 sản phẩm'}
              {search.trim() ? ' phù hợp' : ''}
            </span>
            <Pagination page={result.page} pages={result.pages} total={result.total} unit="sản phẩm" onChange={setPage} />
          </div>
        )}
      </Panel>
      <p className="sr-explainer">
        Tỷ trọng = doanh thu sản phẩm / tổng doanh thu. Một đơn nhiều sản phẩm được tính vào số đơn của từng sản phẩm, nên không cộng cột số đơn để ra tổng đơn hàng.
      </p>
    </div>
  );
}
