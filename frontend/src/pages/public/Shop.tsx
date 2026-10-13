import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useProducts } from '@/hooks/useProducts';
import { useCart } from '@/contexts/CartContext';
import { fetchSpeciesFilters, productFallbackImage, productImage } from '@/services/products';
import { SproutyIcon, type IconName } from '@/components/icons/SproutyIcon';
import { PromoBanner } from '@/components/PromoBanner';
import { BADGE_LABEL, formatPrice, type Product } from '@/types/product';
import './Shop.css';

interface SpeciesFilter {
  key: string;
  label: string;
  icon: string;
  count: number;
  harvest: string;
}

type Category = 'all' | 'kit' | 'book';
type AgeBand = 'all' | '4-6' | '6-9' | '9-12';
type Badge = 'all' | 'hot' | 'new' | 'sale';
type PricePreset = 'all' | 'u70' | '70-90' | 'o90';
type Sort = '' | 'pa' | 'pd' | 'az' | 'pop';
/** Each filter, so a count can leave its own group out (see `passes`). */
type Group = 'species' | 'age' | 'price' | 'badge' | 'category';

const CATEGORIES: Array<{ value: Category; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'kit', label: 'Bộ kit trồng cây' },
  { value: 'book', label: 'Sách hướng dẫn' },
];

const AGE_BANDS: Array<{ value: AgeBand; label: string }> = [
  { value: 'all', label: 'Mọi tuổi' },
  { value: '4-6', label: '4–6 tuổi' },
  { value: '6-9', label: '6–9 tuổi' },
  { value: '9-12', label: '9–12 tuổi' },
];

const BADGES: Array<{ value: Badge; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'hot', label: 'Bán chạy' },
  { value: 'new', label: 'Mới' },
  { value: 'sale', label: 'Giảm giá' },
];

const PRICE_PRESETS: Array<{ value: PricePreset; label: string; min: string; max: string }> = [
  { value: 'all', label: 'Mọi giá', min: '', max: '' },
  { value: 'u70', label: 'Dưới 70K', min: '', max: '69999' },
  { value: '70-90', label: '70–90K', min: '70000', max: '90000' },
  { value: 'o90', label: 'Trên 90K', min: '90001', max: '' },
];

const SORTS: Array<{ value: Sort; label: string }> = [
  { value: '', label: 'Gợi ý' },
  { value: 'pop', label: 'Bán chạy' },
  { value: 'pa', label: 'Giá thấp → cao' },
  { value: 'pd', label: 'Giá cao → thấp' },
  { value: 'az', label: 'Tên A → Z' },
];

const STEPS: Array<{ icon: IconName; title: string; text: string }> = [
  { icon: 'seed', title: 'Gieo hạt thật', text: 'Hạt, đất và chậu có sẵn trong hộp' },
  { icon: 'sprout', title: 'Kích hoạt cây 3D', text: 'Nhập mã trong hộp, cây mọc trên Sprouty' },
  { icon: 'album', title: 'Lưu kỷ niệm', text: 'Ảnh và video bé chăm cây mỗi ngày' },
];

/** The age label is free text ("4–10 tuổi"), so a band matches if any of its
 *  years appears in the label. Same rule the old shop page used. */
const AGE_YEARS: Record<Exclude<AgeBand, 'all'>, string[]> = {
  '4-6': ['4', '5', '6'],
  '6-9': ['6', '7', '8', '9'],
  '9-12': ['9', '10', '11', '12'],
};

function matchesAge(product: Product, band: AgeBand) {
  if (band === 'all') return true;
  return AGE_YEARS[band].some((year) => product.age.includes(year));
}

/** The price bounds as numbers; an empty or unreadable box is no bound. */
function priceBounds(minText: string, maxText: string) {
  const min = minText === '' ? 0 : Math.max(0, parseInt(minText, 10) || 0);
  const rawMax = maxText === '' ? Infinity : parseInt(maxText, 10);
  const max = Number.isNaN(rawMax) ? Infinity : Math.max(min, rawMax);
  return { min, max };
}

const speciesIcon = (icon?: string): IconName => (icon as IconName) || 'sprout';
/** The most one order line accepts (backend/src/routes/orders.js). */
const MAX_QTY = 99;
const digitsOnly = (value: string) => value.replace(/\D/g, '').slice(0, 9);
const asMoney = (digits: string) => (digits ? Number(digits).toLocaleString('vi-VN') : '');

