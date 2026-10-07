/**
 * Everything the virtual plant needs from the database.
 *
 * services/plant-sim.js is pure arithmetic and knows nothing about Prisma; this
 * file is the other half — it loads a plant, runs the simulation forward,
 * writes the result back, and assembles the payload the dashboard renders.
 *
 * The one rule worth stating: a read is a write. Opening the page advances the
 * plant to now and persists it, because the alternative is a plant whose stored
 * state is stale and whose displayed state is computed — two answers to the
 * same question, which is exactly the bug a cron job would have introduced.
 */

import { AppError } from '../utils/errors.js';
import {
  CARE_ACTIONS,
  DEVICES,
  STAGES,
  applyCare,
  careMeta,
  cooldownMs,
  devicesUnlockedAt,
  environmentAt,
  healthLabel,
  nextStepFor,
  speciesFor,
  stageIndex,
  stageLabel,
  stageMeta,
  tick,
  timeScale,
} from './plant-sim.js';

/** How many sensor snapshots the chart shows, and how far apart they are kept. */
const READING_MIN_GAP_MS = 20 * 60 * 1000;
const READING_KEEP_DAYS = 10;

const plantInclude = {
  devices: true,
  product: { select: { id: true, name: true, emoji: true, bgColor: true, images: true, speciesKey: true } },
};

/** Devices keyed by type, in the shape plant-sim expects. */
function deviceMap(plant) {
  const map = {};
  for (const device of plant.devices || []) {
    map[device.type] = {
      unlocked: device.unlocked,
      autoMode: device.autoMode,
      battery: device.battery,
    };
  }
  return map;
}

/** Local calendar day, for the care streak. */
function localDayKey(at) {
  const offsetHours = Number(process.env.PLANT_TZ_OFFSET || 7);
  return new Date(at.getTime() + offsetHours * 3_600_000).toISOString().slice(0, 10);
}

/**
 * Creates the plant a kit unlocks, with its starter devices.
 *
 * Returns the existing plant instead of failing when one is already there: the
 * activation endpoint is a form a child double-taps, and the second tap should
 * land them on their plant rather than on an error.
 */
export async function createPlantForProduct(prisma, userId, productId, { nickname } = {}) {
  const existing = await prisma.virtualPlant.findUnique({
    where: { userId_productId: { userId, productId } },
    include: plantInclude,
  });
  if (existing) return { plant: existing, created: false };

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, category: true, status: true },
  });
  if (!product) throw new AppError('Không tìm thấy sản phẩm của mã này.', 404);
  if (product.category !== 'kit') {
    throw new AppError('Mã này không dành cho một bộ kit trồng cây.', 400);
  }

  // The Smart variant used to mean physical IoT hardware in the box. Nothing
  // ships now, so what the customer paid the upgrade for is the full sensor set
  // from the first day instead of unlocking it stage by stage. Read from the
  // paid order rather than from anything the caller passed: the activation code
  // is per product, not per variant.
  const smart = await prisma.orderItem.findFirst({
    where: {
      productId,
      variant: 'smart',
      order: { userId, paidAt: { not: null }, status: { not: 'cancelled' } },
    },
    select: { id: true },
  });

  const unlocked = new Set(smart ? DEVICES.map((d) => d.type) : devicesUnlockedAt('seed'));
  const plant = await prisma.virtualPlant.create({
    data: {
      userId,
      productId,
      nickname: (nickname || product.name).slice(0, 40),
      devices: {
        create: DEVICES.map((device) => ({
          type: device.type,
          unlocked: unlocked.has(device.type),
        })),
      },
    },
    include: plantInclude,
  });
  return { plant, created: true };
}

/**
 * Loads one plant, advances it to `now`, and writes back the result.
 *
 * Returns the refreshed row together with the simulation's events, so the
 * caller can tell the owner what happened while they were away.
 */
export async function loadAndTick(prisma, userId, plantId, { now = new Date() } = {}) {
  const plant = await prisma.virtualPlant.findFirst({
    where: { id: plantId, userId },
    include: plantInclude,
  });
  // Same 404 whether it does not exist or belongs to someone else, so this
  // cannot be used to probe for other people's plants.
  if (!plant) throw new AppError('Không tìm thấy cây này.', 404);
  return advance(prisma, plant, now);
}

/**
 * Runs the simulation forward on an already-loaded row and persists it.
 * Separate from `loadAndTick` so the list endpoint can tick many plants
 * without a query each.
 */
