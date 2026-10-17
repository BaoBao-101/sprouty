/**
 * Stars: a read-only row that can show a fraction (4.6 fills four and most of
 * a fifth), and a picker for writing a review.
 */

import { useState, type KeyboardEvent } from 'react';
import './Reviews.css';

const STAR = 'M12 3.2l2.62 5.31 5.86.85-4.24 4.13 1 5.84L12 16.58l-5.24 2.75 1-5.84-4.24-4.13 5.86-.85L12 3.2Z';

function Star({ size, fill }: { size: number; fill: number }) {
  const id = `st-${Math.round(fill * 100)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="rv-star">
      <defs>
        <clipPath id={id}>
          <rect x="0" y="0" width={24 * fill} height="24" />
        </clipPath>
      </defs>
      <path d={STAR} className="rv-star-empty" strokeWidth="1.5" strokeLinejoin="round" />
      {fill > 0 && <path d={STAR} className="rv-star-full" strokeWidth="1.5" strokeLinejoin="round" clipPath={`url(#${id})`} />}
    </svg>
  );
}

/** Read-only stars; `value` may be fractional. */
export function Stars({ value, size = 16, label }: { value: number; size?: number; label?: string }) {
  return (
    <span className="rv-stars" role="img" aria-label={label ?? `${value.toLocaleString('vi-VN')} trên 5 sao`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} fill={Math.max(0, Math.min(1, value - (n - 1)))} />
      ))}
    </span>
  );
}

/**
 * Five stars to tap straight from a prompt, so the form opens with that many
 * already chosen. Each is a 40px target.
 */
export function QuickStars({ onPick, label }: { onPick: (stars: number) => void; label?: string }) {
  const [hover, setHover] = useState(0);
  return (
    <span className="rv-quick" role="group" aria-label={label || 'Chấm sao'} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className="rv-quick-star"
          aria-label={`${n} sao`}
          onMouseEnter={() => setHover(n)}
          onFocus={() => setHover(n)}
          onBlur={() => setHover(0)}
          onClick={() => onPick(n)}
        >
          <Star size={26} fill={n <= hover ? 1 : 0} />
        </button>
      ))}
    </span>
  );
}

/**
 * Choosing a rating. Each star is a 44px target; hovering previews, the arrow
 * keys move, and the chosen label is announced.
 */
export function StarPicker({
  value,
  onChange,
  labels,
}: {
  value: number;
  onChange: (next: number) => void;
  labels: Record<string | number, string>;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onChange(Math.min(5, (value || 0) + 1)); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onChange(Math.max(1, (value || 2) - 1)); }
  }

  return (
    <div className="rv-picker">
      <div className="rv-picker-row" role="radiogroup" aria-label="Chọn số sao" onMouseLeave={() => setHover(0)} onKeyDown={onKey}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} sao — ${labels[n]}`}
            tabIndex={value ? (value === n ? 0 : -1) : n === 1 ? 0 : -1}
            className={`rv-picker-star${n <= shown ? ' is-on' : ''}`}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(0)}
            onClick={() => onChange(n)}
          >
            <Star size={34} fill={n <= shown ? 1 : 0} />
          </button>
        ))}
      </div>
      <span className={`rv-picker-label${shown ? ` is-${shown}` : ''}`} aria-live="polite">
        {shown ? labels[shown] : 'Chạm để chọn số sao'}
      </span>
    </div>
  );
}
