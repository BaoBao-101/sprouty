import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { SproutyIcon } from '@/components/icons/SproutyIcon';
import { showToast } from '@/services/toast';
import type { PlantDevice } from '@/types/plant';
import './IotWorkbench.css';

/**
 * "Bàn lắp mạch": the kit's devices as parts on a breadboard.
 *
 * The devices used to be a grid of cards with one switch each. Here, as in
 * Tinkercad, a child drags a part out of the tray onto the board, a wire
 * runs from it to the Sprouty Hub, and only then does it work: a sensor shows
 * its reading once it is wired, an actuator can only be switched on once it
 * is on the board, and pulling it off the board switches it off.
 *
 * What is wired here is also built into the pot of the 3D plant above
 * (`onConnectedChange`), so the board and the plant are one kit.
 *
 * Where each part sits is the child's own arrangement, kept per plant in this
 * browser. What a part does — auto mode — is still the server's, through the
 * same `onToggle` the cards used.
 */

/** What the parts bar on the 3D plant can ask the board to do. */
export type IotCommand = { kind: 'select' | 'place' | 'remove' | 'placeAll'; type?: string; n: number };

type Spot = { x: number; y: number };
type Layout = Record<string, Spot>;

/** Fixed places around the hub, for "Lắp tự động" and tapping a part. */
const SLOTS: Spot[] = [
  { x: 0.13, y: 0.2 }, { x: 0.37, y: 0.14 }, { x: 0.63, y: 0.14 }, { x: 0.87, y: 0.2 },
  { x: 0.13, y: 0.8 }, { x: 0.37, y: 0.86 }, { x: 0.63, y: 0.86 }, { x: 0.87, y: 0.8 },
];
const HUB: Spot = { x: 0.5, y: 0.5 };
const GRID = 0.025;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const snap = (v: number) => Math.round(v / GRID) * GRID;

function storageKey(plantId: string) {
  return `sprouty:iot-layout:${plantId}`;
}
function readLayout(plantId: string): Layout | null {
  try {
    const raw = localStorage.getItem(storageKey(plantId));
    return raw ? (JSON.parse(raw) as Layout) : null;
  } catch {
    return null;
  }
}
function writeLayout(plantId: string, layout: Layout) {
  try {
    localStorage.setItem(storageKey(plantId), JSON.stringify(layout));
  } catch {
    /* Private mode: the arrangement simply is not remembered. */
  }
}

