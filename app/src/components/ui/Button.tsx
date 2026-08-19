import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { usePalette } from '../../providers/theme-provider';
import { elevation } from '../../theme/use-styles';
import { radii, spacing, typography } from '../../theme/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'brass' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  /** Fills the row. The bottom CTA in every reference is full-width. */
  block?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

const SIZES: Record<ButtonSize, { padV: number; padH: number; font: number }> = {
  sm: { padV: spacing.sm + 2, padH: spacing.lg, font: typography.fontSize.sm },
  md: { padV: spacing.md + 2, padH: spacing.xl, font: typography.fontSize.base },
  lg: { padV: spacing.lg + 2, padH: spacing.xxl, font: typography.fontSize.lg },
};

/**
 * `text-brass` fails contrast on cream, so the PRIMARY button is the navy mass
 * and brass is reserved for the accent variant on a dark ground. Getting this
 * backwards is a documented round lost on web.
 */
export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  icon,
  block = false,
  style,
  textStyle,
  ...props
}: ButtonProps) {
  const palette = usePalette();
  const dims = SIZES[size];

  const skin: Record<ButtonVariant, { bg: string; fg: string; border?: string; raised?: boolean }> = {
    primary: { bg: palette.navy900, fg: palette.onNavy, raised: true },
    secondary: { bg: palette.surfaceSubtle, fg: palette.foreground, border: palette.border },
    outline: { bg: 'transparent', fg: palette.foreground, border: palette.borderStrong },
    brass: { bg: palette.brass, fg: palette.navy900, raised: true },
    danger: { bg: palette.loss, fg: '#FFFFFF', raised: true },
    ghost: { bg: 'transparent', fg: palette.brassStrong },
  };

  const tone = skin[variant];
  const inert = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inert, busy: loading }}
      disabled={inert}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          paddingVertical: dims.padV,
          paddingHorizontal: dims.padH,
          borderRadius: radii.full,
          backgroundColor: tone.bg,
          borderWidth: tone.border ? 1 : 0,
          borderColor: tone.border,
          alignSelf: block ? 'stretch' : 'flex-start',
          opacity: inert ? 0.45 : pressed ? 0.88 : 1,
        },
        tone.raised && !inert ? elevation(palette, 'md') : null,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={tone.fg} />
      ) : (
        <>
          {icon ? <View>{icon}</View> : null}
          <Text
            style={[
              { fontSize: dims.font, fontWeight: '600', color: tone.fg, textAlign: 'center' },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/** A circular icon button — the back/notification affordances in the references. */
export function IconButton({
  children,
  onPress,
  size = 40,
  variant = 'surface',
  style,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  size?: number;
  variant?: 'surface' | 'navy' | 'subtle';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const palette = usePalette();
  const bg = {
    surface: palette.surface,
    navy: palette.navy900,
    subtle: palette.surfaceSubtle,
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: radii.full,
          backgroundColor: bg,
          borderWidth: variant === 'navy' ? 0 : 1,
          borderColor: palette.border,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}
