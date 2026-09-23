import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API } from '@/services/api';
import { normalizeProduct } from '@/services/products';
import { showToast } from '@/services/toast';
import { formatPrice, type Product } from '@/types/product';

interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content?: string;
  status: string;
  updatedAt: string;
  coverAsset?: { url?: string };
  recommendedProductIds?: number[];
}

const STATUSES = ['draft', 'published', 'archived'];

const EMPTY_EDITOR = { id: '', title: '', excerpt: '', content: '' };

export default function BlogAdmin() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  const [products, setProducts] = useState<Product[]>([]);
  const [productQuery, setProductQuery] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);

  const [editor, setEditor] = useState(EMPTY_EDITOR);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverHint, setCoverHint] = useState('Chưa chọn ảnh bìa');
  const [imageStatus, setImageStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const contentRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setState('loading');
    API.admin.blog
      .list()
      .then((data: any) => {
        setPosts(data.posts || []);
        setState('ready');
      })
      .catch((err: any) => {
        setError(err?.message || 'Không tải được bài viết.');
        setState('error');
      });
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    API.admin.products
      .list()
      .then((data: any) => setProducts((data.products || []).map(normalizeProduct)))
      .catch(() => setProducts([]));
  }, []);

  const visibleProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      `${p.name} ${p.col} ${p.age} ${p.desc}`.toLowerCase().includes(q),
    );
  }, [products, productQuery]);

  function resetEditor() {
    setEditor(EMPTY_EDITOR);
    setCoverFile(null);
    setCoverHint('Chưa chọn ảnh bìa');
    setImageStatus('');
    setSelectedProductIds([]);
  }

  function startEdit(post: Post) {
    setEditor({
      id: post.id,
      title: post.title || '',
      excerpt: post.excerpt || '',
      content: post.content || '',
    });
    setCoverFile(null);
    setCoverHint(
      post.coverAsset?.url ? 'Giữ ảnh bìa hiện tại hoặc chọn ảnh mới' : 'Chưa có ảnh bìa',
    );
    setSelectedProductIds(post.recommendedProductIds?.slice() ?? []);
    titleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function save() {
    setSaving(true);
    const payload: Record<string, unknown> = {
      title: editor.title.trim(),
      excerpt: editor.excerpt.trim(),
      content: editor.content,
      recommendedProductIds: selectedProductIds.slice(),
    };
    // A brand-new post starts as a draft; editing keeps whatever status it has.
    if (!editor.id) payload.status = 'draft';

    try {
      const { post } = editor.id
        ? await API.admin.blog.update(editor.id, payload)
        : await API.admin.blog.create(payload);

      if (coverFile) {
        const form = new FormData();
        form.append('file', coverFile);
        await API.admin.blog.cover(post.id, form);
      }

      showToast(editor.id ? 'Đã cập nhật bài blog' : 'Đã lưu bài blog', 'success');
      resetEditor();
      load();
    } catch (err: any) {
      showToast(err?.message || 'Không lưu được bài', 'error');
    } finally {
      setSaving(false);
    }
  }

  /** Upload an illustration and splice its markdown in at the caret. */
  async function insertInlineImage(file: File, input: HTMLInputElement) {
    const textarea = contentRef.current;
    if (!textarea) return;

    const caret = textarea.selectionStart;
    setImageStatus('Đang tải ảnh...');
    input.disabled = true;

    try {
      const form = new FormData();
      form.append('file', file);
      const { markdown } = await API.admin.blog.image(form);

      const before = editor.content.slice(0, caret);
      const after = editor.content.slice(caret);
      const prefix = before && !before.endsWith('\n') ? '\n\n' : '';
      const suffix = after && !after.startsWith('\n') ? '\n\n' : '';
      const inserted = `${prefix}${markdown}${suffix}`;

      setEditor((e) => ({ ...e, content: before + inserted + after }));
      setImageStatus(`Đã chèn ${file.name}`);
      showToast('Đã tải và chèn ảnh minh họa', 'success');
    } catch (err: any) {
      setImageStatus('');
      showToast(err?.message || 'Không tải được ảnh minh họa', 'error');
    } finally {
      input.disabled = false;
      input.value = '';
    }
  }

  async function uploadCover(postId: string, input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    try {
      await API.admin.blog.cover(postId, form);
      showToast('Đã cập nhật ảnh bìa', 'success');
      load();
    } catch (err: any) {
      showToast(err?.message || 'Không tải được ảnh bìa', 'error');
    } finally {
      input.value = '';
    }
  }

  async function changeStatus(postId: string, status: string) {
    try {
      await API.admin.blog.status(postId, status);
      showToast('Đã cập nhật blog', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Không cập nhật được blog', 'error');
      load();
    }
  }

  async function archive(postId: string) {
    if (!confirm('Lưu trữ bài viết này?')) return;
    try {
      await API.admin.blog.remove(postId);
      showToast('Đã lưu trữ', 'success');
      load();
    } catch (err: any) {
      showToast(err?.message || 'Không lưu trữ được', 'error');
    }
  }

  function toggleProduct(id: number, checked: boolean) {
    setSelectedProductIds((list) =>
      checked ? [...new Set([...list, id])] : list.filter((x) => x !== id),
    );
  }

  return (
    <>
      <div className="page-head" style={{ marginBottom: 22 }}>
        <h1>Blog</h1>
        <p>Soạn bài viết, gắn sản phẩm đề xuất và quản lý trạng thái xuất bản</p>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h3>{editor.id ? 'Sửa bài viết' : 'Bài viết mới'}</h3>
          {editor.id && (
            <button className="act-btn" onClick={resetEditor}>
              Huỷ sửa
            </button>
          )}
        </div>

        <div style={{ padding: 16 }}>
          <div className="form-group">
            <label className="form-label">Tiêu đề</label>
            <input
              ref={titleRef}
              className="form-input"
              value={editor.title}
              onChange={(e) => setEditor((s) => ({ ...s, title: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Mô tả ngắn</label>
            <input
              className="form-input"
              value={editor.excerpt}
              onChange={(e) => setEditor((s) => ({ ...s, excerpt: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Nội dung (Markdown)</label>
            <textarea
              ref={contentRef}
              className="form-input"
              rows={12}
              placeholder="Nội dung Markdown. Đặt con trỏ tại vị trí cần chèn ảnh rồi bấm nút bên dưới."
              style={{ resize: 'vertical' }}
              value={editor.content}
              onChange={(e) => setEditor((s) => ({ ...s, content: e.target.value }))}
            />
            <div className="blog-inline-image">
              <label className="act-btn">
                ＋ Chèn ảnh vào nội dung
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) insertInlineImage(file, e.target);
                  }}
                />
              </label>
              <span className="admin-cell-sub">{imageStatus}</span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Ảnh bìa</label>
            <div className="blog-inline-image">
              <label className="act-btn">
                Chọn ảnh bìa
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setCoverFile(file);
                    setCoverHint(file?.name ?? 'Chưa chọn ảnh bìa');
                  }}
                />
              </label>
              <span className="admin-cell-sub">{coverHint}</span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Sản phẩm đề xuất</label>
            <input
              className="form-input"
              placeholder="Tìm sản phẩm..."
              style={{ maxWidth: 320, marginBottom: 10 }}
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
            />
            {visibleProducts.length === 0 ? (
              <div className="admin-empty-line">Không tìm thấy sản phẩm nào.</div>
            ) : (
              <div className="blog-product-picker">
                {visibleProducts.map((product) => {
                  const selected = selectedProductIds.includes(product.id);
                  const unpublished = product.status !== 'published';
                  return (
                    <label
                      key={product.id}
                      className={`blog-product-option${selected ? ' selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={unpublished}
                        onChange={(e) => toggleProduct(product.id, e.target.checked)}
                      />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="blog-product-head">
                          <div className="blog-product-name">{product.name}</div>
                          <div className="blog-product-price">{formatPrice(product.price)}</div>
                        </div>
                        <div className="blog-product-meta">
                          {product.col} · {product.age}
                          {unpublished ? ` · ${product.status}` : ''}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <button className="btn btn-primary" disabled={saving} onClick={save}>
            {saving ? 'Đang lưu...' : editor.id ? 'Lưu thay đổi' : '+ Lưu bài mới'}
          </button>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h3>Danh sách bài viết</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Ảnh bìa</th>
                <th>Tiêu đề</th>
                <th>Slug</th>
                <th>Sản phẩm</th>
                <th>Trạng thái</th>
                <th>Cập nhật</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {state === 'loading' && (
                <tr>
                  <td colSpan={7} className="admin-cell-empty">
                    Đang tải...
                  </td>
                </tr>
              )}
              {state === 'error' && (
                <tr>
                  <td colSpan={7} className="admin-cell-error">
                    {error}
                  </td>
                </tr>
              )}
              {state === 'ready' && posts.length === 0 && (
                <tr>
                  <td colSpan={7} className="admin-cell-empty">
                    Chưa có bài.
                  </td>
                </tr>
              )}

              {posts.map((post) => (
                <tr key={post.id}>
                  <td>
                    <label className="blog-cover-cell" title="Thay ảnh bìa">
                      {post.coverAsset?.url ? (
                        <img src={post.coverAsset.url} alt="" />
                      ) : (
                        <span className="act-btn">＋ Ảnh bìa</span>
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        hidden
                        onChange={(e) => uploadCover(post.id, e.target)}
                      />
                    </label>
                  </td>
                  <td style={{ fontWeight: 700 }}>{post.title}</td>
                  <td style={{ fontSize: '.78rem' }}>{post.slug}</td>
                  <td style={{ fontSize: '.78rem', color: 'var(--ink-3)' }}>
                    {post.recommendedProductIds?.length
                      ? `${post.recommendedProductIds.length} sản phẩm`
                      : '—'}
                  </td>
                  <td>
                    <select
                      className="admin-mini-select"
                      defaultValue={post.status}
                      onChange={(e) => changeStatus(post.id, e.target.value)}
                    >
                      {STATUSES.map((s) => (
                        <option value={s} key={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="admin-cell-sub">
                    {new Date(post.updatedAt).toLocaleDateString('vi-VN')}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <div className="admin-inline-actions">
                      <button className="act-btn" onClick={() => startEdit(post)}>
                        Sửa
                      </button>
                      <button className="act-btn act-del" onClick={() => archive(post.id)}>
                        Lưu trữ
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
