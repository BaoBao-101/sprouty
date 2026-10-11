import { confirmAction } from '@/services/dialog';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import { SproutyIcon, type IconName } from '@/components/icons/SproutyIcon';
import { PlantArt, type PlantStageId } from '@/components/PlantArt';
import type { FruitShape, PlantForm } from '@/components/PlantForms';
import './Tree.css';
import { MemoryTreeArt } from '@/components/MemoryTreeArt';

interface Leaf {
  id: string;
  status?: 'active' | 'hidden' | 'deleted';
  url: string;
  title?: string;
  note?: string;
  createdAt?: string;
  /** The growth stage the plant was at when this was saved. */
  stage?: PlantStageId | null;
  stageLabel?: string | null;
  asset?: { mimeType?: string; originalName?: string };
}

/** What GET /my-products/:id/images returns, now that it describes a journey. */
interface AlbumData {
  images: Leaf[];
  maxLeaves: number | null;
  product: { id: number; name: string } | null;
  plant: {
    id: string;
    nickname: string;
    stage: PlantStageId;
    stageProgress: number;
    health: number;
  } | null;
  species: {
    key: string;
    label: string;
    harvest: string;
    form: PlantForm;
    fruitShape: FruitShape;
    fruitColor: string;
    flowerColor: string;
  };
  stages: Array<{ id: PlantStageId; label: string; icon: string }>;
}

const DEFAULT_MAX_LEAVES = 10;

function useAlbumDialog(onClose: () => void, busy = false) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && !busy) onClose();
    if (event.key !== 'Tab') return;
    const elements = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, textarea, video[controls], a[href]');
    if (!elements?.length) return;
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  }
  return { ref, onKeyDown, tabIndex: -1, role: 'dialog' as const, 'aria-modal': true as const };
}

function isVideo(leaf: Leaf) {
  return (leaf.asset?.mimeType || '').startsWith('video/');
}

function AlbumMedia({ src, video, title }: { src: string; video: boolean; title: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="album-media-fallback"><SproutyIcon name={video ? 'camera' : 'album'} size={36} /><strong>{title}</strong><p>Trình duyệt chưa xem trực tiếp được tệp này. Bạn vẫn có thể lưu vào album và mở bằng ứng dụng trên máy.</p><a href={src} target="_blank" rel="noopener noreferrer" download>Mở / tải tệp gốc ↗</a></div>;
  return video ? <video src={src} controls onError={() => setFailed(true)} /> : <img src={src} alt={title} onError={() => setFailed(true)} />;
}

/**
 * Downscale before sending to the vision model — a leaf caption does not need
 * full resolution and the request stays small.
 */
function resizeToDataUrl(file: File, maxDim = 640, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      let { width, height } = image;
      if (width > height && width > maxDim) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else if (height > maxDim) {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không đọc được ảnh này.'));
    };
    image.src = url;
  });
}

