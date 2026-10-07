import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { productImage, productFallbackImage } from '@/services/products';
import { BADGE_LABEL, formatPrice, type Product } from '@/types/product';

/** Row layout used by the shop's list view. */
export function ProductListItem({ product }: { product: Product }) {
  const navigate = useNavigate();
  const { add } = useCart();
  const [src, setSrc] = useState(() => productImage(product));
  const [imageFailed, setImageFailed] = useState(false);

  function handleImageError() {
    const fallback = productFallbackImage(product);
    if (src !== fallback) setSrc(fallback);
    else setImageFailed(true);
  }

  return (
    <div className="product-card-list" onClick={() => navigate(`/shop/${product.id}`)}>
      <div className="list-img" style={{ background: product.bg }}>
        {imageFailed ? (
          <span style={{ fontSize: '2.8rem' }}>{product.em}</span>
        ) : (
          <img src={src} alt={product.name} onError={handleImageError} />
        )}
      </div>

      <div className="list-body">
        <div className="list-meta">
          {product.species?.label || product.col} · {product.age}
        </div>
        <div className="list-name">{product.name}</div>
        <div className="list-desc">{product.desc}</div>
        <div className="list-tags">
          {product.badge && (
            <span className={`product-badge ${product.badge}`} style={{ position: 'static', fontSize: '.7rem' }}>
              {BADGE_LABEL[product.badge]}
            </span>
          )}
          <span className="tag">{product.age}</span>
        </div>
      </div>

      <div className="list-actions">
        <div>
          {product.old && <div className="list-old-price">{formatPrice(product.old)}</div>}
          <div className="list-price">{formatPrice(product.price)}</div>
        </div>
        <button
          className="btn btn-primary btn-sm"
          style={{ whiteSpace: 'nowrap' }}
          onClick={(e) => {
            e.stopPropagation();
            add(product.id, 1, product);
          }}
        >
          + Giỏ hàng
        </button>
      </div>
    </div>
  );
}
