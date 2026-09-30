import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FilterPills,
  Modal,
  PageHeader,
  Pagination,
  Panel,
  Pill,
  SearchBox,
  TableStates,
  Toolbar,
  type FilterOption,
  type LoadState,
} from '@/components/admin/ui';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import {
  formatOrderDate,
  ORDER_STATUS_VN,
  ORDER_STATUSES,
  shortOrderId,
  type Order,
  type OrderStatus,
} from '@/types/order';
import { formatPrice } from '@/types/product';

const PAGE_SIZE = 20;

const STATUS_TONE: Record<OrderStatus, string> = {
  pending: 'amber',
  processing: 'blue',
  shipped: 'orange',
  delivered: 'green',
  cancelled: 'rose',
};

/** The move staff make most often from each status, offered as one button. */
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'processing',
  processing: 'shipped',
  shipped: 'delivered',
};

type Filter = '' | OrderStatus;

export default function Orders() {
  // The status lives in the URL so the dashboard can link straight to a queue
  // and so a reloaded page keeps showing what the user was working through.
  const [params, setParams] = useSearchParams();
  const filter = (params.get('status') || '') as Filter;
  const search = params.get('q') || '';
  const page = Math.max(1, parseInt(params.get('page') || '1', 10));

  const [orders, setOrders] = useState<Order[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [countTotal, setCountTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Order | null>(null);

  const patchParams = useCallback(
    (next: Record<string, string>) => {
      setParams((current) => {
        const merged = new URLSearchParams(current);
        for (const [key, value] of Object.entries(next)) {
          if (value) merged.set(key, value);
          else merged.delete(key);
        }
        return merged;
      });
    },
    [setParams],
  );

  const loadCounts = useCallback(() => {
    API.admin.orders
      .counts()
      .then((data: any) => {
        setCounts(data.counts || {});
        setCountTotal(data.total || 0);
      })
      .catch(() => undefined);
  }, []);

  const load = useCallback(() => {
    setState('loading');
    const query: Record<string, unknown> = { page, limit: PAGE_SIZE };
    if (filter) query.status = filter;
    if (search) query.search = search;

    API.admin.orders
      .list(query)
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
  useEffect(loadCounts, [loadCounts]);

  async function markPaid(order: Order) {
    if (
      !confirm(
        `Ghi nhận đã thu ${formatPrice(order.total)} cho đơn #${shortOrderId(order.id)}?\n\n` +
          'Chỉ dùng khi bạn đã kiểm tra tiền thực sự về tài khoản. ' +
          'Đơn sẽ chuyển sang Đang xử lý và mã kích hoạt được phát cho khách.',
      )
    )
      return;

    setBusyId(order.id);
    try {
      const { message } = await API.admin.orders.markPaid(order.id);
      showToast(message || 'Đã ghi nhận thanh toán', 'success');
      load();
      loadCounts();
    } catch (err: any) {
      showToast(err?.message || 'Không ghi nhận được', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function changeStatus(orderId: string, next: OrderStatus) {
    setBusyId(orderId);
    try {
      await API.admin.orders.updateStatus(orderId, next);
      showToast(`Đã chuyển sang “${ORDER_STATUS_VN[next]}”`, 'success');
      setOrders((list) => list.map((o) => (o.id === orderId ? { ...o, status: next } : o)));
      setDetail((current) => (current?.id === orderId ? { ...current, status: next } : current));
      loadCounts();
    } catch (err: any) {
      showToast(`Lỗi: ${err?.message}`, 'error');
      load();
    } finally {
      setBusyId(null);
    }
  }

  const filters: Array<FilterOption<Filter>> = [
    { value: '', label: 'Tất cả', count: countTotal },
    ...ORDER_STATUSES.map((s) => ({
      value: s as Filter,
      label: ORDER_STATUS_VN[s],
      count: counts[s] ?? 0,
    })),
  ];

  return (
    <>
      <PageHeader
        title="Quản lý đơn hàng"
        subtitle="Theo dõi và cập nhật trạng thái giao hàng"
        actions={
          <button className="btn btn-ghost btn-sm" onClick={load} disabled={state === 'loading'}>
            ↻ Làm mới
          </button>
        }
      />

      <Toolbar>
        <FilterPills
          options={filters}
          value={filter}
          onChange={(next) => patchParams({ status: next, page: '' })}
        />
        <SearchBox
          value={search}
          placeholder="Tìm theo tên, SĐT, email…"
          onChange={(next) => patchParams({ q: next, page: '' })}
        />
      </Toolbar>

      <Panel flush>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Mã đơn</th>
              <th>Khách hàng</th>
              <th>Sản phẩm</th>
              <th style={{ textAlign: 'right' }}>Tổng tiền</th>
              <th>Ngày đặt</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <TableStates
              state={state}
              error={error}
              isEmpty={orders.length === 0}
              columns={7}
              emptyIcon="📦"
              emptyTitle={search || filter ? 'Không tìm thấy đơn nào' : 'Chưa có đơn hàng'}
              emptyHint={
                search || filter
                  ? 'Thử bỏ bớt bộ lọc hoặc đổi từ khoá tìm kiếm.'
                  : 'Đơn hàng của khách sẽ xuất hiện ở đây.'
              }
              onRetry={load}
            />
            {state === 'ready' &&
              orders.map((order) => {
                const next = NEXT_STATUS[order.status];
                return (
                  <tr
                    key={order.id}
                    className={`ad-row-click${busyId === order.id ? ' row-busy' : ''}`}
                    onClick={() => setDetail(order)}
                  >
                    <td className="admin-order-id">#{shortOrderId(order.id)}</td>
                    <td>
                      <div className="ad-cell-main">{order.shippingName}</div>
                      <div className="ad-cell-sub">{order.shippingPhone}</div>
                    </td>
                    <td className="admin-items-cell">
                      {order.items.map((i) => `${i.product?.name || 'SP'} ×${i.qty}`).join(', ')}
                    </td>
                    <td className="ad-num">{formatPrice(order.total)}</td>
                    <td className="ad-cell-sub">
                      {new Date(order.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td>
                      <Pill tone={STATUS_TONE[order.status]}>{ORDER_STATUS_VN[order.status]}</Pill>
                      {/* Whether the money actually arrived is a separate fact
                          from where the parcel is, and staff need both. */}
                      <div style={{ marginTop: 4 }}>
                        <Pill tone={order.paidAt ? 'green' : 'amber'}>
                          {order.paidAt ? '✓ Đã thu tiền' : 'Chưa thu tiền'}
                        </Pill>
                      </div>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="admin-inline-actions">
                        {/* Recording a payment that did not come through the
                            webhook — a mistyped reference, cash, a transfer from
                            an account SePay does not watch. Without it such an
                            order stays unpaid forever and never issues its
                            post-purchase redeem codes. */}
                        {!order.paidAt && order.status !== 'cancelled' && (
                          <button
                            className="act-btn act-paid"
                            disabled={busyId === order.id}
                            onClick={() => markPaid(order)}
                          >
                            💰 Đã thu tiền
                          </button>
                        )}
                        {/* One click for the usual next step; the select stays
                            for the exceptions (cancelling, correcting a slip). */}
                        {next && (
                          <button
                            className="act-btn act-edit"
                            disabled={busyId === order.id}
                            onClick={() => changeStatus(order.id, next)}
                          >
                            → {ORDER_STATUS_VN[next]}
                          </button>
                        )}
                        <select
                          className="admin-mini-select"
                          value={order.status}
                          disabled={busyId === order.id}
                          onChange={(e) => changeStatus(order.id, e.target.value as OrderStatus)}
                        >
                          {ORDER_STATUSES.map((s) => (
                            <option value={s} key={s}>
                              {ORDER_STATUS_VN[s]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </Panel>

      <Pagination
        page={page}
        pages={pages}
        total={total}
        unit="đơn"
        onChange={(next) => patchParams({ page: String(next) })}
      />

      {detail && (
        <Modal
          title={`Đơn #${shortOrderId(detail.id)}`}
          subtitle={formatOrderDate(detail.createdAt)}
          onClose={() => setDetail(null)}
          footer={
            <button className="btn btn-ghost" onClick={() => setDetail(null)}>
              Đóng
            </button>
          }
        >
          <div className="ord-detail-top">
            <Pill tone={STATUS_TONE[detail.status]}>{ORDER_STATUS_VN[detail.status]}</Pill>
            <span className="ord-detail-total">{formatPrice(detail.total)}</span>
          </div>

          <div className="panel-subhead">Người nhận</div>
          <div className="ord-detail-grid">
            <div>
              <div className="ad-cell-sub">Họ tên</div>
              <div className="ad-cell-main">{detail.shippingName}</div>
            </div>
            <div>
              <div className="ad-cell-sub">Điện thoại</div>
              <div className="ad-cell-main">{detail.shippingPhone}</div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div className="ad-cell-sub">Địa chỉ</div>
              <div className="ad-cell-main">{detail.shippingAddress || '—'}</div>
            </div>
          </div>

          {detail.note && (
            <>
              <div className="panel-subhead">Ghi chú của khách</div>
              <div className="panel-note">{detail.note}</div>
            </>
          )}

          <div className="panel-subhead">Sản phẩm</div>
          {detail.items.map((item, i) => (
            <div className="ord-item" key={i}>
              <span className="ad-cell-main">{item.product?.name || 'Sản phẩm'}</span>
              <span className="ad-cell-sub">×{item.qty}</span>
            </div>
          ))}

          <div className="panel-subhead">Đổi trạng thái</div>
          <div className="ad-pills">
            {ORDER_STATUSES.map((s) => (
              <button
                key={s}
                className={`ad-pill${detail.status === s ? ' active' : ''}`}
                disabled={busyId === detail.id}
                onClick={() => changeStatus(detail.id, s)}
              >
                {ORDER_STATUS_VN[s]}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
