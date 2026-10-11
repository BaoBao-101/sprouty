import { AiBrandMark } from '@/components/AiBrandMark';
import { AiProductLinks } from '@/components/AiProductLinks';
/**
 * The assistant at full size: the same conversation the bubble shows, plus
 * the photo and voice input there is no room for in a floating panel.
 */

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { loginHref } from '@/services/auth-nav';
import { useAuth } from '@/contexts/AuthContext';
import { useAiChat } from '@/contexts/AiChatContext';
import { renderMarkup } from '@/services/ai-markup';
import { SproutyIcon } from '@/components/icons/SproutyIcon';
import { showToast } from '@/services/toast';

const PROMPTS = [
  { icon: 'gift', label: 'Chọn kit cho bé', text: 'Kit nào phù hợp cho bé 6 tuổi?' },
  { icon: 'water', label: 'Chăm cây mỗi ngày', text: 'Cách gieo hạt và tưới cây đúng cách' },
  { icon: 'camera', label: 'Viết một kỷ niệm', text: 'Gợi ý một caption cho ngày đầu bé gieo hạt' },
  { icon: 'bulb', label: 'Khám phá STEM', text: 'Giải thích cảm biến độ ẩm đất cho bé dễ hiểu' },
  { icon: 'ticket', label: 'Hẹn một workshop', text: 'Lịch workshop sắp tới' },
] as const;

export function AiChat() {
  const { isLoggedIn } = useAuth();
  const { messages, typing, locked, send, clear } = useAiChat();

  const [input, setInput] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => () => recognition.current?.abort(), []);
  const recognition = useRef<any>(null);

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

  function submit() {
    const question = input.trim();
    if (typing || locked || (!question && !image)) return;
    setInput('');
    // A URL of its own, deliberately never revoked. The preview URL dies with
    // the preview, and the message outlives this page now - it is in the shared
    // thread, so the bubble re-renders it after a navigation that unmounted us.
    const attached = image ? URL.createObjectURL(image) : undefined;
    clearImage();
    void send(question, attached);
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
      showToast('Đang nghe…');
    };
    instance.onresult = (e: any) => setInput(e.results[0][0].transcript);
    instance.onend = () => setRecording(false);
    instance.onerror = () => { setRecording(false); showToast('Không nhận được giọng nói. Bạn kiểm tra quyền micro hoặc nhập câu hỏi nhé.', 'error'); };
    instance.start();
    recognition.current = instance;
  }

  return (
    <div className="ai-layout">
      <aside className="ai-sidebar">
        <div className="ai-sb-hd">
          <span className="buddy-eyebrow">GÓC GỢI Ý</span><h3>Mình bắt đầu từ đâu?</h3><p>Chọn một chủ đề bạn đang tò mò.</p>
        </div>
        <div className="prompt-list">
          {PROMPTS.map((prompt) => (
            <button
              className="prompt-btn"
              key={prompt.label}
              onClick={() => { setInput(prompt.text); inputRef.current?.focus(); }}
            >
              <SproutyIcon name={prompt.icon} size={21} /><span>{prompt.label}</span><SproutyIcon name="arrow-right" size={15} />
            </button>
          ))}
        </div>

        <div className="buddy-sidebar-note"><SproutyIcon name="pot" size={42} /><strong>Chậm một chút, hiểu cây hơn.</strong><p>Kể mình nghe tên cây và điều bạn quan sát được để mình gợi ý cụ thể hơn nhé.</p></div>

        {!isLoggedIn && (
          <div className="ai-sb-login">
            <p>Đăng nhập để trò chuyện, gửi ảnh và dùng giọng nói</p>
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
            <div className="chat-ai-av"><AiBrandMark size={25} /></div>
            <div>
              <div style={{ fontSize: '.88rem', fontWeight: 700, color: 'var(--ink)' }}>
                Trợ lý Sprouty
              </div>
              <div className="chat-online">Trợ lý AI của Sprouty</div>
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            title="Xoá lịch sử"
            disabled={typing || messages.length === 0}
            onClick={clear}
          >
            <SproutyIcon name="trash" size={17} /> Xoá trò chuyện
          </button>
        </div>

        <div className="chat-msgs" ref={scroller} role="log" aria-label="Cuộc trò chuyện" aria-live="polite" aria-relevant="additions text">
          {messages.length === 0 && (
            <div className="chat-empty-state">
              <div className="buddy-welcome-art"><AiBrandMark size={56} /></div><span className="buddy-eyebrow">XIN CHÀO, NGƯỜI BẠN LÀM VƯỜN</span>
              <h3>Hôm nay, cây của bạn thế nào?</h3>
              <p style={{ fontSize: '.84rem', color: 'var(--ink-3)' }}>
                Mình ở đây để cùng bạn tìm hiểu, chăm cây và gom những kỷ niệm nhỏ. Bắt đầu bằng một câu hỏi nhé.
              </p>
            </div>
          )}

          {messages.map((message, i) => (
            <div className={`msg ${message.role}`} key={i}>
              <div className="msg-av">{message.role === 'user' ? <span className="buddy-user-label">Bạn</span> : <AiBrandMark size={20} />}</div>
              <div>
                {message.imageUrl && <img src={message.imageUrl} alt="" className="msg-image" />}
                <div
                  className="msg-bubble"
                  dangerouslySetInnerHTML={{ __html: renderMarkup(message.text) }}
                />
                {message.role === 'ai' && <AiProductLinks products={message.products} />}
                <span className="msg-time">{message.time}</span>
              </div>
            </div>
          ))}

          {typing && (
            <div className="msg ai">
              <div className="msg-av"><AiBrandMark size={20} /></div>
              <div className="typing-indicator" role="status" aria-label="Sprouty đang trả lời">
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
              <span>{imageUrl && <img src={imageUrl} alt="Ảnh đính kèm" />}</span>
              <span>{image.name}</span>
              <button onClick={clearImage} aria-label="Bỏ ảnh đính kèm"><SproutyIcon name="close" size={17} /></button>
            </div>
          )}

          <div className="chat-input-row">
            <div className="chat-input-wrap">
              <textarea
                ref={inputRef}
                rows={2}
                aria-label="Câu hỏi cho Sprouty"
                placeholder="Hỏi Sprouty một điều bạn đang tò mò…"
                maxLength={500}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
                }}
              />
              <button
                className="ic-btn ic-img"
                title="Gửi ảnh"
                aria-label="Đính kèm ảnh"
                disabled={!isLoggedIn}
                onClick={() => { if (isLoggedIn) fileInput.current?.click(); else window.location.href = loginHref(); }}
              >
                <SproutyIcon name="camera" size={20} />
              </button>
              <button
                className={`ic-btn ic-voice${recording ? ' recording' : ''}`}
                title="Giọng nói"
                aria-label={recording ? "Dừng ghi âm" : "Nhập bằng giọng nói"}
                aria-pressed={recording}
                disabled={!isLoggedIn}
                onClick={toggleVoice}
              >
                <SproutyIcon name="microphone" size={20} />
              </button>
            </div>
            <button className="send-btn" title="Gửi" aria-label="Gửi câu hỏi" disabled={locked || typing || (!input.trim() && !image)} onClick={submit}>
              <SproutyIcon name="arrow-right" size={23} />
            </button>
          </div>

          <div className="buddy-input-hint"><span>Enter để gửi · Shift + Enter xuống dòng</span><span>{input.length}/500</span></div>
          <p className="buddy-ai-note">Sprouty là trợ lý AI, câu trả lời có thể chưa chính xác.</p>
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
