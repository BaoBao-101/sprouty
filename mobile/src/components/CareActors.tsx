import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

/*
 * The tool itself doing the job, over the plant, while the care is sent —
 * the website's CareActors (frontend/src/components/CareActors.tsx and .css)
 * drawn and timed the same: a watering can comes in, tips and pours; a spray
 * bottle squeezes three times; a sack of fertiliser tips and granules fall;
 * the sun in the sky blazes and shines on the leaves; a magnifier hunts round
 * the plant until a bug scurries off; scissors snip three times and leaves
 * drop; a trowel digs twice and throws up soil; a bee loops round the flowers
 * leaving pollen; fruit drops into a basket.
 *
 * Every CSS keyframe track there is one interpolation of a single 2.2s clock
 * here (`kf`), so the whole scene runs on the native driver.
 */

/** How long the tool takes over the job; CareGame waits as long. */
export const EFFECT_MS = 2200;

type Ease = (x: number) => number;
const EASE = {
  inOut: Easing.bezier(0.42, 0, 0.58, 1),
  out: Easing.bezier(0, 0, 0.58, 1),
  in: Easing.bezier(0.42, 0, 1, 1),
  linear: (x: number) => x,
};

type Frames = Array<[number, number]>;

/**
 * One CSS keyframe track, read off the 2.2s clock `t` (0..1). `frames` are
 * [percent, value] pairs, eased between each pair as CSS eases between
 * keyframes; `delay` and `dur` are in ms, `times` the iteration count. `rest`
 * is the value outside the run, for an animation without fill-mode;
 * otherwise the first and last frames hold, as with `both`.
 */
function kf(t: Animated.Value, frames: Frames, o: { delay?: number; dur?: number; times?: number; ease?: Ease; rest?: number; unit?: string } = {}) {
  const { delay = 0, dur = EFFECT_MS, times = 1, ease = EASE.inOut, rest, unit } = o;
  const input: number[] = [];
  const output: number[] = [];
  const push = (ms: number, v: number) => {
    let x = ms / EFFECT_MS;
    if (input.length && x <= input[input.length - 1]) x = input[input.length - 1] + 1e-6;
    input.push(x);
    output.push(v);
  };
  if (rest !== undefined) push(delay - 1, rest);
  for (let k = 0; k < times; k++) {
    const base = delay + k * dur;
    for (let i = 0; i < frames.length - 1; i++) {
      const [p0, v0] = frames[i];
      const [p1, v1] = frames[i + 1];
      const steps = v0 === v1 || ease === EASE.linear ? 1 : 6;
      for (let s = 0; s < steps; s++) push(base + ((p0 + (p1 - p0) * (s / steps)) / 100) * dur, v0 + (v1 - v0) * ease(s / steps));
    }
    const [pl, vl] = frames[frames.length - 1];
    push(base + (pl / 100) * dur, vl);
  }
  if (rest !== undefined) push(delay + times * dur + 1, rest);
  const range = { inputRange: input, extrapolate: 'clamp' as const };
  // Typed as numbers either way: a transform takes "-34deg" as readily as 0.5.
  return (unit ? t.interpolate({ ...range, outputRange: output.map((v) => `${v}${unit}`) }) : t.interpolate({ ...range, outputRange: output })) as Animated.AnimatedInterpolation<number>;
}

const deg = { unit: 'deg' };
/** The tools' drop shadow, as on the website. */
const SHADOW = { filter: 'drop-shadow(0px 6px 10px rgba(30, 50, 35, 0.22))' } as ViewStyle;

/** A 110px tool (smaller on a phone) centred on a point, its picture a 100×100 viewBox. */
function Tool({ x, y, size, origin, style, children }: { x: number; y: number; size: number; origin?: string; style: object; children: ReactNode }) {
  return (
    <Animated.View style={[{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, transformOrigin: origin }, SHADOW, style]}>
      {children}
    </Animated.View>
  );
}

/** A part of a tool that moves on its own (a trigger, a blade, wings): the whole box, turned about a point of it. */
function Layer({ origin, style, children, viewBox = '0 0 100 100' }: { origin?: string; style?: object; children: ReactNode; viewBox?: string }) {
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: origin }, style]}>
      <Svg width="100%" height="100%" viewBox={viewBox}>{children}</Svg>
    </Animated.View>
  );
}

