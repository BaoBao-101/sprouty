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
  Pagination,
  SearchBox,
  Toolbar,
  type FilterOption,
  type LoadState,
} from '@/components/admin/ui';
import { API } from '@/services/api';
import { formatWorkshopWhen } from '@/types/workshop';
import { showToast } from '@/services/toast';
import { AdminIcon } from '@/components/icons/AdminIcon';
import { usePagedList } from '@/components/admin/usePagedList';
import {
  AGE_PRESETS,
  CAPACITY_PRESETS,
  ComboField,
  MoneyInput,
  PresetChips,
  WORKSHOP_PRICE_PRESETS,
} from '@/components/admin/fields';

interface WorkshopRow {
  id: string;
  title: string;
  description?: string | null;
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
  paymentMethod: 'online' | 'onsite';
  amount: number;
  paidAt?: string | null;
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

/**
 * A booking's state is its payment state.
 *
 * There used to be a separate pending/confirmed flag with a ✓ button for staff
 * to press. It said nothing payment did not already say: an online booking is
 * confirmed the moment the transfer lands, and ticking an unpaid one guarantees
 * nothing. Two flags for one fact only creates rows that disagree.
 */
function bookingState(r: { status: string; paidAt?: string | null; amount: number }) {
  if (r.status === 'cancelled') return { label: 'Đã huỷ', tone: 'grey' };
  if (r.paidAt) return { label: 'Đã thanh toán', tone: 'green' };
  if (r.amount === 0) return { label: 'Miễn phí', tone: 'blue' };
  return { label: 'Chưa thanh toán', tone: 'amber' };
}

type Filter = '' | 'upcoming' | 'past';

export default function Workshops() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsError, setStatsError] = useState('');
  const [filter, setFilter] = useState<Filter>('');
  const [search, setSearch] = useState('');

  // Two sources on purpose. The table is one page of rows that match the
  // filter; the tiles and the per-location breakdown are totals over every
  // workshop, and a headline that counted only the page would be a lie.
  const {
    items: visible,
    state,
    error,
    page,
    pages,
    total,
    counts,
    setPage,
    reload: reloadList,
  } = usePagedList<WorkshopRow>(
    (params) => API.admin.workshops.list(params),
    'workshops',
    { when: filter, search: search.trim() },
    { errorText: 'Không tải được workshop.' },
  );

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [viewing, setViewing] = useState<WorkshopRow | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [regState, setRegState] = useState<LoadState>('loading');
  const [regError, setRegError] = useState('');

  const loadStats = useCallback(() => {
    API.admin.workshops
      .stats()
      .then((data: any) => {
        setStats(data);
        setStatsError('');
      })
      .catch((err: any) => {
        setStatsError(err?.message || 'Không tải được số liệu.');
      });
  }, []);

  useEffect(loadStats, [loadStats]);

  // Anything that changes a workshop changes both halves of the screen.
  const load = useCallback(() => {
    reloadList();
    loadStats();
  }, [reloadList, loadStats]);

  const set = (key: keyof typeof EMPTY_FORM) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  function openEditor(workshop?: WorkshopRow) {
    if (workshop) {
      setEditingId(workshop.id);
      setForm({
        title: workshop.title,
        description: workshop.description ?? '',
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

  /**
   * Uploads straight away and keeps the returned URL in the form, rather than
   * holding the file until save: the cover then shows in the live preview, and
   * a session that is never saved leaves only an orphan asset behind.
   */
  async function uploadCover(file: File) {
    setFormError('');
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { url } = await API.admin.workshops.uploadCover(form);
      set('imageUrl')(url);
      showToast('Đã tải ảnh bìa lên', 'success');
    } catch (err: any) {
      setFormError(err?.message || 'Không tải được ảnh lên.');
    } finally {
      setUploading(false);
    }
  }

  /** Header tally, so staff see the shape of the list without reading it. */
  const regCounts = registrations.reduce(
    (acc, r) => {
      if (r.status === 'cancelled') acc.cancelled++;
      else if (r.paidAt || r.amount === 0) acc.paid++;
      else acc.unpaid++;
      return acc;
    },
    { paid: 0, unpaid: 0, cancelled: 0 },
  );

  // The end time is what actually decides visibility, so a session already
  // under way does not count as past.
  const startsInPast =
    !!form.dateTime && new Date(form.endTime || form.dateTime).getTime() < Date.now();

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

  async function markRegistrationPaid(registrationId: string, amount: number) {
    if (!viewing) return;
    if (
      !confirm(
        `Ghi nhận đã thu ${amount.toLocaleString('vi-VN')}đ cho lượt đăng ký này?\n\n` +
          'Chỉ dùng khi bạn đã cầm tiền hoặc kiểm tra tiền về tài khoản.',
      )
    )
      return;
    try {
      await API.admin.workshops.markRegistrationPaid(viewing.id, registrationId);
      showToast('Đã ghi nhận thanh toán', 'success');
      openRegistrations(viewing);
      load();
    } catch (err: any) {
      showToast(err?.message || 'Không ghi nhận được', 'error');
    }
  }

  // Only cancel and re-open: there is no "confirm" any more, because paying is
  // the confirmation and ticking an unpaid booking guaranteed nothing.
  async function setRegistrationStatus(registrationId: string, status: 'pending' | 'cancelled') {
    if (!viewing) return;
    try {
      await API.admin.workshops.setRegistrationStatus(viewing.id, registrationId, status);
      showToast(status === 'cancelled' ? 'Đã huỷ chỗ' : 'Đã mở lại chỗ', 'success');
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

  const upcomingCount = counts.upcoming || 0;
  const pastCount = counts.past || 0;
  const allCount = counts.all || 0;

  // The studios already in use, offered to the editor so a session joins one
  // rather than spawning a near-duplicate spelling of it.
  const locationOptions = (stats?.byLocation || [])
    .filter((row) => row.location)
    .map((row) => ({ value: row.location, count: row.workshopCount }));

  const totals = stats?.totals;
  const loading = state === 'loading';

  // How full the programme is overall — the number staff actually act on.
  const fillRate =
    totals?.totalCapacity && totals.totalCapacity > 0
      ? Math.round(((totals.totalRegistrations || 0) / totals.totalCapacity) * 100)
      : 0;

  const filters: Array<FilterOption<Filter>> = [
    { value: '', label: 'Tất cả', count: allCount },
    { value: 'upcoming', label: 'Sắp tới', count: upcomingCount },
    { value: 'past', label: 'Đã diễn ra', count: pastCount },
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

      {/* The tiles come from a second request; if only that one fails the
          table is still usable, so say so rather than blanking the page. */}
      {statsError && (
        <div className="panel-note" style={{ marginBottom: 16 }}>
          <AdminIcon name="alert" size={16} /> Không tải được số liệu tổng: {statsError}{' '}
          <button className="btn btn-ghost btn-sm" onClick={loadStats}>
            Thử lại
          </button>
        </div>
      )}

      <StatGrid>
        <StatCard
          icon={<AdminIcon name="workshop" />}
          tone="orange"
          loading={loading}
          value={totals?.workshopCount ?? '—'}
          label="Tổng workshop"
          hint={`${upcomingCount} buổi sắp tới`}
        />
        <StatCard
          icon={<AdminIcon name="seat" />}
          tone="blue"
          loading={loading}
          value={totals ? (totals.totalCapacity || 0).toLocaleString('vi-VN') : '—'}
          label="Tổng sức chứa"
        />
        <StatCard
          icon={<AdminIcon name="clock" />}
          tone="green"
          loading={loading}
          value={totals ? (totals.totalRegistrations || 0).toLocaleString('vi-VN') : '—'}
          label="Tổng lượt đăng ký"
        />
        <StatCard
          icon={<AdminIcon name="chart" />}
          tone="amber"
          loading={loading}
          value={`${fillRate}%`}
          label="Tỷ lệ lấp đầy"
          hint={fillRate >= 90 ? 'Gần kín chỗ' : fillRate < 30 ? 'Còn nhiều chỗ trống' : undefined}
        />
      </StatGrid>

      <Toolbar>
        <FilterPills options={filters} value={filter} onChange={(next) => setFilter(next)} />
        <SearchBox
          value={search}
          placeholder="Tìm theo tên buổi hoặc địa điểm…"
          onChange={setSearch}
        />
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
              emptyIcon={<AdminIcon name="workshop" size={24} />}
              emptyTitle={filter || search ? 'Không có buổi nào' : 'Chưa có workshop'}
              emptyHint={
                filter || search
                  ? 'Thử bỏ bộ lọc hoặc đổi từ khoá.'
                  : 'Bấm “Tạo workshop” để mở buổi đầu tiên.'
              }
              onRetry={load}
            />
            {state === 'ready' &&
              visible.map((w) => (
                <tr key={w.id}>
                  <td>
                    <div className="ws-row">
                      <div className="ws-row-thumb">
                        {w.imageUrl ? <img src={w.imageUrl} alt="" /> : <AdminIcon name="workshop" size={22} />}
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
                        {/* "Đang mở đăng ký" on a session that has already been
                            and gone reads as if customers can see it. They
                            cannot — the public page lists upcoming ones only. */}
                        {w.status === 'published' && !w.upcoming && (
                          <div className="ws-row-warn">
                            <AdminIcon name="alert" size={15} /> Đã qua giờ diễn ra nên không hiện trên trang khách. Sửa lại thời
                            gian nếu muốn mở đăng ký.
                          </div>
                        )}
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

        <Pagination page={page} pages={pages} total={total} unit="buổi" onChange={setPage} />
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
              emptyIcon={<AdminIcon name="pin" size={24} />}
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
                <AdminIcon name="workshop" size={22} />
              )}
            </div>
            <div className="ws-preview-main">
              <div className="ws-preview-label">Khách sẽ thấy</div>
              <div className="ws-preview-title">{form.title || 'Tên workshop'}</div>
              <div className="ws-preview-meta">
                <AdminIcon name="calendar" size={15} />{' '}
                {form.dateTime
                  ? formatWorkshopWhen({
                      dateTime: fromLocalInput(form.dateTime),
                      endTime: form.endTime ? fromLocalInput(form.endTime) : null,
                    })
                  : 'chưa chọn thời gian'}
                <br />
                <AdminIcon name="pin" size={15} /> {form.location || 'chưa nhập địa điểm'}
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
              {/* Saving a time that has already passed is accepted, but the
                  session then never appears on the public page. Say so while
                  the admin can still change it. */}
              <span className={`field-hint${startsInPast ? ' warn' : ''}`}>
                {startsInPast
                  ? 'Thời gian này đã qua — buổi sẽ không hiện cho khách.'
                  : 'Theo giờ máy của bạn'}
              </span>
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
            <div className="field">
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
              {/* The room sizes Sprouty actually runs, so the usual case is
                  one click rather than a typed number. */}
              <PresetChips
                options={CAPACITY_PRESETS}
                value={form.capacity}
                onPick={set('capacity')}
                format={(n) => `${n} bé`}
              />
              <span className="field-hint">Số bé tối đa nhận đăng ký</span>
            </div>

            <div className="field">
              <span className="field-label">Học phí</span>
              <MoneyInput
                value={form.price}
                onChange={set('price')}
                placeholder="0"
                suggestions={WORKSHOP_PRICE_PRESETS}
              />
              <span className="field-hint">Chọn “Miễn phí” nếu buổi học không thu tiền</span>
            </div>
          </div>

          <div className="field">
            <span className="field-label">
              Địa điểm <span className="req">*</span>
            </span>
            {/* The studios already running sessions. Typed freely, the same
                room ends up spelled three ways and the location report splits
                it into three. */}
            <ComboField
              value={form.location}
              onChange={set('location')}
              options={locationOptions}
              placeholder="VD: Sprouty Studio – TP.HCM"
              emptyHint="Chưa có địa điểm nào — gõ để thêm địa điểm đầu tiên."
            />
          </div>

          <div className="field">
            <span className="field-label">Độ tuổi phù hợp</span>
            <input
              className="form-input"
              placeholder="VD: 4–8 tuổi"
              value={form.ageRange}
              onChange={(e) => set('ageRange')(e.target.value)}
            />
            {/* One spelling of each band. The shop groups by this exact
                string, so a hyphen where the others use an en dash shows up
                in the filter list as a second, near-identical option. */}
            <PresetChips
              options={AGE_PRESETS}
              value={form.ageRange}
              onPick={set('ageRange')}
            />
          </div>

          {/* A real upload. This was a text box for a URL, which meant an admin
              had to get the file onto the server some other way first and then
              type its path — there was no other way. */}
          <div className="field">
            <span className="field-label">Ảnh bìa</span>
            <div className="ws-cover-pick">
              <div className="ws-cover-preview">
                {form.imageUrl ? (
                  <img src={form.imageUrl} alt="" />
                ) : (
                  <AdminIcon name="images" size={22} />
                )}
              </div>
              <div className="ws-cover-actions">
                <label className={`btn btn-ghost btn-sm${uploading ? ' disabled' : ''}`}>
                  {uploading ? 'Đang tải lên…' : form.imageUrl ? 'Đổi ảnh' : 'Chọn ảnh từ máy'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadCover(file);
                      e.target.value = '';
                    }}
                  />
                </label>
                {form.imageUrl && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => set('imageUrl')('')}
                  >
                    Gỡ ảnh
                  </button>
                )}
                <span className="field-hint">
                  JPG, PNG hoặc WEBP · tối đa 10MB. Ảnh ngang đẹp nhất (tỷ lệ 4:3).
                </span>
              </div>
            </div>
          </div>

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
            emptyIcon={<AdminIcon name="seat" size={24} />}
            emptyTitle="Chưa có ai đăng ký"
            emptyHint="Khách đăng ký từ trang Workshop sẽ hiện ở đây."
          />
          {/* Two dense lines per person. The first pass gave each registration a
              2×2 labelled grid and a row of wide buttons — one booking filled
              the dialog, and a full session would have run for pages. */}
          {regState === 'ready' && registrations.length > 0 && (
            <div className="ws-reg-summary">
              {regCounts.paid > 0 && (
                <span className="ok"><AdminIcon name="check" size={14} /> {regCounts.paid} đã thanh toán</span>
              )}
              {regCounts.unpaid > 0 && (
                <span className="wait"><AdminIcon name="clock" size={14} /> {regCounts.unpaid} chưa thanh toán</span>
              )}
              {regCounts.cancelled > 0 && (
                <span className="off"><AdminIcon name="close" size={14} /> {regCounts.cancelled} đã huỷ</span>
              )}
            </div>
          )}
          {regState === 'ready' &&
            registrations.map((r, i) => (
              <div className={`ws-reg${r.status === 'cancelled' ? ' cancelled' : ''}`} key={r.id}>
                <div className="ws-reg-line">
                  <span className="ws-reg-no">{i + 1}</span>
                  <span className="ws-reg-name">
                    {r.guestName || r.user?.name || 'Khách vãng lai'}
                  </span>
                  <Pill tone={bookingState(r).tone}>{bookingState(r).label}</Pill>
                  {r.paymentMethod === 'onsite' && !r.paidAt && r.status !== 'cancelled' && (
                    <span className="ws-reg-onsite">trả tại buổi học</span>
                  )}
                  <span className="ws-reg-spacer" />
                  <span className="ws-reg-btns">
                    {/* Paid at the door, or transferred without the reference —
                        either way the webhook never saw it. */}
                    {!r.paidAt && r.amount > 0 && r.status !== 'cancelled' && (
                      <button
                        className="act-btn act-paid"
                        title="Ghi nhận đã thu tiền"
                        onClick={() => markRegistrationPaid(r.id, r.amount)}
                      >
                        <AdminIcon name="sales" size={16} />
                      </button>
                    )}
                    {r.status !== 'cancelled' ? (
                      <button
                        className="act-btn act-del"
                        title="Huỷ chỗ (giữ lại bản ghi)"
                        onClick={() => setRegistrationStatus(r.id, 'cancelled')}
                      >
                        <AdminIcon name="close" size={16} />
                      </button>
                    ) : (
                      <button
                        className="act-btn act-edit"
                        title="Mở lại chỗ"
                        onClick={() => setRegistrationStatus(r.id, 'pending')}
                      >
                        <AdminIcon name="refresh" size={16} />
                      </button>
                    )}
                    <button
                      className="act-btn act-del"
                      title="Xoá hẳn khỏi danh sách"
                      onClick={() => cancelRegistration(r.id)}
                    >
                      <AdminIcon name="trash" size={16} />
                    </button>
                  </span>
                </div>

                <div className="ws-reg-meta">
                  {/* Tappable: staff call these from a phone at the door. */}
                  {r.guestPhone ? (
                    <a href={`tel:${r.guestPhone}`}><AdminIcon name="phone" size={14} /> {r.guestPhone}</a>
                  ) : (
                    <span><AdminIcon name="phone" size={14} /> —</span>
                  )}
                  {(r.guestEmail || r.user?.email) && (
                    <span className="ws-reg-email"><AdminIcon name="mail" size={14} /> {r.guestEmail || r.user?.email}</span>
                  )}
                  <span><AdminIcon name="user" size={14} /> {r.childAge || 'chưa rõ tuổi'}</span>
                  <span>{r.childCount} bé</span>
                  {r.amount > 0 && (
                    <span>
                      <AdminIcon name="sales" size={14} /> {r.amount.toLocaleString('vi-VN')}đ
                    </span>
                  )}
                  <span className="ws-reg-when">
                    {new Date(r.createdAt).toLocaleString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {r.note && (
                  <div className="ws-reg-note">
                    <AdminIcon name="blog" size={14} /> {r.note}
                  </div>
                )}
              </div>
            ))}
        </Modal>
      )}
    </>
  );
}
