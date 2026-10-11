import { confirmAction } from '@/services/dialog';
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

import { ProductVideos } from '@/components/ProductVideos';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import { SproutyIcon, type IconName } from '@/components/icons/SproutyIcon';
const PlantViewer3D = lazy(() => import('@/components/PlantViewer3D'));
import { GardenStyle, type GardenBenefits } from '@/components/GardenStyle';
import { sceneLook } from '@/components/garden-looks';
import { IotWorkbench, type IotCommand } from '@/components/IotWorkbench';
import { CareGame } from '@/components/CareGame';
import { IotDock, type SensorRead } from '@/components/IotDock';
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

/** Openers for a child who has not thought of a question yet. */
const QUICK_ASKS = ['Tại sao lá bị vàng?', 'Bao lâu nữa cây lớn?', 'Nên bật thiết bị nào?'];

/**
 * The kit's instruction videos, folded away until asked for — like the
 * journal. Open, a player sat in the middle of the care panels and pushed the
 * devices a screen further down for something watched once or twice. The
 * player is only mounted on opening, so nothing streams until then. Hidden
 * entirely when the kit has no videos.
 */
function PlantVideos({
  productId,
  open,
  onToggle,
  onCount,
  anchorRef,
}: {
  productId: number;
  open: boolean;
  onToggle: (open: boolean) => void;
  /** Tells the page how many videos there are, for the shortcut in the hero. */
  onCount: (count: number) => void;
  anchorRef: RefObject<HTMLDivElement | null>;
}) {
  const [summary, setSummary] = useState<{ count: number; totalDurationSec: number } | null>(null);
  useEffect(() => {
    let live = true;
    API.videos
      .summary(productId)
      .then((data: { count: number; totalDurationSec: number }) => {
        if (!live) return;
        setSummary(data);
        onCount(data.count || 0);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [productId, onCount]);
  if (!summary?.count) return null;
  const minutes = Math.round((summary.totalDurationSec || 0) / 60);
  return (
    <div ref={anchorRef} className={`pd-panel pd-log pd-videos${open ? ' open' : ''}`}>
      <button className="pd-log-toggle" aria-expanded={open} onClick={() => onToggle(!open)}>
        <SproutyIcon name="camera" size={20} />
        <span>
          <strong>Video hướng dẫn</strong>
          <em>
            {summary.count} video
            {summary.totalDurationSec ? ` · ${minutes < 1 ? 'dưới 1 phút' : `${minutes} phút`}` : ''}
            {open ? '' : ' · bấm để xem'}
          </em>
        </span>
        <SproutyIcon name="arrow-down" size={18} className="pd-log-chevron" />
      </button>
      {open && (
        <div className="pd-log-body">
          <ProductVideos productId={productId} compact />
        </div>
      )}
    </div>
  );
}

/** Repeated events, one line each with a count — oldest order kept. */
function groupFeed(feed: PlantEvent[]) {
  const out: Array<PlantEvent & { count: number }> = [];
  for (const event of feed) {
    const same = out.find((e) => e.text === event.text && e.level === event.level);
    if (same) same.count += 1;
    else out.push({ ...event, count: 1 });
  }
  return out;
}

export default function PlantDetail() {
  const { plantId = '' } = useParams();
  const navigate = useNavigate();
  const now = useNow();

  const [plant, setPlant] = useState<PlantDetailType | null>(null);
  const [fetchedAt, setFetchedAt] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [careBusy, setCareBusy] = useState<string | null>(null);
  const [deviceBusy, setDeviceBusy] = useState(false);
  const [garden, setGarden] = useState<GardenBenefits | null>(null);
  const [gardenOpen, setGardenOpen] = useState(false);
  const [feed, setFeed] = useState<PlantEvent[]>([]);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  // Opens by itself on a first visit; the "?" button brings it back after that.
  const [guideOpen, closeGuide, openGuide] = useGuideFirstRun();

  // The instruction videos live folded near the bottom; the hero's shortcut
  // opens the fold and brings it into view.
  const [videosOpen, setVideosOpen] = useState(false);
  const [videoCount, setVideoCount] = useState(0);
  const videosRef = useRef<HTMLDivElement>(null);
  function openVideos() {
    setVideosOpen(true);
    requestAnimationFrame(() =>
      videosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }

  // The IoT board and the 3D plant are one kit: what is wired below stands in
  // the pot above, and a reading on the plant opens its part on the board.
  const [connected, setConnected] = useState<string[]>([]);
  const [iotCmd, setIotCmd] = useState<IotCommand | null>(null);
  const iotRef = useRef<HTMLDivElement>(null);
  const sendIot = (kind: IotCommand['kind'], type?: string) =>
    setIotCmd((prev) => ({ kind, type, n: (prev?.n ?? 0) + 1 }));
  function openIot(type?: string) {
    if (type) sendIot('select', type);
    requestAnimationFrame(() => iotRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

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

  async function doCare(action: string): Promise<number | null> {
    if (careBusy) return null;
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
      return Number(data.growth) || 0;
    } catch (err: any) {
      showToast(err?.message || 'Không chăm cây được lúc này.', 'error');
      // A 429 means the cooldown moved under us; refresh so the pill is honest.
      if (err?.status === 429 || err?.status === 409) void load();
      return null;
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
      // the thread would imply Sprouty AI chose not to answer.
      setMessages((prev) => prev.filter((m) => m.id !== pending.id));
      showToast(err?.message || 'Sprouty AI đang nghỉ một chút, thử lại sau nhé.', 'error');
    } finally {
      setCoachBusy(false);
    }
  }

  async function clearCoach() {
    if (!await confirmAction('Xoá toàn bộ lịch sử trò chuyện với Sprouty AI?')) return;
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

  // The parts wired on the board, as they show on the plant.
  const wired = plant.devices.filter((d) => d.unlocked && connected.includes(d.type));
  // What a wired sensor says, in the same words and colours as the rings below.
  const sensorRead = (d: PlantDevice): SensorRead | null => {
    const pct = (v: number) => `${Math.round(v)}%`;
    switch (d.type) {
      case 'moisture_sensor':
        return {
          value: pct(plant.moisture),
          verdict: verdict('moisture', plant.moisture, plant.idealMoisture),
          tone: metricBand(plant.moisture, plant.idealMoisture) as SensorRead['tone'],
          note: `Chặng này cây thích đất ẩm ${plant.idealMoisture[0]}–${plant.idealMoisture[1]}%.`,
        };
      case 'thermo_sensor':
        return {
          value: `${Math.round(plant.environment.temperature)}°C`,
          verdict: verdict('temperature', plant.environment.temperature, plant.idealTemp),
          tone: metricBand(plant.environment.temperature, plant.idealTemp) as SensorRead['tone'],
          note: `Cây thích ${plant.idealTemp[0]}–${plant.idealTemp[1]}°C${d.secondary ? ` · ${d.secondary.label} ${Math.round(d.secondary.value)}${d.secondary.unit}` : ''}.`,
        };
      case 'light_sensor':
        return {
          value: pct(plant.environment.light),
          verdict: verdict('light', plant.environment.light),
          tone: plant.environment.light > 35 || !plant.environment.isDay ? 'good' : 'warn',
        };
      case 'nutrient_sensor':
        return {
          value: pct(plant.nutrient),
          verdict: verdict('nutrient', plant.nutrient),
          tone: plant.nutrient > 45 ? 'good' : plant.nutrient > 28 ? 'warn' : 'bad',
          note: plant.nutrient <= 45 ? 'Kéo bao phân lên cây để bón thêm.' : undefined,
        };
      case 'camera':
        return {
          value: pct(plant.pestRisk),
          verdict: verdict('pest', plant.pestRisk),
          tone: plant.pestRisk < 40 ? 'good' : plant.pestRisk < 58 ? 'warn' : 'bad',
          note: 'Camera soi lá mỗi giờ để tìm sâu bệnh.',
        };
      default:
        return null;
    }
  };

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
              {/* Care happens on the plant itself: the tools sit under the
                  3D model and are dragged onto it. */}
              <CareGame
                disabled={harvested}
                plant={{
                  stage: plant.stage,
                  progress: plant.stageProgress,
                  health: plant.health,
                  form: plant.form,
                  fruitShape: plant.fruitShape,
                  fruitColor: plant.fruitColor,
                  flowerColor: plant.flowerColor,
                }}
                tools={careSlots.map((slot) => {
                  const left = secondsLeftNow(slot, fetchedAt, now);
                  return {
                    action: slot.action,
                    label: slot.label,
                    icon: slot.icon,
                    hint: slot.hint,
                    recommended: slot.action === recommended,
                    wait: formatCountdown(left),
                    state: !slot.allowedInStage
                      ? 'locked'
                      : careBusy === slot.action
                        ? 'busy'
                        : left <= 0
                          ? 'ready'
                          : 'cooldown',
                  };
                })}
                onCare={doCare}>
                <Suspense fallback={<div className="plant-viewer-loading">Đang mở mô hình cây…</div>}><PlantViewer3D
                  stage={plant.stage}
                  progress={plant.stageProgress}
                  health={plant.health}
                  form={plant.form}
                  fruitShape={plant.fruitShape}
                  fruitColor={plant.fruitColor}
                  flowerColor={plant.flowerColor}
                  scene={garden?.scene ?? 'natural'}
                  isNight={!plant.environment.isDay}
                  decoration={garden?.decoration}
                  gadgets={wired.map((d) => ({ type: d.type, on: d.kind === 'sensor' || d.autoMode }))}
                /></Suspense>
                <div className="pd-clock">
                  <SproutyIcon name={garden?.scene === 'night' ? 'moon' : garden && garden.scene !== 'natural' ? 'sparkle' : plant.environment.isDay ? 'sun' : 'moon'} size={17} />
                  {/* A VIP scene is the same place at any hour, so the pill names
                      the scene instead of claiming it is daytime under a night sky. */}
                  {garden && garden.scene !== 'natural'
                    ? sceneLook(garden.scene).label
                    : plant.environment.isDay ? 'Ban ngày' : 'Ban đêm'} ·{' '}
                  {String(Math.floor(plant.environment.hour)).padStart(2, '0')}:
                  {String(Math.round((plant.environment.hour % 1) * 60)).padStart(2, '0')}
                </div>
                {/* The parts wired below, on the plant they measure: readings,
                    switches, wiring in and out, all without leaving the plant. */}
                <IotDock
                  devices={plant.devices}
                  wired={connected}
                  busy={deviceBusy}
                  read={sensorRead}
                  onToggle={toggleDevice}
                  onPlace={(type) => sendIot('place', type)}
                  onPlaceAll={() => sendIot('placeAll')}
                  onRemove={(type) => sendIot('remove', type)}
                  onOpenBoard={openIot}
                />
              </CareGame>
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

              <div className="pd-badges">
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

              {/* Where the plant is now, in one card: the stage, how far
                  through it, and what is happening to it. */}
              <div className="pd-now">
                <div className="pd-now-head">
                  <span>Chặng hiện tại</span>
                  <strong>{plant.stageLabel}</strong>
                  <em>{Math.round(plant.stageProgress)}%</em>
                </div>
                <div className="pd-progress-track">
                  <div className="pd-progress-fill" style={{ width: `${Math.round(plant.stageProgress)}%` }} />
                </div>
                <p>{plant.stageStory}</p>
              </div>

              {/* What to do next, said once, beside the plant it is about. It
                  used to be a banner further down repeating what the care
                  tools already said. */}
              <div className={`pd-todo${harvested ? ' is-done' : ''}`}>
                <span className="pd-todo-icon">
                  <SproutyIcon name={harvested ? 'trophy' : plant.nextStep.icon} size={24} />
                </span>
                <div>
                  <span className="pd-todo-kicker">{harvested ? 'Đã hoàn thành' : 'Việc nên làm'}</span>
                  <strong>
                    {harvested
                      ? `Bạn đã thu hoạch ${plant.harvestLabel}!`
                      : plant.nextStep.label || 'Cây đang tự lớn'}
                  </strong>
                  <p>{harvested ? 'Mở một bộ kit mới để trồng cây khác nhé.' : plant.nextStep.why}</p>
                </div>
              </div>

              <div className="pd-guide-row">
                <button className="guide-open-btn pd-guide-btn" onClick={openGuide}>
                  <SproutyIcon name="info" size={17} />
                  Cây cần gì? Xem hướng dẫn
                </button>
                {videoCount > 0 && (
                  <button className="guide-open-btn pd-guide-btn" onClick={openVideos}>
                    <SproutyIcon name="camera" size={17} />
                    Video hướng dẫn ({videoCount})
                  </button>
                )}
              </div>

              {plant.cultivation && <details className="pd-botanical"><summary>Hồ sơ giống · {plant.speciesLabel}</summary>
                <em>{plant.cultivation.name}</em><p>{plant.cultivation.sow}</p><p>{plant.cultivation.support}</p>
                <p>{plant.cultivation.mature}</p><small>Mô phỏng giáo dục: thời gian và thang độ ẩm được giản lược. Cây thật còn phụ thuộc giống, đất và khí hậu.</small>
              </details>}
            </div>
          </div>

          {/* All eight stages across the full width. Squeezed into the right
              column it scrolled sideways and hid the last stages. */}
          <div className="pd-journey-wrap">
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
          </div>

          {/* ── Garden look ──────────────────────────────────────── */}
          {/* Folded, but right under the plant: a pick shows on the 3D model
              above, so the two have to be on screen together. It stays
              mounted while closed — it loads the scene and pot the model is
              drawn with. */}
          <div className={`pd-panel pd-log pd-garden${gardenOpen ? ' open' : ''}`}>
            <button className="pd-log-toggle" aria-expanded={gardenOpen} onClick={() => setGardenOpen((v) => !v)}>
              <SproutyIcon name="pot" size={20} />
              <span>
                <strong>Trang trí vườn</strong>
                <em>Khung cảnh và chậu cho cây 3D</em>
              </span>
              <SproutyIcon name="arrow-down" size={18} className="pd-log-chevron" />
            </button>
            <div className="pd-log-body" hidden={!gardenOpen}>
              <GardenStyle onChange={setGarden} />
            </div>
          </div>
        </div>
      </div>

      <section className="pd-main">
        <div className="container">
          <div className="pd-cols">
            <div className="pd-col-main">
              {/* ── IoT station ────────────────────────────────────────── */}
              {/* One panel for the readings and the parts that take them. They
                  were two panels saying much the same thing: five rings of
                  sensor values, then a board of sensors showing the same values. */}
              <div className="pd-panel pd-iot" ref={iotRef}>
                <div className="pd-panel-head">
                  <h2>
                    <SproutyIcon name="chart" size={21} /> Trạm IoT
                  </h2>
                  <p>
                    Linh kiện lắp vào bảng mạch sẽ được gắn vào chậu cây ở trên. Xanh là cây đang vui,
                    vàng là hơi mệt, đỏ là cần giúp ngay.
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

                <IotWorkbench
                  plantId={plant.id}
                  devices={[...sensors, ...actuators]}
                  busy={deviceBusy}
                  onToggle={toggleDevice}
                  plantName={plant.nickname}
                  onConnectedChange={setConnected}
                  command={iotCmd}
                />

                <details className="pd-iot-chart">
                  <summary>
                    <SproutyIcon name="chart" size={17} /> Biểu đồ cảm biến 24 giờ
                  </summary>
                  <SensorChart readings={plant.readings} />
                </details>
              </div>

              {/* ── Instruction videos ─────────────────────────────────── */}
              {/* Folded, beside the journal: both are looked up now and then,
                  while care, sensors and devices above are used every visit.
                  The hero's "Video hướng dẫn" button opens it from the top. */}
              <PlantVideos
                productId={plant.productId}
                open={videosOpen}
                onToggle={setVideosOpen}
                onCount={setVideoCount}
                anchorRef={videosRef}
              />

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
                        {groupFeed(feed).map((event, i) => (
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
                            {event.count > 1 && <em className="feed-count">×{event.count}</em>}
                          </li>
                        ))}
                      </ul>
                    )}

                    <ul className="history-list">
                      {plant.history.length === 0 && (
                        <li className="history-empty">Chưa có lần chăm cây nào — kéo một dụng cụ lên cây để bắt đầu.</li>
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
                          {entry.growth > 0 && <em className="history-growth">+{entry.growth.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}</em>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Sprouty AI is pinned to the viewport rather than left to scroll
                away with the page: the questions a child asks are about the
                numbers in the left column, so both have to be readable at the
                same moment. Pinning is also what earns the thread its own
                scrollbar — a panel that never leaves the screen cannot strand
                the wheel the way a mid-page scroller does. */}
            <aside className="pd-col-side">
              <div className="pd-panel coach-panel">
                <header className="coach-head">
                  <span className="coach-avatar">
                    <SproutyIcon name="plant-chat" size={24} />
                  </span>
                  <div className="coach-who">
                    <strong>Sprouty AI</strong>
                    <small className="coach-tagline">Bạn đồng hành chăm cây</small>
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
                        <SproutyIcon name="plant-chat" size={30} />
                      </span>
                      <p>
                        Chào bạn! Mình là <b>Sprouty AI</b>. Mình nhìn được hết cảm biến của{' '}
                        {plant.nickname} và sẽ nói cho bạn biết cây đang cần gì.
                      </p>
                      <button className="coach-ask" onClick={() => askCoach()}>
                        <SproutyIcon name="plant-chat" size={18} />
                        Xem cây giúp mình
                      </button>
                    </div>
                  )}

                  {messages.map((m) => (
                    <div key={m.id} className={`coach-msg coach-msg-${m.role}`}>
                      {m.role === 'assistant' && (
                        <span className="coach-msg-avatar">
                          <SproutyIcon name="plant-chat" size={16} />
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
                        <SproutyIcon name="plant-chat" size={16} />
                      </span>
                      <div
                        className="coach-bubble coach-typing"
                        aria-label="Sprouty AI đang trả lời"
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
                        <SproutyIcon name="plant-chat" size={14} />
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
