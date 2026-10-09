import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import { SproutyIcon, type IconName } from '@/components/icons/SproutyIcon';
import { PlantArt, type PlantStageId } from '@/components/PlantArt';
import type { FruitShape, PlantForm } from '@/components/PlantForms';
import './Tree.css';

interface Leaf {
  id: string;
  url: string;
  title?: string;
  note?: string;
  createdAt?: string;
  /** The growth stage the plant was at when this was saved. */
  stage?: PlantStageId | null;
  stageLabel?: string | null;
  asset?: { mimeType?: string };
}

/** What GET /my-products/:id/images returns, now that it describes a journey. */
interface AlbumData {
  images: Leaf[];
  maxLeaves: number | null;
  removalsUsed: number;
  removalsMax: number;
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

function isVideo(leaf: Leaf) {
  return (leaf.asset?.mimeType || '').startsWith('video/');
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
  file,
  onClose,
  onUploaded,
  productId,
}: {
  file: File;
  onClose: () => void;
  onUploaded: () => void;
  productId: string;
}) {
  const [previewUrl, setPreviewUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  const video = file.type.startsWith('video/');

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function suggest() {
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
    setBusy(true);
    const form = new FormData();
    // Text fields go before the file so Fastify's multipart parser exposes
    // them on req.file().fields.
    if (caption.trim()) form.append('title', caption.trim());
    if (note.trim()) form.append('note', note.trim());
    form.append('image', file);

    try {
      await API.myImages.upload(productId, form);
      showToast('🍃 Một chiếc lá mới đã nở!', 'success');
      onUploaded();
      onClose();
    } catch (err: any) {
      showToast(err?.message || 'Không thể thêm lá mới', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="modal-overlay open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="leaf-modal-card">
        <button className="leaf-modal-close" onClick={onClose} aria-label="Đóng">
          ✕
        </button>

        <div className="leaf-media-frame">
          {previewUrl &&
            (video ? <video src={previewUrl} controls /> : <img src={previewUrl} alt="" />)}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input
            className="form-input"
            placeholder="Đặt tên cho khoảnh khắc này"
            style={{ flex: 1 }}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
          {/* Captioning looks at a photo, so it makes no sense for a clip. */}
          {!video && (
            <button
              className="btn btn-outline btn-sm"
              style={{ whiteSpace: 'nowrap' }}
              disabled={suggesting}
              onClick={suggest}
            >
              {suggesting ? 'Đang xem ảnh...' : '✨ AI gợi ý'}
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
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            Hủy
          </button>
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={submit}>
            {busy ? 'Đang đăng...' : 'Đăng lên cây 🌱'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LeafModal({
  leaf,
  removalsUsed,
  removalsMax,
  onClose,
  onChanged,
}: {
  leaf: Leaf;
  removalsUsed: number;
  removalsMax: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [title, setTitle] = useState(leaf.title || '');
  const [note, setNote] = useState(leaf.note || '');
  const [failed, setFailed] = useState(false);
  const removalsLeft = Math.max(0, removalsMax - removalsUsed);

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
    if (!confirm('Xoá chiếc lá này khỏi cây?')) return;
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
      className="modal-overlay open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="leaf-modal-card">
        <button className="leaf-modal-close" onClick={onClose} aria-label="Đóng">
          ✕
        </button>

        <div className="leaf-media-frame">
          {failed ? (
            <p style={{ padding: 20, textAlign: 'center', color: 'var(--ink-4)' }}>
              Không tải được nội dung này.
            </p>
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
            disabled={removalsLeft <= 0}
            onClick={remove}
          >
            Xoá lá này
          </button>
        </div>

        <p className="leaf-remove-limit">
          Lượt gỡ &amp; đăng lại đã dùng: {removalsUsed}/{removalsMax}
          {removalsLeft <= 0 ? ' — đã hết lượt gỡ cho kit này.' : ''}
        </p>
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
  const [removalsUsed, setRemovalsUsed] = useState(0);
  const [removalsMax, setRemovalsMax] = useState(5);
  const [loading, setLoading] = useState(true);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [openLeaf, setOpenLeaf] = useState<Leaf | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

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
        if (typeof data.removalsUsed === 'number') setRemovalsUsed(data.removalsUsed);
        if (typeof data.removalsMax === 'number') setRemovalsMax(data.removalsMax);
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
  const currentStageLabel = plant
    ? album?.stages.find((st) => st.id === plant.stage)?.label ?? ''
    : '';

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
          </div>
        </div>
      </div>

      <section className="album-body">
        <div className="container">
          {/* Adding is one obvious button. It used to be a pale leaf-shaped slot
              hidden somewhere on the tree illustration, which a child had to
              find before they could add anything at all. */}
          <button className="album-add" disabled={full} onClick={() => fileInput.current?.click()}>
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
            {!full && <SproutyIcon name="plus" size={22} />}
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

          {groups.map((group) => (
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
                      {isVideo(leaf) ? (
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
            accept="image/*,video/*"
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
          onClose={() => setPendingFile(null)}
          onUploaded={loadLeaves}
        />
      )}

      {openLeaf && (
        <LeafModal
          leaf={openLeaf}
          removalsUsed={removalsUsed}
          removalsMax={removalsMax}
          onClose={() => setOpenLeaf(null)}
          onChanged={loadLeaves}
        />
      )}
    </>
  );
}
