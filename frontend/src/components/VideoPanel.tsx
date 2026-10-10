import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import { AdminIcon } from '@/components/icons/AdminIcon';

export interface Video {
  id: string;
  title: string;
  description?: string | null;
  status: 'draft' | 'published' | 'archived';
  sortOrder: number;
  durationSec?: number | null;
  externalUrl?: string | null;
  asset?: { url?: string; sizeBytes?: number; mimeType?: string; originalName?: string | null } | null;
  thumbnailAsset?: { url?: string } | null;
  createdAt?: string;
}

const MAX_VIDEO_MB = 500;
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

type Source = 'file' | 'link';

/* ── Small helpers ─────────────────────────────────────────────────────── */

function formatBytes(bytes?: number) {
  if (!bytes) return '';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatDuration(sec?: number | null) {
  if (!sec && sec !== 0) return '';
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

/** A YouTube watch/short/share link, as its embed URL; null for anything else. */
function youTubeEmbed(url: string) {
  const m =
    url.match(/youtu\.be\/([\w-]{6,})/i) ||
    url.match(/youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)([\w-]{6,})/i);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

/** Plays straight in a <video>: a direct file link rather than a page. */
function isDirectVideo(url: string) {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url);
}

function linkKind(url: string) {
  if (youTubeEmbed(url)) return 'YouTube';
  if (/vimeo\.com/i.test(url)) return 'Vimeo';
  if (/drive\.google\.com/i.test(url)) return 'Google Drive';
  if (isDirectVideo(url)) return 'Tệp video';
  return 'Liên kết';
}

/** "buoc-1_chuan-bi-dat.mp4" → "buoc 1 chuan bi dat": a starting point for the title. */
function titleFromFile(name: string) {
  return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Duration and a cover frame, read from the file before anything is uploaded. */
function inspectFile(file: File): Promise<{ duration: number | null; cover: Blob | null }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    let duration: number | null = null;
    const done = (cover: Blob | null) => {
      URL.revokeObjectURL(url);
      resolve({ duration, cover });
    };
    video.onloadedmetadata = () => {
      duration = Number.isFinite(video.duration) ? video.duration : null;
      // A frame a little way in: the first one is often black.
      video.currentTime = Math.min(1.5, (duration || 2) / 3);
    };
    video.onseeked = () => {
      try {
        const w = Math.min(960, video.videoWidth || 960);
        const h = Math.round(w * ((video.videoHeight || 540) / (video.videoWidth || 960)));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')?.drawImage(video, 0, 0, w, h);
        canvas.toBlob((blob) => done(blob), 'image/jpeg', 0.82);
      } catch {
        done(null);
      }
    };
    video.onerror = () => done(null);
    setTimeout(() => done(null), 15000);
    video.src = url;
  });
}

