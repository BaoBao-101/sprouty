/**
 * Demo garden: one plant at every growth stage, on one account.
 *
 * Walking a plant from seed to harvest honestly takes about two weeks, which
 * makes the later stages impossible to look at while building or showing the
 * product. This drops a finished garden in place so every stage, every unlocked
 * device and every drawing can be seen at once.
 *
 * It writes the same shapes the simulation writes — care logs with plausible
 * timestamps, sensor readings spread across the last two days, devices unlocked
 * exactly as far as each stage would have unlocked them — so the dashboard is
 * exercised for real rather than rendering a hand-made fixture.
 *
 *   node scripts/seed-demo-plants.js <email> [password]
 *
 * Re-running it replaces that account's demo plants rather than adding more.
 * Refuses to run in production: it fabricates paid orders.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { DEVICES, STAGES, devicesUnlockedAt, speciesFor } from '../src/services/plant-sim.js';

const prisma = new PrismaClient();

const email = (process.argv[2] || '').trim().toLowerCase();
const password = process.argv[3] || '123456';

if (!email) {
  console.error('Cần email. Ví dụ: node scripts/seed-demo-plants.js ten@example.com 123456');
  process.exit(1);
}
if (process.env.NODE_ENV === 'production') {
  console.error('Script này tạo đơn hàng giả — không chạy trên production.');
  process.exit(1);
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * How each demo plant should look. Metrics are chosen to show off a different
 * state on each card — one thirsty, one hungry, one with pests — so the garden
 * grid demonstrates the warning colours instead of eight identical green cards.
 */
const PLANTS = [
  { stage: 'seed',       progress: 35,  species: 'bean',      nickname: 'Hạt Đậu Nhỏ',   moisture: 68, nutrient: 72, health: 92, pest: 4,  streak: 1,  ageDays: 0.5 },
  { stage: 'sprout',     progress: 60,  species: 'sunflower', nickname: 'Mầm Hướng Dương', moisture: 33, nutrient: 66, health: 74, pest: 12, streak: 2,  ageDays: 2 },
  { stage: 'seedling',   progress: 45,  species: 'carrot',    nickname: 'Cà Rốt Bé',     moisture: 58, nutrient: 28, health: 81, pest: 18, streak: 4,  ageDays: 5 },
  { stage: 'vegetative', progress: 72,  species: 'corn',      nickname: 'Bắp Cao Kều',   moisture: 61, nutrient: 70, health: 96, pest: 9,  streak: 7,  ageDays: 8 },
  { stage: 'budding',    progress: 38,  species: 'tomato',    nickname: 'Cà Chua Mập',   moisture: 52, nutrient: 55, health: 88, pest: 61, streak: 9,  ageDays: 11 },
  { stage: 'flowering',  progress: 66,  species: 'pepper',    nickname: 'Ớt Lửa',        moisture: 49, nutrient: 61, health: 90, pest: 15, streak: 12, ageDays: 14 },
  { stage: 'fruiting',   progress: 84,  species: 'tomato',    nickname: 'Cà Chua Chín',  moisture: 57, nutrient: 48, health: 94, pest: 11, streak: 15, ageDays: 17 },
  { stage: 'mature',     progress: 100, species: 'herb',      nickname: 'Rau Thơm Vàng', moisture: 55, nutrient: 60, health: 98, pest: 6,  streak: 18, ageDays: 21 },
];

/** Care actions that make sense at a given stage, for the history list. */
const CARE_BY_STAGE = {
  seed:       ['water', 'mist'],
  sprout:     ['water', 'mist', 'sunlight'],
  seedling:   ['water', 'fertilize', 'sunlight', 'pest_check'],
  vegetative: ['water', 'fertilize', 'loosen_soil', 'prune', 'sunlight'],
  budding:    ['water', 'fertilize', 'prune', 'pest_check', 'sunlight'],
  flowering:  ['water', 'pollinate', 'fertilize', 'pest_check'],
  fruiting:   ['water', 'fertilize', 'loosen_soil', 'pest_check'],
  mature:     ['water', 'fertilize', 'prune'],
};

function localDayKey(at) {
  const offsetHours = Number(process.env.PLANT_TZ_OFFSET || 7);
  return new Date(at.getTime() + offsetHours * HOUR).toISOString().slice(0, 10);
}

