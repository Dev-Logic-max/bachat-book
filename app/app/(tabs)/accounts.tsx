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
import { useAccounts } from '../../src/hooks/use-accounts';
import type { Tables } from '../../types/database';
import { Landmark, Wallet, CreditCard } from 'lucide-react-native';

export default function AccountsScreen() {
  const router = useRouter();
  const { data: accounts = [], isLoading, refetch } = useAccounts();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'wallet':
        return Wallet;
      case 'credit':
        return CreditCard;
      case 'cash':
        return Wallet;
      default:
        return Landmark;
    }
  };

  const renderAccountItem = ({ item }: { item: Tables<'accounts'> }) => {
    const IconComp = getAccountIcon(item.type);

    return (
      <TouchableOpacity
        style={styles.accountCard}
        onPress={() => router.push(`/account/${item.id}`)}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <View style={styles.iconBg}>
            <IconComp size={22} color={colors.light.navy900} />
          </View>
          <View style={styles.typeBadge}>
            <T style={styles.typeText}>{item.type}</T>
          </View>
        </View>

        <T style={styles.accountName}>{item.name}</T>
        <T style={styles.accountSub}>
          {item.account_number_last4 ? `•••• ${item.account_number_last4}` : item.currency}
        </T>

        <View style={styles.cardFooter}>
          <T style={styles.balanceLabel}>Balance</T>
          <Text style={styles.balanceValue}>
            {formatRupees(item.balance_paisa)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <T style={styles.headerTitle}>Accounts & Ledgers</T>
      </View>

      <FlatList
        data={accounts}
        keyExtractor={(item) => item.id}
        renderItem={renderAccountItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.light.brass} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <T style={styles.emptyTitle}>No Accounts Added</T>
              <T style={styles.emptySub}>Accounts created on Web will appear here.</T>
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
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  accountCard: {
    backgroundColor: colors.light.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.light.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  iconBg: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.light.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBadge: {
    backgroundColor: colors.light.brassSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  typeText: {
    fontSize: 11,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.brassStrong,
    textTransform: 'uppercase',
  },
  accountName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.foreground,
  },
  accountSub: {
    fontSize: typography.fontSize.xs,
    color: colors.light.muted,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
    paddingTop: spacing.md,
  },
  balanceLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.light.muted,
  },
  balanceValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.navy900,
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
