import { useCallback, useEffect, useRef, useState } from 'react';
import type { LoadState } from '@/components/admin/ui';

/**
 * One server-paged list, for every admin table.
 *
 * These screens used to fetch whatever the endpoint would give them — 200 rows
 * on a good day — and then filter that array in the browser. Two things were
 * wrong with it. Row 201 was unreachable, with nothing on screen to say it
 * existed. And searching only ever looked at the rows already in hand, so a
 * post from last year could not be found by typing its title.
 *
 * Here the server does both: the filters and the search box are query
 * parameters, and what comes back is one page of matches out of the whole
 * table.
 */
/** Ten rows a page, the same everywhere, so no table is read differently. */
export const ADMIN_PAGE_SIZE = 10;

export interface PagedResult<T> {
  items: T[];
  state: LoadState;
  error: string;
  page: number;
  pages: number;
  total: number;
  /** Totals for the filter tabs, spanning the table rather than the page. */
  counts: Record<string, number>;
  /** The whole response, for the headline figures each screen computes
      differently and the hook has no business knowing about. */
  raw: any;
  setPage: (next: number) => void;
  reload: () => void;
}

export function usePagedList<T>(
  /** Calls the endpoint. Stable across renders is not required. */
  fetcher: (params: Record<string, string>) => Promise<any>,
  /** The array's name in the response, e.g. 'posts'. */
  key: string,
  /** Filters and search, already narrowed to what the server understands. */
  params: Record<string, string>,
  { limit = ADMIN_PAGE_SIZE, errorText = 'Không tải được dữ liệu.' } = {},
): PagedResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [raw, setRaw] = useState<any>(null);

  // Comparing the serialised params is what lets a caller pass a fresh object
  // literal on every render without re-fetching on every render.
  const paramKey = JSON.stringify(params);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Changing a filter while on page 7 would otherwise ask for page 7 of a
  // result that may only have two.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setPage(1);
  }, [paramKey]);

  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState('loading');

    const query: Record<string, string> = {
      ...JSON.parse(paramKey),
      page: String(page),
      limit: String(limit),
    };
    // An empty filter means "all", and sending status= would ask for rows whose
    // status is the empty string.
    for (const [k, v] of Object.entries(query)) if (v === '') delete query[k];

    fetcherRef
      .current(query)
      .then((data: any) => {
        if (cancelled) return;
        setItems(data?.[key] || []);
        setPages(data?.pages || 1);
        setTotal(data?.total ?? (data?.[key] || []).length);
        setCounts(data?.counts || {});
        setRaw(data ?? null);
        setError('');
        setState('ready');
      })
      .catch((err: any) => {
        if (cancelled) return;
        setError(err?.message || errorText);
        setState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [paramKey, page, limit, key, nonce, errorText]);

  return { items, state, error, page, pages, total, counts, raw, setPage, reload };
}
