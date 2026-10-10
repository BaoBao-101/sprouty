import { useCallback, useEffect, useState } from 'react';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import {
  allowedOrderTransitions,
  ORDER_STATUS_VN,
  ORDER_STATUSES,
  shortOrderId,
  type Order,
  type OrderStatus,
} from '@/types/order';
import { formatPrice } from '@/types/product';
import './Orders.css';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

const FILTERS: Array<{ value: '' | OrderStatus; label: string }> = [
  { value: '', label: 'Tất cả' },
  ...ORDER_STATUSES.map((s) => ({ value: s, label: ORDER_STATUS_VN[s] })),
];

export default function EmployeeOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [filter, setFilter] = useState<'' | OrderStatus>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(() => {
    setState('loading');
    const params: Record<string, unknown> = { page, limit: PAGE_SIZE };
    if (filter) params.status = filter;
    if (search) params.search = search;

    API.admin.orders
      .list(params)
      .then((data: any) => {
        setOrders(data.orders || []);
        setPages(data.pages || 1);
        setTotal(data.total || 0);
        setState('ready');
      })
      .catch((err: any) => {
        setError(err?.message || 'Không tải được đơn hàng.');
        setState('error');
      });
  }, [page, filter, search]);

  useEffect(load, [load]);

  async function changeStatus(orderId: string, next: OrderStatus) {
    try {
      await API.admin.orders.updateStatus(orderId, next);
      showToast('Đã cập nhật', 'success');
      setOrders((list) => list.map((o) => (o.id === orderId ? { ...o, status: next } : o)));
    } catch (err: any) {
      showToast(`Lỗi: ${err?.message}`, 'error');
      load();
    }
  }

  return (
    <>
      <div className="page-header">
        <div className="page-head" style={{ margin: 0 }}>
          <h1>Quản lý đơn hàng</h1>
          <p>Giao hàng theo thứ tự sau khi quản trị viên đối soát thanh toán.</p>
        </div>
        <div className="search-box">
          <input
            type="search"
            placeholder="Tìm theo tên, SĐT, mã đơn..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
      </div>

      <div className="filters" style={{ marginBottom: 16 }}>
        {FILTERS.map((f) => (
          <button
            key={f.value || 'all'}
            className={`filter-btn${filter === f.value ? ' active' : ''}`}
            onClick={() => {
              setFilter(f.value);
              setPage(1);
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="emp-table">
          <thead>
            <tr>
              <th>Mã đơn</th>
              <th>Khách hàng</th>
              <th>Sản phẩm</th>
              <th>Tổng tiền</th>
              <th>Ngày đặt</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {state === 'loading' && (
              <tr>
                <td colSpan={6} className="admin-cell-empty">
                  Đang tải...
                </td>
              </tr>
            )}
            {state === 'error' && (
              <tr>
                <td colSpan={6} className="admin-cell-error">
                  {error}
                </td>
              </tr>
            )}
            {state === 'ready' && orders.length === 0 && (
              <tr>
                <td colSpan={6} className="admin-cell-empty">
                  Không có đơn hàng nào.
                </td>
              </tr>
            )}

            {orders.map((order) => (
              <tr key={order.id}>
                <td className="admin-order-id">#{shortOrderId(order.id)}</td>
                <td>
                  <div style={{ fontWeight: 600, fontSize: '.85rem' }}>{order.shippingName}</div>
                  <div className="admin-cell-sub">{order.shippingPhone}</div>
                </td>
                <td className="admin-items-cell">
                  {order.items.map((i) => `${i.product?.name || 'SP'} ×${i.qty}`).join(', ')}
                </td>
                <td className="admin-money">{formatPrice(order.total)}</td>
                <td className="admin-cell-sub">
                  {new Date(order.createdAt).toLocaleDateString('vi-VN')}
                </td>
                <td>
                  <select
                    className="status-select"
                    value={order.status}
                    disabled={allowedOrderTransitions(order).length === 0}
                    onChange={(e) => changeStatus(order.id, e.target.value as OrderStatus)}
                  >
                    {[order.status, ...allowedOrderTransitions(order)].map((s) => (
                      <option value={s} key={s}>
                        {ORDER_STATUS_VN[s]}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="pagination">
          <span className="admin-cell-sub">Tổng {total}</span>
          <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            ‹
          </button>
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              className={page === i + 1 ? 'active' : ''}
              onClick={() => setPage(i + 1)}
            >
              {i + 1}
            </button>
          ))}
          <button disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>
            ›
          </button>
        </div>
      )}
    </>
  );
}
