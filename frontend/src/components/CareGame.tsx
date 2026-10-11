import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { SproutyIcon, type IconName } from '@/components/icons/SproutyIcon';
import { PlantArt, type PlantStageId } from '@/components/PlantArt';
import type { FruitShape, PlantForm } from '@/components/PlantForms';
import type { CareActionId } from '@/types/plant';
import './CareGame.css';

/**
 * Caring for the plant as a little game.
 *
 * It was a grid of buttons: tap "Tưới nước", get a toast. Now the tools hang
 * on a belt under the plant. The child drags one onto the plant and holds it
 * there while a ring fills — about a second, the length of a real pour — and
 * then sees it happen: water falls, mist drifts, granules scatter, the sun
 * comes out, the magnifier sweeps for pests. Letting go early does nothing
 * but say "giữ lâu hơn chút". Tapping a tool still works, for a keyboard or
 * a child who has not found the drag yet.
 *
 * The rules are untouched: which tools are ready, the cooldowns and the points
 * all come from the server through `onCare`, exactly as the buttons did.
 */

export interface CareTool {
  action: CareActionId;
  label: string;
  icon: IconName;
  hint: string;
  state: 'ready' | 'cooldown' | 'locked' | 'busy';
  /** "2 giờ 10 phút" while cooling down. */
  wait: string;
  recommended: boolean;
}

/** How long a tool has to stay on the plant. */
const HOLD_MS = 900;
/** How long the effect plays before the result comes back. */
const EFFECT_MS = 1400;

/** What each tool does to the scene. */
const EFFECT: Record<string, { kind: string; count: number; verb: string }> = {
  water: { kind: 'drop', count: 18, verb: 'Đang tưới…' },
  mist: { kind: 'mist', count: 22, verb: 'Đang phun sương…' },
  fertilize: { kind: 'grain', count: 20, verb: 'Đang bón phân…' },
  sunlight: { kind: 'ray', count: 10, verb: 'Đang đón nắng…' },
  pest_check: { kind: 'sweep', count: 1, verb: 'Đang soi lá…' },
  prune: { kind: 'snip', count: 6, verb: 'Đang tỉa lá…' },
  loosen_soil: { kind: 'dust', count: 14, verb: 'Đang xới đất…' },
  pollinate: { kind: 'pollen', count: 16, verb: 'Đang thụ phấn…' },
  harvest: { kind: 'star', count: 14, verb: 'Đang thu hoạch…' },
};

type Drag = { action: CareActionId; x: number; y: number; startX: number; startY: number; moved: boolean };

/** "3 giờ 59 phút" → "3g59p", "12 phút 05s" → "12p": a badge on a small tool. */
function shortWait(wait: string) {
  const h = wait.match(/(\d+) giờ (\d+) phút/);
  if (h) return `${h[1]}g${h[2]}p`;
  const m = wait.match(/(\d+) phút/);
  if (m) return `${m[1]}p`;
  return wait;
}

