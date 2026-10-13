import { useCallback, useEffect, useState } from 'react';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import { confirmAction } from '@/services/dialog';
import { productGalleryImages } from '@/services/product-images';
import { Modal, PageHeader, Pagination, SearchBox } from '@/components/admin/ui';
import { AdminIcon, type AdminIconName } from '@/components/icons/AdminIcon';
import {
  allowedOrderTransitions,
  CARRIERS,
  DELIVERED_BY_VN,
  isVipOrder,
  ORDER_STATUS_VN,
  shortOrderId,
  type Order,
  type OrderStatus,
} from '@/types/order';
import { formatPrice } from '@/types/product';
import './Orders.css';

const PAGE_SIZE = 10;

type Tab = 'processing' | 'shipped' | 'pending' | 'delivered' | 'cancelled' | '';

const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'processing', label: 'Cần chuẩn bị' },
  { value: 'shipped', label: 'Đang giao' },
  { value: 'pending', label: 'Chờ thanh toán' },
  { value: 'delivered', label: 'Hoàn tất' },
  { value: 'cancelled', label: 'Đã huỷ' },
  { value: '', label: 'Tất cả' },
];

interface Counts {
  counts: Record<OrderStatus, number>;
  total: number;
  unpaid: number;
  today: number;
}

const when = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())} · ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
};

/** Whole days an order has been waiting, for "chờ 2 ngày". */
const daysWaiting = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

function copy(text: string, what: string) {
  navigator.clipboard?.writeText(text).then(
    () => showToast(`Đã sao chép ${what}`, 'success'),
    () => showToast('Không sao chép được', 'error'),
  );
}

/**
 * The one next step for an order, worded as what the employee just did.
 * The server decides which steps are open (see services/order-policy.js);
 * this only names them.
 */
function stepFor(order: Order, next: OrderStatus): { label: string; icon: AdminIconName; confirm: string; tone: 'primary' | 'danger' } {
  const code = `#${shortOrderId(order.id)}`;
  if (next === 'shipped') {
    return {
      label: 'Giao cho vận chuyển',
      icon: 'truck',
      confirm: `Đơn ${code} đã đóng gói và giao cho đơn vị vận chuyển?\n\nKhách sẽ thấy đơn ở trạng thái “Đang giao”.`,
      tone: 'primary',
    };
  }
  if (next === 'delivered') {
    return order.status === 'shipped'
      ? { label: 'Khách đã nhận hàng', icon: 'check', confirm: `Xác nhận khách đã nhận đơn ${code}?`, tone: 'primary' }
      : {
          label: 'Hoàn tất đơn',
          icon: 'check',
          confirm: `Đơn ${code} không có gì để gửi (${isVipOrder(order) ? 'gói VIP' : 'mã kích hoạt'} đã có trên tài khoản khách). Đánh dấu hoàn tất?`,
          tone: 'primary',
        };
  }
  if (next === 'processing') {
    return { label: 'Bắt đầu chuẩn bị', icon: 'orders', confirm: `Chuyển đơn ${code} sang “Đang xử lý”?`, tone: 'primary' };
  }
  return {
    label: 'Huỷ đơn',
    icon: 'close',
    confirm: `Huỷ đơn chưa thanh toán ${code}?\n\nChỉ huỷ khi khách báo không mua nữa. Nếu khách nói đã chuyển khoản, đừng huỷ — báo quản trị viên đối soát.`,
    tone: 'danger',
  };
}

