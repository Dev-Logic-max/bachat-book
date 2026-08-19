import React from 'react';
import { Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { usePalette } from '../../providers/theme-provider';
import { moneyParts } from '../../lib/format';
import { typography } from '../../theme/tokens';

/**
 * The native equivalent of web's `.tnum`, and it is load-bearing.
 *
 * Without `writingDirection: 'ltr'` the bidi algorithm moves a leading sign to
 * the trailing edge under Urdu, so `-Rs 899` renders as `Rs 899-` and `+28.3%`
 * as `28.3%+`. `tabular-nums` keeps a column of figures from jittering as digits
 * change width.
 *
 * Never wrap prose in this — the words get forced LTR too.
 */
export const NUMERIC: TextStyle = {
  fontVariant: ['tabular-nums'],
  writingDirection: 'ltr',
};

type MoneyProps = {
  paisa: number | bigint;
  /** `hero` de-emphasises the symbol and unit, the way the references do. */
  variant?: 'hero' | 'title' | 'body' | 'caption';
  /** Colour by sign: gains green, losses red. Off for neutral positions. */
  signed?: boolean;
  compact?: boolean;
  decimals?: boolean;
  /** Force an explicit `+` on positives. */
  showPlus?: boolean;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

const SIZES = {
  hero: { figure: typography.fontSize.hero, affix: 18, weight: '800' as const },
  title: { figure: typography.fontSize.xxl, affix: 13, weight: '700' as const },
  body: { figure: typography.fontSize.base, affix: 11, weight: '600' as const },
  caption: { figure: typography.fontSize.sm, affix: 10, weight: '600' as const },
};

/**
 * A money figure split into parts so the symbol and unit can be de-emphasised —
 * SPEC puts units at roughly 40% of the figure's size and in a muted colour. The
 * Overview hero cannot be built correctly without that split.
 */
export function Money({
  paisa,
  variant = 'body',
  signed = false,
  compact = false,
  decimals = false,
  showPlus = false,
  color,
  style,
}: MoneyProps) {
  const palette = usePalette();
  const size = SIZES[variant];
  const value = Number(paisa);
  const parts = moneyParts(paisa, { compact, decimals });

  const resolved =
    color ?? (signed ? (value > 0 ? palette.gain : value < 0 ? palette.loss : palette.foreground) : palette.foreground);

  const affixColor = color ?? (signed ? resolved : palette.muted);
  const sign = parts.sign || (showPlus && value > 0 ? '+' : '');

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'baseline' }, style]}>
      <Text
        style={[
          NUMERIC,
          { fontSize: size.affix, fontWeight: '600', color: affixColor, marginRight: 3 },
        ]}
      >
        {sign}
        {parts.symbol}
      </Text>
      <Text style={[NUMERIC, { fontSize: size.figure, fontWeight: size.weight, color: resolved }]}>
        {parts.whole}
        {parts.fraction ? (
          <Text style={{ fontSize: size.figure * 0.62, color: affixColor }}>.{parts.fraction}</Text>
        ) : null}
      </Text>
      {parts.suffix ? (
        <Text
          style={[
            NUMERIC,
            { fontSize: size.affix, fontWeight: '600', color: affixColor, marginLeft: 4 },
          ]}
        >
          {parts.suffix}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Any non-money run that must stay left-to-right inside Urdu copy — dates, FX
 * quotes, account numbers, percentages.
 */
export function Numeric({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[NUMERIC, style]}>{children}</Text>;
}
