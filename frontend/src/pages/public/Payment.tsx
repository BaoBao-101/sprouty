import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import { ORDER_STATUS_VN, shortOrderId, type Order } from '@/types/order';
import { formatPrice } from '@/types/product';
import './Payment.css';

const POLL_MS = 4000;
const MAX_WAIT_MS = 10 * 60 * 1000;

const FEATURE_LABEL: Record<string, string> = {
  instruction_videos: 'Video hướng dẫn',
  image_uploads: 'Upload ảnh',
  ai_assistant: 'Trợ lý AI',
};

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
}

type Phase = 'loading' | 'ready' | 'notfound' | 'timeout';

function copy(text: string) {
  if (!text) return;
  navigator.clipboard?.writeText(text).then(
    () => showToast('Đã sao chép', 'success'),
    () => showToast('Không sao chép được', 'error'),
  );
}

function Row({ label, value, copyable }: { label: string; value?: string; copyable?: boolean }) {
  return (
    <div className="pay-row">
      <span className="lbl">{label}</span>
      <span className="val">{value || '—'}</span>
      {copyable && value && (
        <button className="copy-btn" type="button" onClick={() => copy(value)}>
          📋 Copy
        </button>
      )}
    </div>
  );
}

/**
 * Delivery details, correctable while the order is unpaid.
 *
 * They were captured once at checkout and then frozen. The payment page is the
 * one screen where a customer actually reads them back, and until now spotting
 * a typo there meant phoning support — the parcel was already addressed wrong.
 */
