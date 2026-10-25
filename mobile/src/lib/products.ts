import { API } from './api';
import type { Product } from './types';

/** The API speaks `emoji`/`collection`/`ageRange`; the screens speak the short names (as the website does). */
export function normalizeProduct(p: any): Product {
  const price = Number(p.price) || 0;
  const old = Number(p.old ?? p.oldPrice);
  return {
    id: p.id,
    name: p.name,
    col: p.col || p.collection || '',
    cat: p.cat || p.category || '',
    species: p.species ?? null,
    age: p.age || p.ageRange || '',
    price,
    // A "before" price only means anything above the selling price.
    old: Number.isFinite(old) && old > price ? old : null,
    smartDelta: p.smartDelta ?? p.smartPriceDelta ?? null,
    bg: p.bg || p.bgColor || '#FEF5EA',
    desc: p.desc || p.description || '',
    inc: p.inc || p.includes || [],
    badge: p.badge || null,
    images: Array.isArray(p.images) ? p.images.filter((x: unknown) => typeof x === 'string' && x) : [],
    rating: Number(p.ratingAvg ?? p.rating) || 0,
    reviewCount: Number(p.ratingCount ?? p.reviewCount) || 0,
  };
}

export async function fetchProducts(): Promise<Product[]> {
  const { products } = await API.products.list();
  return ((products || []) as any[]).map(normalizeProduct).filter((p) => p.cat !== 'membership');
}

export const BADGE_LABEL: Record<string, string> = { hot: 'Bán chạy', new: 'Mới', sale: 'Giảm giá' };
