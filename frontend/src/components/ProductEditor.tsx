import { useMemo, useState, type FormEvent } from 'react';
import { VideoPanel } from './VideoPanel';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import { formatPrice } from '@/types/product';

export interface AdminProduct {
  id: number;
  name: string;
  description: string;
  price: number;
  oldPrice?: number | null;
  smartPriceDelta?: number | null;
  category: 'kit' | 'book';
  ageRange: string;
  collection: string;
  emoji?: string;
  badge?: string | null;
  bgColor?: string;
  images?: string[];
  includes?: string[];
  status: 'published' | 'draft' | 'archived';
}

type TabKey = 'basic' | 'pricing' | 'images' | 'includes' | 'videos';

const TABS: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: 'basic', label: 'Thông tin', icon: '📝' },
  { key: 'pricing', label: 'Giá & nhãn', icon: '💰' },
  { key: 'images', label: 'Hình ảnh', icon: '🖼' },
  { key: 'includes', label: 'Trong hộp', icon: '📦' },
  { key: 'videos', label: 'Video', icon: '🎬' },
];

const BADGES = [
  { value: '', label: 'Không có nhãn' },
  { value: 'hot', label: '🔥 Bán chạy' },
  { value: 'new', label: '✨ Mới' },
  { value: 'sale', label: '🏷 Giảm giá' },
];

const STATUSES = [
  { value: 'published', label: 'Đang bán', hint: 'Hiện trên cửa hàng cho khách' },
  { value: 'draft', label: 'Bản nháp', hint: 'Chỉ nhân viên thấy, khách không thấy' },
  { value: 'archived', label: 'Lưu trữ', hint: 'Ngừng bán, giữ lại cho lịch sử đơn' },
];

const EMPTY: FormState = {
  name: '',
  category: 'kit',
  ageRange: '',
  collection: '',
  description: '',
  price: '',
  oldPrice: '',
  smartPriceDelta: '',
  emoji: '',
  badge: '',
  status: 'published',
  images: [''],
  includes: [''],
};

interface FormState {
  name: string;
  category: string;
  ageRange: string;
  collection: string;
  description: string;
  price: string;
  oldPrice: string;
  smartPriceDelta: string;
  emoji: string;
  badge: string;
  status: string;
  images: string[];
  includes: string[];
}

function toForm(product: AdminProduct): FormState {
  return {
    name: product.name,
    category: product.category,
    ageRange: product.ageRange,
    collection: product.collection,
    description: product.description,
    price: String(product.price),
    oldPrice: product.oldPrice ? String(product.oldPrice) : '',
    smartPriceDelta: product.smartPriceDelta ? String(product.smartPriceDelta) : '',
    emoji: product.emoji || '',
    badge: product.badge || '',
    status: product.status,
    images: product.images?.length ? [...product.images] : [''],
    includes: product.includes?.length ? [...product.includes] : [''],
  };
}

