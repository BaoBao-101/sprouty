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

/**
 * What a plan costs a month, the comparison a parent actually makes. None for
 * a plan of a month or two, where it would only repeat the price.
 */
export function planPerMonth(price: number, days: number) {
  if (days < 60 || !price) return null;
  const monthly = price / (days / 30);
  return monthly >= 10_000 ? Math.round(monthly / 1000) * 1000 : Math.max(100, Math.round(monthly / 100) * 100);
}

/**
 * The plan that costs least a day, if one clearly does; that one plan is
 * marked "Tiết kiệm nhất". (Every plan of a year or more used to be marked,
 * so two cards could both claim it.)
 */
export function bestValuePlanId(plans: Array<{ id: number; price: number; days: number }>) {
  const priced = plans.filter((p) => p.days > 0 && p.price > 0);
  if (priced.length < 2) return null;
  const daily = (p: { price: number; days: number }) => p.price / p.days;
  const sorted = [...priced].sort((a, b) => daily(a) - daily(b));
  return daily(sorted[0]) < daily(sorted[sorted.length - 1]) * 0.95 ? sorted[0].id : null;
}
