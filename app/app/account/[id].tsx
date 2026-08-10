import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';
import { formatRupees } from '../../src/lib/format';
import { T } from '../../src/components/T';
import { useAccounts, useAccountLedger } from '../../src/hooks/use-accounts';
import type { Tables } from '../../types/database';
import { ArrowLeft, Landmark, ArrowDownLeft, ArrowUpRight } from 'lucide-react-native';

export default function AccountLedgerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: accounts = [] } = useAccounts();
  const account = accounts.find((a) => a.id === id) || null;

  const { data: transactions = [], isLoading, refetch } = useAccountLedger(id || '');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const renderTxItem = ({ item }: { item: Tables<'transactions'> }) => {
    const isIncome = item.amount_paisa > 0;

    return (
      <View style={styles.txRow}>
        <View
          style={[
            styles.txBadge,
            { backgroundColor: isIncome ? colors.light.gainSoft : colors.light.lossSoft },
          ]}
        >
          {isIncome ? (
            <ArrowDownLeft size={18} color={colors.light.gain} />
          ) : (
            <ArrowUpRight size={18} color={colors.light.loss} />
          )}
        </View>

        <View style={styles.txMeta}>
          <T style={styles.txType}>{item.type.toUpperCase()}</T>
          <T style={styles.txDate}>{item.date} {item.note ? `• ${item.note}` : ''}</T>
        </View>

        <Text
          style={[
            styles.txAmount,
            { color: isIncome ? colors.light.gain : colors.light.foreground },
          ]}
        >
          {isIncome ? '+' : ''}{formatRupees(item.amount_paisa)}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} color={colors.light.foreground} />
        </TouchableOpacity>
        <T style={styles.headerTitle}>{account?.name || 'Account Ledger'}</T>
        <View style={{ width: 36 }} />
      </View>

      {/* Account Hero Header */}
      {account && (
        <View style={styles.accountHero}>
          <View style={styles.heroRow}>
            <View style={styles.iconBg}>
              <Landmark size={24} color={colors.light.navy900} />
            </View>
            <View>
              <T style={styles.heroTitle}>{account.name}</T>
              <T style={styles.heroSub}>{account.type.toUpperCase()} • {account.currency}</T>
            </View>
          </View>

          <View style={styles.balanceBlock}>
            <T style={styles.balanceLabel}>Current Ledger Balance</T>
            <Text style={styles.balanceVal}>{formatRupees(account.balance_paisa)}</Text>
          </View>
        </View>
      )}

      {/* Transaction List */}
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderTxItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.light.brass} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyBox}>
              <T style={styles.emptyTitle}>No Transactions</T>
              <T style={styles.emptySub}>No posted transactions found for this account.</T>
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
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.light.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.navy900,
  },
  accountHero: {
    backgroundColor: colors.light.surface,
    padding: spacing.xl,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconBg: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.light.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.navy900,
  },
  heroSub: {
    fontSize: typography.fontSize.xs,
    color: colors.light.muted,
    marginTop: 2,
  },
  balanceBlock: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  balanceLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.light.muted,
  },
  balanceVal: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.navy900,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
    writingDirection: 'ltr',
  },
  listContent: {
    padding: spacing.lg,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  txBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  txMeta: {
    flex: 1,
  },
  txType: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.light.foreground,
  },
  txDate: {
    fontSize: typography.fontSize.xs,
    color: colors.light.muted,
    marginTop: 2,
  },
  txAmount: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    fontVariant: ['tabular-nums'],
    writingDirection: 'ltr',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.light.foreground2,
  },
  emptySub: {
    fontSize: typography.fontSize.xs,
    color: colors.light.muted,
    marginTop: 4,
  },
});
