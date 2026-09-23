/**
 * Cart lives in localStorage, not on the server. Ported from the old app.js
 * module; the only structural change is the subscriber list, which lets React
 * re-render when a line is added from anywhere in the tree.
 */
import { showToast } from './toast';

export interface CartLine {
  id: number;
  name: string;
  em: string;
  col: string;
  cat: string;
  age: string;
  price: number;
  old: number | null;
  bg: string;
  images: string[];
  variant: 'standard' | 'smart';
  qty: number;
}

const STORAGE_KEY = 'sprouty_cart';

let items: CartLine[] = [];
let catalog: Record<number, any> = {};
const subscribers = new Set<() => void>();

function load() {
  try {
    items = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    items = [];
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* private mode / quota — the in-memory cart still works for this session */
  }
  subscribers.forEach((fn) => fn());
}

/** A line is (product, variant): the same kit can sit in the cart twice at
 *  different price points (Bean Standard and Bean Smart). */
function lineKey(id: number, variant?: string) {
  return `${id}:${variant || 'standard'}`;
}

/** Map an API product onto the keys the cart UI reads. */
function normalize(p: any, variant?: string): Omit<CartLine, 'qty'> {
  const smartDelta = p.smartDelta ?? p.smartPriceDelta ?? null;
  const basePrice = Number(p.price) || 0;
  return {
    id: p.id,
    name: p.name,
    em: p.em || p.emoji || '📦',
    col: p.col || p.collection || '',
    cat: p.cat || p.category || '',
    age: p.age || p.ageRange || '',
    price: variant === 'smart' ? basePrice + (Number(smartDelta) || 0) : basePrice,
    old: p.old ?? p.oldPrice ?? null,
    bg: p.bg || p.bgColor || 'var(--cream)',
    images: p.images || [],
    variant: variant === 'smart' ? 'smart' : 'standard',
  };
}

load();

export const Cart = {
  get items() {
    return items;
  },

  subscribe(fn: () => void) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  },

  reload: load,

  /** Pages register the catalog they loaded so `add(id)` works without the object. */
  register(products: any[]) {
    products.forEach((p) => {
      catalog[p.id] = p;
    });
  },

  add(id: number, qty = 1, product?: any, variant?: string) {
    load();
    const source = product || catalog[id];
    if (!source) {
      showToast('Không tìm thấy sản phẩm', 'error');
      return;
    }
    if (variant === 'smart' && (source.smartDelta ?? source.smartPriceDelta) == null) {
      variant = 'standard';
    }

    const line = normalize(source, variant);
    const key = lineKey(id, line.variant);
    const existing = items.find((x) => lineKey(x.id, x.variant) === key);
    if (existing) existing.qty = (existing.qty || 1) + qty;
    else items.push({ ...line, qty });

    save();
    showToast(`Đã thêm "${line.name}"${line.variant === 'smart' ? ' (Smart)' : ''} vào giỏ`, 'success');
  },

  remove(id: number, variant?: string) {
    load();
    const key = lineKey(id, variant);
    items = items.filter((x) => lineKey(x.id, x.variant) !== key);
    save();
  },

  setQty(id: number, variant: string | undefined, qty: number) {
    load();
    const key = lineKey(id, variant);
    const line = items.find((x) => lineKey(x.id, x.variant) === key);
    if (line) line.qty = Math.max(1, qty);
    save();
  },

  total() {
    return items.reduce((sum, i) => sum + (Number(i.price) || 0) * (i.qty || 1), 0);
  },

  count() {
    return items.reduce((sum, i) => sum + (i.qty || 1), 0);
  },

  clear() {
    items = [];
    save();
  },
};
