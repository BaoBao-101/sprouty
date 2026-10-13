import { confirmAction } from '@/services/dialog';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import { productGalleryImages } from '@/services/product-images';
import { SproutyIcon, type IconName } from '@/components/icons/SproutyIcon';
import { Pager } from '@/components/Pager';
import {
  DELIVERED_BY_VN,
  formatOrderDate,
  isVipOrder,
  ORDER_STATUS_VN,
  shortOrderId,
  type Order,
  type RedeemCode,
} from '@/types/order';
import { formatPrice } from '@/types/product';
import {
  AddressFields,
  joinAddress,
  missingAddressField,
  splitAddress,
  type AddressParts,
} from '@/components/AddressFields';
import './Account.css';

/** Placeholders stored where an order had no address to give. */
const realAddressOf = (order: Order) => {
  const value = (order.shippingAddress || '').trim();
  return value && !value.startsWith('Không áp dụng') && !value.startsWith('Cấp bởi admin') ? value : '';
};

/**
 * Who receives the kit, and where — correctable until the box is sent.
 * Mostly for an order placed before kits were posted (it has no address at
 * all) or a typo spotted after paying.
 */
function AddressDialog({ order, onClose, onSaved }: { order: Order; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(order.shippingName || '');
  const [phone, setPhone] = useState(order.shippingPhone || '');
  const [address, setAddress] = useState<AddressParts>(() => splitAddress(realAddressOf(order)));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [busy, onClose]);

  async function save() {
    if (name.trim().length < 2) return setError('Nhập họ tên người nhận.');
    if (!/^[0-9]{9,11}$/.test(phone.trim())) return setError('Số điện thoại gồm 9–11 chữ số.');
    const missing = missingAddressField(address);
    if (missing) return setError(missing);
    setBusy(true);
    try {
      const { message } = await API.orders.updateShipping(order.id, {
        shippingName: name.trim(),
        shippingPhone: phone.trim(),
        shippingAddress: joinAddress(address),
      });
      showToast(message || 'Đã cập nhật địa chỉ giao', 'success');
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Chưa lưu được. Vui lòng thử lại.');
      setBusy(false);
    }
  }

  return (
    <div className="od-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="od-modal" role="dialog" aria-modal="true" aria-labelledby="od-addr-title">
        <header className="od-modal-head">
          <div>
            <span>Đơn #{shortOrderId(order.id)}</span>
            <h2 id="od-addr-title">Địa chỉ giao hộp kit</h2>
          </div>
          <button type="button" className="od-btn is-icon" onClick={onClose} aria-label="Đóng" disabled={busy}>
            <SproutyIcon name="close" size={16} />
          </button>
        </header>
        <div className="od-modal-body">
          <div className="od-modal-grid">
            <label className="form-group">
              <span className="form-label">Họ tên *</span>
              <input className="form-input" value={name} autoComplete="name" onChange={(e) => { setName(e.target.value); setError(''); }} />
            </label>
            <label className="form-group">
              <span className="form-label">Số điện thoại *</span>
              <input
                className="form-input"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 11)); setError(''); }}
              />
            </label>
          </div>
          <AddressFields value={address} onChange={(next) => { setAddress(next); setError(''); }} />
          {error && <div className="form-error" role="alert">{error}</div>}
          <p className="od-modal-note">Sửa được cho tới lúc Sprouty gửi hộp đi.</p>
        </div>
        <footer className="od-modal-foot">
          <button type="button" className="od-btn" onClick={onClose} disabled={busy}>Huỷ</button>
          <button type="button" className="od-btn is-pay" onClick={save} disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu địa chỉ'}</button>
        </footer>
      </div>
    </div>
  );
}

/**
 * What happens to an order, now that nothing is posted.
 *
 * The old tracker ran "Chờ thanh toán → Đang xử lý → Đang giao → Đã giao",
 * which promised a courier for a product that is a code on a screen. These are
 * the three things that actually happen, and the last one is a link rather than
 * a milestone we wait to observe — activating is the customer's move to make.
 */