/**
 * One product in the grid. The image and text open the product; the button
 * adds it to the cart and says so in words — the old round "+" was easy to
 * miss, and on a phone it was squeezed down to a sliver beside a long price.
 * Name and description are clamped, and the price and button sit at the
 * bottom, so every card in a row lines up whatever the text.
 */
function ShopCard({ product }: { product: Product }) {
  const { add, items, setQty, remove } = useCart();
  // The card adds the standard kit; the Smart one is chosen on the product page.
  const inCart = items.find((line) => line.id === product.id && (line.variant || 'standard') === 'standard')?.qty || 0;
  const primary = productImage(product);
  const [src, setSrc] = useState(primary);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setSrc(primary); setFailed(false); }, [product.id, primary]);

  function onImageError() {
    const fallback = productFallbackImage(product);
    if (src !== fallback) setSrc(fallback);
    else setFailed(true);
  }

  const discount = product.old && product.old > product.price ? Math.round((1 - product.price / product.old) * 100) : 0;

  return (
    <article className="sp-card">
      <Link to={`/shop/${product.id}`} className="sp-card-link">
        <span className="sp-card-img" style={failed ? undefined : { background: product.bg }}>
          {failed ? (
            // No photo of its own: say so, in the shop's look, rather than
            // borrowing another product's picture.
            <span className="sp-card-noimg">
              <SproutyIcon name={speciesIcon(product.species?.icon)} size={40} />
              <em>Ảnh đang cập nhật</em>
            </span>
          ) : (
            <img src={src} alt="" loading="lazy" decoding="async" onError={onImageError} />
          )}
          {product.badge && <span className={`sp-badge is-${product.badge}`}>{BADGE_LABEL[product.badge]}</span>}
        </span>
        <span className="sp-card-body">
          <span className="sp-card-meta">
            {product.species && <SproutyIcon name={speciesIcon(product.species.icon)} size={14} />}
            <span>{product.species?.label || product.col}</span>
            {product.age && (
              <>
                <i aria-hidden="true">·</i>
                <span>{product.age}</span>
              </>
            )}
          </span>
          <strong className="sp-card-name">{product.name}</strong>
          <span className="sp-card-desc">{product.desc}</span>
        </span>
      </Link>
      <div className="sp-card-foot">
        <span className="sp-price">
          <b>{formatPrice(product.price)}</b>
          {discount > 0 && (
            <>
              <s>{formatPrice(product.old!)}</s>
              <em>-{discount}%</em>
            </>
          )}
        </span>
        {inCart > 0 ? (
          // Once it is in the cart the button becomes the quantity, so a
          // second one is a tap away and taking it out does not need the cart.
          <div className="sp-stepper" role="group" aria-label={`${product.name} trong giỏ`}>
            <button
              type="button"
              aria-label={inCart > 1 ? 'Bớt một' : 'Bỏ khỏi giỏ'}
              onClick={() => (inCart > 1 ? setQty(product.id, 'standard', inCart - 1) : remove(product.id, 'standard'))}
            >
              <SproutyIcon name="minus" size={16} />
            </button>
            <Link to="/cart" className="sp-stepper-qty" aria-live="polite">
              <b>{inCart}</b> trong giỏ
            </Link>
            <button
              type="button"
              aria-label="Thêm một"
              disabled={inCart >= MAX_QTY}
              onClick={() => setQty(product.id, 'standard', inCart + 1)}
            >
              <SproutyIcon name="add" size={16} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="sp-add"
            aria-label={`Thêm ${product.name} vào giỏ`}
            onClick={() => add(product.id, 1, product)}
          >
            <SproutyIcon name="cart" size={16} />
            <span>Thêm vào giỏ</span>
          </button>
        )}
      </div>
    </article>
  );
}

/**
 * The shop.
 *
 * Every filter lives in one place — beside the grid on a wide screen, in a
 * sheet from the bottom on a phone or tablet — with the plant first, since
 * it is what a parent chooses by. (The plants used to be a second row of
 * filters above the grid as well, which read as two separate filter boxes.)
 * What is switched on shows as tags above the grid, each removable. Each
 * option's count is what you would get by picking it, given the rest.
 */
