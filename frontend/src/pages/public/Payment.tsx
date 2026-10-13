import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import { confirmAction } from '@/services/dialog';
import { editOrder } from '@/services/edit-order';
import { SproutyIcon } from '@/components/icons/SproutyIcon';
import { CheckoutSteps } from '@/components/CheckoutSteps';
import {
  AddressFields,
  joinAddress,
  splitAddress,
  type AddressParts,
} from '@/components/AddressFields';
import { refreshRewards } from '@/components/PromoBanner';
import { useAuth } from '@/contexts/AuthContext';
import { formatVipDate, planLength, vipDaysLeft } from '@/services/membership';
import {
  isVipOrder,
  ORDER_STATUS_VN,
  shortOrderId,
  type MembershipInfo,
  type Order,
} from '@/types/order';
import { formatPrice } from '@/types/product';
import './Payment.css';

// The bank webhook can land at any moment, so the first stretch is polled
// tightly — the customer is sitting there watching the screen with their
// banking app still open, and four seconds of nothing reads as "it didn't
// work". It backs off once the likely window has passed, because by then the
// page is a background tab and the server should not be asked every second.
const POLL_FAST_MS = 1500;
const POLL_SLOW_MS = 5000;
const FAST_WINDOW_MS = 90 * 1000;
const MAX_WAIT_MS = 10 * 60 * 1000;

interface Payment {
  qrUrl: string;
  bankCode?: string;
  accountNumber?: string;
  accountName?: string;
  memo?: string;
  amount: number;
}

interface PurchaseCode {
  code: string;
  productId?: number;
  productName?: string;
  features?: string[];
  /** True once the code has produced a plant; it cannot be used again. */
  redeemed?: boolean;
  plantId?: string | null;
  plantNickname?: string | null;
}

type Phase = 'loading' | 'ready' | 'notfound' | 'timeout';

function copy(text: string, what = 'Đã sao chép') {
  if (!text) return;
  navigator.clipboard?.writeText(text).then(
    () => showToast(what, 'success'),
    () => showToast('Không sao chép được', 'error'),
  );
}

/**
 * One line of bank detail: the label, the value, and a copy button.
 *
 * Values never wrap — an account number is read back character by character
 * while someone types it into a banking app — and every one that has to be
 * typed can be copied, the amount included.
 */
function Row({
  label,
  value,
  copyValue,
  copied,
  strong,
}: {
  label: string;
  value?: string;
  /** What goes on the clipboard, when it differs from what is shown. */
  copyValue?: string;
  copied?: string;
  strong?: boolean;
}) {
  return (
    <div className={`pm-row${strong ? ' is-strong' : ''}`}>
      <span className="pm-row-label">{label}</span>
      <span className="pm-row-value">{value || '—'}</span>
      {copied && value ? (
        <button className="pm-copy" type="button" onClick={() => copy(copyValue ?? value, copied)} aria-label={`Sao chép ${label.toLowerCase()}`}>
          <SproutyIcon name="copy" size={15} />
          <span>Sao chép</span>
        </button>
      ) : (
        <span className="pm-copy-gap" aria-hidden="true" />
      )}
    </div>
  );
}

/**
 * The address, or nothing.
 *
 * Orders in a category that does not ship are stored with a sentence in
 * the address column explaining that they do not. It is a marker, not an
 * address, and showing it to a customer under the heading "Địa chỉ nhận
 * hàng" reads as a delivery going to a place called "Không áp dụng".
 */
const NO_SHIPPING_MARK = 'Không áp dụng';

function realAddress(order: Order) {
  const value = (order.shippingAddress || '').trim();
  return value.startsWith(NO_SHIPPING_MARK) ? '' : value;
}

/**
 * Who receives the order, correctable while it is unpaid.
 *
 * The name, phone and address were captured once at checkout and this is the
 * one screen where a customer reads them back — so a typo spotted here has to
 * be fixable without phoning support.
 */
