import { confirmAction } from '@/services/dialog';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import { SproutyIcon, type IconName } from '@/components/icons/SproutyIcon';
import { PlantArt, type PlantStageId } from '@/components/PlantArt';
import type { FruitShape, PlantForm } from '@/components/PlantForms';
import './Tree.css';
import { MemoryTreeArt } from '@/components/MemoryTreeArt';
import type { PotKey, SceneKey } from '@/components/garden-looks';

const PlantThumbnail3D = lazy(() => import('@/components/PlantThumbnail3D'));

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
  /** Leaves allowed on each stage's branch; null for VIP (no limit). */
  leavesPerStage: number | null;
  vip?: boolean;
  product: { id: number; name: string } | null;
  /** Every plant this account grows from the kit; each has its own album. */
  plants?: Array<{ id: string; nickname: string }>;
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

const VIDEO_NAME = /\.(mp4|m4v|mov|qt|webm|mkv|avi|3gp|3gpp|3g2|mpeg|mpg|mpe|ogv|wmv|asf|flv)$/i;

/**
 * Adding a leaf.
 *
 * The photo on the left, everything to decide on the right, and the buttons
 * always in view. It used to be one tall column: a large preview pushed the
 * name, the note and "Đăng lên cây" below the fold, so the dialog had to be
 * scrolled to finish. The stage is a set of buttons rather than a dropdown,
 * each saying how full its branch is, so a full one is seen before it is
 * picked rather than refused after.
 */
function ComposeModal({
  file: initialFile,
  onClose,
  onUploaded,
  productId,
  plantId,
  stages,
  initialStage,
  stageCounts,
  perStage,
  currentStage,
}: {
  file: File;
  onClose: () => void;
  onUploaded: (leaf: Leaf) => void;
  productId: string;
  /** Whose album the leaf goes into. */
  plantId: string;
  stages: AlbumData['stages'];
  initialStage: string;
  /** Leaves already on each branch. */
  stageCounts: Map<string, number>;
  /** Leaves allowed per branch; null for VIP. */
  perStage: number | null;
  currentStage?: string;
}) {
  const isFull = (id: string) => perStage !== null && (stageCounts.get(id) || 0) >= perStage;
  const [file, setFile] = useState<File | null>(initialFile);
  const replaceInput = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [stage, setStage] = useState(
    initialStage && !isFull(initialStage) ? initialStage : stages.find((s) => !isFull(s.id))?.id || '',
  );
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const dialog = useAlbumDialog(onClose, busy);

  const video = !!file && (file.type.startsWith('video/') || VIDEO_NAME.test(file.name));

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
    if (!file || busy || suggesting || !stage) return;
    setBusy(true);
    const form = new FormData();
    // Text fields go before the file so Fastify's multipart parser exposes
    // them on req.file().fields.
    if (caption.trim()) form.append('title', caption.trim());
    if (note.trim()) form.append('note', note.trim());
    form.append('stage', stage);
    form.append('image', file);

    try {
      const { image } = await API.myImages.upload(productId, form, plantId);
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
      className="lf-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="lf-dialog" {...dialog} aria-label="Thêm lá mới">
        <div className="lf-media">
          {file ? (
            <>
              <div className="lf-media-frame">
                {previewUrl && <AlbumMedia key={previewUrl} src={previewUrl} video={video} title={file.name} />}
              </div>
              <div className="lf-media-bar">
                <span title={file.name}>
                  <SproutyIcon name={video ? 'camera' : 'album'} size={15} />
                  {file.name}
                </span>
                <button type="button" disabled={busy || suggesting} onClick={() => replaceInput.current?.click()}>Đổi tệp</button>
              </div>
            </>
          ) : (
            <button type="button" className="lf-media-empty" disabled={busy || suggesting} onClick={() => replaceInput.current?.click()}>
              <SproutyIcon name="camera" size={32} />
              <strong>Chọn ảnh hoặc video</strong>
              <span>Tên, nhật ký và chặng bạn chọn vẫn được giữ lại.</span>
            </button>
          )}
          <input ref={replaceInput} type="file" hidden disabled={busy || suggesting} onChange={(event) => {
            const next = event.target.files?.[0];
            event.target.value = '';
            if (next) { setPreviewUrl(''); setFile(next); }
          }} />
        </div>

        <div className="lf-side">
          <header className="lf-head">
            <div>
              <span className="lf-kicker">Thêm lá mới</span>
              <h2>Một khoảnh khắc, một chiếc lá</h2>
            </div>
            <button type="button" className="lf-close" disabled={busy} onClick={onClose} aria-label="Đóng">
              <SproutyIcon name="close" size={18} />
            </button>
          </header>

          <div className="lf-body">
            <fieldset className="lf-field">
              <legend>Ảnh này ở chặng nào?</legend>
              <div className="lf-stages" role="radiogroup" aria-label="Chặng">
                {stages.map((item) => {
                  const full = isFull(item.id);
                  const n = stageCounts.get(item.id) || 0;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={stage === item.id}
                      disabled={full || busy}
                      className={`lf-stage${stage === item.id ? ' is-on' : ''}${full ? ' is-full' : ''}`}
                      onClick={() => setStage(item.id)}
                      title={full ? `Chặng này đã đủ ${perStage} lá` : undefined}
                    >
                      <SproutyIcon name={item.icon as IconName} size={16} />
                      <span>
                        {item.label}
                        {item.id === currentStage && <i>hiện tại</i>}
                      </span>
                      <em>{full ? 'Đã đủ' : perStage !== null ? `${n}/${perStage}` : n || ''}</em>
                    </button>
                  );
                })}
              </div>
              <small>{perStage === null ? 'Chặng đã qua vẫn thêm ảnh được.' : `Mỗi chặng tối đa ${perStage} lá. Chặng đã qua vẫn thêm ảnh được.`}</small>
            </fieldset>

            <label className="lf-field">
              <span className="lf-label">Tên khoảnh khắc</span>
              <span className="lf-input-row">
                <input
                  className="form-input"
                  placeholder="VD: Mầm đầu tiên nhú lên"
                  maxLength={120}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                />
                {/* Captioning looks at a photo, so it makes no sense for a clip. */}
                {file && !video && (
                  <button type="button" className="lf-ai" disabled={suggesting || busy} onClick={suggest}>
                    <SproutyIcon name="sparkle" size={15} />
                    {suggesting ? 'Đang xem…' : 'AI gợi ý'}
                  </button>
                )}
              </span>
            </label>

            <label className="lf-field">
              <span className="lf-label">Nhật ký <em>(không bắt buộc)</em></span>
              <textarea
                className="form-input"
                rows={3}
                maxLength={1000}
                placeholder="Hôm nay bé thấy cây thế nào?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          </div>

          <footer className="lf-foot">
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>Huỷ</button>
            <button type="button" className="btn btn-primary" disabled={busy || suggesting || !file || !stage} onClick={submit}>
              <SproutyIcon name="sprout" size={17} />
              {busy ? 'Đang đăng…' : 'Đăng lên cây'}
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}