export async function advance(prisma, plant, now = new Date()) {
  const devices = deviceMap(plant);
  const product = plant.product || null;
  const result = tick(plant, { now, devices, product });

  // Unlock whatever the new stage reached. A device never re-locks: a stage
  // cannot go backwards, and a dashboard that lost a sensor would read as a
  // bug rather than a rule.
  const shouldUnlock = new Set(result.unlockedDevices);
  const deviceUpdates = [];
  for (const device of plant.devices || []) {
    const battery = result.batteries[device.type];
    const unlock = !device.unlocked && shouldUnlock.has(device.type);
    if (!unlock && battery === undefined) continue;
    if (!unlock && Math.abs((battery ?? device.battery) - device.battery) < 0.2) continue;
    deviceUpdates.push(
      prisma.plantDevice.update({
        where: { id: device.id },
        data: {
          ...(unlock ? { unlocked: true } : {}),
          ...(battery === undefined ? {} : { battery }),
        },
      }),
    );
  }

  const newlyUnlocked = (plant.devices || [])
    .filter((d) => !d.unlocked && shouldUnlock.has(d.type))
    .map((d) => d.type);

  const [updated] = await prisma.$transaction([
    prisma.virtualPlant.update({
      where: { id: plant.id },
      data: { ...result.state, lastTickAt: now },
      include: plantInclude,
    }),
    ...deviceUpdates,
  ]);

  await recordReading(prisma, updated, now, devices).catch(() => {});

  return { plant: updated, events: result.events, newlyUnlocked, hoursElapsed: result.hoursElapsed };
}

/**
 * Appends a sensor snapshot for the history chart, at most one per
 * READING_MIN_GAP_MS, and prunes anything older than the window the chart
 * shows. Failure here is swallowed by the caller: a missing chart point must
 * never fail a page load.
 */
async function recordReading(prisma, plant, now, devices) {
  const latest = await prisma.plantSensorReading.findFirst({
    where: { plantId: plant.id },
    orderBy: { recordedAt: 'desc' },
    select: { recordedAt: true },
  });
  // The gap shrinks with the time scale, so a sped-up development run still
  // draws a chart instead of a single point.
  const gap = READING_MIN_GAP_MS / timeScale();
  if (latest && now.getTime() - latest.recordedAt.getTime() < gap) return;

  const env = environmentAt(plant.id, now, devices);
  await prisma.plantSensorReading.create({
    data: {
      plantId: plant.id,
      moisture: plant.moisture,
      temperature: env.temperature,
      humidity: env.humidity,
      light: env.light,
      nutrient: plant.nutrient,
      health: plant.health,
      recordedAt: now,
    },
  });
  const cutoff = new Date(now.getTime() - (READING_KEEP_DAYS * 86_400_000) / timeScale());
  await prisma.plantSensorReading.deleteMany({
    where: { plantId: plant.id, recordedAt: { lt: cutoff } },
  });
}

/**
 * When each care action last ran, and therefore what is off cooldown. Derived
 * from the care log, which is why there is no per-action timestamp column that
 * could disagree with it.
 */
export async function careAvailability(prisma, plantId, stage, now = new Date()) {
  const rows = await prisma.plantCareLog.groupBy({
    by: ['action'],
    where: { plantId },
    _max: { createdAt: true },
  });
  const lastByAction = new Map(rows.map((r) => [r.action, r._max.createdAt]));

  const availability = {};
  for (const action of CARE_ACTIONS) {
    const allowedHere = action.stages.includes(stage);
    const last = lastByAction.get(action.id) || null;
    const readyAt = last ? new Date(last.getTime() + cooldownMs(action.id)) : null;
    const msLeft = readyAt ? Math.max(0, readyAt.getTime() - now.getTime()) : 0;
    availability[action.id] = {
      action: action.id,
      label: action.label,
      icon: action.icon,
      hint: action.hint,
      // Hours as the customer experiences them, i.e. after the time scale.
      cooldownHours: action.cooldownHours / timeScale(),
      allowedInStage: allowedHere,
      ready: allowedHere && msLeft === 0,
      secondsLeft: Math.ceil(msLeft / 1000),
      readyAt: msLeft > 0 ? readyAt.toISOString() : null,
      lastDoneAt: last ? last.toISOString() : null,
    };
  }
  return availability;
}

/**
 * Performs a care action: ticks first (so the action is judged against current
 * conditions, not stale ones), checks the cooldown, applies the effect, logs it
 * and extends the streak.
 */
