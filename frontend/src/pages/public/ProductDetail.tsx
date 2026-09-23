import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ProductCard } from '@/components/ProductCard';
import { useCart } from '@/contexts/CartContext';
import { API } from '@/services/api';
import { normalizeProduct, productFallbackImage } from '@/services/products';
import { Cart } from '@/services/cart';
import { formatPrice, type Product } from '@/types/product';
import './ProductDetail.css';

const CATEGORY_LABEL: Record<string, string> = {
  kit: 'Bộ kit trồng cây',
  book: 'Hướng dẫn chăm cây',
  membership: 'Gói thành viên',
};

const BADGE_TAG: Record<string, { label: string; tone: string }> = {
  hot: { label: '🔥 Bán chạy', tone: 'red' },
  new: { label: '✨ Hàng mới', tone: 'indigo' },
  sale: { label: '🏷 Đang giảm', tone: 'green' },
};

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

/** Real photos only; the legacy "product-images" uploads path is dead. */
function galleryImages(product: Product) {
  return (product.images || []).filter((u) => u && !u.includes('product-images'));
}

function Gallery({ product }: { product: Product }) {
  const images = galleryImages(product);
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
        <div className="pdp-state-emoji">{missing ? '😕' : '⚠️'}</div>
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

  return (
    <>
      <div className="pdp-crumb-bar">
        <div className="container">
          <div className="breadcrumb">
            <Link to="/">Trang chủ</Link> › <Link to="/shop">Sản phẩm</Link> ›{' '}
            <span className="pdp-crumb-current">{product.name}</span>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="pdp-wrap">
          <Gallery product={product} />

          <div className="pdp-info">
            <div className="pdp-tags">
              <span className="pdp-tag blue">{CATEGORY_LABEL[product.cat] ?? product.cat}</span>
              <span className="pdp-tag gray">{product.age}</span>
              <span className="pdp-tag gray">{product.col}</span>
              {product.badge && (
                <span className={`pdp-tag ${BADGE_TAG[product.badge].tone}`}>
                  {BADGE_TAG[product.badge].label}
                </span>
              )}
            </div>

            <h1 className="pdp-name">{product.name}</h1>

            <div className="pdp-rating">
              <span className="pdp-stars">★★★★★</span>
              <span className="pdp-rating-count">4.9 ·</span>
              <button className="pdp-rating-link" onClick={() => setTab('reviews')}>
                18 đánh giá
              </button>
            </div>

            <div className="pdp-price-wrap">
              <span className="pdp-price">{formatPrice(price)}</span>
              {/* The strike-through only makes sense against the standard price. */}
              {product.old && variant === 'standard' && (
                <>
                  <span className="pdp-price-old">{formatPrice(product.old)}</span>
                  <span className="pdp-discount-badge">Giảm {discount}%</span>
                </>
              )}
            </div>

            {product.smartDelta != null && (
              <div className="pdp-qty-section">
                <div className="pdp-qty-label">Phiên bản</div>
                <div className="pdp-variant-row">
                  <label className="pdp-variant-opt">
                    <img
                      src="/assets/images/sprouty-icons/StandardVariant.png"
                      alt="Standard"
                      className="pdp-variant-thumb"
                    />
                    <input
                      type="radio"
                      name="pdpVariant"
                      value="standard"
                      checked={variant === 'standard'}
                      onChange={() => setVariant('standard')}
                    />
                    <div>
                      <strong>Standard</strong>
                      <div className="pdp-variant-price">{formatPrice(product.price)}</div>
                    </div>
                  </label>

                  <label className="pdp-variant-opt">
                    <img
                      src="/assets/images/sprouty-icons/SmartVariant.png"
                      alt="Smart IoT"
                      className="pdp-variant-thumb"
                    />
                    <input
                      type="radio"
                      name="pdpVariant"
                      value="smart"
                      checked={variant === 'smart'}
                      onChange={() => setVariant('smart')}
                    />
                    <div>
                      <strong>Smart · IoT 🤖</strong>
                      <div className="pdp-variant-price">
                        {formatPrice(product.price + product.smartDelta)}
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            )}

            <p className="pdp-desc">{product.desc}</p>
            <div className="pdp-divider" />

            <div className="pdp-qty-section">
              <div className="pdp-qty-label">Số lượng</div>
              <div className="pdp-qty-row">
                <button
                  className="pdp-qty-btn"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  aria-label="Giảm"
                >
                  −
                </button>
                <div className="pdp-qty-num">{qty}</div>
                <button
                  className="pdp-qty-btn"
                  onClick={() => setQty((q) => Math.min(10, q + 1))}
                  aria-label="Tăng"
                >
                  +
                </button>
              </div>
              <div className="pdp-stock">Còn hàng · Giao 2–3 ngày làm việc</div>
            </div>

            <div className="pdp-cta">
              <button className="btn-add" onClick={addToCart}>
                <img src="/assets/images/sprouty-icons/Cart.png" alt="" className="pdp-cta-icon" />
                Thêm vào giỏ
              </button>
              <button
                className="btn-buy"
                onClick={() => {
                  addToCart();
                  navigate('/cart');
                }}
              >
                Mua ngay →
              </button>
            </div>

            <div className="trust-badges">
              <div className="trust-badge"><span>🚚</span><span>Miễn phí ship từ 200.000đ</span></div>
              <div className="trust-badge"><span>🔄</span><span>Hoàn tiền trong 7 ngày</span></div>
              <div className="trust-badge"><span>✅</span><span>An toàn cho trẻ em</span></div>
              <div className="trust-badge"><span>🎬</span><span>Video hướng dẫn kèm theo</span></div>
            </div>

            <div className="pdp-tabs">
              <button
                className={`pdp-tab-btn${tab === 'info' ? ' active' : ''}`}
                onClick={() => setTab('info')}
              >
                Thông tin
              </button>
              <button
                className={`pdp-tab-btn${tab === 'videos' ? ' active' : ''}`}
                onClick={() => setTab('videos')}
              >
                Video (0)
              </button>
              <button
                className={`pdp-tab-btn${tab === 'reviews' ? ' active' : ''}`}
                onClick={() => setTab('reviews')}
              >
                Đánh giá (18)
              </button>
            </div>

            {tab === 'info' && (
              <div className="tab-pane active">
                {product.inc.length > 0 && (
                  <>
                    <h4 className="pdp-subhead">📦 Bộ kit gồm có</h4>
                    <div className="pdp-includes">
                      {product.inc.map((item) => (
                        <div className="include-item" key={item}>
                          <div className="include-check">✓</div>
                          <div className="include-text">{item}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <h4 className="pdp-subhead">📋 Thông số</h4>
                <div>
                  <div className="spec-row">
                    <span className="spec-label">Độ tuổi khuyến nghị</span>
                    <span className="spec-val">{product.age}</span>
                  </div>
                  <div className="spec-row">
                    <span className="spec-label">Bộ sưu tập</span>
                    <span className="spec-val">{product.col}</span>
                  </div>
                  <div className="spec-row">
                    <span className="spec-label">Loại sản phẩm</span>
                    <span className="spec-val">{CATEGORY_LABEL[product.cat] ?? product.cat}</span>
                  </div>
                  <div className="spec-row">
                    <span className="spec-label">Chứng nhận an toàn</span>
                    <span className="spec-val" style={{ color: 'var(--green)' }}>
                      ✓ Đạt chuẩn EN71
                    </span>
                  </div>
                  <div className="spec-row">
                    <span className="spec-label">Xuất xứ</span>
                    <span className="spec-val">Việt Nam 🇻🇳</span>
                  </div>
                </div>
              </div>
            )}

            {tab === 'videos' && (
              <div className="tab-pane active pdp-empty-tab">
                <div className="pdp-empty-emoji">🎬</div>
                <h4>Video đang được chuẩn bị</h4>
                <p>Sẽ có sẵn trước khi sản phẩm được giao đến bạn.</p>
              </div>
            )}

            {tab === 'reviews' && (
              <div className="tab-pane active">
                <div className="review-summary-wrap">
                  <div className="review-score-col">
                    <div className="review-score-big">4.9</div>
                    <div className="review-score-stars">★★★★★</div>
                    <div className="review-score-sub">18 đánh giá</div>
                  </div>
                  <div className="review-bars">
                    {REVIEW_BARS.map(([label, width, count]) => (
                      <div className="review-bar-row" key={label}>
                        <span className="review-bar-label">{label}</span>
                        <div className="review-bar-track">
                          <div className="review-bar-fill" style={{ width }} />
                        </div>
                        <span className="review-bar-count">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  {REVIEWS.map((review) => (
                    <div className="review-item" key={review.name}>
                      <div className="reviewer-row">
                        <div className="reviewer-av" style={{ background: review.bg }}>
                          {review.av}
                        </div>
                        <div>
                          <div className="reviewer-name">{review.name}</div>
                          <div className="reviewer-loc">{review.loc}</div>
                        </div>
                        <div className="reviewer-stars">★★★★★</div>
                      </div>
                      <p className="review-text">“{review.text}”</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {related.length > 0 && (
          <div className="related-section">
            <div className="related-head">
              <div>
                <span className="label">Có thể bạn thích</span>
                <h2>Sản phẩm liên quan</h2>
              </div>
              <Link to="/shop" className="btn btn-outline btn-sm">
                Xem tất cả →
              </Link>
            </div>
            <div className="grid-4">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
