import * as T from 'three';
import type { PotKey } from './garden-looks';

/**
 * The pot under the plant.
 *
 * Every pot keeps the same opening — soil surface at y = 0, inner radius 0.57
 * — so the soil, the plant and the root view fit any of them unchanged. What
 * differs is everything a parent would notice from across the room: the
 * silhouette, the glaze, and the decoration on the body.
 *
 * Glossy materials are flagged with `userData.glossy`; the viewer gives those
 * an environment map so the glaze actually reflects something.
 */

type Add = (geometry: T.BufferGeometry, material: T.Material) => T.Mesh;

const v2 = (x: number, y: number) => new T.Vector2(x, y);

/** The inner wall and floor every pot shares, closing the lathe profile. */
const INNER = [v2(0.57, 0.05), v2(0.57, -0.04), v2(0.4, -0.75)];

/**
 * Points spaced evenly along a profile. LatheGeometry maps its v coordinate
 * by point index, so a painted texture only lands where it was drawn if the
 * points are evenly spaced along the outline.
 */
function resample(points: T.Vector2[], count: number) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    lengths.push(lengths[i - 1] + points[i].distanceTo(points[i - 1]));
  }
  const total = lengths[lengths.length - 1];
  const out: T.Vector2[] = [];
  for (let k = 0; k < count; k++) {
    const at = (k / (count - 1)) * total;
    let i = 1;
    while (i < lengths.length - 1 && lengths[i] < at) i++;
    const t = (at - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1);
    out.push(points[i - 1].clone().lerp(points[i], t));
  }
  return out;
}

/** Outer radius at height y, read off a bottom-to-top profile. */
function radiusAt(outer: T.Vector2[], y: number) {
  for (let i = 1; i < outer.length; i++) {
    const a = outer[i - 1];
    const b = outer[i];
    if ((y >= a.y && y <= b.y) || (y <= a.y && y >= b.y)) {
      const t = (y - a.y) / (b.y - a.y || 1);
      return a.x + (b.x - a.x) * t;
    }
  }
  return outer[outer.length - 1].x;
}

function glossy(params: T.MeshPhysicalMaterialParameters) {
  const m = new T.MeshPhysicalMaterial(params);
  m.userData.glossy = true;
  return m;
}

/* ── Regular ───────────────────────────────────────────────────────────── */

function plainPot(add: Add) {
  const profile = [
    v2(0.42, -0.83), v2(0.46, -0.83), v2(0.62, -0.04), v2(0.65, -0.02), v2(0.65, 0.05),
    ...INNER, v2(0.42, -0.83),
  ];
  add(new T.LatheGeometry(profile, 48), new T.MeshStandardMaterial({ color: '#B87551', roughness: 0.9 }));
}

/* ── VIP: Đất nung khắc vân ────────────────────────────────────────────── */

function terracottaPot(add: Add) {
  const clay = new T.MeshStandardMaterial({ color: '#9E4A2A', roughness: 0.82 });
  const relief = new T.MeshStandardMaterial({ color: '#C9784A', roughness: 0.75 });
  const slip = new T.MeshStandardMaterial({ color: '#E0B07A', roughness: 0.7 });

  // A heavy rolled rim, wider than the body, the way hand-thrown pots are.
  const profile = [
    v2(0.4, -0.83), v2(0.47, -0.83), v2(0.6, -0.14), v2(0.64, -0.13), v2(0.71, -0.08),
    v2(0.72, 0.0), v2(0.69, 0.07), v2(0.63, 0.08), ...INNER, v2(0.4, -0.83),
  ];
  add(new T.LatheGeometry(profile, 64), clay);

  const bodyR = (y: number) => radiusAt(profile.slice(1, 3), y);

  // Two raised cream bands framing the carved belt.
  for (const y of [-0.24, -0.66]) {
    const band = add(new T.TorusGeometry(bodyR(y) + 0.004, 0.017, 8, 64), slip);
    band.rotation.x = Math.PI / 2;
    band.position.y = y;
  }

  // The carved belt: alternating raised diamonds and leaf-shaped lozenges.
  const motifs = 18;
  for (let i = 0; i < motifs; i++) {
    const a = (i / motifs) * Math.PI * 2;
    const y = -0.45;
    const r = bodyR(y) + 0.006;
    const big = i % 2 === 0;
    const motif = add(new T.OctahedronGeometry(big ? 0.055 : 0.038, 0), big ? relief : slip);
    motif.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    motif.scale.set(big ? 0.9 : 0.7, big ? 1.5 : 1.2, 0.35);
    motif.lookAt(Math.cos(a) * 2, y, Math.sin(a) * 2);
  }
  // Small dots punched above and below the belt.
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    for (const y of [-0.31, -0.59]) {
      const dot = add(new T.SphereGeometry(0.012, 8, 6), relief);
      const r = bodyR(y) + 0.004;
      dot.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    }
  }

  // A matching saucer.
  const saucer = [v2(0, -0.9), v2(0.6, -0.9), v2(0.66, -0.86), v2(0.67, -0.82), v2(0.62, -0.83), v2(0, -0.86)];
  add(new T.LatheGeometry(saucer, 64), clay);
}