export async function performCare(prisma, userId, plantId, actionId, { now = new Date() } = {}) {
  const meta = careMeta(actionId);
  if (!meta) throw new AppError('Hành động chăm cây không hợp lệ.', 400);

  const loaded = await prisma.virtualPlant.findFirst({
    where: { id: plantId, userId },
    include: plantInclude,
  });
  if (!loaded) throw new AppError('Không tìm thấy cây này.', 404);

  const { plant, events, newlyUnlocked } = await advance(prisma, loaded, now);

  if (plant.harvestedAt) {
    throw new AppError('Cây này đã được thu hoạch — hãy mở một cây mới nhé!', 409);
  }
  if (!meta.stages.includes(plant.stage)) {
    throw new AppError(
      `"${meta.label}" chưa dùng được ở giai đoạn "${stageLabel(plant.stage, plant.product)}".`,
      409,
    );
  }

  const availability = await careAvailability(prisma, plant.id, plant.stage, now);
  const slot = availability[actionId];
  if (!slot.ready) {
    const minutes = Math.ceil(slot.secondsLeft / 60);
    const wait = minutes >= 60
      ? `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`
      : `${minutes} phút`;
    throw new AppError(
      `"${meta.label}" đang hồi — còn ${wait} nữa là chăm được tiếp.`,
      429,
    );
  }

  const devices = deviceMap(plant);
  const env = environmentAt(plant.id, now, devices);
  const product = plant.product || null;

  // Harvest ends the journey instead of changing a metric.
  if (actionId === 'harvest') {
    const [harvested] = await prisma.$transaction([
      prisma.virtualPlant.update({
        where: { id: plant.id },
        data: { harvestedAt: now },
        include: plantInclude,
      }),
      prisma.plantCareLog.create({
        data: { plantId: plant.id, action: 'harvest', stage: plant.stage, growth: 0 },
      }),
    ]);
    return {
      plant: harvested,
      growth: 0,
      messages: [
        {
          level: 'good',
          text: `Chúc mừng! Bạn đã thu hoạch ${speciesFor(product).harvest} từ ${harvested.nickname}.`,
        },
      ],
      stagesCrossed: [],
      events,
      newlyUnlocked,
      harvested: true,
    };
  }

  const outcome = applyCare(actionId, {
    moisture: plant.moisture,
    nutrient: plant.nutrient,
    health: plant.health,
    pestRisk: plant.pestRisk,
    stage: plant.stage,
    stageProgress: plant.stageProgress,
    growthPoints: plant.growthPoints,
  }, env, product);

  // A day only counts once, so opening the page five times does not build a
  // streak out of one afternoon.
  const today = localDayKey(now);
  const streak = plant.lastCareDate === today
    ? plant.careStreak
    : isYesterday(plant.lastCareDate, today) ? plant.careStreak + 1 : 1;

  const unlockedAfter = new Set(devicesUnlockedAt(outcome.state.stage));
  const unlockNow = (plant.devices || [])
    .filter((d) => !d.unlocked && unlockedAfter.has(d.type))
    .map((d) => d.id);

  const [updated] = await prisma.$transaction([
    prisma.virtualPlant.update({
      where: { id: plant.id },
      data: {
        moisture: outcome.state.moisture,
        nutrient: outcome.state.nutrient,
        health: outcome.state.health,
        pestRisk: outcome.state.pestRisk,
        stage: outcome.state.stage,
        stageProgress: outcome.state.stageProgress,
        growthPoints: outcome.state.growthPoints,
        careStreak: streak,
        lastCareDate: today,
        lastTickAt: now,
      },
      include: plantInclude,
    }),
    prisma.plantCareLog.create({
      data: {
        plantId: plant.id,
        action: actionId,
        stage: plant.stage,
        growth: outcome.growth,
        detail: {
          before: {
            moisture: plant.moisture,
            nutrient: plant.nutrient,
            health: plant.health,
            pestRisk: plant.pestRisk,
          },
          after: {
            moisture: outcome.state.moisture,
            nutrient: outcome.state.nutrient,
            health: outcome.state.health,
            pestRisk: outcome.state.pestRisk,
          },
          warned: outcome.warned,
          env: { temperature: env.temperature, light: env.light, humidity: env.humidity },
        },
      },
    }),
    ...unlockNow.map((id) => prisma.plantDevice.update({ where: { id }, data: { unlocked: true } })),
  ]);

  return {
    plant: updated,
    growth: outcome.growth,
    messages: outcome.messages,
    stagesCrossed: outcome.stagesCrossed,
    events,
    newlyUnlocked: [
      ...newlyUnlocked,
      ...(plant.devices || []).filter((d) => unlockNow.includes(d.id)).map((d) => d.type),
    ],
    streak,
  };
}

