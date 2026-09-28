import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import {
  formatOrderDate,
  ORDER_STATUS_CLASS,
  ORDER_STATUS_VN,
  shortOrderId,
  type Order,
  type OrderStatus,
  type RedeemCode,
} from '@/types/order';
import { formatPrice } from '@/types/product';
import './Account.css';

const TRACK_STEPS: Array<{ key: OrderStatus; label: string; icon: string }> = [
  { key: 'pending', label: 'Chờ thanh toán', icon: '💳' },
  { key: 'processing', label: 'Đang xử lý', icon: '📋' },
  { key: 'shipped', label: 'Đang giao', icon: '🚚' },
  { key: 'delivered', label: 'Đã giao', icon: '✅' },
];

function OrderTrack({ status }: { status: OrderStatus }) {
  if (status === 'cancelled') {
    return (
      <div className="order-track">
        <div className="track-cancelled">🚫 Đơn hàng đã bị hủy</div>
      </div>
    );
  }

  const current = Math.max(0, TRACK_STEPS.findIndex((s) => s.key === status));

  return (
    <div className="order-track">
      <div className="track-steps">
        {TRACK_STEPS.map((step, i) => (
          <div style={{ display: 'contents' }} key={step.key}>
            <div className={`track-step ${i < current ? 'done' : i === current ? 'current' : ''}`}>
              <div className="track-dot">{step.icon}</div>
              <div className="track-label">{step.label}</div>
            </div>
            {i < TRACK_STEPS.length - 1 && <div className={`track-line ${i < current ? 'done' : ''}`} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function RedeemCodeList({ codes }: { codes: RedeemCode[] }) {
  if (!codes.length) return null;

  function copy(code: string) {
    navigator.clipboard?.writeText(code).then(
      () => showToast('Đã sao chép mã', 'success'),
      () => showToast('Không sao chép được mã', 'error'),
    );
  }

  return (
    <div className="track-note" style={{ alignItems: 'flex-start' }}>
      <div style={{ width: '100%' }}>
        <div className="redeem-codes-title">
          <img src="/assets/images/sprouty-icons/RedeemCode.png" alt="" />
          Mã kích hoạt
        </div>
        {codes.map((code, i) => (
          <div className="redeem-code-row" style={{ marginTop: i ? 8 : 0 }} key={code.code}>
            <div>
              <div className="redeem-code-product">
                {code.productName || `Sản phẩm #${code.productId}`}
              </div>
              <div className="redeem-code-value">{code.code}</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => copy(code.code)}>
              Copy
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrderCard({ order, onCancelled }: { order: Order; onCancelled: () => void }) {
  const [cancelling, setCancelling] = useState(false);
  const canAct = order.status === 'pending';

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
    <div className="order-card">
      <div className="order-header">
        <div>
          <div className="order-id">Đơn #{shortOrderId(order.id)}</div>
          <div className="order-sub">Đặt lúc: {formatOrderDate(order.createdAt)}</div>
          {order.paidAt && (
            <div className="order-sub">Thanh toán: {new Date(order.paidAt).toLocaleString('vi-VN')}</div>
          )}
        </div>
        <span className={`status-badge ${ORDER_STATUS_CLASS[order.status]}`}>
          {ORDER_STATUS_VN[order.status]}
        </span>
      </div>

      <div className="order-items">
        {order.items.map((item, i) => (
          <span className="order-item-chip" key={i}>
            {item.product?.emoji || '📦'} {item.product?.name || 'Sản phẩm'} ×{item.qty}
          </span>
        ))}
      </div>

      <div className="order-footer">
        <div>
          <div className="order-sub">
            Giao đến: {order.shippingName} · {order.shippingPhone}
          </div>
          <div className="order-sub-dim">{order.shippingAddress}</div>
        </div>
        <div className="order-total">{formatPrice(order.total)}</div>
      </div>

      {order.note && (
        <div className="track-note">
          <span>📝 Ghi chú: {order.note}</span>
        </div>
      )}

      <RedeemCodeList codes={order.redeemCodes || []} />
      <OrderTrack status={order.status} />

      {canAct && (
        <div className="order-actions">
          <Link className="btn btn-primary btn-sm" to={`/payment?orderId=${encodeURIComponent(order.id)}`}>
            💳 Thanh toán
          </Link>
          <button className="btn btn-ghost btn-sm" onClick={cancel} disabled={cancelling}>
            {cancelling ? 'Đang hủy...' : '🚫 Hủy đơn'}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Changing your own password. There was no way to do this anywhere in the
 * product: whatever password you first chose was the one you kept, and a staff
 * account created by an admin was stuck on its temporary password forever.
 */
function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setCurrent('');
    setNext('');
    setConfirm('');
    setError('');
    setOpen(false);
  }

  async function submit() {
    setError('');
    if (!current) return setError('Nhập mật khẩu hiện tại.');
    if (next.length < 6) return setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
    if (next !== confirm) return setError('Hai lần nhập mật khẩu mới không khớp.');
    if (next === current) return setError('Mật khẩu mới phải khác mật khẩu hiện tại.');

    setBusy(true);
    try {
      const { message } = await API.auth.changePassword(current, next);
      showToast(message || 'Đã đổi mật khẩu', 'success');
      reset();
    } catch (err: any) {
      setError(err?.message || 'Không đổi được mật khẩu.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="account-security">
        <div>
          <div className="account-security-title">Mật khẩu</div>
          <div className="account-security-hint">
            Đổi mật khẩu định kỳ để giữ tài khoản an toàn.
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
          Đổi mật khẩu
        </button>
      </div>
    );
  }

  return (
    <div className="account-security open">
      <div className="account-security-title" style={{ marginBottom: 14 }}>
        Đổi mật khẩu
      </div>

      <div className="form-group">
        <label className="form-label">Mật khẩu hiện tại</label>
        <input
          className="form-input"
          type={show ? 'text' : 'password'}
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Mật khẩu mới</label>
        <input
          className="form-input"
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="Tối thiểu 6 ký tự"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Nhập lại mật khẩu mới</label>
        <input
          className="form-input"
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
      </div>

      <label className="account-security-show">
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
        Hiện mật khẩu
      </label>

      {error && <div className="form-error mb-12">{error}</div>}

      <div className="account-security-actions">
        <button className="btn btn-ghost btn-sm" onClick={reset} disabled={busy}>
          Hủy
        </button>
        <button className="btn btn-primary btn-sm" onClick={submit} disabled={busy}>
          {busy ? 'Đang đổi…' : 'Đổi mật khẩu'}
        </button>
      </div>

      <p className="account-security-hint" style={{ marginTop: 12 }}>
        Sau khi đổi, các thiết bị khác đang đăng nhập tài khoản này sẽ bị đăng xuất.
      </p>
    </div>
  );
}

export default function Account() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'orders' | 'profile'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOrders = useCallback(() => {
    setLoading(true);
    API.orders
      .list()
      .then((data: any) => {
        setOrders(data.orders || []);
        setError('');
      })
      .catch((err: any) => setError(err?.message || 'Lỗi tải đơn hàng'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(loadOrders, [loadOrders]);

  return (
    <main>
      <div className="container section-sm">
        <h1>Tài khoản của tôi</h1>

        <nav className="account-nav">
          <a
            href="#orders"
            className={tab === 'orders' ? 'active' : ''}
            onClick={(e) => {
              e.preventDefault();
              setTab('orders');
            }}
          >
            📦 Đơn hàng
          </a>
          <a
            href="#profile"
            className={tab === 'profile' ? 'active' : ''}
            onClick={(e) => {
              e.preventDefault();
              setTab('profile');
            }}
          >
            👤 Thông tin
          </a>
        </nav>

        {tab === 'orders' && (
          <div>
            {loading && <p style={{ color: 'var(--ink-4)' }}>Đang tải đơn hàng…</p>}
            {error && <div style={{ color: 'var(--rose)', padding: '20px 0' }}>{error}</div>}

            {!loading && !error && orders.length === 0 && (
              <div className="account-empty">
                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📭</div>
                <p>Bạn chưa có đơn hàng nào.</p>
                <Link to="/shop" className="btn btn-primary" style={{ marginTop: 12, display: 'inline-block' }}>
                  Mua sắm ngay
                </Link>
              </div>
            )}

            {orders.map((order) => (
              <OrderCard key={order.id} order={order} onCancelled={loadOrders} />
            ))}
          </div>
        )}

        {tab === 'profile' && user && (
          <>
            <div className="profile-grid">
              <div className="profile-cell">
                <div className="profile-label">Họ tên</div>
                <div className="profile-value">{user.name}</div>
              </div>
              <div className="profile-cell">
                <div className="profile-label">Email</div>
                <div className="profile-value">{user.email}</div>
              </div>
              <div className="profile-cell">
                <div className="profile-label">Vai trò</div>
                <div className="profile-value" style={{ textTransform: 'capitalize' }}>
                  {user.role}
                </div>
              </div>
            </div>

            <ChangePassword />
          </>
        )}
      </div>
    </main>
  );
}
