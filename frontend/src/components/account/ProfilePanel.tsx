import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, type User } from '@/contexts/AuthContext';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import { formatVipDate, vipDaysLeft } from '@/services/membership';
import { SproutyIcon } from '@/components/icons/SproutyIcon';
import { ChangePassword } from './ChangePassword';
import './ProfilePanel.css';

const ROLE_VN: Record<User['role'], string> = {
  customer: 'Khách hàng',
  employee: 'Nhân viên',
  admin: 'Quản trị viên',
};

function joined(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** One labelled line in a section: what it is, its value, and what can be done. */
function Row({ label, children, action }: { label: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="prf-row">
      <span className="prf-row-label">{label}</span>
      <div className="prf-row-value">{children}</div>
      {action && <div className="prf-row-action">{action}</div>}
    </div>
  );
}

/**
 * "Thông tin": the account, as a page of its own.
 *
 * It was four boxes of read-only text in a grid that filled half the width,
 * with the password below — nothing could be changed except the password,
 * and nothing linked anywhere. Now the left column is who you are at a
 * glance (name, tier, how long you have been here, what you have going on)
 * and the right is what you can change: your name, your membership, your
 * password and your sessions.
 */
export function ProfilePanel() {
  const { user, setUser, logout } = useAuth();
  const [plants, setPlants] = useState<{ growing: number; harvested: number } | null>(null);
  const [workshops, setWorkshops] = useState<number | null>(null);
  const [orders, setOrders] = useState<number | null>(null);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    API.plants
      .list()
      .then((data: any) => {
        if (!live) return;
        const list: Array<{ harvestedAt?: string | null }> = data.plants || [];
        setPlants({
          growing: list.filter((p) => !p.harvestedAt).length,
          harvested: list.filter((p) => p.harvestedAt).length,
        });
      })
      .catch(() => {});
    API.orders
      .list({ page: '1', limit: '1' })
      .then((data: any) => live && setOrders(data.total ?? 0))
      .catch(() => {});
    API.workshops
      .mine()
      .then((data: any) => {
        if (!live) return;
        const rows: Array<{ status?: string }> = data.registrations || [];
        setWorkshops(rows.filter((r) => r.status !== 'cancelled').length);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!user) return null;

  async function saveName() {
    const next = name.trim();
    setError('');
    if (next.length < 2) return setError('Họ tên phải có ít nhất 2 ký tự.');
    if (next === user!.name) return setEditing(false);
    setBusy(true);
    try {
      const data = await API.auth.updateProfile(next);
      setUser({ ...user!, ...data.user });
      showToast(data.message || 'Đã cập nhật họ tên', 'success');
      setEditing(false);
    } catch (err: any) {
      setError(err?.message || 'Không lưu được họ tên.');
    } finally {
      setBusy(false);
    }
  }

  const isCustomer = user.role === 'customer';
  const daysLeft = vipDaysLeft(user.vipUntil);
  const initial = (user.name || '?').trim().slice(0, 1).toUpperCase();

  return (
    <div className="prf">
      {/* ── Who you are ──────────────────────────────────────────────── */}
      <aside className={`prf-card${user.isVip ? ' is-vip' : ''}`}>
        <div className="prf-card-top">
          <span className="prf-avatar">
            {initial}
            {user.isVip && <img src="/assets/images/sprouty-icons/VIP.png" alt="VIP" />}
          </span>
          <strong className="prf-name">{user.name}</strong>
          <span className="prf-email">{user.email}</span>
          {isCustomer ? (
            <span className={`prf-tier${user.isVip ? ' is-vip' : ''}`}>
              {user.isVip ? 'VIP Garden' : 'Tài khoản Thường'}
            </span>
          ) : (
            <span className="prf-tier">{ROLE_VN[user.role]}</span>
          )}
          {user.createdAt && <span className="prf-joined">Thành viên từ {joined(user.createdAt)}</span>}
        </div>

        <div className="prf-stats">
          <Link to="/my-plants" className="prf-stat">
            <b>{plants ? plants.growing : '–'}</b>
            <span>cây đang trồng</span>
          </Link>
          <Link to="/account" className="prf-stat">
            <b>{orders ?? '–'}</b>
            <span>đơn hàng</span>
          </Link>
          <Link to="/my-workshops" className="prf-stat">
            <b>{workshops ?? '–'}</b>
            <span>buổi workshop</span>
          </Link>
        </div>

        <nav className="prf-links" aria-label="Lối tắt">
          <Link to="/account">
            <SproutyIcon name="cart" size={17} /> Đơn hàng của tôi
          </Link>
          <Link to="/my-plants">
            <SproutyIcon name="sprout" size={17} /> Cây của tôi
            {plants?.harvested ? <em>{plants.harvested} đã thu hoạch</em> : null}
          </Link>
          <Link to="/my-workshops">
            <SproutyIcon name="ticket" size={17} /> Workshop của tôi
          </Link>
          <Link to="/vip">
            <SproutyIcon name="sparkle" size={17} /> {user.isVip ? 'Gói VIP của tôi' : 'Nâng cấp VIP Garden'}
          </Link>
        </nav>
      </aside>

      {/* ── What you can change ──────────────────────────────────────── */}
      <div className="prf-sections">
        <section className="prf-section">
          <header>
            <SproutyIcon name="heart" size={20} />
            <div>
              <h3>Thông tin cá nhân</h3>
              <p>Tên hiển thị trên đơn hàng, vé workshop và lời chào của Plant Buddy.</p>
            </div>
          </header>

          <Row
            label="Họ tên"
            action={
              !editing && (
                <button
                  type="button"
                  className="prf-link-btn"
                  onClick={() => {
                    setName(user.name);
                    setError('');
                    setEditing(true);
                  }}
                >
                  <SproutyIcon name="pencil" size={15} /> Sửa
                </button>
              )
            }
          >
            {editing ? (
              <div className="prf-edit">
                <input
                  className="form-input"
                  value={name}
                  maxLength={100}
                  autoFocus
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void saveName();
                    if (e.key === 'Escape') setEditing(false);
                  }}
                />
                <div className="prf-edit-actions">
                  <button type="button" className="btn btn-primary btn-sm" onClick={saveName} disabled={busy}>
                    {busy ? 'Đang lưu…' : 'Lưu'}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)} disabled={busy}>
                    Hủy
                  </button>
                </div>
                {error && <span className="prf-error">{error}</span>}
              </div>
            ) : (
              <strong>{user.name}</strong>
            )}
          </Row>

          <Row
            label="Email đăng nhập"
            action={
              <span className="prf-muted">
                <SproutyIcon name="lock" size={14} /> Không đổi được
              </span>
            }
          >
            <strong className="prf-break">{user.email}</strong>
          </Row>

          <Row label="Vai trò">
            <strong>{ROLE_VN[user.role] ?? user.role}</strong>
          </Row>

          {user.createdAt && (
            <Row label="Ngày tham gia">
              <strong>{joined(user.createdAt)}</strong>
            </Row>
          )}
        </section>

        {isCustomer && (
          <section className={`prf-section prf-member${user.isVip ? ' is-vip' : ''}`}>
            <header>
              <SproutyIcon name="sparkle" size={20} />
              <div>
                <h3>Gói thành viên</h3>
                <p>
                  {user.isVip
                    ? 'Quyền lợi VIP áp dụng cho mọi cây trong vườn của bạn.'
                    : 'Nâng cấp để có thêm không gian cho Cây Kỷ Niệm của bé.'}
                </p>
              </div>
            </header>

            <div className="prf-member-body">
              <div className="prf-member-state">
                <span className="prf-member-badge">
                  {user.isVip ? (
                    <img src="/assets/images/sprouty-icons/VIP.png" alt="" />
                  ) : (
                    <SproutyIcon name="sprout" size={22} />
                  )}
                </span>
                <div>
                  <strong>{user.isVip ? 'VIP Garden' : user.vipExpired ? 'Thường — VIP đã hết hạn' : 'Tài khoản Thường'}</strong>
                  <span>
                    {user.isVip
                      ? `Còn ${daysLeft} ngày · hết hạn ${formatVipDate(user.vipUntil)}`
                      : user.vipExpired
                        ? `Hết hạn ngày ${formatVipDate(user.vipUntil)}`
                        : '10 lá kỷ niệm mỗi kit · 5 lượt hỏi AI mỗi ngày'}
                  </span>
                </div>
                <Link className={`btn ${user.isVip ? 'btn-outline' : 'btn-primary'} btn-sm`} to="/vip">
                  {user.isVip ? 'Gia hạn' : user.vipExpired ? 'Gia hạn VIP' : 'Nâng cấp VIP'}
                </Link>
              </div>
              <ul className="prf-perks">
                {[
                  ['Lá kỷ niệm mỗi kit', user.isVip ? 'Không giới hạn' : '10 lá'],
                  ['Hỏi Plant Buddy AI', user.isVip ? 'Không giới hạn' : '5 lượt / ngày'],
                  ['Khung cảnh & chậu 3D', user.isVip ? '4 cảnh · 4 mẫu chậu' : 'Cảnh và chậu cơ bản'],
                ].map(([label, value]) => (
                  <li key={label}>
                    <span>{label}</span>
                    <b>{value}</b>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <section className="prf-section">
          <header>
            <SproutyIcon name="lock" size={20} />
            <div>
              <h3>Bảo mật</h3>
              <p>Mật khẩu và phiên đăng nhập trên thiết bị này.</p>
            </div>
          </header>
          <ChangePassword />
          <div className="prf-signout">
            <div>
              <strong>Đăng xuất</strong>
              <span>Thoát tài khoản trên thiết bị này.</span>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void logout()}>
              Đăng xuất
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
