import { useState } from 'react';
import { Link } from 'react-router-dom';
import { showToast } from '@/services/toast';

const SUBJECTS = [
  { value: 'order', label: 'Hỏi về đặt hàng / thanh toán' },
  { value: 'shipping', label: 'Theo dõi / hỏi về giao hàng' },
  { value: 'return', label: 'Yêu cầu đổi trả / hoàn tiền' },
  { value: 'product', label: 'Hỏi về sản phẩm / kit' },
  { value: 'account', label: 'Vấn đề tài khoản / video' },
  { value: 'workshop', label: 'Đăng ký / hỏi về workshop' },
  { value: 'partner', label: 'Hợp tác / đối tác' },
  { value: 'feedback', label: 'Góp ý / báo lỗi website' },
  { value: 'other', label: 'Khác' },
];

const STORAGE_KEY = 'cdb_contacts';

const EMPTY = { name: '', phone: '', email: '', subject: '', order: '', message: '' };

export function ContactForm() {
  const [form, setForm] = useState(EMPTY);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);

  const set = (key: keyof typeof EMPTY) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  function submit() {
    setError('');
    const { name, email, subject, message } = form;

    if (!name.trim() || !email.trim() || !subject || !message.trim()) {
      return setError('Vui lòng điền đầy đủ các trường bắt buộc (*).');
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      return setError('Địa chỉ email không đúng định dạng.');
    }
    if (!consent) {
      return setError('Vui lòng đồng ý với chính sách lưu trữ thông tin.');
    }

    // No contact endpoint on the backend yet, so the message is parked in
    // localStorage the way the old page did it.
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      stored.push({ id: `ct_${Date.now()}`, ...form, date: new Date().toISOString() });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      /* private mode — the confirmation below is still the right outcome */
    }

    setSentTo(email);
    showToast('Đã gửi tin nhắn thành công! 📧', 'success');
  }

  function reset() {
    setForm(EMPTY);
    setConsent(false);
    setError('');
    setSentTo(null);
  }

  if (sentTo) {
    return (
      <div className="contact-form-card">
        <div className="form-success">
          <div style={{ fontSize: '4rem', marginBottom: 16 }}>🎉</div>
          <h3 style={{ marginBottom: 8, color: 'var(--green)' }}>Đã gửi thành công!</h3>
          <p className="contact-success-text">
            Cảm ơn bạn đã liên hệ. Chúng tôi sẽ phản hồi email <strong>{sentTo}</strong> trong vòng 4
            giờ làm việc.
          </p>
          <button className="btn btn-outline" onClick={reset}>
            Gửi thêm tin nhắn
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="contact-form-card">
      <h2>Gửi tin nhắn</h2>
      <p>Mô tả vấn đề càng chi tiết, chúng tôi càng hỗ trợ được nhanh hơn.</p>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">
            Họ và tên <span className="req">*</span>
          </label>
          <input
            className="form-input"
            type="text"
            placeholder="Nguyễn Văn A"
            autoComplete="name"
            value={form.name}
            onChange={(e) => set('name')(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Số điện thoại</label>
          <input
            className="form-input"
            type="tel"
            placeholder="0909 000 000"
            autoComplete="tel"
            value={form.phone}
            onChange={(e) => set('phone')(e.target.value)}
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">
          Email <span className="req">*</span>
        </label>
        <input
          className="form-input"
          type="email"
          placeholder="email@example.com"
          autoComplete="email"
          value={form.email}
          onChange={(e) => set('email')(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">
          Chủ đề <span className="req">*</span>
        </label>
        <select
          className="form-input"
          value={form.subject}
          onChange={(e) => set('subject')(e.target.value)}
        >
          <option value="">-- Chọn chủ đề --</option>
          {SUBJECTS.map((s) => (
            <option value={s.value} key={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">
          Mã đơn hàng <span className="opt">(nếu có)</span>
        </label>
        <input
          className="form-input"
          type="text"
          placeholder="VD: ord_001"
          value={form.order}
          onChange={(e) => set('order')(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">
          Nội dung tin nhắn <span className="req">*</span>
        </label>
        <textarea
          className="form-input"
          rows={5}
          placeholder="Mô tả chi tiết vấn đề của bạn..."
          style={{ resize: 'vertical', minHeight: 120 }}
          value={form.message}
          onChange={(e) => set('message')(e.target.value)}
        />
      </div>

      {error && <div className="form-error mb-12">{error}</div>}

      <div className="contact-consent">
        <input
          type="checkbox"
          id="ctConsent"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <label htmlFor="ctConsent">
          Tôi đồng ý để Sprouty lưu trữ thông tin liên hệ để phản hồi yêu cầu này theo{' '}
          <Link to="/privacy">chính sách bảo mật</Link>.
        </label>
      </div>

      <button className="btn btn-primary btn-block btn-lg" onClick={submit}>
        Gửi tin nhắn →
      </button>
      <p className="contact-form-note">Phản hồi trong 4 giờ làm việc · Không gửi spam</p>
    </div>
  );
}
