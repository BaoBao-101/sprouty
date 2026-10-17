/**
 * "Phụ huynh nói gì" on the workshop page: what families said about the
 * sessions their child attended, every review from a booking that staff
 * checked in at the door.
 *
 * Sessions end and leave the schedule, so the score is read across all of
 * them. A parent with a session still to review is asked to here as well as
 * in "Workshop của tôi". With no reviews yet and nothing to ask, the section
 * stays out of the page rather than advertising an empty score.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { SproutyIcon } from '@/components/icons/SproutyIcon';
import { formatWorkshopWhen } from '@/types/workshop';
import { ReviewDialog } from './ReviewDialog';
import { ReviewsPanel } from './ReviewsPanel';
import {
  reviewDate,
  type EligibleWorkshop,
  type MyWorkshopReview,
  type PublicWorkshopReview,
  type RatingSummary,
  type ReviewOptions,
} from '@/types/review';

interface Mine {
  reviews: MyWorkshopReview[];
  eligible: EligibleWorkshop[];
  options: ReviewOptions;
}

export function WorkshopReviewsSection({ onSummary }: { onSummary?: (summary: RatingSummary) => void }) {
  const { user, isLoggedIn } = useAuth();
  const [summary, setSummary] = useState<RatingSummary | null>(null);
  const [mine, setMine] = useState<Mine | null>(null);
  const [writing, setWriting] = useState<EligibleWorkshop | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback((params: Record<string, string>) => API.workshopReviews.list(params), []);

  const loadMine = useCallback(() => {
    if (!isLoggedIn || user?.role !== 'customer') return setMine(null);
    API.workshopReviews.mine().then((data: any) => setMine(data)).catch(() => {});
  }, [isLoggedIn, user?.role]);

  useEffect(loadMine, [loadMine]);

  const reviewed = new Set((mine?.reviews || []).map((r) => r.workshopId));
  const pending = (mine?.eligible || []).filter((e) => !reviewed.has(e.workshopId));

  const report = useCallback((s: RatingSummary) => {
    setSummary(s);
    onSummary?.(s);
  }, [onSummary]);

  const visible = Boolean(summary && (summary.count > 0 || pending.length > 0));

  const cta = pending.length > 0 ? (
    <>
      <p>
        <b>{pending.length === 1 ? `Bé đã tham gia ${pending[0].workshop.title}` : `${pending.length} buổi bé đã tham gia đang chờ bạn đánh giá`}</b>
        <br />Chia sẻ cảm nhận để giúp phụ huynh khác chọn buổi phù hợp.
      </p>
      <button type="button" className="rv-btn is-primary" onClick={() => setWriting(pending[0])}>
        <SproutyIcon name="star" size={15} /> Viết đánh giá
      </button>
    </>
  ) : mine && mine.reviews.length > 0 ? (
    <>
      <p><b>Bạn đã đánh giá {mine.reviews.length} buổi</b><br />Cảm ơn bạn đã chia sẻ cùng Sprouty.</p>
      <Link to="/my-workshops" className="rv-btn">
        <SproutyIcon name="ticket" size={15} /> Workshop của tôi
      </Link>
    </>
  ) : (
    <p className="rv-cta-muted">
      <SproutyIcon name="check" size={15} /> Mọi đánh giá đều từ phụ huynh đã đưa bé tham gia và được điểm danh tại buổi học.
    </p>
  );

  return (
    <section className="section ws-section ws-reviews" id="danh-gia" hidden={!visible}>
      <div className="container">
        <div className="ws-head">
          <div>
            <span className="label">Phụ huynh nói gì</span>
            <h2>Cảm nhận sau buổi học</h2>
          </div>
        </div>

        <ReviewsPanel<PublicWorkshopReview>
          load={load}
          reloadKey={reloadKey}
          cta={cta}
          verifiedLabel="Đã tham gia"
          satisfiedLabel="phụ huynh hài lòng"
          emptyTitle="Chưa có đánh giá nào"
          emptyHint="Đánh giá đầu tiên sẽ đến từ phụ huynh đã đưa bé tham gia workshop."
          onSummary={report}
          context={(r) => r.workshop && (
            <span className="rv-item-context">
              <SproutyIcon name="ticket" size={14} />
              <span>{r.workshop.title} · {reviewDate(r.workshop.dateTime)}</span>
            </span>
          )}
        />
      </div>

      {writing && (
        <ReviewDialog
          target={{
            kind: 'workshop',
            id: writing.workshopId,
            name: writing.workshop.title,
            image: writing.workshop.imageUrl,
            when: formatWorkshopWhen(writing.workshop),
          }}
          options={mine?.options}
          onClose={() => setWriting(null)}
          onSaved={() => {
            loadMine();
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </section>
  );
}
