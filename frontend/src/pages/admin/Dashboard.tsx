import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProductIcon } from '@/components/ProductIcon';
import { MeterBar, Panel, Pill } from '@/components/admin/ui';
import { API } from '@/services/api';
import { ORDER_STATUS_VN, ORDER_STATUSES, shortOrderId, type OrderStatus } from '@/types/order';
import { formatPrice } from '@/types/product';
import { AdminIcon, type AdminIconName } from '@/components/icons/AdminIcon';
import './Dashboard.css';

type Metric = { value: number; previous: number; change: number | null };
type Day = { date: string; revenue: number; orders: number };
interface Stats {
  period: { days: number; start: string; end: string; previousStart: string; previousEnd: string };
  updatedAt: string;
  metrics: Record<'revenue' | 'orders' | 'customers' | 'average', Metric>;
  overview: { customers: number; products: number; paidOrders: number };
  attention: { unpaidOrders: number; draftProducts: number; draftPosts: number; pendingBookings: number };
  revenueByDay: Day[];
  topProducts: Array<{ id: number; name: string; qty: number; revenue: number }>;
  ordersByStatus: Partial<Record<OrderStatus, number>>;
  recentOrders: Array<{ id: string; shippingName: string; total: number; createdAt: string; paidAt: string | null; status: OrderStatus }>;
  upcomingWorkshops: Array<{ id: string; title: string; dateTime: string; location: string; capacity: number; _count: { registrations: number } }>;
  activity: Array<{ id: string; action: string; createdAt: string; actor: { name: string } }>;
}
const tones: Record<OrderStatus, string> = { pending: 'amber', processing: 'blue', shipped: 'orange', delivered: 'green', cancelled: 'rose' };
const n = (value: number) => value.toLocaleString('vi-VN');
const date = (value: string, time = false) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', ...(time ? { hour: '2-digit', minute: '2-digit' } : { year: 'numeric' }) });
const axisMoney = (value: number) => value >= 1e9 ? `${n(Math.round(value / 1e8) / 10)} tỷ` : value >= 1e6 ? `${n(Math.round(value / 1e5) / 10)} tr` : value >= 1000 ? `${n(Math.round(value / 1000))} nghìn` : n(value);
const actionLabels: Record<string, string> = {
  'user.create': 'Tạo tài khoản', 'user.update': 'Cập nhật tài khoản', 'user.password.change': 'Đổi mật khẩu',
  'user.password.reset': 'Đặt lại mật khẩu', 'user.grant_vip': 'Cấp tặng VIP', 'user.revoke_vip': 'Thu hồi VIP tặng',
  'order.marked_paid': 'Ghi nhận thanh toán', 'order.status.updated': 'Cập nhật giao hàng',
  'product.create': 'Thêm sản phẩm', 'product.update': 'Cập nhật sản phẩm', 'product.delete': 'Xóa sản phẩm',
  'workshop.create': 'Tạo workshop', 'workshop.update': 'Cập nhật workshop', 'workshop.delete': 'Xóa workshop',
  'blog.create': 'Tạo bài viết', 'blog.update': 'Cập nhật bài viết', 'user_image.hidden': 'Ẩn ảnh khách hàng',
};
function Empty({ children }: { children: React.ReactNode }) { return <div className="db-empty"><AdminIcon name="inbox" size={26} /><p>{children}</p></div>; }
function More({ to, children = 'Xem tất cả' }: { to: string; children?: React.ReactNode }) {
  return <Link className="db-more" to={to}>{children}<AdminIcon name="arrow-right" size={15} /></Link>;
}
function MetricCard({ title, icon, metric, money, accent, detail }: { title: string; icon: AdminIconName; metric: Metric; money?: boolean; accent?: boolean; detail: string }) {
  return <article className={`db-metric${accent ? ' db-metric-primary' : ''}`}>
    <div className="db-metric-title"><span>{title}</span><AdminIcon name={icon} size={21} /></div>
    <strong className="db-metric-value">{money ? formatPrice(metric.value) : n(metric.value)}</strong>
    <div className="db-metric-comparison">
      <span className={`db-change ${metric.change === null || metric.change === 0 ? 'neutral' : metric.change > 0 ? 'up' : 'down'}`}>
        {metric.change === null ? 'Chưa có mốc so sánh' : `${metric.change > 0 ? '+' : ''}${n(metric.change)}%`}
      </span><span>so với kỳ trước</span>
    </div>
    <p>{detail}</p>
  </article>;
}
function RevenueChart({ points }: { points: Day[] }) {
  const [selected, setSelected] = useState(points.length - 1);
  const index = Math.max(0, Math.min(selected, points.length - 1));
  const active = points[index];
  const max = Math.max(1, ...points.map(point => point.revenue));
  const x = (i: number) => 62 + i / Math.max(1, points.length - 1) * 626;
  const y = (value: number) => 185 - value / max * 151;
  const line = points.map((point, i) => `${i ? 'L' : 'M'}${x(i)},${y(point.revenue)}`).join(' ');
  const total = points.reduce((sum, point) => sum + point.revenue, 0);
  return <div className="db-chart">
    <div className="db-chart-caption"><div><span>Doanh thu trong kỳ</span><strong>{formatPrice(total)}</strong></div>
      <div className="db-chart-selected" aria-live="polite"><span>{active?.date.split('-').reverse().join('/')}</span><strong>{formatPrice(active?.revenue || 0)}</strong><small>{active?.orders || 0} đơn thanh toán</small></div>
    </div>
    {total === 0 && <p className="db-chart-zero">Chưa có doanh thu trong khoảng thời gian này.</p>}
    <svg viewBox="0 0 720 225" role="img" aria-label={`Doanh thu từng ngày, tổng ${formatPrice(total)}. Dùng thanh chọn ngày bên dưới để xem chi tiết.`}
      onPointerMove={event => { const box = event.currentTarget.getBoundingClientRect(); setSelected(Math.round(Math.max(0, Math.min(1, ((event.clientX - box.left) / box.width * 720 - 62) / 626)) * (points.length - 1))); }}>
      <defs><linearGradient id="db-revenue-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22a36a" stopOpacity=".22" /><stop offset="100%" stopColor="#22a36a" stopOpacity=".015" /></linearGradient></defs>
      {[0, .5, 1].map(tick => <g key={tick}><line x1="62" x2="688" y1={y(max * tick)} y2={y(max * tick)} stroke="#e6eee9" strokeDasharray="4 5" /><text x="52" y={y(max * tick) + 4} textAnchor="end">{axisMoney(total ? max * tick : 0)}</text></g>)}
      <path d={`${line} L688,185 L62,185 Z`} fill="url(#db-revenue-fill)" />
      <path d={line} stroke="#168751" strokeWidth="3" fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {active && <><line x1={x(index)} x2={x(index)} y1="30" y2="185" stroke="#96bbaa" strokeDasharray="4 4" /><circle cx={x(index)} cy={y(active.revenue)} r="5" fill="#168751" stroke="white" strokeWidth="3" /></>}
      {[0, Math.floor((points.length - 1) / 2), points.length - 1].map(i => <text key={i} x={x(i)} y="214" textAnchor="middle">{points[i]?.date.slice(5).split('-').reverse().join('/')}</text>)}
    </svg>
    <label className="db-chart-control">Xem từng ngày<input type="range" min={0} max={points.length - 1} value={index} onChange={event => setSelected(Number(event.target.value))} aria-label="Chọn ngày xem doanh thu" aria-valuetext={`${active?.date}: ${formatPrice(active?.revenue || 0)}`} /></label>
    <p className="db-muted">Theo ngày thanh toán · Giờ Việt Nam (UTC+7)</p>
  </div>;
}

