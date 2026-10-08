import { useCallback, useEffect, useState } from 'react';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import { AdminIcon } from '@/components/icons/AdminIcon';

/**
 * Moderation queue for the photos customers upload to Cây Kỷ Niệm.
 *
 * This is public user-generated content, so the job here is spotting the ones
 * that should not be on the site. Hiding is reversible and never deletes the
 * file — every change is written to the audit log by the server.
 */

interface UserImage {
  id: string;
  status: string;
  createdAt?: string;
  title?: string | null;
  note?: string | null;
  asset?: { url?: string };
  user?: { name?: string; email?: string };
  product?: { name?: string };
}

type ImageStatus = 'active' | 'hidden' | 'deleted';

const PAGE_SIZE = 20;

const STATUS_LABEL: Record<string, string> = {
  active: 'Đang hiện',
  hidden: 'Đã ẩn',
  deleted: 'Đã xoá',
};

const STATUS_PILL: Record<string, string> = {
  active: 'pill-pub',
  hidden: 'pill-draft',
  deleted: 'pill-arch',
};

const FILTERS: Array<{ value: '' | ImageStatus; label: string }> = [
  { value: '', label: 'Tất cả' },
  { value: 'active', label: 'Đang hiện' },
  { value: 'hidden', label: 'Đã ẩn' },
  { value: 'deleted', label: 'Đã xoá' },
];

function formatDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  return isNaN(date.getTime()) ? '' : date.toLocaleDateString('vi-VN');
}

export default function UserImages() {
  const [images, setImages] = useState<UserImage[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<'' | ImageStatus>('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [preview, setPreview] = useState<UserImage | null>(null);

  const loadCounts = useCallback(() => {
    API.admin.userImages
      .counts()
      .then((data: any) => setCounts(data.counts || {}))
      .catch(() => setCounts({}));
  }, []);

  const load = useCallback(() => {
    setStatus('loading');
    const params: Record<string, unknown> = { page, limit: PAGE_SIZE };
    if (filter) params.status = filter;

    API.admin.userImages
      .list(params)
      .then((data: any) => {
        setImages(data.images || []);
        setPages(data.pages || 1);
        setTotal(data.total || 0);
        setStatus('ready');
      })
      .catch((err: any) => {
        setError(err?.message || 'Không tải được ảnh.');
        setStatus('error');
      });
  }, [page, filter]);

  useEffect(load, [load]);
  useEffect(loadCounts, [loadCounts]);

  async function setImageStatus(id: string, next: ImageStatus) {
    setBusyId(id);
    try {
      await API.admin.userImages.status(id, next);
      showToast(next === 'active' ? 'Đã hiện lại ảnh' : 'Đã ẩn ảnh', 'success');
      load();
      loadCounts();
    } catch (err: any) {
      showToast(err?.message || 'Không cập nhật được ảnh', 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="page-head" style={{ marginBottom: 18 }}>
        <h1>Ảnh người dùng</h1>
        <p>Ẩn hoặc hiện ảnh mà khách hàng tải lên Cây Kỷ Niệm</p>
      </div>

      <div className="admin-filters">
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
            {f.value && counts[f.value] !== undefined && (
              <span className="filter-count">{counts[f.value]}</span>
            )}
          </button>
        ))}
      </div>

      <div className="admin-card">
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Ảnh</th>
                <th>Người dùng</th>
                <th>Sản phẩm</th>
                <th>Ngày tải lên</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
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
              {status === 'ready' && images.length === 0 && (
                <tr>
                  <td colSpan={6} className="admin-cell-empty">
                    {filter
                      ? `Không có ảnh nào ở trạng thái “${STATUS_LABEL[filter]}”.`
                      : 'Chưa có khách nào tải ảnh lên Cây Kỷ Niệm.'}
                  </td>
                </tr>
              )}

              {images.map((image) => (
                <tr key={image.id} className={busyId === image.id ? 'row-busy' : undefined}>
                  <td>
                    {image.asset?.url ? (
                      <button
                        className="user-image-btn"
                        onClick={() => setPreview(image)}
                        title="Xem ảnh lớn"
                      >
                        <img src={image.asset.url} alt="" className="user-image-thumb" />
                      </button>
                    ) : (
                      <div className="user-image-thumb user-image-missing"><AdminIcon name="images" size={22} /></div>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{image.user?.name || '—'}</div>
                    <div className="admin-cell-sub">{image.user?.email}</div>
                  </td>
                  <td style={{ fontSize: '.85rem' }}>{image.product?.name || '—'}</td>
                  <td style={{ fontSize: '.82rem' }}>{formatDate(image.createdAt)}</td>
                  <td>
                    <span className={`pill ${STATUS_PILL[image.status] ?? ''}`}>
                      {STATUS_LABEL[image.status] ?? image.status}
                    </span>
                  </td>
                  <td>
                    <div className="admin-inline-actions">
                      {image.status !== 'active' && (
                        <button
                          className="act-btn act-edit"
                          disabled={busyId === image.id}
                          onClick={() => setImageStatus(image.id, 'active')}
                        >
                          Hiện
                        </button>
                      )}
                      {image.status !== 'hidden' && (
                        <button
                          className="act-btn act-del"
                          disabled={busyId === image.id}
                          onClick={() => setImageStatus(image.id, 'hidden')}
                        >
                          Ẩn
                        </button>
                      )}
                    </div>
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
          <button className="act-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
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
            onClick={() => setPage((p) => p + 1)}
          >
            ›
          </button>
        </div>
      )}

      {/* A thumbnail is too small to judge whether a photo belongs on the site. */}
      {preview && (
        <div
          className="adm-modal open"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreview(null);
          }}
        >
          <div className="adm-modal-box" style={{ maxWidth: 640 }}>
            <button className="adm-modal-close" onClick={() => setPreview(null)} aria-label="Đóng">
              <AdminIcon name="close" size={18} />
            </button>
            <h2 className="adm-modal-title" style={{ marginBottom: 6 }}>
              {preview.title || 'Ảnh của khách'}
            </h2>
            <p className="editor-sub" style={{ marginBottom: 16 }}>
              {preview.user?.name || preview.user?.email} · {preview.product?.name}
            </p>
            <img src={preview.asset?.url} alt="" className="user-image-full" />
            {preview.note && <p className="panel-note" style={{ marginTop: 14 }}>{preview.note}</p>}
            <div className="editor-foot" style={{ padding: '16px 0 0', border: 'none' }}>
              <button className="btn btn-ghost" onClick={() => setPreview(null)}>
                Đóng
              </button>
              {preview.status !== 'hidden' && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setImageStatus(preview.id, 'hidden');
                    setPreview(null);
                  }}
                >
                  Ẩn ảnh này
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
