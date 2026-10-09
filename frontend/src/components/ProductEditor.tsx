import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { SproutyIcon } from '@/components/icons/SproutyIcon';
import type { SpeciesOption } from '@/types/plant';
import { VideoPanel } from './VideoPanel';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import { formatPrice } from '@/types/product';
import { AdminIcon, type AdminIconName } from '@/components/icons/AdminIcon';
import {
  AGE_PRESETS,
  ComboField,
  MoneyInput,
  PresetChips,
  PRODUCT_PRICE_PRESETS,
  roundUpAbove,
  SMART_DELTA_PRESETS,
} from '@/components/admin/fields';

export interface AdminProduct {
  id: number;
  name: string;
  description: string;
  price: number;
  oldPrice?: number | null;
  smartPriceDelta?: number | null;
  category: 'kit' | 'book' | 'membership';
  /** Days one purchase of a VIP plan lasts; null on anything else. */
  membershipDays?: number | null;
  /** Which plant a kit grows in the simulation; null on a non-kit. */
  speciesKey?: string | null;
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

/** The lengths a VIP plan is normally sold in. */
const PLAN_DAY_PRESETS = [30, 90, 180, 365] as const;
const PLAN_DAY_LABEL: Record<number, string> = {
  30: '1 tháng',
  90: '3 tháng',
  180: '6 tháng',
  365: '1 năm',
};

const TABS: Array<{ key: TabKey; label: string; icon: AdminIconName }> = [
  { key: 'basic', label: 'Thông tin', icon: 'blog' },
  { key: 'pricing', label: 'Giá & nhãn', icon: 'sales' },
  { key: 'images', label: 'Hình ảnh', icon: 'images' },
  { key: 'includes', label: 'Trong hộp', icon: 'orders' },
  { key: 'videos', label: 'Video', icon: 'video' },
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
  speciesKey: 'bean',
  ageRange: '',
  collection: '',
  description: '',
  price: '',
  oldPrice: '',
  smartPriceDelta: '',
  membershipDays: '30',
  emoji: '',
  badge: '',
  status: 'published',
  images: [''],
  includes: [''],
};

interface FormState {
  name: string;
  category: string;
  speciesKey: string;
  ageRange: string;
  collection: string;
  description: string;
  price: string;
  oldPrice: string;
  smartPriceDelta: string;
  membershipDays: string;
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
    // Falls back to bean so the picker is never empty on an older product that
    // predates the column; the admin still has to save for it to stick.
    speciesKey: product.speciesKey || 'bean',
    ageRange: product.ageRange,
    collection: product.collection,
    description: product.description,
    price: String(product.price),
    oldPrice: product.oldPrice ? String(product.oldPrice) : '',
    smartPriceDelta: product.smartPriceDelta ? String(product.smartPriceDelta) : '',
    membershipDays: product.membershipDays ? String(product.membershipDays) : '30',
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
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const trimmed = value.trim();

