/**
 * Choosing who runs a workshop session.
 *
 * Built for a team of twenty as much as for two. A grid of cards worked for
 * two people and turned into a wall at ten, with the ones already ticked
 * scattered through it. Here the people chosen sit as chips on top, the rest
 * is a compact list in its own scroll box, and once the list is longer than a
 * glance there is a search that ignores tone marks ("tran" finds "Trần").
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminIcon } from '@/components/icons/AdminIcon';

/** Someone put on a session. `active` is false once they cannot run it. */
export interface StaffRef {
  id: string;
  name: string;
  email: string;
  active: boolean;
}

/** An employee who can be put on a session, with what they already run. */
export interface StaffOption {
  id: string;
  name: string;
  email: string;
  shifts: Array<{ id: string; title: string; dateTime: string; endTime?: string | null }>;
}

/** At most this many on one session; the server refuses more. */
export const MAX_STAFF = 10;

/** A search box earns its place once the list is longer than a glance. */
const SEARCH_FROM = 7;

/** Two hours, for a session saved without an end time. */
const ASSUMED_LENGTH_MS = 2 * 3_600_000;

const span = (start: string, end?: string | null) => {
  const from = new Date(start).getTime();
  return [from, end ? new Date(end).getTime() : from + ASSUMED_LENGTH_MS] as const;
};

/** '09:00 · 18/10' — built by hand: vi-VN without a year writes '18-10'. */
const shortWhen = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())} · ${p(d.getDate())}/${p(d.getMonth() + 1)}`;
};

/** "ML" for "Mai Lan". */
const initials = (name: string) =>
  name.trim().split(/\s+/).slice(-2).map((p) => p[0]?.toUpperCase() || '').join('') || '?';

/** Lowercase, without Vietnamese tone marks, so "tran" finds "Trần". */
const fold = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

export function WorkshopStaffPicker({
  options,
  error,
  onRetry,
  value,
  onChange,
  editingId,
  start,
  end,
}: {
  /** null while loading. */
  options: StaffOption[] | null;
  error: string;
  onRetry: () => void;
  value: string[];
  onChange: (ids: string[]) => void;
  /** The session being edited, so its own slot is not counted as a clash. */
  editingId: string | null;
  /** ISO times of the session, when chosen. */
  start: string | null;
  end: string | null;
}) {
  const [query, setQuery] = useState('');

  // Each person with what else they run, and the session that overlaps this
  // one if there is one. Free at that time first, then whoever has least on —
  // which spreads the work — then by name. Never by "ticked": a row that jumps
  // when it is clicked is gone from under the finger.
  const people = useMemo(() => {
    if (!options) return [];
    const slot = start ? span(start, end) : null;
    return options
      .map((option) => {
        const shifts = option.shifts.filter((s) => s.id !== editingId);
        const clash = slot
          ? shifts.find((s) => {
              const [a, b] = span(s.dateTime, s.endTime);
              return a < slot[1] && slot[0] < b;
            }) || null
          : null;
        return { ...option, load: shifts.length, clash };
      })
      .sort(
        (x, y) =>
          Number(Boolean(x.clash)) - Number(Boolean(y.clash)) ||
          x.load - y.load ||
          x.name.localeCompare(y.name, 'vi'),
      );
  }, [options, editingId, start, end]);

  if (options === null) return <div className="wsp-note">Đang tải danh sách nhân viên…</div>;
  if (error) {
    return (
      <div className="wsp-note is-warn">
        {error}{' '}
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>Thử lại</button>
      </div>
    );
  }
  if (!options.length) {
    return (
      <div className="wsp-note">
        Chưa có tài khoản nhân viên nào đang hoạt động. <Link to="/admin/users">Tạo ở mục Người dùng</Link>
      </div>
    );
  }

  const term = fold(query.trim());
  const shown = term ? people.filter((p) => fold(`${p.name} ${p.email}`).includes(term)) : people;
  const chosen = value.map((id) => people.find((p) => p.id === id)).filter((p): p is (typeof people)[number] => Boolean(p));
  const full = value.length >= MAX_STAFF;
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div className="wsp">
      <div className="wsp-chosen" aria-live="polite">
        {chosen.length ? (
          chosen.map((p) => (
            <span key={p.id} className={`wsp-chip${p.clash ? ' is-clash' : ''}`}>
              <span className="wsp-avatar is-sm" aria-hidden="true">{initials(p.name)}</span>
              <span className="wsp-chip-name">{p.name}</span>
              <button type="button" onClick={() => toggle(p.id)} aria-label={`Bỏ ${p.name} khỏi buổi`}>
                <AdminIcon name="close" size={12} />
              </button>
            </span>
          ))
        ) : (
          <span className="wsp-none">Chưa chọn ai</span>
        )}
        <span className="wsp-count">
          {value.length}/{options.length} đã chọn
        </span>
      </div>

      <div className="wsp-box">
        {people.length >= SEARCH_FROM && (
          <label className="wsp-search">
            <AdminIcon name="search" size={15} />
            <input
              type="search"
              placeholder="Tìm theo tên hoặc email…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Tìm nhân viên"
            />
          </label>
        )}
        <ul className="wsp-list">
          {shown.map((p) => {
            const on = value.includes(p.id);
            const blocked = !on && full;
            return (
              <li key={p.id}>
                <label
                  className={`wsp-row${on ? ' is-on' : ''}${blocked ? ' is-blocked' : ''}`}
                  title={blocked ? `Tối đa ${MAX_STAFF} người một buổi` : undefined}
                >
                  <input type="checkbox" checked={on} disabled={blocked} onChange={() => toggle(p.id)} />
                  <span className="wsp-avatar" aria-hidden="true">{initials(p.name)}</span>
                  <span className="wsp-who">
                    <strong>{p.name}</strong>
                    <em>{p.email}</em>
                    {p.clash && (
                      <span className="wsp-clash">
                        Trùng “{p.clash.title}” · {shortWhen(p.clash.dateTime)}
                      </span>
                    )}
                  </span>
                  {p.clash ? (
                    <span className="wsp-tag is-clash">
                      <AdminIcon name="alert" size={12} /> Trùng giờ
                    </span>
                  ) : (
                    <span className={`wsp-tag${p.load ? '' : ' is-zero'}`} title={`Đang có ${p.load} buổi sắp tới`}>
                      {p.load ? `${p.load} buổi tới` : 'Chưa có buổi'}
                    </span>
                  )}
                </label>
              </li>
            );
          })}
          {!shown.length && <li className="wsp-empty">Không có ai khớp “{query.trim()}”.</li>}
        </ul>
      </div>

      {full && (
        <span className="field-hint">Đã đủ {MAX_STAFF} người — bỏ bớt một người để chọn người khác.</span>
      )}
    </div>
  );
}
