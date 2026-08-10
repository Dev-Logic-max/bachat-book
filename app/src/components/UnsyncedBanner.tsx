import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useOfflineQueue } from '../hooks/use-offline-queue';
import { colors, radii, spacing, typography } from '../theme/tokens';
import { WifiOff, RefreshCw } from 'lucide-react-native';

export function UnsyncedBanner() {
  const { pendingCount, failedCount, replayOutbox } = useOfflineQueue();

  const totalUnsynced = pendingCount + failedCount;
  if (totalUnsynced === 0) return null;

  return (
    <View style={styles.banner}>
      <View style={styles.left}>
        <WifiOff size={16} color={failedCount > 0 ? colors.light.loss : colors.light.warn} />
        <Text style={styles.bannerText}>
          Not synced ({totalUnsynced}){failedCount > 0 ? ` • ${failedCount} failed` : ''}
        </Text>
      </View>

      <TouchableOpacity style={styles.syncBtn} onPress={replayOutbox} activeOpacity={0.8}>
        <RefreshCw size={14} color={colors.light.navy900} />
        <Text style={styles.syncBtnText}>Sync Now</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.light.warnSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  bannerText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.light.navy900,
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.light.brass,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  syncBtnText: {
    fontSize: 11,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.navy900,
  },
});
