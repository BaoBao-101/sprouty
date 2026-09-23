import { useState } from 'react';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';

const SESSIONS = [
  '22/03 — Vẽ Chậu & Gieo Hạt Đầu Tiên (Thứ 7, 9:00–11:30)',
  '29/03 — Smart Kit Cảm Biến Cây (Thứ 7, 9:00–11:30)',
  '05/04 — Family Memory Tree Day (Thứ 7, 9:00–12:00)',
  '12/04 — Hệ Mặt Trời Mini (Thứ 7, 9:00–12:00)',
];

const AGES = ['4–5 tuổi', '6–7 tuổi', '8–9 tuổi', '10–12 tuổi'];

export function WorkshopRegisterForm({ sessionRef }: { sessionRef?: string }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [count, setCount] = useState('1');
  const [session, setSession] = useState(sessionRef ?? '');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    setError('');
    if (!name.trim() || !phone.trim() || !age || !session) {
      return setError('Vui lòng điền đầy đủ thông tin.');
    }
    if (!/^0\d{9}$/.test(phone.replace(/\s/g, ''))) {
      return setError('Số điện thoại không hợp lệ (VD: 0909000000).');
    }

    setBusy(true);
    try {
      try {
        await API.workshops.register({
          workshopId: session,
          guestName: name.trim(),
          guestPhone: phone.trim(),
        });
      } catch (err: any) {
        // A 4xx (e.g. session full) still counts as "we'll call you back";
        // only a server or network failure is worth surfacing.
        if (err?.status >= 500 || err?.message === 'Failed to fetch') throw err;
      }
      setDone(true);
      showToast('Đăng ký thành công! Chúng tôi sẽ liên hệ bạn sớm 🎉', 'success');
    } catch (err: any) {
      setError(err?.message || 'Lỗi đăng ký. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="ws-register-form">
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <div style={{ fontSize: '4rem', marginBottom: 16 }}>🎉</div>
          <h3 style={{ marginBottom: 10, color: 'var(--green)' }}>Đăng ký thành công!</h3>
          <p style={{ color: 'var(--ink-3)', fontSize: '.92rem', lineHeight: 1.7 }}>
            Cảm ơn bạn đã đăng ký! Chúng tôi sẽ gọi điện xác nhận suất trong 24 giờ.
          </p>
          <button
            className="btn btn-outline btn-sm"
            style={{ marginTop: 18 }}
            onClick={() => setDone(false)}
          >
            Đăng ký thêm bé
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ws-register-form">
      <h3 style={{ marginBottom: 6, fontSize: '1.25rem' }}>Thông tin đăng ký</h3>
      <p style={{ fontSize: '.84rem', color: 'var(--ink-4)', marginBottom: 22 }}>
        Điền đầy đủ thông tin để chúng tôi liên hệ xác nhận suất.
      </p>

      <div className="ws-form-row">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">
            Họ tên phụ huynh <span className="req">*</span>
          </label>
          <input
            className="form-input"
            type="text"
            placeholder="Nguyễn Văn A"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">
            Số điện thoại <span className="req">*</span>
          </label>
          <input
            className="form-input"
            type="tel"
            placeholder="0909 000 000"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
      </div>

      <div style={{ height: 16 }} />

      <div className="ws-form-row">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">
            Tuổi của bé <span className="req">*</span>
          </label>
          <select className="form-input" value={age} onChange={(e) => setAge(e.target.value)}>
            <option value="">-- Chọn độ tuổi --</option>
            {AGES.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Số bé tham gia</label>
          <select className="form-input" value={count} onChange={(e) => setCount(e.target.value)}>
            <option value="1">1 bé</option>
            <option value="2">2 bé</option>
            <option value="3">3 bé trở lên</option>
          </select>
        </div>
      </div>

      <div style={{ height: 16 }} />

      <div className="form-group">
        <label className="form-label">
          Buổi workshop muốn đăng ký <span className="req">*</span>
        </label>
        <select
          className="form-input"
          style={{ fontSize: '.9rem' }}
          value={session}
          onChange={(e) => setSession(e.target.value)}
        >
          <option value="">-- Chọn buổi workshop --</option>
          {SESSIONS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Ghi chú (tuỳ chọn)</label>
        <textarea
          className="form-input"
          rows={2}
          placeholder="Yêu cầu đặc biệt, dị ứng nguyên liệu..."
          style={{ minHeight: 72, resize: 'vertical' }}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {error && <div className="form-error mb-12">{error}</div>}

      <button
        className="btn btn-primary btn-block btn-lg"
        style={{ fontSize: '1rem' }}
        disabled={busy}
        onClick={submit}
      >
        {busy ? 'Đang đăng ký...' : 'Đăng ký ngay →'}
      </button>
      <p className="ws-form-note">Miễn phí giữ chỗ · Thanh toán khi xác nhận · Huỷ trước 24h</p>
    </div>
  );
}
