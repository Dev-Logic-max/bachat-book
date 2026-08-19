import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Banknote,
  Building2,
  Lock,
  Smartphone,
  TriangleAlert,
  Wallet,
  type LucideProps,
} from 'lucide-react-native';
import { Screen } from '../../src/components/ui/Screen';
import { Card, NavyPanel, SectionHeader } from '../../src/components/ui/Surfaces';
import { Money } from '../../src/components/ui/Money';
import { EmptyState, Reveal, SkeletonRow } from '../../src/components/ui/Feedback';
import { T } from '../../src/components/T';
import { usePalette } from '../../src/providers/theme-provider';
import { useAccounts } from '../../src/hooks/use-accounts';
import { ACCOUNT_TYPE_LABEL, isLiveAccount, type Account } from '../../src/lib/ledger';
import { radii, spacing, toneOf, typography } from '../../src/theme/tokens';

const TYPE_ICON: Record<string, React.ComponentType<LucideProps>> = {
  cash: Banknote,
  checking: Building2,
  savings: Building2,
  wallet: Smartphone,
  credit: Wallet,
  investment: Wallet,
};

/** Account type → the tone its card is washed in. Stable, so a bank always reads the same. */
const TYPE_TONE: Record<string, number> = {
  cash: 1,
  checking: 2,
  savings: 3,
  wallet: 4,
  credit: 6,
  investment: 5,
};

export default function AccountsScreen() {
  const palette = usePalette();
  const router = useRouter();
  const { data: accounts = [], isLoading, error, refetch, isRefetching } = useAccounts();

  const live = accounts.filter(isLiveAccount);
  // Archived and deleted accounts are SHOWN, in their own section. One that
  // silently vanishes reads as data loss and sends you hunting for it.
  const inactive = accounts.filter((a) => !isLiveAccount(a));
  const held = live.reduce((sum, a) => sum + Number(a.balance_paisa), 0);

  return (
    <Screen refreshing={isRefetching} onRefresh={refetch}>
      <T
        style={{
          fontSize: typography.fontSize.xxl,
          fontWeight: '700',
          color: palette.foreground,
          marginBottom: spacing.xs,
        }}
      >
        Accounts
      </T>
      <T style={{ fontSize: typography.fontSize.sm, color: palette.muted, marginBottom: spacing.xl }}>
        Where you hold money
      </T>

      <Reveal>
        <NavyPanel>
          <T style={{ fontSize: typography.fontSize.sm, color: palette.onNavyMuted, fontWeight: '600' }}>
            Total held
          </T>
          <Money
            paisa={held}
            variant="hero"
            color={palette.onNavy}
            style={{ marginTop: spacing.sm }}
          />
        </NavyPanel>
      </Reveal>

      <View style={{ marginTop: spacing.xxl }}>
        <SectionHeader title="Your accounts" />

        {error ? (
          <Card padded={false}>
            <EmptyState
              variant="error"
              icon={<TriangleAlert size={26} color={palette.loss} />}
              title="Could not load your accounts"
              body={error instanceof Error ? error.message : 'Pull down to try again.'}
            />
          </Card>
        ) : isLoading ? (
          <Card>
            <SkeletonRow />
            <SkeletonRow />
          </Card>
        ) : live.length === 0 ? (
          <Card padded={false}>
            <EmptyState
              icon={<Wallet size={26} color={palette.muted} />}
              title="No accounts yet"
              body="An account is somewhere you HOLD money — a bank, a mobile wallet, or cash in hand. Accounts start at Rs 0; money arrives by logging an income entry."
            />
          </Card>
        ) : (
          <View style={{ gap: spacing.md }}>
            {live.map((account, i) => (
              <Reveal key={account.id} index={i}>
                <AccountCard
                  account={account}
                  onPress={() => router.push(`/account/${account.id}` as never)}
                />
              </Reveal>
            ))}
          </View>
        )}
      </View>

      {inactive.length > 0 ? (
        <View style={{ marginTop: spacing.xxl }}>
          <SectionHeader title="Not in use" />
          <View style={{ gap: spacing.md }}>
            {inactive.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                onPress={() => router.push(`/account/${account.id}` as never)}
              />
            ))}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

function AccountCard({ account, onPress }: { account: Account; onPress: () => void }) {
  const palette = usePalette();
  const role = toneOf(palette, TYPE_TONE[account.type] ?? 2);
  const Icon = TYPE_ICON[account.type] ?? Wallet;

  const state = account.deleted_at ? 'Deleted' : account.is_archived ? 'Deactivated' : null;
  const dimmed = !!state;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: dimmed ? palette.surfaceSubtle : role.fill,
        borderRadius: radii.card,
        borderWidth: 1,
        borderColor: dimmed ? palette.border : role.edge,
        padding: spacing.xl,
        opacity: pressed ? 0.88 : dimmed ? 0.72 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radii.md,
            backgroundColor: palette.surface,
            borderWidth: 1,
            borderColor: dimmed ? palette.border : role.edge,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={21} color={dimmed ? palette.muted : role.ink} strokeWidth={2} />
        </View>

        <View style={{ flex: 1, gap: 3 }}>
          <T
            style={{
              fontSize: typography.fontSize.base,
              fontWeight: '700',
              color: palette.foreground,
            }}
            numberOfLines={1}
          >
            {account.name}
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 }}>
            <T style={{ fontSize: typography.fontSize.xs, color: palette.muted }}>
              {ACCOUNT_TYPE_LABEL[account.type] ?? account.type}
            </T>

            {/* A lock only bites on the way OUT — paying into savings is the
                point of it — so the chip says so rather than reading as frozen. */}
            {account.is_locked ? <Tag icon={<Lock size={10} color={palette.warn} />} label="Pay in only" tone={palette.warn} /> : null}
            {state ? <Tag label={state} tone={palette.muted} /> : null}
          </View>
        </View>
      </View>

      <Money paisa={account.balance_paisa} variant="title" style={{ marginTop: spacing.lg }} />
    </Pressable>
  );
}

function Tag({ label, tone, icon }: { label: string; tone: string; icon?: React.ReactNode }) {
  const palette = usePalette();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: radii.full,
        backgroundColor: palette.surface,
        borderWidth: 1,
        borderColor: palette.border,
      }}
    >
      {icon}
      <Text style={{ fontSize: 10, fontWeight: '700', color: tone, letterSpacing: 0.2 }}>
        {label}
      </Text>
    </View>
  );
}
