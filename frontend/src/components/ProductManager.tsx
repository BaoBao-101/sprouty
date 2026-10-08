import { useState } from 'react';
import { ProductEditor, type AdminProduct } from './ProductEditor';
import { VideoPanel } from './VideoPanel';
import { useAuth } from '@/contexts/AuthContext';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import { formatPrice } from '@/types/product';
import { AdminIcon } from '@/components/icons/AdminIcon';
import {
  FilterPills,
  Modal,
  PageHeader,
  Pagination,
  Panel,
  Pill,
  SearchBox,
  StatCard,
  StatGrid,
  TableStates,
  Toolbar,
  type FilterOption,
} from '@/components/admin/ui';
import { usePagedList } from '@/components/admin/usePagedList';

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

const STATUS_TONE: Record<string, string> = {
  published: 'green',
  draft: 'amber',
  archived: 'grey',
};

const CATEGORY_LABEL: Record<string, string> = {
  kit: 'Kit trồng cây',
  book: 'Hướng dẫn chăm cây',
  membership: 'Gói thành viên',
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
        `Xoá sản phẩm “${product.name}”?\n\nNếu sản phẩm đã có trong đơn hàng, nó sẽ được chuyển sang Lưu trữ thay vì xoá hẳn.`,
      )
    )
      return;

    setDeleting(true);
    try {
      const result = await API.admin.products.remove(product.id);
      showToast(result.message || 'Đã xoá sản phẩm', 'success');
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
          <div className="prod-img prod-img-fallback">
            {product.emoji || <AdminIcon name="products" size={20} />}
          </div>
        ) : (
          <img className="prod-img" src={firstImage} alt="" onError={() => setImageFailed(true)} />
        )}
      </td>

      <td>
        <div style={{ fontWeight: 600 }}>{product.name}</div>
        <div className="admin-cell-sub">
          #{product.id}
          {product.collection ? ` · ${product.collection}` : ''}
          {product.speciesKey ? ` · giống ${product.speciesKey}` : ''}
        </div>
      </td>

      <td style={{ fontSize: '.82rem' }}>
        {CATEGORY_LABEL[product.category] ?? product.category}
      </td>

      <td className="ad-num">
        <div className="admin-money">{formatPrice(product.price)}</div>
        {!!product.oldPrice && product.oldPrice > product.price && (
          <div className="prod-old-price">{formatPrice(product.oldPrice)}</div>
        )}
      </td>

      <td style={{ fontSize: '.82rem' }}>{product.ageRange || '—'}</td>

      <td>
        <Pill tone={STATUS_TONE[product.status] ?? 'grey'}>
          {STATUS_LABEL[product.status] ?? product.status}
        </Pill>
      </td>

      <td>
        <div className="ad-row-actions">
          {canEdit && (
            <button className="ad-icon-btn" onClick={onEdit} title="Sửa sản phẩm" aria-label="Sửa sản phẩm">
              <AdminIcon name="edit" size={16} />
            </button>
          )}
          <button className="ad-icon-btn" onClick={onVideos} title="Video hướng dẫn" aria-label="Video hướng dẫn">
            <AdminIcon name="video" size={16} />
          </button>
          {canEdit && (
            <button
              className="ad-icon-btn danger"
              onClick={remove}
              disabled={deleting}
              title="Xoá sản phẩm"
              aria-label="Xoá sản phẩm"
            >
              <AdminIcon name="trash" size={16} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export function ProductManager() {
  const { isAdmin } = useAuth();

  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [videoFor, setVideoFor] = useState<AdminProduct | null>(null);

  const {
    items: products,
    state,
    error,
    page,
    pages,
    total,
    counts,
    raw,
    setPage,
    reload: load,
  } = usePagedList<AdminProduct>(
    (params) => API.admin.products.list(params),
    'products',
    { status, category, search: search.trim() },
    { errorText: 'Không tải được sản phẩm.' },
  );

  const published = counts.published || 0;
  const draft = counts.draft || 0;
  const archived = counts.archived || 0;
  const all = published + draft + archived;

  const statusFilters: Array<FilterOption<string>> = [
    { value: '', label: 'Tất cả', count: all },
    { value: 'published', label: 'Đang bán', count: published },
    { value: 'draft', label: 'Bản nháp', count: draft },
    { value: 'archived', label: 'Lưu trữ', count: archived },
  ];

  // Offered from what the catalogue actually contains, so a category nobody
  // uses does not sit there as a filter that always returns nothing.
  const categories: Array<{ value: string; count: number }> = raw?.categories || [];

  const filtering = Boolean(status || category || search.trim());

  return (
    <>
      <PageHeader
        title="Sản phẩm"
        subtitle={
          isAdmin
            ? 'Thêm, sửa và quản lý catalog sản phẩm bán trên web'
            : 'Xem catalog và quản lý video hướng dẫn'
        }
        actions={
          isAdmin && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setEditing(null);
                setEditorOpen(true);
              }}
            >
              <AdminIcon name="plus" size={17} />
              Thêm sản phẩm
            </button>
          )
        }
      />

      <StatGrid>
        <StatCard
          icon={<AdminIcon name="products" />}
          tone="orange"
          loading={state === 'loading'}
          value={all}
          label="Tổng sản phẩm"
        />
        <StatCard
          icon={<AdminIcon name="check" />}
          tone="green"
          loading={state === 'loading'}
          value={published}
          label="Đang bán"
          hint="Khách nhìn thấy trên shop"
        />
        <StatCard
          icon={<AdminIcon name="edit" />}
          tone="amber"
          loading={state === 'loading'}
          value={draft}
          label="Bản nháp"
          hint="Chưa lên shop"
        />
        <StatCard
          icon={<AdminIcon name="layers" />}
          tone="blue"
          loading={state === 'loading'}
          value={archived}
          label="Lưu trữ"
        />
      </StatGrid>

      {!isAdmin && (
        <div className="panel-note" style={{ marginBottom: 16 }}>
          Chỉ quản trị viên mới thêm, sửa hoặc xoá được sản phẩm. Bạn vẫn quản lý được video hướng
          dẫn của từng sản phẩm.
        </div>
      )}

      <Toolbar>
        <FilterPills options={statusFilters} value={status} onChange={setStatus} />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {categories.length > 1 && (
            <select
              className="form-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Lọc theo danh mục"
              style={{ height: 38 }}
            >
              <option value="">Mọi danh mục</option>
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {CATEGORY_LABEL[c.value] ?? c.value} ({c.count})
                </option>
              ))}
            </select>
          )}
          <SearchBox
            value={search}
            placeholder="Tìm theo tên, mô tả hoặc giống cây…"
            onChange={setSearch}
          />
        </div>
      </Toolbar>

      <Panel flush>
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: 72 }}>Ảnh</th>
              <th>Sản phẩm</th>
              <th>Danh mục</th>
              <th className="ad-num">Giá</th>
              <th>Độ tuổi</th>
              <th>Trạng thái</th>
              <th style={{ width: 118 }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <TableStates
              state={state}
              error={error}
              isEmpty={products.length === 0}
              columns={7}
              emptyIcon={<AdminIcon name="products" size={24} />}
              emptyTitle={filtering ? 'Không tìm thấy sản phẩm nào' : 'Chưa có sản phẩm'}
              emptyHint={
                filtering
                  ? 'Thử bỏ bộ lọc hoặc đổi từ khoá.'
                  : isAdmin
                    ? 'Bấm “Thêm sản phẩm” để tạo sản phẩm đầu tiên.'
                    : undefined
              }
              onRetry={load}
            />

            {state === 'ready' &&
              products.map((product) => (
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

        <Pagination page={page} pages={pages} total={total} unit="sản phẩm" onChange={setPage} />
      </Panel>

      {editorOpen && isAdmin && (
        <ProductEditor
          editing={editing}
          collections={raw?.collections || []}
          onClose={() => setEditorOpen(false)}
          onSaved={load}
        />
      )}

      {/* Standalone video manager, for employees who cannot open the editor. */}
      {videoFor && (
        <Modal
          title="Video hướng dẫn"
          subtitle={videoFor.name}
          width={760}
          onClose={() => setVideoFor(null)}
          footer={
            <button className="btn btn-ghost" onClick={() => setVideoFor(null)}>
              Đóng
            </button>
          }
        >
          <VideoPanel productId={videoFor.id} productName={videoFor.name} />
        </Modal>
      )}
    </>
  );
}
