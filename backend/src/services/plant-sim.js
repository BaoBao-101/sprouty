/**
 * The virtual plant engine.
 *
 * Sprouty sells a simulated plant, so this file is the product: it decides what
 * the sensors read, what a care action does, and when a seed becomes a harvest.
 *
 * Two rules shape everything here:
 *
 * 1. **No scheduler.** Every metric is a pure function of the stored state and
 *    the time elapsed since `lastTickAt`. `tick()` runs on every read and
 *    before every care action, so a plant left alone for two days dries out the
 *    moment its owner opens the page — the same answer a cron job would have
 *    written, without a second source of truth for it.
 *
 * 2. **Care the child performs is what grows the plant.** Time alone adds very
 *    little, and automation (pump, grow light) only keeps a plant alive while
 *    nobody is looking. A care action pays out in proportion to how much the
 *    plant actually needed it, which is what makes reading the sensors matter
 *    rather than mashing every button on sight.
 *
 * Everything is deterministic: the "noise" on a sensor reading is hashed from
 * the plant id and the clock, so two reads a second apart do not jitter and a
 * refresh cannot be used to reroll a bad reading.
 *
 * `icon` fields are keys, not glyphs. The client draws its own line-art for
 * each one; a server that shipped emoji would decide the brand's artwork.
 */

/**
 * Speeds the whole simulation up for development and demos. 1 is real time: a
 * cooldown measured in hours is hours. 24 makes an hour pass in a minute.
 */
import { SPECIES_CARE } from './species-care.js';

export function timeScale() {
  const raw = Number(process.env.PLANT_TIME_SCALE || 1);
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  return Math.min(raw, 2000);
}

const HOUR_MS = 3_600_000;

// ── Stages ───────────────────────────────────────────────────────────────────

/**
 * `growthNeeded` is how many growth points a stage takes to complete, and
 * `passivePerHour` how much of that arrives just from time passing with a
 * healthy plant — deliberately a small fraction, so waiting is never a strategy.
 */
export const STAGES = [
  {
    id: 'seed', label: 'Hạt giống', icon: 'seed', growthNeeded: 40, passivePerHour: 0.7,
    idealMoisture: [55, 80], idealTemp: [22, 30],
    story: 'Hạt cần đủ ẩm và ấm để nứt vỏ. Giữ đất ẩm đều, chưa cần bón phân.',
  },
  {
    id: 'sprout', label: 'Mầm', icon: 'sprout', growthNeeded: 60, passivePerHour: 0.8,
    idealMoisture: [50, 75], idealTemp: [22, 30],
    story: 'Mầm vừa nhú rất yếu. Nắng dịu, tưới ít một và phun sương là đủ.',
  },
  {
    id: 'seedling', label: 'Cây con', icon: 'seedling', growthNeeded: 90, passivePerHour: 0.9,
    idealMoisture: [45, 70], idealTemp: [20, 32],
    story: 'Cây con bắt đầu cần nắng thật và một ít dinh dưỡng để ra lá mới.',
  },
  {
    id: 'vegetative', label: 'Phát triển', icon: 'leaf', growthNeeded: 130, passivePerHour: 1,
    idealMoisture: [45, 70], idealTemp: [20, 32],
    story: 'Giai đoạn lớn nhanh nhất: nắng nhiều, bón phân đều, xới đất cho thoáng rễ.',
  },
  {
    id: 'budding', label: 'Ra nụ', icon: 'bud', growthNeeded: 120, passivePerHour: 0.9,
    idealMoisture: [40, 65], idealTemp: [20, 30],
    story: 'Cây dồn sức ra nụ. Tỉa lá già và canh sâu bệnh kỹ hơn giai đoạn trước.',
  },
  {
    id: 'flowering', label: 'Ra hoa', icon: 'flower', growthNeeded: 120, passivePerHour: 0.9,
    idealMoisture: [40, 65], idealTemp: [20, 30],
    story: 'Hoa đã nở — thụ phấn giúp cây đậu trái. Tránh để đất quá ướt.',
  },
  {
    id: 'fruiting', label: 'Kết trái', icon: 'fruit', growthNeeded: 140, passivePerHour: 0.9,
    idealMoisture: [45, 70], idealTemp: [20, 30],
    story: 'Trái đang lớn và rất cần dinh dưỡng. Bón phân đúng hạn là quan trọng nhất.',
  },
  {
    id: 'mature', label: 'Thu hoạch', icon: 'harvest', growthNeeded: 0, passivePerHour: 0,
    idealMoisture: [40, 70], idealTemp: [18, 32],
    story: 'Cây đã đến ngày thu hoạch. Bấm "Thu hoạch" để hoàn thành hành trình!',
  },
];

const STAGE_INDEX = new Map(STAGES.map((s, i) => [s.id, i]));

/**
 * How fast the soil dries, relative to a mature plant in an open pot. A seed
 * and a sprout are under a covered starter dome; from `seedling` on the plant
 * is in the open and the automatic pump is available to help.
 */
