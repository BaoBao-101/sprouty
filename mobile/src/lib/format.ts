/*
 * How things are said. The same wording as the website
 * (frontend/src/types/order.ts, workshop.ts, services/membership.ts), so a
 * parent reads the same status in both places.
 */
import type { Order, OrderStatus, PublicWorkshop } from './types';

export function formatPrice(value: number) {
  return Math.round(value).toLocaleString('vi-VN') + 'đ';
}

export const ORDER_STATUS_VN: Record<OrderStatus, string> = {
  pending: 'Chờ thanh toán',
  processing: 'Đang chuẩn bị',
  shipped: 'Đang giao',
  delivered: 'Hoàn tất',
  cancelled: 'Đã hủy',
};

export const DELIVERED_BY_VN: Record<string, string> = {
  customer: 'Bạn xác nhận đã nhận',
  staff: 'Nhân viên xác nhận đã giao',
  auto: 'Tự hoàn tất sau 7 ngày',
};

/** Last 8 characters, as shown to customers and staff. */
export const shortOrderId = (id: string) => id.slice(-8).toUpperCase();

/** A VIP Garden purchase: nothing to activate, nothing to deliver. */
export function isVipOrder(order: Pick<Order, 'items'>) {
  return order.items.length > 0 && order.items.every((i) => i.product?.category === 'membership');
}

const pad = (n: number) => String(n).padStart(2, '0');

export function formatDate(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function formatDateTime(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${formatDate(iso)}`;
}

const WEEKDAY = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

/** "Thứ Bảy, 22/03/2026 · 9:00 – 11:30". */
export function formatWorkshopWhen(w: Pick<PublicWorkshop, 'dateTime' | 'endTime'>) {
  const start = new Date(w.dateTime);
  if (isNaN(start.getTime())) return '';
  const day = `${WEEKDAY[start.getDay()]}, ${formatDate(w.dateTime)}`;
  const from = `${start.getHours()}:${pad(start.getMinutes())}`;
  if (!w.endTime) return `${day} · ${from}`;
  const end = new Date(w.endTime);
  return `${day} · ${from} – ${end.getHours()}:${pad(end.getMinutes())}`;
}

/** Whole days left, rounded up. */
export function daysLeft(iso?: string | null) {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

/** "1 tháng", "1 năm", else "45 ngày". */
export function planLength(days: number) {
  if (days === 365 || days === 366) return '1 năm';
  if (days % 365 === 0) return `${days / 365} năm`;
  if (days % 30 === 0) return `${days / 30} tháng`;
  return `${days} ngày`;
}

/** "còn 2 giờ 15 phút", for care cooldowns. */
export function formatCountdown(seconds: number) {
  if (seconds <= 0) return 'sẵn sàng';
  const total = Math.ceil(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours} giờ ${minutes} phút`;
  if (minutes > 0) return `${minutes} phút`;
  return `${total} giây`;
}

/**
 * What to call a parent: the given name as Vietnamese says it — two words when
 * the full name has three or more ("Nguyễn Mai Anh" → "Mai Anh"), since "Anh"
 * alone reads as "brother".
 */
export function callName(full?: string | null) {
  const parts = (full || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  return parts.length >= 3 ? parts.slice(-2).join(' ') : parts[parts.length - 1];
}

/** "Chào buổi sáng" … by the hour. */
export function greeting() {
  const hour = new Date().getHours();
  if (hour < 11) return 'Chào buổi sáng';
  if (hour < 14) return 'Chào buổi trưa';
  if (hour < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

/** Placeholder addresses stored where an order has nothing to deliver. */
export function realAddress(order: Pick<Order, 'shippingAddress'>) {
  const value = (order.shippingAddress || '').trim();
  return value && !/^(Không áp dụng|Cấp bởi admin)/.test(value) ? value : '';
}

/** The AI's light markup (**bold**, [links]) as plain text for a chat bubble. */
export function plainAiText(text: string) {
  return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/^#+\s*/gm, '');
}
