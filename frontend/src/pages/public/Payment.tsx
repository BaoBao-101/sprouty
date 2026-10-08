import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import { SproutyIcon } from '@/components/icons/SproutyIcon';
import {
  AddressFields,
  joinAddress,
  splitAddress,
  type AddressParts,
} from '@/components/AddressFields';
import { refreshRewards } from '@/components/PromoBanner';
import { ORDER_STATUS_VN, shortOrderId, type Order } from '@/types/order';
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

function copy(text: string) {
  if (!text) return;
  navigator.clipboard?.writeText(text).then(
    () => showToast('Đã sao chép', 'success'),
    () => showToast('Không sao chép được', 'error'),
  );
}

/**
 * One line of bank detail.
 *
 * The label sits above the value, not beside it. An account number and a
 * bank name are read back character by character while someone types them
 * into an app, so they must never wrap — and beside a label in a column
 * this width they had nowhere to go.
 */
function Row({ label, value, copyable }: { label: string; value?: string; copyable?: boolean }) {
  return (
    <div className="pay-row">
      <span className="lbl">{label}</span>
      <span className="val-row">
        <span className="val">{value || '—'}</span>
        {copyable && value && (
          <button
            className="copy-btn"
            type="button"
            title="Sao chép"
            onClick={() => copy(value)}
          >
            <SproutyIcon name="album" size={14} />
            Sao chép
          </button>
        )}
      </span>
    </div>
  );
}

/**
 * Who to contact about this order, correctable while it is unpaid.
 *
 * There is no address here any more: nothing is delivered, so the only things
 * that matter are the name and the number staff ring if a payment cannot be
 * matched. The name and phone were captured once at checkout and then frozen,
 * and this is the one screen where a customer reads them back — so a typo
 * spotted here has to be fixable without phoning support.
 */
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

