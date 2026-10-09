import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  FilterPills,
  Modal,
  PageHeader,
  Pagination,
  Panel,
  Pill,
  SearchBox,
  StatCard,
  StatGrid,
  TableStates,
  Toolbar,
  type FilterOption,
  type LoadState,
} from '@/components/admin/ui';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import { AdminIcon } from '@/components/icons/AdminIcon';

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

const ROLE_TONE: Record<Role, string> = {
  customer: 'grey',
  employee: 'blue',
  admin: 'orange',
};

const EMPTY_FORM = {
  name: '',
  email: '',
  password: '',
  role: 'customer',
  status: 'active',
};

/** Initials for the avatar chip — a name column of plain text all looked alike. */
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function AddUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof EMPTY_FORM) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (form.name.trim().length < 2) return setError('Họ tên phải có ít nhất 2 ký tự.');
    if (!/\S+@\S+\.\S+/.test(form.email)) return setError('Email không đúng định dạng.');
    if (form.password.length < 6) return setError('Mật khẩu phải có ít nhất 6 ký tự.');

    setBusy(true);
    try {
      const { user } = await API.admin.users.create({
        ...form,
        name: form.name.trim(),
        email: form.email.trim(),
      });
      showToast(`Đã tạo tài khoản ${user.name}`, 'success');
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Không thể tạo tài khoản.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Thêm người dùng"
      subtitle="Tài khoản dùng được ngay sau khi tạo"
      width={520}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Hủy
          </button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={submit}>
            {busy ? 'Đang tạo…' : 'Tạo tài khoản'}
          </button>
        </>
      }
    >
      <form onSubmit={submit}>
        <label className="field">
          <span className="field-label">
            Họ và tên <span className="req">*</span>
          </span>
          <input
            className="form-input"
            type="text"
            placeholder="Nguyễn Văn A"
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
            placeholder="email@example.com"
            autoComplete="email"
            value={form.email}
            onChange={(e) => set('email')(e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field-label">
            Mật khẩu tạm <span className="req">*</span>
          </span>
          <input
            className="form-input"
            type="text"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => set('password')(e.target.value)}
          />
          <span className="field-hint">
            Tối thiểu 6 ký tự. Hiển thị rõ để bạn gửi cho người dùng — họ nên đổi sau lần đăng
            nhập đầu.
          </span>
        </label>

        <div className="field-grid">
          <label className="field">
            <span className="field-label">Vai trò</span>
            <select
              className="form-input"
              value={form.role}
              onChange={(e) => set('role')(e.target.value)}
            >
              {ROLES.map((r) => (
                <option value={r} key={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Trạng thái</span>
            <select
              className="form-input"
              value={form.status}
              onChange={(e) => set('status')(e.target.value)}
            >
              <option value="active">Hoạt động</option>
              <option value="disabled">Vô hiệu</option>
            </select>
          </label>
        </div>

        {error && <div className="form-error">{error}</div>}
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

  /** A password worth handing over: readable aloud, no ambiguous characters. */
  function suggest() {
    const words = ['Cay', 'Hat', 'Nang', 'Mam', 'Vuon', 'La', 'Hoa', 'Dat'];
    const word = words[Math.floor(Math.random() * words.length)];
    const digits = String(Math.floor(1000 + Math.random() * 9000));
    setPassword(`Sprouty${word}${digits}`);
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

type Filter = '' | Role | 'vip' | 'disabled';

const PAGE_SIZE = 10;

export default function Users() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [resetting, setResetting] = useState<AdminUser | null>(null);
  const [filter, setFilter] = useState<Filter>('');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Filtering happens on the server now that the list is paged — doing it here
  // would only ever filter the 20 rows currently in hand.
  const load = useCallback(() => {
    setState('loading');
    const params: Record<string, unknown> = { page, limit: PAGE_SIZE };
    if (search) params.search = search;
    if (filter === 'vip') params.vip = '1';
    else if (filter === 'disabled') params.status = 'disabled';
    else if (filter) params.role = filter;

    API.admin.users
      .list(params)
      .then((data: any) => {
        setUsers(data.users || []);
        setCounts(data.counts || {});
        setPages(data.pages || 1);
        setTotal(data.total || 0);
        setState('ready');
      })
      .catch((err: any) => {
        setError(err?.message || 'Không tải được danh sách.');
        setState('error');
      });
  }, [page, filter, search]);

  useEffect(load, [load]);

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

  function changeRole(user: AdminUser, role: string) {
    if (
      role === 'admin' &&
      !confirm(
        `Nâng ${user.name} lên quản trị viên?\n\nHọ sẽ sửa được sản phẩm, giá bán và toàn bộ tài khoản khác.`,
      )
    )
      return;
    run(user, async () => {
      await API.admin.users.update(user.id, { role });
      showToast(`Đã đổi vai trò thành ${ROLE_LABEL[role as Role]}`, 'success');
    });
  }

  function toggleStatus(user: AdminUser) {
    const next = user.status === 'active' ? 'disabled' : 'active';
    const message =
      next === 'disabled'
        ? `Vô hiệu hóa tài khoản của ${user.name}?\n\nHọ sẽ không thể đăng nhập, nhưng đơn hàng và lịch sử vẫn được giữ.`
        : `Kích hoạt lại tài khoản của ${user.name}?\n\nHọ sẽ có thể đăng nhập trở lại.`;
    if (!confirm(message)) return;

    run(user, async () => {
      await API.admin.users.update(user.id, { status: next });
      showToast(
        next === 'disabled' ? `Đã vô hiệu hóa ${user.name}` : `Đã kích hoạt ${user.name}`,
        'success',
      );
    });
  }

  function grantVip(user: AdminUser) {
    run(user, async () => {
      const { message } = await API.admin.users.grantVip(user.id);
      showToast(message, 'success');
    });
  }

  function revokeVip(user: AdminUser) {
    if (
      !confirm(
        'Thu hồi VIP của người dùng này? Các đơn gói VIP đã thanh toán sẽ bị huỷ và tài khoản về hạng Thường (giới hạn 10 lá kỷ niệm).',
      )
    )
      return;
    run(user, async () => {
      const { message } = await API.admin.users.revokeVip(user.id);
      showToast(message, 'success');
    });
  }

  // Counts come from the server and span the whole table, so the numbers on the
  // filter buttons stay put as you click between them.
  const filters: Array<FilterOption<Filter>> = [
    { value: '', label: 'Tất cả', count: counts.all },
    { value: 'customer', label: 'Khách hàng', count: counts.customer },
    { value: 'employee', label: 'Nhân viên', count: counts.employee },
    { value: 'admin', label: 'Quản trị', count: counts.admin },
    { value: 'vip', label: 'VIP', count: counts.vip },
    { value: 'disabled', label: 'Vô hiệu', count: counts.disabled },
  ];

  return (
    <>
      <PageHeader
        title="Quản lý người dùng"
        subtitle="Vai trò, trạng thái đăng nhập và quyền VIP"
        actions={
          <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
            + Thêm người dùng
          </button>
        }
      />

      <StatGrid>
        <StatCard
          icon={<AdminIcon name="users" />}
          tone="blue"
          loading={state === 'loading'}
          value={users.length}
          label="Tổng tài khoản"
        />
        <StatCard
          icon={<AdminIcon name="settings" />}
          tone="orange"
          loading={state === 'loading'}
          value={counts.employee + counts.admin}
          label="Nhân sự"
          hint={`${counts.admin} quản trị · ${counts.employee} nhân viên`}
        />
        <StatCard
          icon={<AdminIcon name="star" />}
          tone="amber"
          loading={state === 'loading'}
          value={counts.vip}
          label="Khách VIP"
        />
        <StatCard
          icon={<AdminIcon name="lock" />}
          tone="rose"
          loading={state === 'loading'}
          value={counts.disabled}
          label="Bị vô hiệu"
        />
      </StatGrid>

      <Toolbar>
        <FilterPills options={filters} value={filter} onChange={(next) => { setFilter(next); setPage(1); }} />
        <SearchBox
          value={search}
          placeholder="Tìm theo tên hoặc email…"
          onChange={(next) => { setSearch(next); setPage(1); }}
        />
      </Toolbar>

      <Panel flush>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Người dùng</th>
              <th>Vai trò</th>
              <th>Trạng thái</th>
              <th>Ngày tạo</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <TableStates
              state={state}
              error={error}
              isEmpty={users.length === 0}
              columns={5}
              emptyIcon={<AdminIcon name="users" size={24} />}
              emptyTitle={search || filter ? 'Không tìm thấy ai' : 'Chưa có người dùng'}
              emptyHint={search || filter ? 'Thử bỏ bộ lọc hoặc đổi từ khoá.' : undefined}
              onRetry={load}
            />
            {state === 'ready' &&
              users.map((user) => (
                <tr key={user.id} className={busyId === user.id ? 'row-busy' : undefined}>
                  <td>
                    <div className="usr-cell">
                      <span className={`usr-avatar tone-${ROLE_TONE[user.role]}`}>
                        {initials(user.name)}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div className="ad-cell-main">
                          {user.name}
                          {user.isVip && (
                            <span className="usr-vip" title={`Khách VIP đến ${vipDate(user.vipUntil)}`}>
                              <AdminIcon name="star" size={14} />
                            </span>
                          )}
                        </div>
                        <div className="ad-cell-sub">{user.email}</div>
                        {user.isVip ? (
                          <div className="usr-tier is-vip">VIP đến {vipDate(user.vipUntil)}</div>
                        ) : user.vipExpired ? (
                          <div className="usr-tier">VIP hết hạn {vipDate(user.vipUntil)}</div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td>
                    <select
                      className="admin-mini-select"
                      value={user.role}
                      disabled={busyId === user.id}
                      onChange={(e) => changeRole(user, e.target.value)}
                    >
                      {ROLES.map((r) => (
                        <option value={r} key={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <Pill tone={user.status === 'active' ? 'green' : 'rose'}>
                      {user.status === 'active' ? 'Hoạt động' : 'Vô hiệu'}
                    </Pill>
                  </td>
                  <td className="ad-cell-sub">
                    {new Date(user.createdAt).toLocaleDateString('vi-VN')}
                  </td>
                  <td>
                    <div className="admin-inline-actions">
                      <button
                        className={`act-btn ${user.status === 'active' ? 'act-del' : 'act-edit'}`}
                        disabled={busyId === user.id}
                        onClick={() => toggleStatus(user)}
                      >
                        {user.status === 'active' ? 'Vô hiệu' : 'Kích hoạt'}
                      </button>
                      {user.isVip ? (
                        <button
                          className="act-btn act-del"
                          disabled={busyId === user.id}
                          onClick={() => revokeVip(user)}
                        >
                          Thu hồi VIP
                        </button>
                      ) : (
                        <button
                          className="act-btn act-vip"
                          disabled={busyId === user.id}
                          onClick={() => grantVip(user)}
                        >
                          <AdminIcon name="star" size={15} /> Cấp VIP
                        </button>
                      )}
                      <button
                        className="act-btn"
                        disabled={busyId === user.id}
                        onClick={() => setResetting(user)}
                      >
                        <AdminIcon name="lock" size={15} /> Đặt lại mật khẩu
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </Panel>

      <Pagination
        page={page}
        pages={pages}
        total={total}
        unit="tài khoản"
        onChange={setPage}
      />

      {addOpen && <AddUserModal onClose={() => setAddOpen(false)} onCreated={load} />}
      {resetting && <ResetPasswordModal user={resetting} onClose={() => setResetting(null)} />}
    </>
  );
}