/* ── VIP: Gốm men ngọc ─────────────────────────────────────────────────── */

function ceramicPot(add: Add) {
  const celadon = glossy({
    color: '#6FA79A',
    roughness: 0.16,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    sheen: 0.3,
    sheenColor: new T.Color('#CFE9E1'),
  });
  const gold = new T.MeshStandardMaterial({ color: '#D9B45A', metalness: 1, roughness: 0.22 });
  gold.userData.glossy = true;

  // A round-bellied jar on a foot ring, narrowing to a short neck.
  const profile = [
    v2(0.3, -0.88), v2(0.38, -0.88), v2(0.38, -0.82), v2(0.52, -0.76), v2(0.68, -0.6),
    v2(0.75, -0.42), v2(0.73, -0.24), v2(0.64, -0.1), v2(0.62, -0.04), v2(0.66, 0.0),
    v2(0.66, 0.05), ...INNER, v2(0.3, -0.88),
  ];
  const outer = profile.slice(0, 11);
  add(new T.LatheGeometry(resample(outer, 28).concat(profile.slice(11)), 72), celadon);

  // Gold at the lip, round the widest point, and at the foot.
  for (const [y, r, tube] of [[0.05, 0.615, 0.028], [-0.42, 0.752, 0.011], [-0.82, 0.385, 0.012]]) {
    const ring = add(new T.TorusGeometry(r, tube, 10, 72), gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
  }
  // A scatter of tiny gold flecks in the glaze.
  for (let i = 0; i < 26; i++) {
    const a = i * 2.399;
    const y = -0.7 + ((i * 37) % 50) / 100;
    const r = radiusAt(outer.slice(3), y) + 0.004;
    const fleck = add(new T.SphereGeometry(0.009, 6, 4), gold);
    fleck.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
  }
}

/* ── VIP: Sứ men lam ───────────────────────────────────────────────────── */

let porcelainTexture: T.CanvasTexture | null = null;

/**
 * Cobalt on white, Bát Tràng style: a wave border at the top, lotus and leaves
 * round the body, a ring of lotus petals at the base. Repeats four times
 * across, so the seam of the wrap lands between two motifs.
 */
function porcelainMap() {
  if (porcelainTexture) return porcelainTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const c = canvas.getContext('2d')!;
  const blue = '#22408F';
  const wash = '#5E7FC8';
  c.fillStyle = '#F7F9FD';
  c.fillRect(0, 0, 1024, 512);

  // Top border: double line and a running wave.
  c.strokeStyle = blue;
  c.lineWidth = 6;
  for (const y of [18, 84]) {
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(1024, y);
    c.stroke();
  }
  c.lineWidth = 5;
  for (let x = 0; x < 1024; x += 64) {
    c.beginPath();
    c.arc(x + 32, 62, 22, Math.PI, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.arc(x + 40, 62, 10, Math.PI, Math.PI * 1.9);
    c.stroke();
  }

  // Body: a lotus, its leaves and a scrolling stem, four times round.
  for (let k = 0; k < 4; k++) {
    const cx = k * 256 + 128;
    const cy = 250;
    c.strokeStyle = blue;
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(cx - 128, cy + 70);
    c.bezierCurveTo(cx - 70, cy + 140, cx - 20, cy + 10, cx + 40, cy + 70);
    c.bezierCurveTo(cx + 80, cy + 110, cx + 110, cy + 60, cx + 128, cy + 70);
    c.stroke();
    for (const [lx, ly, rot] of [[cx - 80, cy + 80, -0.6], [cx + 75, cy + 85, 0.7]]) {
      c.save();
      c.translate(lx, ly);
      c.rotate(rot);
      c.fillStyle = wash;
      c.beginPath();
      c.ellipse(0, 0, 44, 22, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = blue;
      c.lineWidth = 3;
      c.stroke();
      c.beginPath();
      c.moveTo(-40, 0);
      c.lineTo(40, 0);
      c.stroke();
      c.restore();
    }
    // The flower: overlapping petals, outlined, washed in.
    for (const [px, py, pr, ang] of [
      [cx, cy - 30, 1, 0],
      [cx - 34, cy - 10, 0.85, -0.55],
      [cx + 34, cy - 10, 0.85, 0.55],
      [cx - 58, cy + 14, 0.7, -1.0],
      [cx + 58, cy + 14, 0.7, 1.0],
    ]) {
      c.save();
      c.translate(px, py);
      c.rotate(ang);
      c.scale(pr, pr);
      c.beginPath();
      c.moveTo(0, -62);
      c.bezierCurveTo(30, -40, 30, 20, 0, 34);
      c.bezierCurveTo(-30, 20, -30, -40, 0, -62);
      c.fillStyle = wash;
      c.fill();
      c.strokeStyle = blue;
      c.lineWidth = 4;
      c.stroke();
      c.restore();
    }
    c.fillStyle = blue;
    c.beginPath();
    c.ellipse(cx, cy + 36, 30, 12, 0, 0, Math.PI * 2);
    c.fill();
  }

  // Base: a ring of lotus-petal panels.
  c.strokeStyle = blue;
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(0, 410);
  c.lineTo(1024, 410);
  c.stroke();
  for (let x = 0; x < 1024; x += 64) {
    c.beginPath();
    c.moveTo(x + 4, 500);
    c.bezierCurveTo(x + 4, 440, x + 32, 418, x + 32, 418);
    c.bezierCurveTo(x + 32, 418, x + 60, 440, x + 60, 500);
    c.stroke();
    c.fillStyle = wash;
    c.beginPath();
    c.ellipse(x + 32, 470, 9, 20, 0, 0, Math.PI * 2);
    c.fill();
  }

  porcelainTexture = new T.CanvasTexture(canvas);
  porcelainTexture.colorSpace = T.SRGBColorSpace;
  porcelainTexture.anisotropy = 4;
  return porcelainTexture;
}

function porcelainPot(add: Add) {
  const painted = glossy({ map: porcelainMap(), roughness: 0.22, clearcoat: 0.9, clearcoatRoughness: 0.05 });
  const glaze = glossy({ color: '#F4F6FB', roughness: 0.2, clearcoat: 0.9, clearcoatRoughness: 0.05 });
  const cobalt = new T.MeshStandardMaterial({ color: '#22408F', roughness: 0.3 });

  // The painted body on its own lathe, with evenly spaced points, so the
  // texture's bands land where they were drawn. Built bottom to top, which is
  // also the texture's bottom-to-top: base petals low, waves at the shoulder.
  const body = resample([v2(0.64, -0.06), v2(0.635, -0.4), v2(0.6, -0.76), v2(0.5, -0.86)], 24).reverse();
  add(new T.LatheGeometry(body, 96), painted);

  // Rim, inside and base in plain white glaze.
  const rim = [v2(0.64, -0.06), v2(0.68, -0.02), v2(0.68, 0.05), ...INNER, v2(0.44, -0.86), v2(0.5, -0.86)];
  add(new T.LatheGeometry(rim, 96), glaze);
  const lip = add(new T.TorusGeometry(0.625, 0.02, 10, 96), cobalt);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = 0.05;
}

/** Adds the chosen pot to `parent` and returns it. */
export function buildPot(kind: PotKey | undefined, add: Add) {
  if (kind === 'terracotta') terracottaPot(add);
  else if (kind === 'ceramic') ceramicPot(add);
  else if (kind === 'porcelain') porcelainPot(add);
  else plainPot(add);
}
