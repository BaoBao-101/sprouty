/**
 * Reviews on the product page: the score, how it splits by stars, and the
 * reviews themselves — every one from a customer who received the kit.
 *
 * A signed-in customer who received this product and has not reviewed it is
 * asked to; one who has can change what they wrote.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { API } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { SproutyIcon } from '@/components/icons/SproutyIcon';
import { ReviewDialog } from './ReviewDialog';
import { ReviewsPanel } from './ReviewsPanel';
import type { EligibleProduct, MyReview, RatingSummary, ReviewOptions } from '@/types/review';

export function ProductReviews({
  product,
  onChanged,
}: {
  product: { id: number; name: string; image: string | null };
  /** The product's new score after the customer writes, edits or deletes. */
  onChanged?: (rating: number, count: number) => void;
}) {
  const { user, isLoggedIn } = useAuth();
  const [reloadKey, setReloadKey] = useState(0);
  const saved = useRef(false);

  // What this customer may do here.
  const [mine, setMine] = useState<MyReview | null>(null);
  const [eligible, setEligible] = useState<EligibleProduct | null>(null);
  const [options, setOptions] = useState<ReviewOptions | null>(null);
  const [writing, setWriting] = useState(false);

  const load = useCallback((params: Record<string, string>) => API.reviews.forProduct(product.id, params), [product.id]);

  const loadMine = useCallback(() => {
    if (!isLoggedIn || user?.role !== 'customer') return;
    API.reviews.mine()
      .then((data: any) => {
        setMine((data.reviews || []).find((r: MyReview) => r.productId === product.id) || null);
        setEligible((data.eligible || []).find((e: EligibleProduct) => e.productId === product.id) || null);
        setOptions(data.options || null);
      })
      .catch(() => {});
  }, [isLoggedIn, user?.role, product.id]);

  useEffect(loadMine, [loadMine]);

  // The page's own stars follow the panel once the customer has changed something.
  const onSummary = useCallback((s: RatingSummary) => {
    if (!saved.current) return;
    saved.current = false;
    onChanged?.(s.average, s.count);
  }, [onChanged]);

  const canWrite = Boolean(eligible) && !mine;

  const cta = mine ? (
    <>
      <p><b>Bạn đã đánh giá {mine.rating} sao</b>{mine.status === 'hidden' ? ' · đang bị ẩn' : ''}</p>
      <button type="button" className="rv-btn" onClick={() => setWriting(true)}>
        <SproutyIcon name="pencil" size={15} /> Sửa đánh giá
      </button>
    </>
  ) : canWrite ? (
    <>
      <p><b>Bạn đã nhận sản phẩm này</b><br />Chia sẻ trải nghiệm để giúp phụ huynh khác chọn đúng kit.</p>
      <button type="button" className="rv-btn is-primary" onClick={() => setWriting(true)}>
        <SproutyIcon name="star" size={15} /> Viết đánh giá
      </button>
    </>
  ) : (
    <p className="rv-cta-muted">
      <SproutyIcon name="check" size={15} /> Mọi đánh giá đều từ khách đã mua và nhận hàng.
    </p>
  );

  return (
    <>
      <ReviewsPanel
        load={load}
        reloadKey={reloadKey}
        cta={cta}
        verifiedLabel="Đã mua hàng"
        satisfiedLabel="khách hài lòng"
        emptyTitle="Sản phẩm chưa có đánh giá"
        emptyHint="Đánh giá đầu tiên sẽ đến từ phụ huynh đã nhận bộ kit này."
        onSummary={onSummary}
      />

      {writing && (
        <ReviewDialog
          target={product}
          existing={mine}
          options={options}
          onClose={() => setWriting(false)}
          onSaved={(review) => {
            setMine(review as MyReview | null);
            saved.current = true;
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </>
  );
}