const STAGE_DRY_FACTOR = {
  seed: 0.5,
  sprout: 0.62,
  seedling: 0.85,
  vegetative: 1,
  budding: 1,
  flowering: 1,
  fruiting: 1,
  mature: 0.9,
};

export function stageMeta(stageId, product = null) {
  const base = STAGES[STAGE_INDEX.get(stageId) ?? 0];
  const profile = SPECIES_CARE[speciesFor(product).key];
  if (!profile) return base;
  const young = ['seed', 'sprout'].includes(stageId);
  return { ...base,
    growthNeeded: base.growthNeeded * profile.pace,
    idealMoisture: young ? [profile.moisture[0] + 8, Math.min(85, profile.moisture[1] + 8)] : profile.moisture,
    idealTemp: profile.temp,
    story: young ? profile.sow : profile[stageId] || profile.support,
  };
}

export function stageIndex(stageId) {
  return STAGE_INDEX.get(stageId) ?? 0;
}

/**
 * The species an admin can choose from when putting a kit on sale.
 *
 * This is a catalogue keyed by a stable `speciesKey`, not by product name. The
 * name used to be the key, which meant naming a product "Đậu Hà Lan" instead of
 * "Bean" silently produced a generic plant — right stages, wrong words, wrong
 * colours — and nothing in the admin screens hinted that the name was load
 * bearing. Now the admin picks the species explicitly and can call the product
 * whatever sells.
 *
 * Each entry carries what the simulation needs (what it harvests, whether it is
 * pollinated, which stage labels differ) and what the drawing needs (fruit and
 * petal colour). The colours live here rather than in the client so the two
 * cannot drift: a carrot swells a root where a sunflower opens a head, and
 * calling both "kết trái" in orange would be teaching the wrong thing twice.
 */
export const SPECIES = {
  bean: {
    key: 'bean', label: 'Cây đậu', icon: 'seed',
    harvest: 'quả đậu', pollinate: true,
    form: 'vine', fruitShape: 'pod',
    fruitColor: '#7BC96F', flowerColor: '#F7E7B0',
    labels: { fruiting: 'Ra quả' },
    blurb: 'Lớn nhanh, ra quả sớm — hợp với bé mới bắt đầu.',
  },
  carrot: {
    key: 'carrot', label: 'Cà rốt', icon: 'soil',
    harvest: 'củ cà rốt', pollinate: false,
    form: 'root', fruitShape: 'root',
    fruitColor: '#F08A3C', flowerColor: '#F4F0DC',
    labels: { budding: 'Phình củ', flowering: 'Củ lớn', fruiting: 'Củ chín' },
    blurb: 'Củ lớn dần dưới đất, không cần thụ phấn.',
  },
  corn: {
    key: 'corn', label: 'Bắp ngô', icon: 'leaf',
    harvest: 'bắp ngô', pollinate: true,
    form: 'stalk', fruitShape: 'cob',
    fruitColor: '#F5CC4D', flowerColor: '#E8DFA8',
    labels: { fruiting: 'Ra bắp' },
    blurb: 'Cây cao, thân thẳng — dễ thấy cây lớn từng ngày.',
  },
  pepper: {
    key: 'pepper', label: 'Ớt', icon: 'fruit',
    harvest: 'trái ớt', pollinate: true,
    form: 'bush', fruitShape: 'cone',
    fruitColor: '#E03A2F', flowerColor: '#F4F0DC',
    labels: { fruiting: 'Ra trái' },
    blurb: 'Ra nhiều trái nhỏ, màu đỏ rực khi chín.',
  },
  sunflower: {
    key: 'sunflower', label: 'Hướng dương', icon: 'flower',
    harvest: 'hạt hướng dương', pollinate: true,
    form: 'head', fruitShape: 'head',
    fruitColor: '#8A6A3A', flowerColor: '#FFC83D',
    labels: { flowering: 'Nở hoa', fruiting: 'Kết hạt' },
    blurb: 'Hoa to vàng rực, dạy bé về hướng nắng.',
  },
  tomato: {
    key: 'tomato', label: 'Cà chua', icon: 'fruit',
    harvest: 'quả cà chua', pollinate: true,
    form: 'bush', fruitShape: 'round',
    fruitColor: '#E8503A', flowerColor: '#FFD96B',
    labels: { fruiting: 'Ra trái' },
    blurb: 'Hành trình đầy đủ nhất: hoa, thụ phấn rồi ra trái.',
  },
  herb: {
    key: 'herb', label: 'Rau thơm', icon: 'leaf',
    harvest: 'lá thơm', pollinate: false,
    form: 'leafy', fruitShape: 'none',
    fruitColor: '#5FA85C', flowerColor: '#E6F0C8',
    labels: { budding: 'Ra nhánh', flowering: 'Lá dày', fruiting: 'Sẵn hái' },
    blurb: 'Thu hoạch lá, không ra trái — vòng đời ngắn và nhẹ nhàng.',
  },
};

