import { StyleSheet } from 'react-native';
import { colors, radii, spacing, typography } from './tokens';
import { shadows } from './shadows';

export const commonStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.canvas,
  },
  card: {
    backgroundColor: colors.light.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    ...shadows.sm,
  },
  navyCard: {
    backgroundColor: colors.light.navy900,
    borderRadius: radii.card,
    padding: spacing.xl,
    ...shadows.md,
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tabularText: {
    fontVariant: ['tabular-nums'],
    writingDirection: 'ltr',
  },
});