const TRACK_STEPS: Array<{ key: string; label: string; icon: IconName }> = [
  { key: 'placed', label: 'Đặt hàng', icon: 'cart' },
  { key: 'paid', label: 'Thanh toán', icon: 'ticket' },
  { key: 'activate', label: 'Kích hoạt cây', icon: 'sprout' },
];

/** A VIP order has no step after paying: the payment is the upgrade. */
const VIP_TRACK_STEPS: Array<{ key: string; label: string; icon: IconName }> = [
  { key: 'placed', label: 'Đặt gói', icon: 'cart' },
  { key: 'paid', label: 'Thanh toán', icon: 'ticket' },
  { key: 'vip', label: 'Lên VIP', icon: 'star' },
];

/**
 * A kit that is posted: the code arrives the moment it is paid (the 3D plant
 * can be sown straight away), and the box with the seeds follows by post. The
 * order is finished when the box arrives, not when the money does.
 */
const PARCEL_STEPS: Array<{ key: string; label: string; icon: IconName }> = [
  { key: 'placed', label: 'Đặt hàng', icon: 'cart' },
  { key: 'paid', label: 'Thanh toán', icon: 'ticket' },
  { key: 'packing', label: 'Chuẩn bị', icon: 'gift' },
  { key: 'shipping', label: 'Đang giao', icon: 'arrow-right' },
  { key: 'received', label: 'Đã nhận', icon: 'home' },
];

const FILTERS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Tất cả' },
  { value: 'pending', label: 'Chờ thanh toán' },
  { value: 'processing', label: 'Đang chuẩn bị' },
  { value: 'shipped', label: 'Đang giao' },
  { value: 'delivered', label: 'Hoàn tất' },
  { value: 'cancelled', label: 'Đã huỷ' },
];

/** How far an order has come: 1 placed, 2 paid, 3 activated (or VIP on). */
function progressOf(order: Order) {
  const paid = Boolean(order.paidAt);
  const codes = order.redeemCodes || [];
  // The last step is the customer's move, so it completes when they make
  // it. Without this it sat as "current" forever — a plant could be three
  // weeks grown and the order still showed activation as pending.
  // A VIP order has no such move: paying switched it on.
  const activated = isVipOrder(order) ? paid : codes.length > 0 && codes.every((c) => c.redeemed);
  return activated ? 3 : paid ? 2 : 1;
}

function OrderTrack({ order }: { order: Order }) {
  if (order.status === 'cancelled') return null;
  const parcel = Boolean(order.needsShipping);
  // A parcel: placed → paid → packing → on its way → received.
  const reached = parcel
    ? ({ pending: 1, processing: 2, shipped: 3, delivered: 5 } as Record<string, number>)[order.status] ?? 1
    : progressOf(order);
  const steps = parcel ? PARCEL_STEPS : isVipOrder(order) ? VIP_TRACK_STEPS : TRACK_STEPS;
  return (
    <ol className="od-track" aria-label="Tiến trình đơn hàng">
      {steps.map((step, i) => (
        <li key={step.key} className={i < reached ? 'is-done' : i === reached ? 'is-now' : ''}>
          <span className="od-track-dot">
            <SproutyIcon name={i < reached ? 'check' : step.icon} size={14} />
          </span>
          <span className="od-track-label">{step.label}</span>
        </li>
      ))}
    </ol>
  );
}

function copyCode(code: string) {
  navigator.clipboard?.writeText(code).then(
    () => showToast('Đã sao chép mã', 'success'),
    () => showToast('Không sao chép được mã', 'error'),
  );
}

/**
 * The activation codes a paid order issued.
 *
 * This is the thing the customer actually bought, so on this screen it is the
 * most prominent block in the card rather than a note below the receipt — and
 * it carries the button that turns it into a plant.
 */