/** A wire from a part to the hub: a soft S-curve, the way jumper wires lie. */
function wirePath(a: Spot, b: Spot, w: number, h: number) {
  const x1 = a.x * w, y1 = a.y * h, x2 = b.x * w, y2 = b.y * h;
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

function value(device: PlantDevice) {
  if (device.reading === null) return null;
  return `${Math.round(device.reading)}${device.unit}`;
}

type Drag = {
  type: string;
  from: 'tray' | 'board';
  startX: number;
  startY: number;
  x: number;
  y: number;
  moved: boolean;
};

export function IotWorkbench({
  plantId,
  devices,
  busy,
  onToggle,
  plantName,
  onConnectedChange,
  command,
}: {
  plantId: string;
  devices: PlantDevice[];
  busy: boolean;
  onToggle: (type: string, next: boolean) => Promise<void> | void;
  /** Shown on the hub: the board is wired to this plant's pot. */
  plantName?: string;
  /** Tells the page which parts are wired, so the 3D plant can show them. */
  onConnectedChange?: (types: string[]) => void;
  /** Something done on the 3D plant, carried out here. `n` makes a repeat count. */
  command?: IotCommand | null;
}) {
  const board = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 500 });
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  dragRef.current = drag;

  const byType = useMemo(() => new Map<string, PlantDevice>(devices.map((d) => [d.type, d])), [devices]);

  // First visit: whatever is already running is already on the board.
  const [layout, setLayout] = useState<Layout>(() => {
    const saved = readLayout(plantId);
    if (saved) return saved;
    const initial: Layout = {};
    devices
      .filter((d) => d.unlocked && d.kind === 'actuator' && d.autoMode)
      .forEach((d, i) => (initial[d.type] = SLOTS[(i + 4) % SLOTS.length]));
    return initial;
  });

  // A part that is no longer unlocked (or no longer exists) leaves the board.
  const placed = useMemo(
    () => Object.entries(layout).filter(([type]) => byType.get(type)?.unlocked),
    [layout, byType],
  );
  const placedSet = useMemo(() => new Set(placed.map(([t]) => t)), [placed]);
  const placedKey = placed.map(([t]) => t).join(',');
  useEffect(() => {
    onConnectedChange?.(placedKey ? placedKey.split(',') : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placedKey]);
  useEffect(() => {
    if (!command) return;
    const { kind, type } = command;
    if (kind === 'select' && type && placedSet.has(type)) setSelected(type);
    else if (kind === 'place' && type && !placedSet.has(type)) place(type, freeSlot(type));
    else if (kind === 'remove' && type && placedSet.has(type)) void remove(type);
    else if (kind === 'placeAll') placeAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command?.n]);

  const tray = devices.filter((d) => d.unlocked && !placedSet.has(d.type));
  const lockedCount = devices.filter((d) => !d.unlocked).length;
  const unlockedCount = devices.filter((d) => d.unlocked).length;

  const save = useCallback(
    (next: Layout) => {
      setLayout(next);
      writeLayout(plantId, next);
    },
    [plantId],
  );

  useEffect(() => {
    const el = board.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** The nearest free fixed place, for parts that are tapped rather than dragged. */
  /**
   * The nearest place to the wanted spot where a part fits without covering another
   * part or the hub. Parts used to land on top of each other wherever they
   * were dropped; now they settle into the closest clear spot, the way parts
   * snap on a real breadboard.
   */
  function findSpot(want: Spot, others: Spot[]): Spot {
    const W = size.w || 800;
    const H = size.h || 500;
    const pw = 100, ph = 108;
    const pts = others.map((o) => ({ x: o.x * W, y: o.y * H }));
    const hub = { x: HUB.x * W, y: HUB.y * H };
    const fits = (x: number, y: number) =>
      x >= pw / 2 + 4 && x <= W - pw / 2 - 4 && y >= ph / 2 + 4 && y <= H - ph / 2 - 4 &&
      pts.every((o) => Math.abs(o.x - x) >= pw || Math.abs(o.y - y) >= ph) &&
      (Math.abs(hub.x - x) >= pw / 2 + 78 || Math.abs(hub.y - y) >= ph / 2 + 48);
    const x0 = clamp(want.x * W, pw / 2 + 4, W - pw / 2 - 4);
    const y0 = clamp(want.y * H, ph / 2 + 4, H - ph / 2 - 4);
    if (fits(x0, y0)) return { x: x0 / W, y: y0 / H };
    for (let r = 12; r < Math.max(W, H); r += 12) {
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2;
        const x = x0 + Math.cos(a) * r;
        const y = y0 + Math.sin(a) * r;
        if (fits(x, y)) return { x: x / W, y: y / H };
      }
    }
    return { x: x0 / W, y: y0 / H };
  }

  function othersThan(type: string) {
    return placed.filter(([t]) => t !== type).map(([, p]) => p);
  }

  /** A clear fixed place, for parts that are tapped rather than dragged. */
  function freeSlot(type = ''): Spot {
    const others = othersThan(type);
    for (const slot of SLOTS) {
      const spot = findSpot(slot, others);
      if (Math.hypot(spot.x - slot.x, spot.y - slot.y) < 0.02) return spot;
    }
    return findSpot({ x: 0.5, y: 0.85 }, others);
  }

  function place(type: string, spot: Spot) {
    const device = byType.get(type);
    if (!device?.unlocked) return;
    const wasPlaced = placedSet.has(type);
    const settled = findSpot({ x: snap(spot.x), y: snap(spot.y) }, othersThan(type));
    save({ ...layout, [type]: settled });
    setSelected(type);
    if (!wasPlaced) {
      showToast(
        device.kind === 'sensor'
          ? `Đã cắm ${device.label} vào chậu — chỉ số hiện trên cây ở trên.`
          : `Đã lắp ${device.label} cho cây. Bấm nút nguồn để bật.`,
        'success',
      );
    }
  }

  async function remove(type: string) {
    const device = byType.get(type);
    const next = { ...layout };
    delete next[type];
    save(next);
    if (selected === type) setSelected(null);
    // A part off the board has no power: it cannot keep running.
    if (device?.kind === 'actuator' && device.autoMode) await onToggle(type, false);
  }

  function placeAll() {
    const next: Layout = Object.fromEntries(placed);
    const taken = Object.values(next);
    let i = 0;
    for (const d of devices) {
      if (!d.unlocked || next[d.type]) continue;
      // Try the fixed places in turn, then anywhere clear.
      let spot: Spot | null = null;
      for (; i < SLOTS.length && !spot; i++) {
        const s = findSpot(SLOTS[i], taken);
        if (Math.hypot(s.x - SLOTS[i].x, s.y - SLOTS[i].y) < 0.02) spot = s;
      }
      spot ??= findSpot({ x: 0.5, y: 0.85 }, taken);
      next[d.type] = spot;
      taken.push(spot);
    }
    save(next);
  }

  async function clearAll() {
    const running = placed.map(([t]) => byType.get(t)).filter((d) => d?.kind === 'actuator' && d.autoMode);
    save({});
    setSelected(null);
    for (const d of running) if (d) await onToggle(d.type, false);
  }

  /* ── Dragging: pointer events, so mouse, pen and touch all work ─────── */

  function startDrag(e: ReactPointerEvent, type: string, from: Drag['from']) {
    const device = byType.get(type);
    if (!device?.unlocked || busy) return;
    e.preventDefault();
    setDrag({ type, from, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, moved: false });
  }

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const moved = d.moved || Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 5;
      setDrag({ ...d, x: e.clientX, y: e.clientY, moved });
    };
    const up = (e: PointerEvent) => {
      const d = dragRef.current;
      setDrag(null);
      if (!d) return;
      const rect = board.current?.getBoundingClientRect();
      const inside =
        rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;

      // A tap, not a drag: select on the board, fit into a free place from the tray.
      if (!d.moved) {
        if (d.from === 'board') setSelected(d.type);
        else place(d.type, freeSlot(d.type));
        return;
      }
      if (inside && rect) {
        place(d.type, { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height });
      } else if (d.from === 'board') {
        void remove(d.type);
        showToast('Đã gỡ linh kiện khỏi bảng mạch.');
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.type, drag?.from]);

  const sel = selected ? byType.get(selected) : null;
  const selPlaced = selected ? placedSet.has(selected) : false;
  const dragDevice = drag?.moved ? byType.get(drag.type) : null;

  // While a part is dragged across the board, show where it will land.
  let ghostOnBoard: Spot | null = null;
  if (drag?.moved && board.current) {
    const r = board.current.getBoundingClientRect();
    if (drag.x >= r.left && drag.x <= r.right && drag.y >= r.top && drag.y <= r.bottom) {
      ghostOnBoard = { x: (drag.x - r.left) / r.width, y: (drag.y - r.top) / r.height };
    }
  }

  return (
    <div className={`iotw${drag?.moved ? ' is-dragging' : ''}`}>
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="iotw-bar">
        <span className="iotw-count">
          <b>{placed.length}</b>/{unlockedCount} linh kiện đã nối
          {placed.length > 0 && !sel && <em> · bấm vào linh kiện để xem, kéo ra ngoài để gỡ</em>}
        </span>
        <div className="iotw-bar-actions">
          <button type="button" className="iotw-btn" onClick={placeAll} disabled={placed.length >= unlockedCount}>
            <SproutyIcon name="bolt" size={15} /> Lắp tự động
          </button>
          <button type="button" className="iotw-btn" onClick={() => void clearAll()} disabled={!placed.length || busy}>
            <SproutyIcon name="return" size={15} /> Gỡ hết
          </button>
        </div>
      </div>

      {/* ── Parts tray ──────────────────────────────────────────────────── */}
      {(tray.length > 0 || lockedCount > 0) && (
        <div className="iotw-tray" aria-label="Khay linh kiện">
          {tray.length === 0 && <span className="iotw-tray-empty">Đã nối hết linh kiện.</span>}
          {tray.map((d) => (
            <button
              type="button"
              key={d.type}
              className={`iotw-part-chip${drag?.type === d.type && drag.moved ? ' is-lifted' : ''}`}
              onPointerDown={(e) => startDrag(e, d.type, 'tray')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  place(d.type, freeSlot(d.type));
                }
              }}
              title={`Kéo ${d.label} vào bảng mạch (hoặc bấm để lắp)`}
            >
              <span className={`iotw-chip-icon is-${d.kind}`}>
                <SproutyIcon name={d.icon} size={18} />
              </span>
              <span className="iotw-chip-text">
                <strong>{d.label}</strong>
                <em>{d.kind === 'sensor' ? 'Cảm biến' : 'Thiết bị'}</em>
              </span>
            </button>
          ))}
          {lockedCount > 0 && (
            <span className="iotw-locked-note">
              <SproutyIcon name="lock" size={14} /> +{lockedCount} linh kiện mở khi cây lớn hơn
            </span>
          )}
        </div>
      )}

      {/* ── Board ───────────────────────────────────────────────────────── */}
      <div
        ref={board}
        className={`iotw-board${ghostOnBoard ? ' is-target' : ''}`}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) setSelected(null);
        }}
      >
        <svg className="iotw-wires" width={size.w} height={size.h} aria-hidden="true">
          {placed.map(([type, spot]) => {
            const d = byType.get(type)!;
            const live = d.kind === 'sensor' ? true : d.autoMode;
            const lifted = drag?.type === type && drag.moved;
            return (
              <path
                key={type}
                d={wirePath(spot, HUB, size.w, size.h)}
                className={`iotw-wire is-${d.kind}${live ? ' is-live' : ''}${lifted ? ' is-lifted' : ''}`}
              />
            );
          })}
          {ghostOnBoard && dragDevice && (
            <path d={wirePath(ghostOnBoard, HUB, size.w, size.h)} className="iotw-wire is-ghost" />
          )}
        </svg>

        <div className="iotw-hub" style={{ left: `${HUB.x * 100}%`, top: `${HUB.y * 100}%` }}>
          <span className="iotw-hub-led" />
          <SproutyIcon name="pot" size={24} />
          <strong>SPROUTY HUB</strong>
          {plantName && <span className="iotw-hub-plant">gắn vào chậu {plantName}</span>}
          <em>{placed.length} kết nối</em>
        </div>

        {placed.length === 0 && !drag?.moved && (
          <div className="iotw-hint">
            <SproutyIcon name="arrow-down" size={18} />
            Kéo linh kiện từ khay vào đây để nối với Hub
          </div>
        )}

        {placed.map(([type, spot]) => {
          const d = byType.get(type)!;
          const lifted = drag?.type === type && drag.moved;
          const reading = value(d);
          return (
            <div
              key={type}
              role="button"
              tabIndex={0}
              aria-pressed={selected === type}
              aria-label={`${d.label}${reading ? `: ${reading}` : ''}`}
              className={`iotw-part is-${d.kind}${selected === type ? ' is-selected' : ''}${d.autoMode ? ' is-on' : ''}${lifted ? ' is-lifted' : ''}${d.battery < 20 ? ' is-low' : ''}`}
              style={{ left: `${spot.x * 100}%`, top: `${spot.y * 100}%` }}
              onPointerDown={(e) => startDrag(e, type, 'board')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setSelected(type);
                if (e.key === 'Delete' || e.key === 'Backspace') void remove(type);
              }}
            >
              <span className="iotw-part-icon">
                <SproutyIcon name={d.icon} size={22} />
              </span>
              <span className="iotw-part-label">{d.label}</span>
              {d.kind === 'sensor' ? (
                <span className="iotw-part-value">{reading ?? 'Đang đọc'}</span>
              ) : (
                <button
                  type="button"
                  className="iotw-power"
                  aria-label={d.autoMode ? `Tắt ${d.label}` : `Bật ${d.label}`}
                  disabled={busy}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    void onToggle(type, !d.autoMode);
                  }}
                >
                  <span /> {d.autoMode ? 'BẬT' : 'TẮT'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* The part under the pointer, following it from the tray. */}
      {dragDevice && drag && !ghostOnBoard && (
        <div className="iotw-ghost" style={{ left: drag.x, top: drag.y }}>
          <SproutyIcon name={dragDevice.icon} size={22} />
          {drag.from === 'board' ? 'Thả ra ngoài để gỡ' : dragDevice.label}
        </div>
      )}
      {dragDevice && drag && ghostOnBoard && (
        <div className="iotw-ghost is-over" style={{ left: drag.x, top: drag.y }}>
          <SproutyIcon name={dragDevice.icon} size={22} />
          Thả để nối vào Hub
        </div>
      )}

      {/* ── Inspector ───────────────────────────────────────────────────── */}
      {sel && (
        <div className="iotw-inspector" aria-live="polite">
          <span className={`iotw-chip-icon is-${sel.kind} is-big`}>
            <SproutyIcon name={sel.icon} size={24} />
          </span>
          <div className="iotw-insp-main">
            <div className="iotw-insp-title">
              <strong>{sel.label}</strong>
              <span className={`iotw-tag is-${sel.kind}`}>{sel.kind === 'sensor' ? 'Cảm biến' : 'Thiết bị'}</span>
              {selPlaced && <span className="iotw-tag is-ok">Đã nối Hub</span>}
            </div>
            <p>{sel.about}</p>
            <div className="iotw-insp-stats">
              {value(sel) && (
                <span>
                  Chỉ số <b>{value(sel)}</b>
                  {sel.secondary && (
                    <>
                      {' '}· {sel.secondary.label} <b>{Math.round(sel.secondary.value)}{sel.secondary.unit}</b>
                    </>
                  )}
                </span>
              )}
              <span className={sel.battery < 20 ? 'is-low' : ''}>
                <SproutyIcon name="battery" size={14} /> Pin <b>{Math.round(sel.battery)}%</b>
              </span>
            </div>
          </div>
          <div className="iotw-insp-actions">
            {sel.kind === 'actuator' && selPlaced && (
              <button
                type="button"
                className={`btn btn-sm ${sel.autoMode ? 'btn-outline' : 'btn-primary'}`}
                disabled={busy}
                onClick={() => void onToggle(sel.type, !sel.autoMode)}
              >
                {sel.autoMode ? 'Tắt tự động' : 'Bật tự động'}
              </button>
            )}
            {selPlaced ? (
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void remove(sel.type)}>
                Gỡ khỏi bảng
              </button>
            ) : (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => place(sel.type, freeSlot(sel.type))}>
                Lắp vào bảng
              </button>
            )}
          </div>
          <button type="button" className="iotw-insp-close" aria-label="Đóng" onClick={() => setSelected(null)}>
            <SproutyIcon name="close" size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
