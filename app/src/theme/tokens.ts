/**
 * Bachat Book Theme Tokens (Mobile)
 *
 * Source: web/src/app/globals.css & design-brain/SPEC.md
 * Mobile radii: 20-28px band (SPEC §4)
 */

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

    // semantic
    gain: '#0F8B5F',
    gainSoft: '#E2F2EA',
    loss: '#B4342A',
    lossSoft: '#F8E6E4',
    warn: '#B8791F',
    warnSoft: '#FBF0DC',

    // charts
    chart1: '#C6A15B',
    chart2: '#1B3563',
    chart3: '#2F7A6F',
    chart4: '#7C4A6B',
    chart5: '#7B8F5E',
    chart6: '#B0704A',
  },
  dark: {
    // Dark mode inverts band relationship: navy mass is lighter than dark canvas
    canvas: '#060E1C',
    surface: '#0B1A33',
    surfaceSubtle: '#12264A',
    surface3: '#1B3563',
    border: '#1E3354',
    borderStrong: '#2A456C',

    // dark mass (lighter relative to canvas in dark mode)
    navy900: '#12264A',
    navy800: '#1B3563',
    navy700: '#2A4A80',
    onNavy: '#F8F6F1',
    onNavyMuted: '#A0AEC0',

    // brass accent
    brass: '#D4B06A',
    brassSoft: '#2B2418',
    brassStrong: '#E5C17B',

    // text
    foreground: '#F8F6F1',
    foreground2: '#E2E8F0',
    muted: '#94A3B8',
    faint: '#64748B',

    // semantic
    gain: '#22C55E',
    gainSoft: '#06381D',
    loss: '#EF4444',
    lossSoft: '#3E1010',
    warn: '#F59E0B',
    warnSoft: '#3B2406',

    // charts
    chart1: '#D4B06A',
    chart2: '#3B82F6',
    chart3: '#10B981',
    chart4: '#EC4899',
    chart5: '#84CC16',
    chart6: '#F97316',
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// Radii: 20-28px band for mobile cards/modals (SPEC §4)
export const radii = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  card: 24,
  modal: 28,
  full: 9999,
};

export const typography = {
  fontFamily: {
    display: 'System',  // Fraunces when loaded
    sans: 'System',     // Inter when loaded
    mono: 'System',     // JetBrains Mono when loaded
    urdu: 'System',     // Noto Nastaliq Urdu when loaded
  },
  fontSize: {
    xs: 11,
    sm: 13,
    base: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    display: 32,
  },
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};
