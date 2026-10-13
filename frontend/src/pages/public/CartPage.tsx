import { confirmAction } from '@/services/dialog';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LoginRequiredDialog, type LoginGate } from '@/components/LoginRequiredDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import type { CartLine } from '@/services/cart';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import { editOrder } from '@/services/edit-order';
import { productGalleryImages } from '@/services/product-images';
import { isVipOrder, shortOrderId, type Order } from '@/types/order';
import { formatPrice } from '@/types/product';
import { PromoBanner } from '@/components/PromoBanner';
import { CheckoutSteps } from '@/components/CheckoutSteps';
import { SproutyIcon } from '@/components/icons/SproutyIcon';
import { CartThumb, lineSaving, lineTotal } from '@/components/CartThumb';
import './CartPage.css';

/** The most one order line accepts (backend/src/routes/orders.js). */
const MAX_QTY = 99;

function CartRow({ item }: { item: CartLine }) {
  const { setQty, remove } = useCart();
  const variant = item.variant === 'smart' ? 'smart' : 'standard';
  const meta = [item.col, item.age].filter(Boolean).join(' · ');

  return (
    <li className="ct-line">
      <Link to={`/shop/${item.id}`} className="ct-line-thumb" tabIndex={-1} aria-hidden="true">
        <CartThumb item={item} size={84} />
      </Link>

      <div className="ct-line-info">
        <Link to={`/shop/${item.id}`} className="ct-line-name">{item.name}</Link>
        <span className="ct-line-meta">
          {variant === 'smart' && <b className="ct-tag">Bản Smart</b>}
          {meta}
        </span>
        <span className="ct-line-unit">
          {formatPrice(Number(item.price) || 0)}
          {item.old && item.old > item.price && <s>{formatPrice(item.old)}</s>}
        </span>
      </div>

      <div className="ct-qty" role="group" aria-label={`Số lượng ${item.name}`}>
        <button
          type="button"
          aria-label="Bớt một"
          disabled={item.qty <= 1}
          onClick={() => setQty(item.id, variant, item.qty - 1)}
        >
          <SproutyIcon name="minus" size={15} />
        </button>
        <span aria-live="polite">{item.qty}</span>
        <button
          type="button"
          aria-label="Thêm một"
          disabled={item.qty >= MAX_QTY}
          onClick={() => setQty(item.id, variant, item.qty + 1)}
        >
          <SproutyIcon name="add" size={15} />
        </button>
      </div>

      <div className="ct-line-end">
        <b className="ct-line-total">{formatPrice(lineTotal(item))}</b>
        <button type="button" className="ct-remove" onClick={() => remove(item.id, variant)} aria-label={`Bỏ ${item.name} khỏi giỏ`}>
          <SproutyIcon name="trash" size={15} />
          <span>Xoá</span>
        </button>
      </div>
    </li>
  );
}

/**
 * An order placed but not paid, shown on the cart.
 *
 * Pressing Back on the payment page lands here, and the cart is empty by then
 * — the products became the order. Without this the basket looked lost, and
 * filling it again made a second order beside the first. So the order waiting
 * is named, with the two things to do: pay it, or bring it back into the cart
 * to change it (which cancels it, so only one order is ever waiting).
 */
