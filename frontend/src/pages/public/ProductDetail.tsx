import { ProductVideos } from '@/components/ProductVideos';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ProductCard } from '@/components/ProductCard';
import { useCart } from '@/contexts/CartContext';
import { API } from '@/services/api';
import { normalizeProduct, productFallbackImage, productGalleryImages } from '@/services/products';
import { Cart } from '@/services/cart';
import { formatPrice, type Product } from '@/types/product';
import { SproutyIcon, type IconName } from '@/components/icons/SproutyIcon';
import './ProductDetail.css';

const CATEGORY_LABEL: Record<string, string> = {
  kit: 'Bộ kit trồng cây',
  book: 'Hướng dẫn chăm cây',
  membership: 'Gói thành viên',
};

const BADGE_TAG: Record<string, { label: string; tone: string }> = {
  hot: { label: 'Bán chạy', tone: 'red' },
  new: { label: 'Hàng mới', tone: 'indigo' },
  sale: { label: 'Đang giảm', tone: 'green' },
};

/** "quả đậu" → "Quả đậu" where it starts a value. */
const cap = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

const THUMB_BACKGROUNDS = ['#F8F8F8', '#FFF0E8', '#F0FDF4'];

const REVIEW_BARS: Array<[string, string, number]> = [
  ['5 sao', '80%', 14],
  ['4 sao', '12%', 2],
  ['3 sao', '5%', 1],
  ['2 sao', '2%', 1],
  ['1 sao', '1%', 0],
];

const REVIEWS = [
  {
    av: 'L',
    name: 'Nguyễn Thị Lan',
    loc: 'Quận 7 · Mua tháng 2/2026',
    bg: 'var(--terracotta)',
    text: 'Bé nhà mình mê lắm! Làm xong còn khoe với cả nhà.',
  },
  {
    av: 'H',
    name: 'Trần Văn Hùng',
    loc: 'Bình Thạnh · Mua tháng 1/2026',
    bg: 'var(--green)',
    text: 'Video hướng dẫn rõ ràng từng bước, bé 7 tuổi tự làm được.',
  },
  {
    av: 'P',
    name: 'Phạm Quỳnh Mai',
    loc: 'Quận 3 · Mua tháng 3/2026',
    bg: '#3B82F6',
    text: 'Quà sinh nhật hoàn hảo! Con mình 8 tuổi mất cả buổi chiều với nó.',
  },
];

type Tab = 'info' | 'videos' | 'reviews';
type Variant = 'standard' | 'smart';

