import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ProductCard } from '@/components/ProductCard';
import { ProductListItem } from '@/components/ProductListItem';
import { useProducts } from '@/hooks/useProducts';
import { fetchSpeciesFilters } from '@/services/products';
import { SproutyIcon, type IconName } from '@/components/icons/SproutyIcon';
import type { Product } from '@/types/product';

interface SpeciesFilter {
  key: string;
  label: string;
  icon: string;
  count: number;
  harvest: string;
}
import { PromoBanner } from '@/components/PromoBanner';
import './Shop.css';

type Category = 'all' | 'kit' | 'book';
type AgeBand = 'all' | '4-6' | '6-9' | '9-12';
type Badge = 'all' | 'hot' | 'new' | 'sale';
type PricePreset = 'all' | 'u70' | '70-90' | 'o90';
type Sort = '' | 'pa' | 'pd' | 'az' | 'pop';
type View = 'grid' | 'list';

const CATEGORIES: Array<{ value: Category; icon: string; label: string }> = [
  { value: 'all', icon: '🛍', label: 'Tất cả' },
  { value: 'kit', icon: '🌱', label: 'Bộ kit trồng cây' },
  { value: 'book', icon: '📖', label: 'Sách hướng dẫn' },
];

const AGE_BANDS: Array<{ value: AgeBand; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: '4-6', label: '4–6 tuổi' },
  { value: '6-9', label: '6–9 tuổi' },
  { value: '9-12', label: '9–12 tuổi' },
];

const BADGES: Array<{ value: Badge; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'hot', label: '🔥 Bán chạy' },
  { value: 'new', label: '✨ Mới' },
  { value: 'sale', label: '🏷 Giảm giá' },
];

const PRICE_PRESETS: Array<{ value: PricePreset; label: string; min: string; max: string }> = [
  { value: 'all', label: 'Tất cả', min: '', max: '' },
  { value: 'u70', label: 'Dưới 70K', min: '', max: '69999' },
  { value: '70-90', label: '70–90K', min: '70000', max: '90000' },
  { value: 'o90', label: 'Trên 90K', min: '90001', max: '' },
];

const CATEGORY_TAG: Record<string, string> = {
  kit: 'Bộ kit',
  book: 'Sách hướng dẫn',
  membership: 'Gói thành viên',
};

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