function OrderCard({ order, busy, onStep }: { order: Order; busy: boolean; onStep: (order: Order, next: OrderStatus) => void }) {
  const next = allowedOrderTransitions(order);
  const vip = isVipOrder(order);
  const paid = Boolean(order.paidAt);
  const waiting = daysWaiting(order.createdAt);
  const slow = (order.status === 'processing' && waiting >= 2) || (order.status === 'shipped' && waiting >= 5);
  const units = order.items.reduce((n, i) => n + i.qty, 0);
  const address = (order.shippingAddress || '').trim();
  const realAddress = address && !address.startsWith('Không áp dụng') && !address.startsWith('Cấp bởi admin');
  const showAddress = order.needsShipping !== false && realAddress;
  // A parcel with no address: placed while kits were still treated as digital.
  const noAddress = order.needsShipping === true && !realAddress;

  return (
    <article className={`eo-card s-${order.status}${slow ? ' is-slow' : ''}`}>
      <header className="eo-head">
        <div className="eo-id">
          <code>#{shortOrderId(order.id)}</code>
          <span>{when(order.createdAt)}</span>
          {slow && <em className="eo-slow"><AdminIcon name="clock" size={12} /> Chờ {waiting} ngày</em>}
        </div>
        <div className="eo-pills">
          <span className={`eo-status s-${order.status}`}>{ORDER_STATUS_VN[order.status]}</span>
          {order.status !== 'cancelled' && (
            <span className={`eo-pay ${paid ? 'is-paid' : 'is-unpaid'}`}>
              <i />{paid ? 'Đã thanh toán' : 'Chưa thanh toán'}
            </span>
          )}
        </div>
      </header>

      <div className="eo-body">
        <section className="eo-who" aria-label="Người nhận">
          <span className="eo-label">Người nhận</span>
          <strong>{order.shippingName || '—'}</strong>
          {order.shippingPhone && (
            <span className="eo-line">
              <a href={`tel:${order.shippingPhone}`}>{order.shippingPhone}</a>
              <button type="button" className="eo-copy" onClick={() => copy(order.shippingPhone, 'số điện thoại')} aria-label="Sao chép số điện thoại">
                <AdminIcon name="copy" size={13} />
              </button>
            </span>
          )}
          {showAddress ? (
            <span className="eo-address">
              <span>{address}</span>
              <button type="button" className="eo-copy" onClick={() => copy(`${order.shippingName}, ${order.shippingPhone}, ${address}`, 'địa chỉ giao')} aria-label="Sao chép địa chỉ">
                <AdminIcon name="copy" size={13} />
              </button>
            </span>
          ) : noAddress ? (
            <span className="eo-digital is-missing">
              <AdminIcon name="alert" size={13} />
              Chưa có địa chỉ giao — gọi khách hỏi địa chỉ trước khi gửi
            </span>
          ) : (
            <span className="eo-digital">
              <AdminIcon name="info" size={13} />
              {vip ? 'Gói VIP — không cần giao' : 'Sản phẩm số — mã kích hoạt đã có trên tài khoản khách'}
            </span>
          )}
        </section>

        {(order.carrier || order.trackingCode || order.shippedAt) && (
          <section className="eo-parcel" aria-label="Vận chuyển">
            <span className="eo-label">Vận chuyển</span>
            <span className="eo-parcel-line">
              <AdminIcon name="truck" size={14} />
              <b>{order.carrier || 'Chưa ghi đơn vị'}</b>
              {order.trackingCode && (
                <>
                  <code>{order.trackingCode}</code>
                  <button type="button" className="eo-copy" onClick={() => copy(order.trackingCode!, 'mã vận đơn')} aria-label="Sao chép mã vận đơn">
                    <AdminIcon name="copy" size={13} />
                  </button>
                </>
              )}
            </span>
            {order.shippedAt && <span className="eo-parcel-when">Gửi lúc {when(order.shippedAt)}</span>}
          </section>
        )}

        <section className="eo-items" aria-label="Sản phẩm">
          <span className="eo-label">Sản phẩm ({units})</span>
          <ul>
            {order.items.map((item, i) => {
              const img = item.product ? productGalleryImages(item.product)[0] : undefined;
              return (
                <li key={i}>
                  <span className="eo-thumb">
                    {vip ? <AdminIcon name="star" size={16} /> : img ? <img src={img} alt="" loading="lazy" /> : <AdminIcon name="products" size={16} />}
                  </span>
                  <span className="eo-item-name">{item.product?.name || 'Sản phẩm'}{item.variant === 'smart' && <em>Smart</em>}</span>
                  <b>× {item.qty}</b>
                </li>
              );
            })}
          </ul>
          {order.note && (
            <p className="eo-note"><AdminIcon name="info" size={13} /> <span><b>Khách ghi:</b> {order.note}</span></p>
          )}
        </section>

        <section className="eo-act" aria-label="Thao tác">
          <span className="eo-total">
            <em>Tổng</em>
            <strong>{formatPrice(order.total)}</strong>
          </span>
          {next.length > 0 ? (
            <div className="eo-buttons">
              {next.map((status) => {
                const step = stepFor(order, status);
                return (
                  <button
                    key={status}
                    type="button"
                    className={`eo-btn is-${step.tone}`}
                    disabled={busy}
                    onClick={() => onStep(order, status)}
                  >
                    <AdminIcon name={step.icon} size={15} />
                    {busy ? 'Đang lưu…' : step.label}
                  </button>
                );
              })}
            </div>
          ) : null}
          {order.status === 'pending' && !paid && (
            <span className="eo-hint">Chờ khách chuyển khoản. Quản trị viên đối soát khi tiền về.</span>
          )}
          {order.status === 'shipped' && (
            <span className="eo-hint">Khách tự bấm “Đã nhận được hàng” được. Không ai xác nhận thì đơn tự hoàn tất sau 7 ngày kể từ lúc gửi.</span>
          )}
          {order.status === 'delivered' && (
            <span className="eo-hint is-done">
              <AdminIcon name="check" size={13} />
              {order.deliveredBy ? DELIVERED_BY_VN[order.deliveredBy] : 'Đơn đã xong'}
              {order.deliveredAt ? ` · ${when(order.deliveredAt)}` : ''}
            </span>
          )}
        </section>
      </div>
    </article>
  );
}

