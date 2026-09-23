import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'employee' | 'admin';
  status: 'active' | 'disabled';
  isVip?: boolean;
  createdAt: string;
}

const ROLES = ['customer', 'employee', 'admin'] as const;

const EMPTY_FORM = {
  name: '',
  email: '',
  password: '',
  role: 'customer',
  status: 'active',
};

function AddUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof EMPTY_FORM) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
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
    <div
      className="adm-modal open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="adm-modal-box" style={{ maxWidth: 480 }}>
        <button className="adm-modal-close" onClick={onClose} aria-label="Đóng">
          ✕
        </button>
        <h2 className="adm-modal-title">Thêm người dùng mới</h2>

        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">
              Họ và tên <span className="required">*</span>
            </label>
            <input
              className="form-input"
              type="text"
              required
              minLength={2}
              value={form.name}
              onChange={(e) => set('name')(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Email <span className="required">*</span>
            </label>
            <input
              className="form-input"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(e) => set('email')(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Mật khẩu tạm <span className="required">*</span>
            </label>
            <input
              className="form-input"
              type="text"
              required
              minLength={6}
              maxLength={200}
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => set('password')(e.target.value)}
            />
            <div className="form-hint">Tối thiểu 6 ký tự. Người dùng nên đổi sau lần đăng nhập đầu.</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Vai trò</label>
              <select
                className="form-input"
                value={form.role}
                onChange={(e) => set('role')(e.target.value)}
              >
                {ROLES.map((r) => (
                  <option value={r} key={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Trạng thái</label>
              <select
                className="form-input"
                value={form.status}
                onChange={(e) => set('status')(e.target.value)}
              >
                <option value="active">Hoạt động</option>
                <option value="disabled">Vô hiệu</option>
              </select>
            </div>
          </div>

          {error && <div className="form-error mb-12">{error}</div>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Đang tạo...' : 'Tạo tài khoản'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Users() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(() => {
    setStatus('loading');
    API.admin.users
      .list()
      .then((data: any) => {
        setUsers(data.users || []);
        setStatus('ready');
      })
      .catch((err: any) => {
        setError(err?.message || 'Không tải được danh sách.');
        setStatus('error');
      });
  }, []);

  useEffect(load, [load]);

  async function changeRole(user: AdminUser, role: string) {
    try {
      await API.admin.users.update(user.id, { role });
      showToast('Đã cập nhật vai trò', 'success');
    } catch (err: any) {
      showToast(`Lỗi: ${err?.message}`, 'error');
    }
    load();
  }

  async function toggleStatus(user: AdminUser) {
    const next = user.status === 'active' ? 'disabled' : 'active';
    const message =
      next === 'disabled'
        ? `Vô hiệu hóa tài khoản của ${user.name}?\n\nHọ sẽ không thể đăng nhập, nhưng đơn hàng và lịch sử vẫn được giữ.`
        : `Kích hoạt lại tài khoản của ${user.name}?\n\nHọ sẽ có thể đăng nhập trở lại.`;
    if (!confirm(message)) return;

    try {
      await API.admin.users.update(user.id, { status: next });
      showToast(next === 'disabled' ? `Đã vô hiệu hóa ${user.name}` : `Đã kích hoạt ${user.name}`, 'success');
      load();
    } catch (err: any) {
      showToast(`Lỗi: ${err?.message}`, 'error');
    }
  }

  async function grantVip(user: AdminUser) {
    try {
      const { message } = await API.admin.users.grantVip(user.id);
      showToast(message, 'success');
      load();
    } catch (err: any) {
      showToast(err?.message || 'Không cấp được VIP', 'error');
    }
  }

  async function revokeVip(user: AdminUser) {
    if (!confirm('Thu hồi VIP của người dùng này? Giới hạn lá kỷ niệm sẽ về lại mức thường (10).')) return;
    try {
      const { message } = await API.admin.users.revokeVip(user.id);
      showToast(message, 'success');
      load();
    } catch (err: any) {
      showToast(err?.message || 'Không thu hồi được VIP', 'error');
    }
  }

  return (
    <>
      <div className="page-header">
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Quản lý người dùng</h1>
        <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
          + Thêm người dùng
        </button>
      </div>

      <div className="admin-card">
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Tên</th>
                <th>Email</th>
                <th>Vai trò</th>
                <th>Trạng thái</th>
                <th>VIP</th>
                <th>Ngày tạo</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {status === 'loading' && (
                <tr>
                  <td colSpan={7} className="admin-cell-empty">
                    Đang tải...
                  </td>
                </tr>
              )}
              {status === 'error' && (
                <tr>
                  <td colSpan={7} className="admin-cell-error">
                    {error}
                  </td>
                </tr>
              )}
              {status === 'ready' && users.length === 0 && (
                <tr>
                  <td colSpan={7} className="admin-cell-empty">
                    Không có người dùng
                  </td>
                </tr>
              )}

              {users.map((user) => (
                <tr key={user.id}>
                  <td style={{ fontWeight: 600 }}>{user.name}</td>
                  <td style={{ fontSize: '.82rem' }}>{user.email}</td>
                  <td>
                    <span className={`role-badge role-${user.role}`}>{user.role}</span>
                  </td>
                  <td
                    style={{
                      fontSize: '.82rem',
                      fontWeight: 600,
                      color: user.status === 'active' ? 'var(--green)' : 'var(--rose)',
                    }}
                  >
                    {user.status === 'active' ? 'Hoạt động' : 'Vô hiệu'}
                  </td>
                  <td>
                    {user.isVip ? (
                      <span className="role-badge vip-badge">
                        <img src="/assets/images/sprouty-icons/VIP.png" alt="" /> VIP
                      </span>
                    ) : (
                      <span className="admin-cell-sub">—</span>
                    )}
                  </td>
                  <td className="admin-cell-sub">
                    {new Date(user.createdAt).toLocaleDateString('vi-VN')}
                  </td>
                  <td>
                    <div className="admin-inline-actions">
                      <select
                        className="admin-mini-select"
                        value={user.role}
                        onChange={(e) => changeRole(user, e.target.value)}
                      >
                        {ROLES.map((r) => (
                          <option value={r} key={r}>
                            {r}
                          </option>
                        ))}
                      </select>

                      <button
                        className="act-btn"
                        style={{
                          borderColor: user.status === 'active' ? 'var(--rose)' : 'var(--green)',
                          color: user.status === 'active' ? 'var(--rose)' : 'var(--green)',
                        }}
                        onClick={() => toggleStatus(user)}
                      >
                        {user.status === 'active' ? 'Vô hiệu' : 'Kích hoạt'}
                      </button>

                      {user.isVip ? (
                        <button className="act-btn act-del" onClick={() => revokeVip(user)}>
                          Thu hồi VIP
                        </button>
                      ) : (
                        <button
                          className="act-btn"
                          style={{ borderColor: '#D97706', color: '#D97706' }}
                          onClick={() => grantVip(user)}
                        >
                          <img src="/assets/images/sprouty-icons/VIP.png" alt="" className="act-btn-icon" />
                          Cấp VIP
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {addOpen && <AddUserModal onClose={() => setAddOpen(false)} onCreated={load} />}
    </>
  );
}
