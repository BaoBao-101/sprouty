import { useCallback, useEffect, useState } from 'react';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import {
  ORDER_STATUS_VN,
  ORDER_STATUSES,
  shortOrderId,
  type Order,
  type OrderStatus,
} from '@/types/order';
import { formatPrice } from '@/types/product';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  // Typing shouldn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(() => {
    setStatus('loading');
    const params: Record<string, unknown> = { page, limit: PAGE_SIZE };
    if (search) params.search = search;

    API.admin.orders
      .list(params)
      .then((data: any) => {
        setOrders(data.orders || []);
        setPages(data.pages || 1);
        setTotal(data.total || 0);
        setStatus('ready');
      })
      .catch((err: any) => {
        setError(err?.message || 'Không tải được đơn hàng.');
        setStatus('error');
      });
  }, [page, search]);

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
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Quản lý đơn hàng</h1>
        <input
          type="search"
          className="form-input admin-search"
          placeholder="Tìm theo tên, SĐT, mã đơn..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      <div className="admin-card">
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
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
              {status === 'loading' && (
                <tr>
                  <td colSpan={6} className="admin-cell-empty">
                    Đang tải...
                  </td>
                </tr>
              )}
              {status === 'error' && (
                <tr>
                  <td colSpan={6} className="admin-cell-error">
                    {error}
                  </td>
                </tr>
              )}
              {status === 'ready' && orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="admin-cell-empty">
                    Không có đơn hàng
                  </td>
                </tr>
              )}

              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="admin-order-id">#{shortOrderId(order.id)}</td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: '.83rem' }}>{order.shippingName}</div>
                    <div className="admin-cell-sub">{order.shippingPhone}</div>
                  </td>
                  <td className="admin-items-cell">
                    {order.items.map((i) => `${i.product?.name || 'SP'} ×${i.qty}`).join(', ')}
                  </td>
                  <td className="admin-money" style={{ fontSize: '.83rem' }}>
                    {formatPrice(order.total)}
                  </td>
                  <td className="admin-cell-sub">
                    {new Date(order.createdAt).toLocaleDateString('vi-VN')}
                  </td>
                  <td>
                    <select
                      className="admin-mini-select"
                      value={order.status}
                      onChange={(e) => changeStatus(order.id, e.target.value as OrderStatus)}
                    >
                      {ORDER_STATUSES.map((s) => (
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
      </div>

      {pages > 1 && (
        <div className="admin-pagination">
          <span className="admin-cell-sub">Tổng {total}</span>
          <button
            className="act-btn"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ‹
          </button>
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              className={`act-btn${page === i + 1 ? ' active' : ''}`}
              onClick={() => setPage(i + 1)}
            >
              {i + 1}
            </button>
          ))}
          <button
            className="act-btn"
            disabled={page >= pages}
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
          >
            ›
          </button>
        </div>
      )}
    </>
  );
}