function RedeemCodeList({ codes }: { codes: RedeemCode[] }) {
  if (!codes.length) return null;
  const left = codes.filter((c) => !c.redeemed).length;

  return (
    <div className="od-codes">
      <div className="od-codes-head">
        <SproutyIcon name="seed" size={16} />
        {left === 0
          ? `${codes.length} mã · đã kích hoạt hết`
          : codes.length === 1
            ? 'Mã kích hoạt'
            : `${codes.length} mã kích hoạt · còn ${left} chưa dùng`}
      </div>

      {codes.map((code) => (
        // A spent code is shown as spent. Offering "Kích hoạt" on a code that
        // has already produced a plant sends the customer to a form that can
        // only refuse them, and hides the thing they actually want — the plant.
        <div className={`od-code${code.redeemed ? ' is-used' : ''}`} key={code.code}>
          <div className="od-code-main">
            <span className="od-code-product">{code.productName || `Sản phẩm #${code.productId}`}</span>
            <code>{code.code}</code>
            {code.redeemed && (
              <span className="od-code-note">
                <SproutyIcon name="check" size={13} />
                {code.kind === 'membership' ? 'Đã kích hoạt gói thành viên' : 'Đã kích hoạt'}
                {code.plantNickname && <> thành “{code.plantNickname}”</>}
                {code.activatedAt && <> · {new Date(code.activatedAt).toLocaleDateString('vi-VN')}</>}
              </span>
            )}
          </div>
          <div className="od-code-actions">
            {code.redeemed && code.kind === 'membership' ? (
              // Nothing to open: the membership is a set of features on the
              // account, not a page.
              <Link className="od-btn" to="/vip">
                Xem quyền lợi
                <SproutyIcon name="arrow-right" size={15} />
              </Link>
            ) : code.redeemed ? (
              <Link className="od-btn" to={code.plantId ? `/plant/${code.plantId}` : '/my-plants'}>
                Xem cây
                <SproutyIcon name="arrow-right" size={15} />
              </Link>
            ) : (
              <>
                <button className="od-btn is-icon" type="button" onClick={() => copyCode(code.code)} aria-label="Sao chép mã">
                  <SproutyIcon name="copy" size={15} />
                </button>
                <Link className="od-btn is-primary" to="/my-plants">
                  Kích hoạt
                  <SproutyIcon name="arrow-right" size={15} />
                </Link>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ItemThumb({ order, item }: { order: Order; item: Order['items'][number] }) {
  const src = item.product ? productGalleryImages(item.product)[0] : undefined;
  const [failed, setFailed] = useState(false);
  if (isVipOrder(order)) {
    return <span className="od-thumb is-vip"><img src="/assets/images/sprouty-icons/VIP.png" alt="" /></span>;
  }
  return (
    <span className="od-thumb">
      {src && !failed ? <img src={src} alt="" onError={() => setFailed(true)} /> : <SproutyIcon name="pot" size={20} />}
    </span>
  );
}

function OrderCard({ order, onCancelled }: { order: Order; onCancelled: () => void }) {
  const [cancelling, setCancelling] = useState(false);
  const pending = order.status === 'pending';
  const codes = order.redeemCodes || [];
  const vip = isVipOrder(order);
  const units = order.items.reduce((n, i) => n + (i.qty || 1), 0);
  const first = order.items[0]?.product?.name || 'Sản phẩm';
  const title = order.items.length > 1 ? `${first} và ${order.items.length - 1} sản phẩm khác` : first;

  const [receiving, setReceiving] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const closeAddress = useCallback(() => setEditingAddress(false), []);
  const address = realAddressOf(order);
  const parcel = Boolean(order.needsShipping);
  // Fixable until the box is handed to the carrier.
  const addressEditable = parcel && (order.status === 'pending' || order.status === 'processing');
  async function received() {
    if (!await confirmAction('Bạn đã nhận được bộ kit? Đơn sẽ chuyển sang Hoàn tất.', { title: 'Xác nhận đã nhận hàng', confirmLabel: 'Đã nhận được hàng', danger: false })) return;
    setReceiving(true);
    try {
      const { message } = await API.orders.received(order.id);
      showToast(message || 'Đơn hàng đã hoàn tất.', 'success');
      onCancelled();
    } catch (err: any) {
      showToast(err?.message || 'Chưa xác nhận được. Vui lòng thử lại.', 'error');
      setReceiving(false);
    }
  }

  async function cancel() {
    if (!await confirmAction('Huỷ đơn hàng này? Hành động này không thể hoàn tác.', { confirmLabel: 'Huỷ đơn' })) return;
    setCancelling(true);
    try {
      await API.orders.cancel(order.id);
      onCancelled();
    } catch (err: any) {
      showToast(err?.message || 'Không thể huỷ đơn hàng. Vui lòng thử lại.', 'error');
      setCancelling(false);
    }
  }

  return (
    <article className={`od-card${pending ? ' is-pending' : ''}${order.status === 'cancelled' ? ' is-cancelled' : ''}`}>
      <header className="od-card-head">
        <div className="od-card-title">
          <h3>{title}</h3>
          <span>
            <code>#{shortOrderId(order.id)}</code>
            <i aria-hidden="true">·</i>
            {formatOrderDate(order.createdAt)}
          </span>
        </div>
        <span className={`od-status s-${order.status}`}>{ORDER_STATUS_VN[order.status]}</span>
      </header>

      <OrderTrack order={order} />

      <ul className="od-items">
        {order.items.map((item, i) => (
          <li key={i}>
            <ItemThumb order={order} item={item} />
            <span className="od-item-name">
              {item.product?.name || 'Sản phẩm'}
              {item.variant === 'smart' && <em>Bản Smart</em>}
            </span>
            <span className="od-item-qty">× {item.qty}</span>
            <span className="od-item-price">{formatPrice(item.unitPrice * item.qty)}</span>
          </li>
        ))}
      </ul>

      <RedeemCodeList codes={codes} />

      {order.needsShipping && order.status === 'processing' && (
        <p className="od-parcel is-packing">
          <SproutyIcon name="gift" size={16} />
          <span>Bộ kit đang được đóng gói để gửi tới bạn. Mã kích hoạt đã có — bé có thể gieo cây 3D ngay trong lúc chờ.</span>
        </p>
      )}
      {order.needsShipping && (order.status === 'shipped' || order.status === 'delivered') && (
        <div className={`od-parcel${order.status === 'delivered' ? ' is-done' : ''}`}>
          <SproutyIcon name={order.status === 'delivered' ? 'check' : 'arrow-right'} size={16} />
          <span>
            {order.status === 'delivered' ? (
              <>
                <b>Đã nhận hàng</b>
                {order.deliveredAt && <> · {new Date(order.deliveredAt).toLocaleDateString('vi-VN')}</>}
                {order.deliveredBy && order.deliveredBy !== 'customer' && <> · {DELIVERED_BY_VN[order.deliveredBy]}</>}
              </>
            ) : (
              <>
                <b>Đang giao</b>
                {order.carrier && <> qua {order.carrier}</>}
                {order.shippedAt && <> · gửi ngày {new Date(order.shippedAt).toLocaleDateString('vi-VN')}</>}
              </>
            )}
            {order.trackingCode && (
              <>
                {' · '}Mã vận đơn <code>{order.trackingCode}</code>
                <button type="button" className="od-parcel-copy" onClick={() => copyCode(order.trackingCode!)} aria-label="Sao chép mã vận đơn">
                  <SproutyIcon name="copy" size={14} />
                </button>
              </>
            )}
          </span>
        </div>
      )}

      <footer className="od-card-foot">
        <div className="od-foot-info">
          {vip ? (
            // Nobody to deliver to: say what the order did instead.
            <span><SproutyIcon name="star" size={14} /> {order.paidAt ? 'Đã tự động nâng cấp VIP' : 'Tự lên VIP khi thanh toán xong'}</span>
          ) : (
            <span><SproutyIcon name="user" size={14} /> {[order.shippingName, order.shippingPhone].filter(Boolean).join(' · ')}</span>
          )}
          {parcel && order.status !== 'cancelled' && (address ? (
            <span className="od-address"><SproutyIcon name="pin" size={14} /> {address}</span>
          ) : (
            <span className="od-address is-missing"><SproutyIcon name="warning" size={14} /> Chưa có địa chỉ giao — thêm để Sprouty gửi hộp kit</span>
          ))}
          {order.note && !vip && <span className="od-note"><SproutyIcon name="pencil" size={13} /> {order.note}</span>}
        </div>
        <div className="od-foot-money">
          <span>Tổng {units > 1 ? `(${units} sản phẩm)` : ''}</span>
          <strong>{formatPrice(order.total)}</strong>
        </div>
        {addressEditable && !pending && (
          <div className="od-foot-actions">
            <button className={`od-btn${address ? '' : ' is-pay'}`} onClick={() => setEditingAddress(true)}>
              <SproutyIcon name="pin" size={15} />
              {address ? 'Sửa địa chỉ' : 'Thêm địa chỉ giao'}
            </button>
          </div>
        )}
        {order.status === 'shipped' && (
          <div className="od-foot-actions">
            <button className="od-btn is-pay" onClick={received} disabled={receiving}>
              <SproutyIcon name="check" size={16} />
              {receiving ? 'Đang lưu…' : 'Đã nhận được hàng'}
            </button>
          </div>
        )}
        {pending && (
          <div className="od-foot-actions">
            <button className="od-btn is-ghost" onClick={cancel} disabled={cancelling}>
              {cancelling ? 'Đang huỷ…' : 'Huỷ đơn'}
            </button>
            {addressEditable && (
              <button className="od-btn" onClick={() => setEditingAddress(true)}>
                <SproutyIcon name="pin" size={15} />
                {address ? 'Sửa địa chỉ' : 'Thêm địa chỉ'}
              </button>
            )}
            <Link className="od-btn is-pay" to={`/payment?orderId=${encodeURIComponent(order.id)}`}>
              Thanh toán
              <SproutyIcon name="arrow-right" size={16} />
            </Link>
          </div>
        )}
      </footer>
      {editingAddress && <AddressDialog order={order} onClose={closeAddress} onSaved={onCancelled} />}
    </article>
  );
}

/**
 * Đơn hàng của tôi.
 *
 * A light header with, when there is one, the question a parent opens this
 * page with — "cái nào tôi chưa trả tiền?" — answered as a line with a button.
 * The hero used to carry three tiles, one of them "mã trang này", a count of
 * codes on the current page that meant nothing to anybody.
 */
export default function Account() {
  const { refreshUser } = useAuth();

  // The tier may have changed since the session was read — a VIP payment in
  // another tab, or a plan that ran out overnight.
  useEffect(() => {
    void refreshUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});

  // Paged on the server. A customer who has been here two years should not
  // wait for every order they ever placed to be fetched, and have a redeem
  // code checked for each one, to read the three on screen.
  const loadOrders = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = { page: String(page), limit: '5' };
    if (filter) params.status = filter;
    API.orders
      .list(params)
      .then((data: any) => {
        setOrders(data.orders || []);
        setPages(data.pages || 1);
        setTotal(data.total || 0);
        setCounts(data.counts || {});
        setError('');
      })
      .catch((err: any) => setError(err?.message || 'Không tải được đơn hàng.'))
      .finally(() => setLoading(false));
  }, [page, filter]);

  useEffect(loadOrders, [loadOrders]);

  // Changing the filter while on page 3 would ask for page 3 of a result
  // that may only have one.
  function pickFilter(next: string) {
    setFilter(next);
    setPage(1);
  }

  // Headline figures span the whole history, not the page being shown.
  const orderCount = Object.values(counts).reduce((n, c) => n + c, 0);
  const pendingCount = counts.pending || 0;

  return (
    <>
      <section className="od-hero">
        <div className="container">
          <nav className="od-crumb" aria-label="Đường dẫn">
            <Link to="/">Trang chủ</Link>
            <span aria-hidden="true">/</span>
            <span>Đơn hàng của tôi</span>
          </nav>
          <div className="od-hero-row">
            <div>
              <h1>Đơn hàng của tôi</h1>
              <p>Thanh toán, mã kích hoạt và trạng thái của từng đơn.</p>
            </div>
            <div className="od-hero-links">
              <Link to="/my-plants" className="od-btn"><SproutyIcon name="sprout" size={16} /> Cây của tôi</Link>
              <Link to="/shop" className="od-btn is-primary"><SproutyIcon name="cart" size={16} /> Mua thêm</Link>
            </div>
          </div>
        </div>
      </section>

      <div className="container od-body">
        {pendingCount > 0 && filter !== 'pending' && (
          <div className="od-alert">
            <span className="od-alert-icon"><SproutyIcon name="clock" size={18} /></span>
            <span><b>{pendingCount} đơn chưa thanh toán.</b> Thanh toán xong là có mã kích hoạt để gieo hạt.</span>
            <button type="button" className="od-btn" onClick={() => pickFilter('pending')}>Xem các đơn này</button>
          </div>
        )}

        {/* Filter first: the question a parent opens this page with is
            almost always "cái nào tôi chưa trả tiền?" */}
        {orderCount > 0 && (
          <div className="od-tabs" role="tablist" aria-label="Lọc đơn hàng">
            {FILTERS.map((f) => {
              const n = f.value ? counts[f.value] || 0 : orderCount;
              if (f.value && n === 0) return null;
              return (
                <button
                  key={f.value}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.value}
                  className={`od-tab${filter === f.value ? ' is-on' : ''}`}
                  onClick={() => pickFilter(f.value)}
                >
                  {f.label}
                  <em>{n}</em>
                </button>
              );
            })}
          </div>
        )}

        {error && (
          <div className="od-error" role="alert">
            {error}
            <button type="button" className="od-btn" onClick={loadOrders}>Thử lại</button>
          </div>
        )}

        {loading && orders.length === 0 && (
          <div className="od-list" aria-hidden="true">
            {[0, 1].map((i) => (
              <div className="od-card is-skeleton" key={i}>
                <span className="od-skel" /><span className="od-skel is-short" /><span className="od-skel is-tall" />
              </div>
            ))}
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <div className="od-empty">
            <span className="od-empty-icon"><SproutyIcon name="cart" size={34} /></span>
            <h2>{filter ? 'Không có đơn nào ở mục này' : 'Bạn chưa có đơn hàng nào'}</h2>
            <p>
              {filter
                ? 'Chọn “Tất cả” để xem lại toàn bộ đơn hàng.'
                : 'Chọn một bộ kit, thanh toán xong là có mã kích hoạt để gieo hạt ngay.'}
            </p>
            {filter ? (
              <button className="btn btn-ghost btn-lg" onClick={() => pickFilter('')}>Xem tất cả đơn</button>
            ) : (
              <Link to="/shop" className="btn btn-primary btn-lg">
                Xem bộ kit
                <SproutyIcon name="arrow-right" size={18} />
              </Link>
            )}
          </div>
        )}

        {orders.length > 0 && (
          <div className={`od-list${loading ? ' is-loading' : ''}`}>
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} onCancelled={loadOrders} />
            ))}
          </div>
        )}

        <Pager page={page} pages={pages} total={total} unit="đơn hàng" onChange={setPage} />
      </div>
    </>
  );
}