export function CareGame({
  tools,
  plant,
  disabled,
  onCare,
  children,
}: {
  tools: CareTool[];
  plant: {
    stage: string;
    progress: number;
    health: number;
    form: PlantForm;
    fruitShape: FruitShape;
    fruitColor: string;
    flowerColor: string;
  };
  disabled: boolean;
  /** Does the care on the server; resolves with the points gained, or null. */
  onCare: (action: CareActionId) => Promise<number | null>;
  /**
   * The plant to drop tools on — the page's 3D model. Without it the game
   * draws its own little garden, but a page with both showed two plants.
   */
  children?: ReactNode;
}) {
  const zone = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  dragRef.current = drag;
  const [hold, setHold] = useState(0); // 0..1 while a tool is over the plant
  const holdStart = useRef<number | null>(null);
  const [playing, setPlaying] = useState<{ action: CareActionId; key: number } | null>(null);
  const [gain, setGain] = useState<{ text: string; key: number } | null>(null);
  const [nudge, setNudge] = useState('');
  const committed = useRef(false);

  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  async function run(action: CareActionId) {
    if (playing || disabled) return;
    const key = Date.now();
    setPlaying({ action, key });
    setNudge('');
    const [growth] = await Promise.all([
      onCare(action),
      new Promise((r) => setTimeout(r, reduced ? 200 : EFFECT_MS)),
    ]);
    setPlaying(null);
    if (growth !== null && growth !== undefined) {
      setGain({
        text: growth > 0 ? `+${growth.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} điểm phát triển` : 'Cây đã được chăm',
        key,
      });
      setTimeout(() => setGain((g) => (g?.key === key ? null : g)), 2200);
    }
  }

  function overZone(x: number, y: number) {
    const r = zone.current?.getBoundingClientRect();
    return Boolean(r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
  }

  function start(e: ReactPointerEvent, tool: CareTool) {
    if (tool.state !== 'ready' || disabled || playing) return;
    e.preventDefault();
    committed.current = false;
    holdStart.current = null;
    setHold(0);
    setDrag({ action: tool.action, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: false });
  }

  // Follow the pointer; fill the ring while the tool stays on the plant.
  useEffect(() => {
    if (!drag) return;
    let frame = 0;
    const tick = () => {
      const d = dragRef.current;
      if (!d || committed.current) return;
      if (d.moved && overZone(d.x, d.y)) {
        holdStart.current ??= performance.now();
        const p = Math.min(1, (performance.now() - holdStart.current) / HOLD_MS);
        setHold(p);
        if (p >= 1) {
          committed.current = true;
          setDrag(null);
          setHold(0);
          void run(d.action);
          return;
        }
      } else {
        holdStart.current = null;
        setHold(0);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      setDrag({ ...d, x: e.clientX, y: e.clientY, moved: d.moved || Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 6 });
    };
    const up = () => {
      const d = dragRef.current;
      cancelAnimationFrame(frame);
      setDrag(null);
      setHold(0);
      if (!d || committed.current) return;
      // A tap: just do it.
      if (!d.moved) return void run(d.action);
      if (overZone(d.x, d.y)) setNudge('Giữ dụng cụ trên cây lâu hơn chút, đến khi vòng tròn đầy.');
      else setNudge('Kéo dụng cụ thả lên cây nhé.');
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.action]);

  const dragTool = drag ? tools.find((t) => t.action === drag.action) : null;
  const over = Boolean(drag?.moved && overZone(drag.x, drag.y));
  const effect = playing ? EFFECT[playing.action] ?? EFFECT.water : null;
  const playingTool = playing ? tools.find((t) => t.action === playing.action) : null;
  const rec = tools.find((t) => t.recommended && t.state === 'ready');
  const lockedCount = tools.filter((t) => t.state === 'locked').length;

  return (
    <div className={`cg${drag?.moved ? ' is-dragging' : ''}`}>
      {/* ── The garden ────────────────────────────────────────────────── */}
      <div
        ref={zone}
        className={`cg-scene${children ? ' has-stage' : ''}${over ? ' is-over' : ''}${playing ? ` is-playing is-${playing.action}` : ''}`}
      >
        {children ?? (<>
        <div className="cg-sky" aria-hidden="true">
          <span className="cg-cloud c1" />
          <span className="cg-cloud c2" />
        </div>
        <div className="cg-ground" aria-hidden="true" />

        <div className={`cg-plant${playing ? ` is-${playing.action}` : ''}`}>
          <PlantArt
            stage={plant.stage as PlantStageId}
            progress={plant.progress}
            health={plant.health}
            form={plant.form}
            fruitShape={plant.fruitShape}
            fruitColor={plant.fruitColor}
            flowerColor={plant.flowerColor}
            size={300}
            bare
          />
        </div>
        </>)}

        {/* Where to drop, and how long is left to hold. */}
        {drag?.moved && (
          <div className={`cg-target${over ? ' is-over' : ''}`} aria-hidden="true">
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" className="cg-target-track" />
              <circle
                cx="50"
                cy="50"
                r="44"
                className="cg-target-fill"
                style={{ strokeDasharray: `${hold * 276.5} 276.5` }}
              />
            </svg>
            <span>{over ? 'Giữ yên…' : 'Thả vào cây'}</span>
          </div>
        )}

        {/* The effect: particles over the plant while the server answers. */}
        {effect && playing && !reduced && (
          <div className={`cg-fx fx-${effect.kind}`} key={playing.key} aria-hidden="true">
            {Array.from({ length: effect.count }, (_, i) => (
              <i
                key={i}
                style={{
                  left: `${30 + ((i * 37) % 40)}%`,
                  animationDelay: `${(i % 8) * 0.09}s`,
                  ['--dx' as string]: `${((i * 53) % 60) - 30}px`,
                }}
              />
            ))}
          </div>
        )}

        {playing && (
          <div className="cg-status" role="status">
            {playingTool && <SproutyIcon name={playingTool.icon} size={16} />}
            {effect?.verb}
          </div>
        )}
        {gain && (
          <div className="cg-gain" key={gain.key} role="status">
            <SproutyIcon name="sparkle" size={16} /> {gain.text}
          </div>
        )}

        {!children && !drag && !playing && !gain && (
          <div className="cg-tip">
            {rec ? (
              <>
                <SproutyIcon name={rec.icon} size={15} /> Cây đang cần <b>{rec.label.toLowerCase()}</b> — kéo dụng cụ lên cây
              </>
            ) : (
              <>Kéo một dụng cụ lên cây và giữ yên đến khi vòng tròn đầy</>
            )}
          </div>
        )}
      </div>

      {/* ── The tool tray ─────────────────────────────────────────────── */}
      {/* One header line holds the how-to (or a nudge in its place) and the
          count of tools still to come; the tools sit in a single row. Each
          used to be a big card saying "Sẵn sàng", in two rows, with a line
          of text above and another below. */}
      <div className="cg-tray">
        {(nudge || children || lockedCount > 0) && (
          <div className="cg-tray-head">
            {nudge ? (
              <p className="cg-nudge">{nudge}</p>
            ) : (
              children && <p className="cg-howto">Kéo dụng cụ lên cây, giữ yên đến khi vòng tròn đầy</p>
            )}
            {lockedCount > 0 && (
              <span className="cg-more" title={`${lockedCount} việc chăm nữa sẽ mở khi cây lớn hơn`}>
                <SproutyIcon name="lock" size={12} /> {lockedCount} việc sắp mở
              </span>
            )}
          </div>
        )}
        <div className="cg-belt" role="list" aria-label="Dụng cụ chăm cây">
          {tools.filter((t) => t.state !== 'locked').map((t) => (
            <button
              type="button"
              role="listitem"
              key={t.action}
              className={`cg-tool is-${t.state}${t.recommended && t.state === 'ready' ? ' is-rec' : ''}${drag?.action === t.action && drag.moved ? ' is-lifted' : ''}${playing?.action === t.action ? ' is-using' : ''}`}
              disabled={t.state !== 'ready' || disabled || Boolean(playing)}
              onPointerDown={(e) => start(e, t)}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && t.state === 'ready') {
                  e.preventDefault();
                  void run(t.action);
                }
              }}
              title={t.state === 'cooldown' ? `${t.label}: còn ${t.wait}` : t.hint}
              aria-label={`${t.label}${t.state === 'ready' ? '' : t.state === 'locked' ? ' (chưa tới lúc)' : ` (còn ${t.wait})`}`}
            >
              {t.recommended && t.state === 'ready' && <span className="cg-flag">Nên làm</span>}
              <span className="cg-tool-icon">
                <SproutyIcon name={t.state === 'locked' ? 'lock' : t.icon} size={22} />
                {/* Ready is the normal look; only waiting says anything. */}
                {t.state === 'cooldown' && <span className="cg-tool-wait">{shortWait(t.wait)}</span>}
                {t.state === 'busy' && <span className="cg-tool-wait">…</span>}
              </span>
              <span className="cg-tool-label">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* The tool, following the pointer. */}
      {dragTool && drag?.moved && (
        <div className={`cg-ghost${over ? ' is-over' : ''}`} style={{ left: drag.x, top: drag.y }} aria-hidden="true">
          <SproutyIcon name={dragTool.icon} size={34} />
        </div>
      )}
    </div>
  );
}
