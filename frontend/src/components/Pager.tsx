import { SproutyIcon } from '@/components/icons/SproutyIcon';
import './Pager.css';

/**
 * Paging for the customer's own lists.
 *
 * Separate from the admin's, and deliberately so: this one is read by a parent
 * on a phone, so the targets are bigger, it says what it is counting in words
 * rather than leaving a bare number, and it never prints fifty page buttons.
 *
 * It renders nothing on a single page. A pager under a list of three orders is
 * furniture that tells you only that there is nothing more to see.
 */

/**
 * Page numbers around the current one, with gaps instead of every number.
 *
 * Not named `window`. A module-scope `function window` shadows the global for
 * the whole file, and the React plugin injects a preamble check that reads
 * `window.__vite_plugin_react_preamble_installed__` at the top of every module
 * it transforms — which then reads a property off this function, finds
 * undefined, and throws "can't detect preamble" on any page importing it.
 */
function pageWindow(page: number, pages: number): Array<number | 'gap'> {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out: Array<number | 'gap'> = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(pages - 1, page + 1);
  if (from > 2) out.push('gap');
  for (let i = from; i <= to; i++) out.push(i);
  if (to < pages - 1) out.push('gap');
  out.push(pages);
  return out;
}

export function Pager({
  page,
  pages,
  total,
  unit,
  onChange,
}: {
  page: number;
  pages: number;
  total: number;
  /** What is being counted, e.g. "đơn hàng". */
  unit: string;
  onChange: (next: number) => void;
}) {
  if (pages <= 1) return null;

  return (
    <nav className="pager" aria-label="Phân trang">
      <span className="pager-total">
        {total.toLocaleString('vi-VN')} {unit} · trang {page}/{pages}
      </span>

      <div className="pager-controls">
        <button
          className="pager-step"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Trang trước"
        >
          <SproutyIcon name="arrow-right" size={17} className="pager-back" />
        </button>

        {pageWindow(page, pages).map((entry, i) =>
          entry === 'gap' ? (
            <span className="pager-gap" key={`gap-${i}`}>
              …
            </span>
          ) : (
            <button
              key={entry}
              className={`pager-num${entry === page ? ' active' : ''}`}
              aria-current={entry === page ? 'page' : undefined}
              onClick={() => onChange(entry)}
            >
              {entry}
            </button>
          ),
        )}

        <button
          className="pager-step"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          aria-label="Trang sau"
        >
          <SproutyIcon name="arrow-right" size={17} />
        </button>
      </div>
    </nav>
  );
}
