import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { productImage } from '@/services/products';
import { BADGE_LABEL, formatPrice, type Product } from '@/types/product';

const SLIDE_MS = 4000;
const SWIPE_THRESHOLD = 40;

function badgeOf(p: Product) {
  return p.badge ? BADGE_LABEL[p.badge] : p.age;
}

function Slide({ product, onOpen }: { product: Product; onOpen: () => void }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="hero-carousel-slide" style={{ background: product.bg, cursor: 'pointer' }} onClick={onOpen}>
      {failed ? (
        <div className="slide-fallback" style={{ display: 'flex' }}>
          <span className="slide-em">{product.em}</span>
          <span className="slide-name">{product.name}</span>
        </div>
      ) : (
        <img
          src={productImage(product)}
          alt={product.name}
          style={{ objectFit: 'contain', padding: 24 }}
          onError={() => setFailed(true)}
        />
      )}
      <div className="slide-label">
        <span>{product.name}</span>
        <span className="slide-badge">{badgeOf(product)}</span>
      </div>
    </div>
  );
}

function FloatCard({ product, className }: { product: Product | undefined; className: string }) {
  const [iconFailed, setIconFailed] = useState(false);
  if (!product) return null;

  return (
    <div className={`float-card ${className}`}>
      <div className="float-icon" style={{ background: product.bg }}>
        {iconFailed ? (
          product.em
        ) : (
          <img
            src={`/assets/images/sprouty-icons/${product.name}.png`}
            alt=""
            style={{ objectFit: 'contain', padding: 4 }}
            onError={() => setIconFailed(true)}
          />
        )}
      </div>
      <div>
        <div className="float-name">{product.name}</div>
        <div className="float-sub">
          {product.price ? `${formatPrice(product.price)} · ${badgeOf(product)}` : badgeOf(product)}
        </div>
      </div>
    </div>
  );
}

/** Auto-advancing product carousel. Pauses on hover, supports dots and swipe. */
export function HeroCarousel({ products }: { products: Product[] }) {
  const navigate = useNavigate();
  const slides = products.filter((p) => p.cat === 'kit');
  const total = slides.length;

  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef(0);

  const go = useCallback(
    (index: number) => {
      if (total === 0) return;
      setCurrent(((index % total) + total) % total);
    },
    [total],
  );

  useEffect(() => {
    if (paused || total < 2) return;
    const timer = setInterval(() => setCurrent((c) => (c + 1) % total), SLIDE_MS);
    return () => clearInterval(timer);
  }, [paused, total]);

  if (total === 0) return <div className="hero-carousel-wrap" />;

  return (
    <div
      className="hero-carousel-wrap"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="hero-carousel-inner"
        onTouchStart={(e) => {
          touchX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > SWIPE_THRESHOLD) go(dx < 0 ? current + 1 : current - 1);
        }}
      >
        <div className="hero-carousel-track" style={{ transform: `translateX(-${current * 100}%)` }}>
          {slides.map((p) => (
            <Slide key={p.id} product={p} onOpen={() => navigate(`/shop/${p.id}`)} />
          ))}
        </div>
      </div>

      <button className="hero-carousel-btn prev" onClick={() => go(current - 1)} aria-label="Trước">
        ‹
      </button>
      <button className="hero-carousel-btn next" onClick={() => go(current + 1)} aria-label="Sau">
        ›
      </button>

      <div className="hero-carousel-dots">
        {slides.map((p, i) => (
          <button
            key={p.id}
            className={`hero-dot${i === current ? ' active' : ''}`}
            onClick={() => go(i)}
            aria-label={`Ảnh ${i + 1}`}
          />
        ))}
      </div>

      <FloatCard product={slides[current]} className="float-card-1" />
      <FloatCard product={slides[(current - 1 + total) % total]} className="float-card-2" />
    </div>
  );
}
