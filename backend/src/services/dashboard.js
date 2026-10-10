const DAY = 86400000;
const VIETNAM_OFFSET = 7 * 3600000;
export function dashboardPeriod(days, now = new Date()) {
  const today = Math.floor((now.getTime() + VIETNAM_OFFSET) / DAY) * DAY - VIETNAM_OFFSET;
  const start = new Date(today - (days - 1) * DAY);
  const previousStart = new Date(start.getTime() - days * DAY);
  const previousEnd = new Date(now.getTime() - days * DAY);
  return { days, start, end: now, previousStart, previousEnd };
}
export function vietnamDate(value) {
  return new Date(new Date(value).getTime() + VIETNAM_OFFSET).toISOString().slice(0, 10);
}
export function fillRevenueDays(period, rows) {
  const byDate = new Map(rows.map(row => [row.date, row]));
  return Array.from({ length: period.days }, (_, i) => {
    const date = vietnamDate(new Date(period.start.getTime() + i * DAY));
    const row = byDate.get(date);
    return { date, revenue: Number(row?.revenue || 0), orders: Number(row?.orders || 0) };
  });
}
export function percentageChange(current, previous) {
  if (!previous) return current ? null : 0;
  return Math.round((current - previous) / previous * 1000) / 10;
}
