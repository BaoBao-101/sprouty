/**
 * Đánh giá — what customers say about the kits they received and the
 * workshop sessions their child attended.
 *
 * One line per review, so a page of them reads at a glance: what it is about,
 * the stars, the first words, who and when, and what is waiting. Opening a
 * line shows everything — the customer, the order or the session, the full
 * text, the photos — and is where the reply is written and where a review is
 * hidden, with a reason. Nothing here edits what a customer wrote; hiding
 * takes the review out of the score.
 *
 * Kits and sessions sit on two tabs with the same tools. ?type=workshop opens
 * the second, and ?workshopId narrows it to one session (the admin workshop
 * list links here that way).
 */

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import { AdminIcon } from '@/components/icons/AdminIcon';
import { usePagedList } from '@/components/admin/usePagedList';
import {
  BlockStates,
  FilterPills,
  Modal,
  PageHeader,
  Pagination,
  Panel,
  Pill,
  SearchBox,
  StatCard,
  StatGrid,
  Toolbar,
  type FilterOption,
} from '@/components/admin/ui';
import { Stars } from '@/components/reviews/Stars';
import { RATING_LABELS, reviewDate, type AdminReview } from '@/types/review';
import { formatWorkshopWhen } from '@/types/workshop';
import './Reviews.css';

type View = 'all' | 'needs_reply' | 'low' | 'photos' | 'hidden';
type Kind = 'product' | 'workshop';
type Template = { when: (r: number) => boolean; label: string; text: string };

/** What changes between the two tabs. Replies start from a template and are edited before sending. */
const KINDS: Record<Kind, {
  api: typeof API.admin.reviews;
  tab: string;
  subtitle: string;
  search: string;
  emptyHint: string;
  hideHelp: string;
  reasons: string[];
  templates: Template[];
}> = {
  product: {
    api: API.admin.reviews,
    tab: 'Sản phẩm',
    subtitle: 'Khách đã nhận hàng nói gì về sản phẩm — bấm vào một đánh giá để xem chi tiết và phản hồi',
    search: 'Tìm nội dung, khách, sản phẩm…',
    emptyHint: 'Khách đánh giá sau khi nhận được hàng; đánh giá sẽ hiện ở đây.',
    hideHelp: 'Đánh giá sẽ không còn hiện trên trang sản phẩm và không tính vào điểm. Khách vẫn thấy lý do.',
    reasons: ['Ngôn từ không phù hợp', 'Spam hoặc quảng cáo', 'Lộ thông tin cá nhân', 'Không liên quan đến sản phẩm', 'Khác'],
    templates: [
      {
        when: (r) => r >= 4,
        label: 'Cảm ơn',
        text: 'Cảm ơn anh/chị đã dành thời gian đánh giá! Sprouty rất vui khi bé thích bạn cây của mình. Chúc bé và cây cùng lớn thật khoẻ nhé!',
      },
      {
        when: (r) => r === 3,
        label: 'Ghi nhận góp ý',
        text: 'Cảm ơn anh/chị đã góp ý! Sprouty ghi nhận và sẽ cải thiện để lần sau bé có trải nghiệm tốt hơn. Nếu cần hỗ trợ thêm, anh/chị cứ nhắn cho Sprouty nhé.',
      },
      {
        when: (r) => r <= 3,
        label: 'Xin lỗi và hỗ trợ',
        text: 'Sprouty thành thật xin lỗi vì trải nghiệm chưa tốt. Bộ phận chăm sóc khách hàng sẽ liên hệ anh/chị trong 24 giờ để hỗ trợ đổi bộ kit hoặc hoàn tiền theo chính sách.',
      },
    ],
  },
  workshop: {
    api: API.admin.workshopReviews,
    tab: 'Workshop',
    subtitle: 'Phụ huynh đã đưa bé tham gia nói gì về buổi học — bấm vào một đánh giá để xem chi tiết và phản hồi',
    search: 'Tìm nội dung, phụ huynh, tên buổi…',
    emptyHint: 'Phụ huynh đánh giá sau khi bé được điểm danh tại buổi học; đánh giá sẽ hiện ở đây.',
    hideHelp: 'Đánh giá sẽ không còn hiện trên trang Workshop và không tính vào điểm. Phụ huynh vẫn thấy lý do.',
    reasons: ['Ngôn từ không phù hợp', 'Spam hoặc quảng cáo', 'Lộ thông tin cá nhân', 'Không liên quan đến buổi học', 'Khác'],
    templates: [
      {
        when: (r) => r >= 4,
        label: 'Cảm ơn',
        text: 'Cảm ơn anh/chị đã đưa bé đến workshop của Sprouty! Cả đội rất vui khi bé có một buổi học vui vẻ. Hẹn gặp lại bé ở những buổi tiếp theo nhé!',
      },
      {
        when: (r) => r === 3,
        label: 'Ghi nhận góp ý',
        text: 'Cảm ơn anh/chị đã góp ý! Sprouty ghi nhận và sẽ cải thiện cách tổ chức để những buổi sau bé có trải nghiệm tốt hơn.',
      },
      {
        when: (r) => r <= 3,
        label: 'Xin lỗi và hỗ trợ',
        text: 'Sprouty thành thật xin lỗi vì buổi học chưa được như mong đợi. Bộ phận chăm sóc khách hàng sẽ liên hệ anh/chị trong 24 giờ để lắng nghe thêm và hỗ trợ theo chính sách của Sprouty.',
      },
    ],
  },
};

