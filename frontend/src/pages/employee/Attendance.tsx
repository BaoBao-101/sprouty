/**
 * The door.
 *
 * Everything on this screen is for someone standing in a doorway with a
 * tablet while parents arrive: today by default, the sessions running today,
 * and for each one a register where the people who have not arrived yet are at
 * the top. Nothing here needs more than one tap.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import { AdminIcon } from '@/components/icons/AdminIcon';
import {
  BlockStates,
  PageHeader,
  Panel,
  Pill,
  StatCard,
  StatGrid,
  type LoadState,
} from '@/components/admin/ui';
import './Attendance.css';

interface Session {
  id: string;
  title: string;
  dateTime: string;
  endTime: string | null;
  location: string;
  capacity: number;
  bookings: number;
  checkedIn: number;
  bookedSeats: number;
  arrivedSeats: number;
  unpaid: number;
}

interface LookupHit {
  attendee: Attendee;
  workshop: { id: string; title: string; dateTime: string; location: string };
}

interface Attendee {
  id: string;
  ticket: string;
  name: string;
  email: string | null;
  phone: string | null;
  childAge: string | null;
  childCount: number;
  note: string | null;
  status: string;
  amount: number;
  paidAt: string | null;
  paymentMethod: string;
  checkedInAt: string | null;
  attendedCount: number | null;
  checkedInBy: string | null;
}

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

const today = () => {
  // Local date, not toISOString: at 7am in Hanoi the UTC date is still
  // yesterday, and the door would open on the wrong day's register.
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default function Attendance() {
  const [date, setDate] = useState(today);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState('');

  const [openId, setOpenId] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [regState, setRegState] = useState<LoadState>('loading');
  const [regError, setRegError] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  // The ticket desk: a parent shows a QR or reads six characters out, and
  // either way staff end up typing the same string here.
  const [code, setCode] = useState('');
  const [found, setFound] = useState<LookupHit | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [looking, setLooking] = useState(false);

  const loadDay = useCallback(() => {
    setState('loading');
    API.attendance
      .day(date)
      .then((data: any) => {
        setSessions(data.workshops || []);
        setState('ready');
        // One session on the day is the usual case; opening it saves a tap.
        if ((data.workshops || []).length === 1) setOpenId(data.workshops[0].id);
      })
      .catch((err: any) => {
        setError(err?.message || 'Không tải được danh sách buổi học.');
        setState('error');
      });
  }, [date]);

  useEffect(loadDay, [loadDay]);

  const loadRegister = useCallback((workshopId: string) => {
    setRegState('loading');
    API.attendance
      .register(workshopId)
      .then((data: any) => {
        setAttendees(data.attendees || []);
        setRegState('ready');
      })
      .catch((err: any) => {
        setRegError(err?.message || 'Không tải được danh sách đăng ký.');
        setRegState('error');
      });
  }, []);

  useEffect(() => {
    if (openId) loadRegister(openId);
    else setAttendees([]);
  }, [openId, loadRegister]);

  const open = sessions.find((s) => s.id === openId) || null;

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return attendees;
    return attendees.filter(
      (a) =>
        a.name.toLowerCase().includes(term) ||
        a.ticket.toLowerCase().includes(term) ||
        (a.phone || '').includes(term),
    );
  }, [attendees, search]);

  const arrived = attendees.filter((a) => a.checkedInAt);
  const waiting = attendees.filter((a) => !a.checkedInAt);

  async function lookup(raw: string) {
    const wanted = raw.trim().toUpperCase();
    if (!wanted) return;
    setLooking(true);
    setLookupError('');
    try {
      const hit = await API.attendance.lookup(wanted);
      setFound(hit);
      // Opening the session the ticket belongs to puts the rest of the
      // register in front of staff without another tap.
      setOpenId(hit.workshop.id);
    } catch (err: any) {
      setFound(null);
      setLookupError(err?.message || 'Không tra được mã vé.');
    } finally {
      setLooking(false);
    }
  }

  async function checkInFound() {
    if (!found || busy) return;
    setBusy(found.attendee.id);
    try {
      const { attendee } = found.attendee.checkedInAt
        ? await API.attendance.undo(found.workshop.id, found.attendee.id)
        : await API.attendance.checkIn(found.workshop.id, found.attendee.id);
      setFound({ ...found, attendee });
      setAttendees((list) => list.map((a) => (a.id === attendee.id ? attendee : a)));
      showToast(
        attendee.checkedInAt ? `Đã điểm danh ${attendee.name}` : `Đã bỏ điểm danh ${attendee.name}`,
        'success',
      );
      loadDay();
    } catch (err: any) {
      showToast(err?.message || 'Không cập nhật được điểm danh.', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function toggle(attendee: Attendee) {
    if (!openId || busy) return;
    setBusy(attendee.id);
    try {
      const { attendee: next } = attendee.checkedInAt
        ? await API.attendance.undo(openId, attendee.id)
        : await API.attendance.checkIn(openId, attendee.id);

      setAttendees((list) => list.map((a) => (a.id === next.id ? next : a)));
      showToast(
        next.checkedInAt ? `Đã điểm danh ${next.name}` : `Đã bỏ điểm danh ${next.name}`,
        'success',
      );
      // The tiles on the day view count arrivals, so they are now stale.
      loadDay();
    } catch (err: any) {
      showToast(err?.message || 'Không cập nhật được điểm danh.', 'error');
    } finally {
      setBusy(null);
    }
  }

  const totals = sessions.reduce(
    (acc, s) => ({
      sessions: acc.sessions + 1,
      booked: acc.booked + s.bookedSeats,
      arrived: acc.arrived + s.arrivedSeats,
      unpaid: acc.unpaid + s.unpaid,
    }),
    { sessions: 0, booked: 0, arrived: 0, unpaid: 0 },
  );

  return (
    <>
      <PageHeader
        title="Điểm danh"
        subtitle="Xác nhận phụ huynh đã đưa bé tới buổi workshop"
        actions={
          <div className="att-date">
            <AdminIcon name="calendar" size={16} />
            <input
              className="form-input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value || today())}
            />
            {date !== today() && (
              <button className="btn btn-ghost btn-sm" onClick={() => setDate(today())}>
                Hôm nay
              </button>
            )}
          </div>
        }
      />

      {/* The ticket desk, above everything: it is the first thing that
          happens when somebody walks in. */}
      <div className="att-desk">
        <div className="att-desk-head">
          <AdminIcon name="ticket" size={20} />
          <div>
            <strong>Tra mã vé</strong>
            <span>Quét QR trên điện thoại phụ huynh, hoặc nhập 6 ký tự trên vé</span>
          </div>
        </div>

        <form
          className="att-desk-form"
          onSubmit={(e) => {
            e.preventDefault();
            void lookup(code);
          }}
        >
          <input
            className="form-input att-code"
            placeholder="VD: 9A3NA3"
            value={code}
            maxLength={24}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <button className="btn btn-primary" disabled={looking || !code.trim()}>
            <AdminIcon name="search" size={17} />
            {looking ? 'Đang tra…' : 'Tra vé'}
          </button>
          {(found || lookupError) && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setCode('');
                setFound(null);
                setLookupError('');
              }}
            >
              Xoá
            </button>
          )}
        </form>

        {lookupError && (
          <div className="att-desk-miss">
            <AdminIcon name="alert" size={16} /> {lookupError}
          </div>
        )}

        {found && (
          <div className={`att-desk-hit${found.attendee.checkedInAt ? ' done' : ''}`}>
            <div className="att-desk-hit-main">
              <span className="att-ticket">{found.attendee.ticket}</span>
              <div>
                <strong>{found.attendee.name}</strong>
                <span>
                  {found.attendee.childCount} bé
                  {found.attendee.childAge ? ` · ${found.attendee.childAge}` : ''}
                  {found.attendee.phone ? ` · ${found.attendee.phone}` : ''}
                </span>
                <span className="att-desk-hit-ws">
                  <AdminIcon name="workshop" size={13} /> {found.workshop.title} ·{' '}
                  {new Date(found.workshop.dateTime).toLocaleString('vi-VN', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {found.attendee.note && <em className="att-note">“{found.attendee.note}”</em>}
              </div>
            </div>

            <div className="att-desk-hit-side">
              {found.attendee.paidAt ? (
                <Pill tone="green">Đã thanh toán</Pill>
              ) : (
                <Pill tone="amber">
                  Thu tại chỗ · {found.attendee.amount.toLocaleString('vi-VN')}đ
                </Pill>
              )}
              {found.attendee.checkedInAt && (
                <span className="att-when">
                  <AdminIcon name="check" size={13} /> Đã tới lúc{' '}
                  {time(found.attendee.checkedInAt)}
                </span>
              )}
              <button
                className={`att-btn${found.attendee.checkedInAt ? ' undo' : ''}`}
                disabled={busy === found.attendee.id}
                onClick={checkInFound}
              >
                <AdminIcon name={found.attendee.checkedInAt ? 'refresh' : 'check'} size={17} />
                {busy === found.attendee.id
                  ? 'Đang lưu…'
                  : found.attendee.checkedInAt
                    ? 'Bỏ điểm danh'
                    : 'Xác nhận đã tới'}
              </button>
            </div>
          </div>
        )}
      </div>

      <StatGrid>
        <StatCard
          icon={<AdminIcon name="workshop" />}
          tone="orange"
          loading={state === 'loading'}
          value={totals.sessions}
          label="Buổi trong ngày"
        />
        <StatCard
          icon={<AdminIcon name="check" />}
          tone="green"
          loading={state === 'loading'}
          value={`${totals.arrived}/${totals.booked}`}
          label="Bé đã tới"
          hint={totals.booked ? `${Math.round((totals.arrived / totals.booked) * 100)}% đã có mặt` : undefined}
        />
        <StatCard
          icon={<AdminIcon name="sales" />}
          tone={totals.unpaid ? 'amber' : 'grey'}
          loading={state === 'loading'}
          value={totals.unpaid}
          label="Chưa thu tiền"
          hint={totals.unpaid ? 'Thu tại chỗ khi phụ huynh tới' : 'Đã thu đủ'}
        />
      </StatGrid>

      <Panel title={`Buổi học ngày ${date.split('-').reverse().join('/')}`}>
        <BlockStates
          state={state}
          error={error}
          isEmpty={sessions.length === 0}
          emptyIcon={<AdminIcon name="calendar" size={24} />}
          emptyTitle="Không có buổi nào trong ngày này"
          emptyHint="Chọn ngày khác để xem danh sách điểm danh."
          onRetry={loadDay}
        />

        {state === 'ready' && sessions.length > 0 && (
          <div className="att-sessions">
            {sessions.map((s) => {
              const isOpen = s.id === openId;
              const pct = s.bookedSeats ? Math.round((s.arrivedSeats / s.bookedSeats) * 100) : 0;
              return (
                <button
                  key={s.id}
                  className={`att-session${isOpen ? ' open' : ''}`}
                  onClick={() => setOpenId(isOpen ? null : s.id)}
                >
                  <span className="att-session-time">
                    {time(s.dateTime)}
                    {s.endTime && <em>–{time(s.endTime)}</em>}
                  </span>
                  <span className="att-session-main">
                    <strong>{s.title}</strong>
                    <span className="att-session-loc">
                      <AdminIcon name="pin" size={13} /> {s.location}
                    </span>
                  </span>
                  <span className="att-session-count">
                    <b>
                      {s.arrivedSeats}/{s.bookedSeats}
                    </b>
                    <em>bé đã tới</em>
                    <span className="att-bar">
                      <span style={{ width: `${pct}%` }} />
                    </span>
                  </span>
                  <AdminIcon name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} />
                </button>
              );
            })}
          </div>
        )}
      </Panel>

      {open && (
        <Panel
          title={`Danh sách – ${open.title}`}
          action={
            <div className="att-register-tools">
              <span className="att-register-count">
                <b>{arrived.length}</b> đã tới · <b>{waiting.length}</b> chưa tới
              </span>
              <div className="att-search">
                <AdminIcon name="search" size={16} />
                <input
                  className="form-input"
                  placeholder="Tên, mã vé hoặc số điện thoại…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          }
        >
          <BlockStates
            state={regState}
            error={regError}
            isEmpty={visible.length === 0}
            emptyIcon={<AdminIcon name="users" size={24} />}
            emptyTitle={search ? 'Không tìm thấy ai' : 'Chưa có ai đăng ký buổi này'}
            emptyHint={search ? 'Thử tên khác hoặc xoá từ khoá.' : undefined}
            onRetry={() => loadRegister(open.id)}
          />

          {regState === 'ready' && visible.length > 0 && (
            <ul className="att-list">
              {visible.map((a) => (
                <li key={a.id} className={`att-row${a.checkedInAt ? ' done' : ''}`}>
                  <span className="att-ticket">{a.ticket}</span>

                  <div className="att-who">
                    <strong>{a.name}</strong>
                    <span>
                      {a.childCount} bé
                      {a.childAge ? ` · ${a.childAge}` : ''}
                      {a.phone ? ` · ${a.phone}` : ''}
                    </span>
                    {a.note && <em className="att-note">“{a.note}”</em>}
                  </div>

                  <div className="att-flags">
                    {a.paidAt ? (
                      <Pill tone="green">Đã thanh toán</Pill>
                    ) : (
                      <Pill tone="amber">Thu tại chỗ · {a.amount.toLocaleString('vi-VN')}đ</Pill>
                    )}
                    {a.checkedInAt && (
                      <span className="att-when">
                        <AdminIcon name="clock" size={13} /> {time(a.checkedInAt)}
                        {a.checkedInBy ? ` · ${a.checkedInBy}` : ''}
                      </span>
                    )}
                  </div>

                  <button
                    className={`att-btn${a.checkedInAt ? ' undo' : ''}`}
                    disabled={busy === a.id}
                    onClick={() => toggle(a)}
                  >
                    <AdminIcon name={a.checkedInAt ? 'refresh' : 'check'} size={17} />
                    {busy === a.id ? 'Đang lưu…' : a.checkedInAt ? 'Bỏ điểm danh' : 'Đã tới'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </>
  );
}
