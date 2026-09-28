import { useCallback, useEffect, useState } from 'react';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';

export interface Video {
  id: string;
  title: string;
  description?: string;
  status: 'draft' | 'published' | 'archived';
  sortOrder: number;
  externalUrl?: string;
  asset?: { url?: string };
  thumbnailAsset?: { url?: string };
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Bản nháp',
  published: 'Đã xuất bản',
  archived: 'Lưu trữ',
};

const MAX_VIDEO_MB = 500;

const EMPTY_DRAFT = {
  title: '',
  externalUrl: '',
  description: '',
  sortOrder: '0',
  status: 'draft',
};

/**
 * Instruction videos for one product. Used both inside the product editor (as a
 * tab) and on its own for employees, who may manage videos but not the product.
 */
export function VideoPanel({ productId, productName }: { productId: number; productName: string }) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState<string | null>(null);

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

  const set = (key: keyof typeof EMPTY_DRAFT) => (value: string) =>
    setDraft((d) => ({ ...d, [key]: value }));

  async function create() {
    setFormError('');

    if (!draft.title.trim()) return setFormError('Nhập tiêu đề cho video.');
    if (!file && !draft.externalUrl.trim()) {
      return setFormError('Chọn một tệp video hoặc dán URL video ngoài.');
    }
    if (file && file.size > MAX_VIDEO_MB * 1024 * 1024) {
      return setFormError(`Tệp vượt quá ${MAX_VIDEO_MB}MB.`);
    }

    setSaving(true);
    const payload = {
      title: draft.title.trim(),
      description: draft.description.trim(),
      externalUrl: draft.externalUrl.trim(),
      sortOrder: parseInt(draft.sortOrder, 10) || 0,
      status: draft.status,
    };

    try {
      if (file) {
        const form = new FormData();
        Object.entries(payload).forEach(([k, v]) => form.append(k, String(v)));
        form.append('video', file);
        await API.admin.videos.create(productId, form);
      } else {
        await API.admin.videos.create(productId, payload);
      }
      showToast('Đã thêm video', 'success');
      setDraft(EMPTY_DRAFT);
      setFile(null);
      load();
    } catch (err: any) {
      setFormError(err?.message || 'Không thêm được video.');
    } finally {
      setSaving(false);
    }
  }

  async function update(id: string, data: Record<string, unknown>) {
    try {
      await API.admin.videos.update(id, data);
      showToast('Đã cập nhật video', 'success');
      setVideos((list) => list.map((v) => (v.id === id ? { ...v, ...data } : v)));
    } catch (err: any) {
      showToast(err?.message || 'Không cập nhật được video', 'error');
      load();
    }
  }

  async function uploadThumbnail(id: string, thumb: File) {
    setUploadingThumb(id);
    const form = new FormData();
    form.append('thumbnail', thumb);
    try {
      await API.admin.videos.thumbnail(id, form);
      showToast('Đã cập nhật ảnh thu nhỏ', 'success');
      load();
    } catch (err: any) {
      showToast(err?.message || 'Không tải được ảnh thu nhỏ', 'error');
    } finally {
      setUploadingThumb(null);
    }
  }

  async function archive(video: Video) {
    if (!confirm(`Lưu trữ video "${video.title}"?`)) return;
    try {
      await API.admin.videos.remove(video.id);
      showToast('Đã lưu trữ video', 'success');
      load();
    } catch (err: any) {
      showToast(err?.message || 'Không lưu trữ được video', 'error');
    }
  }

  return (
    <div className="video-panel">
      <div className="panel-note">
        Video hướng dẫn hiển thị trong <strong>{productName}</strong> cho khách đã mua kit. Có thể
        tải tệp lên hoặc dán link video có sẵn.
      </div>

      <div className="video-form">
        <div className="field-grid">
          <label className="field">
            <span className="field-label">
              Tiêu đề <span className="req">*</span>
            </span>
            <input
              className="form-input"
              placeholder="VD: Bước 1 — Chuẩn bị đất"
              value={draft.title}
              onChange={(e) => set('title')(e.target.value)}
            />
          </label>

          <label className="field">
            <span className="field-label">Thứ tự hiển thị</span>
            <input
              className="form-input"
              type="number"
              min={0}
              value={draft.sortOrder}
              onChange={(e) => set('sortOrder')(e.target.value)}
            />
            <span className="field-hint">Số nhỏ hiện trước</span>
          </label>
        </div>

        <label className="field">
          <span className="field-label">Mô tả</span>
          <textarea
            className="form-input"
            rows={2}
            placeholder="Nội dung video nói về điều gì"
            style={{ resize: 'vertical' }}
            value={draft.description}
            onChange={(e) => set('description')(e.target.value)}
          />
        </label>

        <div className="field-grid">
          <label className="field">
            <span className="field-label">Tải tệp video lên</span>
            <input
              className="form-input file-input"
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <span className="field-hint">MP4, WebM hoặc MOV · tối đa {MAX_VIDEO_MB}MB</span>
          </label>

          <label className="field">
            <span className="field-label">Hoặc dán URL video ngoài</span>
            <input
              className="form-input"
              placeholder="https://..."
              value={draft.externalUrl}
              onChange={(e) => set('externalUrl')(e.target.value)}
            />
            <span className="field-hint">Dùng khi video đã có sẵn ở nơi khác</span>
          </label>
        </div>

        <div className="field-grid">
          <label className="field">
            <span className="field-label">Trạng thái</span>
            <select
              className="form-input"
              value={draft.status}
              onChange={(e) => set('status')(e.target.value)}
            >
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
            <span className="field-hint">Chỉ video đã xuất bản mới hiện cho khách</span>
          </label>
          <div />
        </div>

        {formError && <div className="form-error mb-12">{formError}</div>}

        <button className="btn btn-primary btn-sm" disabled={saving} onClick={create}>
          {saving ? 'Đang tải lên...' : '+ Thêm video'}
        </button>
      </div>

      <div className="video-list">
        <div className="panel-subhead">
          Đã có {videos.length} video
        </div>

        {loading && <div className="panel-empty">Đang tải...</div>}
        {error && <div className="panel-empty error">{error}</div>}
        {!loading && !error && videos.length === 0 && (
          <div className="panel-empty">Chưa có video nào cho sản phẩm này.</div>
        )}

        {videos.map((video) => (
          <div className="video-row" key={video.id}>
            <div className="video-thumb">
              {video.thumbnailAsset?.url ? (
                <img src={video.thumbnailAsset.url} alt="" />
              ) : (
                <span>🎬</span>
              )}
            </div>

            <div className="video-row-main">
              <div className="video-row-title">{video.title}</div>
              {video.description && <div className="video-row-desc">{video.description}</div>}
              <div className="video-row-src">{video.externalUrl || video.asset?.url || '—'}</div>
            </div>

            <div className="video-row-controls">
              <label className="mini-field">
                <span>Trạng thái</span>
                <select
                  className="admin-mini-select"
                  value={video.status}
                  onChange={(e) => update(video.id, { status: e.target.value })}
                >
                  {Object.entries(STATUS_LABEL).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="mini-field">
                <span>Thứ tự</span>
                <input
                  className="admin-mini-select"
                  type="number"
                  style={{ width: 64 }}
                  defaultValue={video.sortOrder}
                  onBlur={(e) => {
                    const next = parseInt(e.target.value, 10) || 0;
                    if (next !== video.sortOrder) update(video.id, { sortOrder: next });
                  }}
                />
              </label>

              <label className="act-btn act-edit thumb-btn">
                {uploadingThumb === video.id ? 'Đang tải...' : 'Ảnh thu nhỏ'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={(e) => {
                    const thumb = e.target.files?.[0];
                    if (thumb) uploadThumbnail(video.id, thumb);
                    e.target.value = '';
                  }}
                />
              </label>

              <button className="act-btn act-del" onClick={() => archive(video)}>
                Lưu trữ
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
