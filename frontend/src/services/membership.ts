/**
 * Reading an account's VIP Garden status. The server decides it (vipUntil on
 * the user, see backend/src/services/membership.js); these only word it.
 */

export interface Tier {
  tier?: 'regular' | 'vip';
  isVip?: boolean;
  vipUntil?: string | null;
  vipExpired?: boolean;
}

/** 08/11/2026 — the date a parent would write down. */
export function formatVipDate(iso?: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Whole days left, rounded up: the last afternoon still counts as a day. */
export function vipDaysLeft(iso?: string | null) {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

/** A length in days, as a plan is sold: "1 tháng", "1 năm", else "45 ngày". */
export function planLength(days: number) {
  if (days === 365 || days === 366) return '1 năm';
  if (days % 365 === 0) return `${days / 365} năm`;
  if (days % 30 === 0) return `${days / 30} tháng`;
  return `${days} ngày`;
}

/** The one-line label for a tier chip. */
export function tierLabel(t: Tier | null | undefined) {
  if (t?.isVip) return `VIP Garden · đến ${formatVipDate(t.vipUntil)}`;
  if (t?.vipExpired) return `Thường · VIP hết hạn ${formatVipDate(t.vipUntil)}`;
  return 'Tài khoản Thường';
}