/**
 * Đơn hàng — the employee's queue.
 *
 * Opens on the work waiting: paid orders to prepare, newest first, each with
 * who it goes to, what is in it and the one button for the step just done.
 * The old page was a table of every order with a status dropdown on each row,
 * newest first: the work was buried under finished orders, the address was
 * not on screen at all, and the dropdown made "đã giao" one slip away from
 * "đã huỷ". Money is not handled here — reconciling payments is the admin's.
 */
export default function EmployeeOrders() {
  const [tab, setTab] = useState<Tab>('processing');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [orders, setOrders] = useState<Order[]>([]);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [counts, setCounts] = useState<Counts | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // "Giao cho vận chuyển" asks who carries it and the tracking code.
  const [shipping, setShipping] = useState<Order | null>(null);
  const [carrier, setCarrier] = useState(CARRIERS[0]);
  const [tracking, setTracking] = useState('');

  const loadCounts = useCallback(() => {
    API.admin.orders.counts().then(setCounts).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setState('loading');
    const params: Record<string, unknown> = { page, limit: PAGE_SIZE };
    if (tab) params.status = tab;
    if (search) params.search = search;
    // Newest first in every tab; an order kept waiting is flagged "Chờ N ngày"
    // on its card instead, so it is not lost at the bottom.
    API.admin.orders
      .list(params)
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
  }, [page, tab, search]);

  useEffect(load, [load]);
  useEffect(loadCounts, [loadCounts]);

  function pick(next: Tab) {
    setTab(next);
    setPage(1);
  }

  async function step(order: Order, next: OrderStatus, parcel?: { carrier: string; trackingCode: string }) {
    if (next === 'shipped' && !parcel) {
      setShipping(order);
      setTracking('');
      // The customer may have corrected the address since the queue loaded;
      // the label is written from what it says now.
      API.admin.orders
        .list({ search: order.id, limit: 1 })
        .then((data: any) => {
          const fresh = (data.orders || []).find((o: Order) => o.id === order.id);
          if (fresh) setShipping((open) => (open?.id === fresh.id ? fresh : open));
        })
        .catch(() => {});
      return;
    }
    const plan = stepFor(order, next);
    if (!parcel && !(await confirmAction(plan.confirm, { confirmLabel: plan.label, danger: plan.tone === 'danger' }))) return;
    setBusyId(order.id);
    try {
      await API.admin.orders.updateStatus(order.id, next, parcel || {});
      setShipping(null);
      showToast(`#${shortOrderId(order.id)}: ${ORDER_STATUS_VN[next]}`, 'success');
      load();
      loadCounts();
    } catch (err: any) {
      showToast(err?.message || 'Không cập nhật được đơn.', 'error');
      load();
    } finally {
      setBusyId(null);
    }
  }

  const n = (status: OrderStatus) => counts?.counts?.[status] ?? 0;
  const kpis: Array<{ tab: Tab; icon: AdminIconName; tone: string; value: number; label: string; hint: string }> = [
    { tab: 'processing', icon: 'orders', tone: 'green', value: n('processing'), label: 'Cần chuẩn bị', hint: 'Đã thanh toán, chờ gửi' },
    { tab: 'shipped', icon: 'truck', tone: 'blue', value: n('shipped'), label: 'Đang giao', hint: 'Chờ khách nhận' },
    { tab: 'pending', icon: 'clock', tone: 'amber', value: n('pending'), label: 'Chờ thanh toán', hint: 'Khách chưa chuyển khoản' },
    { tab: '', icon: 'calendar', tone: 'rose', value: counts?.today ?? 0, label: 'Đơn mới hôm nay', hint: `Tổng ${counts?.total ?? 0} đơn` },
  ];

  const empty: Record<string, string> = {
    processing: 'Không còn đơn nào cần chuẩn bị.',
    shipped: 'Không có đơn nào đang trên đường.',
    pending: 'Không có đơn nào chờ thanh toán.',
    delivered: 'Chưa có đơn hoàn tất.',
    cancelled: 'Không có đơn bị huỷ.',
    '': 'Chưa có đơn hàng nào.',
  };

  return (
    <div className="eo">
      <PageHeader
        title="Đơn hàng"
        subtitle="Chuẩn bị và giao các đơn đã thanh toán, đơn mới nhất ở trên. Đối soát tiền do quản trị viên làm."
        actions={
          <button className="btn btn-ghost btn-sm" onClick={() => { load(); loadCounts(); }} disabled={state === 'loading'}>
            <AdminIcon name="refresh" size={16} /> Làm mới
          </button>
        }
      />

      <div className="ax-kpis">
        {kpis.map((k) => (
          <button
            type="button"
            key={k.label}
            className={`ax-kpi tone-${k.tone}${tab === k.tab && k.tab !== '' ? ' is-active' : ''}`}
            aria-pressed={tab === k.tab}
            onClick={() => pick(k.tab)}
          >
            <span className="ax-kpi-icon"><AdminIcon name={k.icon} size={18} /></span>
            <span className="ax-kpi-body">
              <b>{counts ? k.value.toLocaleString('vi-VN') : '—'}</b>
              <strong>{k.label}</strong>
              <em>{k.hint}</em>
            </span>
          </button>
        ))}
      </div>

      <div className="eo-toolbar">
        <div className="eo-tabs" role="tablist" aria-label="Lọc đơn">
          {TABS.map((t) => (
            <button
              key={t.value || 'all'}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              className={`eo-tab${tab === t.value ? ' is-on' : ''}`}
              onClick={() => pick(t.value)}
            >
              {t.label}
              <em>{counts ? (t.value ? n(t.value) : counts.total) : '·'}</em>
            </button>
          ))}
        </div>
        <SearchBox value={search} placeholder="Tìm mã đơn, tên, số điện thoại…" onChange={(next) => { setSearch(next); setPage(1); }} />
      </div>

      {state === 'error' && (
        <div className="eo-error" role="alert">
          {error}
          <button type="button" className="btn btn-ghost btn-sm" onClick={load}>Thử lại</button>
        </div>
      )}

      {state === 'loading' && orders.length === 0 && (
        <div className="eo-list" aria-hidden="true">
          {[0, 1, 2].map((i) => <div className="eo-card is-skeleton" key={i}><span /><span /><span /></div>)}
        </div>
      )}

      {state === 'ready' && orders.length === 0 && (
        <div className="eo-empty">
          <span><AdminIcon name="check" size={26} /></span>
          <h3>{search ? 'Không tìm thấy đơn nào' : empty[tab]}</h3>
          <p>{search ? 'Thử mã đơn, tên hoặc số điện thoại khác.' : tab === 'processing' ? 'Đơn mới sẽ hiện ở đây ngay khi khách thanh toán xong.' : 'Chọn mục khác ở trên để xem.'}</p>
        </div>
      )}

      {orders.length > 0 && (
        <div className={`eo-list${state === 'loading' ? ' is-loading' : ''}`}>
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} busy={busyId === order.id} onStep={step} />
          ))}
        </div>
      )}

      <Pagination page={page} pages={pages} total={total} unit="đơn" onChange={setPage} />

      {shipping && (
        <Modal
          title={`Giao đơn #${shortOrderId(shipping.id)}`}
          subtitle={`${shipping.shippingName} · ${shipping.shippingPhone}`}
          width={480}
          onClose={() => setShipping(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setShipping(null)}>Huỷ</button>
              <button
                className="btn btn-primary"
                disabled={busyId === shipping.id}
                onClick={() => step(shipping, 'shipped', { carrier, trackingCode: tracking.trim() })}
              >
                <AdminIcon name="truck" size={16} /> {busyId === shipping.id ? 'Đang lưu…' : 'Đã giao cho vận chuyển'}
              </button>
            </>
          }
        >
          <div className="eo-ship">
            <p className="eo-ship-address">
              <AdminIcon name="pin" size={15} />
              <span>{shipping.shippingAddress}</span>
            </p>
            <label className="field">
              <span className="field-label">Đơn vị vận chuyển</span>
              <select className="form-input" value={carrier} onChange={(e) => setCarrier(e.target.value)}>
                {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Mã vận đơn <em className="eo-optional">(nếu có)</em></span>
              <input
                className="form-input"
                value={tracking}
                maxLength={60}
                placeholder="VD: GHN123456789"
                onChange={(e) => setTracking(e.target.value.toUpperCase())}
              />
              <span className="field-hint">Khách thấy mã này ở “Đơn hàng của tôi” để tự tra cứu.</span>
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}
