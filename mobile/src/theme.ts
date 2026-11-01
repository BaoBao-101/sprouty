/**
 * Sprouty's colours and type, as the website defines them
 * (frontend/src/styles/style.css): muted botanical greens, cream, earth
 * tones, one orange for prices. The app sits its white cards on a warm linen
 * canvas, lifted by a soft shadow instead of outlined, so screens read as
 * calm surfaces rather than boxes (AGENTS.md: restrained, no gloss).
 */
export const colors = {
  cream: '#FFFDF8',
  /** The screen behind the cards. */
  canvas: '#F5F2EA',
  cream2: '#F8FCF5',
  card: '#FFFFFF',
  line: '#E8E3D6',
  /** Recessed surfaces: an idle chip, a segmented control's track, a meter's track. */
  sand: '#EDE8DC',
  ink: '#203424',
  ink2: '#34513A',
  ink3: '#5E7662',
  ink4: '#8CA591',
  ink5: '#B9CDBD',
  green: '#2E8447',
  greenDark: '#236B3A',
  /** The deep green of a hero panel, white type on it. */
  forest: '#1F4D32',
  greenSoft: '#ECF9E8',
  mint: '#DFF1D7',
  greenLight: '#7BC96F',
  earth: '#8A6A4F',
  earthSoft: '#F6EFE6',
  price: '#F48A00',
  orange: '#FF9F1C',
  warn: '#B45309',
  warnSoft: '#FFF4E0',
  bad: '#BE3A4A',
  badSoft: '#FDEEF0',
  info: '#2B6CB0',
  infoSoft: '#EAF3FB',
  sky: '#5BA3D9',
  gold: '#9A5F0E',
  goldSoft: '#FFF4DF',
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

export const radius = { sm: 12, md: 16, lg: 22, xl: 28, pill: 999 } as const;

/**
 * Two soft lifts, tinted with the ink so they read as shade, not as a grey
 * outline. `sm` for anything resting on the canvas, `md` for what floats over
 * the page (the Buddy bubble, a primary button).
 */
export const shadow = {
  sm: { shadowColor: '#2B3A2E', shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  md: { shadowColor: '#2B3A2E', shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
} as const;

/** A white card on the canvas. */
export const surface = { backgroundColor: colors.card, borderRadius: radius.lg, ...shadow.sm } as const;

/** The side margin of every screen; wider on a tablet. */
export const gutter = 16;

/** Content never stretches wider than this, so an iPad reads like a book, not a billboard. */
export const maxWidth = 760;