const DEFAULT_SPECIES = {
  key: 'generic', label: 'Cây thường', icon: 'sprout',
  harvest: 'trái', pollinate: true,
  form: 'bush', fruitShape: 'round',
  fruitColor: '#E8503A', flowerColor: '#FFC83D',
  labels: {},
  blurb: 'Vòng đời cơ bản, dùng khi không chọn giống cụ thể.',
};

/**
 * Products seeded before `speciesKey` existed are matched by name, so an
 * existing catalogue keeps its carrots and sunflowers without a backfill.
 */
const LEGACY_NAME_TO_KEY = {
  Bean: 'bean',
  Carrot: 'carrot',
  Corn: 'corn',
  FirePepper: 'pepper',
  SunFlower: 'sunflower',
  Tomato: 'tomato',
};

export function isSpeciesKey(key) {
  return Boolean(key) && Object.prototype.hasOwnProperty.call(SPECIES, key);
}

/** The catalogue an admin picks from, and the public guide lists. */
export function speciesCatalog() {
  return Object.values(SPECIES).map((s) => ({
    key: s.key,
    label: s.label,
    icon: s.icon,
    harvest: s.harvest,
    pollinate: s.pollinate,
    form: s.form,
    fruitShape: s.fruitShape,
    fruitColor: s.fruitColor,
    flowerColor: s.flowerColor,
    blurb: s.blurb,
    // So the admin can see how the journey reads before committing to it.
    stageLabels: STAGES.map((stage) => s.labels?.[stage.id] || stage.label),
  }));
}

/**
 * Resolves a product to its species: the explicit key first, then the legacy
 * name match, then the generic fallback.
 *
 * Accepts either a product-ish object or a bare string, because most callers
 * have the product and a few older ones only have the name.
 */
export function speciesFor(product) {
  if (!product) return DEFAULT_SPECIES;
  if (typeof product === 'string') {
    return SPECIES[LEGACY_NAME_TO_KEY[product]] || SPECIES[product] || DEFAULT_SPECIES;
  }
  if (isSpeciesKey(product.speciesKey)) return SPECIES[product.speciesKey];
  return SPECIES[LEGACY_NAME_TO_KEY[product.name]] || DEFAULT_SPECIES;
}

/** The stage label this species uses, e.g. "Phình củ" instead of "Ra nụ". */
export function stageLabel(stageId, product) {
  return speciesFor(product).labels?.[stageId] || stageMeta(stageId).label;
}

// ── Devices ──────────────────────────────────────────────────────────────────

/**
 * The simulated IoT kit. Sensors unlock as the plant grows so the dashboard
 * starts out readable for a child and earns its complexity.
 */
export const DEVICES = [
  {
    type: 'moisture_sensor', label: 'Cảm biến độ ẩm đất', icon: 'moisture', unlockStage: 'seed',
    kind: 'sensor', reads: 'moisture', unit: '%',
    about: 'Đo lượng nước trong đất. Dưới 30% là đất đã khô, trên 85% là úng nước.',
  },
  {
    type: 'thermo_sensor', label: 'Nhiệt độ & ẩm không khí', icon: 'thermo', unlockStage: 'seed',
    kind: 'sensor', reads: 'temperature', unit: '°C',
    about: 'Đo nhiệt độ và độ ẩm không khí quanh cây theo giờ trong ngày.',
  },
  {
    type: 'light_sensor', label: 'Cảm biến ánh sáng', icon: 'light', unlockStage: 'sprout',
    kind: 'sensor', reads: 'light', unit: '%',
    about: 'Đo cường độ sáng. Ban đêm về gần 0 — đó là lúc cây nghỉ.',
  },
  {
    type: 'camera', label: 'Camera theo dõi', icon: 'camera', unlockStage: 'sprout',
    kind: 'sensor', reads: null, unit: '',
    about: 'Chụp lại từng chặng của cây và lưu vào album kỷ niệm.',
  },
  {
    type: 'nutrient_sensor', label: 'Cảm biến dinh dưỡng (EC)', icon: 'nutrient', unlockStage: 'seedling',
    kind: 'sensor', reads: 'nutrient', unit: '%',
    about: 'Đo lượng dinh dưỡng còn lại trong đất. Dưới 30% là cây đang đói.',
  },
  {
    type: 'water_pump', label: 'Bơm tưới tự động', icon: 'pump', unlockStage: 'seedling',
    kind: 'actuator', unit: '',
    about: 'Bật tự động: tự tưới khi đất khô dưới mức tốt của giai đoạn hiện tại. Giữ cây sống và khoẻ lúc bạn đi vắng, nhưng không giúp cây lớn nhanh hơn — chỉ bạn tự chăm mới được điểm phát triển.',
  },
  {
    type: 'grow_light', label: 'Đèn trồng cây', icon: 'bulb', unlockStage: 'vegetative',
    kind: 'actuator', unit: '',
    about: 'Bật tự động: thắp sáng bù khi trời tối, giúp cây không bị thiếu nắng.',
  },
  {
    type: 'fan', label: 'Quạt thông gió', icon: 'fan', unlockStage: 'budding',
    kind: 'actuator', unit: '',
    about: 'Bật tự động: hạ nhiệt khi quá nóng và giảm nguy cơ sâu bệnh.',
  },
];

