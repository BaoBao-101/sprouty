import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { PlantForm, FruitShape } from './PlantForms';
import type { PotKey } from './garden-looks';
import { buildPot } from './plant-pots';

export interface ModelOptions {
  stage: string; progress: number; health: number; form: PlantForm;
  fruitShape: FruitShape; fruitColor: string; flowerColor: string;
  decoration?: PotKey;
}
const stages = ['seed', 'sprout', 'seedling', 'vegetative', 'budding', 'flowering', 'fruiting', 'mature'];
const v = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
const UP = v(0, 1, 0);
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

// Batch leaflets by material so a carrot does not need hundreds of draw calls.
// Keep soil and plant separate so the root inspection control can hide the pot.
function batchModel(group: T.Group) {
  for (const part of group.children) {
    const batches = new Map<T.Material, T.BufferGeometry[]>();
    for (const child of [...part.children]) {
      if (!(child instanceof T.Mesh) || Array.isArray(child.material)) continue;
      // A painted surface needs its UVs, which merging throws away.
      if ((child.material as T.MeshStandardMaterial).map) continue;
      child.updateMatrix();
      const geometry = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
      geometry.applyMatrix4(child.matrix);
      geometry.deleteAttribute('uv');
      const batch = batches.get(child.material) || [];
      batch.push(geometry); batches.set(child.material, batch);
      child.geometry.dispose(); part.remove(child);
    }
    for (const [material, geometries] of batches) {
      const merged = mergeGeometries(geometries);
      if (merged) part.add(new T.Mesh(merged, material));
      geometries.forEach(geometry => geometry.dispose());
    }
  }
  return group;
}

/** The same plant on every visit: variation that does not change between renders. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Half-widths of a blade along its length (0 at the base, 1 at the tip), as a share of its width. */
const OUTLINE = {
  oval: (t: number) => Math.sin(Math.PI * Math.pow(t, .78)),                 // basil, bean leaflet, tomato leaflet
  lance: (t: number) => Math.sin(Math.PI * Math.pow(t, .6)) * (1 - .2 * t),  // pepper: narrow, pointed
  heart: (t: number) => Math.pow(Math.sin(Math.PI * Math.pow(t, .72)), .55),  // sunflower: broad and rounded, then a point
  strap: (t: number) => Math.min(1, t * 10) * (1 - Math.pow(t, 3)),          // corn: long ribbon, pointed end
  petal: (t: number) => Math.sin(Math.PI * Math.pow(t, .65)),
  husk: (t: number) => Math.sin(Math.PI * Math.pow(t, .55)) * (1 - .3 * t),
};
type Outline = (t: number) => number;

/** Turns an object so its local +y runs along `dir` and its local +z leans to `up` (a leaf's face to the sky). */
function orient(obj: T.Object3D, dir: T.Vector3, up: T.Vector3 = UP) {
  const y = dir.clone().normalize();
  const z = up.clone().addScaledVector(y, -up.dot(y));
  if (z.lengthSq() < 1e-6) z.set(0, 0, 1).addScaledVector(y, -y.z);
  z.normalize();
  const x = new T.Vector3().crossVectors(y, z);
  obj.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, z));
}

/** Two directions across `axis`, for laying things out round it. */
function across(axis: T.Vector3): [T.Vector3, T.Vector3] {
  const a = axis.clone().normalize();
  const p = Math.abs(a.y) < .9 ? new T.Vector3().crossVectors(a, UP) : new T.Vector3().crossVectors(a, v(1, 0, 0));
  p.normalize();
  return [p, new T.Vector3().crossVectors(a, p).normalize()];
}

/**
 * Hand-built botanical forms, one per species: the pepper branches into a
 * bush and holds its slim chillies up, the tomato climbs a stake with
 * serrated compound leaves and trusses of lobed fruit, the bean twines up its
 * cane with three-part leaves and hanging pods, the corn arches long ribbon
 * leaves under a tassel and wraps its ear in husks, the sunflower turns a
 * seeded disc ringed with petals to the light, basil stacks cupped leaves in
 * crossed pairs, and the carrot raises feathery fronds over its root.
 * Soil surface is y=0; roots grow below it.
 */