export default function Shop() {
  const { products, loading, error, reload } = useProducts();
  const [searchParams] = useSearchParams();

  // The homepage age cards link here with ?age=4-6.
  const initialAge = (searchParams.get('age') as AgeBand) || 'all';

  const [category, setCategory] = useState<Category>('all');
  // Which plant the kit grows. Fetched rather than hardcoded: the catalogue
  // lives in the simulation, and a species added there should appear here
  // without a second edit.
  const [species, setSpecies] = useState<string>(searchParams.get('species') || 'all');
  const [speciesOptions, setSpeciesOptions] = useState<SpeciesFilter[]>([]);
  const [age, setAge] = useState<AgeBand>(AGE_BANDS.some((a) => a.value === initialAge) ? initialAge : 'all');
  const [badge, setBadge] = useState<Badge>('all');
  const [pricePreset, setPricePreset] = useState<PricePreset>('all');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  // "Thử lại" asks for the plants again too: they load on their own, and a
  // failed load used to leave the group missing until a full page reload.
  const [speciesAttempt, setSpeciesAttempt] = useState(0);
  const retry = () => {
    reload();
    setSpeciesAttempt((n) => n + 1);
  };

  useEffect(() => {
    let cancelled = false;
    fetchSpeciesFilters()
      .then((list) => {
        if (!cancelled) setSpeciesOptions(list);
      })
      .catch(() => {
        /* The group simply does not render; every other filter still works. */
      });
    return () => {
      cancelled = true;
    };
  }, [speciesAttempt]);

  // The sheet covers the page; the page behind it should not scroll.
  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [drawerOpen]);

  function applyPricePreset(preset: PricePreset) {
    const chosen = PRICE_PRESETS.find((p) => p.value === preset)!;
    setPricePreset(preset);
    setPriceMin(chosen.min);
    setPriceMax(chosen.max);
  }

  function clearFilters() {
    setCategory('all');
    setSpecies('all');
    setAge('all');
    setBadge('all');
    applyPricePreset('all');
  }

  function resetAll() {
    clearFilters();
    setQuery('');
    setSort('');
  }

  const { min, max } = priceBounds(priceMin, priceMax);
  const q = query.trim().toLowerCase();

  /** Whether a product passes every filter but `skip`. */
  const passes = (p: Product, skip?: Group) => {
    if (skip !== 'category' && category !== 'all' && p.cat !== category) return false;
    if (skip !== 'species' && species !== 'all' && p.species?.key !== species) return false;
    if (skip !== 'badge' && badge !== 'all' && p.badge !== badge) return false;
    if (skip !== 'age' && !matchesAge(p, age)) return false;
    if (skip !== 'price' && ((max !== Infinity && p.price > max) || (min > 0 && p.price < min))) return false;
    if (q) {
      const haystack = `${p.name} ${p.desc} ${p.col} ${p.age} ${p.species?.label || ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  };

  const results = useMemo(() => {
    const list = products.filter((p) => passes(p));
    if (sort === 'pa') list.sort((a, b) => a.price - b.price);
    else if (sort === 'pd') list.sort((a, b) => b.price - a.price);
    else if (sort === 'az') list.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    else if (sort === 'pop') list.sort((a, b) => Number(b.badge === 'hot') - Number(a.badge === 'hot'));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, category, species, age, badge, min, max, q, sort]);

  /** How many products picking an option would show, the other filters kept. */
  const countIf = (group: Group, test: (p: Product) => boolean) =>
    products.reduce((n, p) => n + (passes(p, group) && test(p) ? 1 : 0), 0);

  const chosenSpecies = speciesOptions.find((o) => o.key === species);
  const activeTags = [
    species !== 'all' && { label: chosenSpecies?.label || species, clear: () => setSpecies('all') },
    age !== 'all' && { label: AGE_BANDS.find((a) => a.value === age)!.label, clear: () => setAge('all') },
    (pricePreset !== 'all' || priceMin || priceMax) && {
      label: pricePreset !== 'all'
        ? PRICE_PRESETS.find((p) => p.value === pricePreset)!.label
        : `${priceMin ? formatPrice(+priceMin) : '0đ'} – ${priceMax ? formatPrice(+priceMax) : 'không giới hạn'}`,
      clear: () => applyPricePreset('all'),
    },
    badge !== 'all' && { label: BADGES.find((b) => b.value === badge)!.label, clear: () => setBadge('all') },
    category !== 'all' && { label: CATEGORIES.find((c) => c.value === category)!.label, clear: () => setCategory('all') },
  ].filter(Boolean) as Array<{ label: string; clear: () => void }>;

  const anyFilter = activeTags.length > 0 || q !== '';

  /** One panel, rendered twice: beside the grid and inside the sheet. */
  const filterPanel = (
    <>
      {speciesOptions.length > 0 && (
        <fieldset className="sp-group">
          <legend>Giống cây</legend>
          <div className="sp-plants">
            <button type="button" aria-pressed={species === 'all'} className={`sp-plant${species === 'all' ? ' is-on' : ''}`} onClick={() => setSpecies('all')}>
              <span className="sp-plant-icon"><SproutyIcon name="leaf" size={17} /></span>
              <span className="sp-plant-name">Tất cả cây</span>
              <em>{countIf('species', () => true)}</em>
            </button>
            {speciesOptions.map((option) => {
              const n = countIf('species', (p) => p.species?.key === option.key);
              return (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={species === option.key}
                  className={`sp-plant${species === option.key ? ' is-on' : ''}${n === 0 ? ' is-empty' : ''}`}
                  onClick={() => setSpecies(species === option.key ? 'all' : option.key)}
                  title={`Thu hoạch ${option.harvest}`}
                >
                  <span className="sp-plant-icon"><SproutyIcon name={speciesIcon(option.icon)} size={17} /></span>
                  <span className="sp-plant-name">{option.label}</span>
                  <em>{n}</em>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <fieldset className="sp-group">
        <legend>Độ tuổi</legend>
        <div className="sp-chips">
          {AGE_BANDS.map((a) => (
            <button key={a.value} type="button" aria-pressed={age === a.value} className={`sp-chip${age === a.value ? ' is-on' : ''}`} onClick={() => setAge(a.value)}>
              {a.label}
              {a.value !== 'all' && <em>{countIf('age', (p) => matchesAge(p, a.value))}</em>}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="sp-group">
        <legend>Khoảng giá</legend>
        <div className="sp-chips">
          {PRICE_PRESETS.map((p) => {
            const b = priceBounds(p.min, p.max);
            return (
              <button key={p.value} type="button" aria-pressed={pricePreset === p.value} className={`sp-chip${pricePreset === p.value ? ' is-on' : ''}`} onClick={() => applyPricePreset(p.value)}>
                {p.label}
                {p.value !== 'all' && <em>{countIf('price', (x) => x.price >= b.min && x.price <= b.max)}</em>}
              </button>
            );
          })}
        </div>
        <div className="sp-range">
          <label>
            <span>Từ</span>
            <span className="sp-money">
              <input
                type="text"
                inputMode="numeric"
                placeholder="0"
                aria-label="Giá từ"
                value={asMoney(priceMin)}
                onChange={(e) => { setPriceMin(digitsOnly(e.target.value)); setPricePreset('all'); }}
              />
              <i>đ</i>
            </span>
          </label>
          <label>
            <span>Đến</span>
            <span className="sp-money">
              <input
                type="text"
                inputMode="numeric"
                placeholder="Tối đa"
                aria-label="Giá đến"
                value={asMoney(priceMax)}
                onChange={(e) => { setPriceMax(digitsOnly(e.target.value)); setPricePreset('all'); }}
              />
              <i>đ</i>
            </span>
          </label>
        </div>
      </fieldset>

      <fieldset className="sp-group">
        <legend>Nhãn</legend>
        <div className="sp-chips">
          {BADGES.map((b) => (
            <button key={b.value} type="button" aria-pressed={badge === b.value} className={`sp-chip${badge === b.value ? ' is-on' : ''}`} onClick={() => setBadge(b.value)}>
              {b.label}
              {b.value !== 'all' && <em>{countIf('badge', (p) => p.badge === b.value)}</em>}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="sp-group">
        <legend>Loại sản phẩm</legend>
        <div className="sp-kinds">
          {CATEGORIES.map((c) => (
            <button key={c.value} type="button" aria-pressed={category === c.value} className={`sp-kind${category === c.value ? ' is-on' : ''}`} onClick={() => setCategory(c.value)}>
              <span>{c.label}</span>
              <em>{countIf('category', (p) => c.value === 'all' || p.cat === c.value)}</em>
            </button>
          ))}
        </div>
      </fieldset>
    </>
  );

  return (
    <>
      <section className="sp-hero">
        <div className="container sp-hero-in">
          <div className="sp-hero-text">
            <nav className="sp-crumb" aria-label="Đường dẫn">
              <Link to="/">Trang chủ</Link>
              <span aria-hidden="true">/</span>
              <span>Cửa hàng</span>
            </nav>
            <h1>Chọn một hạt giống cho bé</h1>
            <p>Mỗi bộ kit có hạt giống thật để gieo ở nhà và một cây 3D trên Sprouty để bé chăm mỗi ngày.</p>
            <label className="sp-search">
              <SproutyIcon name="search" size={19} />
              <input
                type="search"
                placeholder="Tìm tên cây, chủ đề, độ tuổi…"
                aria-label="Tìm sản phẩm"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button type="button" aria-label="Xoá tìm kiếm" onClick={() => setQuery('')}>
                  <SproutyIcon name="close" size={16} />
                </button>
              )}
            </label>
          </div>
          <ol className="sp-steps" aria-label="Một bộ kit gồm gì">
            {STEPS.map((step) => (
              <li key={step.title}>
                <span className="sp-step-icon"><SproutyIcon name={step.icon} size={20} /></span>
                <span>
                  <strong>{step.title}</strong>
                  <em>{step.text}</em>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="container sp-body">
        <PromoBanner variant="slim" className="sp-promo" inShop />

        <div className="sp-layout">
          <aside className="sp-filters" aria-label="Bộ lọc">
            <div className="sp-filters-head">
              <h2><SproutyIcon name="filter" size={17} /> Bộ lọc</h2>
              {activeTags.length > 0 && (
                <button type="button" className="sp-link" onClick={clearFilters}>
                  Xoá bộ lọc
                </button>
              )}
            </div>
            {filterPanel}
          </aside>

          <div className="sp-main">
            <div className="sp-toolbar">
              <p className="sp-count" aria-live="polite">
                {loading ? 'Đang tải sản phẩm…' : error ? 'Chưa tải được' : (
                  <>
                    <b>{results.length}</b> sản phẩm
                    {q && <> cho “{query.trim()}”</>}
                  </>
                )}
              </p>
              <button type="button" className="sp-filter-btn" onClick={() => setDrawerOpen(true)}>
                <SproutyIcon name="filter" size={17} />
                Bộ lọc
                {activeTags.length > 0 && <em>{activeTags.length}</em>}
              </button>
              <label className="sp-sort">
                <span>Sắp xếp</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                  {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </label>
            </div>

            {activeTags.length > 0 && (
              <div className="sp-tags">
                {activeTags.map((tag) => (
                  <button type="button" className="sp-tag" key={tag.label} onClick={tag.clear} aria-label={`Bỏ lọc ${tag.label}`}>
                    {tag.label}
                    <SproutyIcon name="close" size={13} />
                  </button>
                ))}
                {activeTags.length > 1 && (
                  <button type="button" className="sp-link" onClick={clearFilters}>Xoá tất cả</button>
                )}
              </div>
            )}

            {error && !loading && (
              <div className="sp-empty is-error" role="alert">
                <span className="sp-empty-icon"><SproutyIcon name="warning" size={28} /></span>
                <h3>Chưa tải được sản phẩm</h3>
                <p>{error}</p>
                <button type="button" className="btn btn-primary" onClick={retry}>Thử lại</button>
              </div>
            )}

            {loading && (
              <div className="sp-grid" aria-hidden="true">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div className="sp-card is-skeleton" key={i}>
                    <span className="sp-card-img" />
                    <span className="sp-skel" />
                    <span className="sp-skel is-short" />
                  </div>
                ))}
              </div>
            )}

            {!error && !loading && results.length === 0 && (
              <div className="sp-empty">
                <span className="sp-empty-icon"><SproutyIcon name="search" size={28} /></span>
                <h3>Chưa có sản phẩm hợp</h3>
                <p>Thử bỏ bớt bộ lọc, chọn giống cây khác hoặc đổi từ khoá.</p>
                {anyFilter && <button type="button" className="btn btn-primary" onClick={resetAll}>Xem tất cả sản phẩm</button>}
              </div>
            )}

            {!error && !loading && results.length > 0 && (
              <div className="sp-grid">
                {results.map((p) => <ShopCard key={p.id} product={p} />)}
              </div>
            )}
          </div>
        </div>
      </div>

      {drawerOpen && (
        <div
          className="sp-sheet-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDrawerOpen(false);
          }}
        >
          <div className="sp-sheet" role="dialog" aria-modal="true" aria-label="Bộ lọc sản phẩm">
            <div className="sp-sheet-head">
              <h2>Bộ lọc</h2>
              <button type="button" className="sp-sheet-close" aria-label="Đóng" onClick={() => setDrawerOpen(false)}>
                <SproutyIcon name="close" size={18} />
              </button>
            </div>
            <div className="sp-sheet-body">{filterPanel}</div>
            <div className="sp-sheet-foot">
              <button type="button" className="btn btn-ghost" onClick={clearFilters} disabled={activeTags.length === 0}>Xoá bộ lọc</button>
              <button type="button" className="btn btn-primary" onClick={() => setDrawerOpen(false)}>
                Xem {results.length} sản phẩm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
