import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { loginHref } from '@/services/auth-nav';
import { useAuth } from '@/contexts/AuthContext';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';

const PROMPTS = [
  '🎁 Kit nào phù hợp cho bé 6 tuổi?',
  '📅 Lịch workshop sắp tới',
  '🌱 Cách gieo hạt và tưới cây đúng cách',
  '💰 So sánh kit và gói thành viên',
  '🎨 Cách chọn màu hài hoà cho bé',
  '🧸 Kit có an toàn cho bé 4 tuổi?',
];

interface Message {
  role: 'user' | 'ai';
  text: string;
  imageUrl?: string;
  time: string;
}

/** The model answers in a light markdown; render only the markup we allow. */
function renderMarkup(text: string) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|\n)[*-] /g, '$1• ')
    .replace(/\n/g, '<br>');
}

function now() {
  return new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export function AiChat() {
  const { user, isLoggedIn } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [locked, setLocked] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const recognition = useRef<any>(null);

  // The assistant can be gated behind a redeem code; staff always get through.
  useEffect(() => {
    if (!isLoggedIn) {
      setLocked(false);
      return;
    }
    let cancelled = false;
    API.redeem
      .entitlements()
      .then((state: any) => {
        if (cancelled) return;
        const isStaff = user?.role === 'employee' || user?.role === 'admin';
        setLocked(!!state.aiRequiresEntitlement && !state.features?.ai_assistant && !isStaff);
      })
      .catch(() => !cancelled && setLocked(false));
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, user]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  // Object URLs for previews have to be released or they leak.
  useEffect(() => {
    if (!image) {
      setImageUrl(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  function clearImage() {
    setImage(null);
    if (fileInput.current) fileInput.current.value = '';
  }

  async function send() {
    if (locked) {
      showToast('Nhập mã kích hoạt để dùng trợ lý AI', 'error');
      return;
    }
    const question = input.trim();
    if (!question && !image) return;

    setInput('');
    setMessages((m) => [
      ...m,
      { role: 'user', text: question, imageUrl: imageUrl ?? undefined, time: now() },
    ]);
    const nextHistory = [...history, { role: 'user', content: question }];
    setHistory(nextHistory);
    clearImage();
    setTyping(true);

    // The system prompt used to be built here and sent along, which meant any
    // caller could replace it (finding F-07). The server builds it now, from
    // the session and its own catalogue query — it knows both better than we do.
    try {
      const { reply } = await API.chat.send(nextHistory.slice(-6));
      setHistory((h) => [...h, { role: 'assistant', content: reply }]);
      setMessages((m) => [...m, { role: 'ai', text: reply, time: now() }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: 'ai', text: 'Xin lỗi, có lỗi kết nối. Vui lòng thử lại sau!', time: now() },
      ]);
    } finally {
      setTyping(false);
    }
  }

  function toggleVoice() {
    if (!isLoggedIn) { window.location.href = loginHref(); return; }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('Trình duyệt không hỗ trợ giọng nói', 'error');
      return;
    }
    if (recording) {
      recognition.current?.stop();
      return;
    }

    const instance = new SpeechRecognition();
    instance.lang = 'vi-VN';
    instance.continuous = false;
    instance.onstart = () => {
      setRecording(true);
      showToast('🎙 Đang nghe...');
    };
    instance.onresult = (e: any) => setInput(e.results[0][0].transcript);
    instance.onend = () => setRecording(false);
    instance.start();
    recognition.current = instance;
  }

  return (
    <div className="ai-layout">
      <aside className="ai-sidebar">
        <div className="ai-sb-hd">
          <h3 style={{ fontSize: '.88rem' }}>Gợi ý câu hỏi</h3>
        </div>
        <div className="prompt-list">
          {PROMPTS.map((prompt) => (
            <button
              className="prompt-btn"
              key={prompt}
              onClick={() => setInput(prompt.replace(/^[^\w\s]+ /, ''))}
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="ai-sb-sep" />

        {!isLoggedIn && (
          <div className="ai-sb-login">
            <p>Đăng nhập để upload ảnh và dùng giọng nói</p>
            <button className="btn btn-primary btn-block btn-sm" onClick={() => { window.location.href = loginHref(); }}>
              Đăng nhập
            </button>
          </div>
        )}

        {locked && (
          <div className="ai-sb-login">
            <p>Trợ lý AI cần mã kích hoạt.</p>
            <Link className="btn btn-primary btn-block btn-sm" to="/my-plants">
              Nhập mã
            </Link>
          </div>
        )}
      </aside>

      <div className="chat-shell">
        <div className="chat-header">
          <div className="chat-header-left">
            <div className="chat-ai-av">🤖</div>
            <div>
              <div style={{ fontSize: '.88rem', fontWeight: 700, color: 'var(--ink)' }}>
                Trợ lý Sprouty
              </div>
              <div className="chat-online">Đang hoạt động</div>
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            title="Xoá lịch sử"
            onClick={() => {
              setMessages([]);
              setHistory([]);
            }}
          >
            🗑 Xoá
          </button>
        </div>

        <div className="chat-msgs" ref={scroller}>
          {messages.length === 0 && (
            <div className="chat-empty-state">
              <div style={{ fontSize: '2.8rem', marginBottom: 12 }}>🌱</div>
              <h3 style={{ fontSize: '1rem', marginBottom: 6 }}>Xin chào! Tôi là trợ lý Sprouty</h3>
              <p style={{ fontSize: '.84rem', color: 'var(--ink-3)' }}>
                Hỏi tôi về kit trồng cây, chăm cây, IoT hoặc workshop nhé!
              </p>
            </div>
          )}

          {messages.map((message, i) => (
            <div className={`msg ${message.role}`} key={i}>
              <div className="msg-av">{message.role === 'user' ? '👤' : '🤖'}</div>
              <div>
                {message.imageUrl && <img src={message.imageUrl} alt="" className="msg-image" />}
                <div
                  className="msg-bubble"
                  dangerouslySetInnerHTML={{ __html: renderMarkup(message.text) }}
                />
                <span className="msg-time">{message.time}</span>
              </div>
            </div>
          ))}

          {typing && (
            <div className="msg ai">
              <div className="msg-av">🤖</div>
              <div className="typing-indicator">
                <div className="td" />
                <div className="td" />
                <div className="td" />
              </div>
            </div>
          )}
        </div>

        <div className="chat-input-area">
          {image && (
            <div className="img-preview">
              <span>📎</span>
              <span>{image.name}</span>
              <button onClick={clearImage}>✕</button>
            </div>
          )}

          <div className="chat-input-row">
            <div className="chat-input-wrap">
              <input
                type="text"
                placeholder="Nhập câu hỏi..."
                maxLength={500}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) send();
                }}
              />
              <button
                className="ic-btn ic-img"
                title="Gửi ảnh"
                disabled={!isLoggedIn}
                onClick={() => { if (isLoggedIn) fileInput.current?.click(); else window.location.href = loginHref(); }}
              >
                📎
              </button>
              <button
                className={`ic-btn ic-voice${recording ? ' recording' : ''}`}
                title="Giọng nói"
                disabled={!isLoggedIn}
                onClick={toggleVoice}
              >
                🎙
              </button>
            </div>
            <button className="send-btn" title="Gửi" disabled={locked || typing} onClick={send}>
              ➤
            </button>
          </div>

          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => setImage(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>
    </div>
  );
}
