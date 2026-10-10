export interface SalesRow {
  id: number;
  name: string;
  price: number;
  totalQty?: number;
  orderCount?: number;
  totalRevenue?: number;
  status: string;
}
export type SalesSort = 'revenue' | 'qty' | 'orders' | 'name';
export const SALES_PAGE_SIZE = 10;

export function salesSummary(rows: SalesRow[]) {
  const revenue = rows.reduce((sum, row) => sum + (row.totalRevenue || 0), 0);
  const qty = rows.reduce((sum, row) => sum + (row.totalQty || 0), 0);
  const best = [...rows].filter(row => (row.totalRevenue || 0) > 0)
    .sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0) || a.id - b.id)[0];
  return { revenue, qty, best, selling: rows.filter(row => (row.totalQty || 0) > 0).length };
}

export function salesPage(rows: SalesRow[], search: string, sort: SalesSort, page: number) {
  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLocaleLowerCase('vi');
  const term = normalize(search.trim());
  const filtered = rows.filter(row => normalize(row.name).includes(term));
  const field = { revenue: 'totalRevenue', qty: 'totalQty', orders: 'orderCount' } as const;
  filtered.sort((a, b) => (sort === 'name'
    ? a.name.localeCompare(b.name, 'vi')
    : (b[field[sort]] || 0) - (a[field[sort]] || 0)) || a.id - b.id);
  const pages = Math.max(1, Math.ceil(filtered.length / SALES_PAGE_SIZE));
  const current = Math.min(pages, Math.max(1, page));
  const start = (current - 1) * SALES_PAGE_SIZE;
  return { rows: filtered.slice(start, start + SALES_PAGE_SIZE), total: filtered.length, pages, page: current,
    from: filtered.length ? start + 1 : 0, to: Math.min(start + SALES_PAGE_SIZE, filtered.length) };
}

export function revenueShare(revenue: number, total: number) {
  return total > 0 ? revenue / total * 100 : 0;
}
