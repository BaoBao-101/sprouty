import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FilterPills,
  Modal,
  PageHeader,
  Panel,
  Pill,
  Pagination,
  SearchBox,
  StatCard,
  StatGrid,
  TableStates,
  Toolbar,
  type FilterOption,
  type LoadState,
} from '@/components/admin/ui';
import { API } from '@/services/api';
import { normalizeProduct } from '@/services/products';
import { showToast } from '@/services/toast';
import { formatPrice, type Product } from '@/types/product';
import { AdminIcon } from '@/components/icons/AdminIcon';
import { usePagedList } from '@/components/admin/usePagedList';

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

const STATUS_LABEL: Record<string, string> = {
  draft: 'Bản nháp',
  published: 'Đã xuất bản',
  archived: 'Lưu trữ',
};

const STATUS_TONE: Record<string, string> = {
  draft: 'amber',
  published: 'green',
  archived: 'grey',
};

const EMPTY_EDITOR = { id: '', title: '', excerpt: '', content: '' };

type Filter = '' | 'draft' | 'published' | 'archived';

export default function BlogAdmin() {
  const [filter, setFilter] = useState<Filter>('');
  const [search, setSearch] = useState('');

  // Server-paged: the list used to be the first 200 rows, filtered in the
  // browser, so an older post could not be reached or searched for.
  const {
    items: posts,
    state,
    error,
    page,
    pages,
    total,
    counts,
    setPage,
    reload: load,
  } = usePagedList<Post>(
    (params) => API.admin.blog.list(params),
    'posts',
    { status: filter, search: search.trim() },
    { errorText: 'Không tải được bài viết.' },
  );

  const [products, setProducts] = useState<Product[]>([]);
  const [productQuery, setProductQuery] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editor, setEditor] = useState(EMPTY_EDITOR);
  const [existingCover, setExistingCover] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [imageStatus, setImageStatus] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const contentRef = useRef<HTMLTextAreaElement>(null);


  useEffect(() => {
    API.admin.products
      .list()
      .then((data: any) => setProducts((data.products || []).map(normalizeProduct)))
      .catch(() => setProducts([]));
  }, []);

  // A blob URL leaks until it is revoked, and a new one is made per pick.
  useEffect(() => {
    if (!coverFile) return setCoverPreview(null);
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  const visibleProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      `${p.name} ${p.col} ${p.age} ${p.desc}`.toLowerCase().includes(q),
    );
  }, [products, productQuery]);

  function openEditor(post?: Post) {
    setEditor(
      post
        ? {
            id: post.id,
            title: post.title || '',
            excerpt: post.excerpt || '',
            content: post.content || '',
          }
        : EMPTY_EDITOR,
    );
    setExistingCover(post?.coverAsset?.url ?? null);
    setSelectedProductIds(post?.recommendedProductIds?.slice() ?? []);
    setCoverFile(null);
    setProductQuery('');
    setImageStatus('');
    setFormError('');
    setEditorOpen(true);
  }

  async function save() {
    setFormError('');
    if (editor.title.trim().length < 3) return setFormError('Tiêu đề phải có ít nhất 3 ký tự.');
    if (!editor.content.trim()) return setFormError('Bài viết chưa có nội dung.');

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
      setEditorOpen(false);
      load();
    } catch (err: any) {
      setFormError(err?.message || 'Không lưu được bài');
    } finally {
      setSaving(false);
    }
  }

  /** Upload an illustration and splice its markdown in at the caret. */
  async function insertInlineImage(file: File, input: HTMLInputElement) {
    const textarea = contentRef.current;
    if (!textarea) return;

    const caret = textarea.selectionStart;
    setImageStatus('Đang tải ảnh…');
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
      showToast(`Đã chuyển sang “${STATUS_LABEL[status]}”`, 'success');
      // Reload rather than patch the row in place: with a status filter on,
      // the post has just left the list it is sitting in.
      load();
    } catch (err: any) {
      showToast(err?.message || 'Không cập nhật được blog', 'error');
      load();
    }
  }

  async function archive(post: Post) {
    if (!confirm(`Lưu trữ bài “${post.title}”?\n\nBài sẽ không còn hiện trên trang blog.`)) return;
    try {
      await API.admin.blog.remove(post.id);
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


  const filters: Array<FilterOption<Filter>> = [
    { value: '', label: 'Tất cả', count: posts.length },
    { value: 'published', label: 'Đã xuất bản', count: counts.published },
    { value: 'draft', label: 'Bản nháp', count: counts.draft },
    { value: 'archived', label: 'Lưu trữ', count: counts.archived },
  ];

  return (
    <>
      <PageHeader
        title="Blog"
        subtitle="Soạn bài viết, gắn sản phẩm đề xuất và quản lý trạng thái xuất bản"
        actions={
          <button className="btn btn-primary" onClick={() => openEditor()}>
            + Viết bài mới
          </button>
        }
      />

      <StatGrid>
        <StatCard
          icon={<AdminIcon name="blog" />}
          tone="orange"
          loading={state === 'loading'}
          value={posts.length}
          label="Tổng bài viết"
        />
        <StatCard
          icon={<AdminIcon name="eye" />}
          tone="green"
          loading={state === 'loading'}
          value={counts.published || 0}
          label="Đang hiển thị"
        />
        <StatCard
          icon={<AdminIcon name="edit" />}
          tone="amber"
          loading={state === 'loading'}
          value={counts.draft || 0}
          label="Bản nháp"
        />
      </StatGrid>

      <Toolbar>
        <FilterPills options={filters} value={filter} onChange={(next) => setFilter(next)} />
        <SearchBox value={search} placeholder="Tìm theo tiêu đề hoặc slug…" onChange={setSearch} />
      </Toolbar>

      <Panel flush>
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: 90 }}>Ảnh bìa</th>
              <th>Bài viết</th>
              <th>Sản phẩm</th>
              <th>Trạng thái</th>
              <th>Cập nhật</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <TableStates
              state={state}
              error={error}
              isEmpty={posts.length === 0}
              columns={6}
              emptyIcon={<AdminIcon name="blog" size={24} />}
              emptyTitle={search || filter ? 'Không tìm thấy bài nào' : 'Chưa có bài viết'}
              emptyHint={
                search || filter
                  ? 'Thử bỏ bộ lọc hoặc đổi từ khoá.'
                  : 'Bấm “Viết bài mới” để đăng bài đầu tiên.'
              }
              onRetry={load}
            />
            {state === 'ready' &&
              posts.map((post) => (
                <tr key={post.id}>
                  <td>
                    <label className="blog-cover-cell" title="Thay ảnh bìa">
                      {post.coverAsset?.url ? (
                        <img src={post.coverAsset.url} alt="" />
                      ) : (
                        <span className="blog-cover-empty">＋</span>
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        hidden
                        onChange={(e) => uploadCover(post.id, e.target)}
                      />
                    </label>
                  </td>
                  <td>
                    <div className="ad-cell-main">{post.title}</div>
                    <div className="ad-cell-sub">/{post.slug}</div>
                  </td>
                  <td className="ad-cell-sub">
                    {post.recommendedProductIds?.length
                      ? `${post.recommendedProductIds.length} sản phẩm`
                      : '—'}
                  </td>
                  <td>
                    <select
                      className="admin-mini-select"
                      value={post.status}
                      onChange={(e) => changeStatus(post.id, e.target.value)}
                    >
                      {STATUSES.map((s) => (
                        <option value={s} key={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="ad-cell-sub">
                    {new Date(post.updatedAt).toLocaleDateString('vi-VN')}
                  </td>
                  <td>
                    <div className="admin-inline-actions">
                      <button className="act-btn act-edit" onClick={() => openEditor(post)}>
                        Sửa
                      </button>
                      {post.status !== 'archived' && (
                        <button className="act-btn act-del" onClick={() => archive(post)}>
                          Lưu trữ
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>

        <Pagination page={page} pages={pages} total={total} unit="bài viết" onChange={setPage} />
      </Panel>

      {editorOpen && (
        <Modal
          title={editor.id ? 'Sửa bài viết' : 'Viết bài mới'}
          subtitle={
            editor.id
              ? 'Thay đổi được lưu ngay khi bấm Lưu'
              : 'Bài mới được lưu ở trạng thái Bản nháp'
          }
          width={860}
          onClose={() => setEditorOpen(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setEditorOpen(false)}>
                Hủy
              </button>
              <button className="btn btn-primary" disabled={saving} onClick={save}>
                {saving ? 'Đang lưu…' : editor.id ? 'Lưu thay đổi' : 'Lưu bản nháp'}
              </button>
            </>
          }
        >
          <label className="field">
            <span className="field-label">
              Tiêu đề <span className="req">*</span>
            </span>
            <input
              className="form-input"
              placeholder="VD: 5 loại cây dễ trồng cho bé mới bắt đầu"
              value={editor.title}
              onChange={(e) => setEditor((s) => ({ ...s, title: e.target.value }))}
            />
          </label>

          <label className="field">
            <span className="field-label">Mô tả ngắn</span>
            <input
              className="form-input"
              placeholder="Một câu tóm tắt, hiện ở trang danh sách blog"
              value={editor.excerpt}
              onChange={(e) => setEditor((s) => ({ ...s, excerpt: e.target.value }))}
            />
            <span className="field-hint">{editor.excerpt.length}/200 ký tự khuyến nghị</span>
          </label>

          <label className="field">
            <span className="field-label">
              Nội dung (Markdown) <span className="req">*</span>
            </span>
            <textarea
              ref={contentRef}
              className="form-input blog-content"
              rows={14}
              placeholder="Nội dung Markdown. Đặt con trỏ tại vị trí cần chèn ảnh rồi bấm nút bên dưới."
              value={editor.content}
              onChange={(e) => setEditor((s) => ({ ...s, content: e.target.value }))}
            />
            <div className="blog-inline-image">
              <label className="act-btn act-edit">
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
              <span className="ad-cell-sub">
                {imageStatus || `${editor.content.length.toLocaleString('vi-VN')} ký tự`}
              </span>
            </div>
          </label>

          <div className="field">
            <span className="field-label">Ảnh bìa</span>
            <div className="blog-cover-pick">
              <div className="blog-cover-preview">
                {coverPreview || existingCover ? (
                  <img src={coverPreview || existingCover || ''} alt="" />
                ) : (
                  <AdminIcon name="images" size={20} />
                )}
              </div>
              <div>
                <label className="act-btn act-edit">
                  {coverFile || existingCover ? 'Đổi ảnh bìa' : 'Chọn ảnh bìa'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                <div className="field-hint" style={{ marginTop: 6 }}>
                  {coverFile?.name ||
                    (existingCover ? 'Đang dùng ảnh bìa hiện tại' : 'Chưa chọn ảnh bìa')}
                </div>
              </div>
            </div>
          </div>

          <div className="field">
            <span className="field-label">
              Sản phẩm đề xuất
              {selectedProductIds.length > 0 && (
                <span className="editor-step-badge" style={{ marginLeft: 8 }}>
                  {selectedProductIds.length}
                </span>
              )}
            </span>
            <span className="field-hint" style={{ marginBottom: 8 }}>
              Hiện ở cuối bài viết. Chỉ chọn được sản phẩm đang bán.
            </span>
            <input
              className="form-input"
              placeholder="Tìm sản phẩm…"
              style={{ marginBottom: 10 }}
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
            />
            {visibleProducts.length === 0 ? (
              <div className="panel-empty">Không tìm thấy sản phẩm nào.</div>
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
                          {unpublished && (
                            <>
                              {' · '}
                              <Pill tone="grey">{STATUS_LABEL[product.status] ?? product.status}</Pill>
                            </>
                          )}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {formError && <div className="form-error">{formError}</div>}
        </Modal>
      )}
    </>
  );
}
