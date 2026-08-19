import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { usePalette } from '../providers/theme-provider';
import type { Palette } from './tokens';

/**
 * Build a stylesheet from the ACTIVE palette.
 *
 * A module-level `StyleSheet.create({ ... colors.light.canvas ... })` bakes the
 * light palette into the bundle — which is exactly why dark mode was not wired
 * at all despite a working theme provider: 305 references read `colors.light`
 * directly and no amount of toggling could reach them.
 *
 * Usage:
 *
 *   const styles = useStyles((t) => ({
 *     card: { backgroundColor: t.surface, borderColor: t.border },
 *   }));
 *
 * The sheet is rebuilt only when the palette object identity changes — twice per
 * session at most, since `useTheme` memoises on `isDark`.
 */
export function useStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (palette: Palette) => T & StyleSheet.NamedStyles<T>,
): T {
  const palette = usePalette();
  // `factory` is intentionally not a dependency. Callers pass an inline arrow,
  // so a fresh identity every render would rebuild the sheet every render and
  // defeat the memo entirely. The closure only reads the palette.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => StyleSheet.create(factory(palette)), [palette]);
}

/** Elevation that reads on cream. Android gets `elevation`, iOS a warm shadow. */
export function elevation(palette: Palette, level: 'sm' | 'md' | 'lg' | 'island') {
  const spec = {
    sm: { height: 1, opacity: 0.05, radius: 3, elevation: 1 },
    md: { height: 4, opacity: 0.07, radius: 12, elevation: 3 },
    lg: { height: 10, opacity: 0.1, radius: 24, elevation: 8 },
    island: { height: 8, opacity: 0.18, radius: 24, elevation: 14 },
  }[level];

  return {
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: spec.height },
    shadowOpacity: spec.opacity,
    shadowRadius: spec.radius,
    elevation: spec.elevation,
  };
}
