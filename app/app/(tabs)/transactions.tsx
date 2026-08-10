import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';
import { formatRupees } from '../../src/lib/format';
import { T } from '../../src/components/T';
import { useQuickEntries } from '../../src/hooks/use-entries';
import type { Tables } from '../../types/database';
import { Plus, ArrowDownLeft, ArrowUpRight, Link as LinkIcon } from 'lucide-react-native';

export default function EntriesScreen() {
  const router = useRouter();
  const { data: entries = [], isLoading, refetch } = useQuickEntries();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const renderEntryItem = ({ item }: { item: Tables<'quick_entries'> }) => {
    const isIncome = item.type === 'income';

    return (
      <TouchableOpacity
        style={styles.entryRow}
        onPress={() => router.push(`/entry/${item.id}`)}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.iconBadge,
            { backgroundColor: isIncome ? colors.light.gainSoft : colors.light.lossSoft },
          ]}
        >
          {isIncome ? (
            <ArrowDownLeft size={20} color={colors.light.gain} />
          ) : (
            <ArrowUpRight size={20} color={colors.light.loss} />
          )}
        </View>

        <View style={styles.entryDetails}>
          <T style={styles.entryCategory}>{item.category || (isIncome ? 'Income' : 'Expense')}</T>
          <T style={styles.entrySub}>
            {item.entry_date} {item.note ? `• ${item.note}` : ''}
          </T>
        </View>

        <View style={styles.amountCol}>
          <Text
            style={[
              styles.amountText,
              { color: isIncome ? colors.light.gain : colors.light.foreground },
            ]}
          >
            {isIncome ? '+' : '-'}{formatRupees(item.amount_paisa)}
          </Text>
          {item.linked_transaction_id && (
            <View style={styles.linkedBadge}>
              <LinkIcon size={12} color={colors.light.brassStrong} />
              <Text style={styles.linkedText}>Linked</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Screen Header */}
      <View style={styles.header}>
        <T style={styles.headerTitle}>Daily Entries</T>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/entry/new')}
          activeOpacity={0.8}
        >
          <Plus size={18} color={colors.light.onNavy} />
          <T style={styles.addBtnText}>New Entry</T>
        </TouchableOpacity>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        renderItem={renderEntryItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.light.brass} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <T style={styles.emptyTitle}>No Entries Found</T>
              <T style={styles.emptySub}>Tap 'New Entry' to add your first quick log.</T>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.navy900,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.navy900,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  addBtnText: {
    color: colors.light.onNavy,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  entryDetails: {
    flex: 1,
  },
  entryCategory: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.light.foreground,
  },
  entrySub: {
    fontSize: typography.fontSize.xs,
    color: colors.light.muted,
    marginTop: 2,
  },
  amountCol: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    fontVariant: ['tabular-nums'],
    writingDirection: 'ltr',
  },
  linkedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  linkedText: {
    fontSize: 10,
    color: colors.light.brassStrong,
    fontWeight: typography.fontWeight.medium,
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
