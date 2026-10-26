import { lazy, Suspense, useEffect, useState } from 'react';
import type { PlantStageId } from '@/components/PlantArt';
import type { FruitShape, PlantForm } from '@/components/PlantForms';
import type { PotKey, SceneKey } from '@/components/garden-looks';
import type { Wind } from '@/components/plant-wind';
import type { Gadget } from '@/components/plant-devices';
import './PlantEmbed.css';

const PlantViewer3D = lazy(() => import('@/components/PlantViewer3D'));

/** What the mobile app sends: the same props the plant page gives the viewer. */
interface EmbedPlant {
  stage: PlantStageId; progress: number; health: number; form: PlantForm;
  fruitShape: FruitShape; fruitColor: string; flowerColor: string;
  isNight: boolean; scene: SceneKey; decoration?: PotKey; wind: Wind;
  /** The parts wired on the app's IoT board, standing in the pot. */
  gadgets: Gadget[];
}

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void };
    /** The app calls this to update the plant without reloading the page. */
    __sproutyPlant?: (next: Partial<EmbedPlant>) => void;
  }
}

function fromQuery(): EmbedPlant {
  const q = new URLSearchParams(location.search);
  const num = (k: string, d: number) => (Number.isFinite(Number(q.get(k))) && q.get(k) !== null ? Number(q.get(k)) : d);
  return {
    stage: (q.get('stage') || 'seed') as PlantStageId,
    progress: num('progress', 0),
    health: num('health', 100),
    form: (q.get('form') || 'bush') as PlantForm,
    fruitShape: (q.get('fruitShape') || 'round') as FruitShape,
    fruitColor: q.get('fruitColor') || '#E8503A',
    flowerColor: q.get('flowerColor') || '#FFC83D',
    isNight: q.get('night') === '1',
    scene: (q.get('scene') || 'natural') as SceneKey,
    decoration: (q.get('decoration') || undefined) as PotKey | undefined,
    wind: (q.get('wind') || 'off') as Wind,
    // "moisture_sensor:1,pump:0" — the type, and whether it is switched on.
    gadgets: (q.get('gadgets') || '').split(',').filter(Boolean).map((g) => {
      const [type, on] = g.split(':');
      return { type, on: on === '1' } as Gadget;
    }),
  };
}

const tell = (message: string) => window.ReactNativeWebView?.postMessage(message);

/**
 * /embed/plant — the 3D plant alone, filling the page, for the mobile app to
 * show in a WebView. The same model, scene and lighting as the plant page,
 * without the site around it. Tells the app "ready" once the 3D canvas is up,
 * or "fallback" when this phone has no WebGL, so the app can keep its own
 * drawing instead.
 */
export default function PlantEmbed() {
  const [plant, setPlant] = useState<EmbedPlant>(fromQuery);

  useEffect(() => {
    document.title = 'Sprouty 3D';
    window.__sproutyPlant = (next) => setPlant((p) => ({ ...p, ...next }));
    return () => { delete window.__sproutyPlant; };
  }, []);

  // Wait for the viewer to put its canvas on the page. Only the viewer's own
  // "no 3D here" state (its stage hidden, a drawing in its place) means
  // fallback: the ordinary "kéo để xoay" hint can show a moment before the
  // canvas does, and taking that for a failure left slow phones on the drawing.
  useEffect(() => {
    let tries = 0;
    const id = setInterval(() => {
      tries += 1;
      if (document.querySelector('.plant-embed canvas')) { tell('ready'); clearInterval(id); }
      else if (document.querySelector('.plant-embed .plant-viewer-stage[hidden]') || tries > 600) { tell('fallback'); clearInterval(id); }
    }, 50);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="plant-embed">
      <Suspense fallback={null}>
        <PlantViewer3D {...plant} />
      </Suspense>
    </div>
  );
}
