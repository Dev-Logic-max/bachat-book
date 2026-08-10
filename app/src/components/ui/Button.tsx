import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacityProps,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, radii, spacing, typography } from '../../theme/tokens';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'brass' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  style,
  textStyle,
  ...props
}: ButtonProps) {
  const getContainerStyle = (): ViewStyle => {
    let base: ViewStyle = styles.base;

    switch (size) {
      case 'sm':
        base = { ...base, paddingVertical: spacing.xs, paddingHorizontal: spacing.md };
        break;
      case 'lg':
        base = { ...base, paddingVertical: spacing.lg, paddingHorizontal: spacing.xxl };
        break;
      default:
        base = { ...base, paddingVertical: spacing.md, paddingHorizontal: spacing.xl };
    }

    switch (variant) {
      case 'secondary':
        return { ...base, backgroundColor: colors.light.surfaceSubtle };
      case 'brass':
        return { ...base, backgroundColor: colors.light.brass };
      case 'danger':
        return { ...base, backgroundColor: colors.light.loss };
      case 'outline':
        return {
          ...base,
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.light.borderStrong,
        };
      default: // primary = navy-900 mass
        return { ...base, backgroundColor: colors.light.navy900 };
    }
  };

  const getTextStyle = (): TextStyle => {
    switch (variant) {
      case 'secondary':
        return { color: colors.light.foreground };
      case 'outline':
        return { color: colors.light.foreground };
      case 'brass':
        return { color: colors.light.navy900, fontWeight: typography.fontWeight.semibold };
      case 'danger':
        return { color: '#FFFFFF', fontWeight: typography.fontWeight.semibold };
      default:
        return { color: colors.light.onNavy, fontWeight: typography.fontWeight.semibold };
    }
  };

  return (
    <TouchableOpacity
      style={[
        getContainerStyle(),
        (disabled || loading) && styles.disabled,
        style,
      ]}
      disabled={disabled || loading}
      activeOpacity={0.8}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'brass' ? colors.light.navy900 : '#FFFFFF'} />
      ) : (
        <Text style={[styles.text, getTextStyle(), textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  text: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
});
