import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  Inbox,
  TriangleAlert,
  Wallet,
} from 'lucide-react-native';
import { Screen } from '../../src/components/ui/Screen';
import { Card, NavyPanel, SectionHeader, StatTile } from '../../src/components/ui/Surfaces';
import { Money, Numeric } from '../../src/components/ui/Money';
import { CategoryGlyph } from '../../src/components/ui/CategoryGlyph';
import { EmptyState, Reveal, Skeleton, SkeletonRow } from '../../src/components/ui/Feedback';
import { IconButton } from '../../src/components/ui/Button';
import { T } from '../../src/components/T';
import { usePalette } from '../../src/providers/theme-provider';
import { useSession } from '../../src/providers/auth-provider';
import { useEntries } from '../../src/hooks/use-entries';
import { useHeldTotal, useLiveAccounts } from '../../src/hooks/use-accounts';
import { flowTotals, categoryLabel } from '../../src/lib/ledger';
import { formatName, toDateString } from '../../src/lib/format';
import { spacing, typography, radii } from '../../src/theme/tokens';

export default function OverviewScreen() {
  const palette = usePalette();
  const router = useRouter();
  const { profile } = useSession();

  const accounts = useLiveAccounts();
  const heldPaisa = useHeldTotal();
  const { data: entries = [], isLoading, error, refetch, isRefetching } = useEntries({ limit: 60 });

  // This calendar month's flow. Transfers and opening balances are already out
  // — `useEntries` filters them at the query and `flowTotals` again by type — so
  // an ATM withdrawal cannot read as income and expenditure at once.
  const month = useMemo(() => {
    const now = new Date();
    const first = toDateString(new Date(now.getFullYear(), now.getMonth(), 1));
    return flowTotals(entries.filter((e) => e.date >= first));
  }, [entries]);

  const recent = entries.slice(0, 6);
  const locale = profile?.locale ?? 'en';

  return (
    <Screen refreshing={isRefetching} onRefresh={refetch}>
      {/* ---- Greeting ------------------------------------------------- */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.xl,
        }}
      >
        <View style={{ flex: 1 }}>
          <T style={{ fontSize: typography.fontSize.sm, color: palette.muted }}>
            {greeting()}
          </T>
          <T
            style={{
              fontSize: typography.fontSize.xxl,
              fontWeight: '700',
              color: palette.foreground,
              marginTop: 2,
            }}
            numberOfLines={1}
          >
            {formatName(profile?.first_name, profile?.last_name, 'there')}
          </T>
        </View>
        <IconButton accessibilityLabel="Notifications" onPress={() => router.push('/more' as never)}>
          <Bell size={19} color={palette.foreground2} />
        </IconButton>
      </View>

      {/* ---- Net worth hero ------------------------------------------- */}
      <Reveal>
        <NavyPanel>
          <T
            style={{
              fontSize: typography.fontSize.sm,
              color: palette.onNavyMuted,
              fontWeight: '600',
              letterSpacing: 0.4,
            }}
          >
            What you hold
          </T>

          {isLoading && accounts.length === 0 ? (
            <Skeleton width="70%" height={44} style={{ marginTop: spacing.md }} />
          ) : (
            <Money
              paisa={heldPaisa}
              variant="hero"
              color={palette.onNavy}
              style={{ marginTop: spacing.sm }}
            />
          )}

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              marginTop: spacing.lg,
            }}
          >
            <Wallet size={15} color={palette.onNavyMuted} />
            <T style={{ fontSize: typography.fontSize.sm, color: palette.onNavyMuted }}>
              across {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}
            </T>
          </View>
        </NavyPanel>
      </Reveal>

      {/* ---- Month flow ------------------------------------------------ */}
      <Reveal index={1}>
        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
          <StatTile
            label="IN THIS MONTH"
            tone={5}
            icon={<ArrowDownLeft size={14} color={palette.gain} strokeWidth={2.5} />}
          >
            <Money paisa={month.inPaisa} variant="title" compact color={palette.gain} />
          </StatTile>
          <StatTile
            label="OUT THIS MONTH"
            tone={6}
            icon={<ArrowUpRight size={14} color={palette.loss} strokeWidth={2.5} />}
          >
            <Money paisa={month.outPaisa} variant="title" compact color={palette.loss} />
          </StatTile>
        </View>
      </Reveal>

      {/* ---- Net for the month ----------------------------------------- */}
      <Reveal index={2}>
        <Card style={{ marginTop: spacing.md }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flex: 1 }}>
              <T style={{ fontSize: typography.fontSize.sm, color: palette.muted }}>
                Left over this month
              </T>
              <T
                style={{
                  fontSize: typography.fontSize.xs,
                  color: palette.faint,
                  marginTop: 2,
                }}
              >
                {month.netPaisa >= 0 ? 'You are ahead' : 'You are spending more than you earn'}
              </T>
            </View>
            <Money paisa={month.netPaisa} variant="title" signed showPlus compact />
          </View>
        </Card>
      </Reveal>

      {/* ---- Recent ----------------------------------------------------- */}
      <View style={{ marginTop: spacing.xxl }}>
        <SectionHeader
          title="Recent"
          actionLabel={entries.length ? 'See all' : undefined}
          onAction={entries.length ? () => router.push('/entries' as never) : undefined}
        />

        <Card padded={false}>
          {error ? (
            // A failed query must never wear the empty state's clothes. "Nothing
            // here" and "the request failed" are different facts and only one of
            // them means the household has logged nothing.
            <EmptyState
              variant="error"
              icon={<TriangleAlert size={26} color={palette.loss} />}
              title="Could not load your entries"
              body={error instanceof Error ? error.message : 'Pull down to try again.'}
            />
          ) : isLoading ? (
            <View style={{ paddingHorizontal: spacing.xl }}>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </View>
          ) : recent.length === 0 ? (
            <EmptyState
              icon={<Inbox size={26} color={palette.muted} />}
              title="Nothing logged yet"
              body="Tap the + button below to log your first expense or income."
            />
          ) : (
            recent.map((entry, i) => (
              <EntryRowItem
                key={entry.id}
                entry={entry}
                locale={locale}
                last={i === recent.length - 1}
                onPress={() => router.push(`/entry/${entry.id}` as never)}
              />
            ))
          )}
        </Card>
      </View>
    </Screen>
  );
}

