import { useCallback, useEffect, useState } from 'react';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';

interface UserImage {
  id: string;
  status: string;
  asset?: { url?: string };
  user?: { name?: string; email?: string };
  product?: { name?: string };
}

export default function UserImages() {
  const [images, setImages] = useState<UserImage[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setStatus('loading');
    API.admin.userImages
      .list()
      .then((data: any) => {
        setImages(data.images || []);
        setStatus('ready');
      })
      .catch((err: any) => {
        setError(err?.message || 'Không tải được ảnh.');
        setStatus('error');
      });
  }, []);

  useEffect(load, [load]);

  async function setImageStatus(id: string, next: 'active' | 'hidden') {
    try {
      await API.admin.userImages.status(id, next);
      showToast('Đã cập nhật ảnh', 'success');
      load();
    } catch (err: any) {
      showToast(err?.message || 'Không cập nhật được ảnh', 'error');
    }
  }

  return (
    <>
      <div className="page-head" style={{ marginBottom: 22 }}>
        <h1>Ảnh người dùng</h1>
        <p>Ẩn hoặc hiện ảnh mà khách hàng tải lên Cây Kỷ Niệm</p>
      </div>

      <div className="admin-card">
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Ảnh</th>
                <th>Người dùng</th>
                <th>Sản phẩm</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
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
              {status === 'ready' && images.length === 0 && (
                <tr>
                  <td colSpan={5} className="admin-cell-empty">
                    Chưa có ảnh.
                  </td>
                </tr>
              )}

              {images.map((image) => (
                <tr key={image.id}>
                  <td>
                    {image.asset?.url && (
                      <img src={image.asset.url} alt="" className="user-image-thumb" />
                    )}
                  </td>
                  <td>
                    {image.user?.name}
                    <div className="admin-cell-sub">{image.user?.email}</div>
                  </td>
                  <td>{image.product?.name}</td>
                  <td>{image.status}</td>
                  <td>
                    <div className="admin-inline-actions">
                      <button className="act-btn" onClick={() => setImageStatus(image.id, 'active')}>
                        Hiện
                      </button>
                      <button
                        className="act-btn act-del"
                        onClick={() => setImageStatus(image.id, 'hidden')}
                      >
                        Ẩn
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