async function main() {
  const now = new Date();

  // ── Account ────────────────────────────────────────────────────────────────
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: email.split('@')[0],
        passwordHash: await bcrypt.hash(password, 12),
        role: 'customer',
      },
    });
    console.log(`Đã tạo tài khoản ${email} (mật khẩu: ${password})`);
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(password, 12), status: 'active' },
    });
    console.log(`Đã đặt lại mật khẩu cho ${email} thành: ${password}`);
  }

  // ── Products, one per species the demo needs ───────────────────────────────
  const needed = [...new Set(PLANTS.map((p) => p.species))];
  const productBySpecies = {};
  for (const key of needed) {
    const species = speciesFor({ speciesKey: key });
    const name = `Demo · ${species.label}`;
    const existing = await prisma.product.findFirst({ where: { name } });
    productBySpecies[key] = existing
      ? await prisma.product.update({
          where: { id: existing.id },
          data: { speciesKey: key, status: 'draft' },
        })
      : await prisma.product.create({
          data: {
            name,
            // Draft: these exist to back the demo plants, and should not appear
            // in the shop next to the real catalogue.
            status: 'draft',
            description: `Bộ kit demo dùng để xem trước hành trình của ${species.label.toLowerCase()} trên Sprouty.`,
            price: 150000,
            category: 'kit',
            speciesKey: key,
            ageRange: '4–10 tuổi',
            collection: 'Sprouty Demo',
            emoji: '🌱',
            bgColor: '#F0FDF4',
            includes: ['Cây mô phỏng', 'Cảm biến IoT ảo', 'Plant Buddy AI'],
            images: [],
          },
        });
  }

  // ── Clear any previous demo garden for this account ────────────────────────
  const demoProductIds = Object.values(productBySpecies).map((p) => p.id);
  const removed = await prisma.virtualPlant.deleteMany({
    where: { userId: user.id, productId: { in: demoProductIds } },
  });
  if (removed.count) console.log(`Đã xoá ${removed.count} cây demo cũ.`);

  // ── Plants ─────────────────────────────────────────────────────────────────
  // One plant per stage. VirtualPlant is unique on (userId, productId), so a
  // stage whose species is already used gets its own product variant.
  const usedProducts = new Set();
  let made = 0;

  for (const spec of PLANTS) {
    let product = productBySpecies[spec.species];
    if (usedProducts.has(product.id)) {
      const species = speciesFor({ speciesKey: spec.species });
      const altName = `Demo · ${species.label} (${spec.stage})`;
      const existing = await prisma.product.findFirst({ where: { name: altName } });
      product = existing
        ? await prisma.product.update({ where: { id: existing.id }, data: { speciesKey: spec.species, status: 'draft' } })
        : await prisma.product.create({
            data: { ...stripIds(productBySpecies[spec.species]), name: altName },
          });
      await prisma.virtualPlant.deleteMany({ where: { userId: user.id, productId: product.id } });
    }
    usedProducts.add(product.id);

    const activatedAt = new Date(now.getTime() - spec.ageDays * DAY);
    const unlocked = new Set(devicesUnlockedAt(spec.stage));

    const plant = await prisma.virtualPlant.create({
      data: {
        userId: user.id,
        productId: product.id,
        nickname: spec.nickname,
        stage: spec.stage,
        stageProgress: spec.progress,
        // Roughly what the sim would have accumulated by this stage.
        growthPoints: STAGES.slice(0, STAGES.findIndex((s) => s.id === spec.stage))
          .reduce((sum, s) => sum + s.growthNeeded, 0) + spec.progress,
        moisture: spec.moisture,
        nutrient: spec.nutrient,
        health: spec.health,
        pestRisk: spec.pest,
        careStreak: spec.streak,
        lastCareDate: localDayKey(now),
        // Now, so opening the page does not immediately dry the plant out and
        // undo the state this script just set up.
        lastTickAt: now,
        activatedAt,
        createdAt: activatedAt,
        harvestedAt: null,
        devices: {
          create: DEVICES.map((d) => ({
            type: d.type,
            unlocked: unlocked.has(d.type),
            // The later stages show the automation switched on, which is what
            // the product recommends by then.
            autoMode: unlocked.has(d.type) && d.kind === 'actuator' && spec.ageDays >= 11,
            battery: 60 + ((d.type.length * 7) % 38),
          })),
        },
      },
    });

    // ── Care history ─────────────────────────────────────────────────────────
    const actions = CARE_BY_STAGE[spec.stage] || ['water'];
    const logs = [];
    for (let i = 0; i < Math.min(10, actions.length * 2); i += 1) {
      const action = actions[i % actions.length];
      // Spread backwards from a few hours ago, newest first.
      const at = new Date(now.getTime() - (i * 7 + 3) * HOUR);
      if (at < activatedAt) break;
      logs.push({
        plantId: plant.id,
        action,
        stage: spec.stage,
        growth: Math.round((4 + ((i * 13) % 9)) * 10) / 10,
        detail: { seeded: true },
        createdAt: at,
      });
    }
    if (logs.length) await prisma.plantCareLog.createMany({ data: logs });

    // ── Sensor history, so the chart has a curve rather than one dot ─────────
    const readings = [];
    const POINTS = 40;
    for (let i = POINTS; i >= 0; i -= 1) {
      const at = new Date(now.getTime() - i * (2 * DAY / POINTS));
      // Local hour drives a believable day/night shape.
      const hour = (at.getUTCHours() + Number(process.env.PLANT_TZ_OFFSET || 7)) % 24;
      const daylight = Math.max(0, Math.sin(((hour - 6) / 12.5) * Math.PI));
      // Moisture sawtooths: it dries, then a watering lifts it back up.
      const phase = (i % 10) / 10;
      readings.push({
        plantId: plant.id,
        moisture: round1(clamp(spec.moisture - 16 + phase * 26, 5, 98)),
        temperature: round1(22.5 + daylight * 7),
        humidity: round1(78 - daylight * 22),
        light: round1(daylight * 92),
        nutrient: round1(clamp(spec.nutrient + (i - POINTS / 2) * 0.35, 5, 98)),
        health: round1(clamp(spec.health - (i / POINTS) * 9, 5, 100)),
        recordedAt: at,
      });
    }
    await prisma.plantSensorReading.createMany({ data: readings });

    made += 1;
    const label = STAGES.find((s) => s.id === spec.stage)?.label;
    console.log(
      `  ${String(made).padStart(2)}. ${spec.nickname.padEnd(18)} ${String(label).padEnd(11)} ` +
      `${String(spec.progress).padStart(3)}%  ${[...unlocked].length}/8 thiết bị  ` +
      `${logs.length} lượt chăm`,
    );
  }

  // ── A reward to show, plus a paid order so the account looks lived-in ──────
  const paidOrder = await prisma.order.findFirst({
    where: { userId: user.id, paidAt: { not: null } },
  });
  if (!paidOrder) {
    const firstProduct = Object.values(productBySpecies)[0];
    await prisma.order.create({
      data: {
        userId: user.id,
        total: firstProduct.price * 3,
        status: 'processing',
        paidAt: new Date(now.getTime() - 3 * DAY),
        shippingName: user.name,
        shippingPhone: '0900000000',
        shippingAddress: 'Không áp dụng — sản phẩm số, kích hoạt ngay trên web.',
        items: { create: [{ productId: firstProduct.id, qty: 3, unitPrice: firstProduct.price }] },
      },
    });
    console.log('Đã tạo 1 đơn hàng demo đã thanh toán (3 sản phẩm).');
  }

  const rewardCount = await prisma.reward.count({ where: { userId: user.id, status: 'available' } });
  if (rewardCount === 0) {
    await prisma.reward.create({
      data: { userId: user.id, type: 'free_workshop', milestone: 1, status: 'available' },
    });
    console.log('Đã tặng 1 suất workshop miễn phí để xem ưu đãi "mua 3 tặng 1".');
  }

  console.log(`\nXong. ${made} cây demo cho ${email}.`);
  console.log(`Đăng nhập: ${email} / ${password}  →  mở trang "Cây của tôi".`);
}

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
function round1(v) { return Math.round(v * 10) / 10; }

/** A copy of a product's fields with the identity and timestamps dropped. */
function stripIds(product) {
  const { id, createdAt, updatedAt, name, ...rest } = product;
  return rest;
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
