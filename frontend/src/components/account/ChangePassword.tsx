import { useState } from 'react';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import './ChangePassword.css';

/**
 * Changing your own password. There was no way to do this anywhere in the
 * product: whatever password you first chose was the one you kept, and a staff
 * account created by an admin was stuck on its temporary password forever.
 */
export function ChangePassword() {
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