export function devicesUnlockedAt(stageId) {
  const at = stageIndex(stageId);
  return DEVICES.filter((d) => stageIndex(d.unlockStage) <= at).map((d) => d.type);
}

export function deviceMeta(type) {
  return DEVICES.find((d) => d.type === type) || null;
}

// ── Care actions ─────────────────────────────────────────────────────────────

/**
 * `cooldownHours` is the "hồi chiêu": a child cannot grow the plant in one
 * sitting, which is the whole point — they come back tomorrow.
 *
 * `payout` returns what the action is worth right now. `growth` is capped by
 * `maxGrowth`, and an action the plant did not need pays almost nothing, with
 * `warn` explaining why rather than failing silently.
 */
export const CARE_ACTIONS = [
  {
    id: 'water', label: 'Tưới nước', icon: 'water', cooldownHours: 4,
    stages: ['seed', 'sprout', 'seedling', 'vegetative', 'budding', 'flowering', 'fruiting'],
    hint: 'Tưới khi cảm biến độ ẩm xuống dưới 45%.',
    maxGrowth: 12,
    payout(state, stage) {
      const [lo, hi] = stage.idealMoisture;
      if (state.moisture > hi + 12) {
        return {
          growth: 0,
          deltas: { moisture: +6, health: -7, pestRisk: +6 },
          warn: 'Đất đang úng nước mà vẫn tưới thêm — rễ cây bị ngộp, cây yếu đi một chút.',
        };
      }
      const need = clamp01((hi - state.moisture) / (hi - lo + 18));
      return {
        growth: 12 * need,
        deltas: {
          moisture: +Math.max(8, Math.min(34, hi + 8 - state.moisture)),
          health: need > 0.35 ? +3 : 0,
        },
        note: need > 0.35 ? 'Đúng lúc cây đang khát!' : 'Đất vẫn còn ẩm, cây uống được một ít.',
      };
    },
  },
  {
    id: 'mist', label: 'Phun sương', icon: 'mist', cooldownHours: 1.5,
    stages: ['seed', 'sprout', 'seedling', 'vegetative', 'budding', 'flowering', 'fruiting'],
    hint: 'Cách tưới nhẹ, an toàn cho mầm non và lá.',
    maxGrowth: 5,
    payout(state, stage) {
      const young = stage.id === 'seed' || stage.id === 'sprout';
      const need = clamp01((stage.idealMoisture[1] - state.moisture) / 40);
      return {
        growth: (young ? 5 : 2.5) * need,
        deltas: { moisture: +9, health: +1, pestRisk: -2 },
        note: young ? 'Mầm non rất thích được phun sương.' : 'Lá được làm sạch và mát hơn.',
      };
    },
  },
  {
    id: 'fertilize', label: 'Bón phân', icon: 'fertilize', cooldownHours: 20,
    stages: ['seedling', 'vegetative', 'budding', 'flowering', 'fruiting'],
    hint: 'Bón khi cảm biến dinh dưỡng xuống dưới 40%. Cây con chưa cần bón sớm.',
    maxGrowth: 20,
    payout(state) {
      if (state.nutrient > 82) {
        return {
          growth: 0,
          deltas: { nutrient: +5, health: -6 },
          warn: 'Đất còn rất nhiều dinh dưỡng — bón thêm làm cháy rễ, cây mất sức.',
        };
      }
      const need = clamp01((85 - state.nutrient) / 70);
      return {
        growth: 20 * need,
        deltas: { nutrient: +Math.min(42, 88 - state.nutrient), health: +2 },
        note: 'Cây được tiếp thêm dinh dưỡng để lớn.',
      };
    },
  },
  {
    id: 'sunlight', label: 'Đưa ra nắng', icon: 'sun', cooldownHours: 6,
    stages: ['sprout', 'seedling', 'vegetative', 'budding', 'flowering', 'fruiting'],
    hint: 'Xoay chậu ra hướng nắng. Chỉ có tác dụng khi ngoài trời đang sáng.',
    maxGrowth: 10,
    payout(state, stage, env) {
      if (env.light < 15) {
        return {
          growth: 0,
          deltas: {},
          warn: 'Trời đang tối, chưa có nắng để đón. Bật đèn trồng cây hoặc quay lại vào ban ngày nhé.',
        };
      }
      const need = clamp01(env.light / 100);
      return {
        growth: 10 * need,
        deltas: { health: +3, moisture: -3 },
        note: 'Cây quang hợp và vươn thẳng về phía nắng.',
      };
    },
  },
  {
    id: 'pest_check', label: 'Soi sâu bệnh', icon: 'pest', cooldownHours: 8,
    stages: ['sprout', 'seedling', 'vegetative', 'budding', 'flowering', 'fruiting'],
    hint: 'Kiểm tra mặt dưới lá. Làm khi nguy cơ sâu bệnh vượt 40%.',
    maxGrowth: 10,
    payout(state) {
      const need = clamp01(state.pestRisk / 70);
      return {
        growth: 10 * need,
        deltas: { pestRisk: -Math.min(40, state.pestRisk), health: need > 0.3 ? +5 : +1 },
        note: need > 0.3
          ? 'Bắt được mấy con sâu đang ẩn dưới lá — cây thoát hiểm!'
          : 'Lá sạch, chưa thấy sâu bệnh nào.',
      };
    },
  },
  {
    id: 'prune', label: 'Tỉa lá', icon: 'prune', cooldownHours: 14,
    stages: ['seedling', 'vegetative', 'budding', 'flowering', 'fruiting'],
    hint: 'Cắt lá già để cây dồn sức cho lá và trái mới.',
    maxGrowth: 10,
    payout(state) {
      if (state.health > 92 && state.pestRisk < 15) {
        return {
          growth: 3,
          deltas: { health: -1 },
          warn: 'Cây đang rất khoẻ, chưa có lá già nào cần tỉa — cắt nhiều quá lại làm cây đau.',
        };
      }
      return {
        growth: 10,
        deltas: { health: +6, pestRisk: -12 },
        note: 'Lá già được dọn, cây thông thoáng hơn.',
      };
    },
  },
  {
    id: 'loosen_soil', label: 'Xới đất', icon: 'soil', cooldownHours: 24,
    stages: ['vegetative', 'budding', 'flowering', 'fruiting'],
    hint: 'Xới nhẹ mặt đất cho rễ thở và hút phân tốt hơn.',
    maxGrowth: 12,
    payout() {
      return {
        growth: 12,
        deltas: { health: +4, nutrient: +6, moisture: -4 },
        note: 'Đất tơi trở lại, rễ hút nước và phân dễ hơn nhiều.',
      };
    },
  },
  {
    id: 'pollinate', label: 'Thụ phấn', icon: 'pollinate', cooldownHours: 10,
    stages: ['flowering'],
    hint: 'Dùng cọ nhỏ quét phấn giữa các hoa để cây đậu trái.',
    maxGrowth: 22,
    payout() {
      return {
        growth: 22,
        deltas: { health: +3 },
        note: 'Phấn đã được chuyển giữa các hoa — cây sẽ đậu trái!',
      };
    },
  },
  {
    id: 'harvest', label: 'Thu hoạch', icon: 'harvest', cooldownHours: 0,
    stages: ['mature'],
    hint: 'Hoàn thành hành trình và nhận chứng nhận cho cây này.',
    maxGrowth: 0,
    payout() {
      return { growth: 0, deltas: {}, note: 'Chúc mừng! Cây đã được thu hoạch.' };
    },
  },
];

