import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { requireLogin } from '@/components/LoginModal';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import type { CartLine } from '@/services/cart';
import { formatPrice } from '@/types/product';
import './CartPage.css';

const FREE_SHIP_MIN = 200_000;
const SHIPPING_FEE = 30_000;

const CATEGORY_BG: Record<string, string> = {
  kit: 'var(--terra-bg)',
  book: 'var(--sage-bg)',
  membership: 'var(--amber-bg)',
};

function lineImage(item: CartLine) {
  const first = item.images?.[0];
  if (first) return first.startsWith('/') ? first : '/' + first;
  return `/assets/images/products/kit-${item.id}.svg`;
}

function CartRow({ item }: { item: CartLine }) {
  const { setQty, remove } = useCart();
  const [failed, setFailed] = useState(false);

  return (
    <div className="cart-item">
      <div className="cart-item-em" style={{ background: CATEGORY_BG[item.cat] ?? 'var(--cream)' }}>
        {failed ? (
          <span className="cart-item-fallback">{item.em || '📦'}</span>
        ) : (
          <img src={lineImage(item)} alt={item.name} onError={() => setFailed(true)} />
        )}
      </div>

      <div className="cart-item-info">
        <div className="cart-item-name">
          {item.name}
          {item.variant === 'smart' && <span className="tag tag-blue cart-variant-tag">Smart</span>}
        </div>
        <div className="cart-item-meta">
          {item.col} · {item.age}
        </div>
        <div className="cart-qty-ctrl">
          <button className="cq-btn" onClick={() => setQty(item.id, item.variant, item.qty - 1)}>
            −
          </button>
          <span className="cq-val">{item.qty}</span>
          <button className="cq-btn" onClick={() => setQty(item.id, item.variant, item.qty + 1)}>
            +
          </button>
        </div>
      </div>

      <div className="cart-item-price-col">
        <div className="cart-item-price">{formatPrice((Number(item.price) || 0) * item.qty)}</div>
        <button className="cart-rm" onClick={() => remove(item.id, item.variant)} title="Xoá khỏi giỏ">
          ✕
        </button>
      </div>
    </div>
  );
}