/**
 * One movement.
 *
 * The amount is coloured and signed by the SIGN of `amount_paisa`, never by
 * `type`. They cannot disagree — `transactions_amount_sign_check` sees to that —
 * and the sign is what the balance trigger actually added to the account.
 */
export function EntryRowItem({
  entry,
  locale,
  last,
  onPress,
}: {
  entry: {
    id: string;
    amount_paisa: number;
    date: string;
    note: string | null;
    account: { name: string; deleted_at: string | null } | null;
    category: { id: string; name: string; name_ur: string | null; icon: string; tone: number } | null;
  };
  locale: string;
  last?: boolean;
  onPress?: () => void;
}) {
  const palette = usePalette();
  const amount = Number(entry.amount_paisa);

  const title = entry.category
    ? categoryLabel(entry.category as never, locale)
    : entry.note || 'Uncategorised';

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
      <CategoryGlyph icon={entry.category?.icon} tone={entry.category?.tone} size={44} />

      <View style={{ flex: 1, gap: 3 }}>
        <T
          style={{ fontSize: typography.fontSize.base, fontWeight: '600', color: palette.foreground }}
          numberOfLines={1}
        >
          {title}
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 }}>
          <Numeric style={{ fontSize: typography.fontSize.xs, color: palette.faint }}>
            {entry.date}
          </Numeric>
          {entry.account ? (
            <>
              <Text style={{ color: palette.faint, fontSize: typography.fontSize.xs }}>·</Text>
              <T
                style={{ fontSize: typography.fontSize.xs, color: palette.faint, flexShrink: 1 }}
                numberOfLines={1}
              >
                {entry.account.deleted_at ? 'Deleted account' : entry.account.name}
              </T>
            </>
          ) : null}
        </View>
      </View>

      <Money paisa={amount} variant="body" signed showPlus />
    </Pressable>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
