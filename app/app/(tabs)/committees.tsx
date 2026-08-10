import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../src/providers/auth-provider';
import { supabase } from '../../src/lib/supabase';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';
import { formatRupees } from '../../src/lib/format';
import { T } from '../../src/components/T';
import type { Tables } from '../../types/database';
import { Users, Info } from 'lucide-react-native';

export default function CommitteesScreen() {
  const { householdId } = useSession();
  const [committees, setCommittees] = useState<Tables<'committees'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCommittees = async () => {
    if (!householdId) return;

    try {
      const { data, error } = await supabase
        .from('committees')
        .select('*')
        .eq('household_id', householdId);

      if (!error && data) {
        setCommittees(data);
      }
    } catch (e) {
      console.warn('Error fetching committees:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommittees();
  }, [householdId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCommittees();
    setRefreshing(false);
  };

  const renderCommitteeItem = ({ item }: { item: Tables<'committees'> }) => {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconBg}>
            <Users size={20} color={colors.light.navy900} />
          </View>
          <T style={styles.committeeName}>{item.name}</T>
        </View>

        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <T style={styles.label}>Members</T>
            <Text style={styles.valText}>{item.total_members}</Text>
          </View>

          <View style={styles.gridItem}>
            <T style={styles.label}>Monthly Contribution</T>
            <Text style={styles.valText}>
              {formatRupees(item.monthly_contribution_paisa)}
            </Text>
          </View>

          <View style={styles.gridItem}>
            <T style={styles.label}>Payout Month</T>
            <Text style={styles.valText}>Month {item.my_payout_month}</Text>
          </View>

          <View style={styles.gridItem}>
            <T style={styles.label}>Status</T>
            <T style={[styles.valText, { color: item.payout_received ? colors.light.gain : colors.light.warn }]}>
              {item.payout_received ? 'Paid' : 'Pending'}
            </T>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <T style={styles.headerTitle}>Committees (BC)</T>
      </View>

      <View style={styles.readOnlyBanner}>
        <Info size={16} color={colors.light.navy900} />
        <T style={styles.bannerText}>
          Read-only tracker (v1). Committee management is available on Web.
        </T>
      </View>

      <FlatList
        data={committees}
        keyExtractor={(item) => item.id}
        renderItem={renderCommitteeItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.light.brass} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <T style={styles.emptyTitle}>No Committees Active</T>
              <T style={styles.emptySub}>Committees created on Web will be displayed here.</T>
            </View>
          ) : null
        }
      />
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
  readOnlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.brassSoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radii.md,
    gap: spacing.sm,
  },
  bannerText: {
    fontSize: typography.fontSize.xs,
    color: colors.light.navy900,
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  card: {
    backgroundColor: colors.light.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.light.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  committeeName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.foreground,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.md,
  },
  gridItem: {
    width: '50%',
  },
  label: {
    fontSize: 11,
    color: colors.light.muted,
  },
  valText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.light.foreground,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
    writingDirection: 'ltr',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.light.foreground2,
  },
  emptySub: {
    fontSize: typography.fontSize.sm,
    color: colors.light.muted,
    marginTop: spacing.xs,
  },
});
