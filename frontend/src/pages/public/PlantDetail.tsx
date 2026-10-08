/**
 * One plant's simulation dashboard.
 *
 * The layout follows what a child needs in order: the plant itself, then the
 * one thing to do next, then the care buttons, then the sensors that explain
 * why. The recommended action is highlighted in the care row rather than being
 * a separate button, so pressing the thing the coach suggested and pressing the
 * button are the same gesture.
 *
 * Cooldowns tick down locally from `secondsLeft` instead of being polled: the
 * server already said when each action comes back, and a countdown that only
 * moved on refresh would make the wait feel broken.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import { SproutyIcon, type IconName } from '@/components/icons/SproutyIcon';
import { PlantArt } from '@/components/PlantArt';
import { PlantGuide, useGuideFirstRun } from '@/components/PlantGuide';
import {
  formatCountdown,
  metricBand,
  type CareSlot,
  type CoachMessage,
  type PlantDetail as PlantDetailType,
  type PlantDevice,
  type PlantEvent,
  type SensorReading,
} from '@/types/plant';
import './PlantDetail.css';

/** Local countdown, so the cooldown pills move every second. */
function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Seconds left on a slot, counted down from when the payload arrived. */
function secondsLeftNow(slot: CareSlot, fetchedAt: number, now: number) {
  if (slot.ready) return 0;
  const elapsed = (now - fetchedAt) / 1000;
  return Math.max(0, slot.secondsLeft - elapsed);
}

/**
 * What a reading means, in a child's words.
 *
 * "Độ ẩm đất 88%" tells a six-year-old nothing: they would have to know the
 * comfort band for this stage and compare against it. "Hơi ướt" is the same
 * fact, already interpreted. The number stays, smaller, for the parent reading
 * over their shoulder and for the child who gets curious later.
 */
function verdict(kind: string, value: number, ideal?: [number, number]): string {
  switch (kind) {
    case 'moisture': {
      const [lo, hi] = ideal ?? [45, 70];
      if (value < lo - 18) return 'Khô cong';
      if (value < lo) return 'Hơi khô';
      if (value > hi + 15) return 'Úng nước';
      if (value > hi) return 'Hơi ướt';
      return 'Vừa đẹp';
    }
    case 'temperature': {
      const [lo, hi] = ideal ?? [20, 32];
      if (value < lo - 4) return 'Lạnh quá';
      if (value < lo) return 'Hơi lạnh';
      if (value > hi + 4) return 'Nóng quá';
      if (value > hi) return 'Hơi nóng';
      return 'Vừa đẹp';
    }
    case 'light':
      if (value > 60) return 'Nắng đẹp';
      if (value > 30) return 'Đủ sáng';
      if (value > 8) return 'Trời dịu';
      return 'Trời tối';
    case 'nutrient':
      if (value > 60) return 'Còn no';
      if (value > 40) return 'Hơi đói';
      if (value > 25) return 'Đói rồi';
      return 'Hết sạch';
    case 'pest':
      if (value < 20) return 'Sạch bong';
      if (value < 40) return 'Vẫn ổn';
      if (value < 58) return 'Có sâu';
      return 'Nhiều sâu';
    default:
      return '';
  }
}

function MetricRing({
  value,
  band,
  label,
  unit = '%',
  icon,
  kind,
  ideal,
}: {
  value: number;
  band: 'good' | 'warn' | 'bad';
  label: string;
  unit?: string;
  icon: IconName;
  kind: string;
  ideal?: [number, number];
}) {
  const R = 26;
  const circumference = 2 * Math.PI * R;
  // Temperature is not a percentage, so the ring maps 10–40°C onto the dial.
  const pct = unit === '°C' ? Math.min(100, Math.max(0, ((value - 10) / 30) * 100)) : value;
  const dash = (Math.min(100, Math.max(0, pct)) / 100) * circumference;

  return (
    <div className={`ring ring-${band}`}>
      <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
        <circle cx="32" cy="32" r={R} className="ring-track" />
        <circle
          cx="32"
          cy="32"
          r={R}
          className="ring-fill"
          strokeDasharray={`${dash} ${circumference}`}
          transform="rotate(-90 32 32)"
        />
      </svg>
      <span className="ring-icon">
        <SproutyIcon name={icon} size={20} />
      </span>
      <div className="ring-read">
        {/* The plain-words verdict leads; the measurement follows it. */}
        <strong>{verdict(kind, value, ideal)}</strong>
        <span className="ring-label">{label}</span>
        <span className="ring-num">
          {Math.round(value)}
          {unit}
        </span>
      </div>
    </div>
  );
}

