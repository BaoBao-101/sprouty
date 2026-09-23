import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Cart, type CartLine } from '@/services/cart';

interface CartValue {
  items: CartLine[];
  count: number;
  total: number;
  add: typeof Cart.add;
  remove: typeof Cart.remove;
  setQty: typeof Cart.setQty;
  register: typeof Cart.register;
  clear: typeof Cart.clear;
}

const CartContext = createContext<CartValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  // The cart module owns the data; this state exists only to trigger renders.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const unsubscribe = Cart.subscribe(() => setVersion((v) => v + 1));
    return () => {
      unsubscribe();
    };
  }, []);

  const value: CartValue = {
    items: Cart.items,
    count: Cart.count(),
    total: Cart.total(),
    add: Cart.add,
    remove: Cart.remove,
    setQty: Cart.setQty,
    register: Cart.register,
    clear: Cart.clear,
  };
  void version;

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart phải nằm trong <CartProvider>');
  return ctx;
}
