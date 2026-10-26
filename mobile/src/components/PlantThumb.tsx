import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Directory, File, Paths } from 'expo-file-system';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { WEB_ORIGIN } from '@/lib/config';
import { useGardenLook } from '@/lib/garden-look';
import type { PlantCard } from '@/lib/types';
import { PlantArt } from './PlantArt';
import { PLANT_3D_HTML } from './plant3d-page';

/*
 * The plant cards' pictures in 3D, as on the website's cards
 * (PlantThumbnail3D): one hidden studio — the 3D page shipped in the app, in
 * thumbnail mode — takes a still of each plant in turn, rather than a live
 * 3D view per card, which 20 or 30 plants would not survive. The stills are
 * kept on the phone, so a plant that has not changed shows at once next time;
 * until its still is ready a card shows the 2D drawing.
 */

type Look = Pick<PlantCard, 'stage' | 'stageProgress' | 'health' | 'form' | 'fruitShape' | 'fruitColor' | 'flowerColor'>;

// A new build of the 3D page draws differently, so it gets new stills.
const VERSION = `v1-${PLANT_3D_HTML.length}`;
const folder = new Directory(Paths.cache, 'plant3d');
const known = new Map<string, string>(); // key → file uri
const waiting = new Map<string, object>(); // key → what to draw, in order
const listeners = new Map<string, Set<(uri: string) => void>>();
let wake: (() => void) | null = null;

function hash(text: string) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function fileFor(key: string) {
  return new File(folder, `${hash(key)}.jpg`);
}

function stored(key: string): string | null {
  const hit = known.get(key);
  if (hit) return hit;
  try {
    const file = fileFor(key);
    if (file.exists) {
      known.set(key, file.uri);
      return file.uri;
    }
  } catch { /* no cache folder yet */ }
  return null;
}

function finish(key: string, dataUrl: string) {
  waiting.delete(key);
  if (!dataUrl.startsWith('data:image/')) return;
  let uri = dataUrl;
  try {
    folder.create({ idempotent: true, intermediates: true });
    const file = fileFor(key);
    file.write(dataUrl.slice(dataUrl.indexOf(',') + 1), { encoding: 'base64' });
    uri = file.uri;
  } catch { /* shown from memory this time */ }
  known.set(key, uri);
  listeners.get(key)?.forEach((on) => on(uri));
}

/**
 * The hidden studio. Mounted once near the root; it starts the 3D page only
 * while there are stills to take, and lets it go a little after.
 */
export function ThumbStudio() {
  const web = useRef<WebView<{}>>(null);
  const [on, setOn] = useState(false);
  const ready = useRef(false);
  const busy = useRef<string | null>(null);
  const idle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function next() {
    if (!ready.current || busy.current) return;
    const [key, props] = waiting.entries().next().value ?? [];
    if (!key) {
      clearTimeout(idle.current);
      idle.current = setTimeout(() => { ready.current = false; setOn(false); }, 15000);
      return;
    }
    clearTimeout(idle.current);
    busy.current = key;
    web.current?.injectJavaScript(`window.__sproutyThumb(${JSON.stringify(key)}, ${JSON.stringify(props)}); true;`);
  }

  useEffect(() => {
    wake = () => { setOn(true); next(); };
    if (waiting.size) wake();
    return () => { wake = null; clearTimeout(idle.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onMessage(e: WebViewMessageEvent) {
    const data = e.nativeEvent.data;
    if (data === 'thumbs-ready') { ready.current = true; next(); return; }
    try {
      const msg = JSON.parse(data) as { thumb?: string; src?: string };
      if (!msg.thumb) return;
      finish(msg.thumb, msg.src || '');
      busy.current = null;
      next();
    } catch { /* not ours */ }
  }

  if (!on) return null;
  return (
    <View pointerEvents="none" style={s.studio}>
      <WebView ref={web} source={{ html: PLANT_3D_HTML, baseUrl: `${WEB_ORIGIN}/embed/plant?thumbs=1` }} onMessage={onMessage}
        originWhitelist={['*']} onError={() => { ready.current = false; setOn(false); }} />
    </View>
  );
}

/** A plant's picture for a card: the 3D still once taken, the 2D drawing until then. Fills its box. */
export function PlantThumb({ plant, size }: { plant: Look; size: number }) {
  const look = useGardenLook();
  const scene = look?.scene ?? 'natural';
  const props = look && {
    stage: plant.stage, progress: Math.round(plant.stageProgress), health: Math.round(plant.health), form: plant.form,
    fruitShape: plant.fruitShape, fruitColor: plant.fruitColor, flowerColor: plant.flowerColor,
    decoration: look.decoration, scene,
  };
  const key = props ? `${VERSION}|${JSON.stringify(props)}` : '';
  const [uri, setUri] = useState<string | null>(() => (key ? stored(key) : null));

  useEffect(() => {
    if (!key) return;
    const hit = stored(key);
    setUri(hit);
    if (hit) return;
    const set = listeners.get(key) ?? new Set();
    set.add(setUri);
    listeners.set(key, set);
    if (!waiting.has(key)) waiting.set(key, props!);
    wake?.();
    return () => { set.delete(setUri); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={s.drawing}>
        <PlantArt stage={plant.stage} progress={plant.stageProgress} health={plant.health} form={plant.form}
          fruitShape={plant.fruitShape} fruitColor={plant.fruitColor} flowerColor={plant.flowerColor}
          isNight={scene === 'night'} autumn={scene === 'autumn'} decoration={look?.decoration as never} size={size} />
      </View>
      {uri && <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={180} />}
    </View>
  );
}

const s = StyleSheet.create({
  studio: { position: 'absolute', left: 0, bottom: 0, width: 2, height: 2, opacity: 0 },
  drawing: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'flex-end' },
});
