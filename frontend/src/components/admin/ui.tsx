import { useEffect, useState, type ReactNode } from 'react';

/**
 * Shared shell pieces for the admin area.
 *
 * Every page used to hand-roll its own header, loading row, empty row and
 * pager, so the same idea looked different on each screen and a fix in one
 * place never reached the others. These are the building blocks all the admin
 * pages are now assembled from.
 */

/* ── Page header ─────────────────────────────────────────────── */

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="ad-head">
      <div className="ad-head-text">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="ad-head-actions">{actions}</div>}
    </header>
  );
}

/* ── Metric tiles ────────────────────────────────────────────── */

export type StatTone = 'orange' | 'green' | 'blue' | 'amber' | 'rose';

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="ad-stats">{children}</div>;
}

export function StatCard({
  icon,
  value,
  label,
  hint,
  tone = 'orange',
  loading,
}: {
  icon: string;
  value: ReactNode;
  label: string;
  hint?: ReactNode;
  tone?: StatTone;
  loading?: boolean;
}) {
  return (
    <div className={`ad-stat tone-${tone}`}>
      <span className="ad-stat-icon" aria-hidden="true">
        {icon}
      </span>
      <div className="ad-stat-body">
        <div className="ad-stat-value">{loading ? <span className="ad-skel w-60" /> : value}</div>
        <div className="ad-stat-label">{label}</div>
        {hint && <div className="ad-stat-hint">{hint}</div>}
      </div>
    </div>
  );
}

/* ── Card / panel ────────────────────────────────────────────── */

export function Panel({
  title,
  action,
  children,
  flush,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  /** No inner padding — for a panel whose body is a full-bleed table. */
  flush?: boolean;
}) {
  return (
    <section className="ad-panel">
      {title && (
        <div className="ad-panel-head">
          <h2>{title}</h2>
          {action}
        </div>
      )}
      <div className={flush ? 'ad-panel-body flush' : 'ad-panel-body'}>{children}</div>
    </section>
  );
}

/* ── Toolbar: filter pills + search ──────────────────────────── */