const short = (id: string) => id.slice(-8).toUpperCase();

/** "12/10" — enough to tell two runs of the same session apart in a row. */
const dayMonth = (iso: string) => reviewDate(iso).slice(0, 5);

/** The pill that says what a review is waiting for. */
function stateOf(r: AdminReview): { label: string; tone: string } {
  if (r.status === 'hidden') return { label: 'Đang ẩn', tone: 'grey' };
  if (!r.reply) return { label: 'Chờ phản hồi', tone: 'amber' };
  return { label: 'Đã phản hồi', tone: 'green' };
}

/** What a review is about, as the row and the dialog show it. */
function subjectOf(r: AdminReview) {
  if (r.workshop !== undefined) {
    return {
      name: r.workshop?.title || 'Buổi workshop đã xoá',
      image: r.workshop?.image || null,
      icon: 'ticket' as const,
      when: r.workshop ? dayMonth(r.workshop.dateTime) : '',
    };
  }
  return { name: r.product?.name || 'Sản phẩm đã xoá', image: r.product?.image || null, icon: 'products' as const, when: '' };
}

export default function AdminReviews() {
  const [params, setParams] = useSearchParams();
  const kind: Kind = params.get('type') === 'workshop' ? 'workshop' : 'product';
  const workshopId = kind === 'workshop' ? params.get('workshopId') || '' : '';

  // How many wait for a reply on each tab, so neither goes unnoticed.
  const [waiting, setWaiting] = useState<Record<Kind, number | null>>({ product: null, workshop: null });
  const loadWaiting = useCallback(() => {
    (Object.keys(KINDS) as Kind[]).forEach((k) => {
      KINDS[k].api.list({ view: 'needs_reply', limit: '1' })
        .then((data: any) => setWaiting((w) => ({ ...w, [k]: data.stats?.needsReply ?? 0 })))
        .catch(() => {});
    });
  }, []);
  useEffect(loadWaiting, [loadWaiting]);

  return (
    <>
      <PageHeader title="Đánh giá" subtitle={KINDS[kind].subtitle} />

      <div className="arv-kinds" role="tablist" aria-label="Loại đánh giá">
        {(Object.keys(KINDS) as Kind[]).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            className={`arv-kind${kind === k ? ' is-on' : ''}`}
            onClick={() => setParams(k === 'workshop' ? { type: 'workshop' } : {})}
          >
            <AdminIcon name={k === 'workshop' ? 'workshop' : 'products'} size={16} />
            {KINDS[k].tab}
            {Boolean(waiting[k]) && <span className="arv-kind-count" title="Chờ phản hồi">{waiting[k]}</span>}
          </button>
        ))}
      </div>

      <ReviewBoard
        key={`${kind}:${workshopId}`}
        kind={kind}
        workshopId={workshopId}
        onClearSession={() => setParams({ type: 'workshop' })}
        onChanged={loadWaiting}
      />
    </>
  );
}