/** What a video plays, for the preview: a file, an embed, or only a link. */
function Player({ video }: { video: Video }) {
  const src = video.asset?.url || video.externalUrl || '';
  if (!src) return <div className="vp-player-empty">Không có nguồn video.</div>;
  const embed = youTubeEmbed(src);
  if (embed) {
    return (
      <iframe
        className="vp-player"
        src={embed}
        title={video.title}
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }
  if (video.asset?.url || isDirectVideo(src)) {
    return <video className="vp-player" src={src} controls preload="metadata" poster={video.thumbnailAsset?.url} />;
  }
  return (
    <div className="vp-player-empty">
      Liên kết này không phát trực tiếp được ở đây.{' '}
      <a href={src} target="_blank" rel="noreferrer">
        Mở trong tab mới
      </a>
    </div>
  );
}

/* ── Panel ─────────────────────────────────────────────────────────────── */

/**
 * Instruction videos for one product. Used inside the product editor (the last
 * step of creating one) and on its own from the product list.
 *
 * Built for somebody adding a video for the first time: pick or drop a file
 * and see it play before saving, with its length and a cover frame read off
 * the file; or paste a YouTube link and see that play instead. Uploads show
 * how far along they are. The list underneath is in the order customers see
 * it, and says plainly which videos customers can see at all.
 */
export function VideoPanel({
  productId,
  productName,
  onCountChange,
}: {
  productId: number;
  productName: string;
  /** Told how many usable (not archived) videos the product has, whenever that changes. */
  onCountChange?: (count: number) => void;
}) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // The add form.
  const [source, setSource] = useState<Source>('file');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState('');
  const [fileInfo, setFileInfo] = useState<{ duration: number | null; cover: Blob | null } | null>(null);
  const [link, setLink] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [publish, setPublish] = useState(true);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // The list.
  const [openId, setOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ title: '', description: '' });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    API.admin.videos
      .list(productId)
      .then((data: any) => {
        setVideos(data.videos || []);
        setError('');
      })
      .catch((err: any) => setError(err?.message || 'Không tải được video.'))
      .finally(() => setLoading(false));
  }, [productId]);

  useEffect(load, [load]);

  const active = useMemo(() => videos.filter((v) => v.status !== 'archived'), [videos]);
  const archived = useMemo(() => videos.filter((v) => v.status === 'archived'), [videos]);
  const published = active.filter((v) => v.status === 'published').length;

  useEffect(() => {
    onCountChange?.(active.length);
  }, [active.length, onCountChange]);

  // A local URL for the chosen file, so it plays before it is uploaded.
  useEffect(() => {
    if (!file) {
      setFilePreview('');
      setFileInfo(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setFilePreview(url);
    let live = true;
    inspectFile(file).then((info) => live && setFileInfo(info));
    return () => {
      live = false;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  function pickFile(next: File | null | undefined) {
    setFormError('');
    if (!next) return;
    if (!VIDEO_TYPES.includes(next.type) && !/\.(mp4|webm|mov)$/i.test(next.name)) {
      setFormError('Chỉ nhận tệp MP4, WebM hoặc MOV.');
      return;
    }
    if (next.size > MAX_VIDEO_MB * 1024 * 1024) {
      setFormError(`Tệp ${formatBytes(next.size)} vượt quá giới hạn ${MAX_VIDEO_MB} MB.`);
      return;
    }
    setFile(next);
    if (!title.trim()) setTitle(titleFromFile(next.name));
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    setSource('file');
    pickFile(e.dataTransfer.files?.[0]);
  }

  function resetForm() {
    setFile(null);
    setLink('');
    setTitle('');
    setDescription('');
    setProgress(null);
    setFormError('');
    if (fileInput.current) fileInput.current.value = '';
  }

  const linkTrimmed = link.trim();
  const linkValid = /^https?:\/\/\S+$/i.test(linkTrimmed);
  const nextOrder = active.length ? Math.max(...active.map((v) => v.sortOrder)) + 10 : 0;

  /** Why the add button is not ready yet, said next to it. */
  const missing = !title.trim()
    ? 'Nhập tiêu đề video.'
    : source === 'file' && !file
      ? 'Chọn hoặc kéo thả một tệp video.'
      : source === 'link' && !linkValid
        ? 'Dán một liên kết bắt đầu bằng https://'
        : '';

  async function create() {
    if (missing || saving) {
      setFormError(missing);
      return;
    }
    setFormError('');
    setSaving(true);
    const payload: Record<string, string> = {
      title: title.trim(),
      description: description.trim(),
      sortOrder: String(nextOrder),
      status: publish ? 'published' : 'draft',
    };
    try {
      let created: Video | undefined;
      if (source === 'file' && file) {
        const form = new FormData();
        Object.entries(payload).forEach(([k, v]) => form.append(k, v));
        if (fileInfo?.duration) form.append('durationSec', String(Math.round(fileInfo.duration)));
        form.append('video', file);
        setProgress({ loaded: 0, total: file.size });
        const data = await API.admin.videos.upload(productId, form, (loaded, total) => setProgress({ loaded, total }));
        created = data?.video;
        // The frame read off the file becomes the cover, so the list and the
        // customer page do not show a blank tile.
        if (created && fileInfo?.cover) {
          const thumb = new FormData();
          thumb.append('thumbnail', new File([fileInfo.cover], 'cover.jpg', { type: 'image/jpeg' }));
          await API.admin.videos.thumbnail(created.id, thumb).catch(() => null);
        }
      } else {
        const data = await API.admin.videos.create(productId, { ...payload, sortOrder: nextOrder, externalUrl: linkTrimmed });
        created = data?.video;
      }
      showToast(publish ? 'Đã thêm video — khách đã mua kit xem được ngay' : 'Đã thêm video (bản nháp)', 'success');
      resetForm();
      if (created) setOpenId(null);
      load();
    } catch (err: any) {
      setFormError(err?.message || 'Không thêm được video.');
      setProgress(null);
    } finally {
      setSaving(false);
    }
  }

  async function update(video: Video, data: Partial<Video>, message = 'Đã cập nhật video') {
    setBusyId(video.id);
    try {
      await API.admin.videos.update(video.id, data);
      setVideos((list) => list.map((v) => (v.id === video.id ? { ...v, ...data } : v)));
      showToast(message, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Không cập nhật được video', 'error');
      load();
    } finally {
      setBusyId(null);
    }
  }

  async function uploadThumbnail(video: Video, thumb: File) {
    setBusyId(video.id);
    const form = new FormData();
    form.append('thumbnail', thumb);
    try {
      await API.admin.videos.thumbnail(video.id, form);
      showToast('Đã đổi ảnh bìa', 'success');
      load();
    } catch (err: any) {
      showToast(err?.message || 'Không tải được ảnh bìa', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function archive(video: Video) {
    if (!confirm(`Lưu trữ video “${video.title}”? Khách sẽ không thấy video này nữa; có thể khôi phục lại sau.`)) return;
    setBusyId(video.id);
    try {
      await API.admin.videos.remove(video.id);
      showToast('Đã lưu trữ video', 'success');
      load();
    } catch (err: any) {
      showToast(err?.message || 'Không lưu trữ được video', 'error');
    } finally {
      setBusyId(null);
    }
  }

  /** Moves a video one place and renumbers the list, so equal orders cannot tie. */
  async function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= active.length) return;
    const order = [...active];
    [order[index], order[target]] = [order[target], order[index]];
    const changes = order
      .map((v, i) => ({ v, sortOrder: i * 10 }))
      .filter(({ v, sortOrder }) => v.sortOrder !== sortOrder);
    setVideos((list) =>
      list.map((v) => {
        const c = changes.find((x) => x.v.id === v.id);
        return c ? { ...v, sortOrder: c.sortOrder } : v;
      }).sort((a, b) => a.sortOrder - b.sortOrder),
    );
    try {
      await Promise.all(changes.map(({ v, sortOrder }) => API.admin.videos.update(v.id, { sortOrder })));
    } catch (err: any) {
      showToast(err?.message || 'Không đổi được thứ tự', 'error');
      load();
    }
  }

  function startEdit(video: Video) {
    setEditId(video.id);
    setEditDraft({ title: video.title, description: video.description || '' });
  }

  async function saveEdit(video: Video) {
    if (!editDraft.title.trim()) {
      showToast('Tiêu đề không được để trống', 'error');
      return;
    }
    await update(video, { title: editDraft.title.trim(), description: editDraft.description.trim() }, 'Đã lưu tiêu đề và mô tả');
    setEditId(null);
  }

  const percent = progress && progress.total ? Math.round((progress.loaded / progress.total) * 100) : 0;

  return (
    <div
      className="vp"
      // The panel sits inside the product editor's form. Enter in one of its
      // fields would submit that form — and on the last step, close it.
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault();
      }}
    >
      {/* ── Where things stand ─────────────────────────────────────────── */}
      <div className="vp-summary">
        <div>
          <strong>Video hướng dẫn · {productName}</strong>
          <span>Khách đã mua sản phẩm này xem trong trang chăm cây, theo đúng thứ tự bên dưới.</span>
        </div>
        <div className="vp-summary-stats">
          <span className="vp-stat">
            <b>{active.length}</b> video
          </span>
          <span className={`vp-stat${published ? ' is-good' : ' is-warn'}`}>
            <b>{published}</b> đang hiện cho khách
          </span>
        </div>
      </div>

      {/* ── Add a video ────────────────────────────────────────────────── */}
      <section className="vp-add" aria-label="Thêm video mới">
        <header className="vp-add-head">
          <h4>
            <AdminIcon name="plus" size={16} /> Thêm video mới
          </h4>
          <div className="vp-source" role="tablist" aria-label="Nguồn video">
            <button
              type="button"
              role="tab"
              aria-selected={source === 'file'}
              className={source === 'file' ? 'active' : ''}
              onClick={() => setSource('file')}
              disabled={saving}
            >
              <AdminIcon name="upload" size={15} /> Tải tệp lên
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={source === 'link'}
              className={source === 'link' ? 'active' : ''}
              onClick={() => setSource('link')}
              disabled={saving}
            >
              <AdminIcon name="link" size={15} /> Dán link YouTube…
            </button>
          </div>
        </header>

        <div className="vp-add-grid">
          {/* Left: the video itself, so it can be watched before saving. */}
          <div className="vp-media">
            {source === 'file' ? (
              file ? (
                <div className="vp-file">
                  <video className="vp-player" src={filePreview} controls preload="metadata" />
                  <div className="vp-file-meta">
                    <span className="vp-file-name" title={file.name}>
                      <AdminIcon name="video" size={15} /> {file.name}
                    </span>
                    <span className="vp-file-facts">
                      {formatBytes(file.size)}
                      {fileInfo?.duration ? ` · ${formatDuration(fileInfo.duration)}` : ''}
                      {fileInfo?.cover ? ' · có ảnh bìa tự động' : ''}
                    </span>
                    {!saving && (
                      <span className="vp-file-actions">
                        <button type="button" className="vp-link-btn" onClick={() => fileInput.current?.click()}>
                          Đổi tệp
                        </button>
                        <button type="button" className="vp-link-btn is-danger" onClick={() => setFile(null)}>
                          Bỏ tệp
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className={`vp-drop${dragging ? ' is-over' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInput.current?.click()}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInput.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                >
                  <span className="vp-drop-icon">
                    <AdminIcon name="upload" size={26} />
                  </span>
                  <strong>Kéo thả video vào đây</strong>
                  <span>hoặc bấm để chọn từ máy</span>
                  <em>MP4, WebM, MOV · tối đa {MAX_VIDEO_MB} MB</em>
                </div>
              )
            ) : (
              <div className="vp-linkbox">
                <label className="field">
                  <span className="field-label">
                    Liên kết video <span className="req">*</span>
                  </span>
                  <input
                    className="form-input"
                    placeholder="https://www.youtube.com/watch?v=…"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    disabled={saving}
                  />
                  <span className="field-hint">
                    {linkTrimmed
                      ? linkValid
                        ? `Nhận diện: ${linkKind(linkTrimmed)}`
                        : 'Liên kết phải bắt đầu bằng http:// hoặc https://'
                      : 'YouTube, Vimeo, Google Drive hoặc link trực tiếp tới tệp .mp4'}
                  </span>
                </label>
                {linkValid ? (
                  <Player video={{ id: 'draft', title: title || 'Xem trước', status: 'draft', sortOrder: 0, externalUrl: linkTrimmed }} />
                ) : (
                  <div className="vp-player-empty">Dán liên kết để xem trước video tại đây.</div>
                )}
              </div>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
              hidden
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
          </div>

          {/* Right: what the customer reads about it. */}
          <div className="vp-details">
            <label className="field">
              <span className="field-label">
                Tiêu đề <span className="req">*</span>
              </span>
              <input
                className="form-input"
                maxLength={200}
                placeholder="VD: Bước 1 — Chuẩn bị đất và gieo hạt"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={saving}
              />
            </label>
            <label className="field">
              <span className="field-label">Mô tả ngắn</span>
              <textarea
                className="form-input"
                rows={3}
                maxLength={2000}
                placeholder="Video hướng dẫn điều gì, bé cần chuẩn bị gì…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={saving}
              />
            </label>

            <div className="field">
              <span className="field-label">Hiển thị</span>
              <div className="vp-visibility">
                <button
                  type="button"
                  className={publish ? 'active' : ''}
                  onClick={() => setPublish(true)}
                  disabled={saving}
                >
                  <AdminIcon name="eye" size={16} />
                  <span>
                    <b>Xuất bản ngay</b>
                    <small>Khách đã mua thấy ngay</small>
                  </span>
                </button>
                <button
                  type="button"
                  className={!publish ? 'active' : ''}
                  onClick={() => setPublish(false)}
                  disabled={saving}
                >
                  <AdminIcon name="lock" size={16} />
                  <span>
                    <b>Lưu nháp</b>
                    <small>Chỉ quản trị thấy</small>
                  </span>
                </button>
              </div>
            </div>
            <p className="vp-position">
              Sẽ là video thứ <b>{active.length + 1}</b> trong danh sách — đổi thứ tự bằng nút mũi tên bên dưới.
            </p>
          </div>
        </div>

        {/* Upload progress, then the button. */}
        {progress && (
          <div className="vp-progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div className="vp-progress-bar">
              <i style={{ width: `${percent}%` }} />
            </div>
            <span>
              {percent < 100
                ? `Đang tải lên ${percent}% · ${formatBytes(progress.loaded)} / ${formatBytes(progress.total)}`
                : 'Đã tải xong, đang xử lý…'}
            </span>
          </div>
        )}

        <footer className="vp-add-foot">
          <span className={`vp-hint${formError ? ' is-error' : ''}`}>
            {formError || missing || 'Sẵn sàng — bấm Thêm video.'}
          </span>
          {(file || link || title || description) && !saving && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={resetForm}>
              Làm lại
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={saving || Boolean(missing)}
            onClick={create}
          >
            <AdminIcon name={saving ? 'clock' : 'plus'} size={15} />
            {saving ? (source === 'file' ? 'Đang tải lên…' : 'Đang lưu…') : 'Thêm video'}
          </button>
        </footer>
      </section>

      {/* ── The list, in the order customers see it ───────────────────── */}
      <section className="vp-list" aria-label="Danh sách video">
        <div className="vp-list-head">
          <h4>Danh sách video ({active.length})</h4>
          <span>Thứ tự trên cùng là video khách xem đầu tiên.</span>
        </div>

        {loading && <div className="panel-empty">Đang tải video…</div>}
        {error && <div className="panel-empty error">{error}</div>}
        {!loading && !error && active.length === 0 && (
          <div className="vp-empty">
            <AdminIcon name="video" size={28} />
            <strong>Chưa có video nào</strong>
            <span>Thêm video đầu tiên ở khung phía trên — khách mua kit sẽ xem trong trang chăm cây.</span>
          </div>
        )}

        {active.map((video, i) => {
          const isOpen = openId === video.id;
          const isEditing = editId === video.id;
          const busy = busyId === video.id;
          const src = video.asset?.url || video.externalUrl || '';
          return (
            <article className={`vp-item${busy ? ' is-busy' : ''}${isOpen ? ' is-open' : ''}`} key={video.id}>
              <div className="vp-item-row">
                <span className="vp-item-index">{i + 1}</span>

                <button
                  type="button"
                  className="vp-item-thumb"
                  onClick={() => setOpenId(isOpen ? null : video.id)}
                  title={isOpen ? 'Thu gọn' : 'Xem video'}
                >
                  {video.thumbnailAsset?.url ? <img src={video.thumbnailAsset.url} alt="" /> : <AdminIcon name="video" size={22} />}
                  <span className="vp-item-play">▶</span>
                  {video.durationSec ? <em>{formatDuration(video.durationSec)}</em> : null}
                </button>

                <div className="vp-item-main">
                  {isEditing ? (
                    <div className="vp-item-edit">
                      <input
                        className="form-input"
                        value={editDraft.title}
                        maxLength={200}
                        onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
                        autoFocus
                      />
                      <textarea
                        className="form-input"
                        rows={2}
                        value={editDraft.description}
                        placeholder="Mô tả ngắn"
                        onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
                      />
                      <div className="vp-item-edit-actions">
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => saveEdit(video)} disabled={busy}>
                          Lưu
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditId(null)}>
                          Hủy
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="vp-item-title">
                        {video.title}
                        <span className={`vp-pill ${video.status === 'published' ? 'is-live' : 'is-draft'}`}>
                          {video.status === 'published' ? 'Đang hiện cho khách' : 'Bản nháp'}
                        </span>
                      </div>
                      {video.description && <p className="vp-item-desc">{video.description}</p>}
                      <div className="vp-item-src">
                        {video.asset?.url ? (
                          <>
                            <AdminIcon name="upload" size={13} /> Tệp tải lên
                            {video.asset.sizeBytes ? ` · ${formatBytes(video.asset.sizeBytes)}` : ''}
                          </>
                        ) : (
                          <>
                            <AdminIcon name="link" size={13} /> {linkKind(src)} ·{' '}
                            <a href={src} target="_blank" rel="noreferrer">
                              mở link
                            </a>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {!isEditing && (
                  <div className="vp-item-actions">
                    <div className="vp-order">
                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0 || busy} title="Lên trên" aria-label="Lên trên">
                        <AdminIcon name="chevron-up" size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(i, 1)}
                        disabled={i === active.length - 1 || busy}
                        title="Xuống dưới"
                        aria-label="Xuống dưới"
                      >
                        <AdminIcon name="chevron-down" size={15} />
                      </button>
                    </div>
                    <button
                      type="button"
                      className={`act-btn ${video.status === 'published' ? '' : 'act-edit'}`}
                      disabled={busy}
                      onClick={() =>
                        update(
                          video,
                          { status: video.status === 'published' ? 'draft' : 'published' },
                          video.status === 'published' ? 'Đã ẩn video khỏi khách' : 'Đã xuất bản video',
                        )
                      }
                    >
                      <AdminIcon name={video.status === 'published' ? 'lock' : 'eye'} size={14} />
                      {video.status === 'published' ? 'Ẩn' : 'Xuất bản'}
                    </button>
                    <button type="button" className="act-btn" disabled={busy} onClick={() => startEdit(video)}>
                      <AdminIcon name="edit" size={14} /> Sửa
                    </button>
                    <label className={`act-btn${busy ? ' is-disabled' : ''}`} title="Đổi ảnh bìa">
                      <AdminIcon name="images" size={14} /> Ảnh bìa
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        hidden
                        disabled={busy}
                        onChange={(e) => {
                          const thumb = e.target.files?.[0];
                          if (thumb) uploadThumbnail(video, thumb);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    <button type="button" className="act-btn act-del" disabled={busy} onClick={() => archive(video)} title="Lưu trữ">
                      <AdminIcon name="trash" size={14} />
                    </button>
                  </div>
                )}
              </div>

              {isOpen && (
                <div className="vp-item-player">
                  <Player video={video} />
                </div>
              )}
            </article>
          );
        })}

        {archived.length > 0 && (
          <div className="vp-archived">
            <button type="button" className="vp-link-btn" onClick={() => setShowArchived((v) => !v)}>
              {showArchived ? 'Ẩn' : 'Xem'} {archived.length} video đã lưu trữ
            </button>
            {showArchived &&
              archived.map((video) => (
                <div className="vp-archived-row" key={video.id}>
                  <span>{video.title}</span>
                  <button
                    type="button"
                    className="act-btn act-edit"
                    disabled={busyId === video.id}
                    onClick={() => update(video, { status: 'draft', sortOrder: nextOrder }, 'Đã khôi phục video (bản nháp)')}
                  >
                    Khôi phục
                  </button>
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}
