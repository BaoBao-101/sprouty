import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BlockStates,
  FilterPills,
  MeterBar,
  Modal,
  PageHeader,
  Panel,
  Pill,
  StatCard,
  StatGrid,
  TableStates,
  Toolbar,
  type FilterOption,
  type LoadState,
} from '@/components/admin/ui';
import { API } from '@/services/api';
import { formatWorkshopWhen } from '@/types/workshop';
import { showToast } from '@/services/toast';

interface WorkshopRow {
  id: string;
  title: string;
  description?: string | null;
  emoji?: string | null;
  imageUrl?: string | null;
  dateTime: string;
  endTime?: string | null;
  location: string;
  ageRange?: string | null;
  price: number;
  status: string;
  capacity: number;
  /** Seats booked, counted in children rather than rows. */
  registrations: number;
  bookingCount: number;
  pctFull: number;
  upcoming: boolean;
}

interface LocationRow {
  location: string;
  workshopCount: number;
  totalRegistrations: number;
}

interface Registration {
  id: string;
  createdAt: string;
  guestName?: string | null;
  guestPhone?: string | null;
  guestEmail?: string | null;
  childAge?: string | null;
  childCount: number;
  note?: string | null;
  status: 'pending' | 'confirmed' | 'cancelled';
  user?: { name?: string; email?: string } | null;
}

interface Stats {
  workshops: WorkshopRow[];
  byLocation: LocationRow[];
  totals: { workshopCount?: number; totalCapacity?: number; totalRegistrations?: number };
}

/** Green under 60% full, amber to 90%, rose above — a quick capacity read. */
function fillTone(pct: number) {
  if (pct >= 90) return 'rose';
  if (pct >= 60) return 'orange';
  return 'green';
}

/**
 * `<input type="datetime-local">` speaks local wall-clock time with no zone, so
 * convert through the local offset in both directions. Handing the raw ISO
 * string to the input would shift every workshop by the UTC offset.
 */
function toLocalInput(iso: string) {
  const date = new Date(iso);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromLocalInput(value: string) {
  return new Date(value).toISOString();
}

const EMPTY_FORM = {
  title: '',
  description: '',
  emoji: '🎪',
  imageUrl: '',
  dateTime: '',
  endTime: '',
  capacity: '12',
  location: '',
  ageRange: '',
  price: '0',
  status: 'published',
};

const WS_STATUS_LABEL: Record<string, string> = {
  published: 'Đang mở đăng ký',
  draft: 'Bản nháp',
  cancelled: 'Đã huỷ',
};

const WS_STATUS_TONE: Record<string, string> = {
  published: 'green',
  draft: 'amber',
  cancelled: 'rose',
};

const WS_STATUS_CHOICES = [
  { value: 'published', label: 'Đang mở đăng ký', hint: 'Hiện trên trang Workshop, khách đăng ký được' },
  { value: 'draft', label: 'Bản nháp', hint: 'Chỉ nhân viên thấy, khách không thấy' },
  { value: 'cancelled', label: 'Đã huỷ', hint: 'Ngừng nhận đăng ký, giữ lại lịch sử' },
];

const REG_STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  cancelled: 'Đã huỷ',
};

const REG_STATUS_TONE: Record<string, string> = {
  pending: 'amber',
  confirmed: 'green',
  cancelled: 'rose',
};

type Filter = '' | 'upcoming' | 'past';

