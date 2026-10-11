import { Link } from 'react-router-dom';
import type { AiProduct } from '@/contexts/AiChatContext';
import { formatPrice } from '@/types/product';
import './AiProductLinks.css';

export function AiProductLinks({ products }: { products?: AiProduct[] }) {
  if (!products?.length) return null;
  return <div className="ai-product-links" aria-label="Kit được gợi ý">{products.map(product => <Link key={product.id} to={`/shop/${product.id}`} className="ai-product-link">
    {product.image && <img src={product.image} alt="" onError={event => { event.currentTarget.style.display = 'none'; }} />}
    <span><strong>{product.name}</strong><small>{product.ageRange} · {formatPrice(product.price)}</small><b>Xem bộ kit →</b></span>
  </Link>)}</div>;
}
