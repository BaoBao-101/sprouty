import { useEffect, useState } from 'react';
import { ProductIcon } from '@/components/ProductIcon';
import { API } from '@/services/api';
import { formatPrice } from '@/types/product';

interface SalesRow {
  id: number;
  name: string;
  price: number;
  totalQty?: number;
  orderCount?: number;
  totalRevenue?: number;
  status: string;
}

const STATUS_LABEL: Record<string, string> = {
  published: 'Đang bán',
  draft: 'Bản nháp',
  archived: 'Lưu trữ',
};

export default function Sales() {
  const [rows, setRows] = useState<SalesRow[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    API.admin.products
      .sales()
      .then((data: any) => {
        if (cancelled) return;
        setRows(data.products || []);
        setStatus('ready');
      })
      .catch((err: any) => {
        if (cancelled) return;
        setError(err?.message || 'Không tải được báo cáo.');
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <div className="page-head" style={{ marginBottom: 22 }}>
        <h1>Báo cáo bán hàng</h1>
        <p>Số lượng bán ra và doanh thu theo từng sản phẩm</p>
      </div>

      <div className="admin-card">
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th style={{ textAlign: 'right' }}>Đã bán</th>
                <th style={{ textAlign: 'right' }}>Số đơn</th>
                <th style={{ textAlign: 'right' }}>Doanh thu</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {status === 'loading' && (
                <tr>
                  <td colSpan={5} className="admin-cell-empty">
                    Đang tải...
                  </td>
                </tr>
              )}
              {status === 'error' && (
                <tr>
                  <td colSpan={5} className="admin-cell-error">
                    {error}
                  </td>
                </tr>
              )}
              {status === 'ready' && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="admin-cell-empty">
                    Chưa có sản phẩm.
                  </td>
                </tr>
              )}

              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ProductIcon name={row.name} size={22} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '.86rem' }}>{row.name}</div>
                        <div className="admin-cell-sub">{formatPrice(row.price || 0)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="admin-num">{(row.totalQty || 0).toLocaleString('vi-VN')}</td>
                  <td className="admin-num" style={{ fontWeight: 400 }}>
                    {(row.orderCount || 0).toLocaleString('vi-VN')}
                  </td>
                  <td className="admin-num" style={{ color: 'var(--orange)' }}>
                    {formatPrice(row.totalRevenue || 0)}
                  </td>
                  <td style={{ fontSize: '.78rem' }}>{STATUS_LABEL[row.status] ?? row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
