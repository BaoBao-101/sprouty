/**
 * The public face of a set of reviews: the score, how it splits by stars,
 * filters, and the reviews themselves with their photos and Sprouty's reply,
 * a page at a time.
 *
 * Shared by the product page (one kit's reviews) and the workshop page (every
 * session's). What differs — where the reviews come from, the call to action
 * beside the score, the label that says why a reviewer counts — is passed in.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { SproutyIcon } from '@/components/icons/SproutyIcon';
import { Pager } from '@/components/Pager';
import { Stars } from './Stars';
import { reviewDate, type PublicReview, type RatingSummary } from '@/types/review';
import './Reviews.css';

type Filter = 'all' | '5' | '4' | '3' | '2' | '1' | 'photos';
type Sort = 'newest' | 'highest' | 'lowest';

/** Reviews are tall — text, remarks, photos, a reply — so five to a page. */
const PAGE = 5;

export function ReviewsPanel<R extends PublicReview>({
  load,
  reloadKey = 0,
  cta,
  verifiedLabel,
  satisfiedLabel,
  emptyTitle,
  emptyHint,
  context,
  onSummary,
}: {
  /** One page of reviews and the score, for these query params. Keep it stable. */
  load: (params: Record<string, string>) => Promise<any>;
  /** Changed after the visitor writes, edits or deletes, to read again. */
  reloadKey?: number;
  /** What the visitor can do, beside the score. */
  cta: ReactNode;
  /** Why each reviewer counts: "Đã mua hàng", "Đã tham gia". */
  verifiedLabel: string;
  /** "khách hài lòng", "phụ huynh hài lòng". */
  satisfiedLabel: string;
  emptyTitle: string;
  emptyHint: string;
  /** An extra line on a review, such as the session it was about. */
  context?: (review: R) => ReactNode;
  onSummary?: (summary: RatingSummary) => void;
}) {
  const [summary, setSummary] = useState<RatingSummary | null>(null);
  const [reviews, setReviews] = useState<R[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('newest');
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [paging, setPaging] = useState(false);
  const listTop = useRef<HTMLDivElement>(null);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);

  const query = useCallback((p: number) => {
    const params: Record<string, string> = { page: String(p), limit: String(PAGE), sort };
    if (filter === 'photos') params.photos = '1';
    else if (filter !== 'all') params.rating = filter;
    return load(params);
  }, [load, filter, sort]);

  const reload = useCallback(() => {
    setState('loading');
    query(1)
      .then((data: any) => {
        setSummary(data.summary);
        onSummary?.(data.summary);
        setReviews(data.reviews || []);
        setPage(1);
        setPages(data.pages || 1);
        setTotal(data.total || 0);
        setState('ready');
      })
      .catch(() => setState('error'));
    // onSummary is a report, not an input: a new function must not reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(reload, [reload, reloadKey]);

  /** Another page in place of this one, then back up to its first review. */
  async function goTo(next: number) {
    setPaging(true);
    try {
      const data: any = await query(next);
      setReviews(data.reviews || []);
      setPage(next);
      setPages(data.pages || 1);
      setTotal(data.total || 0);
      const top = listTop.current;
      // Below the sticky site header.
      if (top) window.scrollTo({ top: top.getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' });
    } catch {
      // The page shown stays as it was; the pager can be tapped again.
    } finally {
      setPaging(false);
    }
  }

  const count = summary?.count || 0;
  const dist = summary?.distribution;
  const filters: Array<[Filter, string, number]> = [
    ['all', 'Tất cả', count],
    ['5', '5 sao', dist?.['5'] || 0],
    ['4', '4 sao', dist?.['4'] || 0],
    ['3', '3 sao', dist?.['3'] || 0],
    ['2', '2 sao', dist?.['2'] || 0],
    ['1', '1 sao', dist?.['1'] || 0],
    ['photos', 'Có ảnh', summary?.withPhotos || 0],
  ];

  return (
    <div className="rv-section">
      <div className="rv-overview">
        <div className="rv-score">
          <strong>{count ? summary!.average.toLocaleString('vi-VN', { minimumFractionDigits: 1 }) : '–'}</strong>
          <span className="rv-score-of">/5</span>
          <Stars value={summary?.average || 0} size={20} />
          <em>{count ? `${count} đánh giá` : 'Chưa có đánh giá'}</em>
          {count > 0 && <span className="rv-score-rec"><SproutyIcon name="heart" size={14} /> {summary!.recommendPercent}% {satisfiedLabel}</span>}
        </div>

        <div className="rv-bars" aria-label="Số đánh giá theo số sao">
          {[5, 4, 3, 2, 1].map((star) => {
            const n = dist?.[String(star) as '5'] || 0;
            const pct = count ? Math.round((n / count) * 100) : 0;
            return (
              <button
                type="button"
                key={star}
                className={`rv-bar${filter === String(star) ? ' is-on' : ''}`}
                onClick={() => setFilter(filter === String(star) ? 'all' : (String(star) as Filter))}
                disabled={!n}
                aria-label={`${star} sao: ${n} đánh giá`}
              >
                <span className="rv-bar-label">{star} <SproutyIcon name="star" size={12} /></span>
                <i><b style={{ width: `${pct}%` }} /></i>
                <span className="rv-bar-count">{n}</span>
              </button>
            );
          })}
        </div>

        <div className="rv-cta">{cta}</div>
      </div>

      {count > 0 && (
        <div className="rv-toolbar" ref={listTop}>
          <div className="rv-filters" role="tablist" aria-label="Lọc đánh giá">
            {filters.map(([value, label, n]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={filter === value}
                className={`rv-filter${filter === value ? ' is-on' : ''}`}
                onClick={() => setFilter(value)}
                disabled={value !== 'all' && !n}
              >
                {label} <em>{n}</em>
              </button>
            ))}
          </div>
          <label className="rv-sort">
            <span>Sắp xếp</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sắp xếp đánh giá">
              <option value="newest">Mới nhất</option>
              <option value="highest">Điểm cao nhất</option>
              <option value="lowest">Điểm thấp nhất</option>
            </select>
          </label>
        </div>
      )}

      {state === 'loading' && <div className="rv-empty">Đang tải đánh giá…</div>}
      {state === 'error' && (
        <div className="rv-empty">
          Không tải được đánh giá. <button type="button" className="rv-link" onClick={reload}>Thử lại</button>
        </div>
      )}
      {state === 'ready' && reviews.length === 0 && (
        <div className="rv-empty">
          <SproutyIcon name="star" size={26} />
          <b>{count ? 'Không có đánh giá phù hợp bộ lọc' : emptyTitle}</b>
          <span>{count ? 'Thử bỏ bộ lọc để xem tất cả.' : emptyHint}</span>
        </div>
      )}

      {state === 'ready' && reviews.length > 0 && (
        <ul className={`rv-list${paging ? ' is-paging' : ''}`} aria-busy={paging}>
          {reviews.map((r) => (
            <li key={r.id} className="rv-item">
              <header className="rv-item-head">
                <span className="rv-avatar" aria-hidden="true">{r.initial}</span>
                <span className="rv-item-who">
                  <b>{r.author}</b>
                  <span className="rv-verified"><SproutyIcon name="check" size={12} /> {verifiedLabel}</span>
                </span>
                <span className="rv-item-date">{reviewDate(r.createdAt)}{r.edited ? ' · đã sửa' : ''}</span>
              </header>
              {context?.(r)}
              <Stars value={r.rating} size={15} />
              {r.tags.length > 0 && (
                <div className="rv-item-tags">{r.tags.map((t) => <span key={t}>{t}</span>)}</div>
              )}
              {r.content && <p className="rv-item-text">{r.content}</p>}
              {r.images.length > 0 && (
                <div className="rv-item-photos">
                  {r.images.map((url, i) => (
                    <button type="button" key={url} onClick={() => setLightbox({ images: r.images, index: i })} aria-label={`Xem ảnh ${i + 1}`}>
                      <img src={url} alt="" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
              {r.reply && (
                <div className="rv-reply">
                  <b><SproutyIcon name="sprout" size={14} /> Phản hồi từ Sprouty</b>
                  <p>{r.reply.content}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {state === 'ready' && (
        <Pager page={page} pages={pages} total={total} unit="đánh giá" onChange={(next) => { if (!paging) void goTo(next); }} />
      )}

      {lightbox && (
        <div className="rv-lightbox" role="dialog" aria-modal="true" aria-label="Ảnh đánh giá" onClick={() => setLightbox(null)}>
          <img src={lightbox.images[lightbox.index]} alt="" onClick={(e) => e.stopPropagation()} />
          <button type="button" className="rv-icon-btn rv-lightbox-x" onClick={() => setLightbox(null)} aria-label="Đóng"><SproutyIcon name="close" size={18} /></button>
          {lightbox.images.length > 1 && (
            <div className="rv-lightbox-nav" onClick={(e) => e.stopPropagation()}>
              {lightbox.images.map((url, i) => (
                <button type="button" key={url} className={i === lightbox.index ? 'is-on' : ''} onClick={() => setLightbox({ ...lightbox, index: i })} aria-label={`Ảnh ${i + 1}`}>
                  <img src={url} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
