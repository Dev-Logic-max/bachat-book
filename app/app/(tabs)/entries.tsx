import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Inbox, TriangleAlert } from 'lucide-react-native';
import { Screen } from '../../src/components/ui/Screen';
import { Card, Segmented, StatTile } from '../../src/components/ui/Surfaces';
import { Money } from '../../src/components/ui/Money';
import { EmptyState, Reveal, SkeletonRow } from '../../src/components/ui/Feedback';
import { T } from '../../src/components/T';
import { usePalette } from '../../src/providers/theme-provider';
import { useSession } from '../../src/providers/auth-provider';
import { useEntries } from '../../src/hooks/use-entries';
import { flowTotals } from '../../src/lib/ledger';
import { spacing, typography } from '../../src/theme/tokens';
import { EntryRowItem } from './index';

type Filter = 'all' | 'income' | 'expense';

export default function EntriesScreen() {
  const palette = usePalette();
  const router = useRouter();
  const { profile } = useSession();
  const [filter, setFilter] = useState<Filter>('all');

  const { data: entries = [], isLoading, error, refetch, isRefetching } = useEntries();
  const locale = profile?.locale ?? 'en';

  // Filter by the SIGN, not by `type`. The sign is what the balance trigger
  // used, and the check constraint guarantees the two agree.
  const shown = useMemo(() => {
    if (filter === 'all') return entries;
    return entries.filter((e) =>
      filter === 'income' ? Number(e.amount_paisa) >= 0 : Number(e.amount_paisa) < 0,
    );
  }, [entries, filter]);

  const totals = useMemo(() => flowTotals(entries), [entries]);

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
        Entries
      </T>
      <T style={{ fontSize: typography.fontSize.sm, color: palette.muted, marginBottom: spacing.xl }}>
        Everything that came in and went out
      </T>

      <Reveal>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <StatTile label="TOTAL IN" tone={5}>
            <Money paisa={totals.inPaisa} variant="title" compact color={palette.gain} />
          </StatTile>
          <StatTile label="TOTAL OUT" tone={6}>
            <Money paisa={totals.outPaisa} variant="title" compact color={palette.loss} />
          </StatTile>
        </View>
      </Reveal>

      <Segmented
        style={{ marginTop: spacing.lg, marginBottom: spacing.lg }}
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'All' },
          { value: 'income', label: 'Income' },
          { value: 'expense', label: 'Expense' },
        ]}
      />

      <Card padded={false}>
        {error ? (
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
            <SkeletonRow />
          </View>
        ) : shown.length === 0 ? (
          <EmptyState
            icon={<Inbox size={26} color={palette.muted} />}
            title={filter === 'all' ? 'Nothing logged yet' : `No ${filter} entries`}
            body={
              filter === 'all'
                ? 'Tap the + button below to log your first expense or income.'
                : 'Switch the filter above to see everything else.'
            }
          />
        ) : (
          shown.map((entry, i) => (
            <EntryRowItem
              key={entry.id}
              entry={entry}
              locale={locale}
              last={i === shown.length - 1}
              onPress={() => router.push(`/entry/${entry.id}` as never)}
            />
          ))
        )}
      </Card>
    </Screen>
  );
}
