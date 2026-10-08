import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import { formatPrice } from '@/types/product';
import { TicketQr } from '@/components/TicketQr';
import { Pager } from '@/components/Pager';
import {
  formatWorkshopWhen,
  type MyWorkshopRegistration,
  type WorkshopPayment,
} from '@/types/workshop';
import './MyWorkshops.css';

/**
 * The customer's own workshop bookings.
 *
 * Registering produced a confirmation dialog and then nothing: once it closed
 * there was nowhere to check when the session was, where it was, whether the
 * seat had been confirmed, or how to pay for it.
 */

/**
 * A booking's state is its payment state — there is no separate approval step,
 * because paying is the approval and an unpaid seat is not held regardless of
 * what anyone ticked.
 */
function bookingState(r: MyWorkshopRegistration) {
  if (r.status === 'cancelled') return { label: 'Đã huỷ', cls: 'cancelled' };
  // Attending outranks paying once it has happened: by then the question
  // is no longer whether the seat is held, it is whether the child went.
  if (r.checkedInAt) return { label: 'Đã tham gia', cls: 'attended' };
  if (r.paidAt) return { label: 'Đã thanh toán', cls: 'paid' };
  if (r.amount === 0) return { label: 'Đã giữ chỗ', cls: 'paid' };
  return { label: 'Chưa thanh toán', cls: 'unpaid' };
}

/** Four to a page: these cards are tall, each one carrying a ticket. */
const PER_PAGE = 4;

