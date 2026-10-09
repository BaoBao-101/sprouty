import * as T from 'three';
import type { SceneKey } from './garden-looks';

/**
 * Light and air for each scene.
 *
 * A backdrop alone is a picture behind the plant; the plant itself would still
 * be lit like a showroom. Each scene sets its own light — cold moonlight, a low
 * golden sun, soft spring daylight — so the leaves and the pot change colour
 * with the place. The VIP scenes also get something moving through them:
 * fireflies, falling maple leaves, drifting cherry petals.
 */

export interface SceneLighting {
  hemiSky: string;
  hemiGround: string;
  hemi: number;
  sun: string;
  sunIntensity: number;
  sunPos: [number, number, number];
  rim: string;
  rimIntensity: number;
  exposure: number;
}

const DAY: SceneLighting = {
  hemiSky: '#FFF6DE', hemiGround: '#707B65', hemi: 2.5,
  sun: '#FFF2D5', sunIntensity: 3, sunPos: [3, 5, 4],
  rim: '#D1E7EA', rimIntensity: 1.6, exposure: 1.25,
};

const LIGHTING: Record<SceneKey | 'naturalNight', SceneLighting> = {
  natural: DAY,
  naturalNight: {
    hemiSky: '#B9C6E0', hemiGround: '#3E4A45', hemi: 1.6,
    sun: '#DCE4FF', sunIntensity: 1.6, sunPos: [-2, 4, 3],
    rim: '#8FA7D6', rimIntensity: 1.2, exposure: 1.1,
  },
  night: {
    hemiSky: '#6F7FC8', hemiGround: '#1C2433', hemi: 1.3,
    sun: '#CFD9FF', sunIntensity: 2.2, sunPos: [-3, 4, 2],
    rim: '#FFD98A', rimIntensity: 1.4, exposure: 1.05,
  },
  autumn: {
    hemiSky: '#FFD7A8', hemiGround: '#7A4A2A', hemi: 2.2,
    sun: '#FFB45E', sunIntensity: 3.6, sunPos: [4, 1.6, 2.5],
    rim: '#FF8A5C', rimIntensity: 1.8, exposure: 1.2,
  },
  sakura: {
    hemiSky: '#FFF0F6', hemiGround: '#8E9E7C', hemi: 2.7,
    sun: '#FFF4EC', sunIntensity: 2.8, sunPos: [2.5, 5, 3.5],
    rim: '#F8B8D0', rimIntensity: 1.7, exposure: 1.3,
  },
};

export function sceneLighting(scene: SceneKey, night: boolean) {
  if (scene === 'natural') return night ? LIGHTING.naturalNight : LIGHTING.natural;
  return LIGHTING[scene];
}

/* ── Particles ─────────────────────────────────────────────────────────── */

export interface Ambience {
  group: T.Group;
  /** Advances the motion; `t` is seconds since the viewer started. */
  update: (t: number) => void;
  dispose: () => void;
}

