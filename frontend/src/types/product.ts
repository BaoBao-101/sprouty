export type ProductBadge = 'hot' | 'new' | 'sale' | null;

/**
 * The plant a kit grows, resolved server-side so the shop never has to keep
 * its own copy of the species catalogue.
 */
export interface ProductSpecies {
  key: string;
  label: string;
  icon: string;
  harvest: string;
  form: string;
  pollinate: boolean;
}

/** Shape the UI works with. The API returns a wordier version; see normalizeProduct. */
export interface Product {
  id: number;
  name: string;
  /** Emoji fallback shown when the product image fails to load. */
  em: string;
  /** Collection, e.g. "Sprouty Starter". */
  col: string;
  /** Category: 'kit' | 'book' | 'membership'. */
  cat: string;
  /** Which plant a kit grows. Null on anything that is not a kit. */
  species: ProductSpecies | null;
  /** Age range label, e.g. "4–10 tuổi". */
  age: string;
  price: number;
  old: number | null;
  /** Extra cost of the Smart (IoT) variant; null means standard only. */
  smartDelta: number | null;
  bg: string;
  desc: string;
  inc: string[];
  badge: ProductBadge;
  images: string[];
  status: string;
}

export const BADGE_LABEL: Record<Exclude<ProductBadge, null>, string> = {
  hot: '🔥 Bán chạy',
  new: '✨ Mới',
  sale: '🏷 Giảm giá',
};

export function formatPrice(value: number) {
  return value.toLocaleString('vi-VN') + 'đ';
}