function PendingOrderNotice({ cartEmpty }: { cartEmpty: boolean }) {
  const { isLoggedIn, ready } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!ready || !isLoggedIn) return setOrders([]);
    API.orders
      .list({ status: 'pending', limit: '10' })
      .then((data: any) => setOrders(((data.orders || []) as Order[]).filter((o) => !isVipOrder(o))))
      .catch(() => setOrders([]));
  }, [ready, isLoggedIn]);
  useEffect(load, [load]);

  const order = orders[0];
  if (!order) return null;
  const units = order.items.reduce((n, i) => n + (i.qty || 1), 0);
  const names = order.items.map((i) => i.product?.name || 'Sản phẩm').join(', ');

  async function bringBack() {
    const ok = await confirmAction(
      `Đơn #${shortOrderId(order.id)} sẽ được huỷ và các sản phẩm về lại giỏ hàng${cartEmpty ? '' : ', gộp với những gì đang có'} — bạn sửa rồi đặt một đơn mới.

Nếu bạn đã chuyển khoản cho đơn này thì đừng làm vậy — hãy mở đơn để chờ xác nhận.`,
      { title: cartEmpty ? 'Sửa đơn hàng?' : 'Gộp đơn vào giỏ?', confirmLabel: cartEmpty ? 'Về giỏ để sửa' : 'Gộp vào giỏ', danger: false },
    );
    if (!ok) return;
    setBusy(true);
    try {
      const { missing } = await editOrder(order.id);
      showToast(
        missing.length ? `${missing.join(', ')} không còn bán nên không thêm lại được.` : 'Sản phẩm đã về giỏ hàng.',
        missing.length ? 'error' : 'success',
      );
      load();
    } catch (err: any) {
      showToast(err?.message || 'Chưa đưa đơn về giỏ được. Vui lòng thử lại.', 'error');
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`ct-pending${cartEmpty ? ' is-big' : ''}`} aria-label="Đơn chưa thanh toán">
      <span className="ct-pending-thumbs" aria-hidden="true">
        {order.items.slice(0, 3).map((item, i) => {
          const src = item.product ? productGalleryImages(item.product)[0] : undefined;
          return (
            <span className="ct-thumb" key={i} style={{ width: 44, height: 44 }}>
              {src ? <img src={src} alt="" /> : <SproutyIcon name="pot" size={18} />}
            </span>
          );
        })}
      </span>
      <div className="ct-pending-text">
        <strong>
          {cartEmpty ? 'Bạn có một đơn chưa thanh toán' : 'Bạn còn một đơn chưa thanh toán'}
          <code>#{shortOrderId(order.id)}</code>
        </strong>
        <span>{units} sản phẩm · {formatPrice(order.total)} · {names}</span>
        {!cartEmpty && <em>Đặt hàng giỏ này sẽ tạo một đơn riêng. Muốn mua chung thì gộp đơn kia vào giỏ.</em>}
        {orders.length > 1 && (
          <Link to="/account" className="ct-pending-more">và {orders.length - 1} đơn khác chưa thanh toán</Link>
        )}
      </div>
      <div className="ct-pending-actions">
        <button type="button" className="btn btn-ghost" onClick={bringBack} disabled={busy}>
          {busy ? 'Đang đưa về…' : cartEmpty ? 'Sửa đơn' : 'Gộp vào giỏ'}
        </button>
        <Link to={`/payment?orderId=${encodeURIComponent(order.id)}`} className="btn btn-primary">
          Thanh toán đơn này
          <SproutyIcon name="arrow-right" size={17} />
        </Link>
      </div>
    </section>
  );
}

/**
 * Step one: the cart. "Đặt hàng" goes on to the checkout page (step two).
 *
 * The lines in one card, the money in a card beside them (and, on a phone,
 * in a bar along the bottom that is always in reach). The count is the
 * number of things being bought, the same figure everywhere — the title used
 * to count lines and the summary units, so a cart could say "1 sản phẩm" and
 * "2 sản phẩm" at once.
 */
