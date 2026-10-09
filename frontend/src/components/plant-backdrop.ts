import * as T from 'three';
import type { SceneKey } from './garden-looks';

/**
 * The painted landscape behind the orbitable model.
 *
 * `natural` is the regular garden and follows the real clock. The VIP scenes
 * are whole places of their own — a starry night, an autumn sunset, a spring
 * of cherry blossom — painted so they read as different at a glance, not as
 * the same hill in a slightly different tint. Everything busy is kept to the
 * edges and the sky, so the plant in the middle stays the subject.
 */

const W = 900;
const H = 1000;

/** Deterministic, so the same scene paints the same stars every time. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Ctx = CanvasRenderingContext2D;

function gradientSky(c: Ctx, stops: Array<[number, string]>, to = 850) {
  const sky = c.createLinearGradient(0, 0, 0, to);
  for (const [at, color] of stops) sky.addColorStop(at, color);
  c.fillStyle = sky;
  c.fillRect(0, 0, W, H);
}

function glow(c: Ctx, x: number, y: number, r: number, color: string, alpha = 1) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.save();
  c.globalAlpha = alpha;
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

function hill(c: Ctx, color: string, y0: number, curves: number[][]) {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(0, y0);
  for (const [a, b, d, e, f, g] of curves) c.bezierCurveTo(a, b, d, e, f, g);
  c.lineTo(W, H);
  c.lineTo(0, H);
  c.fill();
}

function clouds(c: Ctx, color: string, alpha: number) {
  c.fillStyle = color;
  for (const [x, y, scale] of [[130, 195, 1], [715, 300, 0.72], [365, 95, 0.45]]) {
    c.save();
    c.translate(x, y);
    c.scale(scale, scale);
    c.globalAlpha = alpha;
    c.beginPath();
    c.ellipse(-30, 10, 55, 23, 0, 0, Math.PI * 2);
    c.ellipse(0, -8, 36, 34, 0, 0, Math.PI * 2);
    c.ellipse(38, 7, 43, 25, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
}

/** A round-crowned tree: trunk plus a cluster of overlapping blobs. */
function tree(c: Ctx, x: number, y: number, size: number, crown: string[], trunk: string, rand: () => number) {
  c.fillStyle = trunk;
  c.fillRect(x - size * 0.06, y - size * 0.5, size * 0.12, size * 0.5);
  for (let i = 0; i < 7; i++) {
    c.fillStyle = crown[i % crown.length];
    c.beginPath();
    c.arc(
      x + (rand() - 0.5) * size * 0.7,
      y - size * 0.75 + (rand() - 0.5) * size * 0.45,
      size * (0.22 + rand() * 0.14),
      0,
      Math.PI * 2,
    );
    c.fill();
  }
}

function leafShape(c: Ctx, x: number, y: number, size: number, angle: number, color: string) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(0, -size);
  c.quadraticCurveTo(size * 0.8, 0, 0, size);
  c.quadraticCurveTo(-size * 0.8, 0, 0, -size);
  c.fill();
  c.restore();
}

