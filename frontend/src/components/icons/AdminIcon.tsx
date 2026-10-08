/**
 * Icons for the staff area.
 *
 * Deliberately nothing like SproutyIcon. That set is drawn for a six-year-old:
 * thick crayon strokes, a colour fill behind every line. This one is drawn for
 * someone who looks at the same screen for six hours: one weight, no fill, no
 * colour of its own, sized to sit on a line of text without shouting.
 *
 * They replace the emoji the admin used to run on. An emoji is a different
 * typeface on every machine — a flat glyph on Windows, a glossy 3D blob on a
 * Mac — so a toolbar built from them has no consistent weight, no alignment,
 * and no way to match the text beside it. These are plain strokes on a 24×24
 * grid that inherit `currentColor`, so a row of them lines up and a disabled
 * button greys out properly.
 *
 * Geometry: 24×24, 1.7 stroke, round caps and joins, 2px safe margin. Add an
 * icon by drawing inside that and nothing else needs adjusting.
 */

export type AdminIconName =
  // navigation
  | 'dashboard' | 'orders' | 'sales' | 'redeem' | 'workshop' | 'blog'
  | 'images' | 'products' | 'users' | 'audit' | 'home' | 'logout' | 'menu'
  // actions
  | 'search' | 'close' | 'plus' | 'edit' | 'trash' | 'filter' | 'refresh'
  | 'download' | 'upload' | 'copy' | 'save' | 'settings' | 'more' | 'link'
  | 'eye' | 'external'
  // direction
  | 'chevron-left' | 'chevron-right' | 'chevron-down' | 'chevron-up'
  | 'arrow-right' | 'sort'
  // status and data
  | 'check' | 'alert' | 'info' | 'inbox' | 'clock' | 'calendar' | 'user'
  | 'mail' | 'phone' | 'lock' | 'tag' | 'chart' | 'trending' | 'card'
  | 'truck' | 'star' | 'seed' | 'shield' | 'ticket' | 'layers' | 'percent'
  | 'spark' | 'video' | 'pin' | 'seat';

interface Props {
  name: AdminIconName;
  /** Pixel size; the icon is square. 18 for inline, 20 for buttons. */
  size?: number;
  className?: string;
  /** Set when the icon is the only label, e.g. an icon-only button. */
  title?: string;
}

/** One weight for the whole set, so a toolbar reads as one object. */
const S = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** A dot, for the places a stroke would be too faint to see. */
function Dot({ x, y, r = 1.05 }: { x: number; y: number; r?: number }) {
  return <circle cx={x} cy={y} r={r} fill="currentColor" stroke="none" />;
}

