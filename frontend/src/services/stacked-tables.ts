import { useEffect, type RefObject } from 'react';

/**
 * On a phone, staff tables turn into one card per row (admin-ui.css, "Tables
 * on a phone"), and each cell says which column it is. Rather than every table
 * writing a data-label on every cell, this copies each header's text onto the
 * cells beneath it, and again whenever rows load or change — so a table added
 * later stacks on a phone without doing anything. A table opts out with
 * data-stack="off".
 */
export function useStackedTables(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let queued = 0;
    const label = () => {
      queued = 0;
      root.querySelectorAll<HTMLTableElement>('table.admin-table, table.emp-table').forEach((table) => {
        if (table.dataset.stack === 'off') return;
        const heads = [...table.querySelectorAll<HTMLTableCellElement>('thead th')].flatMap((th) =>
          Array(th.colSpan || 1).fill((th.textContent || '').trim()),
        );
        table.classList.add('is-stacked');
        table.querySelectorAll<HTMLTableRowElement>('tbody > tr').forEach((tr) => {
          let col = 0;
          for (const cell of Array.from(tr.cells)) {
            const text = cell.colSpan > 1 ? '' : heads[col] || '';
            if (cell.dataset.label !== text) cell.dataset.label = text;
            col += cell.colSpan || 1;
          }
        });
      });
    };
    label();
    // Only rows coming and going matter; the labels it writes are attributes,
    // which this does not watch, so it never triggers itself.
    const observer = new MutationObserver(() => {
      if (!queued) queued = requestAnimationFrame(label);
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (queued) cancelAnimationFrame(queued);
    };
  }, [ref]);
}
