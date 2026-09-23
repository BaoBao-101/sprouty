import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ProductIcon } from './ProductIcon';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import { formatPrice } from '@/types/product';

/**
 * Product CRUD, shared by the admin and employee areas — the two pages used to
 * carry two copies of the same code.
 */

interface AdminProduct {
  id: number;
  name: string;
  description: string;
  price: number;
  oldPrice?: number | null;
  category: 'kit' | 'book';
  ageRange: string;
  collection: string;
  emoji?: string;
  badge?: string | null;
  images?: string[];
  includes?: string[];
  status: 'published' | 'draft' | 'archived';
}

interface Video {
  id: string;
  title: string;
  status: string;
  sortOrder: number;
  externalUrl?: string;
  asset?: { url?: string };
}

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

const EMPTY_FORM = {
  name: '',
  category: 'kit',
  ageRange: '',
  price: '',
  oldPrice: '',
  collection: '',
  description: '',
  emoji: '',
  badge: '',
  images: '',
  includes: '',
  status: 'published',
};

type FormState = typeof EMPTY_FORM;

function toForm(product: AdminProduct): FormState {
  return {
    name: product.name,
    category: product.category,
    ageRange: product.ageRange,
    price: String(product.price),
    oldPrice: product.oldPrice ? String(product.oldPrice) : '',
    collection: product.collection,
    description: product.description,
    emoji: product.emoji || '',
    badge: product.badge || '',
    images: (product.images || []).join('\n'),
    includes: (product.includes || []).join('\n'),
    status: product.status,
  };
}

function ProductModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: AdminProduct | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => (editing ? toForm(editing) : EMPTY_FORM));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key: keyof FormState) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);

    const payload = {
      name: form.name,
      category: form.category,
      ageRange: form.ageRange,
      price: parseInt(form.price, 10),
      oldPrice: parseInt(form.oldPrice, 10) || null,
      collection: form.collection,
      description: form.description,
      emoji: form.emoji || '🎨',
      badge: form.badge || null,
      images: form.images.split('\n').map((s) => s.trim()).filter(Boolean),
      includes: form.includes.split('\n').map((s) => s.trim()).filter(Boolean),
      status: form.status,
    };

    try {
      if (editing) {
        await API.admin.products.update(editing.id, payload);
        showToast('Đã cập nhật sản phẩm', 'success');
      } else {
        await API.admin.products.create(payload);
        showToast('Đã thêm sản phẩm mới', 'success');
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Lỗi lưu sản phẩm');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="adm-modal open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="adm-modal-box">
        <button className="adm-modal-close" onClick={onClose} aria-label="Đóng">
          ✕
        </button>
        <h2 className="adm-modal-title">{editing ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}</h2>

        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Tên sản phẩm *</label>
            <input
              className="form-input"
              type="text"
              required
              minLength={2}
              value={form.name}
              onChange={(e) => set('name')(e.target.value)}
            />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Danh mục *</label>
              <select
                className="form-input"
                required
                value={form.category}
                onChange={(e) => set('category')(e.target.value)}
              >
                <option value="kit">Kit trồng cây</option>
                <option value="book">Hướng dẫn chăm cây</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Độ tuổi *</label>
              <input
                className="form-input"
                type="text"
                placeholder="VD: 4–6 tuổi"
                required
                minLength={2}
                value={form.ageRange}
                onChange={(e) => set('ageRange')(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Giá (đ) *</label>
              <input
                className="form-input"
                type="number"
                min={1000}
                required
                value={form.price}
                onChange={(e) => set('price')(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Giá gốc (đ)</label>
              <input
                className="form-input"
                type="number"
                min={1000}
                value={form.oldPrice}
                onChange={(e) => set('oldPrice')(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Bộ sưu tập *</label>
            <input
              className="form-input"
              type="text"
              required
              minLength={2}
              value={form.collection}
              onChange={(e) => set('collection')(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Mô tả *</label>
            <textarea
              className="form-input"
              rows={3}
              required
              minLength={10}
              style={{ resize: 'vertical' }}
              value={form.description}
              onChange={(e) => set('description')(e.target.value)}
            />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Emoji</label>
              <input
                className="form-input"
                type="text"
                maxLength={8}
                value={form.emoji}
                onChange={(e) => set('emoji')(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Badge</label>
              <select
                className="form-input"
                value={form.badge}
                onChange={(e) => set('badge')(e.target.value)}
              >
                <option value="">Không</option>
                <option value="hot">🔥 Bán chạy (hot)</option>
                <option value="new">✨ Mới (new)</option>
                <option value="sale">🏷 Giảm giá (sale)</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">URL ảnh (mỗi URL một dòng)</label>
            <textarea
              className="form-input"
              rows={3}
              style={{ resize: 'vertical' }}
              value={form.images}
              onChange={(e) => set('images')(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Bao gồm trong hộp (mỗi dòng một mục)</label>
            <textarea
              className="form-input"
              rows={4}
              style={{ resize: 'vertical' }}
              value={form.includes}
              onChange={(e) => set('includes')(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Trạng thái *</label>
            <select
              className="form-input"
              required
              value={form.status}
              onChange={(e) => set('status')(e.target.value)}
            >
              <option value="published">Đang bán</option>
              <option value="draft">Bản nháp</option>
              <option value="archived">Lưu trữ</option>
            </select>
          </div>

          {error && <div className="form-error mb-12">{error}</div>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Đang lưu...' : 'Lưu sản phẩm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function VideoModal({ product, onClose }: { product: AdminProduct; onClose: () => void }) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [message, setMessage] = useState('Đang tải...');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [order, setOrder] = useState('0');
  const [status, setStatus] = useState('draft');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(() => {
    API.admin.videos
      .list(product.id)
      .then((data: any) => {
        setVideos(data.videos || []);
        setMessage(data.videos?.length ? '' : 'Chưa có video.');
      })
      .catch((err: any) => setMessage(err?.message || 'Không tải được video.'));
  }, [product.id]);

  useEffect(load, [load]);

  async function create() {
    const payload = {
      title: title.trim(),
      description: description.trim(),
      externalUrl: url.trim(),
      sortOrder: parseInt(order, 10) || 0,
      status,
    };
    try {
      if (file) {
        const form = new FormData();
        Object.entries(payload).forEach(([k, v]) => form.append(k, String(v)));
        form.append('video', file);
        await API.admin.videos.create(product.id, form);
      } else {
        await API.admin.videos.create(product.id, payload);
      }
      showToast('Đã thêm video', 'success');
      setTitle('');
      setUrl('');
      setDescription('');
      setFile(null);
      load();
    } catch (err: any) {
      showToast(err?.message || 'Không thêm được video', 'error');
    }
  }

  async function update(id: string, data: Record<string, unknown>) {
    try {
      await API.admin.videos.update(id, data);
      showToast('Đã cập nhật video', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Không cập nhật được video', 'error');
      load();
    }
  }

  async function uploadThumbnail(id: string, thumb: File) {
    const form = new FormData();
    form.append('thumbnail', thumb);
    try {
      await API.admin.videos.thumbnail(id, form);
      showToast('Đã upload thumbnail', 'success');
      load();
    } catch (err: any) {
      showToast(err?.message || 'Không upload được thumbnail', 'error');
    }
  }

  async function archive(id: string) {
    if (!confirm('Lưu trữ video này?')) return;
    try {
      await API.admin.videos.remove(id);
      showToast('Đã lưu trữ video', 'success');
      load();
    } catch (err: any) {
      showToast(err?.message || 'Không lưu trữ được video', 'error');
    }
  }

  return (
    <div
      className="adm-modal open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="adm-modal-box" style={{ maxWidth: 820 }}>
        <button className="adm-modal-close" onClick={onClose} aria-label="Đóng">
          ✕
        </button>
        <h2 className="adm-modal-title">Video hướng dẫn · {product.name}</h2>

        <div className="form-grid-2" style={{ marginBottom: 12 }}>
          <input
            className="form-input"
            placeholder="Tiêu đề video"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className="form-input"
            placeholder="URL video ngoài (tuỳ chọn)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <input
            className="form-input"
            type="number"
            min={0}
            placeholder="Thứ tự"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
          />
          <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="draft">Bản nháp</option>
            <option value="published">Xuất bản</option>
            <option value="archived">Lưu trữ</option>
          </select>
        </div>

        <textarea
          className="form-input"
          rows={2}
          placeholder="Mô tả"
          style={{ marginBottom: 10 }}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <input
          className="form-input"
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          style={{ marginBottom: 10 }}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button className="btn btn-primary btn-sm" onClick={create}>
          Thêm video
        </button>

        <div style={{ marginTop: 16 }}>
          {message && <div style={{ color: 'var(--ink-4)' }}>{message}</div>}
          {videos.length > 0 && (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Tiêu đề</th>
                  <th>Trạng thái</th>
                  <th>Thứ tự</th>
                  <th>Thumb</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {videos.map((video) => (
                  <tr key={video.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{video.title}</div>
                      <div className="admin-cell-sub">{video.externalUrl || video.asset?.url}</div>
                    </td>
                    <td>
                      <select
                        className="admin-mini-select"
                        defaultValue={video.status}
                        onChange={(e) => update(video.id, { status: e.target.value })}
                      >
                        {['draft', 'published', 'archived'].map((s) => (
                          <option value={s} key={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        style={{ width: 70 }}
                        defaultValue={video.sortOrder}
                        onChange={(e) =>
                          update(video.id, { sortOrder: parseInt(e.target.value, 10) || 0 })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => {
                          const thumb = e.target.files?.[0];
                          if (thumb) uploadThumbnail(video.id, thumb);
                        }}
                      />
                    </td>
                    <td>
                      <button className="act-btn act-del" onClick={() => archive(video.id)}>
                        Lưu trữ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductRow({
  product,
  onEdit,
  onVideos,
  onDeleted,
}: {
  product: AdminProduct;
  onEdit: () => void;
  onVideos: () => void;
  onDeleted: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const firstImage = product.images?.[0];

  async function remove() {
    if (
      !confirm(
        `Xóa sản phẩm "${product.name}"?\n(Nếu có đơn hàng, sản phẩm sẽ được lưu trữ thay vì xóa)`,
      )
    )
      return;
    try {
      const result = await API.admin.products.remove(product.id);
      showToast(result.message || 'Đã xóa sản phẩm', 'success');
      onDeleted();
    } catch (err: any) {
      showToast(`Lỗi: ${err?.message}`, 'error');
    }
  }

  return (
    <tr>
      <td>
        {imageFailed || !firstImage ? (
          <div className="prod-img prod-img-fallback">{product.emoji || '🎨'}</div>
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
        {product.oldPrice && <div className="prod-old-price">{formatPrice(product.oldPrice)}</div>}
      </td>
      <td style={{ fontSize: '.8rem' }}>{product.ageRange}</td>
      <td>
        <span className={`pill ${STATUS_PILL[product.status] ?? ''}`}>
          {STATUS_LABEL[product.status] ?? product.status}
        </span>
      </td>
      <td>
        <div className="admin-inline-actions">
          <button className="act-btn act-edit" onClick={onEdit}>
            Sửa
          </button>
          <button className="act-btn act-edit" onClick={onVideos}>
            Video
          </button>
          <button className="act-btn act-del" onClick={remove}>
            Xóa
          </button>
        </div>
      </td>
    </tr>
  );
}

export function ProductManager() {
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
          <p>Thêm, sửa và quản lý catalog sản phẩm</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditing(null);
            setEditorOpen(true);
          }}
        >
          + Thêm sản phẩm
        </button>
      </div>

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

      {editorOpen && (
        <ProductModal editing={editing} onClose={() => setEditorOpen(false)} onSaved={load} />
      )}
      {videoFor && <VideoModal product={videoFor} onClose={() => setVideoFor(null)} />}
    </>
  );
}
