import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, PanResponder, StyleSheet, Text, View, useWindowDimensions, type HostInstance } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { fonts } from '@/theme';
import { CareActor, EFFECT_MS } from './CareActors';
import { Icon, type IconName } from './Icon';
import { cheer, tap } from './ui';

/*
 * Caring for the plant as a little game, the same as the website's
 * (frontend/src/components/CareGame.tsx and .css). The tools sit on a belt
 * right under the plant. The child drags one onto the plant and holds it
 * there while a ring fills — about a second — then watches the tool do the
 * job (CareActors); letting go early only says "giữ lâu hơn chút". Tapping a
 * tool still works. Which tools are ready, the cooldowns and the points all
 * come from the server via `onCare`.
 */

export interface CareTool {
  action: string;
  label: string;
  icon: IconName;
  state: 'ready' | 'cooldown' | 'locked' | 'busy';
  /** "2 giờ 10 phút" while cooling down. */
  wait: string;
  recommended: boolean;
  /** When the tool is one of the stage's tasks: how many times done of how many. */
  task?: { done: number; need: number };
}

/** How long a tool has to stay on the plant. */
const HOLD_MS = 900;

/** What the status line says while each tool works. */
const VERB: Record<string, string> = {
  water: 'Đang tưới…', mist: 'Đang phun sương…', fertilize: 'Đang bón phân…', sunlight: 'Đang đón nắng…',
  pest_check: 'Đang soi lá…', prune: 'Đang tỉa lá…', loosen_soil: 'Đang xới đất…', pollinate: 'Đang thụ phấn…', harvest: 'Đang thu hoạch…',
};

// The website's colours (frontend/src/styles/style.css).
const C = {
  p100: '#ECF9E8', p300: '#7BC96F', p500: '#35A853', p600: '#2E8447',
  orange: '#FF9F1C', ink2: '#34513A', ink3: '#5E7662', ink4: '#8CA591', parchment2: '#BBF7D0',
};

/** "3 giờ 59 phút" → "3g59p", "12 phút" → "12p", "40 giây" → "40s": a badge on a small tool. */
function shortWait(wait: string) {
  const h = wait.match(/(\d+) giờ (\d+) phút/);
  if (h) return `${h[1]}g${h[2]}p`;
  const m = wait.match(/(\d+) phút/);
  if (m) return `${m[1]}p`;
  const sec = wait.match(/(\d+) giây/);
  if (sec) return `${sec[1]}s`;
  return wait;
}

type Drag = { action: string; startX: number; startY: number; x: number; y: number; moved: boolean };

/* ── One tool on the belt ──────────────────────────────────────────────── */

function ToolButton({ tool, width, enabled, lifted, using, onStart, onMove, onEnd, onTap }: {
  tool: CareTool; width: number; enabled: boolean; lifted: boolean; using: boolean;
  onStart: (x: number, y: number) => void; onMove: (x: number, y: number) => void; onEnd: (cancelled: boolean) => void; onTap: () => void;
}) {
  // The responder is made once; it calls whatever the latest handlers are.
  const latest = useRef({ enabled, onStart, onMove, onEnd });
  latest.current = { enabled, onStart, onMove, onEnd };
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => latest.current.enabled,
    onMoveShouldSetPanResponder: () => latest.current.enabled,
    // A tool in hand keeps the finger: the page does not scroll from under it.
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
    onPanResponderGrant: (e) => latest.current.onStart(e.nativeEvent.pageX, e.nativeEvent.pageY),
    onPanResponderMove: (e) => latest.current.onMove(e.nativeEvent.pageX, e.nativeEvent.pageY),
    onPanResponderRelease: () => latest.current.onEnd(false),
    onPanResponderTerminate: () => latest.current.onEnd(true),
  })).current;

  const rec = tool.recommended && tool.state === 'ready';
  const resting = tool.state === 'cooldown' || tool.state === 'locked';
  const done = tool.task && tool.task.done >= tool.task.need;
  return (
    // Not flattened away: the native view must exist to keep the page from scrolling during a drag.
    <View {...pan.panHandlers} collapsable={false} accessible accessibilityRole="button" onAccessibilityTap={() => enabled && onTap()}
      accessibilityState={{ disabled: !enabled }}
      accessibilityLabel={`${tool.label}${tool.state === 'ready' ? '' : ` (còn ${tool.wait})`}${tool.task ? `, nhiệm vụ ${tool.task.done}/${tool.task.need}` : ''}`}
      style={[s.tool, { width }, rec && { borderColor: C.orange }, using && { borderColor: C.p500 }, resting && s.toolResting, lifted && { opacity: 0.35 }]}>
      {rec && <View style={s.flag}><Text style={s.flagText}>Nên làm</Text></View>}
      <View style={[s.toolIcon, rec && { backgroundColor: '#FFF4E5' }, resting && { backgroundColor: 'rgba(0, 0, 0, 0.05)' }]}>
        <Icon name={tool.icon} size={22} color={rec ? '#C2410C' : resting ? C.ink4 : C.p600} />
        {/* Ready is the normal look; only waiting says anything. */}
        {/* Wider than the icon it hangs from, so "3g59p" stays on one line. */}
        {(tool.state === 'cooldown' || tool.state === 'busy') && (
          <View style={s.waitRow}>
            <View style={s.wait}><Text numberOfLines={1} style={s.waitText}>{tool.state === 'busy' ? '…' : shortWait(tool.wait)}</Text></View>
          </View>
        )}
      </View>
      <Text numberOfLines={2} style={[s.toolLabel, resting && { color: C.ink4 }]}>{tool.label}</Text>
      {tool.task && (
        <View style={s.dots}>
          {Array.from({ length: tool.task.need }, (_, i) => (
            <View key={i} style={[s.dot, i < tool.task!.done && s.dotOn, done && s.dotDone]} />
          ))}
        </View>
      )}
    </View>
  );
}