export function buildPlantModel(o: ModelOptions) {
  const group = new T.Group();
  const soil = new T.Group(); soil.name = 'soil-shell'; group.add(soil);
  const plant = new T.Group(); plant.name = 'plant'; group.add(plant);
  const phase = Math.max(0, stages.indexOf(o.stage)) + Math.min(.99, Math.max(0, o.progress / 100));
  const growth = Math.min(1, Math.max(.08, (phase - .5) / 6));
  const vigor = Math.min(1, Math.max(0, o.health / 100));
  // A thirsty plant hangs its leaves.
  const wilt = 1 + (1 - vigor) * 1.4;
  const rand = seeded(o.form.length * 97 + o.fruitShape.length * 13 + o.fruitColor.charCodeAt(1));
  const jitter = (n: number) => (rand() - .5) * 2 * n;

  const tint = (hex: string) => new T.Color(hex).lerp(new T.Color('#9D9054'), (1 - vigor) * .6);
  // Light comes through a real leaf, so its underside is never black: a faint glow of its own colour.
  const leafMaterial = (hex: string, roughness = .7) => new T.MeshStandardMaterial({ color: tint(hex), emissive: tint(hex).multiplyScalar(.28), roughness, side: T.DoubleSide });
  const solid = (hex: string, roughness = .85) => new T.MeshStandardMaterial({ color: hex, roughness });
  const earth = solid('#51402F', 1);

  const mesh = (geometry: T.BufferGeometry, material: T.Material, parent = plant) => {
    const m = new T.Mesh(geometry, material); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  const tube = (points: T.Vector3[], radius: number, material: T.Material, parent = plant) =>
    mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points), 12, radius, 6, false), material, parent);
  const ellipsoid = (position: T.Vector3, scale: T.Vector3, material: T.Material, parent = plant, detail: [number, number] = [16, 10]) => {
    const m = mesh(new T.SphereGeometry(1, detail[0], detail[1]), material, parent); m.position.copy(position); m.scale.copy(scale); return m;
  };

  /**
   * A tube along `points` whose radius changes along it (t) and round it (u),
   * squashed by `flat` across one side: a stem that thins to its tip, a chilli,
   * a bean pod with its seeds showing, an ear of corn in rows of kernels.
   */
  const sweep = (points: T.Vector3[], radius: (t: number, u: number) => number, material: T.Material, opts: { radial?: number; seg?: number; flat?: number } = {}) => {
    const radial = opts.radial ?? 7, seg = opts.seg ?? Math.max(6, (points.length - 1) * 5);
    const curve = new T.CatmullRomCurve3(points);
    const geometry = new T.TubeGeometry(curve, seg, 1, radial, false);
    const position = geometry.attributes.position, c = new T.Vector3(), p = new T.Vector3();
    for (let i = 0; i <= seg; i++) {
      const t = i / seg; curve.getPointAt(t, c);
      const N = geometry.normals[i], B = geometry.binormals[i];
      for (let j = 0; j <= radial; j++) {
        const k = i * (radial + 1) + j, r = radius(t, j / radial);
        p.fromBufferAttribute(position, k).sub(c);
        const n = p.dot(N) * r * (opts.flat ?? 1), b = p.dot(B) * r;
        p.copy(c).addScaledVector(N, n).addScaledVector(B, b);
        position.setXYZ(k, p.x, p.y, p.z);
      }
    }
    geometry.computeVertexNormals();
    return mesh(geometry, material);
  };

  /**
   * A leaf, petal or husk: a blade with an outline, a crease down the middle,
   * edges that cup up, a tip that droops, and teeth when `serrate` is given.
   * Its face looks toward `up` (the sky, unless a flower faces elsewhere).
   */
  const blade = (base: T.Vector3, dir: T.Vector3, length: number, width: number, b: {
    outline: Outline; material: T.Material; droop?: number; cup?: number; serrate?: number; teeth?: number; up?: T.Vector3;
    /** Turn about its own midrib: leaves on a real plant do not all lie flat to the sky. */
    roll?: number;
  }) => {
    const rows = b.serrate ? 18 : 10, cols = 6, positions: number[] = [], indices: number[] = [];
    for (let i = 0; i <= rows; i++) {
      const t = i / rows;
      let w = b.outline(t) * width;
      if (b.serrate) w *= 1 + b.serrate * (((t * (b.teeth ?? 7)) % 1) - .5);
      const sag = -(b.droop ?? 0) * length * t * t;
      for (let j = 0; j <= cols; j++) {
        const s = (j / cols) * 2 - 1;
        positions.push(s * w, t * length, sag + (b.cup ?? 0) * w * s * s - (j === cols / 2 ? width * .04 : 0));
      }
    }
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const a = i * (cols + 1) + j, c = a + cols + 1; indices.push(a, c, a + 1, a + 1, c, c + 1);
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const m = mesh(geometry, b.material); m.position.copy(base); orient(m, dir, b.up); if (b.roll) m.rotateY(b.roll); return m;
  };

  /** A flower facing `face`: petals round a heart, cupped forward or bent back (`reflex`). */
  const bloom = (center: T.Vector3, face: T.Vector3, r: number, petals: number, f: {
    petal: T.Material; heart: T.Material; outline?: Outline; width?: number; cup?: number; reflex?: number; spin?: number;
  }) => {
    const d = face.clone().normalize(), [a1, a2] = across(d);
    ellipsoid(center.clone().addScaledVector(d, r * .08), v(r * .26, r * .26, r * .26), f.heart, plant, [10, 8]);
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * Math.PI * 2 + (f.spin ?? 0);
      const out = a1.clone().multiplyScalar(Math.cos(a)).addScaledVector(a2, Math.sin(a)).addScaledVector(d, (f.cup ?? 0) - (f.reflex ?? 0)).normalize();
      blade(center, out, r, r * (f.width ?? .5), { outline: f.outline ?? OUTLINE.petal, material: f.petal, up: d, cup: .2 });
    }
  };

  /** Fruit colour by ripeness: still green, turning, ripe. One material each, so they batch. */
  const ripeness = (unripe: string, turning: string) => [
    new T.MeshStandardMaterial({ color: unripe, roughness: .4 }),
    new T.MeshStandardMaterial({ color: turning, roughness: .38 }),
    new T.MeshStandardMaterial({ color: o.fruitColor, roughness: .32 }),
  ];
  const ripeIndex = (k: number) => (k < .34 ? 0 : k < .7 ? 1 : 2);

  // ── The pot and the soil ────────────────────────────────────────────────
  buildPot(o.decoration, (geometry, material) => mesh(geometry, material, soil));
  const dirt = mesh(new T.CylinderGeometry(.57, .42, .73, 40), earth, soil); dirt.position.y = -.38;
  // Small deterministic grains make the soil read as a surface without textures.
  for (let i = 0; i < 28; i++) {
    const a = i * 2.399, r = .1 + Math.sqrt((i + 1) / 28) * .42;
    ellipsoid(v(Math.cos(a) * r, -.008, Math.sin(a) * r), v(.024, .014, .018), earth, soil);
  }

  // ── Seed and sprout: the same for every plant but the grasses ───────────
  const firstGreen = leafMaterial('#5E9A3E', .75);
  const firstStem = solid('#6B9447', .9);
  if (phase < 1) {
    ellipsoid(v(0, .04, 0), v(.065, .10, .045), solid('#947145', 1));
    if (o.progress > 45) tube([v(0, .06, 0), v(.025, .13, 0), v(.07, .15, 0)], .008, firstStem);
    return batchModel(group);
  }
  if (phase < 2) {
    const h = .13 + growth * .4;
    tube([v(0, 0, 0), v(.025, h * .65, 0), v(0, h, 0)], .012, firstStem);
    if (o.form === 'stalk') blade(v(0, h * .3, 0), v(.15, 1, .08), h + .12, .028, { outline: OUTLINE.strap, material: firstGreen, droop: .3 });
    else for (const side of [-1, 1]) blade(v(0, h, 0), v(side, .35, .1), o.form === 'head' ? .16 : .12, .07, { outline: OUTLINE.oval, material: firstGreen, cup: .3, droop: .1 });
    return batchModel(group);
  }

  // ── Carrot: feathery fronds over an orange root ─────────────────────────
  if (o.form === 'root') {
    const green = leafMaterial('#4F8E33', .78), stalk = solid('#5E8A3A', .9);
    // Carrot taproot: a broad shoulder narrowing continuously into a fine tip.
    const length = .16 + growth * .55, width = .025 + Math.max(0, phase - 3) * .026;
    const points = [[.002, -length], [width * .25, -length * .8], [width * .7, -length * .4], [width, -.06], [width * .8, .025], [0, .035]].map(([x, y]) => new T.Vector2(x, y));
    mesh(new T.LatheGeometry(points, 32), new T.MeshStandardMaterial({ color: o.fruitColor, roughness: .85 }));
    for (let i = 0; i < 5; i++) {
      const y = -length * (.25 + i * .13), a = i * 2.4;
      tube([v(0, y, 0), v(Math.cos(a) * width * 1.2, y - .025, Math.sin(a) * width * 1.2), v(Math.cos(a) * width * 1.5, y - .065, Math.sin(a) * width * 1.5)], .0025, earth);
    }
    const fronds = 5 + Math.floor(growth * 4);
    for (let i = 0; i < fronds; i++) {
      const a = i * 2.399, h = (.4 + growth * .7) * (1 - (i % 3) * .1), reach = .16 + growth * .35;
      const end = v(Math.cos(a) * reach, h * (.72 + vigor * .28), Math.sin(a) * reach);
      tube([v(0, .025, 0), end.clone().multiplyScalar(.5).add(v(0, .08, 0)), end], .008, stalk);
      const cross = v(-Math.sin(a), 0, Math.cos(a));
      for (let j = 2; j < 9; j++) {
        const t = j / 10, at = end.clone().multiplyScalar(t), span = (.11 + growth * .08) * Math.sin(t * Math.PI);
        for (const side of [-1, 1]) {
          const tip = at.clone().addScaledVector(cross, span * side).add(v(0, .065, 0));
          tube([at, tip], .003, stalk);
          for (let k = 1; k <= 3; k++) {
            const b = at.clone().lerp(tip, k / 4);
            blade(b, v(Math.cos(a), .55, Math.sin(a)), .05, .012, { outline: OUTLINE.lance, material: green });
            blade(b, v(-Math.cos(a), .75, -Math.sin(a)), .05, .012, { outline: OUTLINE.lance, material: green });
          }
        }
      }
    }
    return batchModel(group);
  }

  // A bean climbs a bamboo cane and a tomato is tied to a stake; showing the
  // support teaches that they need one. The bean's stem winds round the cane;
  // the tomato's stem is tied to its stake with twine.
  const support = (x: number, top: number, ties: T.Vector3[] = []) => {
    // A cane pushed into the soil stands firm in the wind, and so does the
    // stem tied to it; only the leaves move (plant-wind.ts).
    plant.userData.tied = true;
    const cane = solid('#B39A6B', .95); cane.userData.still = true;
    const node = solid('#8E7650', 1); node.userData.still = true;
    tube([v(x, -.06, 0), v(x, top, 0)], .02, cane);
    ellipsoid(v(x, top, 0), v(.02, .007, .02), node);
    for (let y = .3; y < top - .08; y += .34) {
      const ring = mesh(new T.TorusGeometry(.021, .004, 6, 16), node); ring.position.set(x, y, 0); ring.rotation.x = Math.PI / 2;
    }
    const twine = solid('#D9C9A0', 1); twine.userData.still = true;
    for (const at of ties) {
      tube([v(x, at.y + .01, 0), at.clone().add(v(-.012, .004, 0))], .005, twine);
      const loop = mesh(new T.TorusGeometry(.024, .005, 6, 14), twine); loop.position.set(x, at.y + .01, 0); loop.rotation.x = Math.PI / 2;
    }
  };

  // ── Pepper: a branching bush holding up slim, glossy chillies ───────────
  if (o.form === 'bush' && o.fruitShape === 'cone') {
    const leafDark = leafMaterial('#3A7A2E', .42), leafYoung = leafMaterial('#58983C', .45);
    const bark = solid('#4B7A33', .8);
    const H = .24 + growth * .78;
    const trunkTop = v(.01, H * .36, 0);
    sweep([v(0, -.02, 0), v(.012, H * .18, 0), trunkTop], (t) => .026 - t * .008, bark);
    // Glossy, smooth-edged leaves, egg-shaped to a point, on short stalks.
    const pepperLeaf = (at: T.Vector3, out: T.Vector3, size: number, young = false) => {
      const dir = out.clone().normalize();
      const end = at.clone().addScaledVector(dir, .02);
      tube([at, end], .0035, bark);
      blade(end, dir.clone().add(v(0, .1, 0)), size, size * .46, { outline: OUTLINE.lance, material: young ? leafYoung : leafDark, droop: .32 * wilt, cup: .16, roll: jitter(.7) });
    };
    // Peppers fork again and again into Y shapes; leaves crowd at the ends.
    const forks: T.Vector3[] = [], tips: Array<{ at: T.Vector3; dir: T.Vector3 }> = [];
    const branch = (from: T.Vector3, dir: T.Vector3, len: number, r: number, depth: number) => {
      const end = from.clone().addScaledVector(dir, len);
      sweep([from, from.clone().lerp(end, .5).add(v(0, len * .05, 0)), end], (t) => r * (1 - t * .3), bark, { radial: 6 });
      const [a1] = across(dir);
      for (const f of [.3, .55, .8]) {
        const side = f === .55 ? -1 : 1;
        pepperLeaf(from.clone().lerp(end, f), a1.clone().multiplyScalar(side).add(v(jitter(.3), .15, jitter(.3))), (.12 + growth * .07) * (.85 + rand() * .3));
      }
      if (depth > 0) {
        forks.push(end);
        for (const side of [-1, 1]) {
          const [p] = across(dir);
          const child = dir.clone().addScaledVector(p, side * (.5 + jitter(.15))).add(v(jitter(.15), .25, jitter(.15))).normalize();
          branch(end, child, len * .8, r * .72, depth - 1);
        }
      } else tips.push({ at: end, dir });
    };
    const depth = phase < 3 ? 0 : phase < 4 ? 1 : 2;
    if (depth === 0) tips.push({ at: trunkTop, dir: UP.clone() });
    else for (let i = 0; i < 3; i++) {
      const a = i * 2.1 + .4 + jitter(.25);
      branch(trunkTop, v(Math.cos(a) * .6, 1, Math.sin(a) * .6).normalize(), H * (depth === 1 ? .5 : .33), .017, depth - 1);
    }
    for (const { at, dir } of tips) {
      for (let k = 0; k < 5; k++) {
        const a = k * 1.3 + jitter(.3);
        pepperLeaf(at, v(Math.cos(a), .4 + dir.y * .3, Math.sin(a)), (.1 + growth * .08) * (.8 + rand() * .3), k > 2);
      }
    }
    if (phase >= 4 && phase < 5) for (const at of forks.slice(0, 5)) ellipsoid(at.clone().add(v(0, -.025, 0)), v(.012, .016, .012), leafYoung);
    // Small white flowers nod from the forks…
    if (phase >= 5) {
      const petal = new T.MeshStandardMaterial({ color: o.flowerColor, roughness: .7, side: T.DoubleSide });
      const heart = solid('#C9C98A', .8);
      const spots = phase < 6 ? [...forks, ...tips.map(t => t.at)] : forks.slice(0, 2);
      for (const at of spots) {
        const hang = at.clone().add(v(jitter(.03), -.045, jitter(.03)));
        tube([at, at.clone().lerp(hang, .5).add(v(.01, .01, 0)), hang], .0028, bark);
        bloom(hang, v(jitter(.3), -1, jitter(.3)), .038, 6, { petal, heart, width: .5, cup: .25 });
      }
    }
    // …and the chillies stand up from them, slim and pointed, green turning red.
    if (phase >= 6) {
      const colours = ripeness('#3F8A2B', '#E2802A');
      const calyx = leafMaterial('#3E7A2C', .6);
      const spots = [...tips.map(t => t.at), ...forks];
      const count = Math.min(spots.length * 2, 4 + Math.floor((phase - 6) * 6) + 2);
      for (let i = 0; i < count; i++) {
        const at = spots[i % spots.length], a = i * 2.3 + jitter(.4);
        const lean = v(Math.cos(a) * .35, 1, Math.sin(a) * .35).normalize();
        const base = at.clone().add(v(Math.cos(a) * .025, .012, Math.sin(a) * .025));
        tube([at, base], .004, bark);
        const length = (.1 + growth * .06) * (.85 + rand() * .3);
        const tip = base.clone().addScaledVector(lean, length).add(v(Math.cos(a) * .012, 0, Math.sin(a) * .012));
        ellipsoid(base, v(.013, .008, .013), calyx, plant, [10, 6]);
        const k = clamp01((phase - 6) * 1.4 + .15 - rand() * .55);
        sweep([base, base.clone().lerp(tip, .5).add(v(Math.cos(a) * .006, 0, Math.sin(a) * .006)), tip],
          (t) => .017 * Math.pow(1 - t, .65) * Math.min(1, .7 + t * 5), colours[ripeIndex(k)], { radial: 9, seg: 12 });
      }
    }
    return batchModel(group);
  }

  // ── Tomato: tied to its stake, serrated compound leaves, lobed fruit ────
  if (o.form === 'bush') {
    const leafMat = leafMaterial('#3E7834', .85), leafYoung = leafMaterial('#5A9440', .85);
    const stemMat = solid('#5E8A3E', 1);
    const H = .28 + growth * 1.12, caneX = -.09;
    const stemAt = (t: number) => v(Math.sin(t * 9) * .016, t * H, Math.cos(t * 7) * .012);
    support(caneX, H + .07, [.3, .58, .86].filter(t => t * H >= .1).map(stemAt));
    sweep(Array.from({ length: 12 }, (_, i) => stemAt(i / 11)), (t) => .021 - t * .01, stemMat);
    // A tomato leaf is a stalk of toothed leaflets in pairs, with one at the end.
    const compound = (base: T.Vector3, a: number, len: number, young: boolean) => {
      const out = v(Math.cos(a), .32, Math.sin(a)).normalize();
      const end = base.clone().addScaledVector(out, len).add(v(0, -len * .18 * wilt, 0));
      const mid = base.clone().lerp(end, .5).add(v(0, len * .1, 0));
      tube([base, mid, end], .005, stemMat);
      const curve = new T.CatmullRomCurve3([base, mid, end]);
      const side = v(-Math.sin(a), 0, Math.cos(a));
      const material = young ? leafYoung : leafMat;
      for (const f of [.38, .62, .84]) {
        const at = curve.getPointAt(f), size = (.085 + growth * .04) * (.8 + f * .3);
        for (const s of [-1, 1]) blade(at, side.clone().multiplyScalar(s).addScaledVector(out, .45).add(v(0, .1, 0)), size, size * .55,
          { outline: OUTLINE.oval, material, serrate: .16, teeth: 7, droop: .3 * wilt, cup: .12, roll: s * (.35 + jitter(.25)) });
      }
      blade(end, out.clone().add(v(0, -.05, 0)), .1 + growth * .04, .058, { outline: OUTLINE.oval, material, serrate: .16, teeth: 7, droop: .28 * wilt, cup: .12, roll: jitter(.5) });
    };
    const leaves = 4 + Math.round(growth * 7);
    for (let i = 0; i < leaves; i++) {
      const t = .12 + (i / Math.max(1, leaves - 1)) * .8;
      compound(stemAt(t), i * 2.399 + .5, (.22 + growth * .17) * (1 - t * .35), t > .7);
    }
    // Clusters ("trusses") of yellow star flowers, petals swept back…
    const trusses = phase >= 6 ? [.3, .48, .66].slice(0, 1 + Math.round(growth * 2)) : phase >= 5 ? [.45, .7] : [];
    trusses.forEach((t, n) => {
      const a = n * 2.4 + 1.3, base = stemAt(t), out = v(Math.cos(a), -.1, Math.sin(a)).normalize();
      const end = base.clone().addScaledVector(out, .14);
      tube([base, base.clone().lerp(end, .5).add(v(0, .025, 0)), end], .0045, stemMat);
      const ripeHere = phase >= 6 && n < Math.round((phase - 5.7) * 3);
      if (!ripeHere && phase >= 5) {
        const petal = new T.MeshStandardMaterial({ color: o.flowerColor, roughness: .7, side: T.DoubleSide }), heart = solid('#E2B323', .7);
        for (let k = 0; k < 4; k++) {
          const at = base.clone().lerp(end, .4 + k * .2).add(v(jitter(.02), -.03 - k * .006, jitter(.02)));
          bloom(at, v(out.x, -.6, out.z), .036, 5, { petal, heart, outline: OUTLINE.lance, width: .34, reflex: .5, spin: k });
        }
        return;
      }
      // …that become fruit: round, a little flat, faintly lobed, with a green star on top.
      if (phase >= 6) {
        const colours = ripeness('#7FAE4C', '#EE9A3A'), calyx = leafMaterial('#3F7A2E', .7);
        const k = clamp01((phase - 6) * 1.2 + .45 - n * .35);
        for (let f = 0; f < 3 + (n === 0 ? 1 : 0); f++) {
          const r = (.045 + growth * .022) * (.75 + rand() * .3);
          const hangFrom = base.clone().lerp(end, .45 + f * .18);
          const center = hangFrom.clone().add(v(jitter(.035), -r - .03, jitter(.035)));
          tube([hangFrom, center.clone().add(v(0, r * .85, 0))], .003, stemMat);
          const fruit = new T.SphereGeometry(1, 22, 14), p = fruit.attributes.position, q = new T.Vector3();
          for (let i = 0; i < p.count; i++) {
            q.fromBufferAttribute(p, i);
            const lobe = 1 + .05 * Math.cos(5 * Math.atan2(q.z, q.x)) * (1 - Math.abs(q.y));
            q.x *= lobe; q.z *= lobe; q.y *= .8; if (q.y > .6) q.y -= (q.y - .6) * .5;
            p.setXYZ(i, q.x, q.y, q.z);
          }
          fruit.computeVertexNormals();
          const m = mesh(fruit, colours[ripeIndex(clamp01(k - rand() * .2))]); m.position.copy(center); m.scale.setScalar(r);
          const top = center.clone().add(v(0, r * .72, 0));
          for (let s = 0; s < 5; s++) {
            const sa = s * 1.257 + f;
            blade(top, v(Math.cos(sa), .25, Math.sin(sa)), r * .7, r * .2, { outline: OUTLINE.lance, material: calyx, droop: .2 });
          }
        }
      }
    });
    if (phase >= 4 && phase < 5) for (const t of [.5, .74]) ellipsoid(stemAt(t).add(v(.06, -.02, .03)), v(.012, .018, .012), leafYoung);
    return batchModel(group);
  }

  // ── Bean: twining up its cane, three-part leaves, pods hanging in pairs ─
  if (o.form === 'vine') {
    const leafMat = leafMaterial('#4C8A3A', .7), leafYoung = leafMaterial('#68A54A', .7);
    const stemMat = solid('#5C8A3A', .9);
    const H = .3 + growth * 1.15;
    const stemAt = (t: number) => v(Math.sin(t * 15) * .042, t * H, Math.cos(t * 15) * .042);
    support(0, H + .07);
    sweep(Array.from({ length: 22 }, (_, i) => stemAt(i / 21)), (t) => .012 - t * .004, stemMat, { radial: 6, seg: 60 });
    const nodes = 3 + Math.round(growth * 6);
    const at = (i: number) => .16 + (i / Math.max(1, nodes - 1)) * .78;
    for (let i = 0; i < nodes; i++) {
      const t = at(i), base = stemAt(t), a = (i % 2 ? Math.PI : 0) + .6 + jitter(.35);
      const out = v(Math.cos(a), .45, Math.sin(a)).normalize();
      const end = base.clone().addScaledVector(out, .09 + growth * .05);
      tube([base, base.clone().lerp(end, .5).add(v(0, .015, 0)), end], .004, stemMat);
      const size = (.1 + growth * .06) * (1 - t * .25), material = t > .75 ? leafYoung : leafMat;
      const side = v(-Math.sin(a), 0, Math.cos(a));
      // Three leaflets: one ahead, one each side.
      blade(end, out.clone().add(v(0, -.15, 0)), size * 1.1, size * .76, { outline: OUTLINE.oval, material, droop: .3 * wilt, cup: .1, roll: jitter(.5) });
      for (const s of [-1, 1]) blade(end, side.clone().multiplyScalar(s).addScaledVector(out, .3), size * .92, size * .64, { outline: OUTLINE.oval, material, droop: .3 * wilt, cup: .1, roll: s * (.4 + jitter(.2)) });
    }
    // Pale pea-shaped flowers in the leaf joints.
    if (phase >= 5) {
      const petal = new T.MeshStandardMaterial({ color: o.flowerColor, roughness: .7, side: T.DoubleSide }), heart = solid('#E9DFA8', .8);
      for (let i = 1; i < nodes; i += 2) {
        if (phase >= 6 && i < nodes - 2) continue;
        const base = stemAt(at(i)), a = (i % 2 ? 0 : Math.PI) + .9;
        for (let k = 0; k < 2; k++) {
          const c = base.clone().add(v(Math.cos(a) * (.05 + k * .02), -.02 - k * .02, Math.sin(a) * (.05 + k * .02)));
          tube([base, c], .003, stemMat);
          bloom(c, v(Math.cos(a), .2, Math.sin(a)), .024, 3, { petal, heart, outline: OUTLINE.oval, width: .9, cup: .5 });
        }
      }
    }
    // Long slim pods hang in pairs, the seeds bulging along them.
    if (phase >= 6) {
      const pod = new T.MeshStandardMaterial({ color: new T.Color('#9BCB6A').lerp(new T.Color(o.fruitColor), clamp01((phase - 6) * 1.5)), roughness: .5 });
      const pairs = Math.min(nodes - 1, 2 + Math.round((phase - 6) * 3));
      for (let p = 0; p < pairs; p++) {
        const i = 1 + p * 2 > nodes - 1 ? p : 1 + p * 2;
        const base = stemAt(at(i) - .03), a = (i % 2 ? 0 : Math.PI) + .2 + p * .5;
        for (const s of [0, 1]) {
          const aa = a + (s ? .35 : -.2), len = (.17 + growth * .08) * (.85 + rand() * .2);
          const top = base.clone().add(v(Math.cos(aa) * .06, -.01, Math.sin(aa) * .06));
          tube([base, top], .0035, stemMat);
          const bottom = top.clone().add(v(Math.cos(aa) * .05, -len, Math.sin(aa) * .05));
          const bend = top.clone().lerp(bottom, .55).add(v(Math.cos(aa + 1.4) * .025, 0, Math.sin(aa + 1.4) * .025));
          sweep([top, bend, bottom], (t) => .014 * Math.min(1, t * 9, (1 - t) * 5) * (1 + .2 * Math.max(0, Math.sin(t * Math.PI * 5.5))), pod, { radial: 8, seg: 22, flat: .55 });
        }
      }
    }
    return batchModel(group);
  }

  // ── Corn: a jointed stalk, arching ribbon leaves, a tassel and a husked ear
  if (o.form === 'stalk') {
    const leafMat = leafMaterial('#5E9A3A', .65), leafOld = leafMaterial('#4E8A33', .7);
    const stalkMat = solid('#6E9B44', .75), nodeMat = solid('#8FB060', .8);
    const H = .3 + growth * 1.15;
    sweep([v(0, -.02, 0), v(.008, H * .5, 0), v(0, H, 0)], (t) => .042 - t * .024, stalkMat, { radial: 10 });
    const leaves = 4 + Math.round(growth * 7);
    for (let i = 0; i < leaves; i++) {
      const t = .07 + (i / leaves) * .82, y = t * H, r = .042 - t * .024;
      const ring = mesh(new T.TorusGeometry(r + .002, .0045, 6, 18), nodeMat); ring.position.set(0, y, 0); ring.rotation.x = Math.PI / 2;
      // Two ranks in one plane, one leaf each side in turn. The plane runs across
      // the default view (the camera looks in from about 56° round from +x), so
      // the leaves spread left and right instead of pointing at the viewer.
      const a = (i % 2 ? Math.PI : 0) - .6 + jitter(.25);
      const out = v(Math.cos(a), 0, Math.sin(a));
      const size = (.28 + growth * .4) * (1 - Math.abs(t - .45) * .7);
      // A short young leaf near the top is a narrow one, still unrolling.
      const narrow = Math.min(1, Math.max(.45, size / .45));
      blade(v(Math.cos(a) * r, y + .02, Math.sin(a) * r), out.clone().multiplyScalar(.55).add(v(0, 1, 0)), size, (.03 + growth * .025) * narrow,
        { outline: OUTLINE.strap, material: t < .3 ? leafOld : leafMat, droop: 1.05 * wilt * narrow, cup: .25 });
    }
    // Brace roots at the foot hold the tall stalk up.
    if (phase >= 4) for (let i = 0; i < 6; i++) {
      const a = i * 1.05 + .3;
      tube([v(Math.cos(a) * .035, .08, Math.sin(a) * .035), v(Math.cos(a) * .08, .03, Math.sin(a) * .08), v(Math.cos(a) * .1, -.02, Math.sin(a) * .1)], .007, nodeMat);
    }
    // The tassel: the male flower, a spray of thin spikes at the top.
    if (phase >= 5) {
      const tassel = solid('#D8C27A', .8);
      tube([v(0, H - .02, 0), v(0, H + .2, 0)], .006, tassel);
      for (let i = 0; i < 8; i++) {
        const a = i * 2.399, from = v(0, H + .03 + (i % 3) * .03, 0);
        tube([from, from.clone().add(v(Math.cos(a) * .07, .06, Math.sin(a) * .07)), from.clone().add(v(Math.cos(a) * .15, .01, Math.sin(a) * .15))], .004, tassel);
      }
    }
    // The ear, wrapped in husk leaves, with silk out of its tip; at harvest the husk opens on rows of kernels.
    if (phase >= 6) {
      const a = .5, y = H * .45, out = v(Math.cos(a), 0, Math.sin(a));
      const base = v(Math.cos(a) * .045, y, Math.sin(a) * .045), axis = out.clone().multiplyScalar(.32).add(v(0, 1, 0)).normalize();
      const len = .2 + growth * .1, open = clamp01((phase - 6.5) * 2);
      const tip = base.clone().addScaledVector(axis, len);
      const kernels = new T.MeshStandardMaterial({ color: o.fruitColor, roughness: .45 });
      // Fullest near the shank, tapering to a rounded tip, in bumpy rows.
      sweep([base, base.clone().lerp(tip, .5), tip], (t, u) => .04 * Math.min(1, t * 7) * Math.pow(1 - Math.pow(t, 2.5), .4)
        * (1 + .07 * Math.abs(Math.sin(u * Math.PI * 14)) * Math.abs(Math.sin(t * Math.PI * 16))), kernels, { radial: 28, seg: 34 });
      const husk = leafMaterial('#7DAA4E', .7), [h1, h2] = across(axis);
      for (let k = 0; k < 6; k++) {
        const ha = (k / 6) * Math.PI * 2, round = h1.clone().multiplyScalar(Math.cos(ha)).addScaledVector(h2, Math.sin(ha));
        const peel = k < 3 ? open : open * .2;
        blade(base.clone().addScaledVector(round, .038), axis.clone().addScaledVector(round, .02 + peel * 1.3), len * 1.08, .046,
          // Faced outward with the edges curling in, so each husk leaf hugs the ear.
          { outline: OUTLINE.husk, material: husk, cup: -.9 + peel * .8, up: round });
      }
      const silk = solid(phase >= 7 ? '#8A5A2E' : '#E6D49A', .9);
      for (let k = 0; k < 9; k++) {
        const sa = k * .7, end = tip.clone().add(v(Math.cos(sa) * .05, .02 - (k % 3) * .03, Math.sin(sa) * .05));
        tube([tip.clone().addScaledVector(axis, .02), tip.clone().addScaledVector(axis, .05).add(v(Math.cos(sa) * .02, 0, Math.sin(sa) * .02)), end], .0018, silk);
      }
    }
    return batchModel(group);
  }

  // ── Sunflower: a sturdy stalk, big heart leaves, a seeded face to the sun
  if (o.form === 'head') {
    const leafMat = leafMaterial('#4E7F2E', .8), leafYoung = leafMaterial('#679A3E', .8);
    const stemMat = solid('#5F8A3A', 1);
    const H = .3 + growth * 1.05;
    // Turned to the light, and bowing as the head fills with seed.
    const nod = phase >= 6 ? .55 : phase >= 5 ? .22 : .1;
    const face = v(.55, -nod, 1).normalize();
    const top = v(face.x * .05, H, face.z * .05);
    sweep([v(0, -.02, 0), v(.01, H * .5, 0), v(0, H * .88, 0), top], (t) => .034 - t * .014, stemMat, { radial: 9 });
    const leaves = 4 + Math.round(growth * 6);
    for (let i = 0; i < leaves; i++) {
      const t = .12 + (i / leaves) * .72, a = i * 2.399 + .3, base = v(0, t * H, 0);
      const out = v(Math.cos(a), .35, Math.sin(a)).normalize(), end = base.clone().addScaledVector(out, .1 * (1 - t * .4));
      tube([base, base.clone().lerp(end, .5).add(v(0, .015, 0)), end], .006, stemMat);
      const size = (.15 + growth * .17) * (1 - t * .45);
      blade(end, out.clone().add(v(0, -.2, 0)), size, size * .92, { outline: OUTLINE.heart, material: t > .65 ? leafYoung : leafMat, serrate: .07, teeth: 9, droop: .45 * wilt, cup: .1, roll: jitter(.5) });
    }
    const bract = leafMaterial('#4F7F30', .8);
    if (phase >= 4 && phase < 5) {
      // The bud: a green ball wrapped in pointed bracts.
      ellipsoid(top, v(.05, .045, .05), bract);
      for (let k = 0; k < 12; k++) {
        const ka = (k / 12) * Math.PI * 2, [a1, a2] = across(face);
        const out = a1.clone().multiplyScalar(Math.cos(ka)).addScaledVector(a2, Math.sin(ka)).addScaledVector(face, .9).normalize();
        blade(top.clone().addScaledVector(face, -.02), out, .07, .022, { outline: OUTLINE.lance, material: bract, up: face, cup: .3 });
      }
    }
    if (phase >= 5) {
      const R = .1 + growth * .06, center = top.clone().addScaledVector(face, .02);
      const disc = mesh(new T.CylinderGeometry(R, R * .96, .035, 36), solid('#4A2E1A', 1)); disc.position.copy(center); orient(disc, face);
      // Seeds packed in the sunflower's spirals: each one at the golden angle from the last.
      const seedMats = [solid('#3A2414', .9), solid(phase >= 6 ? o.fruitColor : '#5B3A24', .9)];
      const [a1, a2] = across(face), dome = center.clone().addScaledVector(face, .018);
      for (let s = 0; s < 110; s++) {
        const r = Math.sqrt(s / 110) * R * .92, sa = s * 2.39996;
        const at = dome.clone().addScaledVector(a1, Math.cos(sa) * r).addScaledVector(a2, Math.sin(sa) * r).addScaledVector(face, (1 - r / R) * .012);
        const seed = mesh(new T.SphereGeometry(1, 6, 4), seedMats[s % 2]); seed.position.copy(at); orient(seed, face);
        seed.scale.set(.0085, .005, .0085);
      }
      // Two rings of ray petals, the back ring deeper yellow; past flowering they wilt and fold back.
      const fade = clamp01(phase - 6);
      const petalFront = new T.MeshStandardMaterial({ color: new T.Color(o.flowerColor).lerp(new T.Color('#B98A34'), fade * .7), roughness: .65, side: T.DoubleSide });
      const petalBack = new T.MeshStandardMaterial({ color: new T.Color('#F2A81E').lerp(new T.Color('#9C7330'), fade * .7), roughness: .7, side: T.DoubleSide });
      const rings: Array<[number, T.MeshStandardMaterial, number, number]> = [[21, petalFront, 0, .12], [13, petalBack, .15, -.08]];
      for (const [count, material, spin, lift] of rings) {
        const shown = fade > .5 ? Math.round(count * (1 - (fade - .5))) : count;
        for (let k = 0; k < shown; k++) {
          const ka = (k / count) * Math.PI * 2 + spin;
          const out = a1.clone().multiplyScalar(Math.cos(ka)).addScaledVector(a2, Math.sin(ka)).addScaledVector(face, lift - fade * .6).normalize();
          const root = center.clone().addScaledVector(a1, Math.cos(ka) * R * .92).addScaledVector(a2, Math.sin(ka) * R * .92);
          blade(root, out, R * (1.05 + jitter(.1)), R * .32, { outline: OUTLINE.petal, material, up: face, cup: .15, droop: .1 + fade * .4 });
        }
      }
      // Green bracts behind the petals.
      for (let k = 0; k < 16; k++) {
        const ka = (k / 16) * Math.PI * 2 + .1;
        const out = a1.clone().multiplyScalar(Math.cos(ka)).addScaledVector(a2, Math.sin(ka)).addScaledVector(face, -.35).normalize();
        blade(center.clone().addScaledVector(face, -.02).addScaledVector(out, R * .6), out, R * .55, R * .2, { outline: OUTLINE.lance, material: bract, up: face });
      }
    }
    return batchModel(group);
  }

  // ── Basil (rau thơm): several stems of cupped, glossy leaves in crossed pairs
  const leafMat = leafMaterial('#3F8C35', .55), leafYoung = leafMaterial('#58A043', .55);
  const stemMat = solid('#6E8F45', .85);
  const H = .12 + growth * .36;
  const stems = phase < 3 ? 2 : phase < 5 ? 4 : 5;
  for (let s = 0; s < stems; s++) {
    const a = s * 2.2 + .3, lean = s === 0 ? .05 : .42 + jitter(.1);
    const start = v(Math.cos(a) * .015 * s, .0, Math.sin(a) * .015 * s);
    const dir = v(Math.cos(a) * lean, 1, Math.sin(a) * lean).normalize();
    const len = H * (s === 0 ? 1 : .82 + jitter(.06));
    const end = start.clone().addScaledVector(dir, len);
    // Basil stems are square: four sides.
    sweep([start, start.clone().lerp(end, .5).add(v(jitter(.01), 0, jitter(.01))), end], (t) => .011 - t * .004, stemMat, { radial: 4 });
    const pairs = 3 + Math.round(growth * 2);
    for (let p = 0; p < pairs; p++) {
      const t = .2 + (p / pairs) * .75, at = start.clone().lerp(end, t), turn = a + p * Math.PI / 2;
      const size = (.085 + growth * .06) * (1.15 - t * .45);
      for (const side of [-1, 1]) {
        const out = v(Math.cos(turn) * side, .5, Math.sin(turn) * side).normalize();
        const leafBase = at.clone().addScaledVector(out, .012);
        tube([at, leafBase], .0035, stemMat);
        blade(leafBase, out.clone().add(v(0, -.1, 0)), size, size * .76, { outline: OUTLINE.oval, material: t > .75 ? leafYoung : leafMat, cup: .42, droop: .2 * wilt, roll: side * .3 + jitter(.3) });
      }
    }
    // The growing tip: a tight cluster of small young leaves.
    for (let k = 0; k < 4; k++) {
      const ka = a + k * Math.PI / 2;
      blade(end, v(Math.cos(ka) * .6, 1, Math.sin(ka) * .6), .04 + growth * .02, .028, { outline: OUTLINE.oval, material: leafYoung, cup: .5 });
    }
  }
  return batchModel(group);
}

export function disposePlantModel(root: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>();
  root.traverse(obj => { if (obj instanceof T.Mesh) { geometries.add(obj.geometry); for (const mat of Array.isArray(obj.material) ? obj.material : [obj.material]) materials.add(mat); } });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
}
