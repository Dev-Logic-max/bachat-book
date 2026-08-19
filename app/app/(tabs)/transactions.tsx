import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeftRight, Inbox, TriangleAlert } from 'lucide-react-native';
import { Screen } from '../../src/components/ui/Screen';
import { Card } from '../../src/components/ui/Surfaces';
import { Money, Numeric } from '../../src/components/ui/Money';
import { CategoryGlyph } from '../../src/components/ui/CategoryGlyph';
import { EmptyState, SkeletonRow } from '../../src/components/ui/Feedback';
import { T } from '../../src/components/T';
import { usePalette } from '../../src/providers/theme-provider';
import { useSession } from '../../src/providers/auth-provider';
import { useTransactions, type MovementRow } from '../../src/hooks/use-transactions';
import { categoryLabel } from '../../src/lib/ledger';
import { radii, spacing, typography } from '../../src/theme/tokens';

export default function TransactionsScreen() {
  const palette = usePalette();
  const router = useRouter();
  const { profile } = useSession();
  const locale = profile?.locale ?? 'en';

  const { data: rows = [], isLoading, error, refetch, isRefetching } = useTransactions();

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
        Transactions
      </T>
      <T style={{ fontSize: typography.fontSize.sm, color: palette.muted, marginBottom: spacing.xl }}>
        Money that touched a bank or wallet, and transfers between your accounts
      </T>

      <Card padded={false}>
        {error ? (
          // Surfaced separately from "no rows" on purpose. This exact query is
          // the one that failed with PGRST201 on web and rendered as an empty
          // state for every household.
          <EmptyState
            variant="error"
            icon={<TriangleAlert size={26} color={palette.loss} />}
            title="Could not load transactions"
            body={error instanceof Error ? error.message : 'Pull down to try again.'}
          />
        ) : isLoading ? (
          <View style={{ paddingHorizontal: spacing.xl }}>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </View>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Inbox size={26} color={palette.muted} />}
            title="No bank or wallet activity yet"
            body="Cash spending lives on Entries. Anything through a bank account, a mobile wallet, or a transfer shows up here."
          />
        ) : (
          rows.map((row, i) => (
            <MovementRowItem
              key={row.id}
              row={row}
              locale={locale}
              last={i === rows.length - 1}
              onPress={() => router.push(`/entry/${row.id}` as never)}
            />
          ))
        )}
      </Card>
    </Screen>
  );
}

function MovementRowItem({
  row,
  locale,
  last,
  onPress,
}: {
  row: MovementRow;
  locale: string;
  last?: boolean;
  onPress: () => void;
}) {
  const palette = usePalette();
  const isTransfer = row.type === 'transfer';

  const title = isTransfer
    ? `${row.account?.name ?? '—'} → ${row.transfer_account?.name ?? '—'}`
    : row.category
      ? categoryLabel(row.category as never, locale)
      : row.note || 'Uncategorised';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.lg - 2,
        borderBottomWidth: last ? 0 : 1,
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
          <ArrowLeftRight size={19} color={palette.foreground2} strokeWidth={2} />
        </View>
      ) : (
        <CategoryGlyph icon={row.category?.icon} tone={row.category?.tone} size={44} />
      )}

      <View style={{ flex: 1, gap: 3 }}>
        <T
          style={{ fontSize: typography.fontSize.base, fontWeight: '600', color: palette.foreground }}
          numberOfLines={1}
        >
          {title}
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 }}>
          <Numeric style={{ fontSize: typography.fontSize.xs, color: palette.faint }}>
            {row.date}
          </Numeric>
          {!isTransfer && row.account ? (
            <>
              <Text style={{ color: palette.faint, fontSize: typography.fontSize.xs }}>·</Text>
              <T style={{ fontSize: typography.fontSize.xs, color: palette.faint }} numberOfLines={1}>
                {row.account.deleted_at ? 'Deleted account' : row.account.name}
              </T>
            </>
          ) : null}
        </View>
      </View>

      {/* A transfer is not flow. Showing it signed would read as income or
          expenditure; it is neither, so it renders neutral. */}
      <Money
        paisa={row.amount_paisa}
        variant="body"
        signed={!isTransfer}
        showPlus={!isTransfer}
        color={isTransfer ? palette.foreground2 : undefined}
      />
    </Pressable>
  );
}
