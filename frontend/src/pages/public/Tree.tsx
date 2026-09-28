import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LEAF_POSITIONS } from '@/data/tree';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import './Tree.css';

interface Leaf {
  id: string;
  url: string;
  title?: string;
  note?: string;
  asset?: { mimeType?: string };
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

  const [productName, setProductName] = useState('');
  const [leaves, setLeaves] = useState<Leaf[]>([]);
  const [maxLeaves, setMaxLeaves] = useState(DEFAULT_MAX_LEAVES);
  const [removalsUsed, setRemovalsUsed] = useState(0);
  const [removalsMax, setRemovalsMax] = useState(5);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [openLeaf, setOpenLeaf] = useState<Leaf | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!productId) navigate('/my-products', { replace: true });
  }, [productId, navigate]);

  useEffect(() => {
    if (!productId) return;
    API.products
      .get(productId)
      .then((data: any) => setProductName(data.product?.name || ''))
      .catch(() => setProductName(''));
  }, [productId]);

  const loadLeaves = useCallback(() => {
    if (!productId) return;
    API.myImages
      .list(productId)
      .then((data: any) => {
        setLeaves(data.images || []);
        if (data.maxLeaves) setMaxLeaves(Math.min(data.maxLeaves, LEAF_POSITIONS.length));
        if (typeof data.removalsUsed === 'number') setRemovalsUsed(data.removalsUsed);
        if (typeof data.removalsMax === 'number') setRemovalsMax(data.removalsMax);
      })
      .catch((err: any) => {
        showToast(err?.message || 'Không tải được cây kỷ niệm', 'error');
        setLeaves([]);
      });
  }, [productId]);

  useEffect(loadLeaves, [loadLeaves]);

  const full = leaves.length >= maxLeaves;

  // Leaves grow one at a time: filled slots, then exactly one "next" slot.
  const slots = LEAF_POSITIONS.slice(0, full ? leaves.length : leaves.length + 1);

  return (
    <>
      <div className="tree-hero">
        <div className="container">
          <div className="tree-breadcrumb">
            <Link to="/">Trang chủ</Link> › <Link to="/my-products">Cây của tôi</Link> ›{' '}
            <span>{productName || 'Cây Kỷ Niệm'}</span>
          </div>
          <h1>{productName ? `Cây Kỷ Niệm — ${productName}` : 'Cây Kỷ Niệm'}</h1>
          <p>
            Mỗi tấm ảnh hoặc video bé chăm cây sẽ nở thành một chiếc lá trên cây. Bấm vào lá xanh
            nhạt để thêm khoảnh khắc mới.
          </p>
        </div>
      </div>

      <section style={{ padding: '32px 0 72px' }}>
        <div className="container">
          <div className="tree-toolbar">
            <span className="leaf-count-badge">
              🍃 {leaves.length}/{maxLeaves} lá
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Link className="btn btn-outline btn-sm" to={`/shop/${productId}?tab=videos`}>
                🎬 Video hướng dẫn
              </Link>
              <Link className="btn btn-ghost btn-sm" to="/my-products">
                ← Quay lại
              </Link>
            </div>
          </div>

          <div className="tree-stage">
            <img
              className="tree-bg-img"
              src="/assets/images/tree/tree-trunk.png"
              alt={productName || 'Cây Kỷ Niệm'}
            />

            {full && (
              <div className="tree-full-msg">
                <img src="/assets/images/sprouty-icons/MyTree.png" alt="" />
                Cây đã đủ lá!
              </div>
            )}

            {slots.map((pos, i) => {
              const mask = `/assets/images/tree/leaves/${pos.file}`;
              const style: React.CSSProperties = {
                left: `${pos.left}%`,
                top: `${pos.top}%`,
                width: `${pos.width}%`,
                height: `${pos.height}%`,
                WebkitMaskImage: `url(${mask})`,
                maskImage: `url(${mask})`,
              };

              const leaf = leaves[i];
              if (leaf) {
                return (
                  <div
                    className="leaf-slot filled"
                    style={style}
                    key={leaf.id}
                    title={leaf.title || 'Kỷ niệm'}
                    onClick={() => setOpenLeaf(leaf)}
                  >
                    {isVideo(leaf) ? (
                      <>
                        <video src={leaf.url} muted />
                        <span className="leaf-play-badge">▶</span>
                      </>
                    ) : (
                      <img src={leaf.url} alt="" />
                    )}
                  </div>
                );
              }

              return (
                <div
                  className="leaf-slot next"
                  style={style}
                  key={`next-${i}`}
                  title="Thêm khoảnh khắc mới"
                  onClick={() => fileInput.current?.click()}
                >
                  <img src="/assets/images/sprouty-icons/AddPhoto.png" alt="" />
                </div>
              );
            })}
          </div>

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
