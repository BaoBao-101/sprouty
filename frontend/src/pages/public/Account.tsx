import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import { SproutyIcon } from '@/components/icons/SproutyIcon';
import { Pager } from '@/components/Pager';
import {
  formatOrderDate,
  isVipOrder,
  ORDER_STATUS_CLASS,
  ORDER_STATUS_VN,
  shortOrderId,
  type Order,
  type RedeemCode,
} from '@/types/order';
import { formatPrice } from '@/types/product';
import './Account.css';

/**
 * What happens to an order, now that nothing is posted.
 *
 * The old tracker ran "Chờ thanh toán → Đang xử lý → Đang giao → Đã giao",
 * which promised a courier for a product that is a code on a screen. These are
 * the three things that actually happen, and the last one is a link rather than
 * a milestone we wait to observe — activating is the customer's move to make.
 */
const TRACK_STEPS = [
  { key: 'placed', label: 'Đặt hàng', icon: 'cart' as const },
  { key: 'paid', label: 'Thanh toán', icon: 'ticket' as const },
  { key: 'activate', label: 'Kích hoạt cây', icon: 'sprout' as const },
];

/** A VIP order has no step after paying: the payment is the upgrade. */
const VIP_TRACK_STEPS = [
  { key: 'placed', label: 'Đặt gói', icon: 'cart' as const },
  { key: 'paid', label: 'Thanh toán', icon: 'ticket' as const },
  { key: 'vip', label: 'Lên VIP', icon: 'sparkle' as const },
];