export interface FilterOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export function FilterPills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<FilterOption<T>>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="ad-pills" role="tablist">
      {options.map((option) => (
        <button
          key={option.value || 'all'}
          role="tab"
          aria-selected={value === option.value}
          className={`ad-pill${value === option.value ? ' active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.count !== undefined && <span className="ad-pill-count">{option.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="ad-toolbar">{children}</div>;
}

/** Search box that reports its value only once typing pauses. */
export function SearchBox({
  value,
  onChange,
  placeholder,
  delay = 400,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  delay?: number;
}) {
  const [text, setText] = useState(value);

  // Keep in step when the page resets the query (e.g. clearing a filter).
  useEffect(() => setText(value), [value]);

  useEffect(() => {
    if (text === value) return;
    const timer = setTimeout(() => onChange(text), delay);
    return () => clearTimeout(timer);
    // onChange is redefined on every render by most callers; depending on it
    // would restart the timer on each keystroke and never fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, delay]);

  return (
    <div className="ad-search">
      <span className="ad-search-icon" aria-hidden="true">
        🔍
      </span>
      <input
        type="search"
        className="form-input"
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {text && (
        <button className="ad-search-clear" onClick={() => setText('')} aria-label="Xoá tìm kiếm">
          ✕
        </button>
      )}
    </div>
  );
}

/* ── Table states ────────────────────────────────────────────── */

export type LoadState = 'loading' | 'ready' | 'error';

/**
 * The loading / error / empty rows every admin table needs. Renders nothing
 * once there are rows to show, so a page can drop it straight into `<tbody>`.
 */
export function TableStates({
  state,
  error,
  isEmpty,
  columns,
  emptyIcon = '📭',
  emptyTitle = 'Chưa có dữ liệu',
  emptyHint,
  onRetry,
}: {
  state: LoadState;
  error?: string;
  isEmpty: boolean;
  columns: number;
  emptyIcon?: string;
  emptyTitle?: string;
  emptyHint?: ReactNode;
  onRetry?: () => void;
}) {
  if (state === 'loading') {
    return (
      <>
        {Array.from({ length: 4 }, (_, row) => (
          <tr key={row} className="ad-skel-row">
            {Array.from({ length: columns }, (_, col) => (
              <td key={col}>
                <span className="ad-skel" />
              </td>
            ))}
          </tr>
        ))}
      </>
    );
  }

  if (state === 'error') {
    return (
      <tr>
        <td colSpan={columns}>
          <div className="ad-blank error">
            <span className="ad-blank-icon">⚠️</span>
            <p className="ad-blank-title">Không tải được dữ liệu</p>
            <p className="ad-blank-hint">{error}</p>
            {onRetry && (
              <button className="btn btn-ghost btn-sm" onClick={onRetry}>
                Thử lại
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  }

  if (isEmpty) {
    return (
      <tr>
        <td colSpan={columns}>
          <div className="ad-blank">
            <span className="ad-blank-icon">{emptyIcon}</span>
            <p className="ad-blank-title">{emptyTitle}</p>
            {emptyHint && <p className="ad-blank-hint">{emptyHint}</p>}
          </div>
        </td>
      </tr>
    );
  }

  return null;
}

/** Same three states outside a table (card grids, lists). */
export function BlockStates({
  state,
  error,
  isEmpty,
  emptyIcon = '📭',
  emptyTitle = 'Chưa có dữ liệu',
  emptyHint,
  onRetry,
}: {
  state: LoadState;
  error?: string;
  isEmpty: boolean;
  emptyIcon?: string;
  emptyTitle?: string;
  emptyHint?: ReactNode;
  onRetry?: () => void;
}) {
  if (state === 'loading') return <div className="ad-blank">Đang tải…</div>;
  if (state === 'error') {
    return (
      <div className="ad-blank error">
        <span className="ad-blank-icon">⚠️</span>
        <p className="ad-blank-title">Không tải được dữ liệu</p>
        <p className="ad-blank-hint">{error}</p>
        {onRetry && (
          <button className="btn btn-ghost btn-sm" onClick={onRetry}>
            Thử lại
          </button>
        )}
      </div>
    );
  }
  if (isEmpty) {
    return (
      <div className="ad-blank">
        <span className="ad-blank-icon">{emptyIcon}</span>
        <p className="ad-blank-title">{emptyTitle}</p>
        {emptyHint && <p className="ad-blank-hint">{emptyHint}</p>}
      </div>
    );
  }
  return null;
}

/* ── Pagination ──────────────────────────────────────────────── */

/** Page numbers around the current one, with ellipses instead of 50 buttons. */
function pageWindow(page: number, pages: number): Array<number | '…'> {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out: Array<number | '…'> = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(pages - 1, page + 1);
  if (from > 2) out.push('…');
  for (let i = from; i <= to; i++) out.push(i);
  if (to < pages - 1) out.push('…');
  out.push(pages);
  return out;
}

export function Pagination({
  page,
  pages,
  total,
  unit = 'mục',
  onChange,
}: {
  page: number;
  pages: number;
  total: number;
  unit?: string;
  onChange: (next: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <nav className="ad-pager" aria-label="Phân trang">
      <span className="ad-pager-total">
        {total.toLocaleString('vi-VN')} {unit}
      </span>
      <button className="ad-page" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        ‹
      </button>
      {pageWindow(page, pages).map((entry, i) =>
        entry === '…' ? (
          <span className="ad-page-gap" key={`gap-${i}`}>
            …
          </span>
        ) : (
          <button
            key={entry}
            className={`ad-page${page === entry ? ' active' : ''}`}
            onClick={() => onChange(entry)}
          >
            {entry}
          </button>
        ),
      )}
      <button className="ad-page" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        ›
      </button>
    </nav>
  );
}

/* ── Modal ───────────────────────────────────────────────────── */

export function Modal({
  title,
  subtitle,
  onClose,
  footer,
  width = 640,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  width?: number;
  children: ReactNode;
}) {
  // Escape closes, and the page behind must not scroll under the dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      className="adm-modal open"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="adm-modal-box editor-box" style={{ maxWidth: width }}>
        <div className="editor-head">
          <div>
            <h2 className="adm-modal-title" style={{ margin: 0 }}>
              {title}
            </h2>
            {subtitle && <p className="editor-sub">{subtitle}</p>}
          </div>
          <button className="adm-modal-close" onClick={onClose} aria-label="Đóng">
            ✕
          </button>
        </div>
        <div className="editor-body">{children}</div>
        {footer && <div className="editor-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ── Small bits ──────────────────────────────────────────────── */

export function Pill({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={`ad-tag tone-${tone}`}>{children}</span>;
}

/** Horizontal fill bar — used for capacity and share-of-total readouts. */
export function MeterBar({ value, max, tone = 'green' }: { value: number; max: number; tone?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="ad-meter" title={`${value}/${max}`}>
      <span className={`ad-meter-fill tone-${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
