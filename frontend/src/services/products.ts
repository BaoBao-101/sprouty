import { API } from './api';
import type { Product } from '@/types/product';

/** The API speaks `emoji`/`collection`/`ageRange`; the UI speaks `em`/`col`/`age`. */
export function normalizeProduct(p: any): Product {
  return {
    id: p.id,
    name: p.name,
    em: p.em || p.emoji || '🎨',
    col: p.col || p.collection || '',
    cat: p.cat || p.category || '',
    age: p.age || p.ageRange || '',
    price: Number(p.price) || 0,
    old: p.old ?? p.oldPrice ?? null,
    smartDelta: p.smartDelta ?? p.smartPriceDelta ?? null,
    bg: p.bg || p.bgColor || '#FEF5EA',
    desc: p.desc || p.description || '',
    inc: p.inc || p.includes || [],
    badge: p.badge || null,
    images: p.images || [],
    status: p.status || 'published',
  };
}

/**
 * Product artwork lives under /assets/images/products. Entries that point at the
 * uploads directory ("product-images") are user uploads and are used as-is; the
 * rest fall back to the bundled SVG named after the product id.
 */
export function productImage(p: Product) {
  const first = p.images?.[0];
  if (first && !first.includes('product-images')) return first.startsWith('/') ? first : '/' + first;
  return `/assets/images/products/kit-${p.id}.svg`;
}

export function productFallbackImage(p: Product) {
  return `/assets/images/products/kit-${p.id}.svg`;
}

export async function fetchProducts(params?: Record<string, unknown>): Promise<Product[]> {
  const { products } = await API.products.list(params);
  return (products as any[]).map(normalizeProduct);
}

export async function fetchProduct(id: number | string): Promise<Product> {
  const { product } = await API.products.get(id);
  return normalizeProduct(product);
}
