import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Modal, PanResponder, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { WEB_ORIGIN } from '@/lib/config';
import type { PlantCard } from '@/lib/types';
import { colors, fonts, radius } from '@/theme';
import { Icon } from './Icon';
import { PlantArt } from './PlantArt';
import { PLANT_3D_HTML } from './plant3d-page';

type Look = Pick<PlantCard, 'stage' | 'stageProgress' | 'health' | 'form' | 'fruitShape' | 'fruitColor' | 'flowerColor'>;

/**
 * The plant in 3D — the website's own model, scene and lighting: its
 * /embed/plant page, built into one file that ships inside the app
 * (plant3d-page.ts, npm run embed) and shown in a WebView. Nothing is
 * downloaded, so it is up as soon as the phone has drawn it, offline too.
 * The 2D drawing stays underneath for that moment, and for a phone without
 * WebGL. Drag to turn the plant; pinch to zoom.
 */
export function Plant3D({ plant, width, height, isNight, scene = 'natural', decoration, wind = 'off', gadgets = [], hint = true, onInteractionChange, allowFullscreen = true, initialView, onViewChange, resetVersion = 0 }: {
  plant: Look; width: number; height: number; isNight: boolean;
  scene?: string; decoration?: string; wind?: 'off' | 'breeze' | 'fan';
  /** The parts wired on the IoT board, built into the 3D pot. */
  gadgets?: Array<{ type: string; on: boolean }>;
  /** The "3D · kéo để xoay" badge; off while a care tool is at work over the plant. */
  hint?: boolean;
  /** Pause the enclosing native scroll view while rotating or pinching. */
  onInteractionChange?: (active: boolean) => void;
  allowFullscreen?: boolean;
  initialView?: number[];
  onViewChange?: (position: number[]) => void;
  resetVersion?: number;
}) {
  // The class is generic with `undefined` as its default, so the ref names an empty set of extra props.
  const web = useRef<WebView<{}>>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullSize, setFullSize] = useState({ width: 0, height: 0 });
  const [reset, setReset] = useState(0);
  const camera = useRef(initialView);
  const startingView = useRef(initialView);
  const initialApplied = useRef(false);
  const fullCamera = useRef<number[] | undefined>(undefined);
  const initialFullView = useRef<number[] | undefined>(undefined);
  const previous = useRef<{ x: number; y: number; distance: number; count: number } | null>(null);
  const sample = (event: GestureResponderEvent) => {
    const touches = event.nativeEvent.touches;
    if (!touches.length) return null;
    const [a, b] = touches;
    return { x: a.pageX, y: a.pageY, count: touches.length,
      distance: b ? Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) : 0 };
  };
  const pan = useMemo(() => {
    const end = () => { previous.current = null; onInteractionChange?.(false); };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => ready && !failed,
      onMoveShouldSetPanResponder: () => ready && !failed,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (event) => {
        previous.current = sample(event);
        onInteractionChange?.(true);
      },
      // Re-anchor when a finger is added/removed; pinch must not jump into rotation.
      onPanResponderStart: (event) => { previous.current = sample(event); },
      onPanResponderEnd: (event) => { previous.current = sample(event); },
      onPanResponderMove: (event) => {
        const next = sample(event), last = previous.current;
        previous.current = next;
        if (!next || !last || next.count !== last.count) return;
        const horizontal = next.count === 1 ? (next.x - last.x) * 2 * Math.PI / height : 0;
        const vertical = next.count === 1 ? (next.y - last.y) * 2 * Math.PI / height : 0;
        const zoom = next.count > 1 && next.distance > 0 && last.distance > 0 ? last.distance / next.distance : 1;
        web.current?.injectJavaScript(`window.__sproutyOrbit?.(${horizontal},${vertical},${zoom}); true;`);
      },
      onPanResponderRelease: end,
      onPanResponderTerminate: end,
    });
  }, [ready, failed, height, onInteractionChange]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') { previous.current = null; onInteractionChange?.(false); }
    });
    return () => {
      subscription.remove();
      onInteractionChange?.(false);
    };
  }, [onInteractionChange]);

  useEffect(() => {
    if (failed) onInteractionChange?.(false);
  }, [failed, onInteractionChange]);

  const opts = {
    stage: plant.stage, progress: Math.round(plant.stageProgress), health: Math.round(plant.health), form: plant.form,
    fruitShape: plant.fruitShape, fruitColor: plant.fruitColor, flowerColor: plant.flowerColor,
    isNight, scene, decoration, wind, gadgets,
  };

  // The page reads the plant from its address, so it loads under one; nothing
  // is fetched from it. Fixed at the first render: later changes are sent to
  // the page instead, so caring for the plant does not reload the 3D view.
  const uri = useMemo(() => {
    const q = new URLSearchParams({
      stage: opts.stage, progress: String(opts.progress), health: String(opts.health), form: opts.form,
      fruitShape: opts.fruitShape, fruitColor: opts.fruitColor, flowerColor: opts.flowerColor,
      night: isNight ? '1' : '0', scene, wind, ...(decoration ? { decoration } : {}),
      gadgets: gadgets.map((g) => `${g.type}:${g.on ? 1 : 0}`).join(','),
    });
    return `${WEB_ORIGIN}/embed/plant?${q.toString()}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const source = useMemo(() => ({ html: PLANT_3D_HTML, baseUrl: uri }), [uri]);

  const key = JSON.stringify(opts);
  useEffect(() => {
    if (ready) web.current?.injectJavaScript(`window.__sproutyPlant && window.__sproutyPlant(${key}); true;`);
  }, [key, ready]);

  useEffect(() => {
    if (ready && resetVersion > 0) web.current?.injectJavaScript('window.__sproutyResetView?.(); true;');
  }, [resetVersion, ready]);

  function openFullscreen() {
    initialFullView.current = camera.current;
    fullCamera.current = camera.current;
    onInteractionChange?.(false);
    setFullSize({ width: 0, height: 0 });
    setReset(0);
    setFullscreen(true);
  }
  function closeFullscreen() {
    const position = fullCamera.current;
    if (position) {
      camera.current = position;
      web.current?.injectJavaScript(`window.__sproutySetView?.(${JSON.stringify(position)}); true;`);
    }
    setFullscreen(false);
    onInteractionChange?.(false);
  }

  function onMessage(e: WebViewMessageEvent) {
    if (e.nativeEvent.data === 'ready') {
      if (!initialApplied.current && startingView.current) {
        web.current?.injectJavaScript(`window.__sproutySetView?.(${JSON.stringify(startingView.current)}); true;`);
      }
      initialApplied.current = true;
      setReady(true);
    }
    else if (e.nativeEvent.data === 'fallback') setFailed(true);
    else {
      try {
        const message = JSON.parse(e.nativeEvent.data);
        if (message.type === 'view' && Array.isArray(message.position) && message.position.length === 3 && message.position.every((n: unknown) => typeof n === 'number' && Number.isFinite(n))) {
          camera.current = message.position;
          onViewChange?.(message.position);
        }
      } catch { /* Other embed messages do not change the camera. */ }
    }
  }

  return (
    <>
    <View style={[s.frame, { width, height }]}>
      <View style={s.drawing}>
        <PlantArt stage={plant.stage} progress={plant.stageProgress} health={plant.health} form={plant.form}
          fruitShape={plant.fruitShape} fruitColor={plant.fruitColor} flowerColor={plant.flowerColor}
          isNight={scene === 'night' || (scene === 'natural' && isNight)} autumn={scene === 'autumn'}
          size={Math.min(width, height)} decoration={decoration as never} />
      </View>
      {!failed && (
        <WebView
          ref={web}
          source={source}
          pointerEvents="none"
          onMessage={onMessage}
          onError={() => setFailed(true)}
          // Only the 3D page itself (after a redirect too, say to www); nothing in it may navigate the view away.
          onShouldStartLoadWithRequest={(req: { url: string }) => /^https?:\/\/[^/]+\/embed\/plant(\?|$)/.test(req.url)}
          originWhitelist={['*']}
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          setSupportMultipleWindows={false}
          androidLayerType="hardware"
          style={[StyleSheet.absoluteFill, { opacity: ready ? 1 : 0, backgroundColor: 'transparent' }]}
          containerStyle={StyleSheet.absoluteFill}
        />
      )}
      {ready && !failed && <View style={StyleSheet.absoluteFill} {...pan.panHandlers} />}
      {ready && hint && (
        <View pointerEvents="none" style={s.badge}>
          <Icon name="sparkle" size={12} color={colors.greenDark} />
          <Text style={s.badgeText}>3D · kéo để xoay</Text>
        </View>
      )}
      {ready && !failed && hint && allowFullscreen && <Pressable onPress={openFullscreen} style={s.expand}
        accessibilityRole="button" accessibilityLabel="Mở cây 3D toàn màn hình">
        <Icon name="expand" size={19} color={colors.greenDark} />
        <Text style={s.badgeText}>Toàn màn hình</Text>
      </Pressable>}
    </View>
    {fullscreen && <Modal visible animationType="fade" presentationStyle="fullScreen" hardwareAccelerated
      supportedOrientations={['portrait', 'landscape-left', 'landscape-right']} onRequestClose={closeFullscreen}>
      <SafeAreaView style={s.fullscreen}>
        <View style={s.fullHeader}>
          <Text style={s.fullTitle}>Ngắm cây 3D</Text>
          <Pressable style={s.fullButton} onPress={() => setReset((value) => value + 1)} accessibilityRole="button" accessibilityLabel="Đặt lại góc nhìn">
            <Icon name="return" size={18} color={colors.greenDark} /><Text style={s.badgeText}>Đặt lại</Text>
          </Pressable>
          <Pressable style={s.fullButton} onPress={closeFullscreen} accessibilityRole="button" accessibilityLabel="Đóng toàn màn hình">
            <Icon name="close" size={20} color={colors.ink} />
          </Pressable>
        </View>
        <View style={{ flex: 1 }} onLayout={({ nativeEvent: { layout } }) => setFullSize({ width: layout.width, height: layout.height })}>
          {fullSize.width > 0 && fullSize.height > 0 && <Plant3D plant={plant} width={fullSize.width} height={fullSize.height}
            isNight={isNight} scene={scene} decoration={decoration} wind={wind} gadgets={gadgets} hint={false} allowFullscreen={false}
            initialView={initialFullView.current} onViewChange={(position) => { fullCamera.current = position; }} resetVersion={reset} />}
        </View>
        <Text style={s.fullHint}>Kéo để xoay · Chụm hai ngón để phóng to</Text>
      </SafeAreaView>
    </Modal>}
    </>
  );
}

/**
 * Starts the phone's web engine once, early and out of sight, so the first
 * plant opened does not also wait for that; then goes away.
 */
export function WarmUp3D() {
  const [done, setDone] = useState(false);
  if (done) return null;
  return (
    <View pointerEvents="none" style={s.warm}>
      <WebView source={{ html: '<!doctype html><title></title>' }} onLoadEnd={() => setDone(true)} onError={() => setDone(true)} />
    </View>
  );
}

const s = StyleSheet.create({
  expand: { position: 'absolute', bottom: 10, right: 10, minHeight: 44, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: 'rgba(255,253,248,0.95)', flexDirection: 'row', alignItems: 'center', gap: 6 },
  fullscreen: { flex: 1, backgroundColor: colors.cream },
  fullHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, gap: 6 },
  fullTitle: { flex: 1, fontFamily: fonts.display, fontSize: 19, color: colors.ink },
  fullButton: { minWidth: 44, minHeight: 44, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.greenSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  fullHint: { padding: 10, textAlign: 'center', fontFamily: fonts.medium, fontSize: 12, color: colors.ink3 },
  warm: { position: 'absolute', left: -10, top: -10, width: 1, height: 1, opacity: 0 },
  frame: { alignSelf: 'center', borderRadius: radius.xl, overflow: 'hidden', backgroundColor: '#E5EBDD' },
  drawing: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', right: 10, top: 10, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.88)' },
  badgeText: { fontFamily: fonts.bold, fontSize: 11, color: colors.greenDark },
});
