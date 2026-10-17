/**
 * Writing or changing a review of something that arrived, or of a workshop
 * session the child attended.
 *
 * Stars first, because that is the one thing asked; then quick remarks that
 * change with the stars (praise from four, problems up to two), a few words,
 * up to four photos, and whether to sign with one's name. A sheet on a phone.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import { confirmAction } from '@/services/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { SproutyIcon } from '@/components/icons/SproutyIcon';
import { StarPicker } from './Stars';
import { RATING_LABELS, maskedName, type OwnReview, type ReviewOptions } from '@/types/review';
import './Reviews.css';

/** What is being reviewed: a kit (the default), or a workshop session. */
export type ReviewTarget =
  | { kind?: 'product'; id: number; name: string; image: string | null }
  | { kind: 'workshop'; id: string; name: string; image: string | null; when?: string };

/** The words that change with what is reviewed. */
const COPY = {
  product: {
    title: 'Đánh giá sản phẩm',
    noStars: 'Chọn số sao cho sản phẩm.',
    placeholder: 'Bé thích điều gì nhất? Hạt nảy mầm sau mấy ngày? Hộp kit có đủ đồ không?',
    note: 'Đánh giá hiển thị công khai trên trang sản phẩm, kèm nhãn "Đã mua hàng".',
    gone: 'Đánh giá sẽ biến mất khỏi trang sản phẩm.',
    photoHint: '',
  },
  workshop: {
    title: 'Đánh giá buổi workshop',
    noStars: 'Chọn số sao cho buổi học.',
    placeholder: 'Bé thích hoạt động nào nhất? Hướng dẫn viên thế nào? Sprouty nên làm gì tốt hơn?',
    note: 'Đánh giá hiển thị công khai trên trang Workshop, kèm nhãn "Đã tham gia".',
    gone: 'Đánh giá sẽ biến mất khỏi trang Workshop.',
    // Children are in these photos; a parent should choose that knowingly.
    photoHint: 'Ảnh hiển thị công khai — nên chọn ảnh không thấy rõ mặt bé.',
  },
};

const FALLBACK_OPTIONS: ReviewOptions = {
  labels: RATING_LABELS,
  tags: { good: [], bad: [] },
  maxImages: 4,
  maxLength: 1000,
};

type Payload = { rating: number; content: string; tags: string[]; images: string[]; anonymous: boolean };

function saver(target: ReviewTarget) {
  if (target.kind === 'workshop') {
    return {
      create: (p: Payload) => API.workshopReviews.create({ workshopId: target.id, ...p }),
      update: (id: string, p: Payload) => API.workshopReviews.update(id, p),
      remove: (id: string) => API.workshopReviews.remove(id),
    };
  }
  return {
    create: (p: Payload) => API.reviews.create({ productId: target.id, ...p }),
    update: (id: string, p: Payload) => API.reviews.update(id, p),
    remove: (id: string) => API.reviews.remove(id),
  };
}