export function careMeta(actionId) {
  return CARE_ACTIONS.find((a) => a.id === actionId) || null;
}

/** Cooldown in real milliseconds, after the development time scale. */
export function cooldownMs(actionId) {
  const meta = careMeta(actionId);
  if (!meta) return 0;
  return (meta.cooldownHours * HOUR_MS) / timeScale();
}

// ── Environment ──────────────────────────────────────────────────────────────

/**
 * Deterministic noise in [-1, 1], hashed from a plant id and a time bucket.
 * Without this a reading would change on every refresh, and a child could keep
 * reloading until the temperature suited them.
 */
function noise(seed, bucket) {
  let h = 2166136261;
  const text = `${seed}:${bucket}`;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // >>> 0 first: the multiply above leaves a signed 32-bit value.
  return (((h >>> 0) % 2000) / 1000) - 1;
}

/** Local hour as a float, in the shop's timezone rather than the server's. */
function localHour(at) {
  const offsetHours = Number(process.env.PLANT_TZ_OFFSET || 7); // Asia/Ho_Chi_Minh
  const shifted = new Date(at.getTime() + offsetHours * HOUR_MS);
  return shifted.getUTCHours() + shifted.getUTCMinutes() / 60;
}

/**
 * What the air sensors report at `at`: a day/night light curve, temperature
 * following it a couple of hours behind, and humidity moving opposite the heat.
 * Actuators switched to automatic shift these.
 */
export function environmentAt(plantId, at, devices = {}) {
  const hour = localHour(at);
  // Daylight 6:00–18:30, peaking just after midday.
  const daylight = Math.max(0, Math.sin(((hour - 6) / 12.5) * Math.PI));
  const bucket = Math.floor(at.getTime() / (30 * 60 * 1000));
  const jitter = noise(plantId, bucket);

  // Jitter scales the daylight curve rather than being added to it: added, a
  // positive sample would light the plant up at two in the morning.
  let light = daylight * (92 + jitter * 6);
  let lightAssisted = false;
  const growLight = devices.grow_light;
  if (growLight?.unlocked && growLight.autoMode && light < 45) {
    light = Math.max(light, 55);
    lightAssisted = true;
  }

  let temperature = 26 + daylight * 7 - 3.5 + jitter * 1.6;
  let cooled = false;
  const fan = devices.fan;
  if (fan?.unlocked && fan.autoMode && temperature > 30) {
    temperature -= Math.min(4, temperature - 30);
    cooled = true;
  }

  const humidity = clamp(78 - daylight * 24 + jitter * 5, 35, 95);

  return {
    light: round1(clamp(light, 0, 100)),
    temperature: round1(temperature),
    humidity: round1(humidity),
    isDay: daylight > 0.08,
    hour: round1(hour),
    lightAssisted,
    cooled,
  };
}

