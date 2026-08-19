import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ArrowLeftRight, Inbox, Lock, TriangleAlert } from 'lucide-react-native';
import { Screen } from '../../src/components/ui/Screen';
import { Card, NavyPanel, SectionHeader } from '../../src/components/ui/Surfaces';
import { Money, Numeric } from '../../src/components/ui/Money';
import { CategoryGlyph } from '../../src/components/ui/CategoryGlyph';
import { EmptyState, SkeletonRow } from '../../src/components/ui/Feedback';
import { IconButton } from '../../src/components/ui/Button';
import { T } from '../../src/components/T';
import { usePalette } from '../../src/providers/theme-provider';
import { useSession } from '../../src/providers/auth-provider';
import { useAccounts, useAccountLedger } from '../../src/hooks/use-accounts';
import { ACCOUNT_TYPE_LABEL, categoryLabel } from '../../src/lib/ledger';
import { radii, spacing, typography } from '../../src/theme/tokens';

export default function AccountLedgerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { profile } = useSession();
  const locale = profile?.locale ?? 'en';

  const { data: accounts = [] } = useAccounts();
  const account = accounts.find((a) => a.id === id) ?? null;

  const { data: movements = [], isLoading, error, refetch, isRefetching } = useAccountLedger(id);

  const state = account?.deleted_at ? 'Deleted' : account?.is_archived ? 'Deactivated' : null;

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.lg,
          paddingTop: insets.top + spacing.sm,
          paddingBottom: spacing.sm,
        }}
      >
        <IconButton accessibilityLabel="Back" onPress={() => router.back()}>
          <ArrowLeft size={19} color={palette.foreground2} />
        </IconButton>
        <T
          style={{ fontSize: typography.fontSize.lg, fontWeight: '700', color: palette.foreground, flex: 1, textAlign: 'center' }}
          numberOfLines={1}
        >
          {account?.name ?? 'Account'}
        </T>
        <View style={{ width: 40 }} />
      </View>

      <Screen topInset={false} refreshing={isRefetching} onRefresh={refetch}>
        {account ? (
          <NavyPanel>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <T
                style={{
                  fontSize: typography.fontSize.sm,
                  color: palette.onNavyMuted,
                  fontWeight: '600',
                }}
              >
                {ACCOUNT_TYPE_LABEL[account.type] ?? account.type} · {account.currency}
              </T>
              {account.is_locked ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Lock size={11} color={palette.brass} />
                  <Text style={{ fontSize: 10, fontWeight: '700', color: palette.brass }}>
                    PAY IN ONLY
                  </Text>
                </View>
              ) : null}
            </View>

            <Money
              paisa={account.balance_paisa}
              variant="hero"
              color={palette.onNavy}
              style={{ marginTop: spacing.sm }}
            />

            {state ? (
              <T
                style={{
                  fontSize: typography.fontSize.xs,
                  color: palette.onNavyMuted,
                  marginTop: spacing.md,
                }}
              >
                {state === 'Deleted'
                  ? 'This account is deleted. Its past movements stay so your history still reads.'
                  : 'This account is switched off. It is out of your total and hidden from pickers.'}
              </T>
            ) : null}
          </NavyPanel>
        ) : null}

        <View style={{ marginTop: spacing.xxl }}>
          <SectionHeader title="Statement" />

          <Card padded={false}>
            {error ? (
              <EmptyState
                variant="error"
                icon={<TriangleAlert size={26} color={palette.loss} />}
                title="Could not load this statement"
                body={error instanceof Error ? error.message : 'Pull down to try again.'}
              />
            ) : isLoading ? (
              <View style={{ paddingHorizontal: spacing.xl }}>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </View>
            ) : movements.length === 0 ? (
              <EmptyState
                icon={<Inbox size={26} color={palette.muted} />}
                title="Nothing on this account yet"
                body="Accounts start at Rs 0. Money arrives by logging an income entry against this account."
              />
            ) : (
              movements.map((movement, i) => {
                const isTransfer = movement.type === 'transfer';
                const amount = Number(movement.amount_paisa);

                return (
                  <Pressable
                    key={movement.id}
                    onPress={() => router.push(`/entry/${movement.id}` as never)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.md,
                      paddingHorizontal: spacing.xl,
                      paddingVertical: spacing.lg - 2,
                      borderBottomWidth: i === movements.length - 1 ? 0 : 1,
                      borderBottomColor: palette.border,
                      backgroundColor: pressed ? palette.surfaceSubtle : 'transparent',
                    })}
                  >
                    {isTransfer ? (
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: radii.md,
                          backgroundColor: palette.surfaceSubtle,
                          borderWidth: 1,
                          borderColor: palette.border,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <ArrowLeftRight size={19} color={palette.foreground2} />
                      </View>
                    ) : (
                      <CategoryGlyph
                        icon={movement.category?.icon}
                        tone={movement.category?.tone}
                        size={44}
                      />
                    )}

                    <View style={{ flex: 1, gap: 3 }}>
                      <T
                        style={{
                          fontSize: typography.fontSize.base,
                          fontWeight: '600',
                          color: palette.foreground,
                        }}
                        numberOfLines={1}
                      >
                        {isTransfer
                          ? `Transfer · ${movement.transfer_account?.name ?? 'another account'}`
                          : movement.category
                            ? categoryLabel(movement.category as never, locale)
                            : movement.note || 'Uncategorised'}
                      </T>
                      <Numeric style={{ fontSize: typography.fontSize.xs, color: palette.faint }}>
                        {movement.date}
                        {movement.is_opening ? '  ·  opening balance' : ''}
                      </Numeric>
                    </View>

                    {/* Signed by the SIGN of the amount, never by `type`. */}
                    <Money paisa={amount} variant="body" signed showPlus />
                  </Pressable>
                );
              })
            )}
          </Card>
        </View>
      </Screen>
    </View>
  );
}