export default function MyWorkshops() {
  const { isLoggedIn } = useAuth();
  const [rows, setRows] = useState<MyWorkshopRegistration[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [payment, setPayment] = useState<{ reg: MyWorkshopRegistration; info: WorkshopPayment } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [soonPage, setSoonPage] = useState(1);
  const [pastPage, setPastPage] = useState(1);

  const load = useCallback(() => {
    if (!isLoggedIn) return setState('ready');
    setState('loading');
    API.workshops
      .mine()
      .then((data: any) => {
        setRows(data.registrations || []);
        setState('ready');
      })
      .catch((err: any) => {
        setError(err?.message || 'Không tải được danh sách.');
        setState('error');
      });
  }, [isLoggedIn]);

  useEffect(load, [load]);

  async function openPayment(reg: MyWorkshopRegistration) {
    setBusyId(reg.id);
    try {
      const { payment: info } = await API.workshops.payment(reg.id);
      setPayment({ reg, info });
    } catch (err: any) {
      showToast(err?.message || 'Không lấy được thông tin thanh toán.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(reg: MyWorkshopRegistration) {
    if (
      !confirm(
        `Huỷ đăng ký "${reg.workshop.title}"?\n\nChỗ sẽ được mở lại cho người khác.` +
          (reg.paidAt ? '\n\nBạn đã thanh toán — vui lòng liên hệ để được hoàn tiền.' : ''),
      )
    )
      return;

    setBusyId(reg.id);
    try {
      const { message } = await API.workshops.cancelMine(reg.id);
      showToast(message || 'Đã huỷ đăng ký', 'success');
      load();
    } catch (err: any) {
      showToast(err?.message || 'Không huỷ được.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  if (!isLoggedIn) {
    return (
      <main className="container section-sm">
        <h1>Workshop của tôi</h1>
        <div className="myws-empty">
          <div className="myws-empty-icon">🔒</div>
          <p>Đăng nhập để xem các buổi workshop bạn đã đăng ký.</p>
        </div>
      </main>
    );
  }

  const upcoming = rows.filter((r) => r.upcoming && r.status !== 'cancelled');
  const others = rows.filter((r) => !r.upcoming || r.status === 'cancelled');

  // Paged in the browser: a family has a handful of bookings, and the list
  // is already in hand. Paging is here to stop four tall ticket cards
  // burying the next section, not to save a request.
  const soon = upcoming.slice((soonPage - 1) * PER_PAGE, soonPage * PER_PAGE);
  const past = others.slice((pastPage - 1) * PER_PAGE, pastPage * PER_PAGE);

  function card(reg: MyWorkshopRegistration) {
    const w = reg.workshop;
    // An unpaid booking on a paid session is the one that can lose its place,
    // so it is the one that gets a call to action.
    const needsPayment = !reg.paidAt && reg.amount > 0 && reg.status !== 'cancelled' && reg.upcoming;

    return (
      <article className={`myws-card${reg.status === 'cancelled' ? ' cancelled' : ''}`} key={reg.id}>
        <div className="myws-photo">
          {w.imageUrl ? <img src={w.imageUrl} alt="" /> : <span>🎪</span>}
        </div>

        <div className="myws-main">
          <div className="myws-head">
            <h3>{w.title}</h3>
            <span className={`myws-status s-${bookingState(reg).cls}`}>
              {bookingState(reg).label}
            </span>
          </div>

          <div className="myws-meta">
            <span>📅 {formatWorkshopWhen(w)}</span>
            <span>📍 {w.location}</span>
            <span>👶 {reg.childCount} bé{reg.childAge ? ` · ${reg.childAge}` : ''}</span>
          </div>

          {reg.note && <div className="myws-note">📝 {reg.note}</div>}

          <div className="myws-pay">
            {reg.amount === 0 ? (
              <span className="myws-paid">Miễn phí</span>
            ) : reg.paidAt ? (
              <span className="myws-paid">
                ✓ Đã thanh toán {formatPrice(reg.amount)} ·{' '}
                {new Date(reg.paidAt).toLocaleDateString('vi-VN')}
              </span>
            ) : (
              <span className="myws-unpaid">
                Chưa thanh toán {formatPrice(reg.amount)}
                {reg.paymentMethod === 'onsite' && ' · trả tại buổi học'}
              </span>
            )}
          </div>

          {needsPayment && reg.paymentMethod === 'onsite' && (
            <div className="myws-warn">
              ⚠️ Suất này chưa được đảm bảo. Khi buổi học kín chỗ, chúng tôi ưu tiên những người
              đã thanh toán trước.
            </div>
          )}

          {/* The ticket. A booking was a receipt until now: it recorded that
              money had changed hands and nothing about the day itself. The
              code is what staff ask for at the door, the QR is the same
              string for a phone camera, and once somebody ticks it off here
              is where the parent sees that it happened. */}
          {reg.status !== 'cancelled' && (
            <div className={`myws-ticket${reg.checkedInAt ? ' used' : ''}`}>
              <TicketQr value={reg.ticket} size={104} />
              <div className="myws-ticket-body">
                <span className="myws-ticket-label">Mã vé của bạn</span>
                <strong className="myws-ticket-code">{reg.ticket}</strong>
                {reg.checkedInAt ? (
                  <span className="myws-ticket-done">
                    ✓ Đã điểm danh lúc{' '}
                    {new Date(reg.checkedInAt).toLocaleString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {reg.attendedCount ? ` · ${reg.attendedCount} bé` : ''}
                  </span>
                ) : (
                  <span className="myws-ticket-hint">
                    Đưa mã này cho nhân viên khi tới buổi học để xác nhận.
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="myws-actions">
            {needsPayment && (
              <button
                className="btn btn-primary btn-sm"
                disabled={busyId === reg.id}
                onClick={() => openPayment(reg)}
              >
                {busyId === reg.id ? 'Đang tải…' : '💳 Thanh toán ngay'}
              </button>
            )}
            {reg.upcoming && reg.status !== 'cancelled' && (
              <button
                className="btn btn-ghost btn-sm"
                disabled={busyId === reg.id}
                onClick={() => cancel(reg)}
              >
                Huỷ đăng ký
              </button>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <main className="container section-sm">
      <h1>Workshop của tôi</h1>
      <p className="myws-lead">Các buổi workshop bạn đã đăng ký cho bé.</p>

      {state === 'loading' && <div className="myws-empty">Đang tải…</div>}
      {state === 'error' && (
        <div className="myws-empty">
          <div className="myws-empty-icon">⚠️</div>
          <p>{error}</p>
          <button className="btn btn-ghost btn-sm" onClick={load}>
            Thử lại
          </button>
        </div>
      )}

      {state === 'ready' && rows.length === 0 && (
        <div className="myws-empty">
          <div className="myws-empty-icon">🎪</div>
          <p>Bạn chưa đăng ký buổi workshop nào.</p>
          <Link to="/workshop" className="btn btn-primary" style={{ marginTop: 12 }}>
            Xem lịch workshop
          </Link>
        </div>
      )}

      {state === 'ready' && upcoming.length > 0 && (
        <>
          <h2 className="myws-section">Sắp tới ({upcoming.length})</h2>
          <div className="myws-list">{soon.map(card)}</div>
          <Pager
            page={soonPage}
            pages={Math.ceil(upcoming.length / PER_PAGE)}
            total={upcoming.length}
            unit="buổi sắp tới"
            onChange={setSoonPage}
          />
        </>
      )}

      {state === 'ready' && others.length > 0 && (
        <>
          <h2 className="myws-section">Đã qua &amp; đã huỷ ({others.length})</h2>
          <div className="myws-list">{past.map(card)}</div>
          <Pager
            page={pastPage}
            pages={Math.ceil(others.length / PER_PAGE)}
            total={others.length}
            unit="buổi"
            onChange={setPastPage}
          />
        </>
      )}

      {payment && (
        <div
          className="ws-modal open"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPayment(null);
          }}
        >
          <div className="ws-modal-box">
            <button className="ws-modal-close" onClick={() => setPayment(null)} aria-label="Đóng">
              ✕
            </button>
            <div className="ws-done">
              <div className="ws-done-icon">🏦</div>
              <h3>Chuyển khoản giữ chỗ</h3>
              <p>
                Quét mã để thanh toán <strong>{payment.reg.workshop.title}</strong>. Suất được xác
                nhận tự động sau khi ngân hàng báo có.
              </p>

              <div className="ws-pay">
                <img className="ws-pay-qr" src={payment.info.qrUrl} alt="Mã QR chuyển khoản" />
                <div className="ws-pay-info">
                  <div>
                    <span>Ngân hàng</span>
                    <strong>{payment.info.bankCode}</strong>
                  </div>
                  <div>
                    <span>Số tài khoản</span>
                    <strong>{payment.info.accountNumber}</strong>
                  </div>
                  {payment.info.accountName && (
                    <div>
                      <span>Chủ tài khoản</span>
                      <strong>{payment.info.accountName}</strong>
                    </div>
                  )}
                  <div>
                    <span>Số tiền</span>
                    <strong className="ws-pay-amount">{formatPrice(payment.info.amount)}</strong>
                  </div>
                  <div className="ws-pay-memo">
                    <span>Nội dung chuyển khoản</span>
                    <strong>{payment.info.memo}</strong>
                  </div>
                </div>
              </div>

              <p className="ws-pay-note">
                Giữ nguyên nội dung <strong>{payment.info.memo}</strong> để hệ thống nhận đúng
                suất của bạn.
              </p>

              <button
                className="btn btn-primary btn-block"
                onClick={() => {
                  setPayment(null);
                  load();
                }}
              >
                Tôi đã chuyển khoản
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
