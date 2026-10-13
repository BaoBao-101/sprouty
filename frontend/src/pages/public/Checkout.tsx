import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import { readRememberedContact, rememberContact } from '@/services/checkout-contact';
import { formatPrice } from '@/types/product';
import { CheckoutSteps } from '@/components/CheckoutSteps';
import { CartThumb, lineSaving, lineTotal } from '@/components/CartThumb';
import { SproutyIcon } from '@/components/icons/SproutyIcon';
import {
  AddressFields,
  EMPTY_ADDRESS,
  joinAddress,
  missingAddressField,
  splitAddress,
  type AddressParts,
} from '@/components/AddressFields';
import './CartPage.css';
import './Checkout.css';

type FieldErrors = Partial<Record<'name' | 'phone' | 'address', string>>;

/**
 * Step two: who receives the order, and where.
 *
 * Its own page rather than a dialog over the cart: a form this long scrolled
 * inside a box, the summary it needed was behind the overlay, and the back
 * button closed nothing. The order is created here — the payment page needs
 * an order to make its QR code — and the cart is emptied once it exists.
 *
 * Each problem is said under the box it belongs to, and what was typed last
 * time on this device comes back, so a second order is check-and-continue.
 */
export default function Checkout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, count, total, clear } = useCart();
  const [remembered, setRemembered] = useState(() => readRememberedContact(user?.id));

  const [name, setName] = useState(remembered?.name || user?.name || '');
  const [phone, setPhone] = useState(remembered?.phone || '');
  const [address, setAddress] = useState<AddressParts>(() => (remembered?.address ? splitAddress(remembered.address) : EMPTY_ADDRESS));
  // Opened straight from a link, the account may arrive after the first
  // render; fill in from it then, unless the customer has started typing.
  const typed = useRef(false);
  useEffect(() => {
    if (!user || typed.current) return;
    const found = readRememberedContact(user.id);
    setRemembered(found);
    setName(found?.name || user.name || '');
    if (found) {
      setPhone(found.phone);
      setAddress(splitAddress(found.address));
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
  // Set once the order exists, so emptying the cart does not flash the
  // "giỏ hàng trống" screen on the way to the payment page.
  const [placed, setPlaced] = useState(false);

  const saving = items.reduce((sum, i) => sum + lineSaving(i), 0);

  async function submit() {
    const next: FieldErrors = {};
    if (name.trim().length < 2) next.name = 'Nhập họ tên người nhận.';
    if (!/^[0-9]{9,11}$/.test(phone.trim())) next.phone = 'Số điện thoại gồm 9–11 chữ số.';
    // Names the empty box rather than "thiếu thông tin".
    const missing = missingAddressField(address);
    if (missing) next.address = missing;
    setErrors(next);
    setFailure('');
    if (Object.keys(next).length) {
      document.querySelector('.ck-form [aria-invalid="true"], .ck-form .has-error')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }

    setBusy(true);
    try {
      const { order } = await API.orders.create({
        items: items.map((i) => ({
          productId: i.id,
          qty: i.qty,
          variant: i.variant === 'smart' ? 'smart' : 'standard',
        })),
        shippingName: name.trim(),
        shippingPhone: phone.trim(),
        shippingAddress: joinAddress(address) || undefined,
        note: note.trim() || undefined,
      });
      rememberContact(user?.id, { name: name.trim(), phone: phone.trim(), address: joinAddress(address) });
      setPlaced(true);
      clear();
      navigate(`/payment?orderId=${encodeURIComponent(order.id)}`, { replace: true });
    } catch (err: any) {
      const message = err?.message || 'Đặt hàng chưa được. Vui lòng thử lại.';
      setFailure(message);
      // On a phone the summary holding this message is below the fold.
      showToast(message, 'error');
      setBusy(false);
    }
  }

  if (!items.length && !placed) {
    return (
      <div className="container ct-body">
        <div className="ct-empty">
          <span className="ct-empty-icon"><SproutyIcon name="cart" size={34} /></span>
          <h2>Giỏ hàng đang trống</h2>
          <p>Thêm một bộ kit vào giỏ rồi quay lại đây để nhập thông tin nhận hàng.</p>
          <Link to="/shop" className="btn btn-primary btn-lg">
            Xem bộ kit
            <SproutyIcon name="arrow-right" size={18} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <section className="ct-hero">
        <div className="container">
          <nav className="ct-crumb" aria-label="Đường dẫn">
            <Link to="/">Trang chủ</Link>
            <span aria-hidden="true">/</span>
            <Link to="/cart">Giỏ hàng</Link>
            <span aria-hidden="true">/</span>
            <span>Thông tin nhận hàng</span>
          </nav>
          <h1>Thông tin nhận hàng</h1>
          <CheckoutSteps current={1} />
        </div>
      </section>

      <div className="container ct-body">
        <div className="ct-layout">
          <div className="ck-form">
            <section className="ct-card ck-section">
              <header className="ck-section-head">
                <span className="ck-section-icon"><SproutyIcon name="user" size={18} /></span>
                <div>
                  <h2>Người nhận</h2>
                  <p>Người giao hàng gọi số này khi tới nơi.</p>
                </div>
              </header>
              <div className="ck-grid">
                <label className={`form-group${errors.name ? ' has-error' : ''}`}>
                  <span className="form-label">Họ tên *</span>
                  <input
                    className="form-input"
                    type="text"
                    autoComplete="name"
                    value={name}
                    aria-invalid={Boolean(errors.name)}
                    onChange={(e) => { typed.current = true; setName(e.target.value); setErrors((x) => ({ ...x, name: undefined })); }}
                  />
                  {errors.name && <span className="ct-field-error">{errors.name}</span>}
                </label>
                <label className={`form-group${errors.phone ? ' has-error' : ''}`}>
                  <span className="form-label">Số điện thoại *</span>
                  <input
                    className="form-input"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="0901234567"
                    value={phone}
                    aria-invalid={Boolean(errors.phone)}
                    onChange={(e) => { typed.current = true; setPhone(e.target.value.replace(/[^\d]/g, '').slice(0, 11)); setErrors((x) => ({ ...x, phone: undefined })); }}
                  />
                  {errors.phone && <span className="ct-field-error">{errors.phone}</span>}
                </label>
              </div>
            </section>

            <section className={`ct-card ck-section${errors.address ? ' has-error' : ''}`}>
              <header className="ck-section-head">
                <span className="ck-section-icon"><SproutyIcon name="pin" size={18} /></span>
                <div>
                  <h2>Địa chỉ giao hàng</h2>
                  <p>Phường/xã và tỉnh/thành theo địa giới mới (không còn quận/huyện).</p>
                </div>
              </header>
              <AddressFields value={address} onChange={(next) => { typed.current = true; setAddress(next); setErrors((x) => ({ ...x, address: undefined })); }} />
              {errors.address && <span className="ct-field-error" role="alert">{errors.address}</span>}
            </section>

            <section className="ct-card ck-section">
              <header className="ck-section-head">
                <span className="ck-section-icon"><SproutyIcon name="pencil" size={17} /></span>
                <div>
                  <h2>Ghi chú <em>(không bắt buộc)</em></h2>
                  <p>Lời nhắn cho người giao hàng.</p>
                </div>
              </header>
              <textarea
                className="form-input ck-note"
                rows={3}
                maxLength={300}
                placeholder="Giao buổi chiều, gọi trước khi giao…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </section>

            {remembered && (
              <p className="ct-remember"><SproutyIcon name="info" size={14} /> Đã điền sẵn thông tin bạn dùng lần trước trên máy này.</p>
            )}
          </div>

          <aside className="ct-summary" aria-label="Đơn hàng">
            <div className="ct-card ct-sum">
              <div className="ck-sum-head">
                <h2>Đơn hàng ({count})</h2>
                <Link to="/cart" className="ck-edit">Sửa giỏ hàng</Link>
              </div>
              <ul className="ck-lines">
                {items.map((item) => (
                  <li key={`${item.id}:${item.variant}`}>
                    <span className="ck-thumb">
                      <CartThumb item={item} size={52} />
                      {item.qty > 1 && <em>{item.qty}</em>}
                    </span>
                    <span className="ck-line-text">
                      <b>{item.name}</b>
                      <span>
                        {item.variant === 'smart' && 'Bản Smart · '}
                        {formatPrice(Number(item.price) || 0)}{item.qty > 1 ? ` × ${item.qty}` : ''}
                      </span>
                    </span>
                    <strong>{formatPrice(lineTotal(item))}</strong>
                  </li>
                ))}
              </ul>
              <dl className="ct-sum-rows">
                <div>
                  <dt>Tạm tính</dt>
                  <dd>{formatPrice(total + saving)}</dd>
                </div>
                {saving > 0 && (
                  <div className="is-saving">
                    <dt>Giảm giá</dt>
                    <dd>−{formatPrice(saving)}</dd>
                  </div>
                )}
                <div>
                  <dt>Phí giao hàng</dt>
                  <dd>Không tính thêm</dd>
                </div>
              </dl>
              <div className="ct-sum-total">
                <span>Tổng thanh toán</span>
                <strong>{formatPrice(total)}</strong>
              </div>
              {failure && <div className="form-error ck-failure" role="alert">{failure}</div>}
              <button type="button" className="btn btn-primary btn-block btn-lg ct-cta" disabled={busy} onClick={submit}>
                {busy ? 'Đang tạo đơn…' : 'Tới bước thanh toán'}
                {!busy && <SproutyIcon name="arrow-right" size={18} />}
              </button>
              <p className="ck-next"><SproutyIcon name="lock" size={14} /> Bước sau: quét mã QR để chuyển khoản, trang tự xác nhận.</p>
            </div>
          </aside>
        </div>
      </div>

      {/* On a phone the total and the button stay in reach at the bottom. */}
      <div className="ct-bar">
        <span>
          <em>Tổng thanh toán</em>
          <strong>{formatPrice(total)}</strong>
        </span>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={submit}>
          {busy ? 'Đang tạo đơn…' : 'Thanh toán'}
          {!busy && <SproutyIcon name="arrow-right" size={17} />}
        </button>
      </div>
    </>
  );
}
