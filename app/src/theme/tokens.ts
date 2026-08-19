/**
 * Bachat Book theme tokens (mobile).
 *
 * Source of truth is `web/src/app/globals.css`; this mirrors it and must stay in
 * step. Mobile widens the radii band (20–28) because a phone card fills the
 * screen width and a 14px corner reads as square at that size.
 *
 * NOTHING may import `colors.light` directly. Read the palette from
 * `useTheme()` — 305 hardcoded `colors.light.*` references are the reason dark
 * mode was not wired at all.
 */

/**
 * A tone is `categories.tone`, an integer 1–6, and it drives the tinted cards
 * and glyph plates. Each has three roles:
 *
 *   `ink`   the saturated colour — the glyph, the figure
 *   `fill`  the card background — a wash, never a surface the eye has to read text off
 *   `edge`  a hairline that keeps the card from dissolving into the canvas
 *
 * The references get their premium feel from exactly this: large soft-filled
 * cards carrying one saturated mark, not from white cards with coloured text.
 */
export type ToneRole = { ink: string; fill: string; edge: string };

const LIGHT_TONES: Record<number, ToneRole> = {
  1: { ink: '#A8843F', fill: '#F7EFDD', edge: '#EADFC4' }, // brass — money, salary
  2: { ink: '#1B3563', fill: '#E5EAF4', edge: '#CFD8E9' }, // navy — bills, formal
  3: { ink: '#2F7A6F', fill: '#E2F0ED', edge: '#C8E1DC' }, // teal — health, savings
  4: { ink: '#7C4A6B', fill: '#F3E7EF', edge: '#E4D2DE' }, // plum — family, gifts
  5: { ink: '#5F7440', fill: '#EAF0DF', edge: '#D8E2C7' }, // olive — food, grocery
  6: { ink: '#A85F3A', fill: '#F7E9E0', edge: '#EBD5C7' }, // clay — transport, fuel
};

/**
 * Dark tones invert the relationship: the fill becomes a low-luminance wash that
 * sits ABOVE the canvas, and the ink lifts to stay legible on it. Reusing the
 * light fills here produces six pale rectangles glowing off a near-black screen.
 */
const DARK_TONES: Record<number, ToneRole> = {
  1: { ink: '#E5C17B', fill: '#2A2214', edge: '#3D3220' },
  2: { ink: '#8FB0E8', fill: '#141F33', edge: '#22304C' },
  3: { ink: '#6FC9B8', fill: '#0F2622', edge: '#1B3A34' },
  4: { ink: '#D79BC1', fill: '#271A23', edge: '#3B2A35' },
  5: { ink: '#AFC784', fill: '#1D2414', edge: '#2E3822' },
  6: { ink: '#E0A47C', fill: '#2A1C14', edge: '#3D2C21' },
};

export const colors = {
  light: {
    // surfaces
    canvas: '#F8F6F1',
    surface: '#FFFFFF',
    surfaceSubtle: '#F1EDE4',
    surface3: '#E8E2D6',
    border: '#E6E0D4',
    borderStrong: '#D8D0BE',

    // dark mass
    navy900: '#0B1A33',
    navy800: '#12264A',
    navy700: '#1B3563',
    onNavy: '#EAE6DC',
    onNavyMuted: '#97A3B8',

    // brass accent
    brass: '#C6A15B',
    brassSoft: '#F2E9D6',
    brassStrong: '#A8843F',

    // text
    foreground: '#0D1420',
    foreground2: '#3A4150',
    muted: '#6E6A62',
    faint: '#9A958A',

    // semantic — deltas are TEXT colours, never surfaces
    gain: '#0F8B5F',
    gainSoft: '#E2F2EA',
    loss: '#B4342A',
    lossSoft: '#F8E6E4',
    warn: '#B8791F',
    warnSoft: '#FBF0DC',

    // charts (tone ink, 1–6)
    chart1: '#A8843F',
    chart2: '#1B3563',
    chart3: '#2F7A6F',
    chart4: '#7C4A6B',
    chart5: '#5F7440',
    chart6: '#A85F3A',

    tones: LIGHT_TONES,
    /** Scrim behind a sheet. */
    scrim: 'rgba(11, 26, 51, 0.42)',
    /** Shadow colour — warm, so cards sit on cream rather than float over grey. */
    shadow: '#2A2416',
  },
  dark: {
    // Dark inverts the band relationship: the navy mass must be LIGHTER than the
    // canvas. `#060c17` on a `#080f1c` canvas vanished on web and would here.
    canvas: '#060E1C',
    surface: '#0E1A2E',
    surfaceSubtle: '#152444',
    surface3: '#1D3057',
    border: '#1E3354',
    borderStrong: '#2A456C',

    navy900: '#152444',
    navy800: '#1D3057',
    navy700: '#2A4A80',
    onNavy: '#F8F6F1',
    onNavyMuted: '#A0AEC0',

    brass: '#D4B06A',
    brassSoft: '#2B2418',
    brassStrong: '#E5C17B',

    foreground: '#F5F2EA',
    foreground2: '#D6DCE6',
    muted: '#94A3B8',
    faint: '#64748B',

    gain: '#34D399',
    gainSoft: '#06301C',
    loss: '#F87171',
    lossSoft: '#361211',
    warn: '#FBBF24',
    warnSoft: '#332204',

    chart1: '#E5C17B',
    chart2: '#8FB0E8',
    chart3: '#6FC9B8',
    chart4: '#D79BC1',
    chart5: '#AFC784',
    chart6: '#E0A47C',

    tones: DARK_TONES,
    scrim: 'rgba(3, 7, 15, 0.66)',
    shadow: '#000000',
  },
};

export type Palette = typeof colors.light;

/** Clamp an arbitrary `categories.tone` onto the 1–6 palette. */
export function toneOf(palette: Palette, tone: number | null | undefined): ToneRole {
  const n = tone && tone >= 1 && tone <= 6 ? Math.round(tone) : 1;
  return palette.tones[n];
}

/** 4 · 8 · 12 · 16 · 20 · 24 · 32 — nothing between. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radii = {
  xs: 6,
  sm: 10,
  control: 14,
  md: 16,
  lg: 20,
  card: 24,
  panel: 26,
  modal: 28,
  full: 9999,
};

export const typography = {
  fontSize: {
    xs: 11,
    sm: 13,
    base: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    display: 34,
    hero: 44,
  },
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
  },
};

/** Screen padding 16, card padding 20 — SPEC density, one step tighter on phone. */
export const layout = {
  screenPadding: spacing.lg,
  cardPadding: spacing.xl,
  gap: spacing.md,
  /** Height the floating nav island reserves at the bottom of every scroller. */
  navIslandClearance: 96,
};
