/**
 * Đăng nhập / Đăng ký — a page, not a modal.
 *
 * Signing in used to happen in a dialog floating over whatever you were looking
 * at, which made it an interruption rather than a step. A page has an address:
 * it can be linked to, bookmarked, reloaded, opened in a tab, and sent to
 * someone who needs an account. It is also where a protected route can send you
 * and then send you back, which a modal cannot do because it leaves no trace in
 * the history.
 *
 * One component renders both views. They share the brand panel, the validation
 * and the post-sign-in routing; splitting them into two files would duplicate
 * all three to save a single `mode` prop.
 *
 * Where you land afterwards is decided by role, and by `?next=` when a guarded
 * page sent you here.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { roleLandingPath, useAuth } from '@/contexts/AuthContext';
import { showToast } from '@/services/toast';
import { SproutyIcon } from '@/components/icons/SproutyIcon';
import { PlantArt } from '@/components/PlantArt';
import './Auth.css';

type Mode = 'login' | 'register';

/** What the brand panel says, so the two views do not read identically. */
const PITCH: Record<Mode, { title: string; lines: string[]; foot: string }> = {
  login: {
    title: 'Vườn của bé đang đợi',
    lines: [
      'Xem cây đã lớn tới đâu',
      'Chăm cây và đọc cảm biến',
      'Nhận gợi ý từ Plant Buddy',
    ],
    foot: 'Cây vẫn lớn theo thời gian thật kể cả khi bạn không mở trang.',
  },
  register: {
    title: 'Bắt đầu vườn đầu tiên',
    lines: [
      'Nuôi cây từ hạt tới ngày thu hoạch',
      'Mở dần 8 thiết bị IoT ảo',
      'Mua 3 sản phẩm — tặng 1 workshop',
    ],
    foot: 'Miễn phí tạo tài khoản. Không cần thẻ, không giao hàng.',
  },
};

