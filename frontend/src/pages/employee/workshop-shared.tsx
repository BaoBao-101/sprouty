/**
 * What the employee's workshop list and a session's own page share: the
 * shapes the API returns, the date wording, and the two things done at the
 * door — ticking a child in and taking cash.
 */

import { useState } from 'react';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import { confirmAction } from '@/services/dialog';
import { AdminIcon } from '@/components/icons/AdminIcon';
import { Pill } from '@/components/admin/ui';

/** One of my sessions, as the list shows it. */
export interface MySession {
  id: string;
  title: string;
  /** YYYY-MM-DD in Vietnam. */
  day: string;
  dateTime: string;
  endTime: string | null;
  location: string;
  capacity: number;
  status: string;
  bookings: number;
  checkedIn: number;
  bookedSeats: number;
  arrivedSeats: number;
  unpaid: number;
  /** The others an admin put on it. */
  coworkers: Array<{ id: string; name: string }>;
}

/** The same, with what the session page adds. */
export interface SessionDetail extends MySession {
  description?: string | null;
  imageUrl?: string | null;
  ageRange?: string | null;
  price: number;
}

export interface Attendee {
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

const pad = (n: number) => String(n).padStart(2, '0');

/** "09:00". */
export const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** YYYY-MM-DD of a local date. */
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const todayKey = () => dayKey(new Date());

const WEEKDAY = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

/**
 * How a day is named: "Hôm nay", "Ngày mai", "Hôm qua", or its weekday, with
 * the date beside it — "Thứ Bảy, 28/11" when the name is relative, just
 * "28/11" when the name already says the weekday.
 */
export function dayHeading(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const diff = Math.round((date.getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000);
  const weekday = WEEKDAY[date.getDay()];
  const short = `${pad(d)}/${pad(m)}${y !== new Date().getFullYear() ? `/${y}` : ''}`;
  const relative = diff === 0 ? 'Hôm nay' : diff === 1 ? 'Ngày mai' : diff === -1 ? 'Hôm qua' : '';
  return {
    name: relative || weekday,
    detail: relative ? `${weekday}, ${short}` : short,
    full: `${weekday}, ${short}`,
    isToday: diff === 0,
  };
}

/** Where the session stands, when that is worth a pill. Plain "coming" is not. */
export function phase(s: Pick<MySession, 'status' | 'dateTime' | 'endTime'>): { label: string; tone: string } | null {
  if (s.status === 'cancelled') return { label: 'Đã huỷ', tone: 'rose' };
  if (s.status === 'draft') return { label: 'Chưa mở đăng ký', tone: 'amber' };
  const now = Date.now();
  const start = new Date(s.dateTime).getTime();
  const end = s.endTime ? new Date(s.endTime).getTime() : start + 2 * 3_600_000;
  if (now >= end) return { label: 'Đã kết thúc', tone: 'grey' };
  if (now >= start) return { label: 'Đang diễn ra', tone: 'blue' };
  return null;
}

/** The ticket's money line: nothing to collect on a free one. */
export function PayFlag({ attendee, canCollect, busy, onCollect }: {
  attendee: Attendee;
  canCollect: boolean;
  busy: boolean;
  onCollect: () => void;
}) {
  // A free seat is stored as paid the moment it is booked; say what it is.
  if (!attendee.amount) return <Pill tone="grey">Miễn phí</Pill>;
  if (attendee.paidAt) return <Pill tone="green">Đã thanh toán</Pill>;
  if (canCollect) {
    return (
      <button type="button" className="att-cash" disabled={busy} onClick={onCollect}>
        <AdminIcon name="sales" size={15} />
        Thu {attendee.amount.toLocaleString('vi-VN')}đ
      </button>
    );
  }
  return <Pill tone="amber">Thu tại chỗ · {attendee.amount.toLocaleString('vi-VN')}đ</Pill>;
}

/**
 * Ticking a child in (or out again) and taking cash, with the confirmation
 * and the toast. `onUpdate` gets the attendee as the server now has it.
 */
export function useDoorActions(onUpdate: (next: Attendee) => void) {
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(attendee: Attendee, workshopId: string) {
    if (busy) return;
    setBusy(attendee.id);
    try {
      const { attendee: next } = attendee.checkedInAt
        ? await API.attendance.undo(workshopId, attendee.id)
        : await API.attendance.checkIn(workshopId, attendee.id);
      onUpdate(next);
      showToast(next.checkedInAt ? `Đã điểm danh ${next.name}` : `Đã bỏ điểm danh ${next.name}`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Không cập nhật được điểm danh.', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function collect(attendee: Attendee, workshopId: string) {
    if (busy) return;
    const amount = attendee.amount.toLocaleString('vi-VN');
    if (!await confirmAction(
      `Đã thu ${amount}đ tiền mặt của ${attendee.name} (vé ${attendee.ticket})?

Chỉ bấm khi đã cầm tiền. Muốn sửa hay hoàn tiền phải nhờ quản trị viên.`,
      { title: 'Ghi nhận thu tiền mặt', confirmLabel: `Đã thu ${amount}đ`, danger: false },
    )) return;
    setBusy(attendee.id);
    try {
      const { attendee: next } = await API.attendance.cash(workshopId, attendee.id);
      onUpdate(next);
      showToast(`Đã ghi nhận thu ${amount}đ`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Không ghi nhận được.', 'error');
    } finally {
      setBusy(null);
    }
  }

  return { busy, toggle, collect };
}
