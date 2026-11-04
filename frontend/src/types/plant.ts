import type { SpeciesProfile } from './product';
import type { IconName } from '@/components/icons/SproutyIcon';
import type { FruitShape, PlantForm } from '@/components/PlantForms';

export type PlantStageId =
  | 'seed' | 'sprout' | 'seedling' | 'vegetative' | 'budding' | 'flowering' | 'fruiting' | 'mature';

export type CareActionId =
  | 'water' | 'mist' | 'fertilize' | 'prune' | 'pest_check' | 'sunlight'
  | 'loosen_soil' | 'pollinate' | 'harvest';

export type DeviceType =
  | 'moisture_sensor' | 'thermo_sensor' | 'light_sensor' | 'nutrient_sensor'
  | 'grow_light' | 'fan' | 'camera' | 'auto_care';

export interface HealthState {
  /** `critical` is "héo nặng": left there long enough the plant dies (`dead`). */
  id: 'thriving' | 'healthy' | 'stressed' | 'wilting' | 'critical' | 'dead';
  label: string;
}

/** What the "Cây của tôi" grid shows. */
export interface PlantCard {
  id: string;
  nickname: string;
  productId: number;
  productName: string;
  productEmoji: string | null;
  bgColor: string | null;
  speciesKey: string;
  speciesLabel: string;
  /** Growth form and fruit shape, so the drawing matches the real plant. */
  form: PlantForm;
  fruitShape: FruitShape;
  fruitColor: string;
  flowerColor: string;
  stage: PlantStageId;
  stageIndex: number;
  stageLabel: string;
  stageCount: number;
  stageProgress: number;
  health: number;
  healthState: HealthState;
  moisture: number;
  nutrient: number;
  pestRisk: number;
  careStreak: number;
  harvestedAt: string | null;
  activatedAt: string;
  /** When it died of neglect; it is replanted from seed on the same kit. */
  diedAt: string | null;
  /** Which planting this is: 2 after the first one died. */
  attempt: number;
  /** Pickings so far, out of the species' number (3 for a plant that crops again). */
  harvestCount: number;
  harvestsMax: number;
  /** 1 for the kit's own planting, 2 for one sown from its saved seeds. */
  season: number;
  /** Finished and its seeds not yet sown into a new season. */
  seedsReady: boolean;
  /** The best stars any of its pickings earned, 0 before the first. */
  bestStars: number;
}

/** One picking, as its certificate shows it. */
export interface HarvestRecord {
  id: string;
  number: number;
  of: number;
  stars: number;
  avgHealth: number;
  careCount: number;
  streak: number;
  days: number;
  createdAt: string;
  plantName: string;
  speciesKey: string;
  speciesLabel: string;
  harvestLabel: string;
  season: number;
  attempt: number;
}

/** A simple dish to make with the harvest. */
export interface HarvestRecipe {
  title: string;
  steps: string[];
  note: string;
}

/** The species harvested, out of those the shop sells; each full set is a free workshop seat. */
export interface HarvestCollection {
  species: Array<{ key: string; label: string; icon: string; harvests: number; bestStars: number }>;
  collected: number;
  total: number;
  sets: number;
  totalStars: number;
}

export interface PlantEnvironment {
  light: number;
  temperature: number;
  humidity: number;
  isDay: boolean;
  hour: number;
  lightAssisted: boolean;
  cooled: boolean;
}

export interface CareSlot {
  action: CareActionId;
  label: string;
  icon: IconName;
  hint: string;
  cooldownHours: number;
  allowedInStage: boolean;
  ready: boolean;
  secondsLeft: number;
  readyAt: string | null;
  lastDoneAt: string | null;
}

export interface PlantDevice {
  type: DeviceType;
  label: string;
  icon: IconName;
  kind: 'sensor' | 'actuator';
  about: string;
  unit: string;
  unlockStage: PlantStageId;
  unlockStageLabel: string;
  unlocked: boolean;
  autoMode: boolean;
  battery: number;
  reading: number | null;
  secondary: { label: string; value: number; unit: string } | null;
  /** Only for VIP accounts (the care kit); `vipLocked` when this account is not VIP. */
  vipOnly: boolean;
  vipLocked: boolean;
}

export interface SensorReading {
  moisture: number;
  temperature: number;
  humidity: number;
  light: number;
  nutrient: number;
  health: number;
  recordedAt: string;
}

