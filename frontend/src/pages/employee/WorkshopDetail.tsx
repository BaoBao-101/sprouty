/**
 * One of my sessions: what it is, and the door.
 *
 * The top is what an employee wants before the day — when, where, for which
 * ages, at what price, who else is on it, and what the children will do. The
 * register below is what they want on it: who is still to come, one tap to
 * tick them in, and cash taken at the desk on the session's own day.
 *
 * Only sessions an admin put this employee on open here; the server says so
 * for any other, and the page passes that on rather than showing a blank.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { API } from '@/services/api';
import { AdminIcon } from '@/components/icons/AdminIcon';
import { BlockStates, Panel, Pill, type LoadState } from '@/components/admin/ui';
import {
  dayHeading,
  hhmm,
  phase,
  PayFlag,
  todayKey,
  useDoorActions,
  type Attendee,
  type SessionDetail,
} from './workshop-shared';
import './Workshops.css';

type View = 'waiting' | 'arrived' | 'all';

export default function EmployeeWorkshopDetail() {
  const { id = '' } = useParams();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState('');
  const [view, setView] = useState<View>('waiting');
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    setState('loading');
    API.attendance
      .session(id)
      .then((data: any) => {
        setSession(data.workshop);
        setAttendees(data.attendees || []);
        setState('ready');
      })
      .catch((err: any) => {
        setError(err?.message || 'Không tải được buổi workshop.');
        setState('error');
      });
  }, [id]);

  useEffect(load, [load]);

  const door = useDoorActions((next) => {
    setAttendees((list) => list.map((a) => (a.id === next.id ? next : a)));
  });

  const arrived = attendees.filter((a) => a.checkedInAt);
  const waiting = attendees.filter((a) => !a.checkedInAt);
  const seatsIn = arrived.reduce((n, a) => n + (a.attendedCount ?? a.childCount), 0);
  const seatsBooked = attendees.reduce((n, a) => n + a.childCount, 0);
  const unpaid = attendees.filter((a) => !a.paidAt && a.amount > 0);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    // A search looks through everyone: the parent at the desk may already
    // have been ticked off by a colleague.
    const pool = term ? attendees : attendees.filter((a) => (view === 'all' ? true : view === 'arrived' ? a.checkedInAt : !a.checkedInAt));
    const hits = term
      ? pool.filter((a) => a.name.toLowerCase().includes(term) || a.ticket.toLowerCase().includes(term) || (a.phone || '').includes(term))
      : pool;
    return [...hits].sort((a, b) => Number(Boolean(a.checkedInAt)) - Number(Boolean(b.checkedInAt)));
  }, [attendees, search, view]);

  if (state !== 'ready' || !session) {
    return (
      <>
        <Link to="/employee/workshops" className="ew-back"><AdminIcon name="chevron-left" size={16} /> Buổi của tôi</Link>
        <Panel>
          <BlockStates state={state} error={error} isEmpty={false} onRetry={load} />
        </Panel>
      </>
    );
  }

  const cancelled = session.status === 'cancelled';
  // Cash changes hands on the session's own day only (the server agrees).
  const cashDay = session.day === todayKey();
  const state_ = phase(session);
  const head = dayHeading(session.day);
  const facts: Array<{ icon: 'calendar' | 'clock' | 'pin' | 'users' | 'sales' | 'seat'; label: string; value: string }> = [
    { icon: 'calendar', label: 'Ngày', value: head.isToday ? `Hôm nay · ${head.full}` : head.full },
    { icon: 'clock', label: 'Giờ', value: `${hhmm(session.dateTime)}${session.endTime ? ` – ${hhmm(session.endTime)}` : ''}` },
    { icon: 'pin', label: 'Địa điểm', value: session.location },
    { icon: 'users', label: 'Độ tuổi', value: session.ageRange || 'Mọi lứa tuổi' },
    { icon: 'sales', label: 'Học phí', value: session.price ? `${session.price.toLocaleString('vi-VN')}đ / bé` : 'Miễn phí' },
    { icon: 'seat', label: 'Chỗ', value: `${session.bookedSeats}/${session.capacity} bé đã đăng ký` },
  ];

  return (
    <>
      <Link to="/employee/workshops" className="ew-back"><AdminIcon name="chevron-left" size={16} /> Buổi của tôi</Link>

      <section className={`ew-hero${session.imageUrl ? '' : ' no-photo'}`}>
        {/* No cover, no box: an empty grey frame took half a phone screen. */}
        {session.imageUrl && (
          <div className="ew-hero-photo">
            <img src={session.imageUrl} alt="" />
          </div>
        )}
        <div className="ew-hero-main">
          <div className="ew-hero-tags">
            {state_ && <Pill tone={state_.tone}>{state_.label}</Pill>}
            <Pill tone="green">Bạn phụ trách</Pill>
          </div>
          <h1>{session.title}</h1>
          <dl className="ew-facts">
            {facts.map((f) => (
              <div key={f.label}>
                <dt><AdminIcon name={f.icon} size={15} /> {f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
          <p className="ew-crew">
            <AdminIcon name="users" size={15} />
            {session.coworkers.length
              ? <>Trực cùng bạn: <b>{session.coworkers.map((c) => c.name).join(', ')}</b></>
              : 'Bạn trực một mình buổi này'}
          </p>
        </div>
      </section>

      {cancelled && (
        <div className="ew-banner is-cancelled">
          <AdminIcon name="alert" size={17} />
          <span>Buổi này đã bị huỷ. Không cần điểm danh; phụ huynh đã thanh toán sẽ được quản trị viên liên hệ hoàn tiền.</span>
        </div>
      )}

      {session.description && (
        <Panel title="Buổi học có gì">
          <p className="ew-desc">{session.description}</p>
        </Panel>
      )}

      <Panel
        title={`Điểm danh · ${seatsIn}/${seatsBooked} bé đã tới`}
        action={
          <div className="att-register-tools">
            <div className="att-views" role="tablist" aria-label="Lọc danh sách">
              {([
                ['waiting', 'Chưa tới', waiting.length],
                ['arrived', 'Đã tới', arrived.length],
                ['all', 'Tất cả', attendees.length],
              ] as Array<[View, string, number]>).map(([value, label, count]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={view === value}
                  className={`att-view${view === value ? ' is-on' : ''}`}
                  onClick={() => setView(value)}
                >
                  {label}
                  <em>{count}</em>
                </button>
              ))}
            </div>
            <div className="att-search">
              <AdminIcon name="search" size={16} />
              <input
                className="form-input"
                placeholder="Tên, mã vé hoặc số điện thoại…"
                value={search}
                aria-label="Tìm trong danh sách"
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        }
      >
        <BlockStates
          state="ready"
          isEmpty={visible.length === 0}
          emptyIcon={<AdminIcon name="users" size={24} />}
          emptyTitle={
            search ? 'Không tìm thấy ai'
              : !attendees.length ? 'Chưa có ai đăng ký buổi này'
                : view === 'waiting' ? 'Mọi người đã tới đủ' : 'Chưa có ai được điểm danh'
          }
          emptyHint={search ? 'Thử tên khác hoặc xoá từ khoá.' : undefined}
        />

        {visible.length > 0 && (
          <ul className="att-list">
            {visible.map((a) => (
              <li key={a.id} className={`att-row${a.checkedInAt ? ' done' : ''}`}>
                <span className="att-ticket">{a.ticket}</span>
                <div className="att-who">
                  <strong>{a.name}</strong>
                  <span>
                    {a.childCount} bé
                    {a.childAge ? ` · ${a.childAge}` : ''}
                    {a.phone && <> · <a href={`tel:${a.phone}`}>{a.phone}</a></>}
                  </span>
                  {a.note && <em className="att-note">“{a.note}”</em>}
                </div>
                <div className="att-flags">
                  <PayFlag
                    attendee={a}
                    canCollect={cashDay && !cancelled}
                    busy={door.busy === a.id}
                    onCollect={() => door.collect(a, session.id)}
                  />
                  {a.checkedInAt && (
                    <span className="att-when">
                      <AdminIcon name="clock" size={13} /> {hhmm(a.checkedInAt)}
                      {a.checkedInBy ? ` · ${a.checkedInBy}` : ''}
                    </span>
                  )}
                </div>
                {!cancelled && (
                  <button
                    className={`att-btn${a.checkedInAt ? ' undo' : ''}`}
                    disabled={door.busy === a.id}
                    onClick={() => door.toggle(a, session.id)}
                  >
                    <AdminIcon name={a.checkedInAt ? 'refresh' : 'check'} size={17} />
                    {door.busy === a.id ? 'Đang lưu…' : a.checkedInAt ? 'Bỏ điểm danh' : 'Đã tới'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {unpaid.length > 0 && !cancelled && (
          <p className="att-cash-note">
            <AdminIcon name="info" size={15} />
            <span>{cashDay
              ? 'Vé chưa thanh toán: thu đúng số tiền ghi trên vé rồi bấm “Thu …đ” để ghi nhận. Sửa hay hoàn tiền nhờ quản trị viên.'
              : 'Vé chưa thanh toán được thu tiền và ghi nhận ngay trong ngày diễn ra buổi học.'}</span>
          </p>
        )}
      </Panel>
    </>
  );
}
