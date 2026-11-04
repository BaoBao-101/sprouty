/*
 * The API's shapes, as the app uses them. Kept in step with the website's
 * frontend/src/types/*.ts — the same endpoints answer both.
 */
import type { IconName } from '@/components/Icon';
import type { FruitShape, PlantForm } from '@/components/PlantForms';

export type ProductBadge = 'hot' | 'new' | 'sale' | null;

/** Who a species is, the same for every kit of it (backend/src/services/species-profile.js). */
export interface SpeciesProfile {
  scientificName: string;
  family: string;
  otherNames: string[];
  origin: string;
  story: string;
  traits: string[];
  funFacts: string[];
}

export interface ProductSpecies {
  key: string;
  label: string;
  icon: string;
  harvest: string;
  form: string;
  pollinate: boolean;
  profile?: SpeciesProfile | null;
}

export interface Product {
  id: number;
  name: string;
  col: string;
  cat: string;
  species: ProductSpecies | null;
  age: string;
  price: number;
  old: number | null;
  smartDelta: number | null;
  bg: string;
  desc: string;
  inc: string[];
  /** The real IoT devices the Smart · IoT variant adds to the box. */
  smartInc: string[];
  badge: ProductBadge;
  images: string[];
  rating: number;
  reviewCount: number;
}

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderItem {
  productId?: number;
  qty: number;
  unitPrice: number;
  variant?: string | null;
  product?: { id?: number; name?: string; images?: string[]; category?: string; membershipDays?: number | null };
}

export interface RedeemCode {
  code: string;
  productId?: number;
  productName?: string;
  kind?: 'kit' | 'membership';
  redeemed?: boolean;
  plantId?: string | null;
  plantNickname?: string | null;
  activatedAt?: string | null;
}

export interface Order {
  id: string;
  status: OrderStatus;
  total: number;
  createdAt: string;
  paidAt?: string | null;
  note?: string | null;
  shippingName: string;
  shippingPhone: string;
  shippingAddress?: string | null;
  items: OrderItem[];
  redeemCodes?: RedeemCode[];
  needsShipping?: boolean;
  shippedAt?: string | null;
  carrier?: string | null;
  trackingCode?: string | null;
  deliveredAt?: string | null;
  deliveredBy?: 'customer' | 'staff' | 'auto' | null;
}

export interface MembershipInfo {
  days: number;
  tier: 'regular' | 'vip';
  isVip: boolean;
  vipUntil: string | null;
  vipExpired: boolean;
}

/** Bank-transfer instructions, for an order or a workshop booking. */
export interface Transfer {
  qrUrl: string;
  bankCode?: string;
  accountNumber?: string;
  accountName?: string;
  memo?: string;
  amount: number;
}

export interface PublicWorkshop {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  dateTime: string;
  endTime?: string | null;
  location: string;
  /** The street address the map looks up; absent, the map searches `location`. */
  address?: string | null;
  ageRange?: string | null;
  price: number;
  capacity: number;
  seatsTaken: number;
  seatsLeft: number;
  isFull: boolean;
  upcoming: boolean;
  bookable?: boolean;
}

export interface MyWorkshopRegistration {
  id: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  childAge?: string | null;
  childCount: number;
  note?: string | null;
  paymentMethod: 'online' | 'onsite';
  amount: number;
  paidAt?: string | null;
  ticket: string;
  checkedInAt: string | null;
  attendedCount: number | null;
  createdAt: string;
  upcoming: boolean;
  workshop: PublicWorkshop & { status: string };
}

export type PlantStageId =
  | 'seed' | 'sprout' | 'seedling' | 'vegetative' | 'budding' | 'flowering' | 'fruiting' | 'mature';

export type CareActionId =
  | 'water' | 'mist' | 'fertilize' | 'prune' | 'pest_check' | 'sunlight'
  | 'loosen_soil' | 'pollinate' | 'harvest';

