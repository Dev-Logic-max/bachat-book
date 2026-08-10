import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';
import { T } from '../../src/components/T';
import { Calendar as CalendarIcon } from 'lucide-react-native';

export default function CalendarScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <T style={styles.headerTitle}>Financial Calendar</T>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.emptyCard}>
          <CalendarIcon size={48} color={colors.light.brass} />
          <T style={styles.emptyTitle}>Calendar Events</T>
          <T style={styles.emptySub}>
            Recurring bills, committee payouts, and salary events will render on this heat-map calendar.
          </T>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.canvas,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.navy900,
  },
  content: {
    padding: spacing.lg,
  },
  emptyCard: {
    backgroundColor: colors.light.surface,
    borderRadius: radii.card,
    padding: spacing.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.navy900,
    marginTop: spacing.md,
  },
  emptySub: {
    fontSize: typography.fontSize.sm,
    color: colors.light.muted,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 20,
  },
});
