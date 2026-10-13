/**
 * Workshop — the sessions an admin put me on.
 *
 * Nothing else: an employee sees a session once they have been given it, not
 * the shop's whole schedule. The list is grouped by day, so a Saturday with
 * five sessions reads as one heading and five cards rather than five rows to
 * step through one date at a time; each card opens the session's own page,
 * with what it is and the register.
 *
 * The ticket desk stays on top. It is the first thing that happens when a
 * parent walks in, and it finds the ticket across all of my sessions.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { API } from '@/services/api';
import { AdminIcon } from '@/components/icons/AdminIcon';
import { BlockStates, PageHeader, Panel, Pill, type LoadState } from '@/components/admin/ui';
import {
  dayHeading,
  dayKey,
  hhmm,
  phase,
  PayFlag,
  todayKey,
  useDoorActions,
  type Attendee,
  type MySession,
} from './workshop-shared';
import './Workshops.css';

type Tab = 'upcoming' | 'past';

interface LookupHit {
  attendee: Attendee;
  workshop: { id: string; title: string; dateTime: string; endTime: string | null; location: string; status: string };
}

/** One session, as a card: when, what, where, who with, and the numbers. */
function SessionCard({ s }: { s: MySession }) {
  const state = phase(s);
  const pct = s.capacity ? Math.min(100, Math.round((s.bookedSeats / s.capacity) * 100)) : 0;
  const begun = Date.now() >= new Date(s.dateTime).getTime();
  return (
    <li>
      <Link to={`/employee/workshops/${s.id}`} className={`ew-card${s.status === 'cancelled' ? ' is-cancelled' : ''}`}>
        <span className="ew-card-top">
          <span className="ew-card-time">
            {hhmm(s.dateTime)}
            {s.endTime && <em>–{hhmm(s.endTime)}</em>}
          </span>
          {state && <Pill tone={state.tone}>{state.label}</Pill>}
        </span>
        <strong className="ew-card-title">{s.title}</strong>
        <span className="ew-card-meta">
          <span><AdminIcon name="pin" size={13} /> {s.location}</span>
          {s.coworkers.length > 0 && (
            <span><AdminIcon name="users" size={13} /> Cùng trực: {s.coworkers.map((c) => c.name).join(', ')}</span>
          )}
        </span>
        <span className="ew-card-foot">
          <span className="ew-card-seats">
            <b>{s.bookedSeats}/{s.capacity}</b> bé đăng ký
            <span className="att-bar"><span style={{ width: `${pct}%` }} /></span>
          </span>
          {begun && s.status !== 'cancelled' && (
            <span className="ew-card-stat"><b>{s.arrivedSeats}</b> đã tới</span>
          )}
          {s.unpaid > 0 && <Pill tone="amber">{s.unpaid} chưa trả</Pill>}
          <AdminIcon name="chevron-right" size={18} />
        </span>
      </Link>
    </li>
  );
}