/** "+3 điểm phát triển", rising and fading over the plant (cg-float). */
function Gain({ text }: { text: string }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 2200, easing: Easing.bezier(0, 0, 0.58, 1), useNativeDriver: true }).start();
  }, [t]);
  return (
    <Animated.View style={[s.pill, s.gain, {
      opacity: t.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] }),
      transform: [{ translateY: t.interpolate({ inputRange: [0, 0.15, 1], outputRange: [10, 0, -30] }) }],
    }]}>
      <Icon name="sparkle" size={16} color="#fff" />
      <Text style={s.gainText}>{text}</Text>
    </Animated.View>
  );
}

/* ── The game ──────────────────────────────────────────────────────────── */

/**
 * The plant (`children`, the 3D model) with the care tools right under it.
 * `width`×`height` is the plant's box, which is also where tools are dropped.
 */
export function CareGame({ tools, disabled, onCare, onDragChange, onPlayingChange, fruitColor, sun, width, height, children }: {
  tools: CareTool[];
  disabled: boolean;
  onCare: (action: string) => Promise<number | null>;
  /** Tells the page a tool is being dragged, so it stops scrolling. */
  onDragChange?: (dragging: boolean) => void;
  /** Tells the page a tool is at work, so it can clear the top of the picture for the status line. */
  onPlayingChange?: (playing: boolean) => void;
  fruitColor?: string;
  /** Where the garden scene painted its sun, for "Đưa ra nắng". */
  sun?: { x: number; y: number; deg: number };
  width: number;
  height: number;
  children: ReactNode;
}) {
  const window = useWindowDimensions();
  const phone = window.width <= 640;
  const root = useRef<HostInstance>(null);
  const zone = useRef<HostInstance>(null);
  const origin = useRef({ x: 0, y: 0 });
  const rect = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const dragRef = useRef<Drag | null>(null);
  const holdStart = useRef<number | null>(null);
  const committed = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [over, setOver] = useState(false);
  const [hold, setHold] = useState(0);
  const [playing, setPlaying] = useState<{ action: string; key: number } | null>(null);
  const [gain, setGain] = useState<{ text: string; key: number } | null>(null);
  const [nudge, setNudge] = useState('');

  useEffect(() => () => clearInterval(timer.current), []);
  useEffect(() => { onPlayingChange?.(Boolean(playing)); }, [playing, onPlayingChange]);

  const inside = (x: number, y: number) => {
    const r = rect.current;
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  };

  async function run(action: string) {
    if (playing || disabled) return;
    const key = Date.now();
    tap();
    setPlaying({ action, key });
    setNudge('');
    // The server answers while the tool is still at work; the points show once it is done.
    const [growth] = await Promise.all([onCare(action), new Promise((r) => setTimeout(r, EFFECT_MS))]);
    setPlaying(null);
    if (growth !== null && growth !== undefined) {
      if (growth > 0) cheer();
      setGain({ text: growth > 0 ? `+${growth.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} điểm phát triển` : 'Cây đã được chăm', key });
      setTimeout(() => setGain((g) => (g?.key === key ? null : g)), 2200);
    }
  }

  function stop() {
    clearInterval(timer.current);
    dragRef.current = null;
    setDrag(null);
    setOver(false);
    setHold(0);
    onDragChange?.(false);
  }

  function start(action: string, x: number, y: number) {
    committed.current = false;
    holdStart.current = null;
    root.current?.measureInWindow((rx, ry) => { origin.current = { x: rx, y: ry }; });
    zone.current?.measureInWindow((zx, zy, zw, zh) => { rect.current = { x: zx, y: zy, w: zw, h: zh }; });
    const d = { action, startX: x, startY: y, x, y, moved: false };
    dragRef.current = d;
    setDrag(d);
    setNudge('');
    onDragChange?.(true);
    clearInterval(timer.current);
    // Fill the ring while the tool stays on the plant.
    timer.current = setInterval(() => {
      const cur = dragRef.current;
      if (!cur || committed.current) return;
      const isOver = cur.moved && inside(cur.x, cur.y);
      setOver(isOver);
      if (!isOver) { holdStart.current = null; setHold(0); return; }
      holdStart.current ??= Date.now();
      const p = Math.min(1, (Date.now() - holdStart.current) / HOLD_MS);
      setHold(p);
      if (p >= 1) {
        committed.current = true;
        stop();
        void run(cur.action);
      }
    }, 32);
  }

  function move(x: number, y: number) {
    const d = dragRef.current;
    if (!d) return;
    const next = { ...d, x, y, moved: d.moved || Math.hypot(x - d.startX, y - d.startY) > 6 };
    dragRef.current = next;
    setDrag(next);
  }

  function end(cancelled: boolean) {
    const d = dragRef.current;
    const wasOver = Boolean(d && d.moved && inside(d.x, d.y));
    stop();
    if (!d || committed.current) return;
    if (!d.moved && !cancelled) return void run(d.action); // a tap: just do it
    if (d.moved) setNudge(wasOver ? 'Giữ dụng cụ trên cây lâu hơn chút, đến khi vòng tròn đầy.' : 'Kéo dụng cụ thả lên cây nhé.');
  }

  const belt = tools.filter((t) => t.state !== 'locked');
  const lockedCount = tools.length - belt.length;
  // The belt as the website lays it out: on a phone a grid of tools at least
  // 62 wide; wider, one centred row of tools up to 84 wide.
  const inner = width - 2 * 10 - 2 * 1.5;
  const cols = phone ? Math.max(1, Math.floor((inner + 6) / (62 + 6))) : belt.length;
  const toolW = phone
    ? Math.floor((inner - 6 * (cols - 1)) / cols)
    : Math.min(84, Math.floor((inner - 6 * (belt.length - 1)) / Math.max(1, belt.length)));
  const dragTool = drag ? tools.find((t) => t.action === drag.action) : null;
  const playingTool = playing ? tools.find((t) => t.action === playing.action) : null;
  const ring = 276.5;

  return (
    <View ref={root} style={{ width, alignSelf: 'center', gap: 12 }}>
      <View ref={zone} style={{ width, height }}>
        {children}
        {over && <View pointerEvents="none" style={s.overGlow} />}
        <View pointerEvents="none" style={[s.frame, over && { borderColor: C.p500 }]} />

        {/* Where to drop, and how long is left to hold. */}
        {drag?.moved && (
          <View pointerEvents="none" style={[s.target, { left: width / 2 - 75, top: height / 2 - 75 }]}>
            <Svg width={150} height={150} viewBox="0 0 100 100" style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
              <Circle cx={50} cy={50} r={44} fill="rgba(255, 255, 255, 0.35)" stroke={over ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.9)'}
                strokeWidth={5} strokeDasharray={over ? undefined : '6 8'} />
              <Circle cx={50} cy={50} r={44} fill="none" stroke={C.p500} strokeWidth={7} strokeLinecap="round" strokeDasharray={`${hold * ring} ${ring}`} />
            </Svg>
            <Text style={s.targetText}>{over ? 'Giữ yên…' : 'Thả vào cây'}</Text>
          </View>
        )}

        {/* The tool doing the job over the plant while the server answers. */}
        {playing && <CareActor key={playing.key} action={playing.action} fruitColor={fruitColor} sun={sun} w={width} h={height} k={phone ? 0.76 : 1} />}

        {playing && (
          <View pointerEvents="none" style={[s.pillRow, { top: 14 }]}>
            <View style={s.pill}>
              {playingTool && <Icon name={playingTool.icon} size={16} color={C.p600} />}
              <Text style={s.statusText}>{VERB[playing.action] ?? 'Đang chăm cây…'}</Text>
            </View>
          </View>
        )}
        {gain && (
          <View pointerEvents="none" style={[s.pillRow, { top: 0.38 * height }]}>
            <Gain key={gain.key} text={gain.text} />
          </View>
        )}
      </View>

      {/* The tool tray: a header line with the how-to (or a nudge in its place) and the count still to come, then the tools. */}
      {belt.length > 0 && (
        <View style={s.tray}>
          <View style={s.head}>
            <Text style={[s.howto, nudge ? { color: '#B45309' } : null]}>{nudge || 'Kéo dụng cụ lên cây, giữ yên đến khi vòng tròn đầy'}</Text>
            {lockedCount > 0 && (
              <View style={s.more}><Icon name="lock" size={12} color={C.ink4} /><Text style={s.moreText}>{lockedCount} việc sắp mở</Text></View>
            )}
          </View>
          <View style={[s.belt, !phone && { flexWrap: 'nowrap', justifyContent: 'center' }]}>
            {belt.map((t) => (
              <ToolButton key={t.action} tool={t} width={toolW}
                enabled={t.state === 'ready' && !disabled && !playing}
                lifted={Boolean(drag?.moved && drag.action === t.action)} using={playing?.action === t.action}
                onStart={(x, y) => start(t.action, x, y)} onMove={move} onEnd={end} onTap={() => void run(t.action)} />
            ))}
          </View>
        </View>
      )}

      {/* The tool, following the finger. */}
      {dragTool && drag?.moved && (
        <View pointerEvents="none" style={[s.ghost, over && s.ghostOver, { left: drag.x - origin.current.x - 32, top: drag.y - origin.current.y - 38 }]}>
          <Icon name={dragTool.icon} size={34} color={C.p600} />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  frame: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 22, borderWidth: 2, borderColor: '#D5E3C8' },
  overGlow: { position: 'absolute', top: -5, left: -5, right: -5, bottom: -5, borderRadius: 27, borderWidth: 5, borderColor: 'rgba(53, 168, 83, 0.15)' },
  target: { position: 'absolute', width: 150, height: 150, alignItems: 'center' },
  targetText: {
    position: 'absolute', top: 128, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, overflow: 'hidden', backgroundColor: 'rgba(255, 255, 255, 0.92)',
    fontFamily: fonts.bold, fontSize: 12.5, color: C.p600,
  },
  pillRow: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99,
    backgroundColor: 'rgba(255, 255, 255, 0.92)', boxShadow: '0px 6px 16px rgba(0, 0, 0, 0.08)',
  },
  statusText: { fontFamily: fonts.bold, fontSize: 13.5, color: C.p600 },
  gain: { backgroundColor: C.p600 },
  gainText: { fontFamily: fonts.bold, fontSize: 15, color: '#fff' },

  tray: { gap: 8, paddingTop: 8, paddingHorizontal: 10, paddingBottom: 10, borderRadius: 16, backgroundColor: '#F2F8EE', borderWidth: 1.5, borderColor: '#DCEAD2' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 18, paddingHorizontal: 2 },
  howto: { flex: 1, fontFamily: fonts.bold, fontSize: 11.8, lineHeight: 15.5, color: C.p600 },
  more: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  moreText: { fontFamily: fonts.medium, fontSize: 11.5, color: C.ink4 },
  belt: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 6, rowGap: 8, paddingTop: 6 },
  tool: {
    alignItems: 'center', gap: 4, paddingTop: 7, paddingHorizontal: 2, paddingBottom: 6,
    borderRadius: 12, borderWidth: 1.5, borderColor: '#E1EBDA', backgroundColor: '#fff',
  },
  toolResting: { backgroundColor: 'transparent', borderColor: 'transparent' },
  toolIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: C.p100, alignItems: 'center', justifyContent: 'center' },
  waitRow: { position: 'absolute', left: -24, right: -24, bottom: -7, alignItems: 'center' },
  wait: { paddingHorizontal: 5, borderRadius: 99, backgroundColor: '#fff', borderWidth: 1, borderColor: C.parchment2 },
  waitText: { fontFamily: fonts.bold, fontSize: 9.3, lineHeight: 14, color: C.ink3 },
  toolLabel: { minHeight: 26, fontFamily: fonts.display, fontSize: 11.2, lineHeight: 13, color: C.ink2, textAlign: 'center' },
  flag: { position: 'absolute', top: -8, zIndex: 1, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 99, backgroundColor: C.orange },
  flagText: { fontFamily: fonts.bold, fontSize: 9, lineHeight: 13.5, color: '#fff' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 3, height: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, borderWidth: 1.5, borderColor: C.p300, backgroundColor: '#fff' },
  dotOn: { borderColor: C.p500, backgroundColor: C.p500 },
  dotDone: { borderColor: C.p600, backgroundColor: C.p600 },
  ghost: {
    position: 'absolute', width: 64, height: 64, borderRadius: 20, backgroundColor: '#fff', borderWidth: 3, borderColor: C.parchment2,
    alignItems: 'center', justifyContent: 'center', boxShadow: '0px 14px 30px rgba(0, 0, 0, 0.25)', transform: [{ rotate: '-12deg' }],
  },
  ghostOver: { borderColor: C.p500, transform: [{ rotate: '-24deg' }, { scale: 1.08 }] },
});
