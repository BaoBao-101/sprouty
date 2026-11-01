export type ProductBadge = 'hot' | 'new' | 'sale' | null;

/**
 * The plant a kit grows, resolved server-side so the shop never has to keep
 * its own copy of the species catalogue.
 */
/** Who a species is, the same for every kit of it (backend/src/services/species-profile.js). */
export interface SpeciesProfile {
  scientificName: string;
  family: string;
  otherNames: string[];
  origin: string;
  story: string;
  traits: string[];
  funFacts: string[];
}

export interface ProductSpecies {
  key: string;
  label: string;
  icon: string;
  harvest: string;
  form: string;
  pollinate: boolean;
  /** Null for a kit with no particular species. */
  profile?: SpeciesProfile | null;
}

/** Shape the UI works with. The API returns a wordier version; see normalizeProduct. */
export interface Product {
  id: number;
  name: string;
  /** Emoji fallback shown when the product image fails to load. */
  em: string;
  /** Collection, e.g. "Bộ khởi đầu". */
  col: string;
  /** Category: 'kit' | 'book' | 'membership'. */
  cat: string;
  /** Which plant a kit grows. Null on anything that is not a kit. */
  species: ProductSpecies | null;
  /** Age range label, e.g. "4–10 tuổi". */
  age: string;
  price: number;
  old: number | null;
  /** Extra cost of the Smart · IoT variant (the kit with real IoT devices); null means Standard only. */
  smartDelta: number | null;
  bg: string;
  desc: string;
  /** What is in the box, either variant. */
  inc: string[];
  /** The IoT devices the Smart variant adds to the box. */
  smartInc: string[];
  badge: ProductBadge;
  images: string[];
  status: string;
  /** Average of published reviews, 0 when there are none. */
  rating?: number;
  /** How many published reviews. */
  reviewCount?: number;
}

export const BADGE_LABEL: Record<Exclude<ProductBadge, null>, string> = {
  hot: 'Bán chạy',
  new: 'Mới',
  sale: 'Giảm giá',
};

export function formatPrice(value: number) {
  return value.toLocaleString('vi-VN') + 'đ';
}