export default function EmployeeWorkshops() {
  const [tab, setTab] = useState<Tab>('upcoming');
  const [lists, setLists] = useState<Record<Tab, MySession[] | null>>({ upcoming: null, past: null });
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState('');

  const load = useCallback((which: Tab) => {
    setState('loading');
    API.attendance
      .mine(which)
      .then((data: any) => {
        setLists((all) => ({ ...all, [which]: data.sessions || [] }));
        setState('ready');
      })
      .catch((err: any) => {
        setError(err?.message || 'Không tải được danh sách buổi.');
        setState('error');
      });
  }, []);

  useEffect(() => {
    if (lists[tab] === null) load(tab);
    else setState('ready');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const sessions = lists[tab] || [];
  const upcoming = lists.upcoming || [];
  const today = todayKey();
  const todays = upcoming.filter((s) => s.day === today && s.status !== 'cancelled');
  const later = upcoming.filter((s) => s.day > today && s.status !== 'cancelled');

  // By day, in the order the server sent: soonest first, or latest first for
  // the past.
  const days = useMemo(() => {
    const groups: Array<{ day: string; sessions: MySession[] }> = [];
    for (const s of sessions) {
      const last = groups[groups.length - 1];
      if (last?.day === s.day) last.sessions.push(s);
      else groups.push({ day: s.day, sessions: [s] });
    }
    return groups;
  }, [sessions]);

  // ── The ticket desk ──
  const [code, setCode] = useState('');
  const [found, setFound] = useState<LookupHit | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [looking, setLooking] = useState(false);
  const door = useDoorActions((next) => {
    setFound((hit) => (hit ? { ...hit, attendee: next } : hit));
    load('upcoming');
  });

  const foundDay = found ? dayHeading(dayKey(new Date(found.workshop.dateTime))) : null;

  async function lookup() {
    const wanted = code.trim().toUpperCase();
    if (!wanted) return;
    setLooking(true);
    setLookupError('');
    try {
      setFound(await API.attendance.lookup(wanted));
    } catch (err: any) {
      setFound(null);
      setLookupError(err?.message || 'Không tra được mã vé.');
    } finally {
      setLooking(false);
    }
  }

  const tiles = [
    { icon: 'workshop' as const, tone: 'blue', value: String(todays.length), label: 'Buổi hôm nay', hint: dayHeading(today).full },
    {
      icon: 'check' as const, tone: 'green',
      value: `${todays.reduce((n, s) => n + s.arrivedSeats, 0)}/${todays.reduce((n, s) => n + s.bookedSeats, 0)}`,
      label: 'Bé đã tới hôm nay', hint: todays.length ? 'Trong các buổi của bạn' : 'Hôm nay bạn không có buổi',
    },
    {
      icon: 'sales' as const, tone: todays.some((s) => s.unpaid) ? 'amber' : 'green',
      value: String(todays.reduce((n, s) => n + s.unpaid, 0)), label: 'Chưa thu hôm nay', hint: 'Thu tại chỗ khi phụ huynh tới',
    },
    { icon: 'calendar' as const, tone: 'green', value: String(later.length), label: 'Buổi sắp tới', hint: 'Sau hôm nay' },
  ];

  return (
    <>
      <PageHeader title="Workshop" subtitle="Các buổi bạn được giao — xem chi tiết, tra vé và điểm danh" />

      <div className="att-desk">
        <div className="att-desk-head">
          <AdminIcon name="ticket" size={20} />
          <div>
            <strong>Tra mã vé</strong>
            <span>Quét QR trên điện thoại phụ huynh, hoặc nhập 6 ký tự trên vé</span>
          </div>
        </div>
        <form className="att-desk-form" onSubmit={(e) => { e.preventDefault(); void lookup(); }}>
          <input
            className="form-input att-code"
            placeholder="VD: 9A3NA3"
            value={code}
            maxLength={24}
            autoComplete="off"
            spellCheck={false}
            aria-label="Mã vé"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <button className="btn btn-primary" disabled={looking || !code.trim()}>
            <AdminIcon name="search" size={17} />
            {looking ? 'Đang tra…' : 'Tra vé'}
          </button>
          {(found || lookupError) && (
            <button type="button" className="btn btn-ghost" onClick={() => { setCode(''); setFound(null); setLookupError(''); }}>
              Xoá
            </button>
          )}
        </form>
        {lookupError && (
          <div className="att-desk-miss"><AdminIcon name="alert" size={16} /> {lookupError}</div>
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
                <Link className="att-desk-hit-ws" to={`/employee/workshops/${found.workshop.id}`}>
                  <AdminIcon name="workshop" size={13} /> {found.workshop.title} · {hhmm(found.workshop.dateTime)}{' '}
                  {foundDay?.isToday ? 'hôm nay' : foundDay?.full}
                  <AdminIcon name="chevron-right" size={13} />
                </Link>
                {found.attendee.note && <em className="att-note">“{found.attendee.note}”</em>}
              </div>
            </div>
            <div className="att-desk-hit-side">
              <PayFlag
                attendee={found.attendee}
                canCollect={new Date(found.workshop.dateTime).toDateString() === new Date().toDateString() && found.workshop.status !== 'cancelled'}
                busy={door.busy === found.attendee.id}
                onCollect={() => door.collect(found.attendee, found.workshop.id)}
              />
              {found.attendee.checkedInAt && (
                <span className="att-when"><AdminIcon name="check" size={13} /> Đã tới lúc {hhmm(found.attendee.checkedInAt)}</span>
              )}
              {found.workshop.status === 'cancelled' ? (
                <Pill tone="rose">Buổi đã huỷ</Pill>
              ) : (
                <button
                  className={`att-btn${found.attendee.checkedInAt ? ' undo' : ''}`}
                  disabled={door.busy === found.attendee.id}
                  onClick={() => door.toggle(found.attendee, found.workshop.id)}
                >
                  <AdminIcon name={found.attendee.checkedInAt ? 'refresh' : 'check'} size={17} />
                  {door.busy === found.attendee.id ? 'Đang lưu…' : found.attendee.checkedInAt ? 'Bỏ điểm danh' : 'Xác nhận đã tới'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="ax-kpis ew-kpis">
        {tiles.map((k) => (
          <div key={k.label} className={`ax-kpi tone-${k.tone} is-static`}>
            <span className="ax-kpi-icon"><AdminIcon name={k.icon} size={18} /></span>
            <span className="ax-kpi-body">
              {lists.upcoming === null ? <span className="ad-skel w-60" /> : <b>{k.value}</b>}
              <strong>{k.label}</strong>
              <em>{k.hint}</em>
            </span>
          </div>
        ))}
      </div>

      <Panel
        title="Buổi của tôi"
        action={
          <div className="att-views" role="tablist" aria-label="Lọc buổi">
            {([['upcoming', 'Sắp tới'], ['past', 'Đã qua']] as Array<[Tab, string]>).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                className={`att-view${tab === value ? ' is-on' : ''}`}
                onClick={() => setTab(value)}
              >
                {label}
                {lists[value] && <em>{lists[value]!.length}</em>}
              </button>
            ))}
          </div>
        }
      >
        <BlockStates
          state={state}
          error={error}
          isEmpty={sessions.length === 0}
          emptyIcon={<AdminIcon name="calendar" size={24} />}
          emptyTitle={tab === 'upcoming' ? 'Bạn chưa được giao buổi workshop nào' : 'Chưa có buổi nào trong 90 ngày qua'}
          emptyHint={tab === 'upcoming' ? 'Khi quản trị viên giao buổi cho bạn, buổi đó sẽ hiện ở đây.' : undefined}
          onRetry={() => load(tab)}
        />
        {state === 'ready' && days.map(({ day, sessions: list }) => {
          const head = dayHeading(day);
          return (
            <section key={day} className={`ew-day${day === today ? ' is-today' : ''}`}>
              <header className="ew-day-head">
                <strong>{head.name}</strong>
                <span>{head.detail}</span>
                <em>
                  {list.length} buổi · {list.reduce((n, s) => n + s.bookedSeats, 0)} bé
                </em>
              </header>
              <ul className="ew-cards">
                {list.map((s) => <SessionCard key={s.id} s={s} />)}
              </ul>
            </section>
          );
        })}
      </Panel>
    </>
  );
}
