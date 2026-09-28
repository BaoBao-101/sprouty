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
import { showToast } from '@/services/toast';

interface WorkshopRow {
  id: string;
  title: string;
  dateTime: string;
  location: string;
  capacity: number;
  registrations: number;
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

const EMPTY_FORM = { title: '', dateTime: '', capacity: '12', location: '' };

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
        dateTime: toLocalInput(workshop.dateTime),
        capacity: String(workshop.capacity),
        location: workshop.location,
      });
    } else {
      setEditingId(null);
      // Default to the same venue as the most recent workshop — they repeat.
      const lastLocation = stats?.workshops.at(-1)?.location ?? '';
      setForm({ ...EMPTY_FORM, location: lastLocation });
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

    setSaving(true);
    const payload = {
      title: form.title.trim(),
      dateTime: fromLocalInput(form.dateTime),
      capacity,
      location: form.location.trim(),
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
                    <div className="ad-cell-main">{w.title}</div>
                    <div style={{ marginTop: 4 }}>
                      <Pill tone={w.upcoming ? 'green' : 'grey'}>
                        {w.upcoming ? 'Sắp tới' : 'Đã diễn ra'}
                      </Pill>
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
          <label className="field">
            <span className="field-label">
              Tên workshop <span className="req">*</span>
            </span>
            <input
              className="form-input"
              placeholder="VD: Basic Workshop — Vẽ chậu & gieo hạt"
              value={form.title}
              onChange={(e) => set('title')(e.target.value)}
            />
          </label>

          <div className="field-grid">
            <label className="field">
              <span className="field-label">
                Thời gian <span className="req">*</span>
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
              <span className="field-hint">Số chỗ tối đa nhận đăng ký</span>
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
          {regState === 'ready' &&
            registrations.map((r, i) => (
              <div className="rc-redemption" key={r.id}>
                <div>
                  <div className="ad-cell-main">
                    {i + 1}. {r.user?.name || r.guestName || 'Khách vãng lai'}
                  </div>
                  <div className="ad-cell-sub">
                    {r.user?.email || r.guestPhone || 'Không có thông tin liên hệ'}
                  </div>
                  <div className="ad-cell-sub">
                    Đăng ký {new Date(r.createdAt).toLocaleString('vi-VN')}
                  </div>
                </div>
                <button className="act-btn act-del" onClick={() => cancelRegistration(r.id)}>
                  Huỷ chỗ
                </button>
              </div>
            ))}
        </Modal>
      )}
    </>
  );
}
