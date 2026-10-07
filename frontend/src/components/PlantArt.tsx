/**
 * The plant itself.
 *
 * This is the one thing on the page a child actually looks at, so it is drawn
 * rather than picked from a sprite sheet: the stem height, the number of
 * leaves, the buds, the flowers and the fruit all come from the live stage and
 * progress, which means watering the plant visibly moves something. A set of
 * eight fixed images would only have changed at the stage boundary, hours
 * apart, and the child would never see their care land.
 *
 * Health tints the foliage and droops the leaves. A wilting plant looks
 * wilting, so the number on the sensor card and the picture agree.
 *
 * Deterministic throughout: every "random" angle is derived from the leaf index,
 * so the plant does not reshuffle itself on each render.
 */

import { PlantBody, type FruitShape, type PlantForm } from '@/components/PlantForms';

export type PlantStageId =
  | 'seed' | 'sprout' | 'seedling' | 'vegetative' | 'budding' | 'flowering' | 'fruiting' | 'mature';

const STAGE_ORDER: PlantStageId[] = [
  'seed', 'sprout', 'seedling', 'vegetative', 'budding', 'flowering', 'fruiting', 'mature',
];

interface Props {
  stage: PlantStageId;
  /** 0–100 within the stage; drives the in-between growth. */
  progress?: number;
  /** 0–100. Below ~45 the plant droops and pales. */
  health?: number;
  /** How the species grows: a vine climbs, a root swells, a stalk stands. */
  form?: PlantForm;
  /** What it bears: a round tomato, a pointed chilli, a bean pod. */
  fruitShape?: FruitShape;
  /** Fruit colour, so a pepper is not the same red as a tomato. */
  fruitColor?: string;
  /** Petal colour. */
  flowerColor?: string;
  /** Night dims the scene, matching the light sensor. */
  isNight?: boolean;
  size?: number;
  className?: string;
}

/** Continuous 0–7.99 position along the journey, for smooth in-between growth. */
function growthPosition(stage: PlantStageId, progress: number) {
  const index = Math.max(0, STAGE_ORDER.indexOf(stage));
  return index + Math.min(0.999, Math.max(0, progress / 100));
}

/** Deterministic spread so leaves fan out without ever reshuffling. */
function leafAngle(index: number) {
  const base = index % 2 === 0 ? -1 : 1;
  return base * (26 + ((index * 13) % 22));
}