export interface PlantCard {
  id: string;
  nickname: string;
  productId: number;
  productName: string;
  bgColor: string | null;
  speciesKey: string;
  speciesLabel: string;
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
  healthState: { id: 'thriving' | 'healthy' | 'stressed' | 'wilting' | 'critical' | 'dead'; label: string };
  moisture: number;
  nutrient: number;
  pestRisk: number;
  careStreak: number;
  harvestedAt: string | null;
  activatedAt: string;
  diedAt: string | null;
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

export interface PlantEvent {
  level: 'good' | 'warn' | 'info';
  text: string;
}

export interface PlantAlert extends PlantEvent {
  plantId: string;
  nickname: string;
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
  type: string;
  label: string;
  icon: IconName;
  kind: 'sensor' | 'actuator';
  about: string;
  unit: string;
  unlockStageLabel: string;
  unlocked: boolean;
  autoMode: boolean;
  battery: number;
  reading: number | null;
  vipOnly: boolean;
  vipLocked: boolean;
  /** A second value some sensors take (the thermometer's air humidity). */
  secondary?: { label: string; value: number; unit: string } | null;
}

export interface StageTask {
  action: CareActionId;
  label: string;
  icon: IconName;
  need: number;
  done: number;
}

export interface CareHistoryEntry {
  id: string;
  action: CareActionId;
  label: string;
  icon: IconName;
  stageLabel: string;
  growth: number;
  warned: boolean;
  auto: boolean;
  count: number;
  createdAt: string;
}

export interface CoachMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

/** One hourly reading from the plant's sensors, for the 24-hour chart. */
export interface SensorReading {
  moisture: number;
  temperature: number;
  humidity: number;
  light: number;
  nutrient: number;
  health: number;
  recordedAt: string;
}

export interface PlantDetail extends PlantCard {
  /** The last day of readings, oldest first. */
  readings?: SensorReading[];
  harvestLabel: string;
  stageStory: string;
  idealMoisture: [number, number];
  idealTemp: [number, number];
  environment: { light: number; temperature: number; humidity: number; isDay: boolean; hour: number };
  nextStep: { action: CareActionId | null; label: string | null; icon: IconName; why: string; hint?: string };
  stages: Array<{ id: PlantStageId; label: string; icon: IconName; story: string; reached: boolean; current: boolean }>;
  devices: PlantDevice[];
  care: CareSlot[];
  coachMessages: CoachMessage[];
  history: CareHistoryEntry[];
  tasks: StageTask[];
  tasksDone: boolean;
  /** The stage's points are full; only its tasks hold the plant back. */
  pointsFull?: boolean;
  wilt: { critical: boolean; hoursLeft: number | null };
  /** VIP's care kit: whether the account may use it, and whether it is on. */
  keeper?: { vip: boolean; on: boolean; until: string | null };
  cultivation?: { name: string; sow: string; support: string; mature: string };
  /** Where the species comes from and what to look for. */
  speciesProfile?: SpeciesProfile | null;
  /** Every picking's certificate, oldest first. */
  harvests: HarvestRecord[];
  /** The dish to make with the harvest, once there is one. */
  recipe: HarvestRecipe | null;
  /** A photo was saved to its album since the first picking: the real harvest. */
  realHarvestPhoto: boolean;
  /** Sowing its seeds would be a season past the free ones. */
  seedsNeedVip: boolean;
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

export interface RewardSummary {
  threshold: number;
  units: number;
  progressInCycle: number;
  unitsToNext: number;
  availableCount: number;
}

export interface Review {
  id: string;
  rating: number;
  content: string;
  tags: string[];
  images: string[];
  author: string;
  verified: boolean;
  createdAt: string;
  reply: { content: string; at: string } | null;
}

export interface OwnReview extends Review {
  anonymous: boolean;
  status: 'published' | 'hidden';
  hiddenReason: string | null;
  productId?: number;
  workshopId?: string;
}

export interface ReviewOptions {
  labels: Record<string, string>;
  tags: { good: string[]; bad: string[] };
  maxImages: number;
  maxLength: number;
}

export interface AlbumLeaf {
  id: string;
  title: string | null;
  note: string | null;
  url: string | null;
  asset: { mimeType?: string } | null;
  stage: PlantStageId | null;
  stageLabel: string | null;
  createdAt: string;
}

export interface Album {
  images: AlbumLeaf[];
  vip: boolean;
  leavesPerStage: number | null;
  product: { id: number; name: string } | null;
  plant: { id: string; nickname: string; stage: PlantStageId; harvestedAt: string | null } | null;
  /** What the plant gave: its pickings, the photo of the real harvest, the dish. Null before the first. */
  harvest: AlbumHarvest | null;
  stages: Array<{ id: PlantStageId; label: string; icon: IconName }>;
}

export interface AlbumHarvest {
  pickings: Array<{ id: string; number: number; stars: number; createdAt: string }>;
  of: number;
  finished: boolean;
  season: number;
  photo: AlbumLeaf | null;
  recipe: HarvestRecipe | null;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  coverUrl?: string | null;
  content?: string;
  contentHtml?: string;
  publishedAt?: string | null;
  createdAt?: string;
}