/** One turn in the Plant Buddy thread. */
export interface CoachMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface CareHistoryEntry {
  id: string;
  action: CareActionId;
  label: string;
  icon: IconName;
  stage: PlantStageId;
  stageLabel: string;
  growth: number;
  warned: boolean;
  /** Done by VIP's gardener, `count` times, rather than by the child. */
  auto: boolean;
  count: number;
  createdAt: string;
}

/** One of the things a stage asks for before the plant moves on. */
export interface StageTask {
  action: CareActionId;
  label: string;
  icon: IconName;
  need: number;
  done: number;
}

export interface NextStep {
  action: CareActionId | null;
  label: string | null;
  icon: IconName;
  why: string;
  hint?: string;
}

export interface PlantStageInfo {
  id: PlantStageId;
  label: string;
  icon: IconName;
  story: string;
  reached: boolean;
  current: boolean;
}

/** Everything the simulation dashboard renders. */
export interface PlantDetail extends PlantCard {
  growthPoints: number;
  lastTickAt: string;
  harvestLabel: string;
  needsPollination: boolean;
  stageStory: string;
  cultivation?: { name: string; sow: string; support: string; mature: string };
  /** Where the species comes from and what to look for (see SpeciesProfile). */
  speciesProfile?: SpeciesProfile | null;
  idealMoisture: [number, number];
  idealTemp: [number, number];
  environment: PlantEnvironment;
  nextStep: NextStep;
  stages: PlantStageInfo[];
  devices: PlantDevice[];
  care: CareSlot[];
  readings: SensorReading[];
  coachMessages: CoachMessage[];
  history: CareHistoryEntry[];
  /** The stage's tasks; with its points (stageProgress 100) they move the plant on. */
  tasks: StageTask[];
  tasksDone: boolean;
  pointsFull: boolean;
  /** How far a plant grows through a stage on its own, without care. */
  passiveCap: number;
  /** "Héo nặng", and the real hours left before it dies. */
  wilt: { critical: boolean; hoursLeft: number | null };
  /** VIP's care kit: whether the account may use it, and whether it is switched on. */
  keeper: { vip: boolean; on: boolean; until: string | null };
  /** Every picking's certificate, oldest first. */
  harvests: HarvestRecord[];
  /** The dish to make with the harvest, once there is one. */
  recipe: HarvestRecipe | null;
  /** A photo was saved to its album since the first picking: the real harvest. */
  realHarvestPhoto: boolean;
  /** Sowing its seeds would be a season past the free ones. */
  seedsNeedVip: boolean;
}

export interface PlantEvent {
  level: 'good' | 'warn' | 'info';
  text: string;
  stage?: PlantStageId;
}

export interface RewardSummary {
  threshold: number;
  units: number;
  earned: number;
  progressInCycle: number;
  unitsToNext: number;
  availableCount: number;
  claimedCount: number;
  newlyEarned: number;
  rewards: Array<{
    id: string;
    type: 'free_workshop' | 'species_collection';
    status: 'available' | 'claimed';
    milestone: number;
    claimedRegistrationId: string | null;
    claimedAt: string | null;
    createdAt: string;
  }>;
}

/**
 * What the admin picked when putting the kit on sale. The catalogue lives in
 * backend/src/services/plant-sim.js and the colours come down with each plant,
 * so this file does not keep a second copy of which species is which colour.
 */
export interface SpeciesOption {
  key: string;
  label: string;
  icon: IconName;
  harvest: string;
  pollinate: boolean;
  form: PlantForm;
  fruitShape: FruitShape;
  fruitColor: string;
  flowerColor: string;
  blurb: string;
  stageLabels: string[];
  /** What the kit's page will say about the plant; attached to every kit of this species. */
  profile: SpeciesProfile | null;
}

/** "còn 2 giờ 15 phút" — the wording the cooldown pills use. */
export function formatCountdown(seconds: number) {
  if (seconds <= 0) return 'sẵn sàng';
  const total = Math.ceil(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours} giờ ${minutes} phút`;
  if (minutes > 0) return `${minutes} phút ${String(secs).padStart(2, '0')}s`;
  return `${secs}s`;
}

/** Colour band for a 0–100 metric, matching the CSS classes. */
export function metricBand(value: number, ideal?: [number, number]) {
  if (!ideal) return value >= 60 ? 'good' : value >= 35 ? 'warn' : 'bad';
  if (value < ideal[0] - 18 || value > ideal[1] + 18) return 'bad';
  if (value < ideal[0] || value > ideal[1]) return 'warn';
  return 'good';
}