function ComposeModal({
  file: initialFile,
  onClose,
  onUploaded,
  productId,
  stages,
  initialStage,
}: {
  file: File;
  onClose: () => void;
  onUploaded: (leaf: Leaf) => void;
  productId: string;
  stages: AlbumData['stages'];
  initialStage: string;
}) {
  const [file, setFile] = useState<File | null>(initialFile);
  const replaceInput = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [stage, setStage] = useState(initialStage);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const dialog = useAlbumDialog(onClose, busy);

  const video = !!file && (file.type.startsWith('video/') || /\.(mp4|m4v|mov|qt|webm|mkv|avi|3gp|3gpp|3g2|mpeg|mpg|mpe|ogv|wmv|asf|flv)$/i.test(file.name));

  useEffect(() => {
    if (!file) { setPreviewUrl(''); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function suggest() {
    if (!file || busy || suggesting) return;
    setSuggesting(true);
    try {
      const dataUrl = await resizeToDataUrl(file);
      // The instruction rides in the user message, not a system prompt: the
      // server owns the system prompt now (finding F-07), and a caption request
      // is ordinary chat content anyway.
      const { reply } = await API.chat.send(
        [
          {
            role: 'user',
            content:
              'Hãy đặt một caption tiếng Việt ngắn gọn (tối đa 8 từ) mô tả đúng những gì có trong ảnh này, ' +
              'dùng làm tên cho khoảnh khắc. Chỉ trả lời đúng một dòng caption, không thêm lời dẫn.',
          },
        ],
        dataUrl,
      );
      setCaption(reply.replace(/^["'“”]+|["'“”]+$/g, '').trim());
    } catch (err: any) {
      showToast(err?.message || 'Không thể tạo gợi ý caption', 'error');
    } finally {
      setSuggesting(false);
    }
  }

  async function submit() {
    if (!file || busy || suggesting) return;
    setBusy(true);
    const form = new FormData();
    // Text fields go before the file so Fastify's multipart parser exposes
    // them on req.file().fields.
    if (caption.trim()) form.append('title', caption.trim());
    if (note.trim()) form.append('note', note.trim());
    if (stage) form.append('stage', stage);
    form.append('image', file);

    try {
      const { image } = await API.myImages.upload(productId, form);
      showToast('Một chiếc lá mới đã nở!', 'success');
      onUploaded(image);
      onClose();
    } catch (err: any) {
      showToast(err?.message || 'Không thể thêm lá mới', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="modal-overlay open album-dialog-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="leaf-modal-card" {...dialog} aria-label="Thêm khoảnh khắc mới">
        <div className="leaf-dialog-heading"><span>NHẬT KÝ LỚN LÊN</span><h2>Một khoảnh khắc, một chiếc lá mới</h2><p>Xem trước và viết vài dòng cho kỷ niệm của bạn.</p></div>
        <button className="leaf-modal-close" disabled={busy} onClick={onClose} aria-label="Đóng">
          ✕
        </button>

        <label className="album-stage-field">Giai đoạn trong ảnh
          <select className="form-input" value={stage} onChange={(event) => setStage(event.target.value)} disabled={busy}>
            <option value="">Giai đoạn hiện tại của cây</option>
            {stages.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <small>Bạn có thể bổ sung ảnh cho những chặng đã qua.</small>
        </label>
        <input ref={replaceInput} type="file" hidden disabled={busy || suggesting} onChange={event => {
          const next = event.target.files?.[0];
          event.target.value = '';
          if (next) { setPreviewUrl(''); setFile(next); }
        }} />
        {file ? <>
          <div className="leaf-media-frame">
            {previewUrl && <AlbumMedia key={previewUrl} src={previewUrl} video={video} title={file.name} />}
          </div>
          <div className="leaf-file-actions">
            <span title={file.name}>{file.name}</span>
            <button className="btn btn-outline btn-sm" disabled={busy || suggesting} onClick={() => replaceInput.current?.click()}><SproutyIcon name="camera" size={16} /> Đổi ảnh/video</button>
            <button className="btn btn-ghost btn-sm leaf-remove-file" disabled={busy || suggesting} onClick={() => { setFile(null); setPreviewUrl(''); }}><SproutyIcon name="trash" size={16} /> Gỡ tệp</button>
          </div>
        </> : <button className="leaf-file-empty" disabled={busy || suggesting} onClick={() => replaceInput.current?.click()}>
          <SproutyIcon name="camera" size={32} /><strong>Chọn ảnh hoặc video khác</strong><span>Tên, ghi chú và giai đoạn của bạn vẫn được giữ lại.</span>
        </button>}

        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input
            className="form-input"
            placeholder="Đặt tên cho khoảnh khắc này"
            style={{ flex: 1 }}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
          {/* Captioning looks at a photo, so it makes no sense for a clip. */}
          {file && !video && (
            <button
              className="btn btn-outline btn-sm"
              style={{ whiteSpace: 'nowrap' }}
              disabled={suggesting || busy}
              onClick={suggest}
            >
              {suggesting ? 'Đang xem ảnh...' : <><SproutyIcon name="sparkle" size={15} /> AI gợi ý</>}
            </button>
          )}
        </div>

        <textarea
          className="form-input"
          rows={3}
          placeholder="Viết nhật ký cho khoảnh khắc này (không bắt buộc)"
          style={{ marginBottom: 12, resize: 'vertical' }}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={onClose}>
            Hủy
          </button>
          <button className="btn btn-primary btn-sm" disabled={busy || suggesting || !file} onClick={submit}>
            {busy ? 'Đang đăng...' : <><SproutyIcon name="sprout" size={16} /> Đăng lên cây</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function LeafModal({
  leaf,
  onClose,
  onChanged,
}: {
  leaf: Leaf;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [title, setTitle] = useState(leaf.title || '');
  const [note, setNote] = useState(leaf.note || '');
  const [failed, setFailed] = useState(false);
  const dialog = useAlbumDialog(onClose);

  async function save() {
    try {
      await API.myImages.update(leaf.id, { title, note });
      showToast('Đã lưu', 'success');
      onChanged();
      onClose();
    } catch (err: any) {
      showToast(err?.message || 'Không thể lưu', 'error');
    }
  }

  async function remove() {
    if (!await confirmAction('Xoá chiếc lá này khỏi cây?')) return;
    try {
      await API.myImages.remove(leaf.id);
      showToast('Đã xoá lá', 'success');
      onChanged();
      onClose();
    } catch (err: any) {
      showToast(err?.message || 'Không thể xoá', 'error');
    }
  }

  return (
    <div
      className="modal-overlay open album-dialog-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="leaf-modal-card leaf-viewer" {...dialog} aria-label="Xem khoảnh khắc">
        <div className="leaf-dialog-heading"><span>{leaf.stageLabel || 'KỶ NIỆM CỦA CÂY'}</span><h2>{leaf.title || 'Một ngày cây lớn lên'}</h2><p>{leaf.createdAt ? new Date(leaf.createdAt).toLocaleDateString('vi-VN') : 'Đã lưu trong album'} · Một chút xanh, một chút thương.</p></div>
        <button className="leaf-modal-close" onClick={onClose} aria-label="Đóng">
          ✕
        </button>

        <div className="leaf-media-frame">
          {leaf.status === 'hidden' ? (
            <p style={{ padding: 24, textAlign: 'center', color: 'var(--ink-4)' }}>Nội dung này đã được quản trị viên ẩn. Bạn vẫn có thể sửa ghi chú hoặc gỡ khoảnh khắc khỏi album.</p>
          ) : failed ? (
            <div className="album-media-fallback"><SproutyIcon name="album" size={36} /><p>Trình duyệt chưa xem trực tiếp được tệp này.</p><a href={leaf.url} target="_blank" rel="noopener noreferrer" download>Mở / tải tệp gốc ↗</a></div>
          ) : isVideo(leaf) ? (
            <video src={leaf.url} controls onError={() => setFailed(true)} />
          ) : (
            <img src={leaf.url} alt={leaf.title || 'Kỷ niệm'} onError={() => setFailed(true)} />
          )}
        </div>

        <input
          className="form-input"
          placeholder="Đặt tên cho khoảnh khắc này"
          style={{ marginBottom: 10 }}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="form-input"
          rows={3}
          placeholder="Viết nhật ký cho khoảnh khắc này (không bắt buộc)"
          style={{ marginBottom: 12, resize: 'vertical' }}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary btn-sm" onClick={save}>
            Lưu
          </button>
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--rose)' }}
            onClick={remove}
          >
            Xoá lá này
          </button>
        </div>

      </div>
    </div>
  );
}

export default function Tree() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const productId = searchParams.get('id') || '';

  const [album, setAlbum] = useState<AlbumData | null>(null);
  const [leaves, setLeaves] = useState<Leaf[]>([]);
  const [maxLeaves, setMaxLeaves] = useState<number | null>(DEFAULT_MAX_LEAVES);
  const [loading, setLoading] = useState(true);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [openLeaf, setOpenLeaf] = useState<Leaf | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [selectedStage, setSelectedStage] = useState<string>('all');

  useEffect(() => {
    if (!productId) navigate('/my-plants', { replace: true });
  }, [productId, navigate]);

  const loadLeaves = useCallback(() => {
    if (!productId) return;
    API.myImages
      .list(productId)
      .then((data: AlbumData) => {
        setAlbum(data);
        setLeaves(data.images || []);
        if (data.maxLeaves !== undefined) setMaxLeaves(data.maxLeaves);
      })
      .catch((err: any) => {
        showToast(err?.message || 'Không tải được album', 'error');
        setLeaves([]);
      })
      .finally(() => setLoading(false));
  }, [productId]);

  useEffect(loadLeaves, [loadLeaves]);

  const full = maxLeaves !== null && leaves.length >= maxLeaves;
  const species = album?.species;
  const plant = album?.plant;
  const title = plant?.nickname || album?.product?.name || 'Album kỷ niệm';
  const uploadStage = selectedStage === 'all' || selectedStage === 'unknown' ? plant?.stage || '' : selectedStage;
  const currentStageLabel = album?.stages.find((stage) => stage.id === uploadStage)?.label || '';

  /**
   * Photos grouped by the stage they were taken at, newest stage first, so the
   * album reads as the plant's journey rather than as a pile of pictures.
   * Anything uploaded before the plant existed carries no stage and collects at
   * the end rather than being guessed into a group it may not belong to.
   */
  const groups = useMemo(() => {
    const stages = album?.stages || [];
    const byStage = new Map<string, Leaf[]>();
    const undated: Leaf[] = [];

    for (const leaf of leaves) {
      if (!leaf.stage) {
        undated.push(leaf);
        continue;
      }
      const list = byStage.get(leaf.stage) || [];
      list.push(leaf);
      byStage.set(leaf.stage, list);
    }

    // Widened to a plain string: the trailing "unknown" group is not a growth
    // stage, and typing the list as PlantStageId would make it a lie.
    const ordered: Array<{ id: string; label: string; icon: IconName; items: Leaf[] }> = stages
      .map((st, index) => ({ ...st, index }))
      .filter((st) => byStage.has(st.id))
      .sort((a, b) => b.index - a.index)
      .map((st) => ({
        id: st.id as string,
        label: st.label,
        icon: st.icon as IconName,
        items: byStage.get(st.id) as Leaf[],
      }));

    if (undated.length) {
      ordered.push({
        id: 'unknown',
        label: 'Chưa rõ chặng',
        icon: 'album' as IconName,
        items: undated,
      });
    }
    return ordered;
  }, [leaves, album]);

  return (
    <>
      <div className="album-hero">
        <div className="container">
          <div className="breadcrumb album-crumb">
            <Link to="/">Trang chủ</Link> › <Link to="/my-plants">Cây của tôi</Link> ›{' '}
            <span>Album</span>
          </div>

          <div className="album-hero-row">
            {/* The plant itself, drawn in its own species' form. This page used
                to show one bare-branch tree for every product, so a carrot and a
                sunflower shared an illustration that was neither of them. */}
            {plant && species && (
              <div className="album-plant">
                <PlantArt
                  stage={plant.stage}
                  progress={plant.stageProgress}
                  health={plant.health}
                  form={species.form}
                  fruitShape={species.fruitShape}
                  fruitColor={species.fruitColor}
                  flowerColor={species.flowerColor}
                  size={170}
                />
              </div>
            )}

            <div className="album-hero-copy">
              <span className="album-eyebrow">GÓC NHỎ LƯU GIỮ ĐIỀU XANH</span>
              <h1>Album — {title}</h1>
              <p>
                {species
                  ? `Lưu lại từng chặng của cây ${species.label.toLowerCase()}, từ hạt giống tới ngày thu hoạch ${species.harvest}.`
                  : 'Lưu lại ảnh và video từng chặng lớn lên của cây.'}
              </p>
              <div className="album-hero-meta">
                <span className="album-count">
                  <SproutyIcon name="album" size={16} />
                  {leaves.length}{maxLeaves === null ? ' · Không giới hạn' : `/${maxLeaves}`} khoảnh khắc
                </span>
                {plant && (
                  <Link to={`/plant/${plant.id}`} className="album-back-plant">
                    <SproutyIcon name="sprout" size={16} />
                    Vào chăm cây
                  </Link>
                )}
              </div>
            </div>
            <div className="album-hero-sticker" aria-hidden="true"><SproutyIcon name="camera" size={32} /><strong>Chậm một chút,<br />ngắm cây lớn lên.</strong><span>made with love ♡</span></div>
          </div>
        </div>
      </div>

      <section className="album-body">
        <div className="container">
          <div className="album-section-intro"><div><span className="album-eyebrow">NHẬT KÝ CỦA CHÚNG MÌNH</span><h2>Gom từng chút xanh <span>♡</span></h2><p>Mỗi tấm ảnh là một dấu mốc trên hành trình lớn lên.</p></div><span className="album-total">{leaves.length} kỷ niệm đã lưu</span></div>
          {!!album?.stages.length && <div className="memory-tree-layout">
            <div className="memory-tree" aria-label="Cây kỷ niệm — chọn một nhánh để xem ảnh">
              <div className="memory-tree-crown"><SproutyIcon name="sprout" size={30} /><span>CÂY KỶ NIỆM</span></div>
              <div className="memory-tree-branches">
                <MemoryTreeArt />
                {album.stages.map((stage, index) => {
                  const photos = leaves.filter((leaf) => leaf.stage === stage.id);
                  const cover = photos.find((leaf) => leaf.status !== 'hidden' && !isVideo(leaf));
                  return <button key={stage.id} style={{ left: [23, 43, 66, 15, 38, 61, 82, 72][index] + '%', top: [26, 18, 27, 47, 43, 48, 49, 67][index] + '%' }} className={'memory-branch' + (selectedStage === stage.id ? ' is-selected' : '')} aria-pressed={selectedStage === stage.id} onClick={() => setSelectedStage(stage.id)}>
                    <span className="memory-branch-photo">{cover ? <img src={cover.url} alt="" loading="lazy" /> : <SproutyIcon name={stage.icon as IconName} size={28} />}</span>
                    <span className="memory-branch-copy"><small>CHẶNG {String(index + 1).padStart(2, '0')}{plant?.stage === stage.id ? ' · HIỆN TẠI' : ''}</small><strong>{stage.label}</strong><span>{photos.length ? photos.length + ' kỷ niệm' : 'Thêm chiếc lá đầu tiên'}</span></span>
                  </button>;
                })}
              </div>
              <div className="memory-tree-root">Bắt đầu từ một hạt nhỏ</div>
            </div>
            <aside className="memory-tree-note"><span className="album-eyebrow">MỖI CHẶNG, MỘT NHÁNH THƯƠNG</span><h3>Ảnh của bạn,<br />lớn cùng cây.</h3><p>Chạm vào một nhánh để xem lại kỷ niệm hoặc thêm ảnh cho chặng ấy. Những chặng đã qua luôn ở đây.</p><div className="memory-selection"><SproutyIcon name="album" size={22} /><strong>{selectedStage === 'all' ? 'Đang xem tất cả các chặng' : album.stages.find((stage) => stage.id === selectedStage)?.label}</strong></div><button className="btn btn-primary" disabled={full || loading || !album} onClick={() => fileInput.current?.click()}><SproutyIcon name="plus" size={18} /> Thêm ảnh lên cây</button><button className="btn btn-ghost" aria-pressed={selectedStage === 'all'} onClick={() => setSelectedStage('all')}>Xem toàn bộ kỷ niệm ({leaves.length})</button><small>Giai đoạn của ảnh được chọn khi đăng, độc lập với tiến độ chăm cây.</small></aside>
          </div>}
          <button className="album-add" disabled={full || loading || !album} onClick={() => fileInput.current?.click()}>
            <span className="album-add-icon">
              <SproutyIcon name={full ? 'check' : 'camera'} size={26} />
            </span>
            <span className="album-add-copy">
              <strong>{full ? 'Album đã đầy' : 'Thêm khoảnh khắc mới'}</strong>
              <em>
                {full
                  ? `Đã lưu đủ ${maxLeaves} khoảnh khắc cho cây này.`
                  : currentStageLabel
                    ? `Ảnh sẽ được ghi vào chặng “${currentStageLabel}”`
                    : 'Chọn ảnh hoặc video từ máy của bạn'}
              </em>
            </span>
            {!full && <span className="album-add-action"><SproutyIcon name="plus" size={18} /> Chọn ảnh / video</span>}
          </button>

          {loading && <p className="album-muted">Đang mở album…</p>}

          {!loading && leaves.length === 0 && (
            <div className="album-empty">
              <span className="album-empty-icon">
                <SproutyIcon name="camera" size={36} />
              </span>
              <h3>Album còn trống</h3>
              <p>
                Mỗi lần cây đổi dáng, chụp một tấm. Cuối hành trình bạn sẽ có trọn bộ ảnh từ hạt
                giống tới ngày thu hoạch.
              </p>
            </div>
          )}

          {!loading && leaves.length > 0 && selectedStage !== 'all' && !groups.some((group) => group.id === selectedStage) && <div className="album-empty"><SproutyIcon name="camera" size={32} /><h3>Nhánh này đang chờ kỷ niệm</h3><p>Thêm ảnh đầu tiên cho chặng {currentStageLabel}. Bạn vẫn có thể quay lại bổ sung bất cứ lúc nào.</p></div>}
          {groups.filter((group) => selectedStage === 'all' || group.id === selectedStage).map((group) => (
            <div className="album-group" key={group.id}>
              <div className="album-group-head">
                <span className="album-group-icon">
                  <SproutyIcon name={group.icon} size={18} />
                </span>
                <h2>{group.label}</h2>
                <span className="album-group-count">{group.items.length}</span>
              </div>

              <div className="album-grid">
                {group.items.map((leaf) => (
                  <button className="album-item" key={leaf.id} onClick={() => setOpenLeaf(leaf)}>
                    <span className="album-item-media">
                      <span className="album-item-view">{isVideo(leaf) ? '▶ Xem video' : '↗ Xem ảnh lớn'}</span>
                      {leaf.status === 'hidden' ? (
                        <span style={{ display: 'grid', placeItems: 'center', height: '100%', padding: 20, color: 'var(--ink-4)' }}>Nội dung đã được quản trị viên ẩn</span>
                      ) : isVideo(leaf) ? (
                        <>
                          <video src={leaf.url} muted />
                          <span className="album-item-play">
                            <SproutyIcon name="camera" size={18} />
                          </span>
                        </>
                      ) : (
                        <img src={leaf.url} alt={leaf.title || 'Khoảnh khắc'} loading="lazy" />
                      )}
                    </span>
                    <span className="album-item-cap">
                      <strong>{leaf.title || 'Khoảnh khắc'}</strong>
                      {leaf.createdAt && (
                        <em>{new Date(leaf.createdAt).toLocaleDateString('vi-VN')}</em>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}

          <input
            ref={fileInput}
            type="file"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) setPendingFile(file);
            }}
          />
        </div>
      </section>

      {pendingFile && (
        <ComposeModal
          file={pendingFile}
          productId={productId}
          stages={album?.stages || []}
          initialStage={uploadStage}
          onClose={() => setPendingFile(null)}
          onUploaded={(leaf) => {
            setSelectedStage(leaf.stage || 'all');
            setLeaves((current) => [leaf, ...current]);
            setOpenLeaf(leaf);
            loadLeaves();
          }}
        />
      )}

      {openLeaf && (
        <LeafModal
          key={openLeaf.id}
          leaf={openLeaf}
          onClose={() => setOpenLeaf(null)}
          onChanged={loadLeaves}
        />
      )}
    </>
  );
}
