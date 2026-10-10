import test from 'node:test';
import assert from 'node:assert/strict';
import { salesPage, salesSummary, revenueShare } from './sales-report.ts';
const rows = Array.from({ length: 28 }, (_, i) => ({ id: i + 1, name: `Sản phẩm ${i + 1}`, price: 1000, status: 'published', totalQty: i, totalRevenue: i * 1000, orderCount: i }));
test('28 products paginate as 10, 10, 8 without duplicates', () => {
  const pages = [1, 2, 3].map(page => salesPage(rows, '', 'revenue', page));
  assert.deepEqual(pages.map(page => page.rows.length), [10, 10, 8]);
  assert.equal(new Set(pages.flatMap(page => page.rows.map(row => row.id))).size, 28);
  assert.deepEqual([pages[2].from, pages[2].to], [21, 28]);
});
test('search and sorting apply before pagination; out of range pages clamp', () => {
  const result = salesPage(rows, 'san pham 2', 'qty', 3);
  assert.equal(result.total, 10);
  assert.equal(result.page, 1);
  assert.equal(result.rows[0].id, 28);
});
test('empty results and zero revenue remain finite', () => {
  const result = salesPage(rows, 'missing', 'name', 4);
  assert.deepEqual([result.page, result.pages, result.total, result.from, result.to], [1, 1, 0, 0, 0]);
  assert.equal(revenueShare(0, 0), 0);
  assert.equal(salesSummary([]).best, undefined);
});
test('shares use total revenue and summaries are independent of pages', () => {
  const summary = salesSummary(rows);
  assert.equal(summary.revenue, 378000);
  assert.equal(summary.best.id, 28);
  assert.equal(summary.selling, 27);
  assert.equal(revenueShare(25, 100), 25);
  salesPage(rows, 'san pham 2', 'orders', 2);
  assert.deepEqual(salesSummary(rows), summary);
  assert.equal(rows[0].id, 1);
});