export default function CartPage() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const { items, count, total, clear } = useCart();
  const saving = items.reduce((sum, i) => sum + lineSaving(i), 0);

  // Asked before the redirect rather than after it: a checkout that silently
  // turns into a login form reads as the basket having been lost.
  const [gate, setGate] = useState<LoginGate | null>(null);

  function checkout() {
    if (!isLoggedIn) {
      setGate({
        action: 'đặt hàng',
        icon: 'cart',
        reassurance: 'Giỏ hàng của bạn được giữ nguyên.',
        next: '/cart',
      });
      return;
    }
    navigate('/checkout');
  }

  async function clearAll() {
    if (await confirmAction('Bỏ tất cả sản phẩm khỏi giỏ hàng?', { confirmLabel: 'Xoá hết' })) clear();
  }

  return (
    <>
      <section className="ct-hero">
        <div className="container">
          <nav className="ct-crumb" aria-label="Đường dẫn">
            <Link to="/">Trang chủ</Link>
            <span aria-hidden="true">/</span>
            <span>Giỏ hàng</span>
          </nav>
          <h1>Giỏ hàng {count > 0 && <span className="ct-count">{count} sản phẩm</span>}</h1>
          <CheckoutSteps current={0} />
        </div>
      </section>

      <div className="container ct-body">
        <PendingOrderNotice cartEmpty={items.length === 0} />
        {items.length === 0 ? (
          <div className="ct-empty">
            <span className="ct-empty-icon"><SproutyIcon name="cart" size={34} /></span>
            <h2>Giỏ hàng đang trống</h2>
            <p>Chọn một bộ kit, gieo hạt cùng bé và nuôi cây 3D mỗi ngày.</p>
            <Link to="/shop" className="btn btn-primary btn-lg">
              Xem bộ kit
              <SproutyIcon name="arrow-right" size={18} />
            </Link>
          </div>
        ) : (
          <div className="ct-layout">
            <div className="ct-main">
              {/* The basket-side nudge that applies is the workshop reward,
                  and it says how close this order brings the next seat. */}
              <PromoBanner variant="slim" className="ct-promo" />

              <section className="ct-card" aria-label="Sản phẩm trong giỏ">
                <header className="ct-card-head">
                  <h2>Sản phẩm</h2>
                  <button type="button" className="ct-link is-danger" onClick={clearAll}>
                    <SproutyIcon name="trash" size={15} /> Xoá hết
                  </button>
                </header>
                <ul className="ct-lines">
                  {items.map((item) => (
                    <CartRow key={`${item.id}:${item.variant}`} item={item} />
                  ))}
                </ul>
              </section>

              <Link to="/shop" className="ct-back">
                <SproutyIcon name="arrow-right" size={16} />
                Tiếp tục mua sắm
              </Link>
            </div>

            <aside className="ct-summary" aria-label="Tóm tắt đơn hàng">
              <div className="ct-card ct-sum">
                <h2>Tóm tắt đơn hàng</h2>
                <dl className="ct-sum-rows">
                  <div>
                    <dt>Tạm tính ({count} sản phẩm)</dt>
                    <dd>{formatPrice(total + saving)}</dd>
                  </div>
                  {saving > 0 && (
                    <div className="is-saving">
                      <dt>Giảm giá</dt>
                      <dd>−{formatPrice(saving)}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Giao hàng</dt>
                    <dd className="is-muted">Nhập địa chỉ ở bước sau</dd>
                  </div>
                </dl>
                <div className="ct-sum-total">
                  <span>Tổng cộng</span>
                  <strong>{formatPrice(total)}</strong>
                </div>
                {saving > 0 && <p className="ct-sum-saved">Bạn tiết kiệm {formatPrice(saving)}</p>}
                <button type="button" className="btn btn-primary btn-block btn-lg ct-cta" onClick={checkout}>
                  Đặt hàng
                  <SproutyIcon name="arrow-right" size={18} />
                </button>
                <ul className="ct-trust">
                  <li><SproutyIcon name="lock" size={16} /> Chuyển khoản qua mã QR, tự xác nhận</li>
                  <li><SproutyIcon name="return" size={16} /> Hoàn tiền trong 7 ngày</li>
                  <li><SproutyIcon name="bolt" size={16} /> Mã kích hoạt cây có ngay khi thanh toán</li>
                </ul>
              </div>
            </aside>
          </div>
        )}
      </div>

      {/* On a phone the total and the button stay in reach at the bottom. */}
      {items.length > 0 && (
        <div className="ct-bar">
          <span>
            <em>{count} sản phẩm</em>
            <strong>{formatPrice(total)}</strong>
          </span>
          <button type="button" className="btn btn-primary" onClick={checkout}>
            Đặt hàng
            <SproutyIcon name="arrow-right" size={17} />
          </button>
        </div>
      )}

      <LoginRequiredDialog gate={gate} onClose={() => setGate(null)} />
    </>
  );
}
