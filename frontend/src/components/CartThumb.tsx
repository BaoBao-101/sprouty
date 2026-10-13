import { useState } from 'react';
import type { CartLine } from '@/services/cart';
import { SproutyIcon } from '@/components/icons/SproutyIcon';

const CATEGORY_BG: Record<string, string> = {
  kit: 'var(--terra-bg)',
  book: 'var(--sage-bg)',
  membership: 'var(--amber-bg)',
};

function lineImage(item: CartLine) {
  const first = item.images?.[0];
  if (first) return first.startsWith('/') ? first : '/' + first;
  return `/assets/images/products/kit-${item.id}.svg`;
}

/** What a cart line costs, and what it saves against its struck-through price. */
export const lineTotal = (item: CartLine) => (Number(item.price) || 0) * (item.qty || 1);
export const lineSaving = (item: CartLine) =>
  item.old && item.old > item.price ? (item.old - item.price) * (item.qty || 1) : 0;

/** A cart line's photo, square, with a pot in its place when there is none. */
export function CartThumb({ item, size }: { item: CartLine; size: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="ct-thumb" style={{ width: size, height: size, background: CATEGORY_BG[item.cat] ?? 'var(--cream)' }}>
      {failed ? (
        <SproutyIcon name="pot" size={Math.round(size * 0.4)} />
      ) : (
        <img src={lineImage(item)} alt="" onError={() => setFailed(true)} />
      )}
    </span>
  );
}
