import { useCallback, useEffect, useState } from 'react';
import { fetchProducts } from '@/services/products';
import { Cart } from '@/services/cart';
import type { Product } from '@/types/product';

interface State {
  products: Product[];
  loading: boolean;
  error: string | null;
}

/**
 * Loads the catalogue once and registers it with the cart, so `add(id)` can
 * resolve a product without the caller passing the whole object. `reload`
 * asks again, for a "Thử lại" after a failed load.
 */
export function useProducts(params?: Record<string, unknown>) {
  const [state, setState] = useState<State>({ products: [], loading: true, error: null });
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify(params ?? {});

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    fetchProducts(params)
      .then((products) => {
        if (cancelled) return;
        Cart.register(products);
        setState({ products, loading: false, error: null });
      })
      .catch((err: any) => {
        if (cancelled) return;
        setState({
          products: [],
          loading: false,
          error: err?.message || 'Không tải được sản phẩm. Vui lòng thử lại sau.',
        });
      });

    return () => {
      cancelled = true;
    };
    // `params` is an object literal at most call sites, so compare by content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload };
}