export default function Workshops() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [viewing, setViewing] = useState<WorkshopRow | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [regState, setRegState] = useState<LoadState>('loading');
  const [regError, setRegError] = useState('');

  const load = useCallback(() => {
    setState('loading');
    API.admin.workshops
      .stats()
      .then((data: any) => {
        setStats(data);
        setState('ready');
      })
      .catch((err: any) => {
        setError(err?.message || 'Không tải được số liệu.');
        setState('error');
      });
  }, []);

  useEffect(load, [load]);

  const set = (key: keyof typeof EMPTY_FORM) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  function openEditor(workshop?: WorkshopRow) {
    if (workshop) {
      setEditingId(workshop.id);
      setForm({
        title: workshop.title,
        description: workshop.description ?? '',
        emoji: workshop.emoji ?? '',
        imageUrl: workshop.imageUrl ?? '',
        dateTime: toLocalInput(workshop.dateTime),
        endTime: workshop.endTime ? toLocalInput(workshop.endTime) : '',
        capacity: String(workshop.capacity),
        location: workshop.location,
        ageRange: workshop.ageRange ?? '',
        price: String(workshop.price ?? 0),
        status: workshop.status ?? 'published',
      });
    } else {
      setEditingId(null);
      // Venue and price repeat between sessions, so carry the last ones over.
      const last = stats?.workshops.at(-1);
      setForm({
        ...EMPTY_FORM,
        location: last?.location ?? '',
        price: String(last?.price ?? 0),
      });
    }
    setFormError('');
    setEditorOpen(true);
  }

  async function save() {
    setFormError('');
    if (form.title.trim().length < 3) return setFormError('Tên workshop phải có ít nhất 3 ký tự.');
    if (!form.dateTime) return setFormError('Chọn thời gian diễn ra.');
    if (form.location.trim().length < 3) return setFormError('Địa điểm phải có ít nhất 3 ký tự.');
    const capacity = parseInt(form.capacity, 10);
    if (!capacity || capacity < 1) return setFormError('Sức chứa phải lớn hơn 0.');
    const price = parseInt(form.price, 10);
    if (isNaN(price) || price < 0) return setFormError('Học phí không được âm.');
    if (form.endTime && form.endTime <= form.dateTime) {
      return setFormError('Giờ kết thúc phải sau giờ bắt đầu.');
    }

    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      emoji: form.emoji.trim(),
      imageUrl: form.imageUrl.trim(),
      dateTime: fromLocalInput(form.dateTime),
      endTime: form.endTime ? fromLocalInput(form.endTime) : null,
      capacity,
      location: form.location.trim(),
      ageRange: form.ageRange.trim(),
      price,
      status: form.status,
    };

    try {
      if (editingId) {
        await API.admin.workshops.update(editingId, payload);
        showToast('Đã cập nhật workshop', 'success');
      } else {
        await API.admin.workshops.create(payload);
        showToast('Đã tạo workshop mới', 'success');
      }
      setEditorOpen(false);
      load();
    } catch (err: any) {
      setFormError(err?.message || 'Không lưu được workshop');
    } finally {
      setSaving(false);
    }
  }

  async function remove(workshop: WorkshopRow) {
    if (!confirm(`Xoá workshop “${workshop.title}”?\n\nThao tác này không hoàn tác được.`)) return;
    try {
      await API.admin.workshops.remove(workshop.id);
      showToast('Đã xoá workshop', 'success');
      load();
    } catch (err: any) {
      showToast(err?.message || 'Không xoá được workshop', 'error');
    }
  }

  const openRegistrations = useCallback((workshop: WorkshopRow) => {
    setViewing(workshop);
    setRegState('loading');
    setRegistrations([]);
    API.admin.workshops
      .registrations(workshop.id)
      .then((data: any) => {
        setRegistrations(data.registrations || []);
        setRegState('ready');
      })
      .catch((err: any) => {
        setRegError(err?.message || 'Không tải được danh sách.');
        setRegState('error');
      });
  }, []);

  async function setRegistrationStatus(
    registrationId: string,
    status: 'pending' | 'confirmed' | 'cancelled',
  ) {
    if (!viewing) return;
    try {
      await API.admin.workshops.setRegistrationStatus(viewing.id, registrationId, status);
      showToast(`Đã chuyển sang “${REG_STATUS_LABEL[status]}”`, 'success');
      openRegistrations(viewing);
      // The seat count on the card changes when a booking is cancelled or
      // re-opened, so the list behind the dialog has to catch up too.
      load();
    } catch (err: any) {
      showToast(err?.message || 'Không cập nhật được', 'error');
    }
  }

  async function cancelRegistration(registrationId: string) {
    if (!viewing) return;
    if (!confirm('Huỷ lượt đăng ký này? Chỗ sẽ được mở lại cho người khác.')) return;
    try {
      await API.admin.workshops.cancelRegistration(viewing.id, registrationId);
      showToast('Đã huỷ lượt đăng ký', 'success');
      openRegistrations(viewing);
      load();
    } catch (err: any) {
      showToast(err?.message || 'Không huỷ được', 'error');
    }
  }

  const all = stats?.workshops || [];
  const upcomingCount = all.filter((w) => w.upcoming).length;

  const visible = useMemo(() => {
    if (filter === 'upcoming') return all.filter((w) => w.upcoming);
    if (filter === 'past') return all.filter((w) => !w.upcoming);
    return all;
  }, [all, filter]);

  const totals = stats?.totals;
  const loading = state === 'loading';

  // How full the programme is overall — the number staff actually act on.
  const fillRate =
    totals?.totalCapacity && totals.totalCapacity > 0
      ? Math.round(((totals.totalRegistrations || 0) / totals.totalCapacity) * 100)
      : 0;

  const filters: Array<FilterOption<Filter>> = [
    { value: '', label: 'Tất cả', count: all.length },
    { value: 'upcoming', label: 'Sắp tới', count: upcomingCount },
    { value: 'past', label: 'Đã diễn ra', count: all.length - upcomingCount },
  ];

  return (
    <>
      <PageHeader
        title="Workshop"
        subtitle="Tạo buổi workshop, theo dõi sức chứa và danh sách đăng ký"
        actions={
          <button className="btn btn-primary" onClick={() => openEditor()}>
            + Tạo workshop
          </button>
        }
      />

      <StatGrid>
        <StatCard
          icon="🎪"
          tone="orange"
          loading={loading}
          value={totals?.workshopCount ?? '—'}
          label="Tổng workshop"
          hint={`${upcomingCount} buổi sắp tới`}
        />
        <StatCard
          icon="🪑"
          tone="blue"
          loading={loading}
          value={totals ? (totals.totalCapacity || 0).toLocaleString('vi-VN') : '—'}
          label="Tổng sức chứa"
        />
        <StatCard
          icon="✋"
          tone="green"
          loading={loading}
          value={totals ? (totals.totalRegistrations || 0).toLocaleString('vi-VN') : '—'}
          label="Tổng lượt đăng ký"
        />
        <StatCard
          icon="📊"
          tone="amber"
          loading={loading}
          value={`${fillRate}%`}
          label="Tỷ lệ lấp đầy"
          hint={fillRate >= 90 ? 'Gần kín chỗ' : fillRate < 30 ? 'Còn nhiều chỗ trống' : undefined}
        />
      </StatGrid>

      <Toolbar>
        <FilterPills options={filters} value={filter} onChange={(next) => setFilter(next)} />
      </Toolbar>

      <Panel title="Danh sách workshop" flush>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Tên</th>
              <th>Thời gian</th>
              <th>Địa điểm</th>
              <th style={{ textAlign: 'right', minWidth: 170 }}>Đăng ký</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <TableStates
              state={state}
              error={error}
              isEmpty={visible.length === 0}
              columns={5}
              emptyIcon="🎪"
              emptyTitle={filter ? 'Không có buổi nào' : 'Chưa có workshop'}
              emptyHint={
                filter ? 'Thử chọn bộ lọc khác.' : 'Bấm “Tạo workshop” để mở buổi đầu tiên.'
              }
              onRetry={load}
            />
            {state === 'ready' &&
              visible.map((w) => (
                <tr key={w.id}>
                  <td>
                    <div className="ws-row">
                      <div className="ws-row-thumb">
                        {w.imageUrl ? <img src={w.imageUrl} alt="" /> : <span>{w.emoji || '🎪'}</span>}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="ad-cell-main">{w.title}</div>
                        <div className="ad-cell-sub">
                          {w.ageRange ? `${w.ageRange} · ` : ''}
                          {w.price > 0 ? `${w.price.toLocaleString('vi-VN')}đ` : 'Miễn phí'}
                        </div>
                        <div className="ws-row-pills">
                          <Pill tone={WS_STATUS_TONE[w.status] ?? 'grey'}>
                            {WS_STATUS_LABEL[w.status] ?? w.status}
                          </Pill>
                          <Pill tone={w.upcoming ? 'blue' : 'grey'}>
                            {w.upcoming ? 'Sắp tới' : 'Đã diễn ra'}
                          </Pill>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="ad-cell-sub" style={{ whiteSpace: 'nowrap' }}>
                    {new Date(w.dateTime).toLocaleString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="ws-location">{w.location}</td>
                  <td>
                    <div className="ws-fill">
                      <span className="ws-fill-count">
                        {w.registrations}/{w.capacity}
                      </span>
                      <MeterBar
                        value={w.registrations}
                        max={Math.max(1, w.capacity)}
                        tone={fillTone(w.pctFull)}
                      />
                      <span className="ad-cell-sub">{Math.round(w.pctFull)}% đã lấp</span>
                    </div>
                  </td>
                  <td>
                    <div className="admin-inline-actions">
                      <button className="act-btn act-edit" onClick={() => openRegistrations(w)}>
                        Người đăng ký
                      </button>
                      <button className="act-btn act-edit" onClick={() => openEditor(w)}>
                        Sửa
                      </button>
                      <button className="act-btn act-del" onClick={() => remove(w)}>
                        Xoá
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Theo địa điểm" flush>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Địa điểm</th>
              <th style={{ textAlign: 'right' }}>Số buổi</th>
              <th style={{ textAlign: 'right' }}>Lượt đăng ký</th>
            </tr>
          </thead>
          <tbody>
            <TableStates
              state={state}
              error={error}
              isEmpty={(stats?.byLocation.length ?? 0) === 0}
              columns={3}
              emptyIcon="📍"
              emptyTitle="Chưa có dữ liệu"
              onRetry={load}
            />
            {state === 'ready' &&
              stats?.byLocation.map((row) => (
                <tr key={row.location}>
                  <td className="ad-cell-main">{row.location}</td>
                  <td className="ad-num">{row.workshopCount}</td>
                  <td className="ad-num" style={{ color: 'var(--orange)' }}>
                    {row.totalRegistrations}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </Panel>

      {editorOpen && (
        <Modal
          title={editingId ? 'Sửa workshop' : 'Tạo workshop'}
          subtitle={
            editingId
              ? 'Khách đã đăng ký sẽ thấy thông tin mới ngay'
              : 'Buổi mới hiện trên trang Workshop công khai ngay sau khi tạo'
          }
          width={560}
          onClose={() => setEditorOpen(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setEditorOpen(false)}>
                Hủy
              </button>
              <button className="btn btn-primary" disabled={saving} onClick={save}>
                {saving ? 'Đang lưu…' : editingId ? 'Lưu thay đổi' : 'Tạo workshop'}
              </button>
            </>
          }
        >
          {/* Exactly what the public card shows, previewed live — the form used
              to collect four fields while the site displayed nine, so an admin
              could not produce a session that matched the ones already up. */}
          <div className="ws-preview">
            <div className="ws-preview-photo">
              {form.imageUrl ? (
                <img src={form.imageUrl} alt="" onError={(e) => (e.currentTarget.style.opacity = '0.2')} />
              ) : (
                <span>{form.emoji || '🎪'}</span>
              )}
            </div>
            <div className="ws-preview-main">
              <div className="ws-preview-label">Khách sẽ thấy</div>
              <div className="ws-preview-title">
                {form.emoji} {form.title || 'Tên workshop'}
              </div>
              <div className="ws-preview-meta">
                📅{' '}
                {form.dateTime
                  ? formatWorkshopWhen({
                      dateTime: fromLocalInput(form.dateTime),
                      endTime: form.endTime ? fromLocalInput(form.endTime) : null,
                    })
                  : 'chưa chọn thời gian'}
                <br />
                📍 {form.location || 'chưa nhập địa điểm'}
              </div>
              <div className="ws-preview-tags">
                {form.ageRange && <span className="tag">{form.ageRange}</span>}
                <span className="tag green">
                  {(parseInt(form.price, 10) || 0).toLocaleString('vi-VN')}đ
                </span>
                <span className="tag">{form.capacity || 0} chỗ</span>
              </div>
            </div>
          </div>

          <label className="field">
            <span className="field-label">
              Tên workshop <span className="req">*</span>
            </span>
            <input
              className="form-input"
              placeholder="VD: Vẽ Chậu & Gieo Hạt Đầu Tiên"
              value={form.title}
              onChange={(e) => set('title')(e.target.value)}
            />
          </label>

          <label className="field">
            <span className="field-label">Mô tả</span>
            <textarea
              className="form-input"
              rows={3}
              style={{ resize: 'vertical' }}
              placeholder="Bé sẽ làm gì trong buổi này?"
              value={form.description}
              onChange={(e) => set('description')(e.target.value)}
            />
            <span className="field-hint">Hiện trên thẻ workshop ở trang công khai</span>
          </label>

          <div className="field-grid">
            <label className="field">
              <span className="field-label">
                Bắt đầu <span className="req">*</span>
              </span>
              <input
                className="form-input"
                type="datetime-local"
                value={form.dateTime}
                onChange={(e) => set('dateTime')(e.target.value)}
              />
              <span className="field-hint">Theo giờ máy của bạn</span>
            </label>

            <label className="field">
              <span className="field-label">Kết thúc</span>
              <input
                className="form-input"
                type="datetime-local"
                value={form.endTime}
                onChange={(e) => set('endTime')(e.target.value)}
              />
              <span className="field-hint">Để trống nếu chưa chốt giờ tan</span>
            </label>
          </div>

          <div className="field-grid">
            <label className="field">
              <span className="field-label">
                Sức chứa <span className="req">*</span>
              </span>
              <input
                className="form-input"
                type="number"
                min={1}
                max={1000}
                value={form.capacity}
                onChange={(e) => set('capacity')(e.target.value)}
              />
              <span className="field-hint">Số bé tối đa nhận đăng ký</span>
            </label>

            <label className="field">
              <span className="field-label">Học phí (đ)</span>
              <input
                className="form-input"
                type="number"
                min={0}
                step={1000}
                value={form.price}
                onChange={(e) => set('price')(e.target.value)}
              />
              <span className="field-hint">Nhập 0 nếu buổi học miễn phí</span>
            </label>
          </div>

          <label className="field">
            <span className="field-label">
              Địa điểm <span className="req">*</span>
            </span>
            <input
              className="form-input"
              placeholder="VD: Sprouty Studio – TP.HCM"
              value={form.location}
              onChange={(e) => set('location')(e.target.value)}
            />
          </label>

          <div className="field-grid">
            <label className="field">
              <span className="field-label">Độ tuổi phù hợp</span>
              <input
                className="form-input"
                placeholder="VD: 4–8 tuổi"
                value={form.ageRange}
                onChange={(e) => set('ageRange')(e.target.value)}
              />
            </label>

            <label className="field">
              <span className="field-label">Emoji</span>
              <input
                className="form-input"
                placeholder="🎪"
                maxLength={8}
                value={form.emoji}
                onChange={(e) => set('emoji')(e.target.value)}
              />
              <span className="field-hint">Huy hiệu góc ảnh, hiện khi chưa có ảnh</span>
            </label>
          </div>

          <label className="field">
            <span className="field-label">Ảnh bìa</span>
            <input
              className="form-input"
              placeholder="/assets/images/workshop/register/register-basic.png"
              value={form.imageUrl}
              onChange={(e) => set('imageUrl')(e.target.value)}
            />
            <span className="field-hint">
              Đường dẫn bắt đầu bằng / hoặc http(s)://. Để trống sẽ hiện emoji thay ảnh.
            </span>
          </label>

          <div className="field">
            <span className="field-label">Trạng thái</span>
            <div className="status-choices">
              {WS_STATUS_CHOICES.map((choice) => (
                <label
                  key={choice.value}
                  className={`status-choice${form.status === choice.value ? ' active' : ''}`}
                >
                  <input
                    type="radio"
                    name="ws-status"
                    checked={form.status === choice.value}
                    onChange={() => set('status')(choice.value)}
                  />
                  <div>
                    <strong>{choice.label}</strong>
                    <div className="status-choice-hint">{choice.hint}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {formError && <div className="form-error">{formError}</div>}
        </Modal>
      )}

      {viewing && (
        <Modal
          title="Danh sách đăng ký"
          subtitle={`${viewing.title} · ${viewing.registrations}/${viewing.capacity} chỗ`}
          width={620}
          onClose={() => setViewing(null)}
          footer={
            <button className="btn btn-ghost" onClick={() => setViewing(null)}>
              Đóng
            </button>
          }
        >
          <BlockStates
            state={regState}
            error={regError}
            isEmpty={registrations.length === 0}
            emptyIcon="🪑"
            emptyTitle="Chưa có ai đăng ký"
            emptyHint="Khách đăng ký từ trang Workshop sẽ hiện ở đây."
          />
          {/* Everything the parent typed. The public form asked for the child's
              age, headcount and any notes, then discarded all three — staff had
              a name and a phone number and nothing else to prepare with. */}
          {regState === 'ready' &&
            registrations.map((r, i) => (
              <div className={`ws-reg${r.status === 'cancelled' ? ' cancelled' : ''}`} key={r.id}>
                <div className="ws-reg-top">
                  <div>
                    <div className="ad-cell-main">
                      {i + 1}. {r.guestName || r.user?.name || 'Khách vãng lai'}
                      {r.childCount > 1 && <span className="ws-reg-count">{r.childCount} bé</span>}
                    </div>
                    <div className="ad-cell-sub">
                      Đăng ký {new Date(r.createdAt).toLocaleString('vi-VN')}
                    </div>
                  </div>
                  <Pill tone={REG_STATUS_TONE[r.status] ?? 'grey'}>
                    {REG_STATUS_LABEL[r.status] ?? r.status}
                  </Pill>
                </div>

                <div className="ws-reg-grid">
                  <div>
                    <span>Điện thoại</span>
                    {/* Tappable: staff call these from a phone at the door. */}
                    {r.guestPhone ? <a href={`tel:${r.guestPhone}`}>{r.guestPhone}</a> : <b>—</b>}
                  </div>
                  <div>
                    <span>Email</span>
                    <b>{r.guestEmail || r.user?.email || '—'}</b>
                  </div>
                  <div>
                    <span>Tuổi của bé</span>
                    <b>{r.childAge || '—'}</b>
                  </div>
                  <div>
                    <span>Số bé</span>
                    <b>{r.childCount}</b>
                  </div>
                </div>

                {r.note && <div className="ws-reg-note">📝 {r.note}</div>}

                <div className="ws-reg-actions">
                  {r.status !== 'confirmed' && (
                    <button
                      className="act-btn act-edit"
                      onClick={() => setRegistrationStatus(r.id, 'confirmed')}
                    >
                      ✓ Xác nhận
                    </button>
                  )}
                  {r.status !== 'cancelled' && (
                    <button
                      className="act-btn act-del"
                      onClick={() => setRegistrationStatus(r.id, 'cancelled')}
                    >
                      Huỷ chỗ
                    </button>
                  )}
                  {r.status === 'cancelled' && (
                    <button
                      className="act-btn act-edit"
                      onClick={() => setRegistrationStatus(r.id, 'pending')}
                    >
                      Mở lại
                    </button>
                  )}
                  <button className="act-btn act-del" onClick={() => cancelRegistration(r.id)}>
                    Xoá hẳn
                  </button>
                </div>
              </div>
            ))}
        </Modal>
      )}
    </>
  );
}
