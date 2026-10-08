/**
 * "Bạn cần đăng nhập để tiếp tục".
 *
 * Asked for before sending a signed-out visitor to the sign-in page, rather
 * than redirecting them the moment they press a button. Being moved somewhere
 * else without warning reads as the site malfunctioning — especially at a
 * checkout, where the natural fear is that the basket has just been lost.
 *
 * So the dialog does three things a bare redirect cannot: it says why, it
 * promises what survives, and it offers signing up as a first-class choice
 * rather than a link to hunt for afterwards.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SproutyIcon, type IconName } from '@/components/icons/SproutyIcon';
import { loginHref } from '@/services/auth-nav';
import './LoginRequiredDialog.css';

export interface LoginGate {
  /** What the visitor was trying to do, e.g. "đặt hàng". */
  action: string;
  /** Reassurance about what is kept while they sign in. */
  reassurance?: string;
  /** Where to come back to. Defaults to the current page. */
  next?: string;
  icon?: IconName;
}

export function LoginRequiredDialog({
  gate,
  onClose,
}: {
  gate: LoginGate | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!gate) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [gate, onClose]);

  if (!gate) return null;

  const go = (mode: 'login' | 'register') => {
    onClose();
    navigate(loginHref(gate.next, mode));
  };

  return (
    <div
      className="lrq-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lrq-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="lrq-card">
        <button className="lrq-close" onClick={onClose} aria-label="Đóng">
          ✕
        </button>

        <span className="lrq-icon">
          <SproutyIcon name={gate.icon ?? 'lock'} size={34} />
        </span>

        <h2 id="lrq-title">Cần đăng nhập để {gate.action}</h2>
        <p>
          Sprouty cần biết đây là tài khoản nào để gửi mã kích hoạt và lưu lại đơn của bạn.
        </p>

        {gate.reassurance && (
          <p className="lrq-keep">
            <SproutyIcon name="check" size={17} />
            {gate.reassurance}
          </p>
        )}

        <div className="lrq-actions">
          <button className="lrq-primary" onClick={() => go('login')}>
            Đăng nhập
            <SproutyIcon name="arrow-right" size={18} />
          </button>
          <button className="lrq-secondary" onClick={() => go('register')}>
            Tạo tài khoản mới
          </button>
        </div>

        <button className="lrq-cancel" onClick={onClose}>
          Để sau
        </button>
      </div>
    </div>
  );
}
