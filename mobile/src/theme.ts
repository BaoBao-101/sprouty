/**
 * Sprouty's colours and type, as the website defines them
 * (frontend/src/styles/style.css): muted botanical greens, cream, earth
 * tones, one orange for prices. Flat cards with a hairline border; almost no
 * shadow (AGENTS.md).
 */
export const colors = {
  cream: '#FFFDF8',
  cream2: '#F8FCF5',
  card: '#FFFFFF',
  line: '#E4EADB',
  ink: '#203424',
  ink2: '#34513A',
  ink3: '#5E7662',
  ink4: '#8CA591',
  ink5: '#B9CDBD',
  green: '#2E8447',
  greenDark: '#236B3A',
  greenSoft: '#ECF9E8',
  greenLight: '#7BC96F',
  earth: '#8A6A4F',
  earthSoft: '#F6EFE6',
  price: '#F48A00',
  orange: '#FF9F1C',
  warn: '#B45309',
  warnSoft: '#FFF7E6',
  bad: '#BE3A4A',
  badSoft: '#FDEEF0',
  info: '#2B6CB0',
  infoSoft: '#EAF3FB',
  white: '#FFFFFF',
} as const;

/** Loaded in app/_layout.tsx. Baloo for headings, Be Vietnam Pro (drawn for Vietnamese) for the rest. */
export const fonts = {
  display: 'Baloo2_700Bold',
  displaySemi: 'Baloo2_600SemiBold',
  body: 'BeVietnamPro_400Regular',
  medium: 'BeVietnamPro_500Medium',
  semi: 'BeVietnamPro_600SemiBold',
  bold: 'BeVietnamPro_700Bold',
} as const;

export const radius = { sm: 12, md: 16, lg: 20, xl: 24, pill: 999 } as const;

/** The side margin of every screen; wider on a tablet. */
export const gutter = 16;

/** Content never stretches wider than this, so an iPad reads like a book, not a billboard. */
export const maxWidth = 760;
