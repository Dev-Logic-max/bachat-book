import React from 'react';
import { Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { CircleCheck, Clock, TriangleAlert, Users } from 'lucide-react-native';
import { Screen } from '../../src/components/ui/Screen';
import { Card, SectionHeader, ToneCard } from '../../src/components/ui/Surfaces';
import { Money, Numeric } from '../../src/components/ui/Money';
import { EmptyState, Reveal, SkeletonRow } from '../../src/components/ui/Feedback';
import { T } from '../../src/components/T';
import { usePalette } from '../../src/providers/theme-provider';
import { useSession } from '../../src/providers/auth-provider';
import { supabase } from '../../src/lib/supabase';
import { radii, spacing, toneOf, typography } from '../../src/theme/tokens';
import type { Tables } from '../../types/database';

/**
 * Committee / BC — the rotating savings circle most Pakistani households run.
 *
 * Read-only on the phone for now: creating one and recording a payout writes
 * real ledger rows, and that belongs behind the same checks the web app has.
 */
export default function CommitteesScreen() {
  const palette = usePalette();
  const { householdId } = useSession();

  const { data: committees = [], isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['committees', householdId],
    queryFn: async (): Promise<Tables<'committees'>[]> => {
      if (!householdId) return [];
      const { data, error } = await supabase
        .from('committees')
        .select('*')
        .eq('household_id', householdId)
        .order('start_date', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!householdId,
  });

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
        Committee
      </T>
      <T style={{ fontSize: typography.fontSize.sm, color: palette.muted, marginBottom: spacing.xl }}>
        Your BC circles and when your payout lands
      </T>

      {error ? (
        <Card padded={false}>
          <EmptyState
            variant="error"
            icon={<TriangleAlert size={26} color={palette.loss} />}
            title="Could not load your committees"
            body={error instanceof Error ? error.message : 'Pull down to try again.'}
          />
        </Card>
      ) : isLoading ? (
        <Card>
          <SkeletonRow />
          <SkeletonRow />
        </Card>
      ) : committees.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            icon={<Users size={26} color={palette.muted} />}
            title="No committees yet"
            body="A committee is a rotating circle — everyone pays in monthly and one member takes the pot each month. Add yours on the web app."
          />
        </Card>
      ) : (
        <View style={{ gap: spacing.md }}>
          {committees.map((committee, i) => (
            <Reveal key={committee.id} index={i}>
              <CommitteeCard committee={committee} />
            </Reveal>
          ))}
        </View>
      )}

      <View style={{ marginTop: spacing.xxl }}>
        <SectionHeader title="Making changes" />
        <Card>
          <T style={{ fontSize: typography.fontSize.sm, color: palette.muted, lineHeight: 20 }}>
            Creating a committee and recording a payout both write real ledger rows, so they stay on
            the web app until that path is built here.
          </T>
        </Card>
      </View>
    </Screen>
  );
}

function CommitteeCard({ committee }: { committee: Tables<'committees'> }) {
  const palette = usePalette();
  const received = committee.payout_received;
  const role = toneOf(palette, received ? 3 : 1);

  // What the whole circle pays in over its life, from this member's seat.
  const potPaisa = Number(committee.monthly_contribution_paisa) * committee.total_members;

  return (
    <ToneCard tone={received ? 3 : 1}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radii.md,
            backgroundColor: palette.surface,
            borderWidth: 1,
            borderColor: role.edge,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Users size={20} color={role.ink} />
        </View>

        <View style={{ flex: 1 }}>
          <T
            style={{ fontSize: typography.fontSize.base, fontWeight: '700', color: palette.foreground }}
            numberOfLines={1}
          >
            {committee.name}
          </T>
          <T style={{ fontSize: typography.fontSize.xs, color: palette.muted, marginTop: 2 }}>
            {committee.total_members} members · your turn is month {committee.my_payout_month}
          </T>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: spacing.sm + 2,
            paddingVertical: 4,
            borderRadius: radii.full,
            backgroundColor: palette.surface,
            borderWidth: 1,
            borderColor: role.edge,
          }}
        >
          {received ? (
            <CircleCheck size={11} color={palette.gain} />
          ) : (
            <Clock size={11} color={palette.warn} />
          )}
          <Text
            style={{
              fontSize: 10,
              fontWeight: '700',
              color: received ? palette.gain : palette.warn,
            }}
          >
            {received ? 'RECEIVED' : 'WAITING'}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.xl, marginTop: spacing.xl }}>
        <View style={{ flex: 1 }}>
          <T style={{ fontSize: typography.fontSize.xs, color: palette.muted }}>Every month</T>
          <Money paisa={committee.monthly_contribution_paisa} variant="body" />
        </View>
        <View style={{ flex: 1 }}>
          <T style={{ fontSize: typography.fontSize.xs, color: palette.muted }}>The pot</T>
          <Money paisa={potPaisa} variant="body" compact />
        </View>
        <View style={{ flex: 1 }}>
          <T style={{ fontSize: typography.fontSize.xs, color: palette.muted }}>Started</T>
          <Numeric
            style={{ fontSize: typography.fontSize.base, fontWeight: '600', color: palette.foreground }}
          >
            {committee.start_date}
          </Numeric>
        </View>
      </View>
    </ToneCard>
  );
}