// ── The tick ─────────────────────────────────────────────────────────────────

/**
 * Advances `plant` from its `lastTickAt` to `now` without touching the
 * database. Returns the new metric values, the stages crossed on the way, and
 * anything worth telling the owner about. Callers persist the result; see
 * services/plants.js.
 */
export function tick(plant, { now = new Date(), devices = {}, product = null } = {}) {
  const lastTick = new Date(plant.lastTickAt);
  // Guard against a clock that went backwards: a negative elapsed time would
  // run the decay in reverse and hand out free moisture.
  const elapsedMs = Math.max(0, now.getTime() - lastTick.getTime());
  const hours = (elapsedMs / HOUR_MS) * timeScale();

  const state = {
    moisture: plant.moisture,
    nutrient: plant.nutrient,
    health: plant.health,
    pestRisk: plant.pestRisk,
    stage: plant.stage,
    stageProgress: plant.stageProgress,
    growthPoints: plant.growthPoints,
  };
  const events = [];
  const stagesCrossed = [];
  let pumpRan = false;

  // Batteries are stepped inside the slice loop below, alongside everything
  // else. Charging them from a single reading taken at `now` meant a plant
  // opened in the evening saw light 0% for the whole elapsed window, so its
  // devices only ever drained — and an automatic pump the customer had switched
  // on would quietly stop working once it hit empty.
  const batteries = {};
  for (const [type, device] of Object.entries(devices)) {
    if (device?.unlocked) batteries[type] = device.battery;
  }

  // Step the simulation in slices so a plant untouched for a week does not get
  // one enormous jump that overshoots every threshold at once.
  const SLICE = 0.5;
  let elapsed = 0;
  let guard = 0;
  while (elapsed < hours - 0.0001 && guard < 4000) {
    guard += 1;
    const slice = Math.min(SLICE, hours - elapsed);
    // Wall-clock time at the middle of this slice, so the day/night curve is
    // sampled where the slice actually sat rather than all at `now`.
    const sliceAt = new Date(lastTick.getTime() + ((elapsed + slice / 2) / timeScale()) * HOUR_MS);
    elapsed += slice;

    const env = environmentAt(plant.id, sliceAt, devices);
    const stage = stageMeta(state.stage, product);

    // Soil dries faster when it is hot and bright.
    //
    // Scaled down for the first two stages: a seed and a sprout sit in a small
    // covered starter pot, which is both true of real propagation and necessary
    // here — the automatic pump only unlocks at `seedling`, so before then a
    // child who visits once a day is the plant's only water source, and at the
    // full rate they could not keep up no matter how diligent they were.
    const dryRate = (1.6 + Math.max(0, env.temperature - 24) * 0.18 + (env.light / 100) * 0.7)
      * STAGE_DRY_FACTOR[state.stage];
    state.moisture = clamp(state.moisture - dryRate * slice, 0, 100);

    // An automatic pump tops the soil up, which keeps the plant alive but earns
    // no growth — that is reserved for care the owner performs.
    //
    // It waters to the *stage's* comfort band, not to a fixed number. A single
    // threshold meant a seedling, whose ideal is 55–80%, was topped up to 58%
    // and left to fall again, so its average moisture sat below the band and it
    // was permanently stressed however long the pump ran — the opposite of what
    // the device promises the customer.
    const pump = devices.water_pump;
    const pumpFloor = Math.max(24, stage.idealMoisture[0] - 6);
    if (pump?.unlocked && pump.autoMode && state.moisture < pumpFloor && batteries.water_pump > 5) {
      state.moisture = clamp(stage.idealMoisture[1] - 4, state.moisture, 100);
      pumpRan = true;
    }

    // Solar charge by day, steady drain always, more of it when a device is
    // running itself. Balanced so a device left on automatic breaks even over a
    // full day — average daylight gives roughly 1.15/hour against 0.75/hour of
    // drain — and the battery reads as the flavour it is rather than a trap that
    // disables the automation after two days.
    for (const [type, device] of Object.entries(devices)) {
      if (!device?.unlocked) continue;
      const charge = (env.light / 100) * 3.5 * slice;
      const drain = (0.25 + (device.autoMode ? 0.5 : 0)) * slice;
      batteries[type] = clamp(batteries[type] + charge - drain, 0, 100);
    }

    // Nutrients are taken up as the plant grows, so later stages eat faster.
    // Slow on purpose: fertilising only unlocks at `seedling`, and a faster
    // drain emptied the soil days before the child was allowed to do anything
    // about it.
    state.nutrient = clamp(state.nutrient - (0.14 + stageIndex(state.stage) * 0.055) * slice, 0, 100);

    // Pests breed in warm, damp, neglected conditions.
    const pestRate = 0.32
      + (state.moisture > 80 ? 0.4 : 0)
      + (env.temperature > 31 ? 0.25 : 0)
      - (devices.fan?.unlocked && devices.fan.autoMode ? 0.25 : 0);
    state.pestRisk = clamp(state.pestRisk + Math.max(0, pestRate) * slice, 0, 100);

    // Health follows how close conditions are to this stage's comfort band.
    const [moLo, moHi] = stage.idealMoisture;
    const [tLo, tHi] = stage.idealTemp;
    const moistureOff = state.moisture < moLo ? moLo - state.moisture : Math.max(0, state.moisture - moHi);
    const tempOff = env.temperature < tLo ? tLo - env.temperature : Math.max(0, env.temperature - tHi);
    // A seed and a sprout live off the seed's own reserves, so an empty soil
    // reading is not yet a problem for them — which is both true of real
    // plants and the reason fertilising unlocks a stage later.
    const feedsFromSoil = stageIndex(state.stage) >= 2;
    const stress =
      moistureOff * 0.09 +
      tempOff * 0.22 +
      Math.max(0, state.pestRisk - 55) * 0.06 +
      (feedsFromSoil ? Math.max(0, 30 - state.nutrient) * 0.035 : 0);
    // Recovery is deliberately faster than the worst decay: a plant neglected
    // over a school week has to be winnable back, or the child stops opening
    // the page at all.
    const comfort = stress < 0.6 ? 1.8 : -stress;
    // Floored at 5, never zero: this is a children's product, and a plant that
    // died while its owner was at school would be a punishment, not a lesson.
    state.health = clamp(state.health + comfort * slice, 5, 100);

    // Passive growth, gated on health and on there being light to grow by.
    if (state.stage !== 'mature') {
      const healthFactor = clamp01((state.health - 35) / 55);
      const lightFactor = 0.35 + (env.light / 100) * 0.65;
      const gain = stage.passivePerHour * slice * healthFactor * lightFactor;
      state.growthPoints += gain;
      state.stageProgress += (gain / stage.growthNeeded) * 100;
    }

    // Advance as many stages as the accumulated progress covers.
    while (state.stageProgress >= 100 && state.stage !== 'mature') {
      const from = stageMeta(state.stage, product);
      const next = STAGES[stageIndex(state.stage) + 1];
      // Carry the surplus over rather than discarding it, so a plant read late
      // is not quietly robbed of the growth it had already earned.
      const carry = state.stageProgress - 100;
      state.stage = next.id;
      state.stageProgress = next.id === 'mature'
        ? 100
        : clamp((carry * from.growthNeeded) / (stageMeta(next.id, product).growthNeeded || 1), 0, 99);
      stagesCrossed.push(next.id);
    }
  }

  if (state.moisture < 20) {
    events.push({ level: 'warn', text: 'Đất đã khô — cây đang khát nước.' });
  }
  if (state.moisture > 88) {
    events.push({ level: 'warn', text: 'Đất đang úng nước, hãy để ráo trước khi tưới thêm.' });
  }
  if (state.nutrient < 25) {
    events.push({ level: 'warn', text: 'Dinh dưỡng trong đất gần hết — cây cần được bón phân.' });
  }
  if (state.pestRisk > 55) {
    events.push({ level: 'warn', text: 'Nguy cơ sâu bệnh đang cao, nên soi kỹ mặt dưới lá.' });
  }
  if (pumpRan) {
    events.push({ level: 'info', text: 'Bơm tự động đã tưới giúp bạn khi đất khô.' });
  }
  for (const id of stagesCrossed) {
    events.push({
      level: 'good',
      text: `Cây đã bước sang giai đoạn "${stageLabel(id, product)}".`,
      stage: id,
    });
  }

  for (const type of Object.keys(batteries)) batteries[type] = round1(batteries[type]);

  return {
    state: {
      moisture: round1(state.moisture),
      nutrient: round1(state.nutrient),
      health: round1(state.health),
      pestRisk: round1(state.pestRisk),
      stage: state.stage,
      stageProgress: Math.min(100, round1(state.stageProgress)),
      growthPoints: round1(state.growthPoints),
    },
    stagesCrossed,
    events,
    batteries,
    hoursElapsed: round1(hours),
    unlockedDevices: devicesUnlockedAt(state.stage),
  };
}

