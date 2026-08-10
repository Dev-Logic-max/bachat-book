import React from 'react';
import { View, StyleSheet, ViewProps, ViewStyle } from 'react-native';
import { colors, radii, spacing } from '../../theme/tokens';
import { shadows } from '../../theme/shadows';

interface CardProps extends ViewProps {
  variant?: 'surface' | 'navy' | 'subtle' | 'outline';
  style?: ViewStyle | ViewStyle[];
  children: React.ReactNode;
}

export function Card({ variant = 'surface', style, children, ...props }: CardProps) {
  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'navy':
        return {
          backgroundColor: colors.light.navy900,
          ...shadows.md,
        };
      case 'subtle':
        return {
          backgroundColor: colors.light.surfaceSubtle,
        };
      case 'outline':
        return {
          backgroundColor: colors.light.surface,
          borderWidth: 1,
          borderColor: colors.light.border,
        };
      default:
        return {
          backgroundColor: colors.light.surface,
          ...shadows.sm,
        };
    }
  };

  return (
    <View style={[styles.card, getVariantStyle(), style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.card,
    padding: spacing.lg,
  },
});