/** Deterministic spread, so a reload does not reshuffle the scene. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = s;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function glowTexture(inner: string) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const c = canvas.getContext('2d')!;
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, '#FFFFFF');
  g.addColorStop(0.2, inner);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return texture;
}

/** Fireflies wandering round the plant, each blinking on its own rhythm. */
function fireflies(): Ambience {
  const rand = seeded(3);
  const group = new T.Group();
  const texture = glowTexture('rgba(255,226,120,0.9)');
  const flies = Array.from({ length: 22 }, () => {
    const material = new T.SpriteMaterial({
      map: texture,
      color: '#FFE38A',
      blending: T.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    const sprite = new T.Sprite(material);
    const size = 0.07 + rand() * 0.07;
    sprite.scale.set(size, size, size);
    group.add(sprite);
    return {
      sprite,
      radius: 0.55 + rand() * 0.9,
      height: -0.1 + rand() * 1.7,
      angle: rand() * Math.PI * 2,
      speed: (0.08 + rand() * 0.12) * (rand() < 0.5 ? -1 : 1),
      bob: 0.5 + rand() * 0.8,
      blink: 0.6 + rand() * 1.4,
      phase: rand() * 10,
    };
  });
  const update = (t: number) => {
    for (const f of flies) {
      const a = f.angle + t * f.speed;
      const r = f.radius + Math.sin(t * 0.3 + f.phase) * 0.12;
      f.sprite.position.set(Math.cos(a) * r, f.height + Math.sin(t * f.bob + f.phase) * 0.1, Math.sin(a) * r);
      f.sprite.material.opacity = 0.35 + 0.65 * Math.max(0, Math.sin(t * f.blink + f.phase));
    }
  };
  update(0);
  return {
    group,
    update,
    dispose: () => {
      flies.forEach((f) => f.sprite.material.dispose());
      texture.dispose();
    },
  };
}

/** A shape falling from above the plant to the ground, tumbling and swaying. */
function falling(
  count: number,
  shape: T.Shape,
  colors: string[],
  { size, fall, sway, seed }: { size: [number, number]; fall: [number, number]; sway: number; seed: number },
): Ambience {
  const rand = seeded(seed);
  const group = new T.Group();
  const geometry = new T.ShapeGeometry(shape, 6);
  const materials = colors.map(
    (color) => new T.MeshStandardMaterial({ color, roughness: 0.7, side: T.DoubleSide }),
  );
  const TOP = 2.3;
  const BOTTOM = -0.85;
  const items = Array.from({ length: count }, () => {
    const mesh = new T.Mesh(geometry, materials[Math.floor(rand() * materials.length)]);
    const scale = size[0] + rand() * (size[1] - size[0]);
    mesh.scale.setScalar(scale);
    group.add(mesh);
    return {
      mesh,
      angle: rand() * Math.PI * 2,
      radius: 0.35 + rand() * 1.3,
      speed: fall[0] + rand() * (fall[1] - fall[0]),
      offset: rand() * (TOP - BOTTOM),
      spin: new T.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).multiplyScalar(1.6),
      phase: rand() * 10,
    };
  });
  const update = (t: number) => {
    for (const p of items) {
      const travelled = (t * p.speed + p.offset) % (TOP - BOTTOM);
      const y = TOP - travelled;
      const drift = Math.sin(t * 0.9 + p.phase) * sway;
      p.mesh.position.set(
        Math.cos(p.angle) * p.radius + drift,
        y,
        Math.sin(p.angle) * p.radius + Math.cos(t * 0.7 + p.phase) * sway * 0.6,
      );
      p.mesh.rotation.set(t * p.spin.x + p.phase, t * p.spin.y, t * p.spin.z + p.phase);
    }
  };
  update(0);
  return {
    group,
    update,
    dispose: () => {
      geometry.dispose();
      materials.forEach((m) => m.dispose());
    },
  };
}

/** A five-lobed maple leaf, about one unit across, lobes alternating with notches. */
function mapleShape() {
  const s = new T.Shape();
  const at = (deg: number, r: number) => [Math.cos((deg * Math.PI) / 180) * r, Math.sin((deg * Math.PI) / 180) * r];
  const outline: Array<[number, number]> = [
    [195, 0.45], [167, 0.2], [140, 0.52], [115, 0.22], [90, 0.58],
    [65, 0.22], [40, 0.52], [13, 0.2], [-15, 0.45],
  ];
  s.moveTo(0, -0.12);
  for (const [deg, r] of outline) {
    const [x, y] = at(deg, r);
    s.lineTo(x, y);
  }
  s.lineTo(0, -0.12);
  return s;
}

/** A cherry petal: a rounded teardrop with a notch at the tip. */
function petalShape() {
  const s = new T.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(0.45, -0.3, 0.45, 0.35, 0.12, 0.5);
  s.lineTo(0, 0.38);
  s.lineTo(-0.12, 0.5);
  s.bezierCurveTo(-0.45, 0.35, -0.45, -0.3, 0, -0.5);
  return s;
}

/** What drifts through a scene; null for the regular garden. */
export function buildAmbience(scene: SceneKey): Ambience | null {
  if (scene === 'night') return fireflies();
  if (scene === 'autumn') {
    return falling(16, mapleShape(), ['#D9452B', '#F07A2C', '#F2A531', '#B8321F'], {
      size: [0.09, 0.14], fall: [0.18, 0.3], sway: 0.25, seed: 5,
    });
  }
  if (scene === 'sakura') {
    return falling(34, petalShape(), ['#F7B8CF', '#F39BBB', '#FCD5E2', '#FFFFFF'], {
      size: [0.05, 0.08], fall: [0.12, 0.22], sway: 0.35, seed: 9,
    });
  }
  return null;
}
