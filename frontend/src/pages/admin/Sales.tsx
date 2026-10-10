import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ProductIcon } from '@/components/ProductIcon';
import { MeterBar, PageHeader, Pagination, Panel, Pill, SearchBox, StatCard, StatGrid, TableStates, type LoadState } from '@/components/admin/ui';
import { API } from '@/services/api';
import { formatPrice } from '@/types/product';
import { AdminIcon } from '@/components/icons/AdminIcon';
import { revenueShare, salesPage, salesSummary, SALES_PAGE_SIZE, type SalesRow, type SalesSort } from '@/services/sales-report';
import './Sales.css';

const STATUS_LABEL: Record<string, string> = { published: 'Đang bán', draft: 'Bản nháp', archived: 'Lưu trữ' };
const STATUS_TONE: Record<string, string> = { published: 'green', draft: 'amber', archived: 'grey' };
const SORTS: Array<{ key: SalesSort; label: string }> = [
  { key: 'revenue', label: 'Doanh thu cao nhất' }, { key: 'qty', label: 'Số lượng bán nhiều nhất' },
  { key: 'orders', label: 'Số đơn nhiều nhất' }, { key: 'name', label: 'Tên sản phẩm A–Z' },
];

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
  const number = (value: number) => value.toLocaleString('vi-VN');

  return <div className="sales-report">
    <PageHeader title="Báo cáo bán hàng" subtitle="Theo dõi doanh thu và hiệu quả kinh doanh theo sản phẩm"
      actions={<button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
        <AdminIcon name="refresh" size={16} /> {loading ? 'Đang cập nhật…' : 'Làm mới'}
      </button>} />
    <div className="sales-context">
      <span className="sales-period"><AdminIcon name="chart" size={17} /> Toàn thời gian</span>
      <span>Chỉ tính đơn đã thanh toán, chưa hủy. Không tính đơn VIP cấp tặng.</span>
      {updatedAt && ready && <span className="sales-updated">Cập nhật {updatedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>}
    </div>
    <StatGrid>
      <StatCard icon={<AdminIcon name="sales" />} tone="green" loading={loading}
        value={ready ? formatPrice(summary.revenue) : '—'} label="Doanh thu sản phẩm" hint="Theo giá bán ghi nhận trên đơn" />
      <StatCard icon={<AdminIcon name="orders" />} tone="blue" loading={loading}
        value={ready ? number(summary.qty) : '—'} label="Số lượng đã bán" hint="Tổng số lượng, không phải số đơn" />
      <StatCard icon={<AdminIcon name="star" />} tone="amber" loading={loading}
        value={ready ? summary.best?.name || 'Chưa có doanh thu' : '—'} label="Dẫn đầu doanh thu"
        hint={ready && summary.best ? formatPrice(summary.best.totalRevenue || 0) : 'Sản phẩm có doanh thu cao nhất'} />
      <StatCard icon={<AdminIcon name="products" />} tone="orange" loading={loading}
        value={ready ? `${number(summary.selling)} / ${number(rows.length)}` : '—'} label="Sản phẩm đã phát sinh bán"
        hint="Trên toàn bộ danh mục sản phẩm" />
    </StatGrid>
    <Panel title="Chi tiết theo sản phẩm" flush action={<span className="sales-page-size">{SALES_PAGE_SIZE} sản phẩm / trang</span>}>
      <div className="sales-controls">
        <SearchBox value={search} placeholder="Tìm tên sản phẩm…" onChange={value => { setSearch(value); setPage(1); }} />
        <label className="sales-sort">Sắp xếp
          <select className="form-input" value={sort} onChange={event => { setSort(event.target.value as SalesSort); setPage(1); }}>
            {SORTS.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
          </select>
        </label>
      </div>
      <div className="sales-table-scroll" role="region" aria-label="Báo cáo doanh thu theo sản phẩm" tabIndex={0}>
        <table className="admin-table sales-table">
          <thead><tr>
            <th scope="col">Sản phẩm</th><th scope="col" className="sales-number">Số lượng bán</th>
            <th scope="col" className="sales-number">Số đơn</th><th scope="col" className="sales-number">Doanh thu</th>
            <th scope="col">Tỷ trọng doanh thu</th><th scope="col">Trạng thái</th>
          </tr></thead>
          <tbody>
            <TableStates state={state} error={error} isEmpty={result.total === 0} columns={6}
              emptyIcon={<AdminIcon name="chart" size={24} />} emptyTitle={search ? 'Không tìm thấy sản phẩm' : 'Chưa có sản phẩm'}
              emptyHint={search ? 'Thử đổi tên sản phẩm hoặc xóa từ khóa tìm kiếm.' : 'Báo cáo sẽ xuất hiện khi danh mục có sản phẩm.'} onRetry={load} />
            {ready && result.rows.map(row => {
              const share = revenueShare(row.totalRevenue || 0, summary.revenue);
              return <tr key={row.id}>
                <td><div className="sales-product"><span className="sales-product-icon"><ProductIcon name={row.name} size={28} /></span>
                  <div><div className="ad-cell-main">{row.name}</div><div className="ad-cell-sub">Mã SP #{row.id} · Giá hiện tại {formatPrice(row.price || 0)}</div></div>
                </div></td>
                <td className="ad-num">{number(row.totalQty || 0)}</td>
                <td className="ad-num sales-orders">{number(row.orderCount || 0)}</td>
                <td className="ad-num sales-revenue">{formatPrice(row.totalRevenue || 0)}</td>
                <td><div className="sales-share"><span>{share.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%</span>
                  <MeterBar value={row.totalRevenue || 0} max={summary.revenue || 1} tone="green" />
                </div></td>
                <td><Pill tone={STATUS_TONE[row.status] || 'grey'}>{STATUS_LABEL[row.status] || row.status}</Pill></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      {ready && <div className="sales-results" aria-live="polite">
        <span>{result.total ? `Hiển thị ${result.from}–${result.to} trong ${number(result.total)} sản phẩm` : '0 sản phẩm'}{search.trim() ? ' phù hợp' : ''}</span>
        <span>Trang {result.page} / {result.pages}</span>
      </div>}
      {ready && <Pagination page={result.page} pages={result.pages} total={result.total} unit="sản phẩm" onChange={setPage} />}
    </Panel>
    <p className="sales-explainer">Tỷ trọng = doanh thu sản phẩm / tổng doanh thu. Một đơn có nhiều sản phẩm được tính vào số đơn của từng sản phẩm; không cộng cột số đơn để lấy tổng đơn hàng. Số liệu tổng quan không thay đổi theo tìm kiếm hoặc phân trang.</p>
  </div>;
}