export default function Shop() {
  const { products, loading, error } = useProducts();
  const [searchParams] = useSearchParams();

  // The homepage age cards link here with ?age=4-6.
  const initialAge = (searchParams.get('age') as AgeBand) || 'all';

  const [category, setCategory] = useState<Category>('all');
  // Which plant the kit grows. Fetched rather than hardcoded: the catalogue
  // lives in the simulation, and a species added there should appear here
  // without a second edit.
  const [species, setSpecies] = useState<string>('all');
  const [speciesOptions, setSpeciesOptions] = useState<SpeciesFilter[]>([]);
  const [age, setAge] = useState<AgeBand>(AGE_BANDS.some((a) => a.value === initialAge) ? initialAge : 'all');
  const [badge, setBadge] = useState<Badge>('all');
  const [pricePreset, setPricePreset] = useState<PricePreset>('all');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('');
  const [view, setView] = useState<View>('grid');
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchSpeciesFilters()
      .then((list) => {
        if (!cancelled) setSpeciesOptions(list);
      })
      .catch(() => {
        /* The section simply does not render; every other filter still works. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function applyPricePreset(preset: PricePreset) {
    const chosen = PRICE_PRESETS.find((p) => p.value === preset)!;
    setPricePreset(preset);
    setPriceMin(chosen.min);
    setPriceMax(chosen.max);
  }

  function resetFilters() {
    setCategory('all');
    setSpecies('all');
    setAge('all');
    setBadge('all');
    applyPricePreset('all');
    setQuery('');
    setSort('');
  }

  const results = useMemo(() => {
    const min = priceMin.trim() === '' ? 0 : Math.max(0, parseInt(priceMin, 10) || 0);
    const rawMax = priceMax.trim() === '' ? Infinity : parseInt(priceMax, 10);
    const max = Number.isNaN(rawMax) ? Infinity : Math.max(min, rawMax);
    const q = query.trim().toLowerCase();

    const list = products.filter((p) => {
      if (category !== 'all' && p.cat !== category) return false;
      if (species !== 'all' && p.species?.key !== species) return false;
      if (badge !== 'all' && p.badge !== badge) return false;
      if (!matchesAge(p, age)) return false;
      if (max !== Infinity && p.price > max) return false;
      if (min > 0 && p.price < min) return false;
      if (q) {
        const haystack = `${p.name} ${p.desc} ${p.col} ${p.age}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    if (sort === 'pa') list.sort((a, b) => a.price - b.price);
    else if (sort === 'pd') list.sort((a, b) => b.price - a.price);
    else if (sort === 'az') list.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    else if (sort === 'pop') list.sort((a, b) => Number(b.badge === 'hot') - Number(a.badge === 'hot'));

    return list;
  }, [products, category, species, age, badge, priceMin, priceMax, query, sort]);

  const countByCategory = useMemo(
    () => ({
      all: products.length,
      kit: products.filter((p) => p.cat === 'kit').length,
      book: products.filter((p) => p.cat === 'book').length,
    }),
    [products],
  );

  const activeTags = [
    category !== 'all' && { label: CATEGORY_TAG[category] ?? category, clear: () => setCategory('all') },
    species !== 'all' && {
      label: speciesOptions.find((o) => o.key === species)?.label ?? species,
      clear: () => setSpecies('all'),
    },
    badge !== 'all' && {
      label: BADGES.find((b) => b.value === badge)!.label,
      clear: () => setBadge('all'),
    },
    age !== 'all' && { label: `${age} tuổi`, clear: () => setAge('all') },
    pricePreset !== 'all' && {
      label: `Giá: ${PRICE_PRESETS.find((p) => p.value === pricePreset)!.label}`,
      clear: () => applyPricePreset('all'),
    },
  ].filter(Boolean) as Array<{ label: string; clear: () => void }>;

  /** One panel, rendered twice: in the sidebar and inside the mobile drawer. */
  const filterPanel = (
    <>
      <div className="filter-section">
        <div className="filter-section-label">Loại sản phẩm</div>
        <div className="filter-chips">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              className={`filter-chip${category === c.value ? ' active' : ''}`}
              onClick={() => setCategory(c.value)}
            >
              <span>
                <span className="filter-chip-icon">{c.icon}</span>
                {c.label}
              </span>
              <span className="filter-chip-count">{countByCategory[c.value]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Which plant the kit grows — the question a parent actually asks after
          "is this a kit?", and the one thing the sidebar had no answer for. */}
      {speciesOptions.length > 0 && (
        <div className="filter-section">
          <div className="filter-section-label">Giống cây</div>
          <div className="species-filter">
            <button
              className={`species-pick${species === 'all' ? ' active' : ''}`}
              onClick={() => setSpecies('all')}
            >
              <span className="species-pick-icon">
                <SproutyIcon name="leaf" size={19} />
              </span>
              <span className="species-pick-body">
                <strong>Tất cả giống</strong>
              </span>
              <span className="species-pick-count">
                {speciesOptions.reduce((n, o) => n + o.count, 0)}
              </span>
            </button>

            {speciesOptions.map((option) => (
              <button
                key={option.key}
                className={`species-pick${species === option.key ? ' active' : ''}`}
                onClick={() => setSpecies(option.key)}
                title={`Thu hoạch ${option.harvest}`}
              >
                <span className="species-pick-icon">
                  <SproutyIcon name={option.icon as IconName} size={19} />
                </span>
                <span className="species-pick-body">
                  <strong>{option.label}</strong>
                  <em>thu hoạch {option.harvest}</em>
                </span>
                <span className="species-pick-count">{option.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="filter-section">
        <div className="filter-section-label">Độ tuổi</div>
        <div className="filter-age-grid">
          {AGE_BANDS.map((a) => (
            <button
              key={a.value}
              className={`filter-age-btn${age === a.value ? ' active' : ''}`}
              onClick={() => setAge(a.value)}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-section">
        <div className="filter-section-label">Khoảng giá</div>
        <div className="price-inputs">
          <div className="price-input-wrap">
            <label htmlFor="priceMin">Từ (đ)</label>
            <input
              className="price-input"
              type="number"
              id="priceMin"
              min={0}
              placeholder="Tối thiểu"
              value={priceMin}
              onChange={(e) => {
                setPriceMin(e.target.value);
                setPricePreset('all');
              }}
            />
          </div>
          <div className="price-input-wrap">
            <label htmlFor="priceMax">Đến (đ)</label>
            <input
              className="price-input"
              type="number"
              id="priceMax"
              min={0}
              placeholder="Tối đa"
              value={priceMax}
              onChange={(e) => {
                setPriceMax(e.target.value);
                setPricePreset('all');
              }}
            />
          </div>
        </div>
        <div className="price-quick">
          {PRICE_PRESETS.map((p) => (
            <button
              key={p.value}
              className={`price-quick-btn${pricePreset === p.value ? ' active' : ''}`}
              onClick={() => applyPricePreset(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-section">
        <div className="filter-section-label">Nhãn sản phẩm</div>
        <div className="filter-badge-row">
          {BADGES.map((b) => (
            <button
              key={b.value}
              className={`badge-pill ${b.value === 'all' ? 'all' : b.value}${badge === b.value ? ' active' : ''}`}
              onClick={() => setBadge(b.value)}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <>
      <div className="shop-hero">
        <div className="shop-hero-glow" />
        <div className="container">
          <div className="breadcrumb shop-hero-crumb">
            <Link to="/">Trang chủ</Link> › Cửa hàng
          </div>
          <h1>Cửa hàng Sprouty</h1>
          <p>Cây mô phỏng, thiết bị IoT ảo và gói VIP Garden cho cả gia đình.</p>
        </div>
      </div>

      <div className="container">
        <PromoBanner className="shop-promo" />
        <div className="shop-wrap">
          <aside className="filter-sidebar">
            <div className="filter-head">
              <div className="filter-head-left">
                <span className="filter-head-icon">⚡</span>
                <h3>Bộ lọc</h3>
                <span className={`filter-active-count${activeTags.length ? ' show' : ''}`}>
                  {activeTags.length}
                </span>
              </div>
              <button className="filter-reset" onClick={resetFilters}>
                Xoá tất cả
              </button>
            </div>
            {filterPanel}
          </aside>

          <div className="products-main">
            <button className="filter-mobile-toggle" onClick={() => setDrawerOpen(true)}>
              <div className="filter-mobile-toggle-left">
                <span style={{ fontSize: '1.1rem' }}>⚡</span>
                <span>Bộ lọc &amp; Sắp xếp</span>
                {activeTags.length > 0 && (
                  <span className="filter-active-count show">{activeTags.length}</span>
                )}
              </div>
              <div className="filter-mobile-toggle-right">
                <span style={{ fontSize: '.78rem', color: 'var(--ink-4)' }}>
                  {results.length} sản phẩm
                </span>
                <span style={{ color: 'var(--ink-4)', fontSize: '.9rem' }}>›</span>
              </div>
            </button>

            <div className="shop-toolbar">
              <div className="search-field">
                <span className="search-field-icon">🔍</span>
                <input
                  type="search"
                  placeholder="Tìm tên, chủ đề, độ tuổi..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button
                  className={`search-clear${query ? ' show' : ''}`}
                  onClick={() => setQuery('')}
                  title="Xoá tìm kiếm"
                >
                  ✕
                </button>
              </div>

              <div className="sort-wrapper">
                <select
                  className="sort-select"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                >
                  <option value="">Mặc định</option>
                  <option value="pa">Giá: thấp → cao</option>
                  <option value="pd">Giá: cao → thấp</option>
                  <option value="az">Tên A → Z</option>
                  <option value="pop">Phổ biến nhất</option>
                </select>
              </div>

              <div className="view-toggle">
                <button
                  className={`view-btn${view === 'grid' ? ' active' : ''}`}
                  onClick={() => setView('grid')}
                  title="Dạng lưới"
                >
                  ⊞
                </button>
                <button
                  className={`view-btn${view === 'list' ? ' active' : ''}`}
                  onClick={() => setView('list')}
                  title="Dạng danh sách"
                >
                  ≡
                </button>
              </div>

              <div className="result-count">
                {loading ? 'Đang tải...' : <><strong>{results.length}</strong> sản phẩm</>}
              </div>
            </div>

            {activeTags.length > 0 && (
              <div className="active-filters">
                {activeTags.map((tag) => (
                  <span className="active-filter-tag" key={tag.label}>
                    {tag.label}
                    <button onClick={tag.clear} title="Bỏ lọc">
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}

            {error && <div className="shop-message">{error}</div>}

            {!error && !loading && results.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-emoji">🔍</div>
                <h3>Không tìm thấy sản phẩm nào</h3>
                <p>Thử thay đổi bộ lọc hoặc từ khoá tìm kiếm của bạn.</p>
                <button className="btn btn-primary btn-lg" onClick={resetFilters}>
                  Xoá tất cả bộ lọc
                </button>
              </div>
            )}

            {results.length > 0 && (
              <div className={view === 'list' ? 'grid-list' : 'grid-3col'}>
                {results.map((p) =>
                  view === 'list' ? (
                    <ProductListItem key={p.id} product={p} />
                  ) : (
                    <ProductCard key={p.id} product={p} />
                  ),
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        className={`filter-mobile-drawer${drawerOpen ? ' open' : ''}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setDrawerOpen(false);
        }}
      >
        <div className="filter-drawer-panel">
          <div className="filter-drawer-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.1rem' }}>⚡</span>
              <span className="filter-drawer-title">Bộ lọc sản phẩm</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button className="filter-drawer-reset" onClick={resetFilters}>
                Xoá tất cả
              </button>
              <button className="filter-drawer-close" onClick={() => setDrawerOpen(false)} aria-label="Đóng">
                ✕
              </button>
            </div>
          </div>

          <div style={{ padding: '4px 0 16px' }}>{filterPanel}</div>

          <div className="filter-drawer-footer">
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setDrawerOpen(false)}>
              Đóng
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setDrawerOpen(false)}>
              Xem {results.length} sản phẩm
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
