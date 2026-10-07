import { API } from './api';
import type { Product } from '@/types/product';

/**
 * A struck-through "before" price only means anything above the selling price.
 * The server now rejects the other order, but rows created before that check
 * existed still carry it — and rendered as a discount badge of −25% on a
 * product that had gone *up* in price. Dropping it here fixes every place that
 * shows a price at once, rather than each render site guessing.
 */
function usableOldPrice(old: unknown, price: number): number | null {
  const value = Number(old);
  if (!Number.isFinite(value) || value <= price) return null;
  return value;
}

/** The API speaks `emoji`/`collection`/`ageRange`; the UI speaks `em`/`col`/`age`. */
export function normalizeProduct(p: any): Product {
  const price = Number(p.price) || 0;
  return {
    id: p.id,
    name: p.name,
    em: p.em || p.emoji || '🎨',
    col: p.col || p.collection || '',
    cat: p.cat || p.category || '',
    species: p.species ?? null,
    age: p.age || p.ageRange || '',
    price,
    old: usableOldPrice(p.old ?? p.oldPrice, price),
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

/** The species the shop can filter by, with a count of kits for each. */
export async function fetchSpeciesFilters() {
  const { species } = await API.products.species();
  return species as Array<{ key: string; label: string; icon: string; count: number; harvest: string }>;
}

export async function fetchProducts(params?: Record<string, unknown>): Promise<Product[]> {
  const { products } = await API.products.list(params);
  return (products as any[]).map(normalizeProduct);
}

export async function fetchProduct(id: number | string): Promise<Product> {
  const { product } = await API.products.get(id);
  return normalizeProduct(product);
}