function ContactBlock({
  order,
  onSaved,
  openSignal = 0,
}: {
  order: Order;
  onSaved: () => void;
  /** Bumped to open the form from elsewhere (the "Thông tin nhận hàng" step). */
  openSignal?: number;
}) {
  const [editing, setEditing] = useState(false);
  const box = useRef<HTMLElement>(null);
  const [name, setName] = useState(order.shippingName || '');
  const [phone, setPhone] = useState(order.shippingPhone || '');
  const [address, setAddress] = useState<AddressParts>(() => splitAddress(realAddress(order)));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function open() {
    setName(order.shippingName || '');
    setPhone(order.shippingPhone || '');
    setAddress(splitAddress(realAddress(order)));
    setError('');
    setEditing(true);
  }

  useEffect(() => {
    if (!openSignal) return;
    open();
    box.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSignal]);

  async function save() {
    setError('');
    if (name.trim().length < 2) return setError('Nhập tên người nhận.');
    if (!/^[0-9]{9,11}$/.test(phone.trim())) {
      return setError('Số điện thoại gồm 9–11 chữ số.');
    }

    setBusy(true);
    try {
      const { message } = await API.orders.updateShipping(order.id, {
        shippingName: name.trim(),
        shippingPhone: phone.trim(),
        // Sent only when there is one. The server keeps whatever it already
        // holds for an order that does not ship.
        ...(joinAddress(address) ? { shippingAddress: joinAddress(address) } : {}),
      });
      showToast(message || 'Đã cập nhật thông tin nhận hàng', 'success');
      setEditing(false);
      onSaved();
    } catch (err: any) {
      setError(err?.message || 'Không cập nhật được.');
    } finally {
      setBusy(false);
    }
  }

  const shown = realAddress(order);

  return (
    <section className="pm-card pm-contact" aria-label="Người nhận" ref={box}>
      <header className="pm-card-head">
        <h2><SproutyIcon name="user" size={17} /> Người nhận</h2>
        {!editing && (
          <button className="pm-link" type="button" onClick={open}>
            <SproutyIcon name="pencil" size={14} />
            Sửa
          </button>
        )}
      </header>

      {!editing ? (
        <dl className="pm-contact-list">
          <div>
            <dt>Họ và tên</dt>
            <dd>{order.shippingName || '—'}</dd>
          </div>
          <div>
            <dt>Số điện thoại</dt>
            <dd>{order.shippingPhone || '—'}</dd>
          </div>
          <div>
            <dt>Địa chỉ nhận hàng</dt>
            <dd className={shown ? undefined : 'is-missing'}>{shown || 'Chưa có — bấm Sửa để thêm'}</dd>
          </div>
        </dl>
      ) : (
        <div className="pm-contact-edit">
          <div className="pm-grid">
            <label className="form-group">
              <span className="form-label">Họ tên</span>
              <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" autoComplete="name" />
            </label>
            <label className="form-group">
              <span className="form-label">Số điện thoại</span>
              <input
                className="form-input"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, '').slice(0, 11))}
                placeholder="0909000000"
                autoComplete="tel"
              />
            </label>
          </div>
          <AddressFields value={address} onChange={setAddress} required={false} />
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="pm-contact-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)} disabled={busy}>
              Huỷ
            </button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>
              {busy ? 'Đang lưu…' : 'Lưu thông tin'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Where a shop order asks who receives it, a VIP order says what happens once
 * it is paid. There is nobody to deliver to and no address to check; the
 * question a parent has instead is "what do I get, and do I have to do
 * anything after paying?" — and the answer to the second is no.
 */
function VipAfterPay({ membership }: { membership: MembershipInfo | null }) {
  const days = membership?.days || 0;
  // Renewing early adds on to the end; otherwise the clock starts now.
  const from =
    membership?.isVip && membership.vipUntil ? new Date(membership.vipUntil).getTime() : Date.now();
  const until = days ? new Date(from + days * 86_400_000).toISOString() : null;

  return (
    <section className="pm-card pm-vip-after" aria-label="Sau khi thanh toán">
      <header className="pm-card-head">
        <h2><img src="/assets/images/sprouty-icons/VIP.png" alt="" /> Sau khi thanh toán</h2>
      </header>
      <ul className="pm-checks">
        <li>
          <SproutyIcon name="check" size={17} />
          <span>Tài khoản <b>tự động lên VIP</b> ngay khi tiền về — không cần nhập mã kích hoạt.</span>
        </li>
        {days > 0 && (
          <li>
            <SproutyIcon name="check" size={17} />
            <span>
              Thời hạn <b>{planLength(days)}</b>
              {until && <> — đến khoảng ngày <b>{formatVipDate(until)}</b></>}
              {membership?.isVip && ', nối tiếp hạn VIP hiện tại'}.
            </span>
          </li>
        )}
        <li>
          <SproutyIcon name="check" size={17} />
          <span>Không giao hàng — mọi quyền lợi nằm trên tài khoản của bạn.</span>
        </li>
      </ul>
    </section>
  );
}

export default function PaymentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = (searchParams.get('orderId') || '').trim();

  const [order, setOrder] = useState<(Order & { redeemCodes?: PurchaseCode[] }) | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  /** The account's tier, sent with a VIP order. */
  const [membership, setMembership] = useState<MembershipInfo | null>(null);
  const { refreshUser } = useAuth();
  // Read through a ref so a changed session does not restart the polling
  // loop below, whose callback would otherwise depend on it.
  const refreshUserRef = useRef(refreshUser);
  refreshUserRef.current = refreshUser;
  const [phase, setPhase] = useState<Phase>('loading');
  const [hint, setHint] = useState('');
  /** Server-decided: this deployment will credit a payment nobody made. */
  const [canSimulate, setCanSimulate] = useState(false);
  const [simulating, setSimulating] = useState(false);
  /** Which code is mid-activation, so only that button shows a spinner. */
  const [activating, setActivating] = useState('');
  const [editingOrder, setEditingOrder] = useState(false);
  const [contactSignal, setContactSignal] = useState(0);
  const startedAt = useRef(Date.now());
  /** Fires the celebration once, not on every poll after payment lands. */
  const celebrated = useRef(false);

  const refresh = useCallback(async () => {
    if (!orderId) {
      setPhase('notfound');
      return 'stop' as const;
    }
    try {
      const {
        order: fetched,
        payment: fetchedPayment,
        membership: fetchedMembership,
        canSimulatePayment,
      } = await API.orders.get(orderId);
      if (!fetched) {
        setPhase('notfound');
        return 'stop' as const;
      }
      setOrder(fetched);
      setPayment(fetchedPayment || null);
      setMembership(fetchedMembership || null);
      setCanSimulate(Boolean(canSimulatePayment));
      setPhase('ready');
      setHint('');

      // The moment the money lands: say so, and make sure the "mua 3 tặng 1"
      // progress shown elsewhere is not a purchase behind.
      if (fetched.paidAt && !celebrated.current) {
        celebrated.current = true;
        if (isVipOrder(fetched)) {
          showToast('Thanh toán thành công! Tài khoản đã được nâng cấp VIP Garden.', 'success');
          // So the header's badge flips without a reload.
          void refreshUserRef.current();
        } else {
          showToast('Thanh toán thành công! Mã kích hoạt đã sẵn sàng.', 'success');
          refreshRewards();
        }
      }

      return fetched.status === 'pending' ? ('continue' as const) : ('stop' as const);
    } catch (err: any) {
      if (err?.status === 401 || err?.status === 403 || err?.status === 404) {
        setPhase('notfound');
        return 'stop' as const;
      }
      // Network blip — keep polling and say so.
      setHint('Mất kết nối tạm thời, đang thử lại…');
      return 'continue' as const;
    }
  }, [orderId]);

  // Self-rescheduling rather than a fixed interval, so the gap can widen once
  // the customer has plainly stopped watching, and so a slow response can never
  // stack a second request on top of the first.
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const loop = async () => {
      if (stopped) return;
      const outcome = await refresh();
      if (stopped || outcome === 'stop') return;

      const waited = Date.now() - startedAt.current;
      if (waited > MAX_WAIT_MS) {
        setPhase((p) => (p === 'ready' ? 'timeout' : p));
        return;
      }
      timer = setTimeout(loop, waited < FAST_WINDOW_MS ? POLL_FAST_MS : POLL_SLOW_MS);
    };

    startedAt.current = Date.now();
    void loop();

    // Coming back to the tab is the other moment the answer may have changed.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  /**
   * Credits the order with no bank transaction behind it. Only offered when the
   * server said it would accept one; the button is never the thing that decides.
   */
  async function simulatePayment() {
    setSimulating(true);
    try {
      await API.orders.simulatePayment(orderId);
      // Re-read rather than trusting the response, so the screen is built from
      // the same source every other path uses.
      await refresh();
    } catch (err: any) {
      showToast(err?.message || 'Không ghi nhận được thanh toán thử.', 'error');
    } finally {
      setSimulating(false);
    }
  }

  /**
   * Sows the plant straight from this screen.
   *
   * The code is already on the page and the next thing the customer wants is
   * their plant, so making them copy it, find "Cây của tôi" and paste it back
   * would be three steps of busywork between paying and the thing they bought.
   */
  async function activateNow(code: string) {
    setActivating(code);
    try {
      const data = await API.plants.activate(code);
      showToast(data.message || 'Đã kích hoạt mã.', 'success');

      // A membership has no plant to open. Reload the order instead, so the
      // card turns into its "đã kích hoạt" state rather than offering the
      // same button again.
      if (data.plant?.id) {
        navigate(`/plant/${data.plant.id}`);
      } else {
        setActivating('');
        refresh();
      }
    } catch (err: any) {
      showToast(err?.message || 'Không kích hoạt được mã này.', 'error');
      setActivating('');
    }
  }

  /**
   * Going back to change what is in the order. The order already exists by
   * now, so it is cancelled and its products go back to the cart — never a
   * second order left waiting beside the first.
   */
  async function editThisOrder() {
    if (!order || editingOrder) return;
    const ok = await confirmAction(
      `Đơn #${shortOrderId(order.id)} sẽ được huỷ và các sản phẩm trở lại giỏ hàng để bạn sửa rồi đặt lại.

Nếu bạn đã chuyển khoản cho đơn này thì đừng sửa — hãy chờ trang tự xác nhận.`,
      { title: 'Sửa sản phẩm trong đơn?', confirmLabel: 'Về giỏ hàng để sửa', danger: false },
    );
    if (!ok) return;
    setEditingOrder(true);
    try {
      const { missing } = await editOrder(order.id);
      if (missing.length) {
        showToast(`${missing.join(', ')} không còn bán nên không thêm lại vào giỏ được.`, 'error');
      } else {
        showToast('Sản phẩm đã về giỏ hàng — sửa xong bấm Đặt hàng.', 'success');
      }
      navigate('/cart');
    } catch (err: any) {
      showToast(err?.message || 'Chưa sửa được đơn. Vui lòng thử lại.', 'error');
      setEditingOrder(false);
      void refresh();
    }
  }

  const isPending = order?.status === 'pending';
  const cancelled = order?.status === 'cancelled';
  const codes = order?.redeemCodes || [];
  const vip = order ? isVipOrder(order) : false;
  const units = order?.items?.reduce((n, i) => n + (i.qty || 1), 0) || 0;

  return (
    <>
      <section className="pm-hero">
        <div className="container">
          <nav className="pm-crumb" aria-label="Đường dẫn">
            <Link to="/">Trang chủ</Link>
            <span aria-hidden="true">/</span>
            {vip ? <Link to="/vip">VIP Garden</Link> : <Link to="/account">Đơn hàng của tôi</Link>}
            <span aria-hidden="true">/</span>
            <span>Thanh toán</span>
          </nav>
          <h1>{vip ? 'Thanh toán gói VIP Garden' : 'Thanh toán đơn hàng'}</h1>
          {/* A VIP plan is bought from its own page; it has no cart or address step. */}
          {!vip && order && !cancelled && (
            <CheckoutSteps
              current={isPending ? 2 : 3}
              onStep={isPending && phase === 'ready' ? { 0: editThisOrder, 1: () => setContactSignal((n) => n + 1) } : undefined}
            />
          )}
        </div>
      </section>

      <div className="container pm-body">
        {phase === 'loading' && (
          <div className="pm-layout" aria-hidden="true">
            <div className="pm-card pm-skel-card"><span className="pm-skel" /><span className="pm-skel is-big" /><span className="pm-skel" /></div>
            <div className="pm-card pm-skel-card"><span className="pm-skel" /><span className="pm-skel" /></div>
          </div>
        )}

        {phase === 'notfound' && (
          <div className="pm-card pm-state">
            <span className="pm-state-icon is-bad"><SproutyIcon name="search" size={30} /></span>
            <h2>Không tìm thấy đơn hàng</h2>
            <p>Đơn hàng không tồn tại, hoặc tài khoản này không xem được đơn đó.</p>
            <div className="pm-actions">
              <Link to="/account" className="btn btn-outline">Đơn hàng của tôi</Link>
              <Link to="/shop" className="btn btn-primary">Tiếp tục mua sắm</Link>
            </div>
          </div>
        )}

        {order && phase === 'timeout' && (
          <div className="pm-card pm-state">
            <span className="pm-state-icon"><SproutyIcon name="clock" size={30} /></span>
            <h2>Đã ngừng tự kiểm tra</h2>
            <p>Trang đã chờ 10 phút. Nếu bạn đã chuyển khoản, bấm kiểm tra lại — không cần chuyển thêm.</p>
            <div className="pm-actions">
              <button
                className="btn btn-primary"
                onClick={() => {
                  startedAt.current = Date.now();
                  setPhase('ready');
                  void refresh();
                }}
              >
                Kiểm tra lại
              </button>
            </div>
          </div>
        )}

        {order && phase === 'ready' && isPending && (
          <div className="pm-layout">
            {/* Paying first: it is what this page is for. */}
            <section className="pm-card pm-pay" aria-label="Chuyển khoản">
              {payment ? (
                <>
                  <header className="pm-pay-head">
                    <div>
                      <h2>Chuyển khoản để hoàn tất</h2>
                      <p>Quét mã QR hoặc chuyển tay theo thông tin bên dưới.</p>
                    </div>
                    <span className="pm-live"><i /> Đang chờ thanh toán</span>
                  </header>

                  <div className="pm-amount">
                    <span>Số tiền cần chuyển</span>
                    <strong>{formatPrice(payment.amount)}</strong>
                    <button className="pm-copy" type="button" onClick={() => copy(String(payment.amount), 'Đã sao chép số tiền')}>
                      <SproutyIcon name="copy" size={15} />
                      <span>Sao chép</span>
                    </button>
                  </div>

                  <div className="pm-pay-grid">
                    <figure className="pm-qr">
                      <span className="pm-qr-frame">
                        <img src={payment.qrUrl} alt="Mã QR chuyển khoản" />
                      </span>
                      <figcaption>
                        <strong>Quét bằng app ngân hàng</strong>
                        <span>Số tiền và nội dung đã điền sẵn.</span>
                      </figcaption>
                    </figure>

                    <div className="pm-bank">
                      <span className="pm-bank-title">Hoặc chuyển khoản thủ công</span>
                      <Row label="Ngân hàng" value={payment.bankCode} />
                      <Row label="Số tài khoản" value={payment.accountNumber} copied="Đã sao chép số tài khoản" />
                      <Row label="Chủ tài khoản" value={payment.accountName} />
                      {/* The single point of failure on this page: a memo typed
                          over by hand arrives as money nobody can match to an
                          order. It is the loudest line for that reason. */}
                      <div className="pm-memo">
                        <Row label="Nội dung" value={payment.memo} copied="Đã sao chép nội dung" strong />
                        <p><SproutyIcon name="warning" size={14} /> Giữ nguyên nội dung này — sửa hay viết thêm thì hệ thống không nhận ra đơn của bạn.</p>
                      </div>
                    </div>
                  </div>

                  <div className="pm-waiting" role="status">
                    <span className="pm-spinner" aria-hidden="true" />
                    <span>
                      <strong>Trang tự cập nhật khi ngân hàng báo có</strong>
                      <em>Thường trong vòng một phút. Không cần bấm gì, cũng đừng chuyển thêm lần nữa.{hint && <> {hint}</>}</em>
                    </span>
                  </div>
                </>
              ) : (
                <div className="pm-state is-inline">
                  <span className="pm-state-icon"><SproutyIcon name="info" size={28} /></span>
                  <h2>Chưa cấu hình cổng thanh toán</h2>
                  <p>Vui lòng liên hệ Sprouty để được hướng dẫn thanh toán cho đơn {shortOrderId(order.id)}.</p>
                </div>
              )}

              {/* Shown only when the server said it would accept a payment with
                  no money behind it. Styled as the test tool it is, so nobody
                  mistakes it for part of the real checkout. */}
              {canSimulate && (
                <div className="pm-devbox">
                  <span className="pm-devbox-tag">Chế độ thử nghiệm</span>
                  <p>
                    Máy chủ này đang bật <code>ALLOW_FAKE_PAYMENTS</code>. Bấm nút dưới để ghi nhận đơn là đã
                    thanh toán mà không cần chuyển khoản thật,
                    {vip ? ' tài khoản sẽ lên VIP ngay.' : ' rồi nhận mã kích hoạt ngay.'}
                  </p>
                  <button className="pm-devbox-btn" disabled={simulating} onClick={simulatePayment}>
                    {simulating ? 'Đang ghi nhận…' : vip ? 'Thanh toán thử & lên VIP ngay' : 'Thanh toán thử & lấy mã ngay'}
                  </button>
                </div>
              )}
            </section>

            <aside className="pm-aside">
              <section className="pm-card pm-order" aria-label="Đơn hàng">
                <header className="pm-card-head">
                  <h2>{vip ? 'Gói VIP của bạn' : 'Đơn hàng'}</h2>
                  <span className={`pm-status s-${order.status}`}>{ORDER_STATUS_VN[order.status] ?? order.status}</span>
                </header>
                {/* The order code is read out to support and typed into a bank
                    memo, so it gets monospace and a copy button. */}
                <div className="pm-code">
                  <span>Mã đơn</span>
                  <code title={order.id}>{shortOrderId(order.id)}</code>
                  <button className="pm-copy is-icon" type="button" aria-label="Sao chép mã đơn" onClick={() => copy(shortOrderId(order.id), 'Đã sao chép mã đơn')}>
                    <SproutyIcon name="copy" size={15} />
                  </button>
                </div>
                {/* The real product photo. This is the one place a customer
                    confirms they are paying for the thing they meant to buy. */}
                <ul className="pm-items">
                  {order.items?.map((item, i) => (
                    <li key={i}>
                      <span className="pm-thumb">
                        {item.product?.images?.[0] ? <img src={item.product.images[0]} alt="" /> : <SproutyIcon name="pot" size={22} />}
                        {item.qty > 1 && <em>{item.qty}</em>}
                      </span>
                      <span className="pm-item-main">
                        <span className="pm-item-name">{item.product?.name || 'Sản phẩm'}</span>
                        <span className="pm-item-sub">
                          {item.variant === 'smart' && <b>Bản Smart</b>}
                          {formatPrice(item.unitPrice)}
                          {item.qty > 1 && ` × ${item.qty}`}
                        </span>
                      </span>
                      <span className="pm-item-total">{formatPrice(item.unitPrice * item.qty)}</span>
                    </li>
                  ))}
                </ul>
                <div className="pm-total">
                  <span>Tổng cộng{units > 1 ? ` (${units} sản phẩm)` : ''}</span>
                  <strong>{formatPrice(order.total)}</strong>
                </div>
                {!vip && (
                  <div className="pm-order-edit">
                    <button type="button" className="pm-link" onClick={editThisOrder} disabled={editingOrder}>
                      <SproutyIcon name="pencil" size={14} />
                      {editingOrder ? 'Đang đưa về giỏ…' : 'Sửa sản phẩm trong đơn'}
                    </button>
                  </div>
                )}
              </section>

              {vip ? (
                <VipAfterPay membership={membership} />
              ) : (
                <ContactBlock order={order} onSaved={refresh} openSignal={contactSignal} />
              )}
            </aside>
          </div>
        )}

        {order && phase === 'ready' && !isPending && (
          <section className="pm-card pm-result">
            {vip && !cancelled ? (
              <>
                <span className="pm-result-badge is-vip"><img src="/assets/images/sprouty-icons/VIP.png" alt="" /></span>
                <h2>Đã nâng cấp VIP Garden!</h2>
                <p className="pm-result-sub">
                  Thanh toán đã được ghi nhận và tài khoản của bạn đã tự động lên VIP — không cần nhập mã nào cả.
                </p>
                {membership?.isVip && (
                  <div className="pm-vip-done">
                    <span>Thành viên VIP đến</span>
                    <strong>{formatVipDate(membership.vipUntil)}</strong>
                    <em>Còn {vipDaysLeft(membership.vipUntil)} ngày</em>
                  </div>
                )}
                <div className="pm-actions">
                  <Link to="/vip" className="btn btn-primary btn-lg">Xem quyền lợi VIP</Link>
                  <Link to="/my-plants" className="btn btn-outline btn-lg">Tới vườn của tôi</Link>
                </div>
              </>
            ) : (
              <>
                <span className={`pm-result-badge${cancelled ? ' is-bad' : ''}`}>
                  <SproutyIcon name={cancelled ? 'warning' : 'check'} size={40} />
                </span>
                <h2 className={cancelled ? 'is-bad' : undefined}>{cancelled ? 'Đơn hàng đã bị huỷ' : 'Thanh toán thành công!'}</h2>
                <p className="pm-result-sub">
                  {cancelled
                    ? `Đơn hàng ${shortOrderId(order.id)} đã bị huỷ. Vui lòng liên hệ Sprouty nếu bạn cần hỗ trợ.`
                    : codes.length > 0
                      ? 'Mã kích hoạt của bạn đã sẵn sàng bên dưới — bấm một nút là gieo hạt xong.'
                      : `Đơn hàng ${shortOrderId(order.id)} đã được ghi nhận.`}
                </p>

                {/* The code is the product now, so it is the biggest thing on
                    the screen rather than a footnote under the receipt. */}
                {codes.length > 0 && (
                  <div className="pm-codes">
                    {codes.map((code) => (
                      <div className="pm-code-card" key={code.code}>
                        <span className="pm-code-kicker">Mã kích hoạt</span>
                        <div className="pm-code-product">{code.productName || `Sản phẩm #${code.productId}`}</div>
                        <div className="pm-code-value">
                          <code>{code.code}</code>
                          <button className="pm-copy" type="button" onClick={() => copy(code.code, 'Đã sao chép mã kích hoạt')}>
                            <SproutyIcon name="copy" size={15} />
                            <span>Sao chép</span>
                          </button>
                        </div>

                        {/* Coming back to this page after activating must not
                            offer the same code again — it can only fail. */}
                        {code.redeemed && code.kind === 'membership' ? (
                          <div className="pm-code-cta is-done is-static">
                            <SproutyIcon name="check" size={19} />
                            Đã kích hoạt gói thành viên
                          </div>
                        ) : code.redeemed ? (
                          <Link className="pm-code-cta is-done" to={code.plantId ? `/plant/${code.plantId}` : '/my-plants'}>
                            Xem cây{code.plantNickname ? ` “${code.plantNickname}”` : ''}
                            <SproutyIcon name="arrow-right" size={19} />
                          </Link>
                        ) : (
                          <button className="pm-code-cta" disabled={Boolean(activating)} onClick={() => activateNow(code.code)}>
                            {activating === code.code
                              ? 'Đang kích hoạt…'
                              : code.kind === 'membership'
                                ? 'Kích hoạt gói thành viên'
                                : 'Kích hoạt & gieo hạt ngay'}
                            {activating !== code.code && <SproutyIcon name="arrow-right" size={19} />}
                          </button>
                        )}

                        <p className="pm-code-note">
                          {code.redeemed ? (
                            code.kind === 'membership'
                              ? 'Quyền lợi thành viên đang có hiệu lực trên tài khoản của bạn.'
                              : 'Mã này đã được dùng để gieo cây.'
                          ) : (
                            <>Mã luôn xem lại được trong <Link to="/account">Đơn hàng của tôi</Link>.</>
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Paying finishes the checkout, not the order: the box is still to come. */}
                {order.needsShipping && !cancelled && (
                  <p className="pm-ship-note">
                    <SproutyIcon name="gift" size={18} />
                    <span>
                      <b>Bộ kit sẽ được đóng gói và gửi tới</b> {realAddress(order) || 'địa chỉ bạn đã nhập'}.
                      {' '}Theo dõi trạng thái giao hàng ở <Link to="/account">Đơn hàng của tôi</Link> và bấm “Đã nhận được hàng” khi nhận được.
                    </span>
                  </p>
                )}

                <div className="pm-actions">
                  <Link to="/my-plants" className="btn btn-outline btn-lg">Tới vườn của tôi</Link>
                  <Link to="/shop" className="btn btn-ghost btn-lg">Tiếp tục mua sắm</Link>
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </>
  );
}
