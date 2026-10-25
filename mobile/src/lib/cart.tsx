import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Product } from './types';

/**
 * The basket, kept on the phone like the website keeps it in the browser
 * (frontend/src/services/cart.ts). A line is (product, variant): the same kit
 * can be in it twice, as Standard and as Smart.
 */
export interface CartLine {
  id: number;
  name: string;
  price: number;
  old: number | null;
  images: string[];
  bg: string;
  variant: 'standard' | 'smart';
  qty: number;
}

/** The most one order line accepts (backend/src/routes/orders.js). */
export const MAX_QTY = 99;
const KEY = 'sprouty.cart';

interface CartValue {
  lines: CartLine[];
  count: number;
  total: number;
  saving: number;
  add: (product: Product, qty?: number, variant?: 'standard' | 'smart') => void;
  setQty: (id: number, variant: string, qty: number) => void;
  remove: (id: number, variant: string) => void;
  clear: () => void;
  /** Puts an unpaid order's products back, when it is being edited. */
  restore: (items: Array<{ product: Product; qty: number; variant?: string | null }>) => void;
}

const CartContext = createContext<CartValue | null>(null);
const key = (id: number, variant?: string | null) => `${id}:${variant === 'smart' ? 'smart' : 'standard'}`;

function lineFor(product: Product, variant: 'standard' | 'smart', qty: number): CartLine {
  const smart = variant === 'smart' && product.smartDelta != null;
  return {
    id: product.id,
    name: product.name,
    price: smart ? product.price + (product.smartDelta || 0) : product.price,
    old: product.old,
    images: product.images,
    bg: product.bg,
    variant: smart ? 'smart' : 'standard',
    qty,
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => raw && setLines(JSON.parse(raw)))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (loaded) void AsyncStorage.setItem(KEY, JSON.stringify(lines)).catch(() => {});
  }, [lines, loaded]);

  const add = useCallback((product: Product, qty = 1, variant: 'standard' | 'smart' = 'standard') => {
    const line = lineFor(product, variant, qty);
    setLines((current) => {
      const existing = current.find((l) => key(l.id, l.variant) === key(line.id, line.variant));
      if (existing) {
        return current.map((l) => (l === existing ? { ...l, qty: Math.min(MAX_QTY, l.qty + qty) } : l));
      }
      return [...current, line];
    });
  }, []);

  const setQty = useCallback((id: number, variant: string, qty: number) => {
    setLines((current) => current.map((l) => (key(l.id, l.variant) === key(id, variant) ? { ...l, qty: Math.max(1, Math.min(MAX_QTY, qty)) } : l)));
  }, []);

  const remove = useCallback((id: number, variant: string) => {
    setLines((current) => current.filter((l) => key(l.id, l.variant) !== key(id, variant)));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const restore = useCallback((items: Array<{ product: Product; qty: number; variant?: string | null }>) => {
    setLines((current) => {
      const next = [...current];
      for (const { product, qty, variant } of items) {
        const line = lineFor(product, variant === 'smart' ? 'smart' : 'standard', qty);
        const at = next.findIndex((l) => key(l.id, l.variant) === key(line.id, line.variant));
        if (at >= 0) next[at] = { ...next[at], qty: next[at].qty + qty };
        else next.push(line);
      }
      return next;
    });
  }, []);

  const value = useMemo<CartValue>(() => ({
    lines,
    count: lines.reduce((n, l) => n + l.qty, 0),
    total: lines.reduce((n, l) => n + l.price * l.qty, 0),
    saving: lines.reduce((n, l) => n + (l.old && l.old > l.price && l.variant === 'standard' ? (l.old - l.price) * l.qty : 0), 0),
    add, setQty, remove, clear, restore,
  }), [lines, add, setQty, remove, clear, restore]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be inside <CartProvider>');
  return ctx;
}