  // Uploading before the product exists is deliberate: the admin picks the
  // photo while filling in the form, so there is no product id to attach it
  // to yet. The server stores the file and hands back a URL, which is what
  // gets saved with the rest of the fields.
  async function upload(file: File) {
    if (!file.type.startsWith('image/')) {
      showToast('Chỉ nhận file ảnh.', 'error');
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const { url } = await API.admin.products.uploadImage(body);
      setBroken(false);
      onChange(url);
    } catch (err: any) {
      showToast(err?.message || 'Không tải được ảnh lên.', 'error');
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <div className="repeat-row image-row">
      <div className="repeat-preview">
        {trimmed && !broken ? (
          <img src={trimmed} alt="" onError={() => setBroken(true)} />
        ) : (
          <AdminIcon name={trimmed ? 'alert' : 'images'} size={20} />
        )}
      </div>

      <div className="image-row-main">
        <div className="image-row-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            <AdminIcon name="upload" size={15} />
            {busy ? 'Đang tải lên…' : trimmed ? 'Đổi ảnh' : 'Chọn ảnh từ máy'}
          </button>
          {trimmed && !busy && (
            <a className="image-row-link" href={trimmed} target="_blank" rel="noreferrer">
              Xem ảnh
              <AdminIcon name="external" size={13} />
            </a>
          )}
        </div>

        {/* Still editable by hand: the catalogue that shipped with the site
            points at /assets paths nobody uploaded through here. */}
        <input
          className="form-input image-row-url"
          placeholder="hoặc dán đường dẫn /assets/… hay https://…"
          value={value}
          onChange={(e) => {
            setBroken(false);
            onChange(e.target.value);
          }}
        />

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </div>

      <button
        type="button"
        className="repeat-remove"
        onClick={onRemove}
        disabled={!canRemove}
        title="Bỏ ảnh này"
      >
        <AdminIcon name="close" size={15} />
      </button>
    </div>
  );
}

export function ProductEditor({
  editing,
  collections = [],
  onClose,
  onSaved,
}: {
  editing: AdminProduct | null;
  /** The groups already in the catalogue, passed down rather than fetched
      again — the list page has just asked for exactly this. */
  collections?: Array<{ value: string; count: number }>;
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

  // The species catalogue comes from the server, not a list hardcoded here —
  // the simulation decides what a carrot does, so it also decides what can be
  // offered. Fetched once per editor open; failing leaves the picker empty and
  // the rest of the form perfectly usable.
  const [speciesOptions, setSpeciesOptions] = useState<SpeciesOption[]>([]);
  useEffect(() => {
    let cancelled = false;
    API.admin.products
      .species()
      .then((data: { species: SpeciesOption[] }) => {
        if (!cancelled) setSpeciesOptions(data.species || []);
      })
      .catch(() => {
        /* The picker simply does not render; saving still works. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const chosenSpecies = speciesOptions.find((s) => s.key === form.speciesKey) || null;

  const set = <K extends keyof FormState>(key: K) => (value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const price = parseInt(form.price, 10) || 0;
  const oldPrice = parseInt(form.oldPrice, 10) || 0;
  const smartDelta = parseInt(form.smartPriceDelta, 10) || 0;
  const isPlan = form.category === 'membership';
  const planDays = parseInt(form.membershipDays, 10) || 0;
  const discount = oldPrice > price && price > 0 ? Math.round((1 - price / oldPrice) * 100) : 0;

  // The round numbers just above the asking price, which is what a
  // struck-through "was" figure almost always is.
  const roundUpSuggestions = useMemo(() => roundUpAbove(price), [price]);

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
    if (isPlan && planDays < 1) return { tab: 'pricing', message: 'Nhập thời hạn gói VIP (số ngày).' };
    return null;
  }, [form, price, oldPrice, isPlan, planDays]);

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
      speciesKey: form.category === 'kit' ? form.speciesKey : null,
      ageRange: form.ageRange.trim(),
      collection: form.collection.trim(),
      description: form.description.trim(),
      price,
      oldPrice: oldPrice || null,
      // A plan has no Smart variant, and only a plan has a length.
      smartPriceDelta: isPlan ? null : smartDelta || null,
      membershipDays: isPlan ? planDays : null,
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
                    <span className="editor-step-icon">
                      <AdminIcon name={locked ? 'lock' : t.icon} size={16} />
                    </span>
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
                      <option value="membership">Gói thành viên VIP</option>
                    </select>
                    {isPlan && (
                      <span className="field-hint">
                        Chỉ bán ở trang VIP, không hiện trên cửa hàng. Khách thanh toán xong là
                        tài khoản tự lên VIP.
                      </span>
                    )}
                  </label>

                  <div className="field">
                    <span className="field-label">
                      Độ tuổi <span className="req">*</span>
                    </span>
                    <input
                      className="form-input"
                      placeholder="VD: 4–10 tuổi"
                      value={form.ageRange}
                      onChange={(e) => set('ageRange')(e.target.value)}
                    />
                    {/* The shop filters on this exact string, so the bands
                        have to be spelled one way to stay one band. */}
                    <PresetChips
                      options={AGE_PRESETS}
                      value={form.ageRange}
                      onPick={set('ageRange')}
                    />
                  </div>
                </div>

                {/* Which plant this kit grows into. It is a visual choice, not a
                    dropdown, because it decides what every customer who buys
                    this product will spend three weeks raising — and because the
                    stage names differ per species in a way a bare key hides. */}
                {form.category === 'kit' && speciesOptions.length > 0 && (
                  <div className="field species-field">
                    <span className="field-label">
                      Giống cây mô phỏng <span className="req">*</span>
                    </span>
                    <p className="species-hint">
                      Khách mua sản phẩm này sẽ trồng ra cây đó. Tên sản phẩm đặt thế nào cũng được —
                      giống cây do lựa chọn bên dưới quyết định.
                    </p>

                    <div className="species-grid">
                      {speciesOptions.map((option) => (
                        <button
                          type="button"
                          key={option.key}
                          className={`species-opt${form.speciesKey === option.key ? ' active' : ''}`}
                          onClick={() => set('speciesKey')(option.key)}
                          aria-pressed={form.speciesKey === option.key}
                        >
                          <span
                            className="species-opt-icon"
                            style={{ ['--icon-accent' as string]: option.fruitColor }}
                          >
                            <SproutyIcon name={option.icon} size={24} />
                          </span>
                          <span className="species-opt-body">
                            <strong>{option.label}</strong>
                            <em>{option.blurb}</em>
                          </span>
                          <span
                            className="species-opt-swatch"
                            style={{ background: option.fruitColor, borderColor: option.flowerColor }}
                            aria-hidden="true"
                          />
                        </button>
                      ))}
                    </div>

                    {chosenSpecies && (
                      <div className="species-preview">
                        <span className="species-preview-title">
                          Hành trình khách sẽ thấy · thu hoạch <b>{chosenSpecies.harvest}</b>
                          {!chosenSpecies.pollinate && ' · không cần thụ phấn'}
                        </span>
                        <div className="species-preview-stages">
                          {chosenSpecies.stageLabels.map((label, i) => (
                            <span key={i}>{label}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}


                <div className="field">
                  <span className="field-label">
                    Bộ sưu tập <span className="req">*</span>
                  </span>
                  {/* The groups already in the catalogue. A collection only
                      groups anything if everyone spells it identically, and a
                      plain text box guarantees that eventually somebody will
                      not — leaving two groups of one product each. */}
                  <ComboField
                    value={form.collection}
                    onChange={set('collection')}
                    options={collections}
                    placeholder="VD: Sprouty Starter"
                    emptyHint="Chưa có bộ sưu tập nào — gõ để tạo nhóm đầu tiên."
                  />
                  <span className="field-hint">Nhóm sản phẩm lại với nhau trên cửa hàng</span>
                </div>

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
                  <div className="field">
                    <span className="field-label">
                      Giá bán <span className="req">*</span>
                    </span>
                    <MoneyInput
                      value={form.price}
                      onChange={set('price')}
                      placeholder="0"
                      suggestions={PRODUCT_PRICE_PRESETS}
                    />
                    <span className="field-hint">Số tiền khách thực trả</span>
                  </div>

                  <div className="field">
                    <span className="field-label">Giá trước giảm</span>
                    <MoneyInput
                      value={form.oldPrice}
                      onChange={set('oldPrice')}
                      placeholder="0"
                      suggestions={roundUpSuggestions}
                    />
                    <span className="field-hint">
                      {discount
                        ? `Giảm ${discount}% so với giá này`
                        : 'Để trống nếu sản phẩm không giảm giá'}
                    </span>
                  </div>
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

                {isPlan ? (
                  // What the customer is paying for is time, so the length
                  // sits where a kit's Smart surcharge would.
                  <div className="field">
                    <span className="field-label">
                      Thời hạn mỗi lần mua <span className="req">*</span>
                    </span>
                    <input
                      className="form-input"
                      inputMode="numeric"
                      placeholder="30"
                      value={form.membershipDays}
                      onChange={(e) => set('membershipDays')(e.target.value.replace(/\D/g, ''))}
                    />
                    <PresetChips
                      options={PLAN_DAY_PRESETS}
                      value={form.membershipDays}
                      onPick={set('membershipDays')}
                      format={(d) => PLAN_DAY_LABEL[d] ?? `${d} ngày`}
                    />
                    <span className="field-hint">
                      {planDays
                        ? `Mỗi lần mua cộng thêm ${planDays} ngày VIP — mua khi còn hạn thì nối tiếp, không mất ngày.`
                        : 'Số ngày VIP khách nhận được mỗi lần thanh toán gói này.'}
                    </span>
                  </div>
                ) : (
                  <label className="field">
                    <span className="field-label">Phụ phí bản Smart / IoT</span>
                    <MoneyInput
                      value={form.smartPriceDelta}
                      onChange={set('smartPriceDelta')}
                      placeholder="0"
                      suggestions={SMART_DELTA_PRESETS}
                    />
                    <span className="field-hint">
                      {smartDelta
                        ? `Bản Smart sẽ có giá ${formatPrice(price + smartDelta)}`
                        : 'Để trống nếu sản phẩm không có bản Smart'}
                    </span>
                  </label>
                )}

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
                  Ảnh đầu tiên là ảnh chính hiển thị trên cửa hàng. Chọn ảnh từ máy, hoặc dán
                  sẵn một đường dẫn {' '}
                  <code>/assets/</code> hay <code>https://</code> nếu đã có.
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
                  <AdminIcon name="plus" size={15} />
                  Thêm ảnh
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
            {/* What is still missing, said before the button is pressed. It
                used to be discoverable only by clicking a button that looked
                ready and then being bounced to another tab. */}
            {problem && !busy && (
              <button
                type="button"
                className="editor-missing"
                onClick={() => setTab(problem.tab)}
              >
                <AdminIcon name="alert" size={15} />
                {problem.message}
              </button>
            )}

            <button type="button" className="btn btn-ghost" onClick={onClose}>
              {product ? 'Đóng' : 'Hủy'}
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? (
                'Đang lưu…'
              ) : product ? (
                <>
                  <AdminIcon name="save" size={17} />
                  Lưu thay đổi
                </>
              ) : (
                <>
                  Lưu &amp; thêm video
                  <AdminIcon name="arrow-right" size={16} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
