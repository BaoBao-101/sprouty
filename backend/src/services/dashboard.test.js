import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardPeriod, fillRevenueDays, percentageChange, vietnamDate } from './dashboard.js';

test('period follows Vietnam midnight rather than host timezone', () => {
  const now = new Date('2026-10-09T18:30:00Z');
  const period = dashboardPeriod(7, now);
  assert.equal(period.start.toISOString(), '2026-10-03T17:00:00.000Z');
  assert.equal(vietnamDate(period.start), '2026-10-04');
  assert.equal(vietnamDate(now), '2026-10-10');
  assert.equal(period.end - period.start, period.previousEnd - period.previousStart);
  assert.ok(period.previousEnd < period.start);
});
test('daily revenue fills gaps including the first and current day', () => {
  const period = dashboardPeriod(7, new Date('2026-10-10T03:00:00Z'));
  const days = fillRevenueDays(period, [{ date: '2026-10-06', revenue: 150000, orders: 2 }]);
  assert.equal(days.length, 7);
  assert.equal(days[0].date, '2026-10-04');
  assert.equal(days[6].date, '2026-10-10');
  assert.equal(days.reduce((sum, d) => sum + d.revenue, 0), 150000);
  assert.deepEqual(days[0], { date: '2026-10-04', revenue: 0, orders: 0 });
});
test('90-day report crosses year boundaries without losing dates', () => {
  const period = dashboardPeriod(90, new Date('2026-01-01T10:00:00Z'));
  const days = fillRevenueDays(period, []);
  assert.equal(days.length, 90);
  assert.equal(days.at(-1).date, '2026-01-01');
  assert.equal(new Set(days.map(d => d.date)).size, 90);
});
test('growth avoids infinity and identifies missing comparison baseline', () => {
  assert.equal(percentageChange(150, 100), 50);
  assert.equal(percentageChange(0, 100), -100);
  assert.equal(percentageChange(0, 0), 0);
  assert.equal(percentageChange(100, 0), null);
});
