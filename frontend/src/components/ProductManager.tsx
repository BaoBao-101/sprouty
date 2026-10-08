import { useCallback, useEffect, useState } from 'react';
import { ProductEditor, type AdminProduct } from './ProductEditor';
import { VideoPanel } from './VideoPanel';
import { useAuth } from '@/contexts/AuthContext';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import { formatPrice } from '@/types/product';
import { AdminIcon } from '@/components/icons/AdminIcon';

/**
 * The product catalogue, shared by the admin and employee areas.
 *
 * Employees get a read-only list plus video management; only an admin can add,
 * edit or delete a product. The server enforces the same split — hiding the
 * buttons alone would not stop a direct API call.
 */

const STATUS_LABEL: Record<string, string> = {
  published: 'Đang bán',
  draft: 'Bản nháp',
  archived: 'Lưu trữ',
};

const STATUS_PILL: Record<string, string> = {
  published: 'pill-pub',
  draft: 'pill-draft',
  archived: 'pill-arch',
};

function ProductRow({
  product,
  canEdit,
  onEdit,
  onVideos,
  onDeleted,
}: {
  product: AdminProduct;
  canEdit: boolean;
  onEdit: () => void;
  onVideos: () => void;
  onDeleted: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const firstImage = product.images?.[0];

  async function remove() {
    if (
      !confirm(
        `Xóa sản phẩm "${product.name}"?\n\nNếu sản phẩm đã có trong đơn hàng, nó sẽ được chuyển sang Lưu trữ thay vì xoá hẳn.`,
      )
    )
      return;

    setDeleting(true);
    try {
      const result = await API.admin.products.remove(product.id);
      showToast(result.message || 'Đã xóa sản phẩm', 'success');
      onDeleted();
    } catch (err: any) {
      showToast(`Lỗi: ${err?.message}`, 'error');
      setDeleting(false);
    }
  }

  return (
    <tr className={deleting ? 'row-busy' : undefined}>
      <td>
        {imageFailed || !firstImage ? (
          <div className="prod-img prod-img-fallback">{product.emoji || <AdminIcon name="products" size={22} />}</div>
        ) : (
          <img className="prod-img" src={firstImage} alt="" onError={() => setImageFailed(true)} />
        )}
      </td>
      <td>
        <div style={{ fontWeight: 600 }}>{product.name}</div>
        <div className="admin-cell-sub">{product.collection}</div>
      </td>
      <td style={{ fontSize: '.8rem' }}>
        {product.category === 'kit' ? 'Kit trồng cây' : 'Hướng dẫn chăm cây'}
      </td>
      <td>
        <div className="admin-money">{formatPrice(product.price)}</div>
        {!!product.oldPrice && product.oldPrice > product.price && (
          <div className="prod-old-price">{formatPrice(product.oldPrice)}</div>
        )}
      </td>
      <td style={{ fontSize: '.8rem' }}>{product.ageRange}</td>
      <td>
        <span className={`pill ${STATUS_PILL[product.status] ?? ''}`}>
          {STATUS_LABEL[product.status] ?? product.status}
        </span>
      </td>
      <td>
        <div className="admin-inline-actions">
          {canEdit && (
            <button className="act-btn act-edit" onClick={onEdit}>
              Sửa
            </button>
          )}
          <button className="act-btn act-edit" onClick={onVideos}>
            Video
          </button>
          {canEdit && (
            <button className="act-btn act-del" onClick={remove} disabled={deleting}>
              {deleting ? 'Đang xoá...' : 'Xóa'}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export function ProductManager() {
  const { isAdmin } = useAuth();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [videoFor, setVideoFor] = useState<AdminProduct | null>(null);

  const load = useCallback(() => {
    setStatus('loading');
    API.admin.products
      .list()
      .then((data: any) => {
        setProducts(data.products || []);
        setStatus('ready');
      })
      .catch((err: any) => {
        setError(err?.message || 'Không tải được sản phẩm.');
        setStatus('error');
      });
  }, []);

  useEffect(load, [load]);

  return (
    <>
      <div className="page-header">
        <div className="page-head" style={{ margin: 0 }}>
          <h1>Quản lý sản phẩm</h1>
          <p>
            {isAdmin
              ? 'Thêm, sửa và quản lý catalog sản phẩm'
              : 'Xem catalog và quản lý video hướng dẫn'}
          </p>
        </div>
        {isAdmin && (
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditing(null);
              setEditorOpen(true);
            }}
          >
            + Thêm sản phẩm
          </button>
        )}
      </div>

      {!isAdmin && (
        <div className="panel-note" style={{ marginBottom: 16 }}>
          Chỉ quản trị viên mới thêm, sửa hoặc xoá được sản phẩm. Bạn vẫn quản lý được video hướng
          dẫn của từng sản phẩm.
        </div>
      )}

      <div className="admin-card">
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Ảnh</th>
                <th>Tên sản phẩm</th>
                <th>Danh mục</th>
                <th>Giá</th>
                <th>Độ tuổi</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {status === 'loading' && (
                <tr>
                  <td colSpan={7} className="admin-cell-empty">
                    Đang tải...
                  </td>
                </tr>
              )}
              {status === 'error' && (
                <tr>
                  <td colSpan={7} className="admin-cell-error">
                    {error}
                  </td>
                </tr>
              )}
              {status === 'ready' && products.length === 0 && (
                <tr>
                  <td colSpan={7} className="admin-cell-empty">
                    Chưa có sản phẩm nào.
                  </td>
                </tr>
              )}

              {products.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  canEdit={isAdmin}
                  onEdit={() => {
                    setEditing(product);
                    setEditorOpen(true);
                  }}
                  onVideos={() => setVideoFor(product)}
                  onDeleted={load}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editorOpen && isAdmin && (
        <ProductEditor editing={editing} onClose={() => setEditorOpen(false)} onSaved={load} />
      )}

      {/* Standalone video manager, for employees who cannot open the editor. */}
      {videoFor && (
        <div
          className="adm-modal open"
          onClick={(e) => {
            if (e.target === e.currentTarget) setVideoFor(null);
          }}
        >
          <div className="adm-modal-box editor-box">
            <div className="editor-head">
              <div>
                <h2 className="adm-modal-title" style={{ margin: 0 }}>
                  Video hướng dẫn
                </h2>
                <p className="editor-sub">{videoFor.name}</p>
              </div>
              <button className="adm-modal-close" onClick={() => setVideoFor(null)} aria-label="Đóng">
                <AdminIcon name="close" size={18} />
              </button>
            </div>
            <div className="editor-body">
              <VideoPanel productId={videoFor.id} productName={videoFor.name} />
            </div>
            <div className="editor-foot">
              <button className="btn btn-ghost" onClick={() => setVideoFor(null)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
