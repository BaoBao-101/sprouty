import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { productImage, productFallbackImage } from '@/services/products';
import { BADGE_LABEL, formatPrice, type Product } from '@/types/product';

export function ProductCard({ product }: { product: Product }) {
  const navigate = useNavigate();
  const { add } = useCart();
  // Two-step fallback: uploaded image -> bundled SVG -> emoji.
  const [src, setSrc] = useState(() => productImage(product));
  const [imageFailed, setImageFailed] = useState(false);

  const open = () => navigate(`/shop/${product.id}`);

  function handleImageError() {
    const fallback = productFallbackImage(product);
    if (src !== fallback) setSrc(fallback);
    else setImageFailed(true);
  }

  return (
    <div
      className="product-card"
      role="article"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => e.key === 'Enter' && open()}
    >
      <div className="product-card-img" style={{ background: product.bg }}>
        {!imageFailed && (
          <img
            src={src}
            alt={product.name}
            loading="lazy"
            className="product-svg-img"
            onError={handleImageError}
          />
        )}
        {imageFailed && <span className="product-emoji">{product.em}</span>}
        {product.badge && (
          <span className={`product-badge ${product.badge}`}>{BADGE_LABEL[product.badge]}</span>
        )}
      </div>

      <div className="product-card-body">
        <div className="product-age">
          {product.species?.label || product.col} · {product.age}
        </div>
        <div className="product-name">{product.name}</div>
        <div className="product-desc">{product.desc}</div>

        <div className="product-footer">
          <div>
            {product.old && <span className="product-old-price">{formatPrice(product.old)}</span>}
            <span className="product-price">{formatPrice(product.price)}</span>
          </div>
          <button
            className="add-btn"
            title="Thêm vào giỏ"
            aria-label={`Thêm ${product.name} vào giỏ`}
            onClick={(e) => {
              e.stopPropagation();
              add(product.id, 1, product);
            }}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