/**
 * Looking at a leaf: the photo large on the left, its name and diary on the
 * right, editable in place. "Lưu" only wakes up once something has changed,
 * and deleting sits apart on the left so it is not pressed by mistake.
 */
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
  const [busy, setBusy] = useState(false);
  const dialog = useAlbumDialog(onClose, busy);
  const dirty = title.trim() !== (leaf.title || '') || note.trim() !== (leaf.note || '');
  const hidden = leaf.status === 'hidden';

  async function save() {
    setBusy(true);
    try {
      await API.myImages.update(leaf.id, { title: title.trim(), note: note.trim() });
      showToast('Đã lưu', 'success');
      onChanged();
      onClose();
    } catch (err: any) {
      showToast(err?.message || 'Không thể lưu', 'error');
      setBusy(false);
    }
  }

  async function remove() {
    if (!await confirmAction('Xoá chiếc lá này khỏi cây? Ảnh sẽ không còn trong album.', { confirmLabel: 'Xoá lá' })) return;
    setBusy(true);
    try {
      await API.myImages.remove(leaf.id);
      showToast('Đã xoá lá', 'success');
      onChanged();
      onClose();
    } catch (err: any) {
      showToast(err?.message || 'Không thể xoá', 'error');
      setBusy(false);
    }
  }

  return (
    <div
      className="lf-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="lf-dialog" {...dialog} aria-label="Xem khoảnh khắc">
        <div className="lf-media">
          <div className="lf-media-frame">
            {hidden ? (
              <p className="lf-media-note">Nội dung này đã được quản trị viên ẩn. Bạn vẫn có thể sửa tên, nhật ký hoặc xoá lá khỏi album.</p>
            ) : failed ? (
              <div className="album-media-fallback"><SproutyIcon name="album" size={36} /><p>Trình duyệt chưa xem trực tiếp được tệp này.</p><a href={leaf.url} target="_blank" rel="noopener noreferrer" download>Mở / tải tệp gốc ↗</a></div>
            ) : isVideo(leaf) ? (
              <video src={leaf.url} controls onError={() => setFailed(true)} />
            ) : (
              <img src={leaf.url} alt={leaf.title || 'Kỷ niệm'} onError={() => setFailed(true)} />
            )}
          </div>
          {!hidden && !failed && leaf.url && (
            <div className="lf-media-bar">
              <span>{isVideo(leaf) ? 'Video' : 'Ảnh'}{leaf.createdAt ? ` · ${new Date(leaf.createdAt).toLocaleDateString('vi-VN')}` : ''}</span>
              <a href={leaf.url} target="_blank" rel="noopener noreferrer">Mở tệp gốc</a>
            </div>
          )}
        </div>

        <div className="lf-side">
          <header className="lf-head">
            <div>
              <span className="lf-kicker">{leaf.stageLabel ? `Chặng ${leaf.stageLabel}` : 'Kỷ niệm của cây'}</span>
              <h2>{leaf.title || 'Một ngày cây lớn lên'}</h2>
            </div>
            <button type="button" className="lf-close" disabled={busy} onClick={onClose} aria-label="Đóng">
              <SproutyIcon name="close" size={18} />
            </button>
          </header>

          <div className="lf-body">
            <label className="lf-field">
              <span className="lf-label">Tên khoảnh khắc</span>
              <input className="form-input" placeholder="Đặt tên cho khoảnh khắc này" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="lf-field">
              <span className="lf-label">Nhật ký</span>
              <textarea
                className="form-input"
                rows={5}
                maxLength={1000}
                placeholder="Viết vài dòng cho khoảnh khắc này"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          </div>

          <footer className="lf-foot">
            <button type="button" className="btn btn-ghost lf-delete" disabled={busy} onClick={remove}>
              <SproutyIcon name="trash" size={16} />
              Xoá lá
            </button>
            <button type="button" className="btn btn-primary" disabled={busy || !dirty} onClick={save}>
              {busy ? 'Đang lưu…' : 'Lưu thay đổi'}
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}

