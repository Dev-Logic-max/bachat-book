import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../src/providers/auth-provider';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';
import { formatRupees, toDateString } from '../../src/lib/format';
import { Card } from '../../src/components/ui/Card';
import { T } from '../../src/components/T';
import { useAccounts } from '../../src/hooks/use-accounts';
import { useQuickEntries } from '../../src/hooks/use-entries';
import { UnsyncedBanner } from '../../src/components/UnsyncedBanner';
import { LogOut, ArrowDownLeft, ArrowUpRight, Wallet, Camera, Shield } from 'lucide-react-native';

export default function OverviewScreen() {
  const router = useRouter();
  const { profile, user, signOut } = useSession();

  const { data: accounts = [], isLoading: accountsLoading, refetch: refetchAccounts } = useAccounts();
  const { data: entries = [], isLoading: entriesLoading, refetch: refetchEntries } = useQuickEntries();
  const [refreshing, setRefreshing] = useState(false);

  // Total balance summed from active accounts
  const totalBalancePaisa = accounts.reduce((sum, acc) => sum + (acc.balance_paisa || 0), 0);

  // Month filtering in local date representation (L9 Karachi date fix)
  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const currentMonthEntries = entries.filter((e) => e.entry_date.startsWith(currentYearMonth));

  let monthlyIncomePaisa = 0;
  let monthlyExpensePaisa = 0;

  currentMonthEntries.forEach((e) => {
    if (e.type === 'income') monthlyIncomePaisa += e.amount_paisa;
    else if (e.type === 'expense') monthlyExpensePaisa += e.amount_paisa;
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchAccounts(), refetchEntries()]);
    setRefreshing(false);
  };

  const displayName = profile?.first_name || user?.email?.split('@')[0] || 'User';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <UnsyncedBanner />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.light.brass} />
        }
      >
        {/* Top Header Bar */}
        <View style={styles.topHeader}>
          <View>
            <T style={styles.greetingText}>Assalam-o-Alaikum,</T>
            <T style={styles.nameText}>{displayName}</T>
          </View>
          <TouchableOpacity style={styles.iconBtn} onPress={signOut}>
            <LogOut size={20} color={colors.light.foreground2} />
          </TouchableOpacity>
        </View>

        {/* Dark Mass Hero Navy Card (SPEC §2) */}
        <Card variant="navy" style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <T style={styles.heroLabel}>Total Net Worth</T>
            <Shield size={18} color={colors.light.brass} />
          </View>

          <Text style={[styles.heroAmount, styles.tabular]}>
            {formatRupees(totalBalancePaisa)}
          </Text>

          <View style={styles.heroDivider} />

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <View style={styles.statBadgeGain}>
                <ArrowDownLeft size={16} color={colors.light.gain} />
              </View>
              <View style={styles.statTextGroup}>
                <T style={styles.statLabel}>Income (Month)</T>
                <Text style={[styles.statValueGain, styles.tabular]}>
                  {formatRupees(monthlyIncomePaisa)}
                </Text>
              </View>
            </View>

            <View style={styles.statItem}>
              <View style={styles.statBadgeLoss}>
                <ArrowUpRight size={16} color={colors.light.loss} />
              </View>
              <View style={styles.statTextGroup}>
                <T style={styles.statLabel}>Expense (Month)</T>
                <Text style={[styles.statValueLoss, styles.tabular]}>
                  {formatRupees(monthlyExpensePaisa)}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Quick Action Grid */}
        <T style={styles.sectionTitle}>Quick Actions</T>
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/entry/new')}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIconBg, { backgroundColor: colors.light.brassSoft }]}>
              <Wallet size={22} color={colors.light.brassStrong} />
            </View>
            <T style={styles.actionTitle}>Add Entry</T>
            <T style={styles.actionSub}>Log daily cash/expense</T>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/transactions')}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIconBg, { backgroundColor: colors.light.surfaceSubtle }]}>
              <Camera size={22} color={colors.light.navy900} />
            </View>
            <T style={styles.actionTitle}>Receipt Scan</T>
            <T style={styles.actionSub}>OCR bill capture</T>
          </TouchableOpacity>
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
  scrollContent: {
    padding: spacing.lg,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  greetingText: {
    fontSize: typography.fontSize.xs,
    color: colors.light.muted,
  },
  nameText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.navy900,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.light.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  heroCard: {
    marginBottom: spacing.xl,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  heroLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.light.onNavyMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroAmount: {
    fontSize: typography.fontSize.display,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.onNavy,
    marginVertical: spacing.xs,
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statBadgeGain: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.light.gainSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  statBadgeLoss: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.light.lossSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  statTextGroup: {
    flex: 1,
  },
  statLabel: {
    fontSize: 10,
    color: colors.light.onNavyMuted,
  },
  statValueGain: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.onNavy,
  },
  statValueLoss: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.onNavy,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
    writingDirection: 'ltr',
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.navy900,
    marginBottom: spacing.md,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.light.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  actionIconBg: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  actionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.foreground,
  },
  actionSub: {
    fontSize: typography.fontSize.xs,
    color: colors.light.muted,
    marginTop: 2,
  },
});
