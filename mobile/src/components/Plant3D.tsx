import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
export function Plant3D({ plant, width, height, isNight, scene = 'natural', decoration, wind = 'off', gadgets = [], hint = true }: {
  plant: Look; width: number; height: number; isNight: boolean;
  scene?: string; decoration?: string; wind?: 'off' | 'breeze' | 'fan';
  /** The parts wired on the IoT board, built into the 3D pot. */
  gadgets?: Array<{ type: string; on: boolean }>;
  /** The "3D · kéo để xoay" badge; off while a care tool is at work over the plant. */
  hint?: boolean;
}) {
  // The class is generic with `undefined` as its default, so the ref names an empty set of extra props.
  const web = useRef<WebView<{}>>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

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

  const key = JSON.stringify(opts);
  useEffect(() => {
    if (ready) web.current?.injectJavaScript(`window.__sproutyPlant && window.__sproutyPlant(${key}); true;`);
  }, [key, ready]);

  function onMessage(e: WebViewMessageEvent) {
    if (e.nativeEvent.data === 'ready') setReady(true);
    else if (e.nativeEvent.data === 'fallback') setFailed(true);
  }

  return (
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
          source={{ html: PLANT_3D_HTML, baseUrl: uri }}
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
      {ready && hint && (
        <View pointerEvents="none" style={s.badge}>
          <Icon name="sparkle" size={12} color={colors.greenDark} />
          <Text style={s.badgeText}>3D · kéo để xoay</Text>
        </View>
      )}
    </View>
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
  warm: { position: 'absolute', left: -10, top: -10, width: 1, height: 1, opacity: 0 },
  frame: { alignSelf: 'center', borderRadius: radius.xl, overflow: 'hidden', backgroundColor: '#E5EBDD' },
  drawing: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', right: 10, top: 10, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.88)' },
  badgeText: { fontFamily: fonts.bold, fontSize: 11, color: colors.greenDark },
});
