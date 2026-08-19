import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, TriangleAlert, Users } from 'lucide-react-native';
import { Screen } from '../../src/components/ui/Screen';
import { Card, NavyPanel, SectionHeader } from '../../src/components/ui/Surfaces';
import { Money, Numeric } from '../../src/components/ui/Money';
import { EmptyState, Skeleton } from '../../src/components/ui/Feedback';
import { IconButton } from '../../src/components/ui/Button';
import { T } from '../../src/components/T';
import { usePalette } from '../../src/providers/theme-provider';
import { supabase } from '../../src/lib/supabase';
import { spacing, typography } from '../../src/theme/tokens';
import type { Tables } from '../../types/database';

export default function CommitteeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const palette = usePalette();
  const insets = useSafeAreaInsets();

  const { data: committee, isLoading, error } = useQuery({
    queryKey: ['committee', id],
    queryFn: async (): Promise<Tables<'committees'> | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('committees')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const potPaisa = committee
    ? Number(committee.monthly_contribution_paisa) * committee.total_members
    : 0;

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.lg,
          paddingTop: insets.top + spacing.sm,
          paddingBottom: spacing.sm,
        }}
      >
        <IconButton accessibilityLabel="Back" onPress={() => router.back()}>
          <ArrowLeft size={19} color={palette.foreground2} />
        </IconButton>
        <T
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: typography.fontSize.lg,
            fontWeight: '700',
            color: palette.foreground,
          }}
          numberOfLines={1}
        >
          {committee?.name ?? 'Committee'}
        </T>
        <View style={{ width: 40 }} />
      </View>

      <Screen topInset={false}>
        {error ? (
          <Card padded={false}>
            <EmptyState
              variant="error"
              icon={<TriangleAlert size={26} color={palette.loss} />}
              title="Could not load this committee"
              body={error instanceof Error ? error.message : undefined}
            />
          </Card>
        ) : isLoading || !committee ? (
          <Card style={{ gap: spacing.md }}>
            <Skeleton width="60%" height={32} />
            <Skeleton width="80%" height={16} />
          </Card>
        ) : (
          <>
            <NavyPanel>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Users size={15} color={palette.onNavyMuted} />
                <T style={{ fontSize: typography.fontSize.sm, color: palette.onNavyMuted, fontWeight: '600' }}>
                  The pot each month
                </T>
              </View>
              <Money
                paisa={potPaisa}
                variant="hero"
                color={palette.onNavy}
                style={{ marginTop: spacing.sm }}
              />
              <T
                style={{
                  fontSize: typography.fontSize.sm,
                  color: palette.onNavyMuted,
                  marginTop: spacing.md,
                }}
              >
                {committee.payout_received
                  ? 'You have taken your turn.'
                  : `Your turn is month ${committee.my_payout_month} of ${committee.total_members}.`}
              </T>
            </NavyPanel>

            <View style={{ marginTop: spacing.xxl }}>
              <SectionHeader title="Terms" />
              <Card padded={false}>
                <DetailRow label="You pay each month">
                  <Money paisa={committee.monthly_contribution_paisa} variant="body" />
                </DetailRow>
                <DetailRow label="Members">
                  <Numeric
                    style={{ fontSize: typography.fontSize.base, fontWeight: '600', color: palette.foreground }}
                  >
                    {String(committee.total_members)}
                  </Numeric>
                </DetailRow>
                <DetailRow label="Started">
                  <Numeric
                    style={{ fontSize: typography.fontSize.base, fontWeight: '600', color: palette.foreground }}
                  >
                    {committee.start_date}
                  </Numeric>
                </DetailRow>
                <DetailRow label="Your payout" last>
                  <T
                    style={{
                      fontSize: typography.fontSize.base,
                      fontWeight: '600',
                      color: committee.payout_received ? palette.gain : palette.warn,
                    }}
                  >
                    {committee.payout_received ? 'Received' : 'Not yet'}
                  </T>
                </DetailRow>
              </Card>
            </View>

            {committee.notes ? (
              <View style={{ marginTop: spacing.xxl }}>
                <SectionHeader title="Notes" />
                <Card>
                  <T style={{ fontSize: typography.fontSize.sm, color: palette.foreground2, lineHeight: 20 }}>
                    {committee.notes}
                  </T>
                </Card>
              </View>
            ) : null}
          </>
        )}
      </Screen>
    </View>
  );
}

function DetailRow({
  label,
  children,
  last,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  const palette = usePalette();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.lg,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.lg,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: palette.border,
      }}
    >
      <T style={{ fontSize: typography.fontSize.sm, color: palette.muted }}>{label}</T>
      {children}
    </View>
  );
}
