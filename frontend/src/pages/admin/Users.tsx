import { confirmAction } from '@/services/dialog';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  FilterPills,
  Modal,
  PageHeader,
  Pagination,
  Panel,
  SearchBox,
  TableStates,
  Toolbar,
  type FilterOption,
  type LoadState,
} from '@/components/admin/ui';
import { useAuth } from '@/contexts/AuthContext';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import { AdminIcon, type AdminIconName } from '@/components/icons/AdminIcon';
import './Users.css';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'employee' | 'admin';
  status: 'active' | 'disabled';
  isVip?: boolean;
  /** When VIP runs out — or ran out, if vipExpired. */
  vipUntil?: string | null;
  vipExpired?: boolean;
  /** Some of the VIP time was given by an admin, so that part can be taken back. */
  vipGifted?: boolean;
  createdAt: string;
}

const vipDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('vi-VN') : '');

type Role = AdminUser['role'];

const ROLES: Role[] = ['customer', 'employee', 'admin'];

const ROLE_LABEL: Record<Role, string> = {
  customer: 'Khách hàng',
  employee: 'Nhân viên',
  admin: 'Quản trị viên',
};

const ROLE_HINT: Record<Role, string> = {
  customer: 'Mua hàng, trồng cây',
  employee: 'Xử lý đơn, điểm danh workshop',
  admin: 'Toàn quyền quản trị',
};

/** Initials for the avatar chip — a name column of plain text all looked alike. */
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const EMPTY_FORM = {
  name: '',
  email: '',
  password: '',
  role: 'customer' as Role,
};

/** A password worth handing over: readable aloud, no ambiguous characters. */
function suggestPassword() {
  const words = ['Cay', 'Hat', 'Nang', 'Mam', 'Vuon', 'La', 'Hoa', 'Dat'];
  const word = words[Math.floor(Math.random() * words.length)];
  const digits = String(Math.floor(1000 + Math.random() * 9000));
  return `Sprouty${word}${digits}`;
}

/**
 * Creating an account for someone.
 *
 * The role comes first, because it decides what the account is for. A new
 * account is always active (a disabled one could not be used, and can be made
 * from the "Quản lý" box later). Once made, the box shows the sign-in details
 * to copy and send, since the password is not shown anywhere again.
 */
function AddUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ name: string; email: string; password: string; role: Role } | null>(null);

  const set = <K extends keyof typeof EMPTY_FORM>(key: K) => (value: (typeof EMPTY_FORM)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    setError('');

    if (form.name.trim().length < 2) return setError('Họ tên phải có ít nhất 2 ký tự.');
    if (!/\S+@\S+\.\S+/.test(form.email)) return setError('Email không đúng định dạng.');
    if (form.password.length < 6) return setError('Mật khẩu phải có ít nhất 6 ký tự.');

    setBusy(true);
    try {
      const { user } = await API.admin.users.create({
        ...form,
        status: 'active',
        name: form.name.trim(),
        email: form.email.trim(),
      });
      setCreated({ name: user.name, email: user.email, password: form.password, role: form.role });
      onCreated();
    } catch (err: any) {
      setError(err?.message || 'Không thể tạo tài khoản.');
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!created) return;
    const text = `Sprouty — ${created.name}\nEmail: ${created.email}\nMật khẩu tạm: ${created.password}\nĐăng nhập: ${location.origin}/login`;
    try {
      await navigator.clipboard.writeText(text);
      showToast('Đã sao chép thông tin đăng nhập', 'success');
    } catch {
      showToast('Không sao chép được — hãy chép tay.', 'error');
    }
  }

  if (created) {
    return (
      <Modal
        title="Đã tạo tài khoản"
        subtitle={`${created.name} · ${ROLE_LABEL[created.role]}`}
        width={520}
        onClose={onClose}
        footer={
          <>
            <button className="btn btn-ghost" onClick={copy}><AdminIcon name="copy" size={16} /> Sao chép</button>
            <button className="btn btn-primary" onClick={onClose}>Xong</button>
          </>
        }
      >
        <div className="usr-created">
          <span className="usr-created-icon"><AdminIcon name="check" size={22} /></span>
          <p>Gửi thông tin này cho người dùng qua kênh riêng. Mật khẩu sẽ không hiện lại sau khi đóng hộp này.</p>
        </div>
        <dl className="usr-creds">
          <div><dt>Email</dt><dd>{created.email}</dd></div>
          <div><dt>Mật khẩu tạm</dt><dd className="is-mono">{created.password}</dd></div>
        </dl>
        <p className="usr-note"><AdminIcon name="info" size={14} /> Nhắc họ đổi mật khẩu sau lần đăng nhập đầu.</p>
      </Modal>
    );
  }

  return (
    <Modal
      title="Thêm người dùng"
      subtitle="Tài khoản dùng được ngay sau khi tạo"
      width={600}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Huỷ
          </button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => submit()}>
            {busy ? 'Đang tạo…' : 'Tạo tài khoản'}
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="usr-form">
        <div className="field">
          <span className="field-label">Vai trò</span>
          <div className="usr-roles" role="radiogroup" aria-label="Vai trò">
            {ROLES.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={form.role === r}
                className={`usr-role${form.role === r ? ' is-on' : ''}`}
                onClick={() => set('role')(r)}
              >
                <strong>{ROLE_LABEL[r]}</strong>
                <em>{ROLE_HINT[r]}</em>
              </button>
            ))}
          </div>
          {form.role === 'customer' && (
            <span className="field-hint">Khách thường tự đăng ký; tạo ở đây khi cần giúp khách lập tài khoản.</span>
          )}
          {form.role === 'admin' && (
            <span className="field-hint usr-warn">Quản trị viên xem và sửa được mọi thứ, kể cả người dùng khác.</span>
          )}
        </div>

        <div className="field-grid">
          <label className="field">
            <span className="field-label">
              Họ và tên <span className="req">*</span>
            </span>
            <input
              className="form-input"
              type="text"
              placeholder="Nguyễn Văn A"
              autoComplete="off"
              value={form.name}
              onChange={(e) => set('name')(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">
              Email <span className="req">*</span>
            </span>
            <input
              className="form-input"
              type="email"
              inputMode="email"
              placeholder="email@example.com"
              autoComplete="off"
              value={form.email}
              onChange={(e) => set('email')(e.target.value)}
            />
          </label>
        </div>

        <label className="field">
          <span className="field-label">
            Mật khẩu tạm <span className="req">*</span>
          </span>
          <span className="usr-password">
            <input
              className="form-input"
              type="text"
              autoComplete="new-password"
              spellCheck={false}
              placeholder="Tối thiểu 6 ký tự"
              value={form.password}
              onChange={(e) => set('password')(e.target.value)}
            />
            <button type="button" className="usr-btn" onClick={() => set('password')(suggestPassword())}>
              <AdminIcon name="spark" size={15} /> Gợi ý
            </button>
          </span>
          <span className="field-hint">Hiện rõ để bạn gửi cho người dùng; họ nên đổi sau lần đăng nhập đầu.</span>
        </label>

        {error && <div className="form-error">{error}</div>}
        {/* Enter in any field creates the account. */}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

/**
 * Setting someone else's password.
 *
 * The FAQ tells customers that support can reset a forgotten password within
 * two hours; until this existed nobody could actually do it. It also unsticks
 * an account locked out by repeated failed logins.
 */
function ResetPasswordModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function suggest() {
    setPassword(suggestPassword());
    setError('');
  }

  async function submit() {
    setError('');
    if (password.length < 6) return setError('Mật khẩu phải có ít nhất 6 ký tự.');

    setBusy(true);
    try {
      const { message } = await API.admin.users.resetPassword(user.id, password);
      showToast(message || 'Đã đặt lại mật khẩu', 'success');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Không đặt lại được mật khẩu.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Đặt lại mật khẩu"
      subtitle={`${user.name} · ${user.email}`}
      width={520}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Hủy
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={submit}>
            {busy ? 'Đang đặt lại…' : 'Đặt lại mật khẩu'}
          </button>
        </>
      }
    >
      <div className="panel-note">
        Mật khẩu mới có hiệu lực ngay. <strong>Mọi phiên đăng nhập</strong> của người này sẽ bị
        đăng xuất, và nếu tài khoản đang bị khoá do nhập sai nhiều lần thì khoá cũng được gỡ.
        Hãy gửi mật khẩu này cho họ qua kênh riêng và nhắc họ tự đổi lại.
      </div>

      <label className="field">
        <span className="field-label">
          Mật khẩu mới <span className="req">*</span>
        </span>
        <input
          className="form-input"
          type="text"
          placeholder="Tối thiểu 6 ký tự"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <span className="field-hint">
          Hiển thị rõ để bạn gửi lại cho người dùng.{' '}
          <button type="button" className="link-btn" onClick={suggest}>
            Gợi ý mật khẩu
          </button>
        </span>
      </label>

      {error && <div className="form-error">{error}</div>}
    </Modal>
  );
}

type Filter = '' | 'customer' | 'vip' | 'staff' | 'disabled';

const PAGE_SIZE = 10;

const dayMonthYear = (iso: string) => new Date(iso).toLocaleDateString('vi-VN');

/** The plan line under a customer: VIP until when, and whether it was a gift. */
function PlanLine({ user }: { user: AdminUser }) {
  if (user.role !== 'customer') return <span className="usr-plan is-none">—</span>;
  if (user.isVip) {
    return (
      <span className="usr-plan is-vip">
        <AdminIcon name="star" size={14} />
        <span>
          VIP đến {vipDate(user.vipUntil)}
          {user.vipGifted && <em>Có phần được tặng</em>}
        </span>
      </span>
    );
  }
  if (user.vipExpired) return <span className="usr-plan is-expired">VIP hết hạn {vipDate(user.vipUntil)}</span>;
  return <span className="usr-plan">Thường</span>;
}

/**
 * Everything an admin can do to one account, in one place.
 *
 * The table used to carry a role dropdown and three bordered buttons on every
 * row: one slip of the mouse changed someone's role, and "Thu hồi VIP" sat
 * in red beside customers who had paid for their VIP and had nothing that
 * could be taken back. Here each action says what it will do and when it
 * cannot be done, and the risky ones sit at the bottom.
 */
function ManageUserModal({
  user,
  isSelf,
  busy,
  onClose,
  onRole,
  onGrantVip,
  onRevokeVip,
  onToggleStatus,
  onResetPassword,
}: {
  user: AdminUser;
  isSelf: boolean;
  busy: boolean;
  onClose: () => void;
  onRole: (role: Role) => void;
  onGrantVip: () => void;
  onRevokeVip: () => void;
  onToggleStatus: () => void;
  onResetPassword: () => void;
}) {
  const [role, setRole] = useState<Role>(user.role);
  useEffect(() => setRole(user.role), [user.role]);
  const active = user.status === 'active';
  const vipLocked = user.role === 'customer' && Boolean(user.isVip);
  const roleBlocked = isSelf
    ? 'Bạn không thể đổi vai trò của chính mình.'
    : vipLocked
      ? 'Khách còn VIP nên giữ vai trò khách hàng. Cần làm nhân sự thì tạo tài khoản riêng.'
      : '';

  return (
    <Modal
      title={user.name}
      subtitle={user.email}
      width={620}
      onClose={onClose}
      footer={<button className="btn btn-ghost" onClick={onClose}>Đóng</button>}
    >
      <div className="usr-summary">
        <div><span>Vai trò</span><b>{ROLE_LABEL[user.role]}</b></div>
        <div><span>Gói</span><b><PlanLine user={user} /></b></div>
        <div>
          <span>Trạng thái</span>
          <b className={`usr-state is-${user.status}`}><i />{active ? 'Hoạt động' : 'Vô hiệu'}</b>
        </div>
        <div><span>Ngày tạo</span><b>{dayMonthYear(user.createdAt)}</b></div>
      </div>

      <section className="usr-section">
        <h3>Vai trò</h3>
        <div className="usr-roles" role="radiogroup" aria-label="Vai trò">
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={role === r}
              className={`usr-role${role === r ? ' is-on' : ''}`}
              disabled={Boolean(roleBlocked) || busy}
              onClick={() => setRole(r)}
            >
              <strong>{ROLE_LABEL[r]}</strong>
              <em>{ROLE_HINT[r]}</em>
            </button>
          ))}
        </div>
        {roleBlocked ? (
          <p className="usr-note"><AdminIcon name="info" size={14} /> {roleBlocked}</p>
        ) : role !== user.role ? (
          <div className="usr-save">
            <span>Đổi sang <b>{ROLE_LABEL[role]}</b> sẽ đăng xuất mọi phiên của tài khoản này.</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setRole(user.role)}>Huỷ</button>
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => onRole(role)}>Lưu vai trò</button>
          </div>
        ) : null}
      </section>

      {user.role === 'customer' && (
        <section className="usr-section">
          <h3>VIP Garden</h3>
          {user.isVip ? (
            <div className="usr-row">
              <span>
                <b>VIP đến {vipDate(user.vipUntil)}</b>
                <em>
                  {user.vipGifted
                    ? 'Có phần do quản trị viên tặng. Thu hồi chỉ bỏ phần tặng; thời gian khách tự mua vẫn giữ nguyên.'
                    : 'Khách tự mua — thời gian đã mua không thu hồi được.'}
                </em>
              </span>
              {user.vipGifted && (
                <button className="usr-btn is-danger" disabled={busy} onClick={onRevokeVip}>Thu hồi phần tặng</button>
              )}
            </div>
          ) : (
            <div className="usr-row">
              <span>
                <b>{user.vipExpired ? `VIP đã hết hạn ${vipDate(user.vipUntil)}` : 'Tài khoản Thường'}</b>
                <em>
                  {active
                    ? 'Tặng một gói VIP (gói rẻ nhất đang bán). Không tính vào doanh thu.'
                    : 'Kích hoạt lại tài khoản trước khi tặng VIP.'}
                </em>
              </span>
              <button className="usr-btn is-vip" disabled={busy || !active} onClick={onGrantVip}>
                <AdminIcon name="star" size={15} /> Tặng VIP
              </button>
            </div>
          )}
        </section>
      )}

      <section className="usr-section">
        <h3>Mật khẩu</h3>
        <div className="usr-row">
          <span>
            <b>Đặt lại mật khẩu</b>
            <em>
              {isSelf
                ? 'Đổi mật khẩu của bạn ở mục “Đổi mật khẩu”.'
                : 'Khi khách quên mật khẩu hoặc bị khoá do nhập sai nhiều lần.'}
            </em>
          </span>
          <button className="usr-btn" disabled={busy || isSelf} onClick={onResetPassword}>
            <AdminIcon name="lock" size={15} /> Đặt lại
          </button>
        </div>
      </section>

      <section className={`usr-section${active ? ' is-danger' : ''}`}>
        <h3>Tài khoản</h3>
        <div className="usr-row">
          <span>
            <b>{active ? 'Vô hiệu hoá tài khoản' : 'Kích hoạt lại tài khoản'}</b>
            <em>
              {isSelf
                ? 'Bạn không thể khoá chính mình.'
                : active
                  ? 'Không đăng nhập được nữa; đơn hàng, cây và lịch sử vẫn được giữ.'
                  : 'Cho phép đăng nhập trở lại.'}
            </em>
          </span>
          <button
            className={`usr-btn${active ? ' is-danger' : ' is-primary'}`}
            disabled={busy || isSelf}
            onClick={onToggleStatus}
          >
            {active ? 'Vô hiệu hoá' : 'Kích hoạt'}
          </button>
        </div>
      </section>
    </Modal>
  );
}