function ImageRow({
  value,
  onChange,
  onRemove,
  canRemove,
}: {
  value: string;
  onChange: (next: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const trimmed = value.trim();

  return (
    <div className="repeat-row">
      <div className="repeat-preview">
        {trimmed && !broken ? (
          <img src={trimmed} alt="" onError={() => setBroken(true)} />
        ) : (
          <span>{trimmed ? '⚠️' : '🖼'}</span>
        )}
      </div>
      <input
        className="form-input"
        placeholder="/assets/images/products/ten-anh.png"
        value={value}
        onChange={(e) => {
          setBroken(false);
          onChange(e.target.value);
        }}
      />
      <button
        type="button"
        className="repeat-remove"
        onClick={onRemove}
        disabled={!canRemove}
        title="Bỏ ảnh này"
      >
        ✕
      </button>
    </div>
  );
}

export function ProductEditor({
  editing,
  onClose,
  onSaved,
}: {
  editing: AdminProduct | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  // After creating, the modal stays open in edit mode so videos can be added
  // straight away — a video needs a product id to attach to.
  const [product, setProduct] = useState<AdminProduct | null>(editing);
  const [form, setForm] = useState<FormState>(() => (editing ? toForm(editing) : EMPTY));
  const [tab, setTab] = useState<TabKey>('basic');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof FormState>(key: K) => (value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const price = parseInt(form.price, 10) || 0;
  const oldPrice = parseInt(form.oldPrice, 10) || 0;
  const smartDelta = parseInt(form.smartPriceDelta, 10) || 0;
  const discount = oldPrice > price && price > 0 ? Math.round((1 - price / oldPrice) * 100) : 0;

  const imageCount = form.images.filter((u) => u.trim()).length;
  const includeCount = form.includes.filter((i) => i.trim()).length;

  /** Which tab a missing required field lives on, so we can jump there. */
  const problem = useMemo((): { tab: TabKey; message: string } | null => {
    if (form.name.trim().length < 2) return { tab: 'basic', message: 'Tên sản phẩm phải có ít nhất 2 ký tự.' };
    if (form.ageRange.trim().length < 2) return { tab: 'basic', message: 'Độ tuổi phải có ít nhất 2 ký tự.' };
    if (form.collection.trim().length < 2) return { tab: 'basic', message: 'Bộ sưu tập phải có ít nhất 2 ký tự.' };
    if (form.description.trim().length < 10) return { tab: 'basic', message: 'Mô tả phải có ít nhất 10 ký tự.' };
    if (!price) return { tab: 'pricing', message: 'Nhập giá bán lớn hơn 0.' };
    if (oldPrice && oldPrice <= price) return { tab: "pricing", message: "Giá trước giảm phải lớn hơn giá bán." };
    return null;
  }, [form, price, oldPrice]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (problem) {
      setTab(problem.tab);
      setError(problem.message);
      return;
    }

    setBusy(true);
    const payload = {
      name: form.name.trim(),
      category: form.category,
      ageRange: form.ageRange.trim(),
      collection: form.collection.trim(),
      description: form.description.trim(),
      price,
      oldPrice: oldPrice || null,
      smartPriceDelta: smartDelta || null,
      emoji: form.emoji.trim() || '🎨',
      badge: form.badge || null,
      images: form.images.map((u) => u.trim()).filter(Boolean),
      includes: form.includes.map((i) => i.trim()).filter(Boolean),
      status: form.status,
    };

    try {
      if (product) {
        const { product: updated } = await API.admin.products.update(product.id, payload);
        setProduct(updated);
        showToast('Đã cập nhật sản phẩm', 'success');
        onSaved();
        onClose();
      } else {
        const { product: created } = await API.admin.products.create(payload);
        setProduct(created);
        onSaved();
        showToast('Đã tạo sản phẩm — giờ có thể thêm video hướng dẫn', 'success');
        setTab('videos');
      }
    } catch (err: any) {
      setError(err?.message || 'Lỗi lưu sản phẩm');
    } finally {
      setBusy(false);
    }
  }

  // A tick marks a section whose required fields are filled in; the other two
  // sections are optional, so they show how many entries they hold instead.
  const basicOk = !problem || problem.tab !== 'basic';
  const pricingOk = price > 0 && (!problem || problem.tab !== 'pricing');
  const tabBadge: Partial<Record<TabKey, string>> = {
    basic: basicOk ? '✓' : undefined,
    pricing: pricingOk ? '✓' : undefined,
    images: imageCount ? String(imageCount) : undefined,
    includes: includeCount ? String(includeCount) : undefined,
  };

  return (
    <div
      className="adm-modal open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="adm-modal-box editor-box">
        <div className="editor-head">
          <div>
            <h2 className="adm-modal-title" style={{ margin: 0 }}>
              {product ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}
            </h2>
            <p className="editor-sub">
              {product ? product.name : 'Điền thông tin rồi lưu để thêm video hướng dẫn'}
            </p>
          </div>
          <button className="adm-modal-close" onClick={onClose} aria-label="Đóng">
            ✕
          </button>
        </div>

        <form className="editor-form" onSubmit={submit}>
          <div className="editor-main">
            {/* A vertical rail rather than a tab strip: five labels never fit on
                one row inside the dialog, and wrapping or truncating them both
                looked broken. Below 720px it lays back down as a scrolling row. */}
            <nav className="editor-rail" aria-label="Phần thông tin sản phẩm">
              {TABS.map((t) => {
                const locked = t.key === 'videos' && !product;
                return (
                  <button
                    key={t.key}
                    type="button"
                    className={`editor-step${tab === t.key ? ' active' : ''}${locked ? ' locked' : ''}`}
                    disabled={locked}
                    aria-current={tab === t.key ? 'true' : undefined}
                    title={locked ? 'Lưu sản phẩm trước để thêm video' : undefined}
                    onClick={() => setTab(t.key)}
                  >
                    <span className="editor-step-icon">{locked ? '🔒' : t.icon}</span>
                    <span className="editor-step-label">{t.label}</span>
                    {tabBadge[t.key] && <span className="editor-step-badge">{tabBadge[t.key]}</span>}
                  </button>
                );
              })}
            </nav>

            <div className="editor-body">
            {tab === 'basic' && (
              <>
                <label className="field">
                  <span className="field-label">
                    Tên sản phẩm <span className="req">*</span>
                  </span>
                  <input
                    className="form-input"
                    value={form.name}
                    onChange={(e) => set('name')(e.target.value)}
                    placeholder="VD: Bean"
                  />
                </label>

                <div className="field-grid">
                  <label className="field">
                    <span className="field-label">
                      Danh mục <span className="req">*</span>
                    </span>
                    <select
                      className="form-input"
                      value={form.category}
                      onChange={(e) => set('category')(e.target.value)}
                    >
                      <option value="kit">Kit trồng cây</option>
                      <option value="book">Hướng dẫn chăm cây</option>
                    </select>
                  </label>

                  <label className="field">
                    <span className="field-label">
                      Độ tuổi <span className="req">*</span>
                    </span>
                    <input
                      className="form-input"
                      placeholder="VD: 4–10 tuổi"
                      value={form.ageRange}
                      onChange={(e) => set('ageRange')(e.target.value)}
                    />
                  </label>
                </div>

                <label className="field">
                  <span className="field-label">
                    Bộ sưu tập <span className="req">*</span>
                  </span>
                  <input
                    className="form-input"
                    placeholder="VD: Sprouty Starter"
                    value={form.collection}
                    onChange={(e) => set('collection')(e.target.value)}
                  />
                  <span className="field-hint">Nhóm sản phẩm lại với nhau trên cửa hàng</span>
                </label>

                <label className="field">
                  <span className="field-label">
                    Mô tả <span className="req">*</span>
                  </span>
                  <textarea
                    className="form-input"
                    rows={4}
                    style={{ resize: 'vertical' }}
                    placeholder="Mô tả ngắn gọn sản phẩm dành cho ai và có gì đặc biệt"
                    value={form.description}
                    onChange={(e) => set('description')(e.target.value)}
                  />
                  <span className="field-hint">
                    {form.description.trim().length}/10 ký tự tối thiểu
                  </span>
                </label>
              </>
            )}

            {tab === 'pricing' && (
              <>
                <div className="field-grid">
                  {/* "Giá gốc" read as a cost/wholesale price, and "giá gạch ngang" reads as
                      the discounted one. "Giá trước giảm" cannot be taken for either. */}
                  <label className="field">
                    <span className="field-label">
                      Giá bán (đ) <span className="req">*</span>
                    </span>
                    <input
                      className="form-input"
                      type="number"
                      min={1000}
                      value={form.price}
                      onChange={(e) => set('price')(e.target.value)}
                    />
                    <span className="field-hint">
                      {price ? `Số tiền khách thực trả: ${formatPrice(price)}` : 'Số tiền khách thực trả'}
                    </span>
                  </label>

                  <label className="field">
                    <span className="field-label">Giá trước giảm (đ)</span>
                    <input
                      className="form-input"
                      type="number"
                      min={1000}
                      value={form.oldPrice}
                      onChange={(e) => set('oldPrice')(e.target.value)}
                    />
                    <span className="field-hint">
                      {discount
                        ? `Hiện gạch ngang, gắn nhãn −${discount}%`
                        : 'Giá niêm yết cũ, hiện gạch ngang cạnh giá bán. Để trống nếu không giảm giá.'}
                    </span>
                  </label>
                </div>

                {/* Both numbers side by side, exactly as the shop renders them —
                    cheaper to read than re-deriving it from two input boxes. */}
                {price > 0 && (
                  <div className="price-preview">
                    <span className="price-preview-label">Khách sẽ thấy</span>
                    <span className="price-preview-now">{formatPrice(price)}</span>
                    {oldPrice > price && (
                      <>
                        <span className="price-preview-old">{formatPrice(oldPrice)}</span>
                        <span className="price-preview-tag">−{discount}%</span>
                      </>
                    )}
                  </div>
                )}

                <label className="field">
                  <span className="field-label">Phụ phí bản Smart / IoT (đ)</span>
                  <input
                    className="form-input"
                    type="number"
                    min={1000}
                    value={form.smartPriceDelta}
                    onChange={(e) => set('smartPriceDelta')(e.target.value)}
                  />
                  <span className="field-hint">
                    {smartDelta
                      ? `Bản Smart sẽ có giá ${formatPrice(price + smartDelta)}`
                      : 'Để trống nếu sản phẩm không có bản Smart'}
                  </span>
                </label>

                <div className="field-grid">
                  <label className="field">
                    <span className="field-label">Nhãn nổi bật</span>
                    <select
                      className="form-input"
                      value={form.badge}
                      onChange={(e) => set('badge')(e.target.value)}
                    >
                      {BADGES.map((b) => (
                        <option value={b.value} key={b.value}>
                          {b.label}
                        </option>
                      ))}
                    </select>
                    <span className="field-hint">Góc trái ảnh sản phẩm trên cửa hàng</span>
                  </label>

                  <label className="field">
                    <span className="field-label">Emoji dự phòng</span>
                    <input
                      className="form-input"
                      maxLength={8}
                      placeholder="🎨"
                      value={form.emoji}
                      onChange={(e) => set('emoji')(e.target.value)}
                    />
                    <span className="field-hint">Hiện khi ảnh không tải được</span>
                  </label>
                </div>

                <div className="field">
                  <span className="field-label">Trạng thái</span>
                  <div className="status-choices">
                    {STATUSES.map((s) => (
                      <label
                        key={s.value}
                        className={`status-choice${form.status === s.value ? ' active' : ''}`}
                      >
                        <input
                          type="radio"
                          name="status"
                          value={s.value}
                          checked={form.status === s.value}
                          onChange={() => set('status')(s.value)}
                        />
                        <div>
                          <strong>{s.label}</strong>
                          <div className="status-choice-hint">{s.hint}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            {tab === 'images' && (
              <>
                <div className="panel-note">
                  Ảnh đầu tiên là ảnh chính hiển thị trên cửa hàng. Đường dẫn bắt đầu bằng{' '}
                  <code>/assets/</code> hoặc <code>https://</code>.
                </div>

                {form.images.map((url, i) => (
                  <ImageRow
                    key={i}
                    value={url}
                    canRemove={form.images.length > 1}
                    onChange={(next) =>
                      set('images')(form.images.map((u, j) => (j === i ? next : u)))
                    }
                    onRemove={() => set('images')(form.images.filter((_, j) => j !== i))}
                  />
                ))}

                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => set('images')([...form.images, ''])}
                >
                  + Thêm ảnh
                </button>
              </>
            )}

            {tab === 'includes' && (
              <>
                <div className="panel-note">
                  Danh sách những gì có trong hộp. Hiện ở tab “Thông tin” của trang sản phẩm.
                </div>

                {form.includes.map((item, i) => (
                  <div className="repeat-row" key={i}>
                    <div className="repeat-index">{i + 1}</div>
                    <input
                      className="form-input"
                      placeholder="VD: Chậu đất nung"
                      value={item}
                      onChange={(e) =>
                        set('includes')(form.includes.map((x, j) => (j === i ? e.target.value : x)))
                      }
                    />
                    <button
                      type="button"
                      className="repeat-remove"
                      disabled={form.includes.length <= 1}
                      onClick={() => set('includes')(form.includes.filter((_, j) => j !== i))}
                      title="Bỏ mục này"
                    >
                      ✕
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => set('includes')([...form.includes, ''])}
                >
                  + Thêm mục
                </button>
              </>
            )}

            {tab === 'videos' &&
              (product ? (
                <VideoPanel productId={product.id} productName={product.name} />
              ) : (
                <div className="panel-empty">Lưu sản phẩm trước để thêm video hướng dẫn.</div>
              ))}
            </div>
          </div>

          {error && <div className="form-error editor-error">{error}</div>}

          <div className="editor-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              {product ? 'Đóng' : 'Hủy'}
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Đang lưu...' : product ? 'Lưu thay đổi' : 'Lưu và thêm video →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