export default function Auth({ mode }: { mode: Mode }) {
  const { login, register, isLoggedIn, ready, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Where a guarded page asked us to return to. Only same-site paths are
  // honoured: `?next=https://evil.example` would otherwise turn this form into
  // an open redirect that borrows Sprouty's domain to look trustworthy.
  const rawNext = searchParams.get('next') || '';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '';

  // Switching between the two views should not carry a stale error across.
  useEffect(() => {
    setError('');
  }, [mode]);

  if (ready && isLoggedIn && user) {
    // Already signed in — nothing to do here. Send them where this account
    // belongs rather than showing a form they cannot use.
    return <Navigate to={next || roleLandingPath(user.role) || '/'} replace />;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim();
    if (mode === 'register' && name.trim().length < 2) {
      return setError('Nhập họ và tên của bạn.');
    }
    if (!cleanEmail || !password) return setError('Vui lòng điền đầy đủ thông tin.');
    if (!/\S+@\S+\.\S+/.test(cleanEmail)) return setError('Email không đúng định dạng.');
    if (mode === 'register' && password.length < 6) {
      return setError('Mật khẩu phải có ít nhất 6 ký tự.');
    }

    setBusy(true);
    try {
      const account =
        mode === 'login'
          ? await login(cleanEmail, password)
          : await register(name.trim(), cleanEmail, password);

      showToast(
        mode === 'login'
          ? 'Đăng nhập thành công!'
          : `Chào ${name.trim().split(' ').pop()}, vườn của bạn sẵn sàng rồi!`,
        'success',
      );

      // `next` wins when a guarded page sent us here; otherwise staff go to
      // their own area and a customer goes to their garden.
      navigate(next || roleLandingPath(account.role) || '/my-plants', { replace: true });
    } catch (err: any) {
      setError(err?.message || (mode === 'login' ? 'Đăng nhập thất bại.' : 'Đăng ký thất bại.'));
    } finally {
      setBusy(false);
    }
  }

  const pitch = PITCH[mode];
  // Carry `next` across the login/register switch, so being bounced here from a
  // guarded page and then deciding to sign up still returns you to it.
  const otherHref = `${mode === 'login' ? '/register' : '/login'}${location.search}`;

  return (
    <div className="auth-page">
      {/* Brand side. Hidden on phones, where it would push the form below the
          fold for no benefit. */}
      <aside className="auth-aside">
        <Link to="/" className="auth-logo">
          <img src="/assets/images/logo.png" alt="Sprouty" />
        </Link>

        <div className="auth-aside-inner">
          <div className="auth-aside-art">
            <PlantArt
              stage={mode === 'login' ? 'fruiting' : 'sprout'}
              progress={mode === 'login' ? 70 : 55}
              health={96}
              form="bush"
              fruitShape="round"
              size={230}
            />
          </div>

          <h2>{pitch.title}</h2>
          <ul>
            {pitch.lines.map((line) => (
              <li key={line}>
                <SproutyIcon name="check" size={18} />
                {line}
              </li>
            ))}
          </ul>

          <p className="auth-aside-foot">{pitch.foot}</p>
        </div>
      </aside>

      {/* Form side */}
      <main className="auth-main">
        <div className="auth-card">
          <Link to="/" className="auth-card-logo">
            <img src="/assets/images/logo.png" alt="Sprouty" />
          </Link>

          <Link to="/" className="auth-back">
            <SproutyIcon name="arrow-right" size={16} />
            Về trang chủ
          </Link>

          <div className="auth-head">
            <h1>{mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</h1>
            <p>
              {mode === 'login'
                ? 'Đăng nhập để vào vườn và xem đơn hàng của bạn.'
                : 'Tham gia Sprouty — bắt đầu vườn kỷ niệm của bé.'}
            </p>
          </div>

          {/* Tabs, so the other view is one obvious click rather than a link
              buried under the button. */}
          <div className="auth-tabs" role="tablist">
            <Link
              to={`/login${location.search}`}
              role="tab"
              aria-selected={mode === 'login'}
              className={mode === 'login' ? 'active' : ''}
            >
              Đăng nhập
            </Link>
            <Link
              to={`/register${location.search}`}
              role="tab"
              aria-selected={mode === 'register'}
              className={mode === 'register' ? 'active' : ''}
            >
              Đăng ký
            </Link>
          </div>

          {next && (
            <p className="auth-next-note">
              <SproutyIcon name="info" size={16} />
              Đăng nhập xong bạn sẽ quay lại trang vừa rồi.
            </p>
          )}

          <form onSubmit={submit} noValidate>
            {mode === 'register' && (
              <label className="auth-field">
                <span>
                  Họ và tên <i>*</i>
                </span>
                <input
                  className="form-input"
                  autoComplete="name"
                  placeholder="Nguyễn Văn A"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
            )}

            <label className="auth-field">
              <span>
                Email <i>*</i>
              </span>
              <input
                className="form-input"
                type="email"
                autoComplete="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label className="auth-field">
              <span>
                Mật khẩu <i>*</i>
              </span>
              <div className="auth-pass">
                <input
                  className="form-input"
                  type={showPass ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  placeholder={mode === 'login' ? 'Nhập mật khẩu' : 'Ít nhất 6 ký tự'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="auth-pass-toggle"
                  aria-label={showPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  onClick={() => setShowPass((v) => !v)}
                >
                  {showPass ? 'Ẩn' : 'Hiện'}
                </button>
              </div>
            </label>

            {error && (
              <p className="auth-error" role="alert">
                <SproutyIcon name="warning" size={17} />
                {error}
              </p>
            )}

            <button className="auth-submit" disabled={busy}>
              {busy
                ? mode === 'login'
                  ? 'Đang đăng nhập…'
                  : 'Đang tạo tài khoản…'
                : mode === 'login'
                  ? 'Đăng nhập'
                  : 'Tạo tài khoản'}
              {!busy && <SproutyIcon name="arrow-right" size={19} />}
            </button>
          </form>

          <p className="auth-switch">
            {mode === 'login' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}{' '}
            <Link to={otherHref}>{mode === 'login' ? 'Tạo tài khoản miễn phí' : 'Đăng nhập'}</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
