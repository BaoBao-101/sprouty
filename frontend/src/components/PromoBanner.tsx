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
  /** On the shop itself, where "Xem sản phẩm" would only lead back to it. */
  inShop?: boolean;
}

export function PromoBanner({ variant = 'full', className = '', inShop = false }: Props) {
  const { isLoggedIn } = useAuth();
  const rewards = useRewards();

  const threshold = rewards?.threshold ?? 3;
  const have = rewards?.progressInCycle ?? 0;
  const toNext = rewards?.unitsToNext ?? threshold;
  const available = rewards?.availableCount ?? 0;

  if (variant === 'slim') {
    return (
      <SlimPromo
        className={className}
        inShop={inShop}
        counted={isLoggedIn && Boolean(rewards)}
        threshold={threshold}
        have={have}
        toNext={toNext}
        available={available}
      />
    );
  }

  // A customer holding an unspent seat gets a different message: the useful
  // next action is booking it, not buying more. It still shows how close the
  // next one is, because the two facts used to be in branches that excluded
  // each other — holding a seat hid the progress bar entirely, so nobody
  // with a reward could see they were one purchase from the next.
  if (isLoggedIn && available > 0) {
    return (
      <div className={`promo promo-won promo-${variant} ${className}`}>
        <span className="promo-badge">
          <SproutyIcon name="ticket" size={26} />
        </span>
        <div className="promo-copy">
          <strong>
            Bạn đang có {available} suất workshop miễn phí
          </strong>
          <p>
            Chọn buổi bạn thích rồi dùng suất tặng khi đăng ký — không mất phí.
            {have > 0 && (
              <>
                {' '}Mua thêm <b>{toNext}</b> sản phẩm nữa là có suất tiếp theo.
              </>
            )}
          </p>

          <div className="promo-track">
            <div className="promo-pips" aria-hidden="true">
              {Array.from({ length: threshold }).map((_, i) => (
                <span key={i} className={`promo-pip${i < have ? ' filled' : ''}`}>
                  {i < have ? (
                    <SproutyIcon name="check" size={16} />
                  ) : (
                    <SproutyIcon name="seed" size={16} />
                  )}
                </span>
              ))}
            </div>
            <span className="promo-track-note">
              {have}/{threshold} cho suất kế tiếp
            </span>
          </div>
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

      {!inShop && (
        <Link to="/shop" className="promo-cta">
          {have > 0 ? `Mua thêm ${toNext}` : 'Xem sản phẩm'}
          <SproutyIcon name="arrow-right" size={18} />
        </Link>
      )}
    </div>
  );
}

/**
 * One line of offer for a page that has its own hero (the shop): the seats
 * already won, as a number that stands out, and the progress to the next one
 * as its own labelled bar — two facts the full banner ran together in a
 * sentence. Same figures, same rule; only the layout differs.
 */
function SlimPromo({
  className,
  inShop,
  counted,
  threshold,
  have,
  toNext,
  available,
}: {
  className: string;
  inShop: boolean;
  counted: boolean;
  threshold: number;
  have: number;
  toNext: number;
  available: number;
}) {
  const won = counted && available > 0;
  return (
    <div className={`promo-s${won ? ' is-won' : ''} ${className}`}>
      <span className="promo-s-icon">
        <SproutyIcon name={won ? 'ticket' : 'gift'} size={22} />
      </span>
      <div className="promo-s-main">
        {won ? (
          <p className="promo-s-title">
            <b className="promo-s-count">{available}</b> suất workshop miễn phí đang chờ bạn
          </p>
        ) : (
          <p className="promo-s-title">Mua {threshold} bộ kit trồng cây — tặng 1 suất workshop miễn phí</p>
        )}
        {counted ? (
          <div className="promo-s-progress">
            <span className="promo-s-label">{won ? 'Suất kế tiếp' : 'Tiến độ'}</span>
            <span
              className="promo-s-bar"
              role="progressbar"
              aria-label="Số sản phẩm đã mua cho suất kế tiếp"
              aria-valuemin={0}
              aria-valuemax={threshold}
              aria-valuenow={have}
            >
              {Array.from({ length: threshold }).map((_, i) => (
                <i key={i} className={i < have ? 'is-on' : undefined} />
              ))}
            </span>
            <span className="promo-s-note">
              <b>{have}/{threshold}</b> sản phẩm{have > 0 && toNext > 0 ? ` · còn ${toNext}` : ''}
            </span>
          </div>
        ) : (
          <p className="promo-s-sub">
            Buổi nào cũng được, bạn tự chọn. <Link to="/login">Đăng nhập</Link> để theo dõi tiến độ.
          </p>
        )}
      </div>
      {won ? (
        <Link to="/workshop" className="promo-s-cta">
          Chọn workshop
          <SproutyIcon name="arrow-right" size={17} />
        </Link>
      ) : (
        !inShop && (
          <Link to="/shop" className="promo-s-cta is-soft">
            Xem sản phẩm
            <SproutyIcon name="arrow-right" size={17} />
          </Link>
        )
      )}
    </div>
  );
}
