/**
 * Sprouty's icon set.
 *
 * Drawn for children, not for a dashboard: thick rounded strokes, chunky
 * shapes, and a soft accent fill behind the line so each one reads as a
 * crayon drawing rather than a thin utility glyph. The strokes are deliberately
 * a little off-square — a perfectly symmetrical leaf looks machine-made next
 * to the hand-drawn Sprouty mascots in /assets/images/sprouty-icons.
 *
 * Two colours, both inherited:
 *   `color`          → the outline, so an icon matches the text beside it
 *   `--icon-accent`  → the fill, set per card to the brand colour it belongs to
 *
 * Every icon lives on the same 24×24 grid with the same stroke weight, so a row
 * of them lines up without per-icon nudging.
 */

export type IconName =
  // growth stages
  | 'seed' | 'sprout' | 'seedling' | 'leaf' | 'bud' | 'flower' | 'fruit' | 'harvest'
  // care actions
  | 'water' | 'mist' | 'fertilize' | 'sun' | 'pest' | 'prune' | 'soil' | 'pollinate'
  // devices
  | 'moisture' | 'thermo' | 'light' | 'camera' | 'nutrient' | 'pump' | 'bulb' | 'fan'
  // interface
  | 'clock' | 'gift' | 'ticket' | 'check' | 'lock' | 'battery' | 'plus' | 'trophy'
  | 'heart' | 'bolt' | 'info' | 'bell' | 'chat' | 'sparkle' | 'chart' | 'pot'
  | 'moon' | 'arrow-right' | 'arrow-down' | 'pencil' | 'trash' | 'cart' | 'album' | 'warning';

interface Props {
  name: IconName;
  /** Pixel size; the icon is square. */
  size?: number;
  /** Overrides the inherited `--icon-accent` for the fill. */
  accent?: string;
  className?: string;
  /** Set when the icon is the only label, e.g. an icon-only button. */
  title?: string;
}

/** Shared geometry so the whole set keeps one weight and one feel. */
const S = {
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none',
};

const ACCENT = 'var(--icon-accent, currentColor)';

/** The soft shape that sits behind the outline. */
function fillProps(opacity = 0.25) {
  return { fill: ACCENT, opacity, stroke: 'none' };
}