/** True when `previous` is the calendar day before `today`. */
function isYesterday(previous, today) {
  if (!previous) return false;
  const prev = new Date(`${previous}T00:00:00Z`);
  const now = new Date(`${today}T00:00:00Z`);
  return now.getTime() - prev.getTime() === 86_400_000;
}

/** Turns an actuator's automation on or off. */
export async function setDeviceAuto(prisma, userId, plantId, type, autoMode) {
  const plant = await prisma.virtualPlant.findFirst({
    where: { id: plantId, userId },
    include: { devices: true },
  });
  if (!plant) throw new AppError('Không tìm thấy cây này.', 404);

  const device = plant.devices.find((d) => d.type === type);
  const meta = DEVICES.find((d) => d.type === type);
  if (!device || !meta) throw new AppError('Không tìm thấy thiết bị này.', 404);
  if (!device.unlocked) {
    throw new AppError(`${meta.label} sẽ mở khi cây lớn hơn.`, 409);
  }
  if (meta.kind !== 'actuator') {
    throw new AppError(`${meta.label} là cảm biến, luôn đo tự động.`, 400);
  }

  await prisma.plantDevice.update({ where: { id: device.id }, data: { autoMode } });
  return { type, autoMode, label: meta.label };
}

export async function renamePlant(prisma, userId, plantId, nickname) {
  const plant = await prisma.virtualPlant.findFirst({ where: { id: plantId, userId } });
  if (!plant) throw new AppError('Không tìm thấy cây này.', 404);
  return prisma.virtualPlant.update({
    where: { id: plant.id },
    data: { nickname: nickname.slice(0, 40) },
    include: plantInclude,
  });
}

// ── Payload builders ─────────────────────────────────────────────────────────

/** The compact shape the "Cây của tôi" grid needs. */
export function plantCardDto(plant) {
  const product = plant.product || null;
  const species = speciesFor(product);
  return {
    id: plant.id,
    nickname: plant.nickname,
    productId: plant.productId,
    productName: product?.name || '',
    productEmoji: product?.emoji || null,
    bgColor: product?.bgColor || null,
    // Which plant this grows into, and the colours it is drawn in. Served from
    // the species catalogue so the client never has to keep its own copy of the
    // mapping — one place decides that a pepper is red and a bean is green.
    speciesKey: species.key,
    speciesLabel: species.label,
    // How the plant is shaped and what it bears, so the drawing can tell a
    // climbing bean from a corn stalk instead of recolouring one silhouette.
    form: species.form,
    fruitShape: species.fruitShape,
    fruitColor: species.fruitColor,
    flowerColor: species.flowerColor,
    stage: plant.stage,
    stageIndex: stageIndex(plant.stage),
    stageLabel: stageLabel(plant.stage, product),
    stageCount: STAGES.length,
    stageProgress: plant.stageProgress,
    health: plant.health,
    healthState: healthLabel(plant.health),
    moisture: plant.moisture,
    nutrient: plant.nutrient,
    pestRisk: plant.pestRisk,
    careStreak: plant.careStreak,
    harvestedAt: plant.harvestedAt,
    activatedAt: plant.activatedAt,
  };
}

