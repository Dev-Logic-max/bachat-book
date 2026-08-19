/**
 * Kept as a thin adapter so screens written against the old `variant` API keep
 * compiling. New code should reach for `Surfaces` directly — `Card`, `ToneCard`
 * and `NavyPanel` there take the palette from the theme rather than a variant
 * string, which is what makes them work in dark mode.
 */
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Card as SurfaceCard, NavyPanel } from './Surfaces';

export { ToneCard, NavyPanel, SectionHeader, Chip, ChipRow, Segmented, StatTile } from './Surfaces';

export function Card({
  variant = 'surface',
  style,
  children,
}: {
  variant?: 'surface' | 'navy' | 'subtle' | 'outline';
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  if (variant === 'navy') {
    return <NavyPanel style={style}>{children}</NavyPanel>;
  }

  return (
    <SurfaceCard tier={variant === 'subtle' ? 'nested' : 'surface'} style={style}>
      {children}
    </SurfaceCard>
  );
}