function ContactBlock({ order, onSaved }: { order: Order; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
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

  async function save() {
    setError('');
    if (name.trim().length < 2) return setError('Nhập tên của bạn.');
    if (!/^[0-9]{9,11}$/.test(phone.trim())) {
      return setError('Số điện thoại không hợp lệ (9–11 chữ số).');
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
      showToast(message || 'Đã cập nhật thông tin liên hệ', 'success');
      setEditing(false);
      onSaved();
    } catch (err: any) {
      setError(err?.message || 'Không cập nhật được.');
    } finally {
      setBusy(false);
    }
  }

  const shown = realAddress(order);

  if (!editing) {
    return (
      <div className="ord-ship">
        <div className="ord-ship-top">
          <span className="ord-ship-label">Người đặt hàng</span>
          <button className="ord-ship-edit" type="button" onClick={open}>
            <SproutyIcon name="pencil" size={14} />
            Sửa
          </button>
        </div>

        {/* Label above value, not beside it. Beside it, in a column this
            narrow, the value gets half the width and an address wraps to
            four lines. */}
        <dl className="ord-ship-list">
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
            <dd className={shown ? undefined : 'is-missing'}>
              {shown || 'Chưa có — bấm Sửa để thêm'}
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <div className="ord-ship editing">
      <span className="ord-ship-label">Sửa thông tin liên hệ</span>

      <div className="ord-ship-grid">
        <label className="form-group" style={{ marginBottom: 0 }}>
          <span className="form-label">Người mua</span>
          <input
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nguyễn Văn A"
          />
        </label>
        <label className="form-group" style={{ marginBottom: 0 }}>
          <span className="form-label">Số điện thoại</span>
          <input
            className="form-input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0909000000"
          />
        </label>
      </div>

      <div style={{ marginTop: 12 }}>
        <AddressFields value={address} onChange={setAddress} required={false} />
      </div>

      {error && <div className="form-error mb-12" style={{ marginTop: 10 }}>{error}</div>}

      <div className="ord-ship-actions">
        <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)} disabled={busy}>
          Hủy
        </button>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>
          {busy ? 'Đang lưu…' : 'Lưu địa chỉ'}
        </button>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = (searchParams.get('orderId') || '').trim();

  const [order, setOrder] = useState<Order & { redeemCodes?: PurchaseCode[] } | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [hint, setHint] = useState('');
  /** Server-decided: this deployment will credit a payment nobody made. */
  const [canSimulate, setCanSimulate] = useState(false);
  const [simulating, setSimulating] = useState(false);
  /** Which code is mid-activation, so only that button shows a spinner. */
  const [activating, setActivating] = useState('');
  const startedAt = useRef(Date.now());
  /** Fires the celebration once, not on every poll after payment lands. */
  const celebrated = useRef(false);

  const refresh = useCallback(async () => {
    if (!orderId) {
      setPhase('notfound');
      return 'stop' as const;
    }
    try {
      const { order: fetched, payment: fetchedPayment, canSimulatePayment } =
        await API.orders.get(orderId);
      if (!fetched) {
        setPhase('notfound');
        return 'stop' as const;
      }
      setOrder(fetched);
      setPayment(fetchedPayment || null);
      setCanSimulate(Boolean(canSimulatePayment));
      setPhase('ready');
      setHint('');

      // The moment the money lands: say so, and make sure the "mua 3 tặng 1"
      // progress shown elsewhere is not a purchase behind.
      if (fetched.paidAt && !celebrated.current) {
        celebrated.current = true;
        showToast('Thanh toán thành công! Mã kích hoạt đã sẵn sàng.', 'success');
        refreshRewards();
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
      showToast(data.created ? 'Hạt đã được gieo!' : 'Cây này đã được kích hoạt trước đó.', 'success');
      navigate(`/plant/${data.plant.id}`);
    } catch (err: any) {
      showToast(err?.message || 'Không kích hoạt được mã này.', 'error');
      setActivating('');
    }
  }

  const isPending = order?.status === 'pending';
  const codes = order?.redeemCodes || [];

  return (
    <>
      <div className="pay-hero">
        <div className="container">
          <div className="breadcrumb pay-hero-crumb">
            <Link to="/">Trang chủ</Link> › <Link to="/account">Tài khoản</Link> › Thanh toán
          </div>
          <h1>Thanh toán đơn hàng</h1>
          <p>
            {phase === 'loading'
              ? 'Đang tải…'
              : phase === 'notfound'
                ? 'Không tìm thấy đơn hàng'
                : phase === 'timeout'
                  ? 'Hết thời gian chờ tự động'
                  : isPending
                    ? 'Đang chờ thanh toán'
                    : order?.status === 'cancelled'
                      ? 'Đơn hàng đã bị hủy'
                      : 'Đã nhận thanh toán'}
          </p>
        </div>
      </div>

      <div className="container section-sm">
        {phase === 'loading' && <p style={{ color: 'var(--ink-4)' }}>Đang tải đơn hàng…</p>}

        {phase === 'notfound' && (
          <div className="pay-card">
            <h2>Không tìm thấy đơn hàng</h2>
            <p style={{ color: 'var(--ink-4)' }}>
              Đơn hàng không tồn tại hoặc bạn không có quyền xem.
            </p>
            <Link to="/shop" className="btn btn-primary btn-lg" style={{ marginTop: 16 }}>
              Tiếp tục mua sắm
            </Link>
          </div>
        )}

        {order && phase !== 'notfound' && (
          <div className={`pay-layout${isPending ? ' paying' : ''}`}>
            <div className="pay-card">
              {phase === 'timeout' ? (
                <>
                  <h2>Hết thời gian chờ tự động</h2>
                  <p style={{ color: 'var(--ink-4)' }}>
                    Chúng tôi đã ngừng kiểm tra tự động. Nếu bạn đã chuyển khoản, bấm nút dưới để
                    kiểm tra lại.
                  </p>
                  <button
                    className="btn btn-primary"
                    style={{ marginTop: 14 }}
                    onClick={() => {
                      startedAt.current = Date.now();
                      setPhase('ready');
                      void refresh();
                    }}
                  >
                    Kiểm tra lại
                  </button>
                </>
              ) : isPending ? (
                // What the order contains. The money side lives in the right
                // column — a customer checks what they bought before they check
                // where to send the payment.
                <>
                  <h2>Đơn hàng của bạn</h2>

                  {/* The order code is read out to support and typed into a
                      bank memo, so it gets monospace and a line of its own
                      rather than sharing one with the status. */}
                  <div className="ord-head">
                    <span className="ord-code">
                      <em>Mã đơn</em>
                      <code title={order.id}>{shortOrderId(order.id)}</code>
                    </span>
                    <span className={`ord-state s-${order.status}`}>
                      {ORDER_STATUS_VN[order.status] ?? order.status}
                    </span>
                  </div>

                  {/* The real product photo, not an emoji. This is the only
                      place a customer confirms they are paying for the thing
                      they meant to buy, and a 📦 confirms nothing. */}
                  <div className="ord-items">
                    {order.items?.map((item, i) => (
                      <div className="ord-item" key={i}>
                        <span className="ord-item-thumb">
                          {item.product?.images?.[0] ? (
                            <img src={item.product.images[0]} alt="" />
                          ) : (
                            <span>{item.product?.emoji || '🌱'}</span>
                          )}
                          {item.qty > 1 && <em className="ord-item-qty">{item.qty}</em>}
                        </span>

                        <span className="ord-item-main">
                          <span className="ord-item-name">{item.product?.name || 'Sản phẩm'}</span>
                          <span className="ord-item-sub">
                            {item.variant === 'smart' && (
                              <b className="ord-item-variant">Bản Smart</b>
                            )}
                            {formatPrice(item.unitPrice)}
                            {item.qty > 1 && ` × ${item.qty}`}
                          </span>
                          <span className="ord-item-line">
                            {formatPrice(item.unitPrice * item.qty)}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="ord-total">
                    <span>Tổng cộng</span>
                    <strong>{formatPrice(order.total)}</strong>
                  </div>

                  <ContactBlock order={order} onSaved={refresh} />
                </>
              ) : (
                <div className="pay-result">
                  <div className={`pay-result-badge${order.status === 'cancelled' ? ' bad' : ''}`}>
                    <SproutyIcon name={order.status === 'cancelled' ? 'warning' : 'check'} size={44} />
                  </div>
                  <h2 className={order.status === 'cancelled' ? 'is-bad' : 'is-good'}>
                    {order.status === 'cancelled' ? 'Đơn hàng đã bị hủy' : 'Thanh toán thành công!'}
                  </h2>
                  <p className="pay-result-sub">
                    {order.status === 'cancelled'
                      ? `Đơn hàng ${shortOrderId(order.id)} đã bị hủy. Vui lòng liên hệ Sprouty nếu bạn cần hỗ trợ.`
                      : codes.length > 0
                        ? 'Mã kích hoạt của bạn đã sẵn sàng ngay bên dưới — bấm một nút là hạt được gieo.'
                        : `Đơn hàng ${shortOrderId(order.id)} đã được ghi nhận.`}
                  </p>

                  {/* The code is the product now, so it is the biggest thing on
                      the screen rather than a footnote under the receipt. */}
                  {codes.length > 0 && (
                    <div className="purchase-codes">
                      {codes.map((code) => (
                        <div className="code-card" key={code.code}>
                          <span className="code-card-kicker">Mã kích hoạt</span>
                          <div className="code-card-product">
                            {code.productName || `Sản phẩm #${code.productId}`}
                          </div>

                          <div className="code-card-value">
                            <code>{code.code}</code>
                            <button
                              className="code-card-copy"
                              type="button"
                              aria-label="Sao chép mã"
                              onClick={() => copy(code.code)}
                            >
                              Sao chép
                            </button>
                          </div>

                          {/* Coming back to this page after activating must not
                              offer the same code again — it can only fail. */}
                          {code.redeemed ? (
                            <Link
                              className="code-card-cta is-done"
                              to={code.plantId ? `/plant/${code.plantId}` : '/my-plants'}
                            >
                              Xem cây
                              {code.plantNickname ? ` “${code.plantNickname}”` : ''}
                              <SproutyIcon name="arrow-right" size={19} />
                            </Link>
                          ) : (
                            <button
                              className="code-card-cta"
                              disabled={Boolean(activating)}
                              onClick={() => activateNow(code.code)}
                            >
                              {activating === code.code ? 'Đang gieo hạt…' : 'Kích hoạt & gieo hạt ngay'}
                              {activating !== code.code && <SproutyIcon name="arrow-right" size={19} />}
                            </button>
                          )}

                          <p className="code-card-note">
                            {code.redeemed
                              ? 'Mã này đã được dùng để gieo cây.'
                              : <>Mã cũng luôn xem lại được trong <Link to="/account">Đơn hàng của tôi</Link>.</>}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pay-actions">
                    <Link to="/my-plants" className="btn btn-outline btn-lg">
                      Tới vườn của tôi
                    </Link>
                    <Link to="/shop" className="btn btn-ghost btn-lg">
                      Tiếp tục mua sắm
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Everything to do with paying, in one column. Only while the order
                is unpaid — once it is settled these instructions are noise. */}
            {isPending && (
              <div className="pay-summary">
                {payment ? (
                  <>
                    {/* Written as a procedure, numbered, because that is what
                        somebody about to move their own money wants: not a
                        panel of facts to assemble into one, but the order to
                        do things in and what happens after the last step. */}
                    <h3>Chuyển khoản để hoàn tất</h3>

                    <div className="pay-amount">
                      <span>Số tiền cần chuyển</span>
                      <strong>{formatPrice(payment.amount)}</strong>
                    </div>

                    <ol className="pay-steps">
                      <li>
                        <div className="pay-step-head">
                          <span className="pay-step-n">1</span>
                          <h4>Quét mã QR bằng app ngân hàng</h4>
                        </div>
                        <p className="pay-step-note">
                          Cách nhanh nhất — số tiền và nội dung được điền sẵn, không phải gõ gì.
                        </p>
                        <div className="sum-qr">
                          <img src={payment.qrUrl} alt="Mã QR thanh toán" />
                        </div>
                      </li>

                      <li>
                        <div className="pay-step-head">
                          <span className="pay-step-n">2</span>
                          <h4>Hoặc chuyển khoản thủ công</h4>
                        </div>
                        <div className="pay-bank">
                          <Row label="Ngân hàng" value={payment.bankCode} />
                          <Row label="Số tài khoản" value={payment.accountNumber} copyable />
                          <Row label="Chủ tài khoản" value={payment.accountName} />
                        </div>

                        {/* The single point of failure on this page: a memo
                            typed over by hand arrives as money nobody can
                            match to an order. It is the loudest thing here
                            for that reason, not for emphasis. */}
                        <div className="pay-memo">
                          <span className="pay-memo-label">
                            <SproutyIcon name="warning" size={15} /> Nội dung chuyển khoản —
                            bắt buộc giữ nguyên
                          </span>
                          <div className="pay-memo-row">
                            <code>{payment.memo}</code>
                            <button
                              className="copy-btn"
                              type="button"
                              title="Sao chép nội dung"
                              onClick={() => copy(payment.memo)}
                            >
                              <SproutyIcon name="album" size={16} />
                              Sao chép
                            </button>
                          </div>
                          <span className="pay-memo-hint">
                            Sửa hay viết thêm vào dòng này thì hệ thống không nhận ra đơn của
                            bạn, và tiền sẽ phải đối soát thủ công.
                          </span>
                        </div>
                      </li>

                      <li>
                        <div className="pay-step-head">
                          <span className="pay-step-n">3</span>
                          <h4>Chờ trên trang này</h4>
                        </div>
                        <div className="pay-waiting">
                          <span className="spinner" />
                          <div>
                            <strong>Trang tự cập nhật khi ngân hàng báo có.</strong>
                            <span>
                              Thường trong vòng một phút. Không cần bấm gì, cũng đừng chuyển
                              thêm lần nữa.
                              {hint && <> {hint}</>}
                            </span>
                          </div>
                        </div>
                      </li>
                    </ol>
                  </>
                ) : (
                  <>
                    <h3>Chưa cấu hình cổng thanh toán</h3>
                    <p style={{ color: 'var(--ink-4)', fontSize: '.88rem', lineHeight: 1.7 }}>
                      Vui lòng liên hệ Sprouty để được hướng dẫn thanh toán cho đơn{' '}
                      {shortOrderId(order.id)}.
                    </p>
                  </>
                )}

                {/* Shown only when the server said it would accept a payment
                    with no money behind it. It is styled as the test tool it is
                    rather than as a second way to buy, so nobody mistakes it for
                    part of the real checkout. */}
                {canSimulate && (
                  <div className="pay-devbox">
                    <span className="pay-devbox-tag">Chế độ thử nghiệm</span>
                    <p>
                      Máy chủ này đang bật <code>ALLOW_FAKE_PAYMENTS</code>. Bấm nút dưới để ghi
                      nhận đơn là đã thanh toán mà không cần chuyển khoản thật, rồi nhận mã kích
                      hoạt ngay.
                    </p>
                    <button
                      className="pay-devbox-btn"
                      disabled={simulating}
                      onClick={simulatePayment}
                    >
                      {simulating ? 'Đang ghi nhận…' : 'Thanh toán thử & lấy mã ngay'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