function ShippingBlock({ order, onSaved }: { order: Order; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(order.shippingName || '');
  const [phone, setPhone] = useState(order.shippingPhone || '');
  const [address, setAddress] = useState(order.shippingAddress || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function open() {
    setName(order.shippingName || '');
    setPhone(order.shippingPhone || '');
    setAddress(order.shippingAddress || '');
    setError('');
    setEditing(true);
  }

  async function save() {
    setError('');
    if (name.trim().length < 2) return setError('Nhập tên người nhận.');
    if (!/^[0-9]{9,11}$/.test(phone.trim())) {
      return setError('Số điện thoại không hợp lệ (9–11 chữ số).');
    }
    if (address.trim().length < 10) return setError('Địa chỉ quá ngắn, vui lòng nhập đầy đủ.');

    setBusy(true);
    try {
      const { message } = await API.orders.updateShipping(order.id, {
        shippingName: name.trim(),
        shippingPhone: phone.trim(),
        shippingAddress: address.trim(),
      });
      showToast(message || 'Đã cập nhật địa chỉ', 'success');
      setEditing(false);
      onSaved();
    } catch (err: any) {
      setError(err?.message || 'Không cập nhật được.');
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div className="ord-ship">
        <div className="ord-ship-top">
          <span className="ord-ship-label">Thông tin giao hàng</span>
          <button className="ord-ship-edit" type="button" onClick={open}>
            ✎ Sửa
          </button>
        </div>

        {/* One labelled line each. Name and phone used to run together on a
            single line with the address unlabelled underneath, so nothing said
            which value was which. */}
        <dl className="ord-ship-list">
          <div>
            <dt>👤 Người nhận</dt>
            <dd>{order.shippingName || '—'}</dd>
          </div>
          <div>
            <dt>📞 Điện thoại</dt>
            <dd>{order.shippingPhone || '—'}</dd>
          </div>
          <div>
            <dt>📍 Địa chỉ</dt>
            <dd>{order.shippingAddress || '—'}</dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <div className="ord-ship editing">
      <span className="ord-ship-label">Sửa thông tin giao hàng</span>

      <div className="ord-ship-grid">
        <label className="form-group" style={{ marginBottom: 0 }}>
          <span className="form-label">Người nhận</span>
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

      <label className="form-group" style={{ marginTop: 12, marginBottom: 0 }}>
        <span className="form-label">Địa chỉ giao hàng</span>
        <textarea
          className="form-input"
          rows={2}
          style={{ resize: 'vertical' }}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"
        />
      </label>

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
  const orderId = (searchParams.get('orderId') || '').trim();

  const [order, setOrder] = useState<Order & { redeemCodes?: PurchaseCode[] } | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [hint, setHint] = useState('');
  const startedAt = useRef(Date.now());

  const refresh = useCallback(async () => {
    if (!orderId) {
      setPhase('notfound');
      return 'stop' as const;
    }
    try {
      const { order: fetched, payment: fetchedPayment } = await API.orders.get(orderId);
      if (!fetched) {
        setPhase('notfound');
        return 'stop' as const;
      }
      setOrder(fetched);
      setPayment(fetchedPayment || null);
      setPhase('ready');
      setHint('');
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

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const tick = async () => {
      const outcome = await refresh();
      if (stopped) return;
      if (outcome === 'stop' && timer) clearInterval(timer);
    };

    startedAt.current = Date.now();
    void tick();

    timer = setInterval(() => {
      if (Date.now() - startedAt.current > MAX_WAIT_MS) {
        clearInterval(timer);
        setPhase((p) => (p === 'ready' ? 'timeout' : p));
        return;
      }
      void tick();
    }, POLL_MS);

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
    };
  }, [refresh]);

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
          <div className="pay-layout">
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
                  <div className="ord-head">
                    <span>
                      Mã đơn <strong title={order.id}>{shortOrderId(order.id)}</strong>
                    </span>
                    <span>
                      Trạng thái <strong>{ORDER_STATUS_VN[order.status] ?? order.status}</strong>
                    </span>
                  </div>

                  <div className="ord-items">
                    {order.items?.map((item, i) => (
                      <div className="ord-item" key={i}>
                        <span className="ord-item-emoji">{item.product?.emoji || '📦'}</span>
                        <span className="ord-item-main">
                          <span className="ord-item-name">{item.product?.name || 'Sản phẩm'}</span>
                          <span className="ord-item-sub">
                            {item.variant === 'smart' && 'Bản Smart · '}
                            {formatPrice(item.unitPrice)} × {item.qty}
                          </span>
                        </span>
                        <span className="ord-item-line">
                          {formatPrice(item.unitPrice * item.qty)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="ord-total">
                    <span>Tổng cộng</span>
                    <strong>{formatPrice(order.total)}</strong>
                  </div>

                  <ShippingBlock order={order} onSaved={refresh} />
                </>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <div className="pay-result-emoji">
                    {order.status === 'cancelled' ? '⚠️' : '🎉'}
                  </div>
                  <h2 style={{ color: order.status === 'cancelled' ? 'var(--rose)' : 'var(--green)' }}>
                    {order.status === 'cancelled' ? 'Đơn hàng đã bị hủy' : 'Đã nhận thanh toán'}
                  </h2>
                  <p style={{ color: 'var(--ink-3)' }}>
                    {order.status === 'cancelled'
                      ? `Đơn hàng ${shortOrderId(order.id)} đã bị hủy. Vui lòng liên hệ Sprouty nếu bạn cần hỗ trợ.`
                      : `Đơn hàng ${shortOrderId(order.id)} đã được ghi nhận và đang được xử lý.`}
                  </p>
                  {order.status !== 'cancelled' && (
                    <p style={{ color: 'var(--ink-4)', fontSize: '.86rem' }}>
                      Chúng tôi sẽ giao hàng trong 2–3 ngày làm việc.
                    </p>
                  )}

                  {codes.length > 0 && (
                    <div className="purchase-codes">
                      <div className="purchase-codes-title">Mã kích hoạt sau mua hàng</div>
                      <p className="purchase-codes-note">
                        Dùng mã này để kích hoạt quyền xem video và upload ảnh cho sản phẩm đã mua.
                      </p>
                      {codes.map((code, i) => (
                        <div className="purchase-code-row" key={code.code} data-first={i === 0}>
                          <div>
                            <div className="purchase-code-product">
                              {code.productName || `Sản phẩm #${code.productId}`}
                            </div>
                            <div className="purchase-code-value">{code.code}</div>
                            <div className="purchase-code-features">
                              {(code.features || []).map((f) => FEATURE_LABEL[f] ?? f).join(', ')}
                            </div>
                          </div>
                          <button className="copy-btn" type="button" onClick={() => copy(code.code)}>
                            📋 Copy
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pay-actions">
                    <Link to="/account" className="btn btn-primary btn-lg">
                      Xem đơn hàng
                    </Link>
                    <Link to="/shop" className="btn btn-outline btn-lg">
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
                    <h3>Chuyển khoản</h3>

                    <div className="pay-figure">
                      <span className="pay-figure-label">Số tiền cần chuyển</span>
                      <strong className="pay-figure-amount">{formatPrice(payment.amount)}</strong>
                    </div>

                    <div className="pay-figure">
                      <span className="pay-figure-label">Nội dung chuyển khoản</span>
                      <div className="pay-figure-memo">
                        <code>{payment.memo}</code>
                        <button
                          className="copy-btn"
                          type="button"
                          onClick={() => copy(payment.memo)}
                        >
                          📋
                        </button>
                      </div>
                      <span className="pay-figure-hint">
                        Giữ nguyên nội dung này — hệ thống dựa vào đó để nhận đúng đơn của bạn.
                      </span>
                    </div>

                    <div className="sum-qr">
                      <img src={payment.qrUrl} alt="Mã QR thanh toán" />
                      <span>Quét để điền sẵn số tiền và nội dung</span>
                    </div>

                    <Row label="Ngân hàng" value={payment.bankCode} />
                    <Row label="Số tài khoản" value={payment.accountNumber} copyable />
                    <Row label="Chủ tài khoản" value={payment.accountName} />

                    <div className="pay-warn">
                      <span className="spinner" /> Trang sẽ tự cập nhật khi nhận được thanh toán.
                      {hint && <> {hint}</>}
                    </div>
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
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