/**
 * Applies one care action to an already-ticked state. Cooldown and stage
 * eligibility are the caller's job (they need the database); this is only the
 * arithmetic, so it stays testable on its own.
 */
export function applyCare(actionId, state, env, product = null) {
  const meta = careMeta(actionId);
  if (!meta) return null;
  const stage = stageMeta(state.stage, product);
  const result = meta.payout(state, stage, env) || { growth: 0, deltas: {} };

  const next = { ...state };
  for (const [key, delta] of Object.entries(result.deltas || {})) {
    const floor = key === 'health' ? 5 : 0;
    next[key] = clamp(round1((next[key] ?? 0) + delta), floor, 100);
  }

  const growth = clamp(result.growth || 0, 0, meta.maxGrowth || 0);
  const stagesCrossed = [];
  if (growth > 0 && next.stage !== 'mature') {
    next.growthPoints = round1(next.growthPoints + growth);
    next.stageProgress += (growth / stage.growthNeeded) * 100;
    while (next.stageProgress >= 100 && next.stage !== 'mature') {
      const from = stageMeta(next.stage, product);
      const upcoming = STAGES[stageIndex(next.stage) + 1];
      const carry = next.stageProgress - 100;
      next.stage = upcoming.id;
      next.stageProgress = upcoming.id === 'mature'
        ? 100
        : clamp((carry * from.growthNeeded) / (stageMeta(upcoming.id, product).growthNeeded || 1), 0, 99);
      stagesCrossed.push(upcoming.id);
    }
  }
  next.stageProgress = Math.min(100, round1(next.stageProgress));

  const messages = [];
  if (result.warn) messages.push({ level: 'warn', text: result.warn });
  else if (result.note) messages.push({ level: 'good', text: result.note });
  for (const id of stagesCrossed) {
    messages.push({
      level: 'good',
      text: `Cây lên giai đoạn "${stageLabel(id, product)}"!`,
      stage: id,
    });
  }

  return { state: next, growth: round1(growth), messages, stagesCrossed, warned: Boolean(result.warn) };
}