export function PlantArt({
  stage,
  progress = 0,
  health = 100,
  form = 'bush',
  fruitShape = 'round',
  fruitColor = '#E8503A',
  flowerColor = '#FFC83D',
  isNight = false,
  size = 260,
  className,
}: Props) {
  const pos = growthPosition(stage, progress);
  const vigour = Math.min(1, Math.max(0, (health - 10) / 80));

  // Soil line sits at y=252; the plant grows upward from there.
  const SOIL_Y = 252;

  // Stem: nothing until the sprout, then up to 150px tall by maturity.
  const stemHeight = pos < 1 ? 0 : Math.min(150, 14 + (pos - 1) * 22) * (0.72 + vigour * 0.28);
  const stemTop = SOIL_Y - stemHeight;
  // A thirsty plant leans; a healthy one stands up straight.
  const lean = (1 - vigour) * 12;

  // Leaves appear in pairs as the plant grows.
  const leafCount = pos < 1 ? 0 : Math.min(8, Math.floor((pos - 0.9) * 1.9) + 1);
  const leafScale = 0.74 + vigour * 0.26;

  const showSeed = pos < 1;
  const showBuds = pos >= 4 && pos < 5.6;
  const showFlowers = pos >= 5;
  const showFruit = pos >= 6;
  const isMature = stage === 'mature';

  // Pale and yellow when unwell: the same signal the health card gives.
  const leafDark = mix('#2E8447', '#B9A14E', 1 - vigour);
  const leafLight = mix('#7BC96F', '#D8C98A', 1 - vigour);
  const stemColor = mix('#3C8A4A', '#A8995A', 1 - vigour);

  return (
    <svg
      viewBox="0 0 300 300"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={`Cây ở giai đoạn ${stage}, sức khoẻ ${Math.round(health)}%`}
    >
      <defs>
        <linearGradient id="pa-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isNight ? '#27365B' : '#A6D8F5'} />
          <stop offset="62%" stopColor={isNight ? '#3B4C78' : '#CDE9F8'} />
          <stop offset="100%" stopColor={isNight ? '#4A5B88' : '#E6F4FB'} />
        </linearGradient>
        <linearGradient id="pa-leaf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={leafLight} />
          <stop offset="100%" stopColor={leafDark} />
        </linearGradient>
        <linearGradient id="pa-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isNight ? '#3E4668' : '#F2E3BE'} />
          <stop offset="100%" stopColor={isNight ? '#333A58' : '#E6D3A6'} />
        </linearGradient>
        <radialGradient id="pa-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={isNight ? '#FFF0B8' : '#FFE9A0'} stopOpacity={isNight ? 0.3 : 0.7} />
          <stop offset="100%" stopColor={isNight ? '#FFF0B8' : '#FFE9A0'} stopOpacity="0" />
        </radialGradient>
        {/* Keeps the scene inside the card's rounded corners without needing a
            rounded rect behind every single layer. */}
        <clipPath id="pa-frame">
          <rect x="0" y="0" width="300" height="300" rx="28" />
        </clipPath>
      </defs>

      <g clipPath="url(#pa-frame)">
        {/* ── Sky ─────────────────────────────────────────────────────────── */}
        <rect x="0" y="0" width="300" height="300" fill="url(#pa-sky)" />

        {/* ── Sun / moon ──────────────────────────────────────────────────── */}
        <circle cx="236" cy="58" r="52" fill="url(#pa-glow)" />
        {isNight ? (
          <>
            {/* Crescent, cut by a second circle rather than drawn as a path, so
                the curve stays true at any size. */}
            <mask id="pa-moon">
              <rect x="0" y="0" width="300" height="300" fill="#000" />
              <circle cx="236" cy="58" r="21" fill="#fff" />
              <circle cx="246" cy="49" r="18" fill="#000" />
            </mask>
            <circle cx="236" cy="58" r="21" fill="#FFF0B8" mask="url(#pa-moon)" />
            <g fill="#FFFBEA">
              <circle cx="54" cy="46" r="2.4" opacity="0.9" />
              <circle cx="92" cy="28" r="1.7" opacity="0.75" />
              <circle cx="148" cy="52" r="2" opacity="0.85" />
              <circle cx="38" cy="92" r="1.5" opacity="0.7" />
              <circle cx="186" cy="30" r="1.8" opacity="0.8" />
              <circle cx="118" cy="76" r="1.4" opacity="0.6" />
            </g>
          </>
        ) : (
          <g>
            {/* Soft, outline-free sun with rounded rays, matching the flat
                illustration style the rest of the scene uses. */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
              const rad = (deg * Math.PI) / 180;
              return (
                <line
                  key={deg}
                  x1={236 + Math.cos(rad) * 28}
                  y1={58 + Math.sin(rad) * 28}
                  x2={236 + Math.cos(rad) * 37}
                  y2={58 + Math.sin(rad) * 37}
                  stroke="#FFDF7E"
                  strokeWidth="5.5"
                  strokeLinecap="round"
                />
              );
            })}
            <circle cx="236" cy="58" r="21" fill="#FFD95E" />
          </g>
        )}

        {/* ── Clouds ──────────────────────────────────────────────────────── */}
        <g fill={isNight ? '#5A6894' : '#FFFFFF'} opacity={isNight ? 0.4 : 0.92}>
          <g transform="translate(34 56)">
            <ellipse cx="0" cy="8" rx="26" ry="11" />
            <circle cx="-8" cy="2" r="12" />
            <circle cx="8" cy="-1" r="15" />
          </g>
          <g transform="translate(262 128) scale(0.72)">
            <ellipse cx="0" cy="8" rx="26" ry="11" />
            <circle cx="-8" cy="2" r="12" />
            <circle cx="8" cy="-1" r="14" />
          </g>
        </g>

        {/* ── Distant hills ───────────────────────────────────────────────── */}
        <path
          d="M-10 206c28-26 54-26 80-6s48 20 74-2 52-22 80 2 46 18 86-6v40H-10Z"
          fill={isNight ? '#39466E' : '#B9DCEE'}
          opacity={isNight ? 1 : 0.85}
        />
        <path
          d="M-10 222c34-20 58-18 84 0s52 16 78-4 54-14 78 6 40 12 70-4v30H-10Z"
          fill={isNight ? '#414E78' : '#CBE6F3'}
          opacity={isNight ? 1 : 0.9}
        />

        {/* ── Ground ──────────────────────────────────────────────────────── */}
        <rect x="-10" y="242" width="320" height="70" fill="url(#pa-ground)" />

        {/* ── Bushes, behind the pot ──────────────────────────────────────── */}
        <g fill={isNight ? '#2C4C3C' : '#AED99B'}>
          <circle cx="16" cy="232" r="30" />
          <circle cx="48" cy="238" r="22" />
          <circle cx="286" cy="230" r="32" />
          <circle cx="254" cy="240" r="20" />
        </g>
        <g fill={isNight ? '#35604A' : '#8FC979'}>
          <circle cx="4" cy="246" r="26" />
          <circle cx="40" cy="250" r="18" />
          <circle cx="296" cy="244" r="28" />
          <circle cx="262" cy="252" r="17" />
          {/* A couple of small sprigs, so the ground is not a bare band. */}
          <ellipse cx="74" cy="258" rx="9" ry="5" opacity="0.75" />
          <ellipse cx="232" cy="262" rx="8" ry="4.5" opacity="0.7" />
        </g>

        {/* ── Pot ─────────────────────────────────────────────────────────── */}
        {/* Shadow first, so the pot sits on the ground rather than floating. */}
        <ellipse cx="150" cy="292" rx="92" ry="11" fill={isNight ? '#2A3050' : '#D7C198'} opacity="0.55" />

        {/* Wide shallow bowl: a lighter rim across the top, a tapering body
            below it, matching the reference illustration. */}
        <path d="M70 254h160l-14 34a12 12 0 0 1-11.9 9.6H95.9A12 12 0 0 1 84 288L70 254Z" fill="#C96A32" />
        <path d="M84 254h132l-11 28a10 10 0 0 1-9.9 8H105a10 10 0 0 1-9.9-8L84 254Z" fill="#E08445" opacity="0.55" />
        <rect x="60" y="236" width="180" height="20" rx="10" fill="#F0A952" />
        <rect x="60" y="236" width="180" height="9" rx="4.5" fill="#F7BE72" />

        {/* Soil inside the bowl. */}
        <path
          d="M74 244c16-5 28-5 40 0s28 5 42 0 28-5 42 0 20 3 24 1v-5H74Z"
          fill={isNight ? '#4A3626' : '#6B4A2E'}
        />
      </g>

      {/* The plant itself, drawn according to its species' growth form. */}
      <g transform={`rotate(${lean} 150 ${SOIL_Y})`}>
        {showSeed ? (
          // A seed half-buried, cracking open as the stage completes.
          <g transform={`translate(150 ${SOIL_Y - 10})`}>
            <ellipse rx="17" ry="22" fill="#C89A5B" stroke="#8A6433" strokeWidth="4" />
            <path d="M-6-13c5 8 5 18 0 26" stroke="#8A6433" strokeWidth="3" fill="none" strokeLinecap="round" />
            {progress > 45 && (
              <path d="M0-20c0 0 7 7 7 14" stroke="#7BC96F" strokeWidth="4.5" fill="none" strokeLinecap="round" />
            )}
          </g>
        ) : (
          <PlantBody
            form={form}
            fruitShape={fruitShape}
            pos={pos}
            vigour={vigour}
            soilY={SOIL_Y}
            stemHeight={stemHeight}
            stemTop={stemTop}
            leafCount={leafCount}
            leafScale={leafScale}
            leafDark={leafDark}
            stemColor={stemColor}
            fruitColor={fruitColor}
            flowerColor={flowerColor}
            isMature={isMature}
            showBuds={showBuds}
            showFlowers={showFlowers}
            showFruit={showFruit}
            mix={mix}
            leafAngle={leafAngle}
          />
        )}
      </g>

      {/* The harvest ribbon, once the journey is finished */}
      {isMature && (
        <g transform="translate(150 36)">
          <rect x="-56" y="-16" width="112" height="32" rx="16" fill="#FFC83D" stroke="#E2A41C" strokeWidth="3" />
          <text
            textAnchor="middle"
            y="6"
            fontSize="15"
            fontWeight="700"
            fill="#6B4A00"
            fontFamily="inherit"
          >
            Đã chín!
          </text>
        </g>
      )}
    </svg>
  );
}

/** Blends two hex colours; `amount` 0 keeps `a`, 1 gives `b`. */
function mix(a: string, b: string, amount: number) {
  const t = Math.min(1, Math.max(0, amount));
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function hexToRgb(hex: string): number[] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}
