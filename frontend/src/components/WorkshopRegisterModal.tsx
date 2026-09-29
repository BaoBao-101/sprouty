import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import { formatPrice } from '@/types/product';
import type { PublicWorkshop, WorkshopPayment } from '@/types/workshop';
import { formatWorkshopWhen } from '@/types/workshop';

/**
 * Booking one specific session.
 *
 * The old form sat at the bottom of the page with a hardcoded dropdown of
 * session names, and sent the chosen *label* as the workshop id — so the server
 * never found a matching row. Worse, the form swallowed the 4xx and showed
 * "Đăng ký thành công!" regardless, which means every booking ever made through
 * it was lost while the parent was told they had a seat.
 *
 * This dialog is opened from a card, so the session is unambiguous, and a
 * failure is shown as a failure.
 */

const AGES = ['3–4 tuổi', '4–5 tuổi', '6–7 tuổi', '8–9 tuổi', '10–12 tuổi'];

export function WorkshopRegisterModal({
  workshop,
  onClose,
  onRegistered,
}: {
  workshop: PublicWorkshop;
  onClose: () => void;
  onRegistered: () => void;
}) {
  const { user, isLoggedIn } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(user?.email ?? '');
  const [childAge, setChildAge] = useState('');
  const [childCount, setChildCount] = useState('1');
  const [note, setNote] = useState('');

  const [payMethod, setPayMethod] = useState<'online' | 'onsite'>('online');

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  /** Transfer instructions, when the customer chose to pay now. */
  const [payment, setPayment] = useState<WorkshopPayment | null>(null);

  // Escape closes, and the page behind must not scroll under the dialog.
  useEffect(() => {
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
  }, [onClose]);

  const seats = parseInt(childCount, 10) || 1;
  const total = workshop.price * seats;

  async function submit() {
    setError('');
    if (name.trim().length < 2) return setError('Nhập họ tên phụ huynh.');
    const cleanPhone = phone.replace(/\s/g, '');
    if (!/^0\d{8,10}$/.test(cleanPhone)) {
      return setError('Số điện thoại không hợp lệ (VD: 0909000000).');
    }
    if (email && !/\S+@\S+\.\S+/.test(email)) return setError('Email không đúng định dạng.');
    if (seats > workshop.seatsLeft) {
      return setError(`Chỉ còn ${workshop.seatsLeft} chỗ cho buổi này.`);
    }

    setBusy(true);
    try {
      const res = await API.workshops.register({
        workshopId: workshop.id,
        guestName: name.trim(),
        guestPhone: cleanPhone,
        guestEmail: email.trim(),
        childAge,
        childCount: seats,
        note: note.trim(),
        paymentMethod: payMethod,
      });
      // Null when the session is free, or when SePay is not configured — the
      // booking still stands, the customer just pays at the venue.
      setPayment(res.payment ?? null);
      setDone(true);
      onRegistered();
    } catch (err: any) {
      // Surfaced, not swallowed: a full session or a duplicate booking is
      // exactly what the parent needs to be told.
      setError(err?.message || 'Không đăng ký được. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="ws-modal open"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ws-modal-box">
        <button className="ws-modal-close" onClick={onClose} aria-label="Đóng">
          ✕
        </button>

        {done ? (
          <div className="ws-done">
            <div className="ws-done-icon">{payment ? '🏦' : '🎉'}</div>
            <h3>{payment ? 'Quét mã để giữ chỗ' : 'Đã ghi nhận đăng ký!'}</h3>
            <p>
              {payment ? (
                <>
                  Đã giữ chỗ tạm cho <strong>{seats} bé</strong> ở{' '}
                  <strong>{workshop.title}</strong>. Chuyển khoản xong là suất được xác nhận tự
                  động.
                </>
              ) : payMethod === 'online' && total > 0 ? (
                // Asked to pay now but no transfer details came back — the
                // gateway is unconfigured or unreachable. Saying "đăng ký thành
                // công" and nothing else would leave them waiting for a QR that
                // never arrives.
                <>
                  Đã ghi nhận đăng ký <strong>{workshop.title}</strong> cho {seats} bé, nhưng
                  thanh toán online đang tạm không khả dụng. Chúng tôi sẽ gọi điện trong vòng 24
                  giờ để xác nhận suất và hướng dẫn thanh toán.
                </>
              ) : (
                <>
                  Cảm ơn bạn đã đăng ký <strong>{workshop.title}</strong> cho {seats} bé. Chúng tôi
                  sẽ gọi điện xác nhận suất trong vòng 24 giờ.
                </>
              )}
            </p>

            {payment && (
              <div className="ws-pay">
                <img className="ws-pay-qr" src={payment.qrUrl} alt="Mã QR chuyển khoản" />
                <div className="ws-pay-info">
                  <div>
                    <span>Ngân hàng</span>
                    <strong>{payment.bankCode}</strong>
                  </div>
                  <div>
                    <span>Số tài khoản</span>
                    <strong>{payment.accountNumber}</strong>
                  </div>
                  {payment.accountName && (
                    <div>
                      <span>Chủ tài khoản</span>
                      <strong>{payment.accountName}</strong>
                    </div>
                  )}
                  <div>
                    <span>Số tiền</span>
                    <strong className="ws-pay-amount">{formatPrice(payment.amount)}</strong>
                  </div>
                  {/* Without this exact reference the transfer cannot be matched
                      back to the booking, so it gets its own emphasis. */}
                  <div className="ws-pay-memo">
                    <span>Nội dung chuyển khoản</span>
                    <strong>{payment.memo}</strong>
                  </div>
                </div>
              </div>
            )}

            <div className="ws-done-recap">
              <div>
                <span>Buổi học</span>
                <strong>{formatWorkshopWhen(workshop)}</strong>
              </div>
              <div>
                <span>Địa điểm</span>
                <strong>{workshop.location}</strong>
              </div>
              <div>
                <span>Liên hệ</span>
                <strong>{phone}</strong>
              </div>
            </div>

            {payment && (
              <p className="ws-pay-note">
                Giữ nguyên nội dung chuyển khoản <strong>{payment.memo}</strong> để hệ thống nhận
                đúng suất của bạn.
                {isLoggedIn && ' Mã này xem lại được trong “Workshop của tôi”.'}
              </p>
            )}

            <button className="btn btn-primary btn-block" onClick={onClose}>
              {payment ? 'Tôi đã chuyển khoản' : 'Đóng'}
            </button>
          </div>
        ) : (
          <>
            <div className="ws-modal-head">
              {workshop.imageUrl && (
                <img className="ws-modal-thumb" src={workshop.imageUrl} alt="" />
              )}
              <div>
                <span className="ws-modal-kicker">Đăng ký workshop</span>
                <h3 className="ws-modal-title">
                  {workshop.title}
                </h3>
                <div className="ws-modal-meta">
                  📅 {formatWorkshopWhen(workshop)}
                  <br />
                  📍 {workshop.location}
                  {workshop.ageRange && <> · 👶 {workshop.ageRange}</>}
                </div>
                <div className="ws-modal-seats">
                  Còn <strong>{workshop.seatsLeft}</strong>/{workshop.capacity} chỗ
                </div>
              </div>
            </div>

            <div className="ws-modal-body">
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

              <div className="form-group">
                <label className="form-label">Email {isLoggedIn ? '' : '(tuỳ chọn)'}</label>
                <input
                  className="form-input"
                  type="email"
                  placeholder="email@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <div className="form-hint">Chúng tôi gửi xác nhận và lời nhắc trước buổi học.</div>
              </div>

              <div className="ws-form-row">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Tuổi của bé</label>
                  <select
                    className="form-input"
                    value={childAge}
                    onChange={(e) => setChildAge(e.target.value)}
                  >
                    <option value="">-- Chọn độ tuổi --</option>
                    {AGES.map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                  {workshop.ageRange && (
                    <div className="form-hint">Buổi này phù hợp {workshop.ageRange}</div>
                  )}
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Số bé tham gia</label>
                  <select
                    className="form-input"
                    value={childCount}
                    onChange={(e) => setChildCount(e.target.value)}
                  >
                    {Array.from({ length: Math.min(5, Math.max(1, workshop.seatsLeft)) }, (_, i) => (
                      <option value={i + 1} key={i}>
                        {i + 1} bé
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Only when there is something to pay. Paying up front is what
                  actually holds the seat, so the trade-off is spelled out
                  rather than left for the customer to discover at the door. */}
              {workshop.price > 0 && (
                <div className="form-group">
                  <label className="form-label">Hình thức thanh toán</label>
                  <div className="ws-pay-choices">
                    <label className={`ws-pay-choice${payMethod === 'online' ? ' active' : ''}`}>
                      <input
                        type="radio"
                        name="ws-pay"
                        checked={payMethod === 'online'}
                        onChange={() => setPayMethod('online')}
                      />
                      <div>
                        <strong>💳 Thanh toán online ngay</strong>
                        <div className="ws-pay-choice-hint ok">
                          Quét QR chuyển khoản — chỗ được giữ chắc chắn cho bé.
                        </div>
                      </div>
                    </label>

                    <label className={`ws-pay-choice${payMethod === 'onsite' ? ' active' : ''}`}>
                      <input
                        type="radio"
                        name="ws-pay"
                        checked={payMethod === 'onsite'}
                        onChange={() => setPayMethod('onsite')}
                      />
                      <div>
                        <strong>🏫 Thanh toán tại buổi học</strong>
                        <div className="ws-pay-choice-hint warn">
                          ⚠️ Chưa chắc chắn còn chỗ. Khi buổi học kín, suất sẽ ưu tiên cho những
                          người đã thanh toán online trước.
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Ghi chú (tuỳ chọn)</label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="Yêu cầu đặc biệt, dị ứng nguyên liệu..."
                  style={{ minHeight: 68, resize: 'vertical' }}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              {error && <div className="form-error mb-12">{error}</div>}
            </div>

            <div className="ws-modal-foot">
              <div className="ws-modal-total">
                <span>Tạm tính</span>
                <strong>{formatPrice(total)}</strong>
                {seats > 1 && <em>{formatPrice(workshop.price)} × {seats} bé</em>}
              </div>
              <button className="btn btn-primary btn-lg" disabled={busy} onClick={submit}>
                {busy
                  ? 'Đang gửi...'
                  : payMethod === 'online' && total > 0
                    ? 'Đăng ký & thanh toán →'
                    : 'Xác nhận đăng ký →'}
              </button>
            </div>
            <p className="ws-form-note">
              {payMethod === 'online' && total > 0
                ? 'Chuyển khoản qua QR · Xác nhận suất tự động · Huỷ trước 24h'
                : 'Giữ chỗ tạm · Thanh toán tại buổi học · Huỷ trước 24h'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