function OrderTrack({ order }: { order: Order }) {
  if (order.status === 'cancelled') {
    return (
      <div className="otrack cancelled">
        <SproutyIcon name="warning" size={18} />
        Đơn hàng đã bị huỷ
      </div>
    );
  }

  const paid = Boolean(order.paidAt);
  const codes = order.redeemCodes || [];
  const vip = isVipOrder(order);
  // The last step is the customer's move, so it completes when they make
  // it. Without this it sat as "current" forever — a plant could be three
  // weeks grown and the order still showed activation as pending.
  // A VIP order has no such move: paying switched it on.
  const activated = vip ? paid : codes.length > 0 && codes.every((c) => c.redeemed);

  // Step 0 is always behind us; paying lights step 1 and opens step 2.
  const reached = activated ? 3 : paid ? 2 : 1;

  return (
    <div className="otrack">
      {(vip ? VIP_TRACK_STEPS : TRACK_STEPS).map((step, i) => (
        <div className="otrack-step" key={step.key}>
          {i > 0 && <span className={`otrack-line${i <= reached ? ' done' : ''}`} />}
          <span className={`otrack-dot${i < reached ? ' done' : i === reached ? ' current' : ''}`}>
            <SproutyIcon name={i < reached ? 'check' : step.icon} size={16} />
          </span>
          <span className="otrack-label">{step.label}</span>
        </div>
      ))}
    </div>
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

  return (
    <div className="ocodes">
      <div className="ocodes-head">
        <SproutyIcon name="seed" size={17} />
        {(() => {
          const left = codes.filter((c) => !c.redeemed).length;
          if (left === 0) return `${codes.length} mã · đã kích hoạt hết`;
          if (codes.length === 1) return 'Mã kích hoạt';
          return `${codes.length} mã kích hoạt · còn ${left} chưa dùng`;
        })()}
      </div>

      {codes.map((code) => (
        // A spent code is shown as spent. Offering "Kích hoạt" on a code that
        // has already produced a plant sends the customer to a form that can
        // only refuse them, and hides the thing they actually want — the plant.
        <div className={`ocode${code.redeemed ? ' used' : ''}`} key={code.code}>
          <div className="ocode-main">
            <span className="ocode-product">
              {code.productName || `Sản phẩm #${code.productId}`}
            </span>
            <code className="ocode-value">{code.code}</code>
            {code.redeemed && (
              <span className="ocode-used-note">
                <SproutyIcon name="check" size={14} />
                {code.kind === 'membership' ? 'Đã kích hoạt gói thành viên' : 'Đã kích hoạt'}
                {code.plantNickname && <> thành “{code.plantNickname}”</>}
                {code.activatedAt && (
                  <> · {new Date(code.activatedAt).toLocaleDateString('vi-VN')}</>
                )}
              </span>
            )}
          </div>
          <div className="ocode-actions">
            {code.redeemed && code.kind === 'membership' ? (
              // Nothing to open: the membership is a set of features on the
              // account, not a page. A "Xem cây" link here led to a garden
              // that does not contain it.
              <Link className="ocode-go" to="/vip">
                Xem quyền lợi
                <SproutyIcon name="arrow-right" size={16} />
              </Link>
            ) : code.redeemed ? (
              <Link className="ocode-go" to={code.plantId ? `/plant/${code.plantId}` : '/my-plants'}>
                Xem cây
                <SproutyIcon name="arrow-right" size={16} />
              </Link>
            ) : (
              <>
                <button className="ocode-copy" type="button" onClick={() => copyCode(code.code)}>
                  Sao chép
                </button>
                <Link className="ocode-go" to="/my-plants">
                  Kích hoạt
                  <SproutyIcon name="arrow-right" size={16} />
                </Link>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function OrderCard({ order, onCancelled }: { order: Order; onCancelled: () => void }) {
  const [cancelling, setCancelling] = useState(false);
  const canAct = order.status === 'pending';
  const codes = order.redeemCodes || [];
  const vip = isVipOrder(order);

  async function cancel() {
    if (!confirm('Bạn chắc chắn muốn hủy đơn hàng này? Hành động này không thể hoàn tác.')) return;
    setCancelling(true);
    try {
      await API.orders.cancel(order.id);
      onCancelled();
    } catch (err: any) {
      showToast(err?.message || 'Không thể hủy đơn hàng. Vui lòng thử lại.', 'error');
      setCancelling(false);
    }
  }

  return (
    <article className={`ocard${canAct ? ' is-pending' : ''}${vip ? ' is-vip' : ''}`}>
      <header className="ocard-top">
        <div className="ocard-id">
          <strong>#{shortOrderId(order.id)}</strong>
          <span>{formatOrderDate(order.createdAt)}</span>
        </div>
        <span className={`ocard-status ${ORDER_STATUS_CLASS[order.status]}`}>
          {ORDER_STATUS_VN[order.status]}
        </span>
      </header>

      <div className="ocard-items">
        {order.items.map((item, i) => (
          <div className="oitem" key={i}>
            <span className="oitem-thumb">
              {vip ? (
                <img src="/assets/images/sprouty-icons/VIP.png" alt="" />
              ) : (
                <SproutyIcon name="pot" size={20} />
              )}
            </span>
            <span className="oitem-name">
              {item.product?.name || 'Sản phẩm'}
              {item.variant === 'smart' && <em className="oitem-variant">Smart</em>}
            </span>
            <span className="oitem-qty">×{item.qty}</span>
            <span className="oitem-price">{formatPrice(item.unitPrice * item.qty)}</span>
          </div>
        ))}
      </div>

      <div className="ocard-sum">
        {vip ? (
          // Nobody to deliver to: say what the order did instead.
          <div className="ocard-buyer">
            <span>Gói thành viên VIP Garden</span>
            <em>{order.paidAt ? 'Đã tự động nâng cấp tài khoản' : 'Tự lên VIP khi thanh toán xong'}</em>
          </div>
        ) : (
          <div className="ocard-buyer">
            <span>{order.shippingName}</span>
            <em>{order.shippingPhone}</em>
          </div>
        )}
        <div className="ocard-total">
          <span>Tổng cộng</span>
          <strong>{formatPrice(order.total)}</strong>
        </div>
      </div>

      {order.note && !vip && (
        <p className="ocard-note">
          <SproutyIcon name="pencil" size={15} />
          {order.note}
        </p>
      )}

      <RedeemCodeList codes={codes} />
      <OrderTrack order={order} />

      {canAct && (
        <div className="ocard-actions">
          <Link
            className="ocard-pay"
            to={`/payment?orderId=${encodeURIComponent(order.id)}`}
          >
            Thanh toán ngay
            <SproutyIcon name="arrow-right" size={17} />
          </Link>
          <button className="ocard-cancel" onClick={cancel} disabled={cancelling}>
            {cancelling ? 'Đang huỷ…' : 'Huỷ đơn'}
          </button>
        </div>
      )}
    </article>
  );
}

export default function Account() {
  const { user, refreshUser } = useAuth();

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
      .catch((err: any) => setError(err?.message || 'Lỗi tải đơn hàng'))
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
  const codeCount = orders.reduce((n, o) => n + (o.redeemCodes?.length || 0), 0);

  const FILTERS: Array<{ value: string; label: string }> = [
    { value: '', label: 'Tất cả' },
    { value: 'pending', label: 'Chờ thanh toán' },
    { value: 'processing', label: 'Đang xử lý' },
    { value: 'delivered', label: 'Hoàn tất' },
    { value: 'cancelled', label: 'Đã huỷ' },
  ];

  return (
    <>
      <div className="acc-hero">
        <div className="container">
          <div className="breadcrumb acc-hero-crumb">
            <Link to="/">Trang chủ</Link> › Đơn hàng của tôi
          </div>
          <div className="acc-hero-row">
            <div className="acc-hero-id">
              <span className="acc-avatar">
                <SproutyIcon name="cart" size={28} />
              </span>
              <div>
                <h1>Đơn hàng của tôi</h1>
                <p>Theo dõi thanh toán, mã kích hoạt và trạng thái từng đơn.</p>
              </div>
            </div>
            <div className="acc-hero-stats">
              <div className="acc-stat">
                <strong>{orderCount}</strong>
                <span>đơn hàng</span>
              </div>
              <div className="acc-stat">
                <strong>{codeCount}</strong>
                <span>mã trang này</span>
              </div>
              <div className="acc-stat">
                <strong>{pendingCount}</strong>
                <span>chờ thanh toán</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container acc-body">
        <div className="acc-orders">
          {/* Filter first: the question a parent opens this page with is
              almost always "cái nào tôi chưa trả tiền?" */}
          {orderCount > 0 && (
            <div className="acc-filters" role="tablist">
              {FILTERS.map((f) => {
                const n = f.value ? counts[f.value] || 0 : orderCount;
                if (f.value && n === 0) return null;
                return (
                  <button
                    key={f.value}
                    role="tab"
                    aria-selected={filter === f.value}
                    className={filter === f.value ? 'active' : ''}
                    onClick={() => pickFilter(f.value)}
                  >
                    {f.label}
                    <em>{n}</em>
                  </button>
                );
              })}
            </div>
          )}

          {loading && <p className="acc-muted">Đang tải đơn hàng…</p>}
          {error && <div className="acc-error">{error}</div>}

          {!loading && !error && orders.length === 0 && (
            <div className="acc-empty">
              <span className="acc-empty-icon">
                <SproutyIcon name="cart" size={38} />
              </span>
              <h3>{filter ? 'Không có đơn nào ở mục này' : 'Bạn chưa có đơn hàng nào'}</h3>
              <p>
                {filter
                  ? 'Chọn “Tất cả” để xem lại toàn bộ đơn hàng của bạn.'
                  : 'Chọn một bộ kit, thanh toán xong là có mã kích hoạt để gieo hạt ngay.'}
              </p>
              {filter ? (
                <button className="btn btn-ghost btn-lg" onClick={() => pickFilter('')}>
                  Xem tất cả đơn
                </button>
              ) : (
                <Link to="/shop" className="btn btn-primary btn-lg">
                  Khám phá sản phẩm
                  <SproutyIcon name="arrow-right" size={18} />
                </Link>
              )}
            </div>
          )}

          {orders.map((order) => (
            <OrderCard key={order.id} order={order} onCancelled={loadOrders} />
          ))}

          <Pager page={page} pages={pages} total={total} unit="đơn hàng" onChange={setPage} />
        </div>
      </div>
    </>
  );
}
