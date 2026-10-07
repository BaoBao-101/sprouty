/**
 * "Mua 3 sản phẩm trồng cây — tặng 1 buổi workshop miễn phí."
 *
 * Shown as progress rather than as a slogan. A bare advert is easy to ignore;
 * "bạn đã có 2/3, mua thêm 1 nữa" tells the customer where they already are,
 * which is the part that actually moves a basket. For a visitor who is not
 * signed in there is nothing to count, so it falls back to the offer itself.
 *
 * The threshold is never hardcoded here — it comes from the server, so changing
 * the promotion is one environment variable and not a hunt through the markup.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { API } from '@/services/api';
import type { RewardSummary } from '@/types/plant';
import { SproutyIcon } from '@/components/icons/SproutyIcon';
import './PromoBanner.css';

/** Cached across pages so moving around the site does not refetch each time. */
let cached: RewardSummary | null = null;
const listeners = new Set<(value: RewardSummary | null) => void>();

/** Call after a purchase or a booking, so the progress is not stale. */
export function refreshRewards() {
  cached = null;
  void loadRewards();
}

async function loadRewards() {
  try {
    const data = await API.rewards.mine();
    cached = data;
  } catch {
    cached = null;
  }
  for (const fn of listeners) fn(cached);
  return cached;
}

export function useRewards() {
  const { isLoggedIn, ready } = useAuth();
  const [rewards, setRewards] = useState<RewardSummary | null>(cached);

  useEffect(() => {
    if (!ready || !isLoggedIn) {
      setRewards(null);
      return;
    }
    listeners.add(setRewards);
    if (cached) setRewards(cached);
    else void loadRewards();
    return () => {
      listeners.delete(setRewards);
    };
  }, [ready, isLoggedIn]);

  return rewards;
}

interface Props {
  /** `full` for the shop and cart, `slim` for a page that already has a hero. */
  variant?: 'full' | 'slim';
  className?: string;
}

export function PromoBanner({ variant = 'full', className = '' }: Props) {
  const { isLoggedIn } = useAuth();
  const rewards = useRewards();

  const threshold = rewards?.threshold ?? 3;
  const have = rewards?.progressInCycle ?? 0;
  const toNext = rewards?.unitsToNext ?? threshold;
  const available = rewards?.availableCount ?? 0;

  // A customer holding an unspent seat gets a different message: the useful
  // next action is booking it, not buying more.
  if (isLoggedIn && available > 0) {
    return (
      <div className={`promo promo-won promo-${variant} ${className}`}>
        <span className="promo-badge">
          <SproutyIcon name="ticket" size={26} />
        </span>
        <div className="promo-copy">
          <strong>
            Bạn đang có {available} suất workshop miễn phí!
          </strong>
          <p>Chọn buổi workshop bạn thích và dùng suất tặng khi đăng ký — không mất phí.</p>
        </div>
        <Link to="/workshop" className="promo-cta">
          Chọn workshop
          <SproutyIcon name="arrow-right" size={18} />
        </Link>
      </div>
    );
  }

  return (
    <div className={`promo promo-${variant} ${className}`}>
      <span className="promo-badge">
        <SproutyIcon name="gift" size={26} />
      </span>

      <div className="promo-copy">
        <strong>
          Mua {threshold} sản phẩm trồng cây — tặng 1 buổi workshop miễn phí
        </strong>
        {isLoggedIn && rewards ? (
          <p>
            {have === 0 ? (
              <>Bạn chưa có sản phẩm nào trong lượt này. Mua {threshold} là có ngay 1 suất workshop tuỳ chọn.</>
            ) : (
              <>
                Bạn đã có <b>{have}/{threshold}</b> — mua thêm <b>{toNext}</b> sản phẩm nữa là nhận
                suất workshop miễn phí.
              </>
            )}
          </p>
        ) : (
          <p>Buổi workshop nào cũng được, bạn tự chọn. Áp dụng cho mọi bộ kit trồng cây.</p>
        )}

        {isLoggedIn && rewards && (
          <div className="promo-pips" aria-hidden="true">
            {Array.from({ length: threshold }).map((_, i) => (
              <span key={i} className={`promo-pip${i < have ? ' filled' : ''}`}>
                {i < have ? <SproutyIcon name="check" size={16} /> : <SproutyIcon name="seed" size={16} />}
              </span>
            ))}
          </div>
        )}
      </div>

      <Link to="/shop" className="promo-cta">
        {have > 0 ? `Mua thêm ${toNext}` : 'Xem sản phẩm'}
        <SproutyIcon name="arrow-right" size={18} />
      </Link>
    </div>
  );
}