/** A compact multi-series sparkline of the sensor history. */
function SensorChart({ readings }: { readings: SensorReading[] }) {
  if (readings.length < 2) {
    return (
      <p className="chart-empty">
        Biểu đồ sẽ hiện khi cảm biến ghi đủ dữ liệu — quay lại sau một lúc nhé.
      </p>
    );
  }

  const W = 640;
  const H = 150;
  const PAD = 6;
  const series: Array<{ key: keyof SensorReading; label: string; color: string; scale: (v: number) => number }> = [
    { key: 'moisture', label: 'Độ ẩm đất', color: 'var(--cobalt)', scale: (v) => v },
    { key: 'nutrient', label: 'Dinh dưỡng', color: 'var(--primary-500)', scale: (v) => v },
    { key: 'light', label: 'Ánh sáng', color: 'var(--accent-yellow)', scale: (v) => v },
    // Mapped onto the same 0–100 axis as the rest, 10–40°C → 0–100.
    { key: 'temperature', label: 'Nhiệt độ', color: 'var(--accent-coral)', scale: (v) => ((v - 10) / 30) * 100 },
  ];

  const stepX = (W - PAD * 2) / (readings.length - 1);
  const y = (pct: number) => H - PAD - (Math.min(100, Math.max(0, pct)) / 100) * (H - PAD * 2);

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" preserveAspectRatio="none" aria-hidden="true">
        {[25, 50, 75].map((line) => (
          <line key={line} x1={PAD} x2={W - PAD} y1={y(line)} y2={y(line)} className="chart-grid" />
        ))}
        {series.map((s) => (
          <polyline
            key={s.key as string}
            className="chart-line"
            stroke={s.color}
            points={readings
              .map((r, i) => `${PAD + i * stepX},${y(s.scale(r[s.key] as number))}`)
              .join(' ')}
          />
        ))}
      </svg>
      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.key as string}>
            <i style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function DeviceCard({
  device,
  busy,
  onToggle,
}: {
  device: PlantDevice;
  busy: boolean;
  onToggle: (type: string, next: boolean) => void;
}) {
  const [open, setOpen] = useState(false);

  if (!device.unlocked) {
    return (
      <div className="device device-locked">
        <span className="device-icon">
          <SproutyIcon name="lock" size={22} />
        </span>
        <div className="device-body">
          <strong>{device.label}</strong>
          <p>Mở ở giai đoạn “{device.unlockStageLabel}”</p>
        </div>
      </div>
    );
  }

  const lowBattery = device.battery < 20;

  return (
    <div className={`device${device.autoMode ? ' device-on' : ''}`}>
      <span className="device-icon">
        <SproutyIcon name={device.icon} size={22} />
      </span>

      <div className="device-body">
        <div className="device-top">
          <strong>{device.label}</strong>
          <button
            type="button"
            className="device-info-btn"
            aria-label={`Giải thích ${device.label}`}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <SproutyIcon name="info" size={17} />
          </button>
        </div>

        {device.reading !== null ? (
          <div className="device-reading">
            <span className="device-value">
              {Math.round(device.reading)}
              <em>{device.unit}</em>
            </span>
            {device.secondary && (
              <span className="device-secondary">
                {device.secondary.label} {Math.round(device.secondary.value)}
                {device.secondary.unit}
              </span>
            )}
          </div>
        ) : device.kind === 'actuator' ? (
          <label className="device-switch">
            <input
              type="checkbox"
              checked={device.autoMode}
              disabled={busy}
              onChange={(e) => onToggle(device.type, e.target.checked)}
            />
            <span className="device-switch-track" aria-hidden="true">
              <span className="device-switch-knob" />
            </span>
            <span className="device-switch-label">{device.autoMode ? 'Đang bật' : 'Đang tắt'}</span>
          </label>
        ) : (
          <p className="device-note">Đang hoạt động</p>
        )}

        <div className={`device-battery${lowBattery ? ' low' : ''}`}>
          <SproutyIcon name="battery" size={15} />
          <span className="device-batt-track">
            <span className="device-batt-fill" style={{ width: `${Math.round(device.battery)}%` }} />
          </span>
          {Math.round(device.battery)}%
        </div>

        {open && <p className="device-about">{device.about}</p>}
      </div>
    </div>
  );
}