const PATHS: Record<AdminIconName, React.ReactNode> = {
  // ── Navigation ───────────────────────────────────────────────────────────
  dashboard: (
    <>
      <rect x="3" y="3" width="7.6" height="7.6" rx="1.8" {...S} />
      <rect x="13.4" y="3" width="7.6" height="5" rx="1.8" {...S} />
      <rect x="3" y="13.4" width="7.6" height="7.6" rx="1.8" {...S} />
      <rect x="13.4" y="11.4" width="7.6" height="9.6" rx="1.8" {...S} />
    </>
  ),
  orders: (
    <>
      <path d="M3.2 7.4 12 3l8.8 4.4v9.2L12 21l-8.8-4.4V7.4Z" {...S} />
      <path d="M3.2 7.4 12 11.8l8.8-4.4M12 11.8V21" {...S} />
      <path d="M7.6 5.2 16.4 9.6" {...S} />
    </>
  ),
  sales: (
    <>
      <rect x="2.6" y="5.6" width="18.8" height="12.8" rx="2.6" {...S} />
      <circle cx="12" cy="12" r="2.9" {...S} />
      <path d="M6 9.4v5.2M18 9.4v5.2" {...S} />
    </>
  ),
  redeem: (
    <>
      <path d="M14.6 3.4a5 5 0 1 0-4.1 8.6L3.4 19.1v1.5h2.9v-2h2v-2h2l1.2-1.2a5 5 0 0 0 3.1-12Z" {...S} />
      <Dot x={15.9} y={8.1} />
    </>
  ),
  workshop: (
    <>
      <rect x="3" y="4.8" width="18" height="16.2" rx="2.6" {...S} />
      <path d="M3 9.6h18M8 3v3.6M16 3v3.6" {...S} />
      <path d="M7.6 13.4h4M7.6 17h8.8" {...S} />
    </>
  ),
  blog: (
    <>
      <path d="M5 3.4h8.6L19 8.8v11.8H5V3.4Z" {...S} />
      <path d="M13.4 3.4v5.4H19" {...S} />
      <path d="M8.4 13.2h7.2M8.4 16.8h4.8" {...S} />
    </>
  ),
  images: (
    <>
      <rect x="3" y="4.6" width="18" height="14.8" rx="2.6" {...S} />
      <path d="m3.4 16.4 4.8-4.6 3.6 3.4 3.2-2.8 5.6 5" {...S} />
      <circle cx="15.4" cy="9.2" r="1.5" {...S} />
    </>
  ),
  products: (
    <>
      <path d="M11 3.2 3.4 6.5v5.9c0 4.4 3.1 7.6 8.6 8.4 5.5-.8 8.6-4 8.6-8.4V6.5L13 3.2a2.2 2.2 0 0 0-2 0Z" {...S} />
      <path d="M9 11.8 11.4 14l4-4.4" {...S} />
    </>
  ),
  users: (
    <>
      <circle cx="9.4" cy="8.2" r="3.4" {...S} />
      <path d="M3.4 20.2c0-3.3 2.7-5.4 6-5.4s6 2.1 6 5.4" {...S} />
      <path d="M16.4 5.2a3.3 3.3 0 0 1 0 6.2M17.6 14.8c1.9.5 3.2 2.3 3.2 4.4" {...S} />
    </>
  ),
  audit: (
    <>
      <rect x="4.4" y="3.6" width="15.2" height="17" rx="2.4" {...S} />
      <path d="M9 3.6V2.4h6v1.2" {...S} />
      <path d="M8.6 9.4h6.8M8.6 13h6.8M8.6 16.6h4" {...S} />
    </>
  ),
  home: (
    <>
      <path d="M3.4 10.4 12 3.2l8.6 7.2v9.2a1.4 1.4 0 0 1-1.4 1.4H4.8a1.4 1.4 0 0 1-1.4-1.4v-9.2Z" {...S} />
      <path d="M9.4 21v-6.6h5.2V21" {...S} />
    </>
  ),
  logout: (
    <>
      <path d="M14.6 3.6H6.4a1.8 1.8 0 0 0-1.8 1.8v13.2a1.8 1.8 0 0 0 1.8 1.8h8.2" {...S} />
      <path d="M16.4 8.2 20.6 12l-4.2 3.8M20.6 12H9.8" {...S} />
    </>
  ),
  menu: <path d="M3.6 6.6h16.8M3.6 12h16.8M3.6 17.4h16.8" {...S} />,

  // ── Actions ──────────────────────────────────────────────────────────────
  search: (
    <>
      <circle cx="10.6" cy="10.6" r="6.6" {...S} />
      <path d="m15.4 15.4 4.8 4.8" {...S} />
    </>
  ),
  close: <path d="m6.4 6.4 11.2 11.2M17.6 6.4 6.4 17.6" {...S} />,
  plus: <path d="M12 4.8v14.4M4.8 12h14.4" {...S} />,
  edit: (
    <>
      <path d="M4 20h4.2L19.4 8.8a2.4 2.4 0 1 0-3.4-3.4L4.8 16.6 4 20Z" {...S} />
      <path d="m15.2 6.4 3.4 3.4" {...S} />
    </>
  ),
  trash: (
    <>
      <path d="M4 6.6h16" {...S} />
      <path d="M9.4 6.6V4.8a1.4 1.4 0 0 1 1.4-1.4h2.4a1.4 1.4 0 0 1 1.4 1.4v1.8" {...S} />
      <path d="M6.2 6.6 7.1 19a1.8 1.8 0 0 0 1.8 1.6h6.2a1.8 1.8 0 0 0 1.8-1.6l.9-12.4" {...S} />
      <path d="M10.4 10.6v6M13.6 10.6v6" {...S} />
    </>
  ),
  filter: <path d="M3.4 5.4h17.2l-6.6 7.6v6.4l-4-2.2v-4.2L3.4 5.4Z" {...S} />,
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" {...S} />
      <path d="M20.4 3.6v5h-5" {...S} />
    </>
  ),
  download: (
    <>
      <path d="M12 3.6v11.2M7.8 10.8 12 15l4.2-4.2" {...S} />
      <path d="M4.4 17.2v2a1.4 1.4 0 0 0 1.4 1.4h12.4a1.4 1.4 0 0 0 1.4-1.4v-2" {...S} />
    </>
  ),
  upload: (
    <>
      <path d="M12 15.4V4.2M7.8 8.4 12 4.2l4.2 4.2" {...S} />
      <path d="M4.4 17.2v2a1.4 1.4 0 0 0 1.4 1.4h12.4a1.4 1.4 0 0 0 1.4-1.4v-2" {...S} />
    </>
  ),
  copy: (
    <>
      <rect x="8.4" y="8.4" width="12" height="12" rx="2.2" {...S} />
      <path d="M15.6 5.6V5a1.4 1.4 0 0 0-1.4-1.4H5a1.4 1.4 0 0 0-1.4 1.4v9.2A1.4 1.4 0 0 0 5 15.6h.6" {...S} />
    </>
  ),
  save: (
    <>
      <path d="M4.6 5.4a1.8 1.8 0 0 1 1.8-1.8h9.2L20.4 8v10.6a1.8 1.8 0 0 1-1.8 1.8H6.4a1.8 1.8 0 0 1-1.8-1.8V5.4Z" {...S} />
      <path d="M8.4 3.6v5h6.2v-5M8 20.4v-6h8v6" {...S} />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="2.9" {...S} />
      <path d="M19.1 14.6a1.5 1.5 0 0 0 .3 1.7l.1.1a1.8 1.8 0 1 1-2.6 2.6l-.1-.1a1.5 1.5 0 0 0-2.5 1v.3a1.8 1.8 0 1 1-3.6 0v-.2a1.5 1.5 0 0 0-2.6-1l-.1.1a1.8 1.8 0 1 1-2.6-2.6l.1-.1a1.5 1.5 0 0 0-1-2.5h-.3a1.8 1.8 0 0 1 0-3.6h.2a1.5 1.5 0 0 0 1-2.6l-.1-.1a1.8 1.8 0 1 1 2.6-2.6l.1.1a1.5 1.5 0 0 0 2.5-1v-.3a1.8 1.8 0 1 1 3.6 0v.2a1.5 1.5 0 0 0 2.6 1l.1-.1a1.8 1.8 0 1 1 2.6 2.6l-.1.1a1.5 1.5 0 0 0 1 2.5h.3a1.8 1.8 0 0 1 0 3.6h-.2a1.5 1.5 0 0 0-1.4.9Z" {...S} />
    </>
  ),
  more: (
    <>
      <Dot x={5.4} y={12} r={1.3} />
      <Dot x={12} y={12} r={1.3} />
      <Dot x={18.6} y={12} r={1.3} />
    </>
  ),
  link: (
    <>
      <path d="M10 13.6a3.8 3.8 0 0 0 5.7.4l2.4-2.4a3.8 3.8 0 0 0-5.4-5.4l-1.4 1.4" {...S} />
      <path d="M14 10.4a3.8 3.8 0 0 0-5.7-.4l-2.4 2.4a3.8 3.8 0 0 0 5.4 5.4l1.4-1.4" {...S} />
    </>
  ),
  eye: (
    <>
      <path d="M2.4 12S5.8 5.8 12 5.8 21.6 12 21.6 12 18.2 18.2 12 18.2 2.4 12 2.4 12Z" {...S} />
      <circle cx="12" cy="12" r="2.8" {...S} />
    </>
  ),
  external: (
    <>
      <path d="M13.6 4.4h6v6" {...S} />
      <path d="M19.6 4.4 11 13" {...S} />
      <path d="M18 14v4.8a1.8 1.8 0 0 1-1.8 1.8H5.6a1.8 1.8 0 0 1-1.8-1.8V8.2a1.8 1.8 0 0 1 1.8-1.8H10" {...S} />
    </>
  ),

  // ── Direction ────────────────────────────────────────────────────────────
  'chevron-left': <path d="M14.6 5.4 8 12l6.6 6.6" {...S} />,
  'chevron-right': <path d="M9.4 5.4 16 12l-6.6 6.6" {...S} />,
  'chevron-down': <path d="M5.4 9.4 12 16l6.6-6.6" {...S} />,
  'chevron-up': <path d="M5.4 14.6 12 8l6.6 6.6" {...S} />,
  'arrow-right': <path d="M4.4 12h15.2M13.8 6.2 19.6 12l-5.8 5.8" {...S} />,
  sort: <path d="M8 4.6v14.8M4.6 16 8 19.4 11.4 16M16 19.4V4.6M12.6 8 16 4.6 19.4 8" {...S} />,

  // ── Status and data ──────────────────────────────────────────────────────
  check: <path d="m4.8 12.6 4.8 4.8L19.2 7.8" {...S} />,
  alert: (
    <>
      <path d="M12 3.6 21.4 19a1.6 1.6 0 0 1-1.4 2.4H4a1.6 1.6 0 0 1-1.4-2.4L12 3.6Z" {...S} />
      <path d="M12 9.6v4.6" {...S} />
      <Dot x={12} y={17.6} />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.8" {...S} />
      <path d="M12 11.2v5.2" {...S} />
      <Dot x={12} y={7.8} />
    </>
  ),
  inbox: (
    <>
      <path d="M3.4 13.4h4.4l1.6 2.6h5.2l1.6-2.6h4.4" {...S} />
      <path d="M6 4.6h12l2.6 8.8v4.6a1.8 1.8 0 0 1-1.8 1.8H5.2a1.8 1.8 0 0 1-1.8-1.8v-4.6L6 4.6Z" {...S} />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.8" {...S} />
      <path d="M12 6.8V12l3.4 2" {...S} />
    </>
  ),
  calendar: (
    <>
      <rect x="3.4" y="5" width="17.2" height="15.6" rx="2.4" {...S} />
      <path d="M3.4 9.8h17.2M8.2 3.4v3.2M15.8 3.4v3.2" {...S} />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.2" r="3.6" {...S} />
      <path d="M5 20.4c0-3.5 3.1-5.8 7-5.8s7 2.3 7 5.8" {...S} />
    </>
  ),
  mail: (
    <>
      <rect x="2.8" y="5" width="18.4" height="14" rx="2.4" {...S} />
      <path d="m3.4 7 8.6 6 8.6-6" {...S} />
    </>
  ),
  phone: (
    <path
      d="M20.4 16.9v2.6a1.7 1.7 0 0 1-1.9 1.7 17 17 0 0 1-7.4-2.6 16.7 16.7 0 0 1-5.2-5.2A17 17 0 0 1 3.3 6a1.7 1.7 0 0 1 1.7-1.9h2.6a1.7 1.7 0 0 1 1.7 1.5c.1.8.3 1.7.6 2.5a1.7 1.7 0 0 1-.4 1.8l-1.1 1.1a13.7 13.7 0 0 0 5.2 5.2l1.1-1.1a1.7 1.7 0 0 1 1.8-.4c.8.3 1.6.5 2.5.6a1.7 1.7 0 0 1 1.4 1.6Z"
      {...S}
    />
  ),
  lock: (
    <>
      <rect x="4.6" y="10.4" width="14.8" height="10.2" rx="2.2" {...S} />
      <path d="M8.2 10.4V7.8a3.8 3.8 0 0 1 7.6 0v2.6" {...S} />
    </>
  ),
  tag: (
    <>
      <path d="M11.2 3.4H4.8a1.4 1.4 0 0 0-1.4 1.4v6.4a1.4 1.4 0 0 0 .4 1l8 8a1.4 1.4 0 0 0 2 0l6.4-6.4a1.4 1.4 0 0 0 0-2l-8-8a1.4 1.4 0 0 0-1-.4Z" {...S} />
      <Dot x={7.6} y={7.6} r={1.25} />
    </>
  ),
  chart: (
    <>
      <path d="M3.6 20.4h16.8" {...S} />
      <path d="M6.8 20.4v-6.6M11.6 20.4V6.4M16.4 20.4v-9.8" {...S} />
    </>
  ),
  trending: (
    <>
      <path d="M3.6 16.4 9 11l3.6 3.6 7.8-7.8" {...S} />
      <path d="M15.2 6.8h5.2V12" {...S} />
    </>
  ),
  card: (
    <>
      <rect x="2.8" y="5" width="18.4" height="14" rx="2.4" {...S} />
      <path d="M2.8 9.6h18.4" {...S} />
      <path d="M6.4 14.8h3.2" {...S} />
    </>
  ),
  truck: (
    <>
      <path d="M2.8 6.4h10.4v10.2H2.8z" {...S} />
      <path d="M13.2 10h3.6l2.8 3v3.6h-6.4" {...S} />
      <circle cx="7" cy="18.4" r="1.9" {...S} />
      <circle cx="16.6" cy="18.4" r="1.9" {...S} />
    </>
  ),
  star: (
    <path d="m12 3.6 2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6L3.3 10l6-.9L12 3.6Z" {...S} />
  ),
  seed: (
    <>
      <path d="M12 20.4v-7.2" {...S} />
      <path d="M12 13.2c0-3.4-2.2-5.6-5.6-5.6 0 3.4 2.2 5.6 5.6 5.6Z" {...S} />
      <path d="M12 12c0-3.6 2.3-5.9 5.9-5.9 0 3.6-2.3 5.9-5.9 5.9Z" {...S} />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.2 4.6 6.2v5.4c0 4.2 3 7.6 7.4 9.2 4.4-1.6 7.4-5 7.4-9.2V6.2L12 3.2Z" {...S} />
      <path d="m9.2 11.8 2.2 2.2 3.6-4" {...S} />
    </>
  ),
  ticket: (
    <>
      <path d="M3.4 8.4V6.2a1.4 1.4 0 0 1 1.4-1.4h14.4a1.4 1.4 0 0 1 1.4 1.4v2.2a2.6 2.6 0 0 0 0 5.2v2.2a1.4 1.4 0 0 1-1.4 1.4H4.8a1.4 1.4 0 0 1-1.4-1.4v-2.2a2.6 2.6 0 0 0 0-5.2Z" {...S} />
      <path d="M14 4.8v12.6" {...S} strokeDasharray="2.4 2.2" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3.2 8.6 4.4L12 12 3.4 7.6 12 3.2Z" {...S} />
      <path d="m3.4 12 8.6 4.4L20.6 12M3.4 16.4 12 20.8l8.6-4.4" {...S} />
    </>
  ),
  spark: (
    <>
      <path d="M12 3.4 13.9 9l5.6 1.9-5.6 1.9L12 18.4l-1.9-5.6L4.5 10.9 10.1 9 12 3.4Z" {...S} />
      <path d="M18.4 16.6l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" {...S} />
    </>
  ),
  video: (
    <>
      <rect x="2.8" y="5.6" width="12.8" height="12.8" rx="2.4" {...S} />
      <path d="m15.6 10.4 5.6-3.2v9.6l-5.6-3.2v-3.2Z" {...S} />
    </>
  ),
  pin: (
    <>
      <path d="M12 21.2s7-5.4 7-10.6a7 7 0 1 0-14 0c0 5.2 7 10.6 7 10.6Z" {...S} />
      <circle cx="12" cy="10.4" r="2.7" {...S} />
    </>
  ),
  seat: (
    <>
      <path d="M6.6 4.6h10.8v7.6H6.6z" {...S} />
      <path d="M4.4 12.2h15.2v4.2H4.4z" {...S} />
      <path d="M6.6 16.4v3M17.4 16.4v3" {...S} />
    </>
  ),
  percent: (
    <>
      <path d="M18.6 5.4 5.4 18.6" {...S} />
      <circle cx="7.6" cy="7.6" r="2.6" {...S} />
      <circle cx="16.4" cy="16.4" r="2.6" {...S} />
    </>
  ),
};

export function AdminIcon({ name, size = 20, className, title }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      // Keeps the weight even when the icon is scaled up or down.
      vectorEffect="non-scaling-stroke"
    >
      {title && <title>{title}</title>}
      {PATHS[name]}
    </svg>
  );
}
