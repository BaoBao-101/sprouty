/**
 * The assistant, reachable from wherever the reader already is.
 *
 * It used to be a page you had to navigate to, which meant leaving whatever
 * raised the question — the kit you were comparing, the workshop you were
 * about to book. A question asked in front of the thing it is about is a
 * better question, and the answer arrives without losing your place.
 *
 * It stays out of the way on two screens: /ai, which is this same conversation
 * at full size, and a plant's dashboard, where Plant Buddy is already sitting
 * in the sidebar and a second assistant would only be confusing.
 */

import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { loginHref } from '@/services/auth-nav';
import { SproutyIcon } from '@/components/icons/SproutyIcon';
import { useAiChat } from '@/contexts/AiChatContext';
import { renderMarkup } from '@/services/ai-markup';
import './AiBubble.css';

/** Openers for someone who has not thought of a question yet. */
const PROMPTS = [
  'Kit nào hợp với bé 6 tuổi?',
  'Lịch workshop sắp tới?',
  'Cách gieo hạt đúng cách',
  'Kit có an toàn cho bé 4 tuổi?',
];

/** Screens that already have an assistant of their own. */
function hiddenOn(pathname: string) {
  return pathname === '/ai' || pathname.startsWith('/plant/');
}

const NUDGE_KEY = 'sprouty.ai-nudge-seen';

export function AiBubble() {
  const { pathname } = useLocation();
  const { isLoggedIn } = useAuth();
  const { messages, typing, locked, send, clear } = useAiChat();

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [nudge, setNudge] = useState(false);
  const thread = useRef<HTMLDivElement>(null);

  // A one-off hello, so the button is not just an unexplained circle. Browser
  // storage can throw or come back empty, and the greeting is not worth a
  // broken page either way.
  useEffect(() => {
    let seen = true;
    try {
      seen = localStorage.getItem(NUDGE_KEY) === '1';
    } catch {
      seen = true;
    }
    if (seen) return;
    const id = setTimeout(() => setNudge(true), 2500);
    return () => clearTimeout(id);
  }, []);

  function dismissNudge() {
    setNudge(false);
    try {
      localStorage.setItem(NUDGE_KEY, '1');
    } catch {
      /* A greeting that cannot be remembered is not worth reporting. */
    }
  }

  useEffect(() => {
    const el = thread.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing, open]);

  // Escape closes it, the way every other panel on the web does.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (hiddenOn(pathname)) return null;

  function ask(text: string) {
    if (!text.trim() || typing) return;
    setInput('');
    void send(text);
  }

  function launch() {
    dismissNudge();
    setOpen((v) => !v);
  }

  return (
    <div className={`aib${open ? ' aib-open' : ''}`}>
      {nudge && !open && (
        <div className="aib-nudge">
          <button
            className="aib-nudge-x"
            aria-label="Bỏ qua"
            onClick={(e) => {
              e.stopPropagation();
              dismissNudge();
            }}
          >
            <SproutyIcon name="close" size={13} />
          </button>
          <strong>Chào bạn!</strong>
          <span>Mình là trợ lý Sprouty. Có gì thắc mắc cứ hỏi mình nhé.</span>
        </div>
      )}

      {open && (
        <div className="aib-panel" role="dialog" aria-label="Trợ lý Sprouty">
          <header className="aib-head">
            <span className="aib-avatar">
              <SproutyIcon name="sprout" size={22} />
            </span>
            <div className="aib-who">
              <strong>Trợ lý Sprouty</strong>
              <span className={`aib-status${typing ? ' busy' : ''}`}>
                <i />
                {typing ? 'đang trả lời…' : 'luôn sẵn sàng'}
              </span>
            </div>

            {messages.length > 0 && (
              <button className="aib-icon-btn" title="Xoá cuộc trò chuyện" onClick={clear}>
                <SproutyIcon name="trash" size={16} />
              </button>
            )}
            <Link
              className="aib-icon-btn"
              to="/ai"
              title="Mở toàn màn hình"
              onClick={() => setOpen(false)}
            >
              <SproutyIcon name="album" size={16} />
            </Link>
            <button className="aib-icon-btn" title="Đóng" onClick={() => setOpen(false)}>
              <SproutyIcon name="close" size={17} />
            </button>
          </header>

          <div className="aib-thread" ref={thread}>
            {messages.length === 0 && !typing && (
              <div className="aib-empty">
                <span className="aib-empty-icon">
                  <SproutyIcon name="sparkle" size={28} />
                </span>
                <p>
                  Hỏi mình về <b>kit trồng cây</b>, cách chăm cây, thiết bị IoT hay lịch workshop
                  nhé!
                </p>
              </div>
            )}

            {messages.map((m, i) => (
              <div className={`aib-msg aib-msg-${m.role}`} key={i}>
                {m.role === 'ai' && (
                  <span className="aib-msg-avatar">
                    <SproutyIcon name="sprout" size={15} />
                  </span>
                )}
                <div className="aib-bubble">
                  {m.imageUrl && <img src={m.imageUrl} alt="" />}
                  <p dangerouslySetInnerHTML={{ __html: renderMarkup(m.text) }} />
                  <time>{m.time}</time>
                </div>
              </div>
            ))}

            {typing && (
              <div className="aib-msg aib-msg-ai">
                <span className="aib-msg-avatar">
                  <SproutyIcon name="sprout" size={15} />
                </span>
                <div className="aib-bubble aib-typing" aria-label="Đang trả lời">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            )}
          </div>

          {/* Asking costs a sign-in, so say so here rather than letting the
              question be typed, sent, and refused by the server. */}
          {!isLoggedIn ? (
            <div className="aib-locked">
              <p>Đăng nhập để trò chuyện với trợ lý Sprouty nhé.</p>
              <a className="btn btn-primary btn-sm" href={loginHref()}>
                Đăng nhập
              </a>
            </div>
          ) : locked ? (
            <div className="aib-locked">
              <p>Trợ lý AI cần mã kích hoạt.</p>
              <Link className="btn btn-primary btn-sm" to="/my-plants" onClick={() => setOpen(false)}>
                Nhập mã
              </Link>
            </div>
          ) : (
            <div className="aib-foot">
              {messages.length === 0 && (
                <div className="aib-quick">
                  {PROMPTS.map((p) => (
                    <button key={p} disabled={typing} onClick={() => ask(p)}>
                      {p}
                    </button>
                  ))}
                </div>
              )}

              <div className="aib-input">
                <input
                  className="form-input"
                  placeholder="Nhập câu hỏi…"
                  maxLength={500}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') ask(input);
                  }}
                />
                <button
                  aria-label="Gửi câu hỏi"
                  disabled={typing || !input.trim()}
                  onClick={() => ask(input)}
                >
                  <SproutyIcon name="arrow-right" size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <button
        className="aib-launch"
        aria-label={open ? 'Đóng trợ lý AI' : 'Mở trợ lý AI'}
        aria-expanded={open}
        onClick={launch}
      >
        <SproutyIcon name={open ? 'close' : 'chat'} size={26} />
      </button>
    </div>
  );
}