export default function Tree() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const productId = searchParams.get('id') || '';
  // Which plant's album: one account may grow the same kit more than once.
  const plantParam = searchParams.get('plant') || '';

  const [album, setAlbum] = useState<AlbumData | null>(null);
  const [leaves, setLeaves] = useState<Leaf[]>([]);
  const [loading, setLoading] = useState(true);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  /** The branch the next upload goes to, chosen by the button pressed. */
  const [uploadTarget, setUploadTarget] = useState('');
  const [openLeaf, setOpenLeaf] = useState<Leaf | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [selectedStage, setSelectedStage] = useState<string>('all');

  useEffect(() => {
    if (!productId) navigate('/my-plants', { replace: true });
  }, [productId, navigate]);

  const loadLeaves = useCallback(() => {
    if (!productId) return;
    API.myImages
      .list(productId, plantParam)
      .then((data: AlbumData) => {
        setAlbum(data);
        setLeaves(data.images || []);
      })
      .catch((err: any) => {
        showToast(err?.message || 'Không tải được album', 'error');
        setLeaves([]);
      })
      .finally(() => setLoading(false));
  }, [productId, plantParam]);

  useEffect(loadLeaves, [loadLeaves]);

  const species = album?.species;

  // A regular account fills each branch with up to `perStage` leaves; VIP
  // (null) has no limit. Counted from what is on screen, so deleting a leaf
  // opens its place straight away.
  const perStage = album ? album.leavesPerStage ?? null : null;
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const leaf of leaves) if (leaf.stage) map.set(leaf.stage, (map.get(leaf.stage) || 0) + 1);
    return map;
  }, [leaves]);
  const fullStages = useMemo(
    () => new Set((album?.stages || []).filter((s) => perStage !== null && (counts.get(s.id) || 0) >= perStage).map((s) => s.id as string)),
    [album, counts, perStage],
  );
  const countLabel = (stageId: string) => `${counts.get(stageId) || 0}${perStage !== null ? `/${perStage}` : ''}`;

  function pickFile(stageId: string) {
    setUploadTarget(stageId);
    fileInput.current?.click();
  }

  // The account's garden scene and pot, so the plant here looks as it does
  // on its own page.
  const [look, setLook] = useState<{ scene: SceneKey; decoration: PotKey } | undefined>();
  useEffect(() => {
    let active = true;
    API.garden
      .benefits()
      .then((data: { scene: SceneKey; decoration: PotKey }) => active && setLook({ scene: data.scene, decoration: data.decoration }))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const plant = album?.plant;
  const title = plant?.nickname || album?.product?.name || 'Album kỷ niệm';
  const stageLabelOf = (id: string) => album?.stages.find((stage) => stage.id === id)?.label || '';
  const specific = selectedStage !== 'all' && selectedStage !== 'unknown';
  // Where "Thêm ảnh" puts a photo: the branch being looked at, or else the
  // plant's current stage, or else the first branch with room left.
  const addTarget = specific
    ? (fullStages.has(selectedStage) ? '' : selectedStage)
    : plant?.stage && !fullStages.has(plant.stage)
      ? plant.stage
      : album?.stages.find((s) => !fullStages.has(s.id))?.id || '';
  const allFull = !!album?.stages.length && fullStages.size === album.stages.length;

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
            {/* The plant itself, as the same 3D model the plant page and the
                garden cards show, in the account's scene and pot. It was a flat
                drawing here — a different-looking plant, its sun and pot cut
                off by the frame. The drawing stays as the stand-in while the
                model renders, or where WebGL is not available. */}
            {plant && species && (
              <div className="album-plant">
                <Suspense
                  fallback={
                    <PlantArt
                      stage={plant.stage}
                      progress={plant.stageProgress}
                      health={plant.health}
                      form={species.form}
                      fruitShape={species.fruitShape}
                      fruitColor={species.fruitColor}
                      flowerColor={species.flowerColor}
                      size={200}
                    />
                  }
                >
                  <PlantThumbnail3D
                    stage={plant.stage}
                    progress={plant.stageProgress}
                    health={plant.health}
                    form={species.form}
                    fruitShape={species.fruitShape}
                    fruitColor={species.fruitColor}
                    flowerColor={species.flowerColor}
                    scene={look?.scene}
                    decoration={look?.decoration}
                  />
                </Suspense>
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
                  {leaves.length} khoảnh khắc · {perStage === null ? 'VIP, không giới hạn' : `${perStage} lá mỗi chặng`}
                </span>
                {(album?.plants?.length || 0) > 1 && (
                  <span className="album-switch" role="group" aria-label="Album của cây">
                    {album!.plants!.map((p) => (
                      <Link
                        key={p.id}
                        to={`/tree?id=${productId}&plant=${p.id}`}
                        className={p.id === plant?.id ? 'is-on' : undefined}
                        aria-current={p.id === plant?.id ? 'page' : undefined}
                      >
                        {p.nickname}
                      </Link>
                    ))}
                  </span>
                )}
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
                    <span className="memory-branch-copy"><small>CHẶNG {String(index + 1).padStart(2, '0')}{plant?.stage === stage.id ? ' · HIỆN TẠI' : ''}</small><strong>{stage.label}</strong><span>{photos.length ? `${countLabel(stage.id)} lá${fullStages.has(stage.id) ? ' · đã đủ' : ''}` : 'Thêm chiếc lá đầu tiên'}</span></span>
                  </button>;
                })}
              </div>
              <div className="memory-tree-root">Bắt đầu từ một hạt nhỏ</div>
            </div>
            <aside className="memory-tree-note"><span className="album-eyebrow">MỖI CHẶNG, MỘT NHÁNH THƯƠNG</span><h3>Ảnh của bạn,<br />lớn cùng cây.</h3><p>Chạm vào một nhánh để xem lại kỷ niệm hoặc thêm ảnh cho chặng ấy. Những chặng đã qua luôn ở đây.</p><div className="memory-selection"><SproutyIcon name="album" size={22} /><strong>{selectedStage === 'all' ? 'Đang xem tất cả các chặng' : album.stages.find((stage) => stage.id === selectedStage)?.label}</strong></div><button className="btn btn-primary" disabled={!addTarget || loading || !album} onClick={() => pickFile(addTarget)}><SproutyIcon name="plus" size={18} /> Thêm ảnh lên cây</button><button className="btn btn-ghost" aria-pressed={selectedStage === 'all'} onClick={() => setSelectedStage('all')}>Xem toàn bộ kỷ niệm ({leaves.length})</button><small>{perStage === null ? 'VIP: thêm bao nhiêu lá cũng được, ở bất kỳ chặng nào.' : <>Mỗi chặng {perStage} lá. <Link to="/vip">VIP</Link> thêm không giới hạn.</>}</small></aside>
          </div>}
          {/* One slim bar: what is being shown, and the one way to add to it. */}
          <div className="ab-toolbar">
            <div className="ab-toolbar-title">
              <strong>{specific ? stageLabelOf(selectedStage) : selectedStage === 'unknown' ? 'Chưa rõ chặng' : 'Tất cả kỷ niệm'}</strong>
              <span>
                {specific
                  ? `${countLabel(selectedStage)} lá`
                  : `${leaves.length} lá${perStage !== null ? ` · ${perStage} lá mỗi chặng` : ''}`}
              </span>
            </div>
            {selectedStage !== 'all' && (
              <button type="button" className="ab-link" onClick={() => setSelectedStage('all')}>Xem tất cả</button>
            )}
            <button type="button" className="btn btn-primary ab-add" disabled={!addTarget || loading || !album} onClick={() => pickFile(addTarget)}>
              <SproutyIcon name="plus" size={16} />
              Thêm ảnh / video
            </button>
          </div>
          {!loading && album && (specific ? fullStages.has(selectedStage) : allFull) && (
            <p className="ab-hint">
              <SproutyIcon name="info" size={15} />
              <span>
                {specific ? `Chặng “${stageLabelOf(selectedStage)}” đã đủ ${perStage} lá.` : `Mọi chặng đã đủ ${perStage} lá.`}{' '}
                Xoá bớt một lá cũ để thay, hoặc <Link to="/vip">nâng cấp VIP</Link> để thêm không giới hạn.
              </span>
            </p>
          )}

          {loading && <p className="album-muted">Đang mở album…</p>}

          {!loading && leaves.length === 0 && selectedStage === 'all' && (
            <div className="ab-empty">
              <span className="ab-empty-icon"><SproutyIcon name="camera" size={26} /></span>
              <div>
                <h3>Album còn trống</h3>
                <p>Mỗi lần cây đổi dáng, chụp một tấm. Cuối hành trình bạn có trọn bộ ảnh từ hạt giống tới ngày thu hoạch.</p>
              </div>
            </div>
          )}

          {/* A branch picked on the tree shows even when it has nothing yet,
              so its "Thêm lá" tile is there to press. */}
          {(selectedStage === 'all'
            ? groups
            : groups.filter((group) => group.id === selectedStage).concat(
                specific && !groups.some((group) => group.id === selectedStage)
                  ? [{ id: selectedStage, label: stageLabelOf(selectedStage), icon: (album?.stages.find((s) => s.id === selectedStage)?.icon || 'leaf') as IconName, items: [] }]
                  : [],
              )
          ).map((group) => {
            const canAdd = group.id !== 'unknown' && !fullStages.has(group.id);
            return (
              <section className="ab-group" key={group.id} aria-label={group.label}>
                <header className="ab-group-head">
                  <span className="ab-group-icon"><SproutyIcon name={group.icon} size={16} /></span>
                  <h2>{group.label}</h2>
                  <span className={`ab-group-count${fullStages.has(group.id) ? ' is-full' : ''}`}>
                    {group.id === 'unknown' ? group.items.length : countLabel(group.id)} lá
                  </span>
                </header>
                <div className="ab-grid">
                  {group.items.map((leaf) => (
                    <button type="button" className="ab-tile" key={leaf.id} onClick={() => setOpenLeaf(leaf)} aria-label={`${isVideo(leaf) ? 'Xem video' : 'Xem ảnh'}: ${leaf.title || 'Khoảnh khắc'}`}>
                      <span className="ab-tile-media">
                        {leaf.status === 'hidden' ? (
                          <span className="ab-tile-hidden">Đã được quản trị viên ẩn</span>
                        ) : isVideo(leaf) ? (
                          <>
                            <video src={leaf.url} muted preload="metadata" />
                            <span className="ab-tile-play" aria-hidden="true" />
                          </>
                        ) : (
                          <img src={leaf.url} alt="" loading="lazy" />
                        )}
                      </span>
                      <span className="ab-tile-cap">
                        <strong>{leaf.title || 'Khoảnh khắc'}</strong>
                        {leaf.createdAt && <em>{new Date(leaf.createdAt).toLocaleDateString('vi-VN')}</em>}
                      </span>
                    </button>
                  ))}
                  {canAdd && (
                    <button type="button" className="ab-tile is-add" onClick={() => pickFile(group.id)} disabled={loading}>
                      <span className="ab-tile-media">
                        <SproutyIcon name="plus" size={22} />
                        <strong>Thêm lá</strong>
                        {perStage !== null && <em>còn {perStage - (counts.get(group.id) || 0)} chỗ</em>}
                      </span>
                    </button>
                  )}
                </div>
              </section>
            );
          })}

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
          plantId={album?.plant?.id || plantParam}
          stages={album?.stages || []}
          initialStage={uploadTarget}
          stageCounts={counts}
          perStage={perStage}
          currentStage={plant?.stage}
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