function Gallery({ product }: { product: Product }) {
  const images = productGalleryImages(product);
  const fallback = productFallbackImage(product);
  const [index, setIndex] = useState(0);
  const [src, setSrc] = useState(() => images[0] || fallback);
  const [failed, setFailed] = useState(false);

  const isReal = images.length > 0 && src !== fallback;

  function select(i: number) {
    setIndex(i);
    setSrc(images[i]);
    setFailed(false);
  }

  function handleError() {
    if (src !== fallback) setSrc(fallback);
    else setFailed(true);
  }

  return (
    <div className="pdp-gallery">
      <div
        className={`pdp-img-main${isReal ? ' has-real-photo' : ''}`}
        style={{ background: index === 0 ? product.bg : THUMB_BACKGROUNDS[(index - 1) % THUMB_BACKGROUNDS.length] }}
      >
        {failed ? (
          <div className="pdp-img-fallback">{product.em}</div>
        ) : (
          <img
            src={src}
            alt={product.name}
            className={isReal ? 'pdp-real-img' : 'pdp-svg-img'}
            onError={handleError}
          />
        )}
        {product.badge && (
          <span className={`pdp-badge-main ${product.badge}`}>{BADGE_TAG[product.badge].label}</span>
        )}
      </div>

      {images.length > 1 && (
        <div className="pdp-thumbs">
          {images.map((image, i) => (
            <div
              key={image}
              className={`pdp-thumb${index === i ? ' active' : ''}`}
              style={{ background: i === 0 ? product.bg : THUMB_BACKGROUNDS[(i - 1) % THUMB_BACKGROUNDS.length] }}
              onClick={() => select(i)}
            >
              <img src={image} alt={`${product.name} ${i + 1}`} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { add } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading');

  const [qty, setQty] = useState(1);
  const [variant, setVariant] = useState<Variant>('standard');
  const [tab, setTab] = useState<Tab>(searchParams.get('tab') === 'videos' ? 'videos' : 'info');
  // How many instruction videos the kit has; it used to read a hard-coded 0.
  const [videoCount, setVideoCount] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    API.videos.summary(id).then((d: { count: number }) => live && setVideoCount(d.count ?? 0)).catch(() => live && setVideoCount(null));
    return () => {
      live = false;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');

    Promise.all([API.products.get(id), API.products.list().catch(() => ({ products: [] }))])
      .then(([detail, list]: any[]) => {
        if (cancelled) return;
        const item = normalizeProduct(detail.product);

        // VIP membership has its own page and purchase flow.
        if (item.cat === 'membership') {
          navigate('/vip', { replace: true });
          return;
        }

        const all = (list.products || []).map(normalizeProduct) as Product[];
        Cart.register(all.length ? all : [item]);

        const sameKind = all.filter((x) => x.id !== item.id && (x.cat === item.cat || x.col === item.col));
        const others = all.filter((x) => x.id !== item.id);

        setProduct(item);
        setRelated((sameKind.length ? sameKind : others).slice(0, 4));
        setStatus('ready');
      })
      .catch((err: any) => {
        if (cancelled) return;
        setStatus(err?.status === 404 ? 'missing' : 'failed');
      });

    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  useEffect(() => {
    if (product) document.title = `${product.name} — Sprouty`;
  }, [product]);

  const price = useMemo(() => {
    if (!product) return 0;
    return variant === 'smart' && product.smartDelta != null
      ? product.price + product.smartDelta
      : product.price;
  }, [product, variant]);

  const discount = product?.old ? Math.round((1 - product.price / product.old) * 100) : 0;

  function addToCart() {
    if (!product) return;
    add(product.id, qty, product, product.smartDelta != null ? variant : 'standard');
  }

  if (status === 'loading') {
    return <div className="pdp-state">Đang tải sản phẩm…</div>;
  }

  if (status !== 'ready' || !product) {
    const missing = status === 'missing';
    return (
      <div className="pdp-state">
        <span className="pdp-state-icon">
          <SproutyIcon name={missing ? 'info' : 'warning'} size={34} />
        </span>
        <h2>{missing ? 'Không tìm thấy sản phẩm' : 'Không thể tải sản phẩm'}</h2>
        <p>
          {missing
            ? 'Sản phẩm này không tồn tại hoặc đã bị xoá.'
            : 'Đã xảy ra lỗi kết nối. Vui lòng thử lại sau.'}
        </p>
        <Link to="/shop" className="btn btn-primary btn-lg">
          ← Về cửa hàng
        </Link>
      </div>
    );
  }

  const variantChoice = product.smartDelta != null;

  /** What a parent checks before buying, as four short facts. */
  const facts: Array<{ icon: IconName; label: string; value: string }> = [
    { icon: 'heart', label: 'Độ tuổi', value: product.age || '—' },
    ...(product.species
      ? [
          { icon: 'sprout' as IconName, label: 'Giống cây', value: product.species.label },
          { icon: 'harvest' as IconName, label: 'Thu hoạch', value: cap(product.species.harvest) },
        ]
      : []),
    { icon: 'bolt', label: 'Kích hoạt', value: 'Ngay sau thanh toán' },
  ];

  /** Promises that hold for every kit: the code now, the box by post. */
  const promises: Array<{ icon: IconName; text: string }> = [
    { icon: 'bolt', text: 'Nhận mã và gieo hạt ngay trên web' },
    { icon: 'chat', text: 'Plant Buddy AI hướng dẫn từng bước' },
    ...(videoCount ? [{ icon: 'camera' as IconName, text: `${videoCount} video hướng dẫn` }] : []),
    { icon: 'check', text: 'Hoàn tiền 100% nếu mã chưa kích hoạt (7 ngày)' },
  ];

  return (
    <>
      <div className="container">
        <div className="breadcrumb pdp-crumb">
          <Link to="/">Trang chủ</Link> › <Link to="/shop">Sản phẩm</Link> ›{' '}
          <span className="pdp-crumb-current">{product.name}</span>
        </div>

        <div className="pdp-wrap">
          <Gallery key={JSON.stringify([product.id, product.images])} product={product} />

          {/* ── The buying box ─────────────────────────────────────────── */}
          <div className="pdp-info">
            <span className="pdp-kicker">
              {CATEGORY_LABEL[product.cat] ?? product.cat}
              {product.col ? ` · ${product.col}` : ''}
            </span>
            <h1 className="pdp-name">{product.name}</h1>

            <div className="pdp-rating">
              <span className="pdp-stars" aria-hidden="true">★★★★★</span>
              <span>4.9</span>
              <button
                className="pdp-rating-link"
                onClick={() => {
                  setTab('reviews');
                  document.getElementById('chi-tiet')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                18 đánh giá
              </button>
            </div>

            <p className="pdp-desc">{product.desc}</p>

            <div className="pdp-price-box">
              <div className="pdp-price-wrap">
                <span className="pdp-price">{formatPrice(price)}</span>
                {/* The strike-through only makes sense against the standard price. */}
                {product.old && variant === 'standard' && (
                  <>
                    <span className="pdp-price-old">{formatPrice(product.old)}</span>
                    <span className="pdp-discount-badge">−{discount}%</span>
                  </>
                )}
              </div>

              {variantChoice && (
                <div className="pdp-variants" role="radiogroup" aria-label="Phiên bản">
                  {(
                    [
                      {
                        key: 'standard',
                        name: 'Standard',
                        price: product.price,
                        note: 'Thiết bị IoT mở dần theo từng chặng cây lớn.',
                        img: '/assets/images/sprouty-icons/StandardVariant.png',
                      },
                      {
                        key: 'smart',
                        name: 'Smart · IoT',
                        price: product.price + (product.smartDelta || 0),
                        // What Smart unlocks on the 3D plant — every IoT
                        // device from day one (createPlantForProduct in
                        // services/plants.js); the devices are virtual.
                        note: 'Mở sẵn cả 7 thiết bị IoT từ ngày đầu tiên.',
                        img: '/assets/images/sprouty-icons/SmartVariant.png',
                      },
                    ] as const
                  ).map((v) => (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={variant === v.key}
                      key={v.key}
                      className={`pdp-variant${variant === v.key ? ' active' : ''}`}
                      onClick={() => setVariant(v.key)}
                    >
                      <img src={v.img} alt="" />
                      <span className="pdp-variant-text">
                        <strong>{v.name}</strong>
                        <em>{formatPrice(v.price)}</em>
                        <small>{v.note}</small>
                      </span>
                      <span className="pdp-variant-check" aria-hidden="true">
                        {variant === v.key && <SproutyIcon name="check" size={13} />}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className="pdp-buy">
                <div className="pdp-qty" aria-label="Số lượng">
                  <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Giảm" disabled={qty <= 1}>
                    −
                  </button>
                  <span>{qty}</span>
                  <button onClick={() => setQty((q) => Math.min(10, q + 1))} aria-label="Tăng" disabled={qty >= 10}>
                    +
                  </button>
                </div>
                <button className="btn btn-outline pdp-add" onClick={addToCart}>
                  <SproutyIcon name="cart" size={18} />
                  Thêm vào giỏ
                </button>
                <button
                  className="btn btn-primary pdp-now"
                  onClick={() => {
                    addToCart();
                    navigate('/cart');
                  }}
                >
                  Mua ngay
                  <SproutyIcon name="arrow-right" size={17} />
                </button>
              </div>
            </div>

            <ul className="pdp-promises">
              {promises.map((p) => (
                <li key={p.text}>
                  <SproutyIcon name={p.icon} size={17} />
                  {p.text}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Facts strip ──────────────────────────────────────────────── */}
        <ul className="pdp-facts">
          {facts.map((f) => (
            <li key={f.label}>
              <span className="pdp-fact-icon">
                <SproutyIcon name={f.icon} size={20} />
              </span>
              <span>
                <em>{f.label}</em>
                <strong>{f.value}</strong>
              </span>
            </li>
          ))}
        </ul>

        {/* ── Details, full width ──────────────────────────────────────── */}
        <section className="pdp-details" id="chi-tiet">
          <div className="pdp-tabs" role="tablist">
            {(
              [
                ['info', 'Tổng quan'],
                ['videos', `Video hướng dẫn${videoCount !== null ? ` (${videoCount})` : ''}`],
                ['reviews', 'Đánh giá (18)'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                className={`pdp-tab-btn${tab === key ? ' active' : ''}`}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'info' && (
            <div className="pdp-overview">
              <div className="pdp-panel">
                <h3>
                  <SproutyIcon name="gift" size={19} /> Bộ kit gồm có
                </h3>
                {product.inc.length > 0 ? (
                  <ul className="pdp-includes">
                    {product.inc.map((item) => (
                      <li key={item}>
                        <span className="pdp-check">✓</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="pdp-muted">Thông tin đang được cập nhật.</p>
                )}
              </div>

              <div className="pdp-panel">
                <h3>
                  <SproutyIcon name="info" size={19} /> Thông số
                </h3>
                <dl className="pdp-specs">
                  <div>
                    <dt>Loại sản phẩm</dt>
                    <dd>{CATEGORY_LABEL[product.cat] ?? product.cat}</dd>
                  </div>
                  <div>
                    <dt>Độ tuổi khuyến nghị</dt>
                    <dd>{product.age}</dd>
                  </div>
                  <div>
                    <dt>Bộ sưu tập</dt>
                    <dd>{product.col}</dd>
                  </div>
                  {product.species && (
                    <>
                      <div>
                        <dt>Giống cây mô phỏng</dt>
                        <dd>{product.species.label}</dd>
                      </div>
                      <div>
                        <dt>Thu hoạch</dt>
                        <dd>{cap(product.species.harvest)}</dd>
                      </div>
                    </>
                  )}
                  <div>
                    <dt>Hình thức</dt>
                    <dd>Hộp kit gửi tận nhà · cây 3D kích hoạt bằng mã</dd>
                  </div>
                  <div>
                    <dt>Phát triển bởi</dt>
                    <dd>Sprouty · Việt Nam</dd>
                  </div>
                </dl>
              </div>
            </div>
          )}

          {tab === 'videos' && (
            <div className="pdp-pane">
              <ProductVideos productId={product.id} />
            </div>
          )}

          {tab === 'reviews' && (
            <div className="pdp-pane pdp-reviews">
              <div className="pdp-review-summary">
                <div className="pdp-review-score">
                  <strong>4.9</strong>
                  <span className="pdp-stars">★★★★★</span>
                  <em>18 đánh giá</em>
                </div>
                <div className="pdp-review-bars">
                  {REVIEW_BARS.map(([label, width, count]) => (
                    <div className="pdp-review-bar" key={label}>
                      <span>{label}</span>
                      <i>
                        <b style={{ width }} />
                      </i>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pdp-review-list">
                {REVIEWS.map((review) => (
                  <article className="pdp-review" key={review.name}>
                    <header>
                      <span className="pdp-review-av" style={{ background: review.bg }}>
                        {review.av}
                      </span>
                      <span>
                        <strong>{review.name}</strong>
                        <em>{review.loc}</em>
                      </span>
                      <span className="pdp-stars">★★★★★</span>
                    </header>
                    <p>“{review.text}”</p>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>

        {related.length > 0 && (
          <section className="related-section">
            <div className="related-head">
              <div>
                <span className="label">Có thể bạn thích</span>
                <h2>Sản phẩm liên quan</h2>
              </div>
              <Link to="/shop" className="btn btn-outline btn-sm">
                Xem tất cả
                <SproutyIcon name="arrow-right" size={15} />
              </Link>
            </div>
            <div className="grid-4">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* On a phone the buy buttons scroll away; keep the price and one
          button on screen. */}
      <div className="pdp-mobile-bar">
        <span>
          <strong>{formatPrice(price)}</strong>
          {variantChoice && <em>{variant === 'smart' ? 'Smart · IoT' : 'Standard'}</em>}
        </span>
        <button className="btn btn-primary" onClick={addToCart}>
          <SproutyIcon name="cart" size={17} /> Thêm vào giỏ
        </button>
      </div>
    </>
  );
}