function ShippingModal({
  needsAddress,
  onClose,
  onDone,
}: {
  needsAddress: boolean;
  onClose: () => void;
  onDone: (orderId: string) => void;
}) {
  const { user } = useAuth();
  const { items, clear } = useCart();

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError('');
    if (!name.trim() || !phone.trim() || (needsAddress && !address.trim())) {
      return setError('Vui lòng điền đầy đủ thông tin.');
    }
    if (!/^[0-9]{9,11}$/.test(phone.trim())) {
      return setError('Số điện thoại không hợp lệ (9–11 chữ số).');
    }
    if (needsAddress && address.trim().length < 10) {
      return setError('Địa chỉ quá ngắn, vui lòng nhập đầy đủ.');
    }

    setBusy(true);
    try {
      const payload = {
        items: items.map((i) => ({
          productId: i.id,
          qty: i.qty,
          variant: i.variant === 'smart' ? 'smart' : 'standard',
        })),
        shippingName: name.trim(),
        shippingPhone: phone.trim(),
        shippingAddress: address.trim() || undefined,
        note: note.trim() || undefined,
      };
      const { order } = await API.orders.create(payload);
      clear();
      onDone(order.id);
    } catch (err: any) {
      setError(err?.message || 'Đặt hàng thất bại. Thử lại sau.');
      setBusy(false);
    }
  }

  const submitLabel = needsAddress ? 'Đặt hàng ngay →' : 'Thanh toán ngay →';

  return (
    <div
      className="adm-modal open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="adm-modal-box" style={{ maxWidth: 440 }}>
        <button className="adm-modal-close" onClick={onClose} aria-label="Đóng">
          ✕
        </button>
        <h2 className="adm-modal-title">
          {needsAddress ? 'Thông tin giao hàng' : 'Xác nhận thanh toán'}
        </h2>

        {!needsAddress && (
          <p className="cart-modal-note">
            Gói VIP kích hoạt ngay sau khi thanh toán — không cần giao hàng.
          </p>
        )}

        <div className="form-group">
          <label className="form-label">Họ tên *</label>
          <input className="form-input" type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">Số điện thoại *</label>
          <input
            className="form-input"
            type="tel"
            placeholder="0901234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        {needsAddress && (
          <div className="form-group">
            <label className="form-label">Địa chỉ giao hàng *</label>
            <textarea
              className="form-input"
              rows={3}
              style={{ resize: 'vertical' }}
              placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Ghi chú (tùy chọn)</label>
          <input
            className="form-input"
            type="text"
            placeholder={needsAddress ? 'Giao buổi chiều, gọi trước khi giao...' : 'Ghi chú thêm (nếu có)'}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {error && <div className="form-error mb-12">{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={onClose}>
            Hủy
          </button>
          <button className="btn btn-primary" style={{ flex: 1 }} disabled={busy} onClick={submit}>
            {busy ? 'Đang xử lý...' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CartPage() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const { items, count, total, clear } = useCart();
  const [shippingOpen, setShippingOpen] = useState(false);

  // VIP is digital: it activates on payment and is never shipped.
  const hasPhysicalItem = items.some((i) => i.cat !== 'membership');
  const freeShipLeft = hasPhysicalItem ? Math.max(0, FREE_SHIP_MIN - total) : 0;
  const shipping = hasPhysicalItem && total < FREE_SHIP_MIN ? SHIPPING_FEE : 0;

  function checkout() {
    if (!isLoggedIn) {
      showToast('Vui lòng đăng nhập để đặt hàng');
      requireLogin();
      return;
    }
    setShippingOpen(true);
  }

  return (
    <>
      <div className="cart-hero">
        <div className="container">
          <div className="breadcrumb cart-hero-crumb">
            <Link to="/">Trang chủ</Link> › Giỏ hàng
          </div>
          <h1>Giỏ hàng</h1>
          <p>{items.length ? `${items.length} sản phẩm trong giỏ` : 'Giỏ hàng trống'}</p>
        </div>
      </div>

      <div className="container">
        {items.length === 0 ? (
          <div className="cart-empty">
            <img src="/assets/images/sprouty-icons/Cart.png" alt="Giỏ hàng trống" />
            <h2>Giỏ hàng đang trống</h2>
            <p>Bạn chưa thêm sản phẩm nào vào giỏ hàng.</p>
            <Link to="/shop" className="btn btn-primary btn-lg">
              Khám phá sản phẩm →
            </Link>
          </div>
        ) : (
          <div className="cart-layout">
            <div>
              {hasPhysicalItem &&
                (freeShipLeft > 0 ? (
                  <div className="notice">
                    🚚 Thêm <strong>{formatPrice(freeShipLeft)}</strong> nữa để được miễn phí vận chuyển!
                  </div>
                ) : (
                  <div className="notice green">
                    🎉 Bạn đã được <strong>miễn phí vận chuyển</strong>!
                  </div>
                ))}

              <div>
                {items.map((item) => (
                  <CartRow key={`${item.id}:${item.variant}`} item={item} />
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--rose)' }}
                  onClick={() => {
                    if (confirm('Xoá tất cả sản phẩm khỏi giỏ hàng?')) clear();
                  }}
                >
                  Xoá toàn bộ giỏ hàng
                </button>
              </div>
            </div>

            <div>
              <div className="order-summary">
                <h3 className="order-summary-title">Tóm tắt đơn hàng</h3>

                <div className="sum-row">
                  <span>Tạm tính ({count} sản phẩm)</span>
                  <strong>{formatPrice(total)}</strong>
                </div>

                <div className="sum-row">
                  <span>Vận chuyển</span>
                  {hasPhysicalItem ? (
                    <strong style={{ color: shipping ? 'var(--ink-2)' : 'var(--green)' }}>
                      {shipping ? formatPrice(shipping) : 'Miễn phí'}
                    </strong>
                  ) : (
                    <strong style={{ color: 'var(--ink-4)' }}>Không áp dụng</strong>
                  )}
                </div>

                <div className="sum-divider" />

                <div className="sum-total">
                  <span className="sum-total-lbl">Tổng cộng</span>
                  <span className="sum-total-val">{formatPrice(total + shipping)}</span>
                </div>

                <button
                  className="btn btn-primary btn-block btn-lg"
                  style={{ marginTop: 20, fontSize: '1rem' }}
                  onClick={checkout}
                >
                  Đặt hàng ngay →
                </button>

                <div style={{ textAlign: 'center', marginTop: 12 }}>
                  <Link to="/shop" className="cart-continue">
                    ← Tiếp tục mua sắm
                  </Link>
                </div>

                <div className="cart-trust">
                  <span>🔒 Thanh toán an toàn</span>
                  <span>🔄 Đổi trả 7 ngày</span>
                  <span>🚚 Giao toàn quốc</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {shippingOpen && (
        <ShippingModal
          needsAddress={hasPhysicalItem}
          onClose={() => setShippingOpen(false)}
          onDone={(orderId) => {
            setShippingOpen(false);
            navigate(`/payment?orderId=${encodeURIComponent(orderId)}`);
          }}
        />
      )}
    </>
  );
}
