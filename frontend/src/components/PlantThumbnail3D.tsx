import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PlantArt, type PlantStageId } from './PlantArt';
import { buildPlantModel, disposePlantModel, type ModelOptions } from './plant-model';
import { plantBackdrop } from './plant-backdrop';
import { buildAmbience, sceneLighting } from './garden-ambience';
import type { SceneKey } from './garden-looks';

type Props = ModelOptions & { scene?: SceneKey };

// Cards share a renderer and keep only a still image, avoiding one WebGL
// context per plant. The interactive viewer lives on the detail page.
let renderer: T.WebGLRenderer | undefined;
let env: T.Texture | undefined;
let release: ReturnType<typeof setTimeout> | undefined;

function thumbnail({ scene: sceneKey = 'natural', ...options }: Props) {
  clearTimeout(release);
  renderer ??= new T.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
  if (!env) {
    const pmrem = new T.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    env = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
  }
  const scene = new T.Scene();
  const backdrop = plantBackdrop(sceneKey);
  scene.background = backdrop;
  const camera = new T.PerspectiveCamera(38, 1.5, .05, 30);
  camera.position.set(2.4, 1.6, 3.5); camera.lookAt(0, .4, 0);
  const light = sceneLighting(sceneKey, false);
  scene.add(new T.HemisphereLight(light.hemiSky, light.hemiGround, light.hemi));
  const sun = new T.DirectionalLight(light.sun, light.sunIntensity); sun.position.set(...light.sunPos); scene.add(sun);
  const rim = new T.DirectionalLight(light.rim, light.rimIntensity); rim.position.set(-3, 2, -2); scene.add(rim);
  const model = buildPlantModel(options); scene.add(model);
  model.traverse((obj) => {
    const material = obj instanceof T.Mesh ? (obj.material as T.MeshStandardMaterial) : null;
    if (material?.userData?.glossy) { material.envMap = env!; material.envMapIntensity = .9; }
  });
  // Caught mid-drift: a card is a still, but it should still be that place.
  const ambience = buildAmbience(sceneKey);
  if (ambience) { ambience.update(3.2); scene.add(ambience.group); }
  try {
    renderer.setSize(600, 400, false);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = light.exposure;
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL('image/png');
  } finally {
    disposePlantModel(model);
    ambience?.dispose();
    backdrop.dispose();
    release = setTimeout(() => {
      env?.dispose(); env = undefined;
      renderer?.dispose(); renderer?.forceContextLoss(); renderer = undefined;
    }, 1000);
  }
}

export default function PlantThumbnail3D(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [source, setSource] = useState('');
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      try { setSource(thumbnail(props)); } catch { setSource(''); }
    }, { rootMargin: '150px' });
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, [props.stage, props.progress, props.health, props.form, props.fruitShape, props.fruitColor, props.flowerColor, props.decoration, props.scene]);
  return <div ref={host} className="pc-model-preview">
    {source ? <img src={source} alt="Mô hình cây ở giai đoạn hiện tại" width={600} height={400} />
      : <PlantArt {...props} stage={props.stage as PlantStageId} size={200}
        isNight={props.scene === 'night'} autumn={props.scene === 'autumn'} />}
  </div>;
}
