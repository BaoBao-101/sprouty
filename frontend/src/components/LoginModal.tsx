import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { showToast } from '@/services/toast';

/** Opened from anywhere via the store below, so a page deep in the tree can ask
 *  for the modal without threading props through every layout. */
let openModal: ((view?: 'login' | 'register') => void) | null = null;

export function requireLogin(view: 'login' | 'register' = 'login') {
  openModal?.(view);
}

export function LoginModal() {
  const { login, register } = useAuth();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'login' | 'register'>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  useEffect(() => {
    openModal = (next = 'login') => {
      setView(next);
      setError('');
      setOpen(true);
    };
    return () => {
      openModal = null;
    };
  }, []);

  function close() {
    setOpen(false);
    setError('');
  }

  async function submitLogin() {
    setError('');
    if (!email || !password) return setError('Vui lòng điền đầy đủ thông tin.');
    setBusy(true);
    try {
      await login(email, password);
      close();
      showToast('Đăng nhập thành công!', 'success');
    } catch (err: any) {
      setError(err?.message || 'Đăng nhập thất bại.');
    } finally {
      setBusy(false);
    }
  }

  async function submitRegister() {
    setError('');
    if (!regName || !regEmail || !regPassword) return setError('Vui lòng điền đầy đủ thông tin.');
    if (regPassword.length < 6) return setError('Mật khẩu phải có ít nhất 6 ký tự.');
    if (!/\S+@\S+\.\S+/.test(regEmail)) return setError('Email không đúng định dạng.');
    setBusy(true);
    try {
      await register(regName, regEmail, regPassword);
      close();
      showToast(`Đăng ký thành công! Chào ${regName} 🎉`, 'success');
    } catch (err: any) {
      setError(err?.message || 'Đăng ký thất bại.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`modal-overlay${open ? ' open' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal" style={{ maxWidth: 420 }}>
        <button className="modal-close" onClick={close} aria-label="Đóng">
          ✕
        </button>

        {view === 'login' ? (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 22 }}>
              <div style={{ fontSize: '2.8rem', marginBottom: 8 }}>👋</div>
              <p className="modal-title" style={{ marginBottom: 4 }}>
                Chào mừng trở lại
              </p>
              <p className="modal-subtitle">Đăng nhập để xem đơn hàng và dùng trợ lý AI</p>
            </div>

            <div className="form-group">
              <label className="form-label">
                Email <span className="required">*</span>
              </label>
              <input
                className="form-input"
                type="email"
                placeholder="email@example.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Mật khẩu <span className="required">*</span>
              </label>
              <div className="input-group">
                <input
                  className="form-input"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Nhập mật khẩu"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitLogin()}
                />
                <button
                  className="input-group-btn"
                  type="button"
                  tabIndex={-1}
                  title="Hiện/ẩn mật khẩu"
                  onClick={() => setShowPass((v) => !v)}
                >
                  👁
                </button>
              </div>
            </div>

            {error && <div className="form-error mb-12">{error}</div>}

            <button
              className="btn btn-primary btn-block"
              style={{ marginTop: 4 }}
              disabled={busy}
              onClick={submitLogin}
            >
              {busy ? 'Đang xử lý...' : 'Đăng nhập →'}
            </button>

            <div className="form-divider">chưa có tài khoản?</div>
            <button
              className="btn btn-ghost btn-block"
              onClick={() => {
                setView('register');
                setError('');
              }}
            >
              Tạo tài khoản miễn phí
            </button>
          </div>
        ) : (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 22 }}>
              <div style={{ fontSize: '2.8rem', marginBottom: 8 }}>🎉</div>
              <p className="modal-title" style={{ marginBottom: 4 }}>
                Tạo tài khoản
              </p>
              <p className="modal-subtitle">Tham gia Sprouty — bắt đầu vườn kỷ niệm của bé</p>
            </div>

            <div className="form-group">
              <label className="form-label">
                Họ và tên <span className="required">*</span>
              </label>
              <input
                className="form-input"
                type="text"
                placeholder="Nguyễn Văn A"
                autoComplete="name"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Email <span className="required">*</span>
              </label>
              <input
                className="form-input"
                type="email"
                placeholder="email@example.com"
                autoComplete="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Mật khẩu <span className="required">*</span>
              </label>
              <div className="input-group">
                <input
                  className="form-input"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Tối thiểu 6 ký tự"
                  autoComplete="new-password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitRegister()}
                />
                <button
                  className="input-group-btn"
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPass((v) => !v)}
                >
                  👁
                </button>
              </div>
              <div className="form-hint">Ít nhất 6 ký tự</div>
            </div>

            {error && <div className="form-error mb-12">{error}</div>}

            <button
              className="btn btn-primary btn-block"
              style={{ marginTop: 4 }}
              disabled={busy}
              onClick={submitRegister}
            >
              {busy ? 'Đang tạo tài khoản...' : 'Đăng ký ngay →'}
            </button>

            <div className="form-divider">đã có tài khoản?</div>
            <button
              className="btn btn-ghost btn-block"
              onClick={() => {
                setView('login');
                setError('');
              }}
            >
              ← Đăng nhập
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