export function ReviewDialog({
  target,
  existing,
  options,
  initialRating,
  onClose,
  onSaved,
}: {
  target: ReviewTarget;
  existing?: OwnReview | null;
  options?: ReviewOptions | null;
  /** Stars already picked on the page that opened the form. */
  initialRating?: number;
  onClose: () => void;
  /** The review as saved, or null once deleted. */
  onSaved: (review: OwnReview | null) => void;
}) {
  const { user } = useAuth();
  const opts = options || FALLBACK_OPTIONS;
  const copy = COPY[target.kind || 'product'];
  const [rating, setRating] = useState(existing?.rating || initialRating || 0);
  const [tags, setTags] = useState<string[]>(existing?.tags || []);
  const [content, setContent] = useState(existing?.content || '');
  const [images, setImages] = useState<string[]>(existing?.images || []);
  const [anonymous, setAnonymous] = useState(Boolean(existing?.anonymous));
  const [uploading, setUploading] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Escape closes, and the page behind must not scroll under the sheet.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = previous; };
  }, [busy, onClose]);

  const offered = useMemo(() => {
    if (!rating) return [];
    if (rating >= 4) return opts.tags.good;
    if (rating <= 2) return opts.tags.bad;
    return [...opts.tags.good, ...opts.tags.bad];
  }, [rating, opts.tags]);

  const toggleTag = (tag: string) => setTags((list) => (list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]));

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    const room = opts.maxImages - images.length - uploading;
    const picked = [...files].slice(0, Math.max(0, room));
    if (files.length > picked.length) showToast(`Mỗi đánh giá tối đa ${opts.maxImages} ảnh.`, 'error');
    setError('');
    for (const file of picked) {
      if (!file.type.startsWith('image/')) { setError('Chỉ nhận ảnh JPG, PNG hoặc WEBP.'); continue; }
      setUploading((n) => n + 1);
      try {
        const form = new FormData();
        form.append('file', file);
        const { url } = await API.reviews.uploadImage(form);
        setImages((list) => [...list, url]);
      } catch (err: any) {
        setError(err?.message || 'Không tải được ảnh lên.');
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  async function submit() {
    if (!rating) return setError(copy.noStars);
    setBusy(true);
    setError('');
    const payload = {
      rating,
      content: content.trim(),
      // Only the remarks that go with the stars chosen.
      tags: tags.filter((t) => offered.includes(t)),
      images,
      anonymous,
    };
    const api = saver(target);
    try {
      const data = existing ? await api.update(existing.id, payload) : await api.create(payload);
      showToast(data.message || 'Cảm ơn bạn đã đánh giá!', 'success');
      onSaved(data.review);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Chưa gửi được đánh giá. Vui lòng thử lại.');
      setBusy(false);
    }
  }

  async function remove() {
    if (!existing) return;
    if (!await confirmAction(`Xoá đánh giá này? ${copy.gone}`, { title: 'Xoá đánh giá', confirmLabel: 'Xoá đánh giá' })) return;
    setBusy(true);
    try {
      const data = await saver(target).remove(existing.id);
      showToast(data.message || 'Đã xoá đánh giá.', 'success');
      onSaved(null);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Không xoá được đánh giá.');
      setBusy(false);
    }
  }

  const left = opts.maxLength - content.length;

  return (
    <div className="rv-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="rv-dialog" role="dialog" aria-modal="true" aria-labelledby="rv-title">
        <header className="rv-head">
          <span className="rv-head-thumb">
            {target.image ? <img src={target.image} alt="" /> : <SproutyIcon name={target.kind === 'workshop' ? 'ticket' : 'pot'} size={22} />}
          </span>
          <div className="rv-head-text">
            <span>{existing ? 'Sửa đánh giá' : copy.title}</span>
            <h2 id="rv-title">{target.name}</h2>
            {target.kind === 'workshop' && target.when && <em>{target.when}</em>}
          </div>
          <button type="button" className="rv-icon-btn" onClick={onClose} disabled={busy} aria-label="Đóng">
            <SproutyIcon name="close" size={16} />
          </button>
        </header>

        <div className="rv-body">
          {existing?.status === 'hidden' && (
            <p className="rv-banner is-warn">
              <SproutyIcon name="warning" size={16} />
              <span>Đánh giá này đang bị ẩn{existing.hiddenReason ? `: ${existing.hiddenReason}` : ''}. Bạn vẫn sửa được.</span>
            </p>
          )}

          <section className="rv-block rv-block-stars">
            <StarPicker value={rating} onChange={(n) => { setRating(n); setError(''); }} labels={opts.labels} />
          </section>

          {offered.length > 0 && (
            <section className="rv-block">
              <h3 className="rv-label">{rating >= 4 ? 'Điều bạn thích' : rating <= 2 ? 'Điều chưa ổn' : 'Nhận xét nhanh'}</h3>
              <div className="rv-tags">
                {offered.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`rv-tag${tags.includes(tag) ? ' is-on' : ''}`}
                    aria-pressed={tags.includes(tag)}
                    onClick={() => toggleTag(tag)}
                  >
                    {tags.includes(tag) && <SproutyIcon name="check" size={13} />}
                    {tag}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="rv-block">
            <label className="rv-label" htmlFor="rv-content">Chia sẻ thêm <em>(không bắt buộc)</em></label>
            <textarea
              id="rv-content"
              className="rv-textarea"
              rows={4}
              maxLength={opts.maxLength}
              placeholder={copy.placeholder}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <span className={`rv-counter${left < 60 ? ' is-low' : ''}`}>{content.length}/{opts.maxLength}</span>
          </section>

          <section className="rv-block">
            <span className="rv-label">Ảnh thực tế <em>(tối đa {opts.maxImages})</em></span>
            {copy.photoHint && <span className="rv-hint"><SproutyIcon name="shield" size={14} /> {copy.photoHint}</span>}
            <div className="rv-photos">
              {images.map((url) => (
                <span className="rv-photo" key={url}>
                  <img src={url} alt="" />
                  <button type="button" className="rv-photo-x" onClick={() => setImages((list) => list.filter((u) => u !== url))} aria-label="Bỏ ảnh này">
                    <SproutyIcon name="close" size={12} />
                  </button>
                </span>
              ))}
              {Array.from({ length: uploading }, (_, i) => (
                <span className="rv-photo is-loading" key={`up-${i}`} aria-label="Đang tải ảnh"><i /></span>
              ))}
              {images.length + uploading < opts.maxImages && (
                <label className="rv-photo-add">
                  <SproutyIcon name="camera" size={20} />
                  <span>Thêm ảnh</span>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => addPhotos(e.target.files)} />
                </label>
              )}
            </div>
          </section>

          <label className="rv-anon">
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
            <span>
              <b>Ẩn tên của tôi</b>
              <em>Hiển thị là: {maskedName(user?.name || '', anonymous)}</em>
            </span>
          </label>

          {error && <p className="rv-error" role="alert">{error}</p>}
          <p className="rv-note">{copy.note}</p>
        </div>

        <footer className="rv-foot">
          {existing && (
            <button type="button" className="rv-btn is-danger" onClick={remove} disabled={busy}>Xoá</button>
          )}
          <span className="rv-foot-gap" />
          <button type="button" className="rv-btn" onClick={onClose} disabled={busy}>Huỷ</button>
          <button type="button" className="rv-btn is-primary" onClick={submit} disabled={busy || uploading > 0 || !rating}>
            {busy ? 'Đang gửi…' : existing ? 'Lưu thay đổi' : 'Gửi đánh giá'}
          </button>
        </footer>
      </div>
    </div>
  );
}