function petalShape(c: Ctx, x: number, y: number, size: number, angle: number, color: string) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.fillStyle = color;
  c.beginPath();
  c.ellipse(0, 0, size, size * 0.6, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

/* ── Regular: the clock decides ──────────────────────────────────────────── */

function paintNatural(c: Ctx, night: boolean) {
  gradientSky(c, [[0, night ? '#243951' : '#b9dce0'], [1, night ? '#668080' : '#f3f2dc']]);
  c.fillStyle = night ? '#f3eed3' : '#fff0b0';
  c.beginPath();
  c.arc(738, 145, 46, 0, Math.PI * 2);
  c.fill();
  clouds(c, night ? '#8295aa' : '#f9fcf5', night ? 0.35 : 0.8);
  c.globalAlpha = 1;
  if (night) {
    c.fillStyle = '#e6e9d7';
    for (let i = 0; i < 24; i++) {
      c.beginPath();
      c.arc((i * 137 + 43) % 900, (i * 73 + 25) % 390, i % 3 === 0 ? 2 : 1, 0, Math.PI * 2);
      c.fill();
    }
  }
  hill(c, night ? '#516977' : '#a4c3c4', 610, [
    [100, 530, 155, 395, 255, 510],
    [335, 600, 385, 610, 465, 545],
    [590, 400, 645, 410, 750, 525],
    [810, 575, 870, 530, 900, 510],
  ]);
  hill(c, night ? '#45675e' : '#a3bf94', 655, [[180, 535, 310, 750, 485, 650], [660, 540, 775, 555, 900, 650]]);
  hill(c, night ? '#344e43' : '#bfd0a1', 745, [[230, 680, 670, 710, 900, 760]]);
  ground(c, night ? '#777463' : '#e1d2ae', night ? '#5b5c50' : '#cab68c');
  pebbles(c, night ? 0.2 : 0.5);
}

function ground(c: Ctx, top: string, bottom: string) {
  const earth = c.createLinearGradient(0, 790, 0, 1000);
  earth.addColorStop(0, top);
  earth.addColorStop(1, bottom);
  c.fillStyle = earth;
  c.beginPath();
  c.moveTo(0, 865);
  c.bezierCurveTo(240, 795, 650, 810, 900, 855);
  c.lineTo(900, 1000);
  c.lineTo(0, 1000);
  c.fill();
}

function pebbles(c: Ctx, alpha: number) {
  for (let i = 0; i < 22; i++) {
    const x = (i * 173 + 30) % 900;
    if (x > 280 && x < 620) continue;
    c.fillStyle = i % 2 ? '#b4aa8a' : '#eee2c1';
    c.globalAlpha = alpha;
    c.beginPath();
    c.ellipse(x, 880 + ((i * 37) % 110), 3 + (i % 5), 2, -0.2, 0, Math.PI * 2);
    c.fill();
  }
  c.globalAlpha = 1;
}

/* ── VIP: Đêm đầy sao ────────────────────────────────────────────────────── */

function paintStarry(c: Ctx) {
  const rand = seeded(7);
  gradientSky(c, [[0, '#070E26'], [0.45, '#18214D'], [0.8, '#3B3F7A'], [1, '#5A4E86']]);

  // The Milky Way: a soft diagonal haze, then dense dust inside it.
  c.save();
  c.translate(450, 300);
  c.rotate(-0.42);
  const band = c.createLinearGradient(0, -110, 0, 110);
  band.addColorStop(0, 'rgba(160,170,255,0)');
  band.addColorStop(0.5, 'rgba(190,185,255,0.28)');
  band.addColorStop(1, 'rgba(160,170,255,0)');
  c.fillStyle = band;
  c.fillRect(-700, -110, 1400, 220);
  for (let i = 0; i < 520; i++) {
    const x = (rand() - 0.5) * 1300;
    const y = (rand() + rand() + rand() - 1.5) * 70;
    c.fillStyle = `rgba(235,235,255,${0.25 + rand() * 0.6})`;
    c.fillRect(x, y, rand() < 0.1 ? 2 : 1, rand() < 0.1 ? 2 : 1);
  }
  c.restore();

  // Stars across the whole sky, a few bright ones with a cross flare.
  for (let i = 0; i < 260; i++) {
    const x = rand() * W;
    const y = rand() * 600;
    const r = rand() < 0.08 ? 1.9 : rand() < 0.4 ? 1.2 : 0.7;
    c.fillStyle = rand() < 0.15 ? '#FFE9B8' : '#EEF1FF';
    c.globalAlpha = 0.5 + rand() * 0.5;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
    if (r > 1.8) {
      c.globalAlpha = 0.6;
      c.fillRect(x - 7, y - 0.5, 14, 1);
      c.fillRect(x - 0.5, y - 7, 1, 14);
      glow(c, x, y, 10, 'rgba(220,225,255,0.7)', 0.6);
    }
  }
  c.globalAlpha = 1;

  // A full moon, with its halo.
  glow(c, 170, 150, 170, 'rgba(255,244,214,0.55)');
  const moon = c.createRadialGradient(158, 138, 6, 170, 150, 52);
  moon.addColorStop(0, '#FFFDF2');
  moon.addColorStop(1, '#EDE3C2');
  c.fillStyle = moon;
  c.beginPath();
  c.arc(170, 150, 52, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = 'rgba(200,190,160,0.35)';
  for (const [x, y, r] of [[152, 136, 9], [186, 166, 12], [182, 130, 6], [158, 172, 5]]) {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  }

  // Moonlit hills, a line of dark trees, and the lit ground.
  hill(c, '#2B3566', 600, [[130, 520, 230, 470, 330, 540], [450, 610, 560, 470, 700, 520], [800, 550, 860, 520, 900, 530]]);
  for (let x = 20; x < W; x += 34) {
    if (x > 300 && x < 600) continue;
    const h = 40 + rand() * 50;
    const base = 640 + Math.sin(x / 90) * 16;
    c.fillStyle = '#152346';
    c.beginPath();
    c.moveTo(x, base - h);
    c.lineTo(x + 16, base);
    c.lineTo(x - 16, base);
    c.fill();
  }
  hill(c, '#1F3B3A', 690, [[200, 620, 420, 720, 560, 670], [700, 620, 820, 650, 900, 680]]);
  ground(c, '#3E4C52', '#2A3438');
  // Fireflies painted far off; the near ones are 3D and move.
  for (let i = 0; i < 26; i++) {
    const x = rand() * W;
    if (x > 280 && x < 620) continue;
    glow(c, x, 640 + rand() * 260, 9, 'rgba(255,236,140,0.9)', 0.55);
  }
}

/* ── VIP: Nắng mùa thu ───────────────────────────────────────────────────── */

function paintAutumn(c: Ctx) {
  const rand = seeded(11);
  gradientSky(c, [[0, '#E86A4A'], [0.35, '#F7A35C'], [0.7, '#FDD08A'], [1, '#FDE9C2']]);

  // A low sun with long, soft rays.
  glow(c, 690, 470, 300, 'rgba(255,214,140,0.85)');
  c.save();
  c.translate(690, 470);
  c.globalAlpha = 0.12;
  c.fillStyle = '#FFF2C9';
  for (let i = 0; i < 12; i++) {
    c.rotate((Math.PI * 2) / 12);
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(520, -26);
    c.lineTo(520, 26);
    c.fill();
  }
  c.restore();
  c.fillStyle = '#FFF4D2';
  c.beginPath();
  c.arc(690, 470, 58, 0, Math.PI * 2);
  c.fill();

  // Streaks of warm cloud.
  c.fillStyle = 'rgba(255,190,150,0.6)';
  for (const [x, y, w] of [[120, 160, 260], [420, 110, 200], [560, 250, 300], [60, 300, 180]]) {
    c.beginPath();
    c.ellipse(x + w / 2, y, w / 2, 12, 0, 0, Math.PI * 2);
    c.fill();
  }

  hill(c, '#B9707A', 600, [[140, 510, 260, 470, 380, 540], [520, 600, 640, 500, 760, 540], [840, 560, 880, 540, 900, 545]]);

  // A wood of maples on the far bank, thick at the sides.
  const crowns = [['#D9452B', '#F07A2C', '#B8321F'], ['#F2A531', '#E57B26', '#F6C14A'], ['#C8402A', '#E9692E', '#A72D1E']];
  for (let x = 10; x < W; x += 42) {
    const nearMiddle = x > 330 && x < 570;
    const size = (nearMiddle ? 60 : 90) + rand() * 40;
    tree(c, x + rand() * 16, 660 + Math.sin(x / 70) * 14, size, crowns[Math.floor(rand() * 3)], '#5C3420', rand);
  }
  hill(c, '#C9873F', 700, [[220, 640, 440, 730, 600, 690], [740, 650, 840, 680, 900, 700]]);
  ground(c, '#D8A15C', '#B57A3C');

  // Leaves already down, at the edges of the path.
  const leafColors = ['#D9452B', '#F07A2C', '#F2A531', '#B8321F', '#E57B26'];
  for (let i = 0; i < 90; i++) {
    const x = rand() * W;
    if (x > 300 && x < 600 && rand() < 0.8) continue;
    leafShape(c, x, 800 + rand() * 200, 5 + rand() * 6, rand() * Math.PI, leafColors[i % leafColors.length]);
  }
}

/* ── VIP: Xuân hoa anh đào ───────────────────────────────────────────────── */

function paintSakura(c: Ctx) {
  const rand = seeded(23);
  gradientSky(c, [[0, '#BFD9F2'], [0.4, '#F4D3E4'], [0.85, '#FFF1F5'], [1, '#FFF8F0']]);
  glow(c, 640, 210, 220, 'rgba(255,250,235,0.9)');

  // A far mountain, snow-capped, pale with distance.
  c.fillStyle = '#D6C9E4';
  c.beginPath();
  c.moveTo(360, 560);
  c.lineTo(560, 300);
  c.lineTo(760, 560);
  c.fill();
  c.fillStyle = '#FBF8FF';
  c.beginPath();
  c.moveTo(510, 365);
  c.lineTo(560, 300);
  c.lineTo(610, 365);
  c.lineTo(585, 352);
  c.lineTo(560, 372);
  c.lineTo(535, 352);
  c.fill();

  hill(c, '#C7D9B8', 620, [[160, 560, 300, 540, 440, 600], [600, 640, 760, 560, 900, 600]]);

  // Cherry trees in full bloom along the far bank.
  const pinks = ['#F7B8CF', '#F39BBB', '#FCD5E2', '#EE8FB0'];
  for (let x = 0; x < W; x += 46) {
    const nearMiddle = x > 330 && x < 570;
    const size = (nearMiddle ? 55 : 85) + rand() * 35;
    tree(c, x + rand() * 18, 670 + Math.cos(x / 80) * 12, size, pinks, '#6B4A3E', rand);
  }
  hill(c, '#B9D39C', 715, [[220, 660, 460, 740, 620, 700], [760, 670, 850, 690, 900, 705]]);
  ground(c, '#E7DCC0', '#D2C29C');

  // Branches reaching in from both top corners, heavy with blossom.
  const branch = (sx: number, sy: number, dir: number) => {
    c.strokeStyle = '#5A3A32';
    c.lineCap = 'round';
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 6; i++) {
      const x = sx + dir * i * 42;
      const y = sy + i * 26 + Math.sin(i) * 14;
      pts.push([x, y]);
    }
    c.lineWidth = 9;
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts.slice(1)) c.lineTo(x, y);
    c.stroke();
    c.lineWidth = 4;
    for (const [x, y] of pts.slice(2)) {
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + dir * 30, y - 34);
      c.stroke();
      for (let k = 0; k < 9; k++) {
        const bx = x + dir * (rand() * 44) - dir * 6;
        const by = y - rand() * 44 + 6;
        c.fillStyle = pinks[k % pinks.length];
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * Math.PI * 2;
          petalShape(c, bx + Math.cos(a) * 5, by + Math.sin(a) * 5, 5, a, pinks[(k + p) % pinks.length]);
        }
        c.fillStyle = '#E25C8A';
        c.beginPath();
        c.arc(bx, by, 2, 0, Math.PI * 2);
        c.fill();
      }
    }
  };
  branch(-20, 30, 1);
  branch(W + 20, 60, -1);

  // Petals settled on the ground.
  for (let i = 0; i < 110; i++) {
    const x = rand() * W;
    if (x > 300 && x < 600 && rand() < 0.75) continue;
    petalShape(c, x, 790 + rand() * 210, 3 + rand() * 3, rand() * Math.PI, pinks[i % pinks.length]);
  }
}

/**
 * The texture for one scene. `night` only matters for the regular scene, which
 * follows the clock; the VIP scenes are the same place at any hour.
 */
export function plantBackdrop(scene: SceneKey = 'natural', night = false) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext('2d')!;
  if (scene === 'night') paintStarry(c);
  else if (scene === 'autumn') paintAutumn(c);
  else if (scene === 'sakura') paintSakura(c);
  else paintNatural(c, night);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return texture;
}