function ReviewBoard({
  kind,
  workshopId,
  onClearSession,
  onChanged,
}: {
  kind: Kind;
  workshopId: string;
  onClearSession: () => void;
  onChanged: () => void;
}) {
  const conf = KINDS[kind];
  const [view, setView] = useState<View>('all');
  const [rating, setRating] = useState('');
  const [search, setSearch] = useState('');

  const list = usePagedList<AdminReview>(
    (params) => conf.api.list(params),
    'reviews',
    { view, rating, search: search.trim(), workshopId },
    { errorText: 'Không tải được đánh giá.' },
  );
  const stats = list.raw?.stats;
  const counts = list.counts;
  const loading = list.state === 'loading' && !list.raw;

  // ── The open review ──
  const [open, setOpen] = useState<AdminReview | null>(null);
  const [mode, setMode] = useState<'view' | 'hide'>('view');
  const [replyText, setReplyText] = useState('');
  const [reason, setReason] = useState(conf.reasons[0]);
  const [reasonNote, setReasonNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  function openReview(r: AdminReview) {
    setOpen(r);
    setMode('view');
    setReplyText(r.reply || '');
    setReason(conf.reasons[0]);
    setReasonNote('');
    setFormError('');
  }

  /** Runs one change, keeps the dialog showing the review as it now is. */
  async function act(run: () => Promise<any>) {
    setBusy(true);
    setFormError('');
    try {
      const { review, message } = await run();
      showToast(message || 'Đã cập nhật.', 'success');
      setOpen(review);
      setReplyText(review.reply || '');
      setMode('view');
      list.reload();
      onChanged();
    } catch (err: any) {
      setFormError(err?.message || 'Không cập nhật được.');
    } finally {
      setBusy(false);
    }
  }

  const sendReply = (text: string) => open && act(() => conf.api.reply(open.id, text.trim()));
  const hide = () => {
    if (!open) return;
    const note = reasonNote.trim();
    const why = reason === 'Khác' ? note : note ? `${reason}: ${note}` : reason;
    return act(() => conf.api.setStatus(open.id, 'hidden', why));
  };
  const show = () => open && act(() => conf.api.setStatus(open.id, 'published'));

  const filters: Array<FilterOption<View>> = [
    { value: 'all', label: 'Tất cả', count: counts.all || 0 },
    { value: 'needs_reply', label: 'Chờ phản hồi', count: counts.needs_reply || 0 },
    { value: 'low', label: 'Từ 3 sao trở xuống', count: counts.low || 0 },
    { value: 'photos', label: 'Có ảnh', count: counts.photos || 0 },
    { value: 'hidden', label: 'Đang ẩn', count: counts.hidden || 0 },
  ];

  const replyChanged = open ? replyText.trim() !== (open.reply || '') : false;
  const subject = open ? subjectOf(open) : null;
  const session = list.items.find((r) => r.workshop)?.workshop;
  const filtered = Boolean(search || rating || view !== 'all');

  return (
    <>
      <StatGrid>
        <StatCard
          icon={<AdminIcon name="star" />}
          tone="amber"
          loading={loading}
          value={stats?.published ? `${stats.average.toLocaleString('vi-VN', { minimumFractionDigits: 1 })} / 5` : '—'}
          label="Điểm trung bình"
          hint={stats ? `${stats.published} đánh giá công khai` : undefined}
        />
        <StatCard
          icon={<AdminIcon name="check" />}
          tone="green"
          loading={loading}
          value={stats?.published ? `${stats.positivePercent}%` : '—'}
          label={kind === 'workshop' ? 'Phụ huynh hài lòng' : 'Khách hài lòng'}
          hint="Đánh giá 4–5 sao"
        />
        <StatCard
          icon={<AdminIcon name="inbox" />}
          tone={stats?.needsReply ? 'orange' : 'green'}
          loading={loading}
          value={stats?.needsReply ?? '—'}
          label="Chờ phản hồi"
          hint={stats?.needsReply ? 'Nên trả lời trong 24 giờ' : 'Đã trả lời hết'}
        />
        <StatCard
          icon={<AdminIcon name="alert" />}
          tone={counts.low ? 'rose' : 'grey'}
          loading={loading}
          value={counts.low ?? '—'}
          label="Từ 3 sao trở xuống"
          hint={kind === 'workshop' ? 'Ưu tiên liên hệ phụ huynh' : 'Ưu tiên liên hệ khách'}
        />
      </StatGrid>

      {workshopId && (
        <p className="arv-scope">
          <AdminIcon name="ticket" size={15} />
          <span>Chỉ buổi <b>{session ? `${session.title} · ${reviewDate(session.dateTime)}` : 'đã chọn'}</b></span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClearSession}>
            <AdminIcon name="close" size={14} /> Xem mọi buổi
          </button>
        </p>
      )}

      <Toolbar>
        <FilterPills options={filters} value={view} onChange={(next) => setView(next as View)} />
        <div className="arv-tools">
          <select className="form-input arv-rating" value={rating} onChange={(e) => setRating(e.target.value)} aria-label="Lọc theo số sao">
            <option value="">Mọi số sao</option>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={String(n)}>{n} sao — {RATING_LABELS[n]}</option>)}
          </select>
          <SearchBox value={search} onChange={setSearch} placeholder={conf.search} />
        </div>
      </Toolbar>

      <Panel title="Danh sách đánh giá" flush>
        <BlockStates
          state={list.state}
          error={list.error}
          isEmpty={list.items.length === 0}
          emptyIcon={<AdminIcon name="star" size={24} />}
          emptyTitle={view === 'needs_reply' ? 'Đã phản hồi mọi đánh giá' : filtered ? 'Không có đánh giá phù hợp' : 'Chưa có đánh giá nào'}
          emptyHint={!filtered ? conf.emptyHint : undefined}
          onRetry={list.reload}
        />

        {list.state === 'ready' && list.items.length > 0 && (
          <ul className="arv-rows">
            {list.items.map((r) => {
              const state = stateOf(r);
              const about = subjectOf(r);
              return (
                <li key={r.id}>
                  <button type="button" className={`arv-row${r.rating <= 2 ? ' is-low' : ''}${r.status === 'hidden' ? ' is-hidden' : ''}`} onClick={() => openReview(r)}>
                    <span className="arv-row-thumb">
                      {about.image ? <img src={about.image} alt="" /> : <AdminIcon name={about.icon} size={18} />}
                    </span>
                    <span className="arv-row-main">
                      <span className="arv-row-title">
                        <b>{about.name}</b>
                        {about.when && <em className="arv-row-when">{about.when}</em>}
                        <Stars value={r.rating} size={13} />
                      </span>
                      <span className={`arv-row-snippet${r.content ? '' : ' is-muted'}`}>
                        {r.content || (r.tags.length ? r.tags.join(' · ') : 'Chỉ chấm sao, không viết thêm')}
                      </span>
                    </span>
                    <span className="arv-row-who">
                      <b>{r.customer?.name || 'Khách đã xoá tài khoản'}</b>
                      <em>{reviewDate(r.createdAt)}</em>
                    </span>
                    <span className="arv-row-flags">
                      {r.images.length > 0 && (
                        <span className="arv-row-photos" title={`${r.images.length} ảnh`}>
                          <AdminIcon name="images" size={14} /> {r.images.length}
                        </span>
                      )}
                      <Pill tone={state.tone}>{state.label}</Pill>
                    </span>
                    <AdminIcon name="chevron-right" size={18} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <Pagination page={list.page} pages={list.pages} total={list.total} unit="đánh giá" onChange={list.setPage} />
      </Panel>

      {open && subject && (
        <Modal
          title={subject.name}
          subtitle={`Đánh giá ngày ${reviewDate(open.createdAt)}${open.edited ? ' · khách đã sửa' : ''}`}
          width={760}
          onClose={() => !busy && setOpen(null)}
          footer={
            <>
              {open.status === 'published' ? (
                mode === 'hide' ? (
                  <button className="btn btn-ghost" disabled={busy} onClick={() => setMode('view')}>Thôi, không ẩn</button>
                ) : (
                  <button className="btn btn-ghost" disabled={busy} onClick={() => { setMode('hide'); setFormError(''); }}>
                    <AdminIcon name="eye" size={15} /> Ẩn đánh giá
                  </button>
                )
              ) : (
                <button className="btn btn-ghost" disabled={busy} onClick={show}>
                  <AdminIcon name="eye" size={15} /> Hiện lại
                </button>
              )}
              <span style={{ flex: 1 }} />
              {mode === 'hide' ? (
                <button className="btn btn-primary arv-danger" disabled={busy || (reason === 'Khác' && !reasonNote.trim())} onClick={hide}>
                  {busy ? 'Đang ẩn…' : 'Xác nhận ẩn'}
                </button>
              ) : (
                <button className="btn btn-ghost" disabled={busy} onClick={() => setOpen(null)}>Đóng</button>
              )}
            </>
          }
        >
          <div className="arv-detail">
            <div className="arv-detail-head">
              <span className="arv-detail-thumb">
                {subject.image ? <img src={subject.image} alt="" /> : <AdminIcon name={subject.icon} size={22} />}
              </span>
              <span className="arv-detail-score">
                <Stars value={open.rating} size={20} />
                <b className={`arv-rating-label is-${open.rating}`}>{open.rating} sao · {RATING_LABELS[open.rating]}</b>
              </span>
              <Pill tone={stateOf(open).tone}>{stateOf(open).label}</Pill>
            </div>

            <dl className="arv-facts">
              <div><dt>{kind === 'workshop' ? 'Phụ huynh' : 'Khách hàng'}</dt><dd>{open.customer?.name || 'Đã xoá tài khoản'}</dd></div>
              <div><dt>Email</dt><dd>{open.customer?.email || '—'}</dd></div>
              <div><dt>Hiển thị công khai là</dt><dd>{open.publicName}{open.anonymous ? ' (ẩn danh)' : ''}</dd></div>
              {kind === 'workshop' ? (
                <>
                  <div><dt>Buổi học</dt><dd>{open.workshop ? formatWorkshopWhen(open.workshop) : '—'}</dd></div>
                  <div><dt>Địa điểm</dt><dd>{open.workshop?.location || '—'}</dd></div>
                  <div><dt>Bé tham gia</dt><dd>{open.registration ? `${open.registration.children} bé · vé #${short(open.registration.id)}` : '—'}</dd></div>
                </>
              ) : (
                <div><dt>Đơn hàng</dt><dd>{open.orderId ? `#${short(open.orderId)}` : '—'}</dd></div>
              )}
            </dl>

            {open.status === 'hidden' && open.hiddenReason && (
              <p className="arv-banner"><AdminIcon name="eye" size={15} /> Đang ẩn vì: {open.hiddenReason}</p>
            )}

            <section className="arv-detail-block">
              <h3>{kind === 'workshop' ? 'Phụ huynh viết' : 'Khách viết'}</h3>
              {open.tags.length > 0 && <div className="arv-tags">{open.tags.map((t) => <span key={t}>{t}</span>)}</div>}
              {open.content ? <p className="arv-text">{open.content}</p> : <p className="arv-text is-empty">Không viết thêm.</p>}
              {open.images.length > 0 && (
                <div className="arv-detail-photos">
                  {open.images.map((url, i) => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer" aria-label={`Mở ảnh ${i + 1}`}><img src={url} alt="" /></a>
                  ))}
                </div>
              )}
            </section>

            {mode === 'hide' ? (
              <section className="arv-detail-block">
                <h3>Ẩn đánh giá này</h3>
                <p className="arv-help">{conf.hideHelp}</p>
                <div className="arv-reasons" role="radiogroup" aria-label="Lý do ẩn">
                  {conf.reasons.map((r) => (
                    <label key={r} className={`arv-reason${reason === r ? ' is-on' : ''}`}>
                      <input type="radio" name="arv-reason" checked={reason === r} onChange={() => setReason(r)} />
                      {r}
                    </label>
                  ))}
                </div>
                <input
                  className="form-input"
                  maxLength={200}
                  value={reasonNote}
                  onChange={(e) => setReasonNote(e.target.value)}
                  placeholder={reason === 'Khác' ? 'Ghi rõ lý do (bắt buộc)' : 'Ghi chú thêm (tuỳ chọn)'}
                  aria-label="Ghi chú lý do"
                />
              </section>
            ) : (
              <section className="arv-detail-block">
                <h3>
                  Phản hồi của Sprouty
                  {open.repliedAt && <em> · đã gửi {reviewDate(open.repliedAt)}</em>}
                </h3>
                <div className="arv-templates">
                  {conf.templates.filter((t) => t.when(open.rating)).map((t) => (
                    <button key={t.label} type="button" className="arv-template" onClick={() => setReplyText(t.text)}>{t.label}</button>
                  ))}
                </div>
                <textarea
                  className="form-input arv-reply-input"
                  rows={4}
                  maxLength={1000}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Viết phản hồi — hiển thị công khai dưới đánh giá."
                  aria-label="Phản hồi"
                />
                <div className="arv-reply-bar">
                  <span className="arv-help">Hiển thị là "Phản hồi từ Sprouty" · {replyText.length}/1000</span>
                  {open.reply && (
                    <button type="button" className="btn btn-ghost btn-sm arv-danger-text" disabled={busy} onClick={() => sendReply('')}>Gỡ phản hồi</button>
                  )}
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy || !replyText.trim() || !replyChanged} onClick={() => sendReply(replyText)}>
                    {busy ? 'Đang lưu…' : open.reply ? 'Cập nhật phản hồi' : 'Gửi phản hồi'}
                  </button>
                </div>
              </section>
            )}

            {formError && <div className="form-error">{formError}</div>}
          </div>
        </Modal>
      )}
    </>
  );
}
