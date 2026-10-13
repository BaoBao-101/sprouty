import { confirmAction } from '@/services/dialog';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FilterPills,
  Modal,
  PageHeader,
  Pagination,
  Panel,
  SearchBox,
  TableStates,
  Toolbar,
  type FilterOption,
  type LoadState,
} from '@/components/admin/ui';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import { productGalleryImages } from '@/services/product-images';
import {
  DELIVERED_BY_VN,
  formatOrderDate,
  ORDER_STATUS_VN,
  ORDER_STATUSES,
  shortOrderId,
  type Order,
  type OrderStatus,
} from '@/types/order';
import { formatPrice } from '@/types/product';
import { AdminIcon, type AdminIconName } from '@/components/icons/AdminIcon';
import './Orders.css';

const PAGE_SIZE = 10;

type Filter = '' | OrderStatus;

/** The steps an order goes through, for the timeline in its detail. */
const STEPS: Array<{ status: OrderStatus; label: string }> = [
  { status: 'pending', label: 'Đặt hàng' },
  { status: 'processing', label: 'Đang xử lý' },
  { status: 'shipped', label: 'Đang giao' },
  { status: 'delivered', label: 'Hoàn tất' },
];

/** "07/10" — the day and month, the way a Vietnamese reader writes them. */
function dayMonth(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function timeOf(iso: string) {
  const d = new Date(iso);
  return `${dayMonth(iso)} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0]?.[0] || '?').toUpperCase();
}

/** One line for the items: the first one, and how many more. */
function itemsLine(order: Order) {
  const [first, ...rest] = order.items;
  if (!first) return { name: '—', more: 0, image: null as string | null, vip: false };
  return {
    name: `${first.product?.name || 'Sản phẩm'} ×${first.qty}`,
    more: rest.length,
    image: first.product ? productGalleryImages(first.product)[0] || null : null,
    vip: order.items.some((i) => i.product?.category === 'membership'),
  };
}

/** Whether the money is in, said in one short line under the status. */
function PaymentLine({ order }: { order: Order }) {
  if (order.paidAt) {
    return (
      <span className={`ao-pay ${order.status === 'cancelled' ? 'is-refund' : 'is-paid'}`}>
        <i /> {order.status === 'cancelled' ? 'Đã thu tiền · đơn đã huỷ' : `Đã thu ${dayMonth(order.paidAt)}`}
      </span>
    );
  }
  if (order.status === 'cancelled') return <span className="ao-pay is-none"><i /> Không thu tiền</span>;
  return <span className="ao-pay is-unpaid"><i /> Chưa thu tiền</span>;
}

export default function Orders() {
  // The status lives in the URL so the dashboard can link straight to a queue
  // and so a reloaded page keeps showing what the user was working through.
  const [params, setParams] = useSearchParams();
  const filter = (params.get('status') || '') as Filter;
  const search = params.get('q') || '';
  const payment = params.get('payment') === 'unpaid' ? 'unpaid' : '';
  const page = Math.max(1, parseInt(params.get('page') || '1', 10));

  const [orders, setOrders] = useState<Order[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [countTotal, setCountTotal] = useState(0);
  const [unpaid, setUnpaid] = useState(0);
  const [today, setToday] = useState(0);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Order | null>(null);

  const patchParams = useCallback(
    (next: Record<string, string>) => {
      setParams((current) => {
        const merged = new URLSearchParams(current);
        for (const [key, value] of Object.entries(next)) {
          if (value) merged.set(key, value);
          else merged.delete(key);
        }
        return merged;
      });
    },
    [setParams],
  );

  const loadCounts = useCallback(() => {
    API.admin.orders
      .counts()
      .then((data: any) => {
        setCounts(data.counts || {});
        setCountTotal(data.total || 0);
        setUnpaid(data.unpaid || 0);
        setToday(data.today || 0);
      })
      .catch(() => undefined);
  }, []);

  const load = useCallback(() => {
    setState('loading');
    const query: Record<string, unknown> = { page, limit: PAGE_SIZE };
    if (filter) query.status = filter;
    if (search) query.search = search;
    if (payment) query.payment = payment;

    API.admin.orders
      .list(query)
      .then((data: any) => {
        setOrders(data.orders || []);
        setPages(data.pages || 1);
        setTotal(data.total || 0);
        setState('ready');
      })
      .catch((err: any) => {
        setError(err?.message || 'Không tải được đơn hàng.');
        setState('error');
      });
  }, [page, filter, search, payment]);

  useEffect(load, [load]);
  useEffect(loadCounts, [loadCounts]);

  function refresh() {
    load();
    loadCounts();
  }

  async function markPaid(order: Order) {
    if (
      !await confirmAction(
        `Ghi nhận đã thu ${formatPrice(order.total)} cho đơn #${shortOrderId(order.id)}?\n\n` +
          'Chỉ dùng khi bạn đã kiểm tra tiền thực sự về tài khoản. ' +
          'Đơn sẽ chuyển sang Đang xử lý và mã kích hoạt được phát cho khách.',
        { title: 'Xác nhận đã thu tiền', confirmLabel: 'Đã thu tiền' },
      )
    )
      return;

    setBusyId(order.id);
    try {
      const { message } = await API.admin.orders.markPaid(order.id);
      showToast(message || 'Đã ghi nhận thanh toán', 'success');
      setDetail(null);
      refresh();
    } catch (err: any) {
      showToast(err?.message || 'Không ghi nhận được', 'error');
    } finally {
      setBusyId(null);
    }
  }

  const filters: Array<FilterOption<Filter>> = [
    { value: '', label: 'Tất cả', count: countTotal },
    ...ORDER_STATUSES.map((s) => ({
      value: s as Filter,
      label: ORDER_STATUS_VN[s],
      count: counts[s] ?? 0,
    })),
  ];

  // The four queues worth a glance before the table. Each is a shortcut to
  // its filter; today's count is information only.
  const kpis: Array<{
    key: string;
    icon: AdminIconName;
    tone: string;
    value: number;
    label: string;
    hint: string;
    active: boolean;
    onClick?: () => void;
  }> = [
    {
      key: 'pending',
      icon: 'inbox',
      tone: 'amber',
      value: counts.pending ?? 0,
      label: 'Chờ xác nhận',
      hint: 'Đơn mới, chưa xử lý',
      active: filter === 'pending' && !payment,
      onClick: () => patchParams({ status: 'pending', payment: '', page: '' }),
    },
    {
      key: 'unpaid',
      icon: 'card',
      tone: 'rose',
      value: unpaid,
      label: 'Chưa thu tiền',
      hint: 'Cần đối soát chuyển khoản',
      active: payment === 'unpaid',
      onClick: () => patchParams({ payment: 'unpaid', status: '', page: '' }),
    },
    {
      key: 'processing',
      icon: 'truck',
      tone: 'blue',
      value: counts.processing ?? 0,
      label: 'Đang xử lý',
      hint: 'Nhân viên đang chuẩn bị',
      active: filter === 'processing' && !payment,
      onClick: () => patchParams({ status: 'processing', payment: '', page: '' }),
    },
    {
      key: 'today',
      icon: 'calendar',
      tone: 'green',
      value: today,
      label: 'Đơn hôm nay',
      hint: `${countTotal} đơn từ trước tới nay`,
      active: false,
    },
  ];

  const filtered = Boolean(search || filter || payment);

  return (
    <>
      <PageHeader
        title="Giám sát đơn hàng"
        subtitle="Theo dõi đơn và đối soát tiền về; nhân viên lo phần xử lý, giao hàng"
        actions={
          <button className="btn btn-ghost btn-sm" onClick={refresh} disabled={state === 'loading'}>
            <AdminIcon name="refresh" size={16} /> Làm mới
          </button>
        }
      />

      <div className="ax-kpis">
        {kpis.map((k) =>
          k.onClick ? (
            <button
              type="button"
              key={k.key}
              className={`ax-kpi tone-${k.tone}${k.active ? ' is-active' : ''}`}
              aria-pressed={k.active}
              onClick={k.onClick}
            >
              <span className="ax-kpi-icon"><AdminIcon name={k.icon} size={18} /></span>
              <span className="ax-kpi-body">
                <b>{k.value}</b>
                <strong>{k.label}</strong>
                <em>{k.hint}</em>
              </span>
            </button>
          ) : (
            <div key={k.key} className={`ax-kpi tone-${k.tone} is-static`}>
              <span className="ax-kpi-icon"><AdminIcon name={k.icon} size={18} /></span>
              <span className="ax-kpi-body">
                <b>{k.value}</b>
                <strong>{k.label}</strong>
                <em>{k.hint}</em>
              </span>
            </div>
          ),
        )}
      </div>

      <Toolbar>
        <FilterPills
          options={filters}
          value={payment ? ('' as Filter) : filter}
          onChange={(next) => patchParams({ status: next, payment: '', page: '' })}
        />
        <SearchBox
          value={search}
          placeholder="Tìm theo tên, SĐT, email…"
          onChange={(next) => patchParams({ q: next, page: '' })}
        />
      </Toolbar>

      {payment && (
        <div className="ao-filter-note">
          <AdminIcon name="filter" size={15} />
          Đang xem đơn <b>chưa thu tiền</b> (không tính đơn đã huỷ).
          <button className="ao-link" onClick={() => patchParams({ payment: '', page: '' })}>Bỏ lọc</button>
        </div>
      )}

      <Panel flush>
        <table className="admin-table ao-table">
          <thead>
            <tr>
              <th>Đơn</th>
              <th>Khách hàng</th>
              <th>Sản phẩm</th>
              <th className="ao-right">Tổng tiền</th>
              <th>Trạng thái</th>
              <th aria-label="Thao tác" />
            </tr>
          </thead>
          <tbody>
            <TableStates
              state={state}
              error={error}
              isEmpty={orders.length === 0}
              columns={6}
              emptyIcon={<AdminIcon name="orders" size={24} />}
              emptyTitle={filtered ? 'Không tìm thấy đơn nào' : 'Chưa có đơn hàng'}
              emptyHint={filtered ? 'Thử bỏ bớt bộ lọc hoặc đổi từ khoá tìm kiếm.' : 'Đơn hàng của khách sẽ xuất hiện ở đây.'}
              onRetry={load}
            />
            {state === 'ready' &&
              orders.map((order) => {
                const line = itemsLine(order);
                const canMarkPaid = !order.paidAt && order.status !== 'cancelled';
                return (
                  <tr
                    key={order.id}
                    className={`ad-row-click${busyId === order.id ? ' row-busy' : ''}`}
                    onClick={() => setDetail(order)}
                  >
                    <td>
                      <div className="ao-id">#{shortOrderId(order.id)}</div>
                      <div className="ao-sub">{timeOf(order.createdAt)}</div>
                    </td>
                    <td>
                      <div className="ao-customer">
                        <span className="ao-avatar" aria-hidden="true">{initials(order.shippingName || '?')}</span>
                        <span>
                          <span className="ao-main">{order.shippingName}</span>
                          <span className="ao-sub">{order.shippingPhone}</span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="ao-items">
                        <span className="ao-thumb" aria-hidden="true">
                          {line.image ? <img src={line.image} alt="" /> : <AdminIcon name="seed" size={16} />}
                        </span>
                        <span>
                          <span className="ao-main">
                            {line.name}
                            {line.vip && <span className="ao-vip">VIP</span>}
                          </span>
                          {line.more > 0 && <span className="ao-sub">+{line.more} sản phẩm khác</span>}
                        </span>
                      </div>
                    </td>
                    <td className="ao-right ao-total">{formatPrice(order.total)}</td>
                    <td>
                      <span className={`ao-status is-${order.status}`}><i />{ORDER_STATUS_VN[order.status]}</span>
                      <PaymentLine order={order} />
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="ao-actions">
                        {/* A payment that did not come through the webhook —
                            a mistyped reference, cash, an account SePay does
                            not watch. Without it the order never issues its
                            activation codes. */}
                        {canMarkPaid && (
                          <button
                            type="button"
                            className="ao-btn is-primary"
                            disabled={busyId === order.id}
                            onClick={() => markPaid(order)}
                          >
                            <AdminIcon name="check" size={14} /> Đã thu tiền
                          </button>
                        )}
                        <button type="button" className="ao-btn is-icon" aria-label="Xem chi tiết" title="Xem chi tiết" onClick={() => setDetail(order)}>
                          <AdminIcon name="chevron-right" size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </Panel>

      <Pagination
        page={page}
        pages={pages}
        total={total}
        unit="đơn"
        onChange={(next) => patchParams({ page: String(next) })}
      />

      {detail && (
        <Modal
          title={`Đơn #${shortOrderId(detail.id)}`}
          subtitle={`Đặt lúc ${formatOrderDate(detail.createdAt)}`}
          onClose={() => setDetail(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setDetail(null)}>Đóng</button>
              {!detail.paidAt && detail.status !== 'cancelled' && (
                <button className="btn btn-primary" disabled={busyId === detail.id} onClick={() => markPaid(detail)}>
                  <AdminIcon name="check" size={16} /> Xác nhận đã thu tiền
                </button>
              )}
            </>
          }
        >
          <div className="ao-detail-head">
            <div>
              <span className={`ao-status is-${detail.status}`}><i />{ORDER_STATUS_VN[detail.status]}</span>
              <PaymentLine order={detail} />
            </div>
            <div className="ao-detail-total">
              <span>Tổng tiền</span>
              <b>{formatPrice(detail.total)}</b>
            </div>
          </div>

          {/* Where the order is, as steps. A cancelled order says so instead. */}
          {detail.status === 'cancelled' ? (
            <div className="ao-cancelled"><AdminIcon name="alert" size={16} /> Đơn này đã bị huỷ.</div>
          ) : (
            <ol className="ao-steps">
              {STEPS.map((step, i) => {
                const at = STEPS.findIndex((s) => s.status === detail.status);
                const done = i <= at;
                return (
                  <li key={step.status} className={`${done ? 'is-done' : ''}${i === at ? ' is-current' : ''}`}>
                    <span className="ao-step-dot">{done ? <AdminIcon name="check" size={12} /> : i + 1}</span>
                    <span className="ao-step-label">{step.label}</span>
                  </li>
                );
              })}
            </ol>
          )}

          <div className="ao-detail-grid">
            <section className="ao-card">
              <h3><AdminIcon name="user" size={15} /> Người nhận</h3>
              <p className="ao-main">{detail.shippingName}</p>
              <p><a href={`tel:${detail.shippingPhone}`}>{detail.shippingPhone}</a></p>
              <p className="ao-sub">{detail.shippingAddress || 'Không có địa chỉ giao — đơn chỉ có mã kích hoạt.'}</p>
            </section>
            <section className="ao-card">
              <h3><AdminIcon name="card" size={15} /> Thanh toán</h3>
              <p className="ao-main">{formatPrice(detail.total)}</p>
              <p>{detail.paidAt ? `Đã thu lúc ${formatOrderDate(detail.paidAt)}` : 'Chưa ghi nhận tiền về'}</p>
              <p className="ao-sub">{detail.items.reduce((n, i) => n + i.qty, 0)} sản phẩm</p>
            </section>
          </div>

          {(detail.shippedAt || detail.carrier || detail.deliveredAt) && (
            <section className="ao-card ao-parcel">
              <h3><AdminIcon name="truck" size={15} /> Vận chuyển</h3>
              <p className="ao-main">
                {detail.carrier || 'Chưa ghi đơn vị'}
                {detail.trackingCode && <> · <code>{detail.trackingCode}</code></>}
              </p>
              {detail.shippedAt && <p>Gửi lúc {formatOrderDate(detail.shippedAt)}</p>}
              {detail.deliveredAt && (
                <p className="ao-sub">
                  Đã nhận lúc {formatOrderDate(detail.deliveredAt)}
                  {detail.deliveredBy && <> · {DELIVERED_BY_VN[detail.deliveredBy]}</>}
                </p>
              )}
            </section>
          )}

          {detail.note && (
            <section className="ao-card ao-note">
              <h3><AdminIcon name="info" size={15} /> Ghi chú của khách</h3>
              <p>{detail.note}</p>
            </section>
          )}

          <h3 className="ao-section">Sản phẩm</h3>
          <ul className="ao-lines">
            {detail.items.map((item, i) => {
              const image = item.product ? productGalleryImages(item.product)[0] : null;
              return (
                <li key={i}>
                  <span className="ao-thumb" aria-hidden="true">
                    {image ? <img src={image} alt="" /> : <AdminIcon name="seed" size={16} />}
                  </span>
                  <span className="ao-line-name">
                    <span className="ao-main">{item.product?.name || 'Sản phẩm'}</span>
                    <span className="ao-sub">
                      {item.qty} × {formatPrice(item.unitPrice)}
                      {item.variant === 'smart' ? ' · bản Smart' : ''}
                    </span>
                  </span>
                  <b>{formatPrice(item.qty * item.unitPrice)}</b>
                </li>
              );
            })}
          </ul>

          <p className="ao-foot-note">Nhân viên phụ trách cập nhật tiến độ giao hàng; quản trị viên giám sát và đối soát thanh toán.</p>
        </Modal>
      )}
    </>
  );
}