const PATHS: Record<IconName, React.ReactNode> = {
  // ── Growth stages ──────────────────────────────────────────────────────────
  seed: (
    <>
      <path d="M12 4.5c3.4 1.6 5 4.4 5 7.6 0 4-2.4 7.4-5 7.4s-5-3.4-5-7.4c0-3.2 1.6-6 5-7.6Z" {...fillProps(0.3)} />
      <path d="M12 4.5c3.4 1.6 5 4.4 5 7.6 0 4-2.4 7.4-5 7.4s-5-3.4-5-7.4c0-3.2 1.6-6 5-7.6Z" {...S} />
      <path d="M12 8.5v7" {...S} strokeWidth={1.6} />
    </>
  ),
  sprout: (
    <>
      <path d="M12 20v-7" {...S} />
      <path d="M12 13C12 9.7 9.8 7.5 6.5 7.5c0 3.3 2.2 5.5 5.5 5.5Z" {...fillProps(0.35)} />
      <path d="M12 13C12 9.7 9.8 7.5 6.5 7.5c0 3.3 2.2 5.5 5.5 5.5Z" {...S} />
      <path d="M12 12.4c0-2.9 1.9-4.9 4.8-4.9 0 2.9-1.9 4.9-4.8 4.9Z" {...fillProps(0.2)} />
      <path d="M12 12.4c0-2.9 1.9-4.9 4.8-4.9 0 2.9-1.9 4.9-4.8 4.9Z" {...S} />
      <path d="M8 20h8" {...S} />
    </>
  ),
  seedling: (
    <>
      <path d="M12 20.5V9" {...S} />
      <path d="M12 14.5C12 11.3 9.6 9 6.3 9c0 3.2 2.4 5.5 5.7 5.5Z" {...fillProps(0.35)} />
      <path d="M12 14.5C12 11.3 9.6 9 6.3 9c0 3.2 2.4 5.5 5.7 5.5Z" {...S} />
      <path d="M12 13.2c0-3 2.2-5.2 5.4-5.2 0 3-2.3 5.2-5.4 5.2Z" {...fillProps(0.22)} />
      <path d="M12 13.2c0-3 2.2-5.2 5.4-5.2 0 3-2.3 5.2-5.4 5.2Z" {...S} />
      <path d="M12 9c0-1.9.9-3.3 2.6-4.2" {...S} strokeWidth={1.7} />
      <path d="M7.5 20.5h9" {...S} />
    </>
  ),
  leaf: (
    <>
      <path d="M19.5 4.5c0 8-4.6 12.4-10.2 12.4-2.3 0-4-.7-4.8-1.5C5.3 7.8 11 4.5 19.5 4.5Z" {...fillProps(0.3)} />
      <path d="M19.5 4.5c0 8-4.6 12.4-10.2 12.4-2.3 0-4-.7-4.8-1.5C5.3 7.8 11 4.5 19.5 4.5Z" {...S} />
      <path d="M4.5 20C7 13.5 11.5 9.4 17 7.5" {...S} strokeWidth={1.7} />
    </>
  ),
  bud: (
    <>
      <path d="M12 21v-7.5" {...S} />
      <path d="M12 13.5c-2.4 0-4-1.9-4-4.6C8 6 9.8 3.5 12 3.5s4 2.5 4 5.4c0 2.7-1.6 4.6-4 4.6Z" {...fillProps(0.3)} />
      <path d="M12 13.5c-2.4 0-4-1.9-4-4.6C8 6 9.8 3.5 12 3.5s4 2.5 4 5.4c0 2.7-1.6 4.6-4 4.6Z" {...S} />
      <path d="M12 4.5v8" {...S} strokeWidth={1.5} />
      <path d="M12 17c-1.6-.1-2.8-1-3.4-2.4M12 17c1.6-.1 2.8-1 3.4-2.4" {...S} strokeWidth={1.7} />
    </>
  ),
  flower: (
    <>
      <path d="M12 21v-7" {...S} />
      <path d="M12 3.5c2 0 3.2 1.4 3.2 3 1.9-.6 3.6.3 4.1 1.9.5 1.6-.5 3.2-2.3 3.8 1.2 1.5 1 3.4-.4 4.4-1.4 1-3.2.6-4.3-.9-1.1 1.5-2.9 1.9-4.3.9-1.4-1-1.6-2.9-.4-4.4C6 11.6 5 10 5.5 8.4 6 6.8 7.7 5.9 9.6 6.5c0-1.6 1.2-3 3.2-3Z" {...fillProps(0.28)} />
      <path d="M12 3.5c2 0 3.2 1.4 3.2 3 1.9-.6 3.6.3 4.1 1.9.5 1.6-.5 3.2-2.3 3.8 1.2 1.5 1 3.4-.4 4.4-1.4 1-3.2.6-4.3-.9-1.1 1.5-2.9 1.9-4.3.9-1.4-1-1.6-2.9-.4-4.4C6 11.6 5 10 5.5 8.4 6 6.8 7.7 5.9 9.6 6.5c0-1.6 1.2-3 3.2-3Z" {...S} />
      <circle cx="12" cy="10.8" r="2.3" fill={ACCENT} opacity={0.85} stroke="none" />
      <circle cx="12" cy="10.8" r="2.3" {...S} strokeWidth={1.7} />
    </>
  ),
  fruit: (
    <>
      <path d="M12 7.2c3.6 0 6.3 2.8 6.3 6.3 0 4-2.8 7-6.3 7s-6.3-3-6.3-7c0-3.5 2.7-6.3 6.3-6.3Z" {...fillProps(0.32)} />
      <path d="M12 7.2c3.6 0 6.3 2.8 6.3 6.3 0 4-2.8 7-6.3 7s-6.3-3-6.3-7c0-3.5 2.7-6.3 6.3-6.3Z" {...S} />
      <path d="M12 7.2V4.4" {...S} />
      <path d="M12 5.4c1.6-1.9 3.4-2.3 5-1.6-.6 1.9-2.3 2.9-5 2.6Z" {...fillProps(0.5)} />
      <path d="M12 5.4c1.6-1.9 3.4-2.3 5-1.6-.6 1.9-2.3 2.9-5 2.6Z" {...S} strokeWidth={1.7} />
    </>
  ),
  harvest: (
    <>
      <path d="M6.5 4.5h11l-.7 4.2a4.9 4.9 0 0 1-4.8 4.1 4.9 4.9 0 0 1-4.8-4.1L6.5 4.5Z" {...fillProps(0.32)} />
      <path d="M6.5 4.5h11l-.7 4.2a4.9 4.9 0 0 1-4.8 4.1 4.9 4.9 0 0 1-4.8-4.1L6.5 4.5Z" {...S} />
      <path d="M12 12.8V17" {...S} />
      <path d="M8 20.5c0-1.9 1.8-3.5 4-3.5s4 1.6 4 3.5" {...S} />
      <path d="M17.2 5.5c1.6.2 2.6 1.2 2.4 2.6-.2 1.3-1.5 2-3 1.7" {...S} strokeWidth={1.6} />
      <path d="M6.8 5.5c-1.6.2-2.6 1.2-2.4 2.6.2 1.3 1.5 2 3 1.7" {...S} strokeWidth={1.6} />
    </>
  ),

  // ── Care actions ───────────────────────────────────────────────────────────
  water: (
    <>
      <path d="M12 3.2c3.4 4 5.6 6.9 5.6 9.6a5.6 5.6 0 1 1-11.2 0c0-2.7 2.2-5.6 5.6-9.6Z" {...fillProps(0.32)} />
      <path d="M12 3.2c3.4 4 5.6 6.9 5.6 9.6a5.6 5.6 0 1 1-11.2 0c0-2.7 2.2-5.6 5.6-9.6Z" {...S} />
      <path d="M9.6 13.6a2.6 2.6 0 0 0 1.7 3.1" {...S} strokeWidth={1.7} />
    </>
  ),
  mist: (
    <>
      <path d="M4.5 9.5a3.4 3.4 0 0 1 3.2-3.4A4.4 4.4 0 0 1 16 5.4a3.5 3.5 0 0 1 .8 6.9H8a3.5 3.5 0 0 1-3.5-2.8Z" {...fillProps(0.3)} />
      <path d="M4.5 9.5a3.4 3.4 0 0 1 3.2-3.4A4.4 4.4 0 0 1 16 5.4a3.5 3.5 0 0 1 .8 6.9H8a3.5 3.5 0 0 1-3.5-2.8Z" {...S} />
      <path d="M8 16v1.6M12 15.6v2.6M16 16v1.6M10 19.5v1M14 19.5v1" {...S} strokeWidth={1.8} />
    </>
  ),
  fertilize: (
    <>
      <path d="M5 10h14l-1.2 9.2a1.6 1.6 0 0 1-1.6 1.3H7.8a1.6 1.6 0 0 1-1.6-1.3L5 10Z" {...fillProps(0.3)} />
      <path d="M5 10h14l-1.2 9.2a1.6 1.6 0 0 1-1.6 1.3H7.8a1.6 1.6 0 0 1-1.6-1.3L5 10Z" {...S} />
      <path d="M8 10V7.2A2.2 2.2 0 0 1 10.2 5h3.6A2.2 2.2 0 0 1 16 7.2V10" {...S} />
      <circle cx="10" cy="14.5" r="1.1" fill={ACCENT} stroke="none" />
      <circle cx="14" cy="16.5" r="1.1" fill={ACCENT} stroke="none" />
      <circle cx="12.5" cy="13" r=".9" fill={ACCENT} stroke="none" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4.6" {...fillProps(0.4)} />
      <circle cx="12" cy="12" r="4.6" {...S} />
      <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4 17 7M7 17l-1.6 1.6" {...S} strokeWidth={1.9} />
    </>
  ),
  pest: (
    <>
      <circle cx="10.5" cy="10.5" r="6.4" {...fillProps(0.22)} />
      <circle cx="10.5" cy="10.5" r="6.4" {...S} />
      <path d="M15.3 15.3 20.5 20.5" {...S} strokeWidth={2.4} />
      <ellipse cx="10.5" cy="10.8" rx="2.2" ry="3" fill={ACCENT} opacity={0.75} stroke="none" />
      <ellipse cx="10.5" cy="10.8" rx="2.2" ry="3" {...S} strokeWidth={1.5} />
      <path d="M8.6 8.2 7.3 6.9M12.4 8.2l1.3-1.3" {...S} strokeWidth={1.5} />
    </>
  ),
  prune: (
    <>
      <circle cx="6.6" cy="17.4" r="2.6" {...fillProps(0.3)} />
      <circle cx="6.6" cy="17.4" r="2.6" {...S} />
      <circle cx="17.4" cy="17.4" r="2.6" {...fillProps(0.3)} />
      <circle cx="17.4" cy="17.4" r="2.6" {...S} />
      <path d="M8.4 15.6 18.5 4.2M15.6 15.6 5.5 4.2" {...S} />
    </>
  ),
  soil: (
    <>
      <path d="M3.5 14.5c2.4-1.6 4.4-1.6 6.5 0 2.1 1.6 4.1 1.6 6.3 0 2.1-1.6 3.4-1.5 4.2-.8v6.8H3.5v-6Z" {...fillProps(0.32)} />
      <path d="M3.5 14.5c2.4-1.6 4.4-1.6 6.5 0 2.1 1.6 4.1 1.6 6.3 0 2.1-1.6 3.4-1.5 4.2-.8" {...S} />
      <path d="M3.5 20.5h17" {...S} />
      <path d="M12 11V4.5M12 4.5 9.3 7M12 4.5 14.7 7" {...S} strokeWidth={1.8} />
    </>
  ),
  pollinate: (
    <>
      <ellipse cx="12" cy="14" rx="4" ry="5" {...fillProps(0.45)} />
      <ellipse cx="12" cy="14" rx="4" ry="5" {...S} />
      <path d="M8.2 12.4h7.6M8.2 15.6h7.6" {...S} strokeWidth={1.6} />
      <path d="M9.4 9.6C8 7.6 5.9 6.8 3.8 7.4c.6 2.3 2.5 3.7 5 3.4" {...S} strokeWidth={1.7} />
      <path d="M14.6 9.6c1.4-2 3.5-2.8 5.6-2.2-.6 2.3-2.5 3.7-5 3.4" {...S} strokeWidth={1.7} />
    </>
  ),

  // ── Devices ────────────────────────────────────────────────────────────────
  moisture: (
    <>
      <path d="M9 2.8c2.6 3.3 4.2 5.6 4.2 7.7A4.2 4.2 0 0 1 4.8 10.5C4.8 8.4 6.4 6.1 9 2.8Z" {...fillProps(0.35)} />
      <path d="M9 2.8c2.6 3.3 4.2 5.6 4.2 7.7A4.2 4.2 0 0 1 4.8 10.5C4.8 8.4 6.4 6.1 9 2.8Z" {...S} />
      <path d="M17 11v7.5" {...S} />
      <path d="M17 21.5c-1.3-1.4-2-2.4-2-3.3a2 2 0 0 1 4 0c0 .9-.7 1.9-2 3.3Z" {...fillProps(0.5)} />
      <path d="M13.8 13.5h6.4" {...S} strokeWidth={1.7} />
    </>
  ),
  thermo: (
    <>
      <path d="M10 13.9V5.5a2.2 2.2 0 0 1 4.4 0v8.4a4.3 4.3 0 1 1-4.4 0Z" {...fillProps(0.22)} />
      <path d="M10 13.9V5.5a2.2 2.2 0 0 1 4.4 0v8.4a4.3 4.3 0 1 1-4.4 0Z" {...S} />
      <path d="M12.2 9.5v7" stroke={ACCENT} strokeWidth={3} strokeLinecap="round" fill="none" />
      <circle cx="12.2" cy="17.4" r="2" fill={ACCENT} stroke="none" />
      <path d="M17.5 6h3M17.5 9.5h2" {...S} strokeWidth={1.7} />
    </>
  ),
  light: (
    <>
      <circle cx="12" cy="12" r="3.6" {...fillProps(0.45)} />
      <circle cx="12" cy="12" r="3.6" {...S} />
      <path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21" {...S} strokeWidth={1.9} />
      <path d="M5.8 5.8 7.5 7.5M16.5 16.5l1.7 1.7M18.2 5.8 16.5 7.5M7.5 16.5l-1.7 1.7" {...S} strokeWidth={1.6} />
    </>
  ),
  camera: (
    <>
      <path d="M3.5 8.8c0-1.1.9-2 2-2h2l1.3-2h6.4l1.3 2h2c1.1 0 2 .9 2 2v8.4c0 1.1-.9 2-2 2h-13c-1.1 0-2-.9-2-2V8.8Z" {...fillProps(0.22)} />
      <path d="M3.5 8.8c0-1.1.9-2 2-2h2l1.3-2h6.4l1.3 2h2c1.1 0 2 .9 2 2v8.4c0 1.1-.9 2-2 2h-13c-1.1 0-2-.9-2-2V8.8Z" {...S} />
      <circle cx="12" cy="13" r="3.4" fill={ACCENT} opacity={0.6} stroke="none" />
      <circle cx="12" cy="13" r="3.4" {...S} strokeWidth={1.8} />
    </>
  ),
  nutrient: (
    <>
      <path d="M9.5 3.5h5v5.8l3.2 7.4a2.6 2.6 0 0 1-2.4 3.8H8.7a2.6 2.6 0 0 1-2.4-3.8l3.2-7.4V3.5Z" {...fillProps(0.22)} />
      <path d="M9.5 3.5h5v5.8l3.2 7.4a2.6 2.6 0 0 1-2.4 3.8H8.7a2.6 2.6 0 0 1-2.4-3.8l3.2-7.4V3.5Z" {...S} />
      <path d="M7.3 15.2h9.4l1 2.4a2.6 2.6 0 0 1-2.4 3.8H8.7a2.6 2.6 0 0 1-2.4-3.8l1-2.4Z" fill={ACCENT} opacity={0.75} stroke="none" />
      <path d="M8.2 3.5h7.6" {...S} />
    </>
  ),
  pump: (
    <>
      <rect x="3.5" y="9.5" width="10" height="8" rx="2" {...fillProps(0.28)} />
      <rect x="3.5" y="9.5" width="10" height="8" rx="2" {...S} />
      <path d="M13.5 12.5h3.3a2 2 0 0 1 2 2v1.5" {...S} />
      <path d="M18.8 21c-1.4-1.6-2.1-2.7-2.1-3.6a2.1 2.1 0 0 1 4.2 0c0 .9-.7 2-2.1 3.6Z" {...fillProps(0.55)} />
      <path d="M18.8 21c-1.4-1.6-2.1-2.7-2.1-3.6a2.1 2.1 0 0 1 4.2 0c0 .9-.7 2-2.1 3.6Z" {...S} strokeWidth={1.7} />
      <path d="M6.6 9.5V7a2 2 0 0 1 2-2h1.8" {...S} />
      <path d="M6.3 13.5h4.4" {...S} strokeWidth={1.7} />
    </>
  ),
  bulb: (
    <>
      <path d="M12 3.2a6 6 0 0 1 3.6 10.8v1.8H8.4V14A6 6 0 0 1 12 3.2Z" {...fillProps(0.35)} />
      <path d="M12 3.2a6 6 0 0 1 3.6 10.8v1.8H8.4V14A6 6 0 0 1 12 3.2Z" {...S} />
      <path d="M9.2 18.2h5.6M10.2 21h3.6" {...S} />
      <path d="M12 7.2a3.6 3.6 0 0 0-2.4 3.4" {...S} strokeWidth={1.6} />
    </>
  ),
  fan: (
    <>
      <circle cx="12" cy="12" r="8.5" {...fillProps(0.16)} />
      <circle cx="12" cy="12" r="8.5" {...S} />
      <path d="M12 12c0-3.4 1-5.4 2.6-5.4 1.3 0 2 1 2 2.2 0 1.8-1.6 3.2-4.6 3.2Z" {...fillProps(0.5)} />
      <path d="M12 12c0-3.4 1-5.4 2.6-5.4 1.3 0 2 1 2 2.2 0 1.8-1.6 3.2-4.6 3.2Z" {...S} strokeWidth={1.6} />
      <path d="M12 12c2.9 1.7 3.9 3.6 3.1 5-.7 1.2-1.9 1.3-2.9.7-1.5-.9-1.8-3-.2-5.7Z" {...fillProps(0.5)} />
      <path d="M12 12c2.9 1.7 3.9 3.6 3.1 5-.7 1.2-1.9 1.3-2.9.7-1.5-.9-1.8-3-.2-5.7Z" {...S} strokeWidth={1.6} />
      <path d="M12 12c-2.9 1.7-5 1.8-5.8.4-.6-1.1 0-2.2 1-2.8 1.5-.9 3.5-.2 4.8 2.4Z" {...fillProps(0.5)} />
      <path d="M12 12c-2.9 1.7-5 1.8-5.8.4-.6-1.1 0-2.2 1-2.8 1.5-.9 3.5-.2 4.8 2.4Z" {...S} strokeWidth={1.6} />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),

  // ── Interface ──────────────────────────────────────────────────────────────
  clock: (
    <>
      <circle cx="12" cy="12" r="8.6" {...fillProps(0.22)} />
      <circle cx="12" cy="12" r="8.6" {...S} />
      <path d="M12 7.4V12l3.4 2.2" {...S} />
    </>
  ),
  gift: (
    <>
      <path d="M4 10h16v8.6a1.9 1.9 0 0 1-1.9 1.9H5.9A1.9 1.9 0 0 1 4 18.6V10Z" {...fillProps(0.28)} />
      <path d="M4 10h16v8.6a1.9 1.9 0 0 1-1.9 1.9H5.9A1.9 1.9 0 0 1 4 18.6V10Z" {...S} />
      <rect x="2.8" y="6.4" width="18.4" height="3.6" rx="1.5" {...S} />
      <path d="M12 6.4v14.1" {...S} />
      <path d="M12 6.4C10.6 3.2 9 2.4 7.6 3.1 6.3 3.8 6.4 5.6 8 6.4h4Z" {...fillProps(0.5)} />
      <path d="M12 6.4C10.6 3.2 9 2.4 7.6 3.1 6.3 3.8 6.4 5.6 8 6.4h4Z" {...S} strokeWidth={1.7} />
      <path d="M12 6.4c1.4-3.2 3-4 4.4-3.3 1.3.7 1.2 2.5-.4 3.3h-4Z" {...fillProps(0.5)} />
      <path d="M12 6.4c1.4-3.2 3-4 4.4-3.3 1.3.7 1.2 2.5-.4 3.3h-4Z" {...S} strokeWidth={1.7} />
    </>
  ),
  ticket: (
    <>
      <path d="M3.5 7.5A1.9 1.9 0 0 1 5.4 5.6h13.2a1.9 1.9 0 0 1 1.9 1.9v2.1a2.4 2.4 0 0 0 0 4.8v2.1a1.9 1.9 0 0 1-1.9 1.9H5.4a1.9 1.9 0 0 1-1.9-1.9v-2.1a2.4 2.4 0 0 0 0-4.8V7.5Z" {...fillProps(0.26)} />
      <path d="M3.5 7.5A1.9 1.9 0 0 1 5.4 5.6h13.2a1.9 1.9 0 0 1 1.9 1.9v2.1a2.4 2.4 0 0 0 0 4.8v2.1a1.9 1.9 0 0 1-1.9 1.9H5.4a1.9 1.9 0 0 1-1.9-1.9v-2.1a2.4 2.4 0 0 0 0-4.8V7.5Z" {...S} />
      <path d="M9.6 9.4h5.6M9.6 13.4h3.4" {...S} strokeWidth={1.7} />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="8.6" {...fillProps(0.3)} />
      <circle cx="12" cy="12" r="8.6" {...S} />
      <path d="M8 12.3 10.9 15 16 9.4" {...S} strokeWidth={2.2} />
    </>
  ),
  lock: (
    <>
      <rect x="4.8" y="10.4" width="14.4" height="9.8" rx="2.4" {...fillProps(0.24)} />
      <rect x="4.8" y="10.4" width="14.4" height="9.8" rx="2.4" {...S} />
      <path d="M8.2 10.4V7.9a3.8 3.8 0 0 1 7.6 0v2.5" {...S} />
      <circle cx="12" cy="15.2" r="1.6" fill={ACCENT} stroke="none" />
    </>
  ),
  battery: (
    <>
      <rect x="2.6" y="7.4" width="16.2" height="9.2" rx="2.4" {...fillProps(0.2)} />
      <rect x="2.6" y="7.4" width="16.2" height="9.2" rx="2.4" {...S} />
      <path d="M21.4 10.4v3.2" {...S} strokeWidth={2.4} />
      <rect x="5" y="9.8" width="7" height="4.4" rx="1.2" fill={ACCENT} stroke="none" />
    </>
  ),
  plus: (
    <>
      <circle cx="12" cy="12" r="8.6" {...fillProps(0.26)} />
      <circle cx="12" cy="12" r="8.6" {...S} />
      <path d="M12 8.2v7.6M8.2 12h7.6" {...S} strokeWidth={2.2} />
    </>
  ),
  trophy: (
    <>
      <path d="M7.4 3.8h9.2v5.4a4.6 4.6 0 0 1-9.2 0V3.8Z" {...fillProps(0.34)} />
      <path d="M7.4 3.8h9.2v5.4a4.6 4.6 0 0 1-9.2 0V3.8Z" {...S} />
      <path d="M7.4 5h-2a2 2 0 0 0 0 4h2M16.6 5h2a2 2 0 0 1 0 4h-2" {...S} strokeWidth={1.7} />
      <path d="M12 13.8v3.4M8.4 20.4h7.2" {...S} />
      <path d="M9.6 20.4c0-1.8 1-3.2 2.4-3.2s2.4 1.4 2.4 3.2" {...S} strokeWidth={1.7} />
    </>
  ),
  heart: (
    <>
      <path d="M12 20.3C7 17 3.6 14.1 3.6 10.3A4.4 4.4 0 0 1 12 8.1a4.4 4.4 0 0 1 8.4 2.2c0 3.8-3.4 6.7-8.4 10Z" {...fillProps(0.4)} />
      <path d="M12 20.3C7 17 3.6 14.1 3.6 10.3A4.4 4.4 0 0 1 12 8.1a4.4 4.4 0 0 1 8.4 2.2c0 3.8-3.4 6.7-8.4 10Z" {...S} />
    </>
  ),
  bolt: (
    <>
      <path d="M13.6 2.6 6 13.4h4.6l-.8 8 7.8-11.2h-4.8l.8-7.6Z" {...fillProps(0.38)} />
      <path d="M13.6 2.6 6 13.4h4.6l-.8 8 7.8-11.2h-4.8l.8-7.6Z" {...S} />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.6" {...fillProps(0.24)} />
      <circle cx="12" cy="12" r="8.6" {...S} />
      <path d="M12 11v5.2" {...S} strokeWidth={2.1} />
      <circle cx="12" cy="7.9" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  bell: (
    <>
      <path d="M12 3.4a5.6 5.6 0 0 1 5.6 5.6c0 4 1.4 5.4 1.4 6.6H5c0-1.2 1.4-2.6 1.4-6.6A5.6 5.6 0 0 1 12 3.4Z" {...fillProps(0.3)} />
      <path d="M12 3.4a5.6 5.6 0 0 1 5.6 5.6c0 4 1.4 5.4 1.4 6.6H5c0-1.2 1.4-2.6 1.4-6.6A5.6 5.6 0 0 1 12 3.4Z" {...S} />
      <path d="M9.6 18.2a2.5 2.5 0 0 0 4.8 0" {...S} />
    </>
  ),
  chat: (
    <>
      <path d="M3.6 6.4c0-1.3 1-2.4 2.4-2.4h12c1.4 0 2.4 1.1 2.4 2.4v7.4c0 1.3-1 2.4-2.4 2.4H9.4L4.6 20v-3.8h-1V6.4Z" {...fillProps(0.24)} />
      <path d="M3.6 6.4c0-1.3 1-2.4 2.4-2.4h12c1.4 0 2.4 1.1 2.4 2.4v7.4c0 1.3-1 2.4-2.4 2.4H9.4L4.6 20v-3.8h-1V6.4Z" {...S} />
      <circle cx="8.6" cy="10.2" r="1.2" fill={ACCENT} stroke="none" />
      <circle cx="12" cy="10.2" r="1.2" fill={ACCENT} stroke="none" />
      <circle cx="15.4" cy="10.2" r="1.2" fill={ACCENT} stroke="none" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 2.8c.9 4.6 1.8 5.5 6.4 6.4-4.6.9-5.5 1.8-6.4 6.4-.9-4.6-1.8-5.5-6.4-6.4 4.6-.9 5.5-1.8 6.4-6.4Z" {...fillProps(0.4)} />
      <path d="M12 2.8c.9 4.6 1.8 5.5 6.4 6.4-4.6.9-5.5 1.8-6.4 6.4-.9-4.6-1.8-5.5-6.4-6.4 4.6-.9 5.5-1.8 6.4-6.4Z" {...S} />
      <path d="M18 15.6c.4 2.2.8 2.6 3 3-2.2.4-2.6.8-3 3-.4-2.2-.8-2.6-3-3 2.2-.4 2.6-.8 3-3Z" {...fillProps(0.5)} />
      <path d="M18 15.6c.4 2.2.8 2.6 3 3-2.2.4-2.6.8-3 3-.4-2.2-.8-2.6-3-3 2.2-.4 2.6-.8 3-3Z" {...S} strokeWidth={1.6} />
    </>
  ),
  chart: (
    <>
      <path d="M3.6 3.6v15.2c0 .9.7 1.6 1.6 1.6h15.2" {...S} />
      <rect x="7" y="11" width="3.2" height="6" rx="1.2" fill={ACCENT} opacity={0.6} stroke="none" />
      <rect x="7" y="11" width="3.2" height="6" rx="1.2" {...S} strokeWidth={1.7} />
      <rect x="12.4" y="7" width="3.2" height="10" rx="1.2" fill={ACCENT} opacity={0.6} stroke="none" />
      <rect x="12.4" y="7" width="3.2" height="10" rx="1.2" {...S} strokeWidth={1.7} />
      <path d="M17.8 13.4h.1" {...S} />
    </>
  ),
  pot: (
    <>
      <path d="M5 10h14l-1.3 8.8a2 2 0 0 1-2 1.7H8.3a2 2 0 0 1-2-1.7L5 10Z" {...fillProps(0.3)} />
      <path d="M5 10h14l-1.3 8.8a2 2 0 0 1-2 1.7H8.3a2 2 0 0 1-2-1.7L5 10Z" {...S} />
      <path d="M3.6 7.4h16.8V10H3.6z" {...fillProps(0.5)} />
      <path d="M3.6 7.4h16.8V10H3.6z" {...S} />
      <path d="M12 7.4c0-2.4-1.6-4-4-4 0 2.4 1.6 4 4 4Z" {...S} strokeWidth={1.7} />
    </>
  ),
  moon: (
    <>
      <path d="M14.6 3.4A8.6 8.6 0 1 0 20.6 13 7 7 0 0 1 14.6 3.4Z" {...fillProps(0.3)} />
      <path d="M14.6 3.4A8.6 8.6 0 1 0 20.6 13 7 7 0 0 1 14.6 3.4Z" {...S} />
    </>
  ),
  'arrow-right': <path d="M4.4 12h15M13.4 6.2 19.4 12l-6 5.8" {...S} strokeWidth={2.2} />,
  pencil: (
    <>
      <path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z" {...fillProps(0.26)} />
      <path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z" {...S} />
      <path d="M14.4 5.6 18.4 9.6" {...S} strokeWidth={1.7} />
    </>
  ),
  cart: (
    <>
      <path d="M3.4 4.4h2.4l2.6 10.2h9.4" {...S} />
      <path d="M7.4 7.6h13l-1.8 7H9.2l-1.8-7Z" {...fillProps(0.28)} />
      <path d="M7.4 7.6h13l-1.8 7H9.2" {...S} />
      <circle cx="9.6" cy="19" r="1.8" {...S} />
      <circle cx="17.4" cy="19" r="1.8" {...S} />
    </>
  ),
  album: (
    <>
      <rect x="3.6" y="4.4" width="16.8" height="15.2" rx="2.4" {...fillProps(0.22)} />
      <rect x="3.6" y="4.4" width="16.8" height="15.2" rx="2.4" {...S} />
      <path d="M3.6 16 8.4 11l3.4 3.4 3-2.8 5.6 5" {...S} strokeWidth={1.8} />
      <circle cx="15" cy="8.8" r="1.6" fill={ACCENT} stroke="none" />
    </>
  ),
  // Throwing a conversation away is a real deletion, so it gets the bin
  // everyone already reads as that — chunky lid, no cleverness.
  trash: (
    <>
      <path d="M5.8 7.6h12.4l-1 11.6a2.1 2.1 0 0 1-2.1 1.9H8.9a2.1 2.1 0 0 1-2.1-1.9L5.8 7.6Z" {...fillProps(0.26)} />
      <path d="M5.8 7.6h12.4l-1 11.6a2.1 2.1 0 0 1-2.1 1.9H8.9a2.1 2.1 0 0 1-2.1-1.9L5.8 7.6Z" {...S} />
      <path d="M3.6 7.6h16.8" {...S} />
      <path d="M9.4 7.6V5.4a1.5 1.5 0 0 1 1.5-1.5h2.2a1.5 1.5 0 0 1 1.5 1.5v2.2" {...S} />
      <path d="M10.4 11.4v5.6M13.6 11.4v5.6" {...S} strokeWidth={1.7} />
    </>
  ),
  'arrow-down': (
    <>
      <circle cx="12" cy="12" r="8.6" {...fillProps(0.24)} />
      <path d="M12 7.6v8.6" {...S} />
      <path d="m8 12.4 4 4 4-4" {...S} />
    </>
  ),
  warning: (
    <>
      <path d="M12 3.4 21.4 19a1.6 1.6 0 0 1-1.4 2.4H4a1.6 1.6 0 0 1-1.4-2.4L12 3.4Z" {...fillProps(0.3)} />
      <path d="M12 3.4 21.4 19a1.6 1.6 0 0 1-1.4 2.4H4a1.6 1.6 0 0 1-1.4-2.4L12 3.4Z" {...S} />
      <path d="M12 9.6v4.8" {...S} strokeWidth={2.1} />
      <circle cx="12" cy="17.8" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
};

export function SproutyIcon({ name, size = 24, accent, className, title }: Props) {
  const node = PATHS[name] ?? PATHS.leaf;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      // Decorative by default: the icons sit next to their own text label
      // almost everywhere, and a duplicated label is noise in a screen reader.
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      style={accent ? ({ ['--icon-accent' as string]: accent } as React.CSSProperties) : undefined}
    >
      {title && <title>{title}</title>}
      {node}
    </svg>
  );
}
