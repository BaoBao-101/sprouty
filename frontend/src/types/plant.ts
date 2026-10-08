import type { IconName } from '@/components/icons/SproutyIcon';
import type { FruitShape, PlantForm } from '@/components/PlantForms';

export type PlantStageId =
  | 'seed' | 'sprout' | 'seedling' | 'vegetative' | 'budding' | 'flowering' | 'fruiting' | 'mature';

export type CareActionId =
  | 'water' | 'mist' | 'fertilize' | 'prune' | 'pest_check' | 'sunlight'
  | 'loosen_soil' | 'pollinate' | 'harvest';

export type DeviceType =
  | 'moisture_sensor' | 'thermo_sensor' | 'light_sensor' | 'nutrient_sensor'
  | 'water_pump' | 'grow_light' | 'fan' | 'camera';

export interface HealthState {
  id: 'thriving' | 'healthy' | 'stressed' | 'wilting';
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
  createdAt: string;
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
    type: 'free_workshop';
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
