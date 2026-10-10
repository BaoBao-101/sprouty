import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import { AdminIcon, type AdminIconName } from '@/components/icons/AdminIcon';
import { Modal, Pagination, Pill, SearchBox } from '@/components/admin/ui';
import './UserImages.css';

type ImageStatus = 'active' | 'hidden' | 'deleted';
interface UserImage {
  id: string; status: ImageStatus; createdAt: string; title?: string | null; note?: string | null;
  stage?: string | null; stageLabel?: string | null; species?: string | null;
  asset?: { url?: string; mimeType?: string; sizeBytes?: number; originalName?: string };
  user?: { id: string; name: string; email: string };
  product?: { id: number; name: string };
  plant?: { id: string; nickname: string; activatedAt: string } | null;
}
interface Gallery { images: UserImage[]; counts: Record<ImageStatus, number>; all: number; page: number; pages: number; total: number; stages: Array<{ id: string; label: string }> }
const PAGE_SIZE = 10;
const labels: Record<ImageStatus, string> = { active: 'Hiển thị trong album', hidden: 'Đã ẩn bởi quản trị', deleted: 'Đã xóa' };
const tones: Record<ImageStatus, string> = { active: 'green', hidden: 'amber', deleted: 'grey' };
const date = (value: string) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const isVideo = (image: UserImage) => image.asset?.mimeType?.startsWith('video/');
const plantName = (image: UserImage) => image.plant?.nickname || image.species || image.product?.name || 'Chưa xác định cây';
function Media({ image, full = false }: { image: UserImage; full?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (image.status === 'deleted' || failed || !image.asset?.url) return <div className="ug-media-placeholder"><AdminIcon name={image.status === 'deleted' ? 'trash' : 'images'} size={32} /><span>{image.status === 'deleted' ? 'Nội dung đã được xóa' : 'Không tải được nội dung'}</span></div>;
  return isVideo(image)
    ? <><video src={image.asset.url} controls={full} muted={!full} playsInline preload="metadata" onError={() => setFailed(true)} />{!full && <span className="ug-video-play"><AdminIcon name="video" size={25} /></span>}</>
    : <img src={image.asset.url} alt={image.title || `Khoảnh khắc của cây ${plantName(image)}`} loading={full ? 'eager' : 'lazy'} onError={() => setFailed(true)} />;
}

export default function UserImages() {
  const [data, setData] = useState<Gallery | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'' | ImageStatus>('');
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [media, setMedia] = useState('');
  const [stage, setStage] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<UserImage | null>(null);
  const [moderating, setModerating] = useState(false);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const request = useRef(0);
  useEffect(() => { const timer = setTimeout(() => { setTerm(search.trim()); setPage(1); }, 300); return () => clearTimeout(timer); }, [search]);
  const load = useCallback(() => {
    const id = ++request.current;
    setState('loading');
    const params: Record<string, unknown> = { page, limit: PAGE_SIZE, sort };
    if (filter) params.status = filter;
    if (term) params.search = term;
    if (media) params.media = media;
    if (stage) params.stage = stage;
    API.admin.userImages.list(params).then((result: Gallery) => {
      if (id !== request.current) return;
      setData(result); setState('ready');
      if (result.page !== page) setPage(result.page);
    }).catch((err: Error) => { if (id === request.current) { setError(err.message || 'Không tải được thư viện.'); setState('error'); } });
  }, [page, filter, term, media, stage, sort]);
  useEffect(load, [load]);
  function open(image: UserImage, review = false) { setPreview(image); setModerating(review); setReason(''); setActionError(''); }
  function close() { if (!busyRef.current) { setPreview(null); setModerating(false); } }
  function reset() { setSearch(''); setTerm(''); setFilter(''); setMedia(''); setStage(''); setPage(1); }
  async function moderate() {
    if (!preview || preview.status === 'deleted' || busyRef.current) return;
    const next = preview.status === 'active' ? 'hidden' : 'active';
    if (next === 'hidden' && reason.trim().length < 5) { setActionError('Vui lòng nhập lý do ẩn, ít nhất 5 ký tự.'); return; }
    busyRef.current = true; setBusy(true); setActionError('');
    try {
      const result = await API.admin.userImages.status(preview.id, next, { reason: reason.trim(), expectedStatus: preview.status });
      setPreview(current => current?.id === result.image.id ? { ...current, status: result.image.status } : current);
      setModerating(false); setReason('');
      showToast(next === 'hidden' ? 'Đã ẩn nội dung khỏi album của người dùng.' : 'Đã hiện lại nội dung trong album.', 'success');
      load();
    } catch (err: any) {
      setActionError(err.message || 'Không cập nhật được trạng thái.');
      if (err.status === 409) { setModerating(false); setPreview(null); load(); showToast(err.message, 'error'); }
    } finally { busyRef.current = false; setBusy(false); }
  }
  const counts = data?.counts;
  const filtered = !!(filter || search.trim() || media || stage);
  const summary: Array<{ title: string; hint: string; value?: number; icon: AdminIconName; tone: string }> = [
    { title: 'Tổng khoảnh khắc', hint: 'Ảnh và video từ album cây', value: data?.all, icon: 'images', tone: 'green' },
    { title: 'Đang hiển thị', hint: 'Trong album của người trồng', value: counts?.active, icon: 'eye', tone: 'blue' },
    { title: 'Đã ẩn', hint: 'Có thể cho hiển thị lại', value: counts?.hidden, icon: 'shield', tone: 'amber' },
    { title: 'Đã xóa', hint: 'Chỉ lưu thông tin đối chiếu', value: counts?.deleted, icon: 'trash', tone: 'grey' },
  ];
  return <div className="user-garden-gallery">
    <header className="ug-header"><div><span className="ug-eyebrow">NỘI DUNG TỪ NGƯỜI TRỒNG</span><h1>Khoảnh khắc từ vườn cây</h1><p>Ảnh và video người dùng lưu lại trong hành trình chăm sóc cây của mình.</p></div>
      <button className="btn btn-ghost btn-sm" onClick={load} disabled={state === 'loading'}><AdminIcon name="refresh" size={16} />Làm mới</button></header>
    <div className="ug-summary">{summary.map(item => <article key={item.title} className={`ug-stat ug-${item.tone}`}><span className="ug-stat-icon"><AdminIcon name={item.icon} size={21} /></span><div><span>{item.title}</span><strong>{state === 'ready' && item.value !== undefined ? item.value.toLocaleString('vi-VN') : '—'}</strong><small>{item.hint}</small></div></article>)}</div>
    <div className="ug-privacy"><AdminIcon name="lock" size={17} /><span>Nội dung thuộc album của từng người dùng. Admin kiểm duyệt tại đây; đây không phải thư viện ảnh sản phẩm hay bảng tin công khai.</span></div>
    <section className="ug-library" aria-label="Thư viện khoảnh khắc">
      <div className="ug-filter-top"><div className="ug-tabs" role="group" aria-label="Lọc trạng thái">{([{ key: '', label: 'Tất cả', count: data?.all }, { key: 'active', label: 'Đang hiển thị', count: counts?.active }, { key: 'hidden', label: 'Đã ẩn', count: counts?.hidden }, { key: 'deleted', label: 'Đã xóa', count: counts?.deleted }] as const).map(item => <button key={item.key} className={filter === item.key ? 'active' : ''} aria-pressed={filter === item.key} onClick={() => { setFilter(item.key); setPage(1); }}>{item.label}<span>{item.count ?? '—'}</span></button>)}</div><span className="ug-page-size">10 khoảnh khắc / trang</span></div>
      <div className="ug-toolbar"><SearchBox value={search} placeholder="Tìm tên cây, người trồng, email, chú thích…" onChange={setSearch} />
        <label><span>Loại nội dung</span><select value={media} onChange={event => { setMedia(event.target.value); setPage(1); }}><option value="">Ảnh và video</option><option value="image">Chỉ ảnh</option><option value="video">Chỉ video</option></select></label>
        <label><span>Giai đoạn lúc đăng</span><select value={stage} onChange={event => { setStage(event.target.value); setPage(1); }}><option value="">Tất cả giai đoạn</option>{data?.stages.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
        <label><span>Sắp xếp</span><select value={sort} onChange={event => { setSort(event.target.value); setPage(1); }}><option value="newest">Mới nhất trước</option><option value="oldest">Cũ nhất trước</option></select></label>
      </div>
      <div className="ug-result-line"><span>{state === 'ready' && data ? `${data.total.toLocaleString('vi-VN')} khoảnh khắc${filtered ? ' phù hợp' : ' trong thư viện'}` : state === 'loading' ? 'Đang tải thư viện…' : 'Chưa tải được thư viện'}</span>{filtered && <button onClick={reset}>Xóa bộ lọc</button>}</div>
      {state === 'loading' && <div className="ug-grid ug-loading" role="status" aria-label="Đang tải nội dung">{[1, 2, 3, 4, 5].map(i => <div key={i} />)}</div>}
      {state === 'error' && <div className="ug-empty" role="alert"><AdminIcon name="alert" size={32} /><h2>Không mở được thư viện</h2><p>{error}</p><button className="btn btn-primary" onClick={load}>Thử lại</button></div>}
      {state === 'ready' && data && <>
        {!data.images.length && <div className="ug-empty"><AdminIcon name="seed" size={36} /><h2>{filtered ? 'Chưa có khoảnh khắc phù hợp' : 'Vườn cây chưa có khoảnh khắc nào'}</h2><p>{filtered ? 'Thử đổi từ khóa hoặc bỏ bớt bộ lọc.' : 'Ảnh và video sẽ xuất hiện khi người dùng tải lên album cây của họ.'}</p>{filtered && <button className="btn btn-ghost" onClick={reset}>Xóa bộ lọc</button>}</div>}
        <div className="ug-grid">{data.images.map(image => <article className={`ug-card ${image.status === 'deleted' ? 'ug-deleted' : ''}`} key={image.id}>
          <button className="ug-card-media" onClick={() => open(image)} aria-label={`Xem ${image.title || 'khoảnh khắc'} của ${plantName(image)}`}><Media image={image} /><span className="ug-media-type"><AdminIcon name={isVideo(image) ? 'video' : 'images'} size={13} />{isVideo(image) ? 'Video' : 'Ảnh'}</span><span className="ug-view-label"><AdminIcon name="eye" size={16} />Xem chi tiết</span></button>
          <div className="ug-card-body"><Pill tone={tones[image.status]}>{labels[image.status]}</Pill><h2 title={image.title || 'Khoảnh khắc chưa đặt tên'}>{image.title || 'Khoảnh khắc chưa đặt tên'}</h2>
            <div className="ug-plant-name"><AdminIcon name="seed" size={17} /><strong>{plantName(image)}</strong></div>
            <div className="ug-stage">{image.stageLabel ? `Lúc đăng: ${image.stageLabel}` : 'Chưa ghi nhận giai đoạn lúc đăng'}</div>
            <p className="ug-caption">{image.note || 'Người trồng chưa thêm ghi chú cho khoảnh khắc này.'}</p>
            <div className="ug-owner"><span className="ug-avatar">{(image.user?.name || '?').slice(0, 1).toUpperCase()}</span><div><strong>{image.user?.name || 'Người trồng'}</strong><span title={image.user?.email}>{image.user?.email || 'Chưa có email'}</span></div></div>
            <time className="ug-upload-time" dateTime={image.createdAt}><AdminIcon name="calendar" size={13} />{date(image.createdAt)}</time>
          </div><div className="ug-card-actions"><button onClick={() => open(image)}>Chi tiết<AdminIcon name="arrow-right" size={14} /></button>{image.status !== 'deleted' ? <button className={image.status === 'active' ? 'ug-hide' : 'ug-restore'} onClick={() => open(image, true)}><AdminIcon name={image.status === 'active' ? 'shield' : 'eye'} size={14} />{image.status === 'active' ? 'Ẩn nội dung' : 'Hiện lại'}</button> : <span>Không thể khôi phục</span>}</div>
        </article>)}</div>
        <div className="ug-result-footer"><span>{data.total ? `Hiển thị ${(data.page - 1) * PAGE_SIZE + 1}–${Math.min(data.page * PAGE_SIZE, data.total)} / ${data.total} khoảnh khắc` : '0 khoảnh khắc'}</span><span>Trang {data.page} / {data.pages}</span></div>
        <Pagination page={data.page} pages={data.pages} total={data.total} unit="khoảnh khắc" onChange={setPage} />
      </>}
    </section>
    {preview && <Modal title={preview.title || 'Chi tiết khoảnh khắc'} subtitle={`Album cây ${plantName(preview)}`} width={1080} onClose={close} footer={<><span className="ug-modal-footnote"><AdminIcon name="shield" size={15} />Thao tác kiểm duyệt được lưu trong nhật ký.</span><button className="btn btn-ghost" disabled={busy} onClick={close}>Đóng</button></>}>
      <div className="ug-detail"><div className="ug-detail-media"><Media key={preview.id + preview.status} image={preview} full /></div><div className="ug-detail-info"><Pill tone={tones[preview.status]}>{labels[preview.status]}</Pill>
        <h3>Hành trình của cây</h3><dl><dt>Tên cây</dt><dd>{plantName(preview)}</dd><dt>Loài cây</dt><dd>{preview.species || 'Chưa xác định'}</dd><dt>Giai đoạn lúc tải lên</dt><dd>{preview.stageLabel || 'Chưa ghi nhận'}</dd><dt>Bắt đầu trồng</dt><dd>{preview.plant ? date(preview.plant.activatedAt) : 'Chưa liên kết với cây đã kích hoạt'}</dd><dt>Kit liên quan</dt><dd>{preview.product?.name || 'Chưa xác định'}</dd></dl>
        <h3>Người lưu khoảnh khắc</h3><p className="ug-detail-person">{preview.user?.name || 'Người trồng'}<span>{preview.user?.email}</span></p><dl><dt>Ngày tải lên</dt><dd>{date(preview.createdAt)}</dd><dt>Loại tệp</dt><dd>{isVideo(preview) ? 'Video' : 'Ảnh'}{preview.asset?.sizeBytes ? ` · ${(preview.asset.sizeBytes / 1048576).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} MB` : ''}</dd></dl>
        <h3>Ghi chú của người trồng</h3><p className="ug-detail-note">{preview.note || 'Chưa có ghi chú.'}</p>
        {preview.status === 'deleted' ? <div className="ug-moderation-note">Nội dung đã xóa chỉ còn thông tin đối chiếu. Admin không thể hiện lại hoặc thay đổi trạng thái.</div> : moderating ? <form className="ug-moderation" onSubmit={event => { event.preventDefault(); void moderate(); }}><h3>{preview.status === 'active' ? 'Ẩn khỏi album của người dùng' : 'Cho hiển thị lại trong album'}</h3><p>{preview.status === 'active' ? 'Nội dung được giữ lại để kiểm duyệt; người dùng sẽ thấy thông báo thay cho ảnh/video.' : 'Ảnh/video sẽ hiển thị trở lại trong album của người trồng.'}</p>{preview.status === 'active' && <label>Lý do ẩn <span aria-hidden="true">*</span><textarea required minLength={5} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} placeholder="Ví dụ: Nội dung không phù hợp với nhật ký trồng cây…" rows={3} disabled={busy} /></label>}{actionError && <p className="form-error" role="alert">{actionError}</p>}<div><button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setModerating(false)}>Hủy</button><button className="btn btn-primary btn-sm" disabled={busy}>{busy ? 'Đang cập nhật…' : preview.status === 'active' ? 'Xác nhận ẩn' : 'Xác nhận hiện lại'}</button></div></form> : <button className="btn btn-ghost ug-review-button" onClick={() => { setModerating(true); setActionError(''); }}><AdminIcon name={preview.status === 'active' ? 'shield' : 'eye'} size={16} />{preview.status === 'active' ? 'Ẩn nội dung này' : 'Hiện lại nội dung'}</button>}
        <Link className="ug-audit-link" to="/admin/audit" onClick={close}>Xem nhật ký kiểm duyệt<AdminIcon name="arrow-right" size={14} /></Link>
      </div></div>
    </Modal>}
  </div>;
}