/** Openers for a child who has not thought of a question yet. */
const QUICK_ASKS = ['Tại sao lá bị vàng?', 'Bao lâu nữa cây lớn?', 'Nên bật thiết bị nào?'];

export default function PlantDetail() {
  const { plantId = '' } = useParams();
  const navigate = useNavigate();
  const now = useNow();

  const [plant, setPlant] = useState<PlantDetailType | null>(null);
  const [fetchedAt, setFetchedAt] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [careBusy, setCareBusy] = useState<string | null>(null);
  const [deviceBusy, setDeviceBusy] = useState(false);
  const [feed, setFeed] = useState<PlantEvent[]>([]);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  // Opens by itself on a first visit; the "?" button brings it back after that.
  const [guideOpen, closeGuide, openGuide] = useGuideFirstRun();

  // The thread lives on the server, so it survives a reload and follows the
  // child from the tablet to the phone. Mirrored here so an optimistic question
  // can appear the moment it is asked.
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [coachBusy, setCoachBusy] = useState(false);
  const [question, setQuestion] = useState('');
  const threadRef = useRef<HTMLDivElement>(null);
  // Whether the thread is parked on the newest turn. Kept in a ref for the
  // effect to read without re-subscribing, and in state for the pill to show.
  const stuckToEnd = useRef(true);
  const settled = useRef(false);
  const [atBottom, setAtBottom] = useState(true);
  // The journal is history, so it stays shut until someone wants it. A care
  // action that adds a line opens it, which is how the growth it earned gets
  // seen without a click.
  const [logOpen, setLogOpen] = useState(false);

  const apply = useCallback((detail: PlantDetailType, events: PlantEvent[] = []) => {
    setPlant(detail);
    setFetchedAt(Date.now());
    // The server's copy is the truth; replacing wholesale also drops any
    // optimistic question whose request failed.
    if (detail.coachMessages) setMessages(detail.coachMessages);
    if (events.length) {
      setFeed((prev) => [...events, ...prev].slice(0, 12));
      setLogOpen(true);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await API.plants.get(plantId);
      apply(data.plant, data.events || []);
    } catch (err: any) {
      showToast(err?.message || 'Không tải được cây này.', 'error');
      navigate('/my-plants', { replace: true });
    } finally {
      setLoading(false);
    }
  }, [plantId, apply, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  const scrollThread = useCallback((behavior: ScrollBehavior = 'auto') => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    stuckToEnd.current = true;
    setAtBottom(true);
  }, []);

  function onThreadScroll() {
    const el = threadRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    stuckToEnd.current = near;
    setAtBottom(near);
  }

  // Follow the conversation as it grows — but only while the reader is
  // already at the end. Someone re-reading an older answer should not have
  // the thread pulled out from under them; they get the jump pill instead.
  useEffect(() => {
    if (!stuckToEnd.current) return;
    scrollThread(settled.current ? 'smooth' : 'auto');
    settled.current = true;
  }, [messages, coachBusy, scrollThread]);

  // Coming back to the tab after a while: the plant has moved on.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  async function doCare(action: string) {
    if (careBusy) return;
    setCareBusy(action);
    try {
      const data = await API.plants.care(plantId, action);
      apply(data.plant, data.messages || []);
      const gained = data.growth > 0;
      const headline =
        (data.messages || []).find((m: PlantEvent) => m.level === 'warn') ??
        (data.messages || [])[0];
      showToast(
        headline?.text || (gained ? `+${data.growth} điểm phát triển` : 'Đã chăm cây'),
        headline?.level === 'warn' ? 'error' : 'success',
      );
      if (data.harvested) {
        showToast('Hành trình hoàn thành! Chúc mừng bạn.', 'success');
      }
      for (const type of data.newlyUnlocked || []) {
        const unlocked = data.plant.devices.find((d: PlantDevice) => d.type === type);
        if (unlocked) showToast(`Thiết bị mới: ${unlocked.label}`, 'success');
      }
    } catch (err: any) {
      showToast(err?.message || 'Không chăm cây được lúc này.', 'error');
      // A 429 means the cooldown moved under us; refresh so the pill is honest.
      if (err?.status === 429 || err?.status === 409) void load();
    } finally {
      setCareBusy(null);
    }
  }

  async function toggleDevice(type: string, next: boolean) {
    setDeviceBusy(true);
    try {
      const data = await API.plants.setDevice(plantId, type, next);
      showToast(data.message, 'success');
      await load();
    } catch (err: any) {
      showToast(err?.message || 'Không đổi được chế độ thiết bị.', 'error');
    } finally {
      setDeviceBusy(false);
    }
  }

  async function askCoach(text?: string) {
    if (coachBusy) return;
    const asked = text?.trim() || 'Cây của mình giờ thế nào, mình nên làm gì tiếp theo?';

    // Show the question straight away. Waiting for the round trip makes the
    // thread look like it swallowed what was typed.
    const pending: CoachMessage = {
      id: `pending-${Date.now()}`,
      role: 'user',
      content: asked,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, pending]);
    setQuestion('');
    setCoachBusy(true);

    try {
      const data = await API.plants.coach(plantId, text);
      setMessages((prev) => [
        ...prev,
        {
          id: `reply-${Date.now()}`,
          role: 'assistant',
          content: data.reply,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (err: any) {
      // Take the question back out: it was never recorded, and leaving it in
      // the thread would imply Plant Buddy chose not to answer.
      setMessages((prev) => prev.filter((m) => m.id !== pending.id));
      showToast(err?.message || 'Plant Buddy đang nghỉ một chút, thử lại sau nhé.', 'error');
    } finally {
      setCoachBusy(false);
    }
  }

  async function clearCoach() {
    if (!confirm('Xoá toàn bộ lịch sử trò chuyện với Plant Buddy?')) return;
    try {
      await API.plants.clearCoach(plantId);
      setMessages([]);
    } catch (err: any) {
      showToast(err?.message || 'Không xoá được lịch sử.', 'error');
    }
  }

  async function saveName() {
    const next = nameDraft.trim();
    if (!next || !plant || next === plant.nickname) {
      setRenaming(false);
      return;
    }
    try {
      await API.plants.rename(plantId, next);
      setPlant({ ...plant, nickname: next });
      setRenaming(false);
      showToast('Đã đổi tên cây.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Không đổi được tên.', 'error');
    }
  }

  if (loading) {
    return <div className="plant-loading">Đang mở vườn của bạn…</div>;
  }
  if (!plant) return null;

  const harvested = Boolean(plant.harvestedAt);
  const sensors = plant.devices.filter((d) => d.kind === 'sensor');
  const actuators = plant.devices.filter((d) => d.kind === 'actuator');
  const careSlots = plant.care.filter((c) => c.allowedInStage || c.action !== 'harvest');
  const recommended = plant.nextStep.action;

  return (
    <>
      <PlantGuide open={guideOpen} onClose={closeGuide} />

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="pd-hero" style={{ ['--plant-bg' as string]: plant.bgColor || '#F0FDF4' }}>
        <div className="container">
          <div className="pd-hero-top">
            <div className="breadcrumb pd-crumb">
              <Link to="/">Trang chủ</Link> › <Link to="/my-plants">Cây của tôi</Link> ›{' '}
              <span>{plant.nickname}</span>
            </div>

            <Link to={`/tree?id=${plant.productId}`} className="pd-hero-album">
              <SproutyIcon name="album" size={19} />
              Album kỷ niệm
              <SproutyIcon name="arrow-right" size={16} />
            </Link>
          </div>

          <div className="pd-hero-grid">
            <div className="pd-art-pane">
              <PlantArt
                stage={plant.stage}
                progress={plant.stageProgress}
                health={plant.health}
                form={plant.form}
                fruitShape={plant.fruitShape}
                fruitColor={plant.fruitColor}
                flowerColor={plant.flowerColor}
                isNight={!plant.environment.isDay}
                size={300}
              />
              <div className="pd-clock">
                <SproutyIcon name={plant.environment.isDay ? 'sun' : 'moon'} size={17} />
                {plant.environment.isDay ? 'Ban ngày' : 'Ban đêm'} ·{' '}
                {String(Math.floor(plant.environment.hour)).padStart(2, '0')}:
                {String(Math.round((plant.environment.hour % 1) * 60)).padStart(2, '0')}
              </div>
            </div>

            <div className="pd-head-pane">
              <div className="pd-name-row">
                {renaming ? (
                  <div className="pd-name-edit">
                    <input
                      className="form-input"
                      maxLength={40}
                      autoFocus
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void saveName();
                        if (e.key === 'Escape') setRenaming(false);
                      }}
                    />
                    <button className="btn btn-primary btn-sm" onClick={saveName}>
                      Lưu
                    </button>
                  </div>
                ) : (
                  <>
                    <h1>{plant.nickname}</h1>
                    <button
                      className="pd-rename"
                      aria-label="Đổi tên cây"
                      onClick={() => {
                        setNameDraft(plant.nickname);
                        setRenaming(true);
                      }}
                    >
                      <SproutyIcon name="pencil" size={17} />
                    </button>
                  </>
                )}
              </div>
              <p className="pd-species">
                {plant.productName} · giống {plant.speciesLabel} · thu hoạch {plant.harvestLabel}
              </p>

              <button className="guide-open-btn pd-guide-btn" onClick={openGuide}>
                <SproutyIcon name="info" size={17} />
                Cây cần gì? Xem hướng dẫn
              </button>

              <div className="pd-badges">
                <span className="pd-badge pd-badge-stage">
                  <SproutyIcon name="sprout" size={17} />
                  {plant.stageLabel}
                </span>
                <span className={`pd-badge pd-badge-health pd-h-${plant.healthState.id}`}>
                  <SproutyIcon name="heart" size={17} />
                  {plant.healthState.label} {Math.round(plant.health)}%
                </span>
                {plant.careStreak > 0 && (
                  <span className="pd-badge pd-badge-streak">
                    <SproutyIcon name="bolt" size={17} />
                    {plant.careStreak} ngày liên tục
                  </span>
                )}
              </div>

              {/* Journey map */}
              <div className="pd-journey">
                {plant.stages.map((s, i) => (
                  <div
                    key={s.id}
                    className={`pdj-step${s.reached ? ' reached' : ''}${s.current ? ' current' : ''}`}
                    title={s.story}
                  >
                    {i > 0 && <span className="pdj-line" aria-hidden="true" />}
                    <span className="pdj-dot">
                      <SproutyIcon name={s.reached && !s.current ? 'check' : s.icon} size={18} />
                    </span>
                    <span className="pdj-label">{s.label}</span>
                  </div>
                ))}
              </div>

              <div className="pd-progress">
                <div className="pd-progress-track">
                  <div
                    className="pd-progress-fill"
                    style={{ width: `${Math.round(plant.stageProgress)}%` }}
                  />
                </div>
                <span>
                  {Math.round(plant.stageProgress)}% của chặng “{plant.stageLabel}”
                </span>
              </div>

              <p className="pd-story">{plant.stageStory}</p>
            </div>
          </div>
        </div>
      </div>

      <section className="pd-main">
        <div className="container">
          {/* ── Next step ──────────────────────────────────────────────── */}
          <div className={`pd-next${harvested ? ' done' : ''}`}>
            <span className="pd-next-icon">
              <SproutyIcon name={harvested ? 'trophy' : plant.nextStep.icon} size={30} />
            </span>
            <div className="pd-next-copy">
              <span className="pd-next-kicker">
                {harvested ? 'Hành trình đã hoàn thành' : 'Việc nên làm tiếp theo'}
              </span>
              <strong>
                {harvested
                  ? `Bạn đã thu hoạch ${plant.harvestLabel} từ cây này!`
                  : plant.nextStep.label || 'Cây đang tự lớn'}
              </strong>
              <p>
                {harvested ? 'Mở một bộ kit mới để bắt đầu một cây khác nhé.' : plant.nextStep.why}
              </p>
            </div>
            {!harvested && recommended && (
              <button
                className="pd-next-btn"
                disabled={careBusy !== null}
                onClick={() => doCare(recommended)}
              >
                {careBusy === recommended ? 'Đang làm...' : 'Làm ngay'}
                <SproutyIcon name="arrow-right" size={18} />
              </button>
            )}
          </div>

          <div className="pd-cols">
            <div className="pd-col-main">
              {/* ── Care actions ───────────────────────────────────────── */}
              <div className="pd-panel">
                <div className="pd-panel-head">
                  <h2>
                    <SproutyIcon name="water" size={21} /> Chăm cây
                  </h2>
                  <p>
                    Mỗi việc có thời gian hồi riêng. Làm đúng lúc cây đang cần thì được nhiều điểm
                    phát triển hơn.
                  </p>
                </div>

                <div className="care-grid">
                  {careSlots.map((slot) => {
                    const left = secondsLeftNow(slot, fetchedAt, now);
                    const ready = slot.allowedInStage && left <= 0;
                    const isRec = slot.action === recommended;
                    return (
                      <button
                        key={slot.action}
                        className={`care-btn${ready ? ' ready' : ''}${isRec ? ' recommended' : ''}`}
                        disabled={!ready || careBusy !== null || harvested}
                        onClick={() => doCare(slot.action)}
                        title={slot.hint}
                      >
                        {isRec && ready && <span className="care-flag">Nên làm</span>}
                        <span className="care-icon">
                          <SproutyIcon name={slot.icon} size={26} />
                        </span>
                        <span className="care-label">{slot.label}</span>
                        <span className="care-state">
                          {!slot.allowedInStage ? (
                            <>
                              <SproutyIcon name="lock" size={13} /> Chưa tới lúc
                            </>
                          ) : careBusy === slot.action ? (
                            'Đang làm...'
                          ) : ready ? (
                            <>
                              <SproutyIcon name="check" size={13} /> Sẵn sàng
                            </>
                          ) : (
                            <>
                              <SproutyIcon name="clock" size={13} /> {formatCountdown(left)}
                            </>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Sensors ────────────────────────────────────────────── */}
              <div className="pd-panel">
                <div className="pd-panel-head">
                  <h2>
                    <SproutyIcon name="chart" size={21} /> Cảm biến IoT
                  </h2>
                  <p>
                    Xanh là cây đang vui, vàng là cây hơi mệt, đỏ là cây cần bạn giúp ngay.
                    <br />
                    <span className="pd-panel-fine">
                      Chặng này cây thích đất ẩm {plant.idealMoisture[0]}–{plant.idealMoisture[1]}%
                      và nhiệt độ {plant.idealTemp[0]}–{plant.idealTemp[1]}°C.
                    </span>
                  </p>
                </div>

                <div className="ring-row">
                  <MetricRing
                    icon="moisture"
                    kind="moisture"
                    label="Nước trong đất"
                    ideal={plant.idealMoisture}
                    value={plant.moisture}
                    band={
                      metricBand(plant.moisture, plant.idealMoisture) as 'good' | 'warn' | 'bad'
                    }
                  />
                  <MetricRing
                    icon="thermo"
                    kind="temperature"
                    label="Nhiệt độ"
                    unit="°C"
                    ideal={plant.idealTemp}
                    value={plant.environment.temperature}
                    band={
                      metricBand(plant.environment.temperature, plant.idealTemp) as
                        'good' | 'warn' | 'bad'
                    }
                  />
                  <MetricRing
                    icon="light"
                    kind="light"
                    label="Ánh sáng"
                    value={plant.environment.light}
                    band={
                      plant.environment.light > 35
                        ? 'good'
                        : plant.environment.isDay
                          ? 'warn'
                          : 'good'
                    }
                  />
                  <MetricRing
                    icon="nutrient"
                    kind="nutrient"
                    label="Thức ăn của cây"
                    value={plant.nutrient}
                    band={plant.nutrient > 45 ? 'good' : plant.nutrient > 28 ? 'warn' : 'bad'}
                  />
                  <MetricRing
                    icon="pest"
                    kind="pest"
                    label="Sâu bệnh"
                    value={plant.pestRisk}
                    band={plant.pestRisk < 40 ? 'good' : plant.pestRisk < 58 ? 'warn' : 'bad'}
                  />
                </div>

                <SensorChart readings={plant.readings} />
              </div>

              {/* ── Devices ────────────────────────────────────────────── */}
              <div className="pd-panel">
                <div className="pd-panel-head">
                  <h2>
                    <SproutyIcon name="pump" size={21} /> Thiết bị trong bộ kit
                  </h2>
                  <p>
                    Bật chế độ tự động để thiết bị giữ cây sống khi bạn đi vắng. Nhưng điểm phát
                    triển chỉ đến từ việc bạn tự chăm.
                  </p>
                </div>

                <div className="device-grid">
                  {[...sensors, ...actuators].map((device) => (
                    <DeviceCard
                      key={device.type}
                      device={device}
                      busy={deviceBusy}
                      onToggle={toggleDevice}
                    />
                  ))}
                </div>
              </div>

              {/* ── Journal ────────────────────────────────────────────── */}
              <div className={`pd-panel pd-log${logOpen ? ' open' : ''}`}>
                <button
                  className="pd-log-toggle"
                  aria-expanded={logOpen}
                  onClick={() => setLogOpen((open) => !open)}
                >
                  <SproutyIcon name="clock" size={20} />
                  <span>
                    <strong>Nhật ký</strong>
                    <em>
                      {plant.history.length > 0
                        ? `${plant.history.length} việc bạn đã làm cho cây`
                        : 'Chưa có việc chăm cây nào được ghi lại'}
                    </em>
                  </span>
                  {!logOpen && feed.length > 0 && <i className="pd-log-dot" />}
                  <SproutyIcon name="arrow-down" size={18} className="pd-log-chevron" />
                </button>

                {logOpen && (
                  <div className="pd-log-body">
                    {feed.length > 0 && (
                      <ul className="feed-list">
                        {feed.map((event, i) => (
                          <li key={i} className={`feed-item feed-${event.level}`}>
                            <SproutyIcon
                              name={
                                event.level === 'warn'
                                  ? 'warning'
                                  : event.level === 'good'
                                    ? 'check'
                                    : 'info'
                              }
                              size={16}
                            />
                            {event.text}
                          </li>
                        ))}
                      </ul>
                    )}

                    <ul className="history-list">
                      {plant.history.length === 0 && (
                        <li className="history-empty">Chưa có việc chăm cây nào được ghi lại.</li>
                      )}
                      {plant.history.map((entry) => (
                        <li key={entry.id} className={entry.warned ? 'warned' : ''}>
                          <span className="history-icon">
                            <SproutyIcon name={entry.icon} size={17} />
                          </span>
                          <div>
                            <strong>{entry.label}</strong>
                            <span>
                              {new Date(entry.createdAt).toLocaleString('vi-VN', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                              {' · '}
                              {entry.stageLabel}
                            </span>
                          </div>
                          {entry.growth > 0 && <em className="history-growth">+{entry.growth}</em>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Plant Buddy is pinned to the viewport rather than left to scroll
                away with the page: the questions a child asks are about the
                numbers in the left column, so both have to be readable at the
                same moment. Pinning is also what earns the thread its own
                scrollbar — a panel that never leaves the screen cannot strand
                the wheel the way a mid-page scroller does. */}
            <aside className="pd-col-side">
              <div className="pd-panel coach-panel">
                <header className="coach-head">
                  <span className="coach-avatar">
                    <SproutyIcon name="chat" size={24} />
                  </span>
                  <div className="coach-who">
                    <strong>Plant Buddy</strong>
                    <span className={`coach-status${coachBusy ? ' busy' : ''}`}>
                      <i />
                      {coachBusy ? 'đang xem cây…' : 'đang chờ bạn hỏi'}
                    </span>
                  </div>
                  {messages.length > 0 && (
                    <button
                      className="coach-clear"
                      title="Xoá lịch sử trò chuyện"
                      aria-label="Xoá lịch sử trò chuyện"
                      onClick={clearCoach}
                    >
                      <SproutyIcon name="trash" size={16} />
                    </button>
                  )}
                </header>

                {/* The thread. Every turn stays, so a child can scroll back to
                    what they were told — and the server replays it to the model,
                    so a follow-up like "tại sao?" has something to refer to. */}
                <div className="coach-thread" ref={threadRef} onScroll={onThreadScroll}>
                  {messages.length === 0 && !coachBusy && (
                    <div className="coach-empty">
                      <span className="coach-empty-icon">
                        <SproutyIcon name="sprout" size={30} />
                      </span>
                      <p>
                        Chào bạn! Mình là <b>Plant Buddy</b>. Mình nhìn được hết cảm biến của{' '}
                        {plant.nickname} và sẽ nói cho bạn biết cây đang cần gì.
                      </p>
                      <button className="coach-ask" onClick={() => askCoach()}>
                        <SproutyIcon name="sparkle" size={18} />
                        Xem cây giúp mình
                      </button>
                    </div>
                  )}

                  {messages.map((m) => (
                    <div key={m.id} className={`coach-msg coach-msg-${m.role}`}>
                      {m.role === 'assistant' && (
                        <span className="coach-msg-avatar">
                          <SproutyIcon name="sprout" size={16} />
                        </span>
                      )}
                      <div className="coach-bubble">
                        <p>{m.content}</p>
                        <time>
                          {new Date(m.createdAt).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </time>
                      </div>
                    </div>
                  ))}

                  {coachBusy && (
                    <div className="coach-msg coach-msg-assistant">
                      <span className="coach-msg-avatar">
                        <SproutyIcon name="sprout" size={16} />
                      </span>
                      <div
                        className="coach-bubble coach-typing"
                        aria-label="Plant Buddy đang trả lời"
                      >
                        <i />
                        <i />
                        <i />
                      </div>
                    </div>
                  )}
                </div>

                {/* Only while the reader has scrolled away from the newest turn;
                    the alternative is yanking the thread down under them. */}
                {!atBottom && messages.length > 0 && (
                  <button className="coach-jump" onClick={() => scrollThread('smooth')}>
                    <SproutyIcon name="arrow-down" size={15} />
                    Câu trả lời mới nhất
                  </button>
                )}

                <div className="coach-foot">
                  {/* One row that scrolls sideways, not a block that wraps: the
                      composer below it must keep the same place on screen no
                      matter how many suggestions fit the width. */}
                  <div className="coach-quick">
                    {messages.length > 0 && (
                      <button className="lead" disabled={coachBusy} onClick={() => askCoach()}>
                        <SproutyIcon name="sparkle" size={14} />
                        Xem cây giúp mình
                      </button>
                    )}
                    {QUICK_ASKS.map((q) => (
                      <button key={q} disabled={coachBusy} onClick={() => askCoach(q)}>
                        {q}
                      </button>
                    ))}
                  </div>

                  <div className="coach-input">
                    <input
                      className="form-input"
                      placeholder="Hỏi điều bạn thắc mắc…"
                      maxLength={600}
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && question.trim()) void askCoach(question.trim());
                      }}
                    />
                    <button
                      aria-label="Gửi câu hỏi"
                      disabled={coachBusy || !question.trim()}
                      onClick={() => askCoach(question.trim())}
                    >
                      <SproutyIcon name="arrow-right" size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
