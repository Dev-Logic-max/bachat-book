import React from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { usePalette } from '../../providers/theme-provider';
import { elevation } from '../../theme/use-styles';
import { layout, radii, spacing, toneOf, typography } from '../../theme/tokens';
import { T } from '../T';

/**
 * A plain card on the canvas.
 *
 * `nested` steps down to `surfaceSubtle` for a card inside a card, and `sunken`
 * to `surface3` for the deepest tier. Three tiers is the whole ladder — a fourth
 * is indistinguishable on a phone screen.
 */
export function Card({
  children,
  tier = 'surface',
  padded = true,
  style,
}: {
  children: React.ReactNode;
  tier?: 'surface' | 'nested' | 'sunken';
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = usePalette();
  const background = {
    surface: palette.surface,
    nested: palette.surfaceSubtle,
    sunken: palette.surface3,
  }[tier];

  return (
    <View
      style={[
        {
          backgroundColor: background,
          borderRadius: radii.card,
          borderWidth: 1,
          borderColor: palette.border,
          padding: padded ? layout.cardPadding : 0,
          overflow: 'hidden',
        },
        tier === 'surface' ? elevation(palette, 'sm') : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * A card washed in a category tone — the shape the whole reference set leans on.
 *
 * The fill is a wash, not a surface: body text still reads in `foreground`, and
 * only the mark and the figure take the tone's ink. Filling a card with a
 * saturated colour and putting white text on it is the thing that reads cheap.
 */
export function ToneCard({
  tone,
  children,
  onPress,
  style,
  padded = true,
}: {
  tone: number | null | undefined;
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const palette = usePalette();
  const role = toneOf(palette, tone);

  const body = (
    <View
      style={[
        {
          backgroundColor: role.fill,
          borderRadius: radii.card,
          borderWidth: 1,
          borderColor: role.edge,
          padding: padded ? layout.cardPadding : 0,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {children}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.86 : 1 })}>
      {body}
    </Pressable>
  );
}

/**
 * The dark mass. In light mode navy sits on cream; in dark mode the palette has
 * already swapped it to be LIGHTER than the canvas, so this component does not
 * need to know which theme is running.
 */
export function NavyPanel({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const palette = usePalette();
  return (
    <View
      style={[
        {
          backgroundColor: palette.navy900,
          borderRadius: radii.panel,
          padding: padded ? spacing.xxl : 0,
          overflow: 'hidden',
        },
        elevation(palette, 'lg'),
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Bold title on the left, an optional action on the right. */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
  style,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = usePalette();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.md,
        },
        style,
      ]}
    >
      <T
        style={{
          fontSize: typography.fontSize.lg,
          fontWeight: '700',
          color: palette.foreground,
          flexShrink: 1,
        }}
      >
        {title}
      </T>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          hitSlop={10}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <T style={{ fontSize: typography.fontSize.sm, fontWeight: '600', color: palette.brassStrong }}>
            {actionLabel}
          </T>
          <ChevronRight size={15} color={palette.brassStrong} strokeWidth={2.5} />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * A horizontally scrolling row of chips.
 *
 * Bleeds to both screen edges so the last chip is visibly cut off — that is the
 * affordance telling the user the row scrolls. Padding it inside the screen
 * gutter makes a full row look like a complete one.
 */
export function ChipRow({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: layout.screenPadding,
        gap: spacing.sm,
      }}
      style={[{ marginHorizontal: -layout.screenPadding }, style]}
    >
      {children}
    </ScrollView>
  );
}

export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  tone,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: React.ReactNode;
  tone?: number | null;
}) {
  const palette = usePalette();
  const role = tone != null ? toneOf(palette, tone) : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs + 2,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md - 2,
        borderRadius: radii.full,
        borderWidth: 1,
        backgroundColor: selected ? palette.navy900 : (role?.fill ?? palette.surface),
        borderColor: selected ? palette.navy900 : (role?.edge ?? palette.border),
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {icon}
      <T
        style={{
          fontSize: typography.fontSize.sm,
          fontWeight: '600',
          color: selected ? palette.onNavy : palette.foreground,
        }}
      >
        {label}
      </T>
    </Pressable>
  );
}

/**
 * Segmented control — dark filled pill for the active segment, as in the
 * "Today Task / Team / Programs" and "Details / Route List / Reviews" rows.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = usePalette();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          backgroundColor: palette.surfaceSubtle,
          borderRadius: radii.full,
          padding: spacing.xs,
          borderWidth: 1,
          borderColor: palette.border,
        },
        style,
      ]}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: spacing.md - 2,
              borderRadius: radii.full,
              backgroundColor: active ? palette.navy900 : 'transparent',
            }}
          >
            <Text
              style={{
                fontSize: typography.fontSize.sm,
                fontWeight: '600',
                color: active ? palette.onNavy : palette.muted,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Two or three of these across a row, as in the "Kcal Burned / Days Cmp" pair. */
export function StatTile({
  label,
  children,
  icon,
  tone,
  style,
}: {
  label: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  tone?: number | null;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = usePalette();
  const role = tone != null ? toneOf(palette, tone) : null;

  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: role?.fill ?? palette.surface,
          borderRadius: radii.lg,
          borderWidth: 1,
          borderColor: role?.edge ?? palette.border,
          padding: spacing.lg,
          gap: spacing.sm,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 }}>
        {icon}
        <T
          style={{
            fontSize: typography.fontSize.xs,
            fontWeight: '600',
            color: palette.muted,
            letterSpacing: 0.3,
            flexShrink: 1,
          }}
        >
          {label}
        </T>
      </View>
      {children}
    </View>
  );
}
