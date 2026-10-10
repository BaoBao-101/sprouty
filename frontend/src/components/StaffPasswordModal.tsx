import { useState, type FormEvent } from 'react';
import { Modal } from '@/components/admin/ui';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';

export function StaffPasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (password !== confirmation) return setError('Mật khẩu xác nhận chưa khớp.');
    setBusy(true);
    setError('');
    try {
      const result = await API.auth.changePassword(current, password);
      showToast(result.message, 'success');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Không đổi được mật khẩu.');
    } finally { setBusy(false); }
  }
  return <Modal title="Đổi mật khẩu của tôi" onClose={() => { if (!busy) onClose(); }} width={480}>
    <form onSubmit={submit}>
      <label className="field"><span className="field-label">Mật khẩu hiện tại</span>
        <input className="form-input" type="password" autoComplete="current-password" required value={current} onChange={e => setCurrent(e.target.value)} />
      </label>
      <label className="field"><span className="field-label">Mật khẩu mới</span>
        <input className="form-input" type="password" autoComplete="new-password" required minLength={6} maxLength={200} value={password} onChange={e => setPassword(e.target.value)} />
      </label>
      <label className="field"><span className="field-label">Xác nhận mật khẩu mới</span>
        <input className="form-input" type="password" autoComplete="new-password" required value={confirmation} onChange={e => setConfirmation(e.target.value)} />
      </label>
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Đang đổi mật khẩu…' : 'Đổi mật khẩu'}</button>
    </form>
  </Modal>;
}