export default function Users() {
  const { user: currentUser } = useAuth();
  const requestId = useRef(0);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [resetting, setResetting] = useState<AdminUser | null>(null);
  const [managingId, setManagingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Filtering happens on the server now that the list is paged — doing it here
  // would only ever filter the 20 rows currently in hand.
  const load = useCallback(() => {
    const id = ++requestId.current;
    setState('loading');
    const params: Record<string, unknown> = { page, limit: PAGE_SIZE };
    if (search) params.search = search;
    if (filter === 'vip') params.vip = '1';
    else if (filter === 'disabled') params.status = 'disabled';
    else if (filter) params.role = filter;

    API.admin.users
      .list(params)
      .then((data: any) => {
        if (id !== requestId.current) return;
        setUsers(data.users || []);
        setCounts(data.counts || {});
        setPages(data.pages || 1);
        setTotal(data.total || 0);
        setState('ready');
      })
      .catch((err: any) => {
        if (id !== requestId.current) return;
        setError(err?.message || 'Không tải được danh sách.');
        setState('error');
      });
  }, [page, filter, search]);

  useEffect(load, [load]);

  // The open account is read from the list, so it shows what a reload brought.
  const managing = managingId ? users.find((u) => u.id === managingId) || null : null;
  const isSelf = (user: AdminUser) => user.id === String(currentUser?.id);

  async function run(user: AdminUser, action: () => Promise<any>) {
    setBusyId(user.id);
    try {
      await action();
      load();
    } catch (err: any) {
      showToast(`Lỗi: ${err?.message}`, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function changeRole(user: AdminUser, role: Role) {
    if (
      role === user.role ||
      !await confirmAction(
        `Đổi ${user.name} sang ${ROLE_LABEL[role]}?\n\nCác phiên đăng nhập sẽ bị thu hồi. Tài khoản chỉ dùng được chức năng của vai trò mới.`,
        { title: 'Đổi vai trò', confirmLabel: 'Đổi vai trò' },
      )
    )
      return;
    run(user, async () => {
      await API.admin.users.update(user.id, { role });
      showToast(`Đã đổi vai trò thành ${ROLE_LABEL[role]}`, 'success');
    });
  }

  async function toggleStatus(user: AdminUser) {
    const next = user.status === 'active' ? 'disabled' : 'active';
    const message =
      next === 'disabled'
        ? `Vô hiệu hoá tài khoản của ${user.name}?\n\nHọ sẽ không thể đăng nhập, nhưng đơn hàng và lịch sử vẫn được giữ.`
        : `Kích hoạt lại tài khoản của ${user.name}?\n\nHọ sẽ có thể đăng nhập trở lại.`;
    if (!await confirmAction(message, { confirmLabel: next === 'disabled' ? 'Vô hiệu hoá' : 'Kích hoạt' })) return;

    run(user, async () => {
      await API.admin.users.update(user.id, { status: next });
      showToast(
        next === 'disabled' ? `Đã vô hiệu hoá ${user.name}` : `Đã kích hoạt ${user.name}`,
        'success',
      );
    });
  }

  async function grantVip(user: AdminUser) {
    if (
      user.status !== 'active' ||
      !await confirmAction(`Tặng VIP cho ${user.name}?\n\nKhông ghi nhận doanh thu cho quyền lợi miễn phí này.`, {
        title: 'Tặng VIP',
        confirmLabel: 'Tặng VIP',
      })
    )
      return;
    run(user, async () => {
      const { message } = await API.admin.users.grantVip(user.id);
      showToast(message, 'success');
    });
  }

  async function revokeVip(user: AdminUser) {
    if (
      !await confirmAction(
        `Thu hồi phần VIP được tặng của ${user.name}?\n\nThời gian khách tự mua vẫn được giữ nguyên.`,
        { confirmLabel: 'Thu hồi phần tặng' },
      )
    )
      return;
    run(user, async () => {
      const { message } = await API.admin.users.revokeVip(user.id);
      showToast(message, 'success');
    });
  }

  const pick = (next: Filter) => { setFilter(next); setPage(1); };
  const ready = state === 'ready' || Object.keys(counts).length > 0;
  const n = (value?: number) => (ready ? (value ?? 0).toLocaleString('vi-VN') : '—');
  const staff = (counts.employee ?? 0) + (counts.admin ?? 0);

  const kpis: Array<{ key: Filter; icon: AdminIconName; tone: string; value: string; label: string; hint: string }> = [
    { key: '', icon: 'users', tone: 'blue', value: n(counts.all), label: 'Tài khoản', hint: `+${n(counts.newWeek)} trong 7 ngày qua` },
    { key: 'vip', icon: 'star', tone: 'amber', value: n(counts.vip), label: 'Khách VIP', hint: `Trên ${n(counts.customer)} khách hàng` },
    { key: 'staff', icon: 'shield', tone: 'green', value: n(staff), label: 'Nhân sự', hint: `${n(counts.admin)} quản trị · ${n(counts.employee)} nhân viên` },
    { key: 'disabled', icon: 'lock', tone: 'rose', value: n(counts.disabled), label: 'Bị vô hiệu', hint: 'Không đăng nhập được' },
  ];

  // Counts come from the server and span the whole table, so the numbers on the
  // filter buttons stay put as you click between them.
  const filters: Array<FilterOption<Filter>> = [
    { value: '', label: 'Tất cả', count: counts.all },
    { value: 'customer', label: 'Khách hàng', count: counts.customer },
    { value: 'vip', label: 'VIP', count: counts.vip },
    { value: 'staff', label: 'Nhân sự', count: staff },
    { value: 'disabled', label: 'Vô hiệu', count: counts.disabled },
  ];

  return (
    <>
      <PageHeader
        title="Người dùng"
        subtitle="Khách hàng và nhân sự. Bấm vào một tài khoản để đổi vai trò, tặng VIP hay đặt lại mật khẩu."
        actions={
          <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
            <AdminIcon name="plus" size={16} /> Thêm người dùng
          </button>
        }
      />

      <div className="ax-kpis">
        {kpis.map((k) => (
          <button
            type="button"
            key={k.label}
            className={`ax-kpi tone-${k.tone}${filter === k.key ? ' is-active' : ''}`}
            aria-pressed={filter === k.key}
            onClick={() => pick(k.key)}
          >
            <span className="ax-kpi-icon"><AdminIcon name={k.icon} size={18} /></span>
            <span className="ax-kpi-body">
              <b>{k.value}</b>
              <strong>{k.label}</strong>
              <em>{k.hint}</em>
            </span>
          </button>
        ))}
      </div>

      <Toolbar>
        <FilterPills options={filters} value={filter} onChange={pick} />
        <SearchBox
          value={search}
          placeholder="Tìm theo tên hoặc email…"
          onChange={(next) => { setSearch(next); setPage(1); }}
        />
      </Toolbar>

      <Panel flush>
        <div className="usr-table-scroll">
          <table className="admin-table usr-table">
            <thead>
              <tr>
                <th>Người dùng</th>
                <th>Vai trò</th>
                <th>Gói</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
                <th aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody>
              <TableStates
                state={state}
                error={error}
                isEmpty={users.length === 0}
                columns={6}
                emptyIcon={<AdminIcon name="users" size={24} />}
                emptyTitle={search || filter ? 'Không tìm thấy ai' : 'Chưa có người dùng'}
                emptyHint={search || filter ? 'Thử bỏ bộ lọc hoặc đổi từ khoá.' : undefined}
                onRetry={load}
              />
              {state === 'ready' &&
                users.map((user) => (
                  <tr
                    key={user.id}
                    className={`usr-row-link${busyId === user.id ? ' row-busy' : ''}${user.status === 'disabled' ? ' is-disabled' : ''}`}
                    onClick={() => setManagingId(user.id)}
                  >
                    <td>
                      <div className="usr-cell">
                        <span className={`usr-avatar is-${user.role}`}>{initials(user.name)}</span>
                        <span className="usr-who">
                          <span className="usr-name">
                            {user.name}
                            {isSelf(user) && <span className="usr-you">Bạn</span>}
                          </span>
                          <span className="usr-email">{user.email}</span>
                        </span>
                      </div>
                    </td>
                    <td><span className={`usr-role-pill is-${user.role}`}>{ROLE_LABEL[user.role]}</span></td>
                    <td><PlanLine user={user} /></td>
                    <td>
                      <span className={`usr-state is-${user.status}`}>
                        <i />{user.status === 'active' ? 'Hoạt động' : 'Vô hiệu'}
                      </span>
                    </td>
                    <td className="usr-date">{dayMonthYear(user.createdAt)}</td>
                    <td className="usr-actions">
                      <button
                        className="usr-btn"
                        onClick={(e) => { e.stopPropagation(); setManagingId(user.id); }}
                      >
                        Quản lý
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Pagination
        page={page}
        pages={pages}
        total={total}
        unit="tài khoản"
        onChange={setPage}
      />

      {managing && !resetting && (
        <ManageUserModal
          user={managing}
          isSelf={isSelf(managing)}
          busy={busyId !== null}
          onClose={() => setManagingId(null)}
          onRole={(role) => changeRole(managing, role)}
          onGrantVip={() => grantVip(managing)}
          onRevokeVip={() => revokeVip(managing)}
          onToggleStatus={() => toggleStatus(managing)}
          onResetPassword={() => setResetting(managing)}
        />
      )}
      {addOpen && <AddUserModal onClose={() => setAddOpen(false)} onCreated={load} />}
      {resetting && <ResetPasswordModal user={resetting} onClose={() => setResetting(null)} />}
    </>
  );
}