/** Everything the simulation dashboard renders. */
export async function plantDetailDto(prisma, plant, { now = new Date() } = {}) {
  const devices = deviceMap(plant);
  const product = plant.product || null;
  const env = environmentAt(plant.id, now, devices);
  const availability = await careAvailability(prisma, plant.id, plant.stage, now);
  const stage = stageMeta(plant.stage);

  const [readings, logs] = await Promise.all([
    prisma.plantSensorReading.findMany({
      where: { plantId: plant.id },
      orderBy: { recordedAt: 'asc' },
      take: 120,
      select: {
        moisture: true, temperature: true, humidity: true,
        light: true, nutrient: true, health: true, recordedAt: true,
      },
    }),
    prisma.plantCareLog.findMany({
      where: { plantId: plant.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  const species = speciesFor(product);

  return {
    ...plantCardDto(plant),
    growthPoints: plant.growthPoints,
    lastTickAt: plant.lastTickAt,
    harvestLabel: species.harvest,
    needsPollination: species.pollinate,
    stageStory: stage.story,
    idealMoisture: stage.idealMoisture,
    idealTemp: stage.idealTemp,
    environment: env,
    nextStep: nextStepFor(
      {
        moisture: plant.moisture,
        nutrient: plant.nutrient,
        health: plant.health,
        pestRisk: plant.pestRisk,
        stage: plant.stage,
      },
      env,
      availability,
      product,
    ),
    stages: STAGES.map((s) => ({
      id: s.id,
      label: stageLabel(s.id, product),
      icon: s.icon,
      story: s.story,
      reached: stageIndex(s.id) <= stageIndex(plant.stage),
      current: s.id === plant.stage,
    })),
    devices: DEVICES.map((meta) => {
      const row = (plant.devices || []).find((d) => d.type === meta.type);
      const reading = meta.reads === 'moisture' ? plant.moisture
        : meta.reads === 'nutrient' ? plant.nutrient
        : meta.reads === 'temperature' ? env.temperature
        : meta.reads === 'light' ? env.light
        : null;
      return {
        type: meta.type,
        label: meta.label,
        icon: meta.icon,
        kind: meta.kind,
        about: meta.about,
        unit: meta.unit,
        unlockStage: meta.unlockStage,
        unlockStageLabel: stageLabel(meta.unlockStage, product),
        unlocked: Boolean(row?.unlocked),
        autoMode: Boolean(row?.autoMode),
        battery: row?.battery ?? 0,
        reading,
        // Only the thermometer has a second number to show.
        secondary: meta.reads === 'temperature' ? { label: 'Ẩm không khí', value: env.humidity, unit: '%' } : null,
      };
    }),
    care: CARE_ACTIONS.map((action) => availability[action.id]),
    readings,
    history: logs.map((log) => ({
      id: log.id,
      action: log.action,
      label: careMeta(log.action)?.label || log.action,
      icon: careMeta(log.action)?.icon || 'leaf',
      stage: log.stage,
      stageLabel: stageLabel(log.stage, product),
      growth: log.growth,
      warned: Boolean(log.detail?.warned),
      createdAt: log.createdAt,
    })),
  };
}

/**
 * A short, factual description of the plant for the AI coach's system prompt.
 *
 * The coach is told the numbers and the recommended next step rather than being
 * left to guess: the dashboard already decided what matters most, and an AI
 * that suggested something different would read as the site contradicting
 * itself.
 */
export function plantPromptContext(detail) {
  const lines = [
    `Cây mô phỏng: "${detail.nickname}" — giống ${detail.speciesLabel}, sản phẩm "${detail.productName}".`,
    `Giai đoạn: ${detail.stageLabel} (${detail.stageIndex + 1}/${detail.stageCount}), tiến độ ${Math.round(detail.stageProgress)}%.`,
    `Chỉ số: độ ẩm đất ${Math.round(detail.moisture)}% (mức tốt ${detail.idealMoisture[0]}–${detail.idealMoisture[1]}%), ` +
      `dinh dưỡng ${Math.round(detail.nutrient)}%, sức khoẻ ${Math.round(detail.health)}% (${detail.healthState.label}), ` +
      `nguy cơ sâu bệnh ${Math.round(detail.pestRisk)}%.`,
    `Môi trường lúc này: ${detail.environment.temperature}°C, ẩm không khí ${detail.environment.humidity}%, ` +
      `ánh sáng ${Math.round(detail.environment.light)}% (${detail.environment.isDay ? 'ban ngày' : 'ban đêm'}).`,
    `Việc nên làm tiếp theo (hệ thống đã tính): ${detail.nextStep.label || 'chờ hồi chiêu'} — ${detail.nextStep.why}`,
  ];

  const ready = detail.care.filter((c) => c.ready).map((c) => c.label);
  const cooling = detail.care
    .filter((c) => c.allowedInStage && !c.ready && c.secondsLeft > 0)
    .map((c) => `${c.label} (còn ${Math.ceil(c.secondsLeft / 60)} phút)`);
  if (ready.length) lines.push(`Đang chăm được ngay: ${ready.join(', ')}.`);
  if (cooling.length) lines.push(`Đang hồi chiêu: ${cooling.join(', ')}.`);

  const locked = detail.devices.filter((d) => !d.unlocked);
  if (locked.length) {
    lines.push(`Thiết bị chưa mở: ${locked.map((d) => `${d.label} (mở ở giai đoạn ${d.unlockStageLabel})`).join(', ')}.`);
  }
  const auto = detail.devices.filter((d) => d.unlocked && d.kind === 'actuator');
  if (auto.length) {
    lines.push(
      `Thiết bị tự động: ${auto.map((d) => `${d.label} ${d.autoMode ? 'đang BẬT' : 'đang TẮT'}`).join(', ')}.`,
    );
  }
  lines.push(`Chuỗi ngày chăm cây liên tục: ${detail.careStreak}.`);

  return lines.join('\n');
}