/**
 * The single next thing to do, chosen the way a gardener would: whatever is
 * furthest out of band and off cooldown. This is what the dashboard headlines
 * and what the AI coach is told to build its advice around, so the two can
 * never contradict each other.
 */
export function nextStepFor(state, env, availability, product = null) {
  const stage = stageMeta(state.stage, product);
  const ready = (id) => availability[id]?.ready;
  const candidates = [];

  if (state.stage === 'mature') {
    candidates.push({ action: 'harvest', urgency: 100, why: 'Cây đã chín — thu hoạch thôi!' });
  }
  if (state.moisture < stage.idealMoisture[0] && ready('water')) {
    candidates.push({
      action: 'water',
      urgency: 80 + (stage.idealMoisture[0] - state.moisture),
      why: `Độ ẩm đất ${Math.round(state.moisture)}%, thấp hơn mức tốt (${stage.idealMoisture[0]}–${stage.idealMoisture[1]}%).`,
    });
  }
  if (state.pestRisk > 45 && ready('pest_check')) {
    candidates.push({
      action: 'pest_check',
      urgency: 70 + state.pestRisk / 4,
      why: `Nguy cơ sâu bệnh ${Math.round(state.pestRisk)}% — nên kiểm tra ngay.`,
    });
  }
  if (state.nutrient < 40 && ready('fertilize')) {
    candidates.push({
      action: 'fertilize',
      urgency: 65 + (40 - state.nutrient),
      why: `Dinh dưỡng còn ${Math.round(state.nutrient)}% — cây đang thiếu ăn.`,
    });
  }
  if (state.stage === 'flowering' && speciesFor(product).pollinate && ready('pollinate')) {
    candidates.push({ action: 'pollinate', urgency: 72, why: 'Hoa đang nở — thụ phấn để cây đậu trái.' });
  }
  if (env.light > 40 && ready('sunlight')) {
    candidates.push({ action: 'sunlight', urgency: 45, why: 'Ngoài trời đang có nắng tốt để cây quang hợp.' });
  }
  if (ready('loosen_soil')) {
    candidates.push({ action: 'loosen_soil', urgency: 35, why: 'Xới đất cho rễ thoáng và hút phân tốt hơn.' });
  }
  if (ready('prune')) {
    candidates.push({ action: 'prune', urgency: 30, why: 'Tỉa lá già để cây dồn sức cho phần non.' });
  }
  if (ready('mist')) {
    candidates.push({ action: 'mist', urgency: 20, why: 'Phun sương nhẹ cho lá sạch và mát.' });
  }

  candidates.sort((a, b) => b.urgency - a.urgency);
  const best = candidates[0];
  if (!best) {
    return {
      action: null,
      label: null,
      icon: 'clock',
      why: 'Mọi việc chăm cây đều đang trong thời gian hồi — cây đang tự lớn, quay lại sau nhé.',
    };
  }
  const meta = careMeta(best.action);
  return { action: best.action, why: best.why, label: meta.label, icon: meta.icon, hint: meta.hint };
}

// ── Small helpers ────────────────────────────────────────────────────────────

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

export function healthLabel(health) {
  if (health >= 85) return { id: 'thriving', label: 'Xanh tốt' };
  if (health >= 65) return { id: 'healthy', label: 'Khoẻ' };
  if (health >= 40) return { id: 'stressed', label: 'Hơi mệt' };
  return { id: 'wilting', label: 'Đang héo' };
}