/** The usual entrance: in from the side, the job, out again (ca-in-out). */
function inOut(t: Animated.Value, dx: number, dy: number) {
  return {
    opacity: kf(t, [[0, 0], [14, 1], [86, 1], [100, 0]]),
    transform: [{ translateX: kf(t, [[0, dx], [14, 0], [86, 0], [100, dx]]) }, { translateY: kf(t, [[0, dy], [14, 0], [86, 0], [100, dy]]) }],
  };
}

export function CareActor({ action, fruitColor, sun, w, h, k }: {
  action: string;
  fruitColor?: string;
  /** Where the scene painted its sun (shares of the box) and the way down from it to the plant. */
  sun?: { x: number; y: number; deg: number };
  /** The plant's box. */
  w: number;
  h: number;
  /** Scale: .76 on a phone, as the website's --k. */
  k: number;
}) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: EFFECT_MS, easing: Easing.linear, useNativeDriver: true }).start();
  }, [t]);

  // The 3D picture's soil line, which everything is placed from.
  const soil = 0.68 * h;
  const T = 110 * k;

  const scene = (children: ReactNode) => <View pointerEvents="none" style={s.ca}>{children}</View>;

  switch (action) {
    case 'water': {
      const x = 0.68 * w;
      const y = soil - 0.38 * h;
      const sx = x - 50 * k;
      const sy = y + 17 * k;
      const fall = 0.38 * h - 17 * k;
      return scene(<>
        <Tool x={x} y={y} size={T} origin="60% 62%" style={{
          opacity: kf(t, [[0, 0], [14, 1], [88, 1], [100, 0]]),
          transform: [
            { translateX: kf(t, [[0, 50], [14, 0], [88, 0], [100, 50]]) },
            { translateY: kf(t, [[0, -30], [14, 0], [88, 0], [100, -30]]) },
            { rotate: kf(t, [[0, 0], [14, 0], [28, -34], [76, -34], [88, 0], [100, 0]], deg) },
          ],
        }}>
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            <G stroke="#3F5D66" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round">
              <Path d="M58 34C58 16 86 16 86 34" fill="none" strokeWidth={5} />
              <Path d="M46 62L14 36" strokeWidth={10} />
              <Path d="M46 62L14 36" stroke="#8DB8C5" strokeWidth={5} />
              <Ellipse cx={12} cy={34} rx={8} ry={5} transform="rotate(-40 12 34)" fill="#6E9EAC" />
              <Rect x={42} y={34} width={50} height={46} rx={9} fill="#8DB8C5" />
              <Path d="M42 48H92" fill="none" opacity={0.45} />
            </G>
          </Svg>
        </Tool>
        {Array.from({ length: 7 }, (_, i) => {
          const o = { delay: 620 + i * 70, dur: 420, times: 3, ease: EASE.linear };
          return (
            <Animated.View key={i} style={[s.drop, { left: sx + ((i * 5) % 9), top: sy,
              opacity: kf(t, [[0, 0], [15, 0.95], [100, 0.4]], { ...o, rest: 0 }),
              transform: [{ translateY: kf(t, [[0, 0], [100, fall]], { ...o, rest: 0 }) }] }]} />
          );
        })}
        {[950, 1250].map((delay) => {
          const o = { delay, dur: 600, times: 2, ease: EASE.out };
          return (
            <Animated.View key={delay} style={{ position: 'absolute', left: sx - 10, top: soil - 5, width: 34, height: 10,
              opacity: kf(t, [[0, 0.9], [100, 0]], { ...o, rest: 0 }), transform: [{ scale: kf(t, [[0, 0.3], [100, 1.5]], o) }] }}>
              <Svg width={34} height={10}><Ellipse cx={17} cy={5} rx={16} ry={4} fill="none" stroke="rgba(79, 179, 232, 0.8)" strokeWidth={2} /></Svg>
            </Animated.View>
          );
        })}
      </>);
    }

    case 'mist': {
      const x = 0.72 * w;
      const y = soil - 0.32 * h;
      const px = x - 20 * k;
      const py = y - 27 * k;
      return scene(<>
        <Tool x={x} y={y} size={T} style={inOut(t, 50, -10)}>
          <Layer>
            <Path d="M52 70H82V84A6 6 0 0 1 76 90H58A6 6 0 0 1 52 84Z" fill="#A9D3DE" />
            <G stroke="#3D5A45" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round">
              <Rect x={50} y={44} width={34} height={48} rx={9} fill="none" />
              <Rect x={58} y={34} width={18} height={10} rx={2} fill="#7FA77A" />
              <Path d="M42 20H80V34H54Z" fill="#7FA77A" />
              <Rect x={32} y={22} width={11} height={7} rx={2} fill="#5F8A5B" />
            </G>
          </Layer>
          <Layer origin="58% 34%" style={{ transform: [{ rotate: kf(t, [[0, 0], [50, -16], [100, 0]], { delay: 500, dur: 400, times: 3, unit: 'deg' }) }] }}>
            <Path d="M58 34L50 50L56 52L64 36" fill="#5F8A5B" stroke="#3D5A45" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          </Layer>
        </Tool>
        {Array.from({ length: 15 }, (_, i) => {
          const o = { delay: 550 + Math.floor(i / 5) * 400 + (i % 5) * 30, dur: 800, ease: EASE.out };
          return (
            <Animated.View key={i} style={[s.puff, { left: px - 9, top: py - 9,
              opacity: kf(t, [[0, 0], [20, 0.9], [100, 0]], o),
              transform: [
                { translateX: kf(t, [[0, 0], [100, (-70 - (i % 5) * 9) * k]], o) },
                { translateY: kf(t, [[0, 0], [100, ((i * 17) % 50) - 22]], o) },
                { scale: kf(t, [[0, 0.3], [100, 1.7]], o) },
              ] }]} />
          );
        })}
      </>);
    }

    case 'fertilize': {
      const x = 0.68 * w;
      const y = soil - 0.34 * h;
      const gx = x - 29 * k;
      const gy = y - 8 * k;
      const fall = 0.34 * h + 8 * k;
      return scene(<>
        <Tool x={x} y={y} size={T} style={{
          opacity: kf(t, [[0, 0], [14, 1], [86, 1], [100, 0]]),
          transform: [
            { translateX: kf(t, [[0, 50], [14, 0], [86, 0], [100, 50]]) },
            { translateY: kf(t, [[0, -20], [14, 0], [86, 0], [100, -20]]) },
            { rotate: kf(t, [[0, 0], [14, 0], [28, -45], [40, -50], [52, -44], [64, -50], [74, -45], [86, 0], [100, 0]], deg) },
          ],
        }}>
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            <G stroke="#6B4A2B" strokeWidth={2.5} strokeLinejoin="round">
              <Path d="M34 30L80 22L88 86Q60 94 40 88Z" fill="#CDA56D" />
              <Path d="M34 30Q30 22 38 18L80 14L80 22" fill="#B98F57" />
              <Path d="M52 56c6-8 16-8 20 0c-6 8-14 8-20 0z" fill="#7FA35B" />
              <Ellipse cx={36} cy={26} rx={6} ry={4} fill="#5A3E24" />
            </G>
          </Svg>
        </Tool>
        {Array.from({ length: 14 }, (_, i) => {
          const o = { delay: 620 + i * 60, dur: 550, times: 2, ease: EASE.in };
          return (
            <Animated.View key={i} style={[s.grain, { left: gx, top: gy, backgroundColor: i % 2 === 0 ? '#B48650' : '#8B5E34',
              opacity: kf(t, [[0, 0], [12, 1], [100, 0.6]], { ...o, rest: 0 }),
              transform: [
                { translateX: kf(t, [[0, 0], [100, ((i * 23) % 40) - 20]], { ...o, rest: 0 }) },
                { translateY: kf(t, [[0, 0], [100, fall]], { ...o, rest: 0 }) },
              ] }]} />
          );
        })}
      </>);
    }

    case 'sunlight': {
      // The sun already in the sky blazes up and shines down on the plant.
      const sx = (sun?.x ?? 0.82) * w;
      const sy = (sun?.y ?? 0.145) * h;
      const down = sun?.deg ?? 148;
      const shine = kf(t, [[0, 0], [18, 0], [36, 1], [76, 1], [100, 0]]);
      const G1 = 0.64 * w;
      const B = 260 * k;
      const F = 150 * k;
      // radial-gradient(circle, …) reaches the box's corner: 50√2 in a 100 box.
      const R = 70.71;
      return scene(<>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255, 244, 210, 0.22)', opacity: shine }]} />
        <Animated.View style={{ position: 'absolute', left: 0.5 * w - G1 / 2, top: soil - 0.24 * h - G1 / 2, width: G1, height: G1, opacity: shine }}>
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            <Defs>
              <RadialGradient id="glow" cx={50} cy={50} r={R} gradientUnits="userSpaceOnUse">
                <Stop offset={0} stopColor="rgb(255, 214, 110)" stopOpacity={0.42} />
                <Stop offset={0.64} stopColor="rgb(255, 214, 110)" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect width={100} height={100} fill="url(#glow)" />
          </Svg>
        </Animated.View>
        {[-12, 0, 12].map((tilt) => (
          <Animated.View key={tilt} style={{ position: 'absolute', left: sx, top: sy - 15, width: 0.62 * w, height: 30, borderRadius: 99, overflow: 'hidden',
            transformOrigin: '0% 50%', transform: [{ rotate: `${down + tilt}deg` }], opacity: shine }}>
            <Svg width="100%" height="100%" viewBox="0 0 100 30" preserveAspectRatio="none">
              <Defs>
                <LinearGradient id={`beam${tilt}`} x1={0} y1={0} x2={1} y2={0}>
                  <Stop offset={0} stopColor="rgb(255, 226, 140)" stopOpacity={0.6} />
                  <Stop offset={1} stopColor="rgb(255, 214, 110)" stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Rect width={100} height={30} fill={`url(#beam${tilt})`} />
            </Svg>
          </Animated.View>
        ))}
        {/* A slow-turning burst of rays round the sun. */}
        <Animated.View style={{ position: 'absolute', left: sx - B / 2, top: sy - B / 2, width: B, height: B,
          opacity: kf(t, [[0, 0], [25, 1], [80, 1], [100, 0]]),
          transform: [{ rotate: kf(t, [[0, 0], [100, 40]], deg) }, { scale: kf(t, [[0, 0.5], [100, 1.1]]) }] }}>
          <Svg width="100%" height="100%" viewBox="-50 -50 100 100">
            <Defs>
              <RadialGradient id="burst" cx={0} cy={0} r={R} gradientUnits="userSpaceOnUse">
                <Stop offset={0.18} stopColor="rgb(255, 232, 150)" stopOpacity={0.6} />
                <Stop offset={0.68} stopColor="rgb(255, 232, 150)" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            {Array.from({ length: 12 }, (_, i) => {
              const a0 = (i * 30 * Math.PI) / 180;
              const a1 = ((i * 30 + 5) * Math.PI) / 180;
              return <Path key={i} d={`M0 0L${50 * Math.sin(a0)} ${-50 * Math.cos(a0)}A50 50 0 0 1 ${50 * Math.sin(a1)} ${-50 * Math.cos(a1)}Z`} fill="url(#burst)" />;
            })}
          </Svg>
        </Animated.View>
        <Animated.View style={{ position: 'absolute', left: sx - F / 2, top: sy - F / 2, width: F, height: F,
          opacity: kf(t, [[0, 0], [22, 1], [84, 1], [100, 0]]),
          transform: [{ scale: kf(t, [[0, 0.4], [22, 1.3], [36, 1], [52, 1.22], [68, 1], [100, 0.6]]) }] }}>
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            <Defs>
              <RadialGradient id="flare" cx={50} cy={50} r={R} gradientUnits="userSpaceOnUse">
                <Stop offset={0} stopColor="#FFFFF4" stopOpacity={1} />
                <Stop offset={0.18} stopColor="rgb(255, 246, 200)" stopOpacity={0.95} />
                <Stop offset={0.38} stopColor="rgb(255, 214, 110)" stopOpacity={0.55} />
                <Stop offset={0.68} stopColor="rgb(255, 214, 110)" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={50} cy={50} r={50} fill="url(#flare)" />
          </Svg>
        </Animated.View>
      </>);
    }

    case 'pest_check': {
      const x = 0.5 * w;
      const y = soil - 0.26 * h;
      return scene(<>
        <Animated.View style={{ position: 'absolute', left: x - 15 * k - 11, top: y - 3 * k - 11, width: 22, height: 22,
          opacity: kf(t, [[0, 0], [52, 0], [60, 1], [78, 1], [100, 0]]),
          transform: [
            { translateX: kf(t, [[0, 0], [78, 0], [100, -70]]) },
            { translateY: kf(t, [[0, 0], [78, 0], [100, 24]]) },
            { rotate: kf(t, [[0, 0], [78, 0], [100, -30]], deg) },
            { scale: kf(t, [[0, 0.5], [52, 0.5], [60, 1], [100, 1]]) },
          ] }}>
          <Svg width={22} height={22} viewBox="0 0 24 24">
            <G stroke="#3B3B3B" strokeWidth={1.4} strokeLinecap="round">
              <Path d="M6 8L3 6M6 12H2M6 16L3 18M18 8L21 6M18 12H22M18 16L21 18" />
              <Ellipse cx={12} cy={13} rx={6.5} ry={7.5} fill="#C8553D" />
              <Path d="M12 5.5V20.5" />
              <Circle cx={12} cy={5} r={3} fill="#3B3B3B" />
              <Circle cx={9.5} cy={11} r={1.2} fill="#3B3B3B" stroke="none" />
              <Circle cx={14.5} cy={15} r={1.2} fill="#3B3B3B" stroke="none" />
            </G>
          </Svg>
        </Animated.View>
        <Tool x={x} y={y} size={T} style={{
          opacity: kf(t, [[0, 0], [15, 1], [80, 1], [100, 0]]),
          transform: [
            { translateX: kf(t, [[0, 90], [15, 40], [35, -40], [55, -10], [70, -6], [80, -6], [100, 90]]) },
            { translateY: kf(t, [[0, -40], [15, -20], [35, -30], [55, 10], [70, 6], [80, 6], [100, -40]]) },
            { scale: kf(t, [[0, 1], [55, 1], [70, 1.12], [80, 1.12], [100, 1]]) },
          ],
        }}>
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            <Path d="M60 60L86 86" stroke="#8A5A3A" strokeWidth={10} strokeLinecap="round" />
            <Circle cx={42} cy={42} r={24} fill="rgba(220, 240, 245, 0.4)" stroke="#5B6B66" strokeWidth={6} />
            <Path d="M30 35a14 14 0 0 1 10-9" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" opacity={0.85} />
          </Svg>
        </Tool>
      </>);
    }

    case 'prune': {
      const x = 0.36 * w;
      const y = soil - 0.3 * h;
      const lx = x + 46 * k;
      const fall = 0.3 * h;
      const snip = (a: number) => kf(t, [[0, a], [20, a], [28, 0], [36, a], [46, 0], [54, a], [64, 0], [72, a], [100, a]], deg);
      return scene(<>
        <Tool x={x} y={y} size={T} style={inOut(t, -50, -10)}>
          <Layer style={{ transform: [{ rotate: snip(-16) }] }}>
            <G stroke="#4A555B" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round">
              <Path d="M30 62L50 50" strokeWidth={5} />
              <Circle cx={22} cy={68} r={9} fill="none" stroke="#C9733D" strokeWidth={6} />
              <Path d="M50 50L92 41L90 47Z" fill="#B8C2C8" />
            </G>
          </Layer>
          <Layer style={{ transform: [{ rotate: snip(16) }] }}>
            <G stroke="#4A555B" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round">
              <Path d="M30 38L50 50" strokeWidth={5} />
              <Circle cx={22} cy={32} r={9} fill="none" stroke="#C9733D" strokeWidth={6} />
              <Path d="M50 50L92 59L90 53Z" fill="#B8C2C8" />
            </G>
          </Layer>
          <Layer><Circle cx={50} cy={50} r={3.5} fill="#4A555B" stroke="#4A555B" strokeWidth={2.5} /></Layer>
        </Tool>
        {[0.62, 1.01, 1.41].map((delay, i) => {
          const o = { delay: delay * 1000, dur: 800, ease: EASE.in };
          return (
            <Animated.View key={i} style={[s.leaf, { left: lx - 6, top: y,
              opacity: kf(t, [[0, 0], [12, 1], [100, 0]], o),
              transform: [
                { translateX: kf(t, [[0, 0], [100, [18, -10, 26][i]]], o) },
                { translateY: kf(t, [[0, 0], [100, fall]], o) },
                { rotate: kf(t, [[0, 0], [100, 220]], { ...o, unit: 'deg' }) },
              ] }]} />
          );
        })}
      </>);
    }

    case 'loosen_soil': {
      const x = 0.54 * w + 20 * k;
      const y = soil - 33 * k;
      const dx = 0.54 * w;
      return scene(<>
        <Tool x={x} y={y} size={T} origin="70% 30%" style={{
          opacity: kf(t, [[0, 0], [14, 1], [86, 1], [100, 0]]),
          transform: [
            { translateX: kf(t, [[0, 40], [14, 0], [26, 0], [38, 6], [50, 0], [62, 0], [74, 6], [86, 0], [100, 40]]) },
            { translateY: kf(t, [[0, -50], [14, -14], [26, 6], [38, -16], [50, -12], [62, 6], [74, -16], [86, -14], [100, -50]]) },
            { rotate: kf(t, [[0, 0], [14, 0], [26, 6], [38, -22], [50, 0], [62, 6], [74, -22], [86, 0], [100, 0]], deg) },
          ],
        }}>
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            <Path d="M62 38L84 16" stroke="#9C6B3F" strokeWidth={10} strokeLinecap="round" />
            <Path d="M56 44L64 36" stroke="#4A555B" strokeWidth={7} strokeLinecap="round" />
            <Path d="M60 46Q66 70 34 84Q22 72 30 60Q44 44 60 46Z" fill="#AEB8BF" stroke="#4A555B" strokeWidth={2.5} strokeLinejoin="round" />
          </Svg>
        </Tool>
        {Array.from({ length: 12 }, (_, i) => {
          const o = { delay: i < 6 ? 820 : 1600, dur: 620, ease: EASE.out };
          const big = i % 3 !== 2;
          const hop = ((i * 29) % 70) - 35;
          return (
            <Animated.View key={i} style={{ position: 'absolute', left: dx - 4, top: soil - 4, width: big ? 8 : 6, height: big ? 7 : 6, borderRadius: 3.5,
              backgroundColor: big ? '#6B4F33' : '#8B6B47',
              opacity: kf(t, [[0, 0], [15, 1], [100, 0]], o),
              transform: [
                { translateX: kf(t, [[0, 0], [50, hop * 0.5], [100, hop]], o) },
                { translateY: kf(t, [[0, 0], [50, -18 - ((i * 13) % 20)], [100, 2]], o) },
              ] }} />
          );
        })}
      </>);
    }

    case 'pollinate': {
      const x = 0.5 * w;
      const y = soil - 0.3 * h;
      const bw = 75 * k;
      const bh = 50 * k;
      return scene(<>
        {[[40, -8], [14, -24], [-12, -30], [-40, -10], [-46, 4], [-20, -14], [8, -18], [30, 4]].map(([px, py], i) => {
          const o = { delay: 400 + i * 170, dur: 900, ease: EASE.out };
          return (
            <Animated.View key={i} style={[s.pollen, { left: x + px - 3, top: y + py - 3,
              opacity: kf(t, [[0, 0], [25, 1], [100, 0]], o),
              transform: [{ translateY: kf(t, [[0, 0], [100, 14]], o) }, { scale: kf(t, [[0, 0.4], [100, 1]], o) }] }]} />
          );
        })}
        <Animated.View style={{ position: 'absolute', left: x - bw / 2, top: y - bh / 2, width: bw, height: bh,
          opacity: kf(t, [[0, 0], [15, 1], [86, 1], [100, 0]]),
          transform: [
            { translateX: kf(t, [[0, 140], [15, 50], [30, -10], [40, -50], [48, -50], [62, 0], [74, 30], [86, 70], [100, 140]]) },
            { translateY: kf(t, [[0, -50], [15, -10], [30, -30], [40, 0], [48, 0], [62, -20], [74, 10], [86, -20], [100, -60]]) },
            { scaleX: kf(t, [[0, -1], [40, -1], [48, 1], [100, 1]]) },
          ] }}>
          {/* The wings beat from their base, under the body. */}
          <Layer viewBox="0 0 60 40" origin="50% 41%" style={{ transform: [{ scaleY: kf(t, [[0, 1], [50, 0.35], [100, 1]], { dur: 240, times: 10, ease: EASE.linear }) }] }}>
            <Ellipse cx={26} cy={10} rx={9} ry={7} fill="rgba(255, 255, 255, 0.85)" stroke="#6B7C85" strokeWidth={1.5} />
            <Ellipse cx={36} cy={10} rx={8} ry={6} fill="rgba(255, 255, 255, 0.85)" stroke="#6B7C85" strokeWidth={1.5} />
          </Layer>
          <Layer viewBox="0 0 60 40">
            <Ellipse cx={30} cy={24} rx={16} ry={11} fill="#F2C14E" stroke="#3B3B3B" strokeWidth={2} />
            <Rect x={23} y={15} width={4} height={18} fill="#3B3B3B" />
            <Rect x={32} y={15} width={4} height={18} fill="#3B3B3B" />
            <Circle cx={47} cy={22} r={6} fill="#3B3B3B" />
            <Path d="M14 24H8" stroke="#3B3B3B" strokeWidth={2} strokeLinecap="round" />
          </Layer>
        </Animated.View>
      </>);
    }

    case 'harvest': {
      const bx = 0.28 * w;
      const by = soil + 0.02 * h;
      const S = 90 * k;
      const fy = soil - 0.3 * h;
      return scene(<>
        <Tool x={bx} y={by} size={S} style={{
          opacity: kf(t, [[0, 0], [14, 1], [88, 1], [100, 0]]),
          transform: [
            { translateY: kf(t, [[0, 40], [14, 0], [88, 0], [100, 40]]) },
            { scaleY: kf(t, [[0, 1], [14, 1], [43, 0.92], [47, 1], [59, 0.92], [63, 1], [75, 0.92], [79, 1], [100, 1]]) },
          ],
        }}>
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            <G stroke="#6B4A2B" strokeLinejoin="round" strokeLinecap="round">
              <Path d="M28 46C28 16 72 16 72 46" fill="none" strokeWidth={5} />
              <Path d="M14 46H86L78 88H22Z" fill="#C99A5B" strokeWidth={2.5} />
              <Path d="M18 60H82M20 74H80" strokeWidth={2} opacity={0.5} />
            </G>
          </Svg>
        </Tool>
        {/* Fruit drops from the plant into the basket, in front of it. */}
        {[0.55, 0.9, 1.25].map((delay, i) => {
          const o = { delay: delay * 1000, dur: 700, ease: EASE.linear };
          const from = 0.5 * w + [-14, 10, -2][i];
          return (
            <Animated.View key={i} style={{ position: 'absolute', left: 0, top: 0,
              opacity: kf(t, [[0, 1], [95, 1], [100, 0]], o),
              transform: [{ translateX: kf(t, [[0, from], [100, bx]], o) }, { translateY: kf(t, [[0, fy], [100, soil - 0.02 * h]], o) }] }}>
              <Animated.View style={[s.fruit, { backgroundColor: fruitColor || '#E4572E',
                transform: [{ translateY: kf(t, [[0, 0], [40, -34], [100, 0]], { delay: delay * 1000, dur: 700, ease: EASE.out }) }] }]} />
            </Animated.View>
          );
        })}
      </>);
    }

    default:
      return null;
  }
}

const s = StyleSheet.create({
  ca: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', borderRadius: 22 },
  drop: { position: 'absolute', width: 5, height: 9, borderRadius: 3, borderTopLeftRadius: 2.5, borderTopRightRadius: 2.5, backgroundColor: '#4FB3E8' },
  puff: { position: 'absolute', width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(232, 246, 252, 0.95)', boxShadow: '0px 0px 8px 2px rgba(255, 255, 255, 0.85), inset 0px 0px 0px 1px rgba(150, 205, 228, 0.6)' },
  grain: { position: 'absolute', width: 5, height: 5, borderRadius: 1.5 },
  leaf: { position: 'absolute', width: 13, height: 8, borderTopRightRadius: 6.4, borderBottomLeftRadius: 6.4, backgroundColor: '#6E9A4E' },
  pollen: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: '#F2C14E' },
  fruit: { position: 'absolute', left: -8, top: -8, width: 16, height: 16, borderRadius: 8, boxShadow: 'inset -3px -3px 0px rgba(0, 0, 0, 0.12)' },
});