export default function Dashboard() {
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<Stats | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const request = useRef(0);
  const load = useCallback(() => {
    const id = ++request.current;
    setState('loading');
    API.admin.stats({ days: String(days) }).then((data: Stats) => {
      if (id !== request.current) return;
      // An older API answers 200 with a different shape (totals, no attention or
      // metrics), and reading it crashed the whole admin. Say what is wrong instead.
      if (!data?.metrics || !data?.attention || !data?.overview || !data?.period) {
        setError('Máy chủ đang chạy phiên bản cũ, chưa có số liệu cho dashboard mới. Hãy deploy lại backend rồi bấm Thử lại.');
        setState('error');
        return;
      }
      setStats(data); setState('ready');
    })
      .catch((err: Error) => { if (id === request.current) { setError(err.message || 'Không tải được dashboard.'); setState('error'); } });
  }, [days]);
  useEffect(load, [load]);
  const totalOrders = ORDER_STATUSES.reduce((sum, status) => sum + (stats?.ordersByStatus[status] || 0), 0);
  const tasks: Array<{ title: string; count: number; icon: AdminIconName; to: string; note: string }> = stats ? [
    { title: 'Đơn chưa thanh toán', count: stats.attention.unpaidOrders, icon: 'card', to: '/admin/orders?payment=unpaid', note: 'Kiểm tra và đối soát giao dịch' },
    { title: 'Đăng ký workshop chờ xác nhận', count: stats.attention.pendingBookings, icon: 'ticket', to: '/admin/workshops', note: 'Của các buổi workshop sắp tới' },
    { title: 'Sản phẩm đang soạn', count: stats.attention.draftProducts, icon: 'products', to: '/admin/products', note: 'Rà soát nội dung trước khi bán' },
    { title: 'Bài viết bản nháp', count: stats.attention.draftPosts, icon: 'blog', to: '/admin/blog', note: 'Hoàn thiện và duyệt nội dung' },
  ] : [];

  return <div className="admin-dashboard">
    <header className="db-header"><div><span className="db-eyebrow">SPROUTY / TRUNG TÂM QUẢN TRỊ</span><h1>Tổng quan kinh doanh</h1><p>Nắm bắt kết quả, theo dõi vận hành và ưu tiên việc cần làm.</p></div>
      <div className="db-header-actions"><div className="db-period" role="group" aria-label="Khoảng thời gian báo cáo">{[7, 30, 90].map(value => <button key={value} aria-pressed={days === value} className={days === value ? 'active' : ''} onClick={() => setDays(value)}>{value} ngày</button>)}</div>
        <button className="btn btn-ghost btn-sm" onClick={load} disabled={state === 'loading'}><AdminIcon name="refresh" size={16} />Làm mới</button></div>
    </header>
    {state === 'loading' && <div className="db-loading" role="status"><div className="db-skeleton-grid">{[1, 2, 3, 4].map(i => <div key={i} />)}</div><p>Đang tổng hợp dữ liệu dashboard…</p></div>}
    {state === 'error' && <div className="db-error" role="alert"><AdminIcon name="alert" size={25} /><h2>Chưa tải được số liệu</h2><p>{error}</p><button className="btn btn-primary" onClick={load}>Thử lại</button></div>}
    {state === 'ready' && stats && <>
      <div className="db-period-note"><span><AdminIcon name="calendar" size={16} />{date(stats.period.start)} – {date(stats.period.end)}</span><span>Cập nhật {date(stats.updatedAt, true)} · UTC+7</span></div>
      <section className="db-metrics" aria-label="Chỉ số kinh doanh trong kỳ">
        <MetricCard title="Doanh thu sản phẩm" icon="sales" metric={stats.metrics.revenue} money accent detail={`${n(stats.overview.paidOrders)} đơn đã thanh toán trong kỳ`} />
        <MetricCard title="Đơn hàng mới" icon="orders" metric={stats.metrics.orders} detail="Theo ngày đặt, gồm mọi trạng thái" />
        <MetricCard title="Khách hàng mới" icon="users" metric={stats.metrics.customers} detail="Tài khoản khách hàng đăng ký trong kỳ" />
        <MetricCard title="Giá trị đơn trung bình" icon="chart" metric={stats.metrics.average} money detail="Doanh thu / số đơn đã thanh toán" />
      </section>
      <p className="db-definition">Doanh thu theo giá sản phẩm trên đơn đã thanh toán, chưa hủy; không gồm VIP tặng và phí workshop. So sánh với {date(stats.period.previousStart)} – {date(stats.period.previousEnd)} tại cùng thời điểm trong ngày.</p>
      <div className="db-main-grid">
        <Panel title="Xu hướng doanh thu" action={<More to="/admin/sales">Báo cáo chi tiết</More>}><RevenueChart key={days} points={stats.revenueByDay} /></Panel>
        <Panel title="Đơn hàng trong kỳ" action={<span className="db-small-badge">{n(totalOrders)} đơn</span>}>
          <p className="db-muted">Trạng thái hiện tại của các đơn được đặt trong kỳ.</p>
          <div className="db-status-stack" aria-hidden="true">{ORDER_STATUSES.map(status => <span className={`db-status-${status}`} key={status} style={{ width: `${totalOrders ? (stats.ordersByStatus[status] || 0) / totalOrders * 100 : 0}%` }} />)}</div>
          {ORDER_STATUSES.map(status => <Link className="db-status-row" to={`/admin/orders?status=${status}`} key={status}><span><i className={`db-status-${status}`} />{ORDER_STATUS_VN[status]}</span><strong>{n(stats.ordersByStatus[status] || 0)}</strong><small>{totalOrders ? Math.round((stats.ordersByStatus[status] || 0) / totalOrders * 100) : 0}%</small></Link>)}
          <p className="db-muted db-status-foot">Mở từng trạng thái để xem hàng đợi toàn hệ thống.</p>
        </Panel>
      </div>
      <section className="db-work-section" aria-labelledby="db-work-title"><div className="db-section-heading"><div><h2 id="db-work-title">Ưu tiên quản trị</h2><p>Tình hình hiện tại trên toàn hệ thống, không phụ thuộc bộ lọc thời gian.</p></div><span className="db-live-dot">Hiện tại</span></div>
        <div className="db-task-grid">{tasks.map(task => <Link className="db-task" to={task.to} key={task.title}><span className="db-task-top"><AdminIcon name={task.icon} size={20} /><strong>{n(task.count)}</strong></span><h3>{task.title}</h3><p>{task.note}</p><span className="db-task-link">Mở quản lý<AdminIcon name="arrow-right" size={15} /></span></Link>)}</div>
      </section>
      <div className="db-main-grid">
        <Panel title="Top 5 sản phẩm theo doanh thu" action={<More to="/admin/sales">Xem báo cáo</More>}>
          <p className="db-muted">Xếp hạng trong {days} ngày đang chọn.</p>
          {!stats.topProducts.length && <Empty>Chưa có sản phẩm được thanh toán trong kỳ.</Empty>}
          {stats.topProducts.map((product, i) => <div className="db-product" key={product.id}><span className={`db-rank${i === 0 ? ' first' : ''}`}>{i + 1}</span><ProductIcon name={product.name} size={28} /><div className="db-product-main"><strong>{product.name}</strong><MeterBar value={product.revenue} max={stats.metrics.revenue.value || 1} tone="green" /><small>{n(product.qty)} sản phẩm · {n(Math.round(product.revenue / Math.max(1, stats.metrics.revenue.value) * 1000) / 10)}% doanh thu</small></div><strong className="db-product-money">{formatPrice(product.revenue)}</strong></div>)}
        </Panel>
        <Panel title="Workshop sắp diễn ra" action={<More to="/admin/workshops">Quản lý</More>}>
          {!stats.upcomingWorkshops.length && <Empty>Chưa có workshop sắp diễn ra.</Empty>}
          {stats.upcomingWorkshops.map(workshop => <Link className="db-workshop" to="/admin/workshops" key={workshop.id}><div className="db-date-block"><strong>{new Date(workshop.dateTime).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit' })}</strong><span>Tháng {new Date(workshop.dateTime).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', month: '2-digit' })}</span></div><div><h3>{workshop.title}</h3><p>{date(workshop.dateTime, true)} · {workshop.location || 'Chưa có địa điểm'}</p><small>{workshop._count.registrations} lượt đăng ký · Sức chứa {workshop.capacity} chỗ</small></div><AdminIcon name="chevron-right" size={16} /></Link>)}
          <p className="db-muted">Lượt đăng ký chưa hủy; một lượt có thể gồm nhiều trẻ.</p>
        </Panel>
      </div>
      <Panel title="10 đơn hàng mới nhất trong kỳ" flush action={<More to="/admin/orders">Giám sát đơn hàng</More>}>
        <div className="db-table-scroll"><table className="admin-table db-orders"><thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Thời gian đặt</th><th className="db-align-right">Giá trị đơn</th><th>Thanh toán</th><th>Trạng thái</th><th><span className="db-sr-only">Chi tiết</span></th></tr></thead><tbody>
          {!stats.recentOrders.length && <tr><td colSpan={7}><Empty>Chưa có đơn hàng trong khoảng thời gian này.</Empty></td></tr>}
          {stats.recentOrders.map(order => <tr key={order.id}><td><Link className="db-order-id" to={`/admin/orders?q=${encodeURIComponent(order.id)}`}>#{shortOrderId(order.id)}</Link></td><td className="ad-cell-main">{order.shippingName || 'Khách hàng'}</td><td className="ad-cell-sub">{date(order.createdAt, true)}</td><td className="ad-num">{formatPrice(order.total)}</td><td><span className={`db-payment ${order.status === 'cancelled' ? 'muted' : order.paidAt ? 'paid' : 'unpaid'}`}>{order.paidAt ? 'Đã thanh toán' : order.status === 'cancelled' ? 'Đã hủy' : 'Chưa thanh toán'}</span></td><td><Pill tone={tones[order.status]}>{ORDER_STATUS_VN[order.status]}</Pill></td><td><Link className="db-more" to={`/admin/orders?q=${encodeURIComponent(order.id)}`} aria-label={`Xem đơn ${shortOrderId(order.id)}`}><AdminIcon name="arrow-right" size={17} /></Link></td></tr>)}
        </tbody></table></div>
      </Panel>
      <div className="db-bottom-grid"><Panel title="Hoạt động quản trị gần đây" action={<More to="/admin/audit">Nhật ký đầy đủ</More>}>
        {!stats.activity.length && <Empty>Chưa có hoạt động quản trị được ghi nhận.</Empty>}
        <ol className="db-activity">{stats.activity.map(item => <li key={item.id}><span className="db-activity-dot" /><div><strong>{actionLabels[item.action] || 'Cập nhật quản trị'}</strong><p>{item.actor?.name || 'Quản trị viên'}{!actionLabels[item.action] && <span> · {item.action}</span>}</p></div><time dateTime={item.createdAt}>{date(item.createdAt, true)}</time></li>)}</ol>
      </Panel><aside className="db-directory"><span className="db-eyebrow">QUẢN LÝ HỆ THỐNG</span><h2>Không gian quản trị</h2><p>Truy cập nhanh các khu vực dành cho quản trị viên.</p><Link to="/admin/users"><AdminIcon name="users" size={20} /><span>Khách hàng<strong>{n(stats.overview.customers)} tài khoản</strong></span><AdminIcon name="arrow-right" size={16} /></Link><Link to="/admin/products"><AdminIcon name="products" size={20} /><span>Danh mục sản phẩm<strong>{n(stats.overview.products)} đang bán</strong></span><AdminIcon name="arrow-right" size={16} /></Link><Link to="/admin/user-images"><AdminIcon name="images" size={20} /><span>Kiểm duyệt ảnh khách hàng</span><AdminIcon name="arrow-right" size={16} /></Link><Link to="/admin/redeem"><AdminIcon name="redeem" size={20} /><span>Quản lý mã kích hoạt</span><AdminIcon name="arrow-right" size={16} /></Link></aside></div>
    </>}
  </div>;
}
