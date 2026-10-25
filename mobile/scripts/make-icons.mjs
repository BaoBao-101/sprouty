/**
 * The app's icon, launch picture, notification icon and store pictures, drawn
 * from the website's brand files so there is one source of truth:
 *
 *   the green "S" mark   frontend/public/assets/images/sprouty-mark.png
 *   the wordmark         frontend/public/assets/images/logo.png
 *
 * Writes into assets/ (read by app.json) and store/. `npm run icons`.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';

const root = resolve(import.meta.dirname, '..');
const brand = resolve(root, '../frontend/public/assets/images');
const MARK = join(brand, 'sprouty-mark.png');
const LOGO = join(brand, 'logo.png');

const CREAM = '#FFFDF8';
const CREAM_RGB = { r: 255, g: 253, b: 248, alpha: 1 };
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };
const GREEN = '#2E8447';

async function save(path, buffer) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, buffer);
}

/** The mark `height` px tall, centred on a square of `size` px. */
async function markOn(size, height, background = CLEAR) {
  const mark = await sharp(MARK).resize({ height: Math.round(height) }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toBuffer();
}

/** No alpha channel at all: the App Store rejects an icon that has one, even fully opaque. */
async function opaque(buffer) {
  return sharp(buffer).flatten({ background: CREAM }).removeAlpha().png().toBuffer();
}

/** The mark as a white silhouette, for Android's monochrome and notification icons. */
async function whiteMark(size, height) {
  const shape = await sharp(MARK).resize({ height: Math.round(height) }).ensureAlpha().extractChannel('alpha').raw().toBuffer({ resolveWithObject: true });
  const white = await sharp({ create: { width: shape.info.width, height: shape.info.height, channels: 3, background: '#FFFFFF' } })
    .joinChannel(shape.data, { raw: { width: shape.info.width, height: shape.info.height, channels: 1 } })
    .png()
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: CLEAR } })
    .composite([{ input: white, gravity: 'center' }])
    .png()
    .toBuffer();
}

// The home-screen icon: cream square, green S. iOS and Play both round it.
await save(join(root, 'assets/icon.png'), await opaque(await markOn(1024, 600, CREAM_RGB)));
// Android adaptive icon: only the middle ~66% is always visible, so the mark is smaller.
await save(join(root, 'assets/adaptive-icon.png'), await markOn(1024, 470));
await save(join(root, 'assets/adaptive-icon-mono.png'), await whiteMark(1024, 470));
// Notification icon: Android draws it as a white silhouette, tinted green (app.json).
await save(join(root, 'assets/notification-icon.png'), await whiteMark(96, 80));
// Launch screen: the wordmark on cream (the background colour is in app.json).
await save(join(root, 'assets/splash-logo.png'), await sharp(LOGO).resize({ width: 1000 }).png().toBuffer());

// Google Play and the App Store.
await save(join(root, 'store/icon-512.png'), await opaque(await markOn(512, 300, CREAM_RGB)));
await save(join(root, 'store/icon-1024.png'), await opaque(await markOn(1024, 600, CREAM_RGB)));
const logo = await sharp(LOGO).resize({ width: 520 }).png().toBuffer();
const line = Buffer.from(`<svg width="1024" height="500" xmlns="http://www.w3.org/2000/svg">
  <text x="512" y="372" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="40" font-weight="600" fill="${GREEN}">Gieo một hạt nhỏ · Nuôi cả tuổi thơ</text>
</svg>`);
const art = await Promise.all(['Bean', 'Tomato', 'SunFlower'].map((n) =>
  sharp(join(brand, `sprouty-icons/${n}.png`)).resize({ width: 120, height: 120, fit: 'contain', background: CLEAR }).png().toBuffer()));
const feature = await sharp({ create: { width: 1024, height: 500, channels: 4, background: CREAM_RGB } })
  .composite([
    { input: logo, top: 120, left: 252 },
    { input: line, top: 0, left: 0 },
    { input: art[0], top: 26, left: 40 },
    { input: art[1], top: 354, left: 864 },
    { input: art[2], top: 30, left: 864 },
  ])
  .png()
  .toBuffer();
await save(join(root, 'store/feature-graphic-1024x500.png'), await opaque(feature));

console.log('assets/ and store/ written.');
