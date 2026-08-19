import React from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Trash2, TriangleAlert } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabase';
import { Button, IconButton } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Surfaces';
import { Money, Numeric } from '../../src/components/ui/Money';
import { CategoryGlyph } from '../../src/components/ui/CategoryGlyph';
import { EmptyState, Skeleton } from '../../src/components/ui/Feedback';
import { T } from '../../src/components/T';
import { usePalette } from '../../src/providers/theme-provider';
import { useSession } from '../../src/providers/auth-provider';
import { useDeleteEntry } from '../../src/hooks/use-entries';
import { categoryLabel, ACCOUNT_TYPE_LABEL, PAYMENT_METHOD_LABEL } from '../../src/lib/ledger';
import { spacing, typography } from '../../src/theme/tokens';
import type { Tables } from '../../types/database';

/**
 * One movement, in full.
 *
 * There is ONE row. The old version of this screen offered "also delete the
 * linked transaction?" because entries and transactions were two tables held
 * together by an optional link — every gap between the copies was a bug, which
 * is why they were merged. Deleting here deletes the movement, full stop.
 */
export default function EntryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { profile } = useSession();
  const locale = profile?.locale ?? 'en';
  const deleteEntry = useDeleteEntry();

  const { data: entry, isLoading, error } = useQuery({
    queryKey: ['entry', id],
    queryFn: async () => {
      if (!id) return null;
      // The embed NAMES its foreign key — `transactions` reaches `accounts`
      // through both `account_id` and `transfer_account_id`, and an unqualified
      // `accounts(*)` answers PGRST201 with no rows at all.
      const { data, error } = await supabase
        .from('transactions')
        .select(
          `*,
           account:accounts!transactions_account_id_fkey(id, name, type, deleted_at),
           category:categories(id, name, name_ur, icon, tone, art_path)`,
        )
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as unknown as Tables<'transactions'> & {
        account: Pick<Tables<'accounts'>, 'id' | 'name' | 'type' | 'deleted_at'> | null;
        category: Pick<
          Tables<'categories'>,
          'id' | 'name' | 'name_ur' | 'icon' | 'tone' | 'art_path'
        > | null;
      };
    },
    enabled: !!id,
  });

  const confirmDelete = () => {
    if (!entry) return;
    Alert.alert(
      'Delete this entry?',
      'The account balance moves back by the same amount. This cannot be undone.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            deleteEntry.mutate(
              { id: entry.id, type: entry.type },
              {
                onSuccess: () => router.back(),
                onError: (err) =>
                  Alert.alert(
                    'Could not delete',
                    err instanceof Error ? err.message : 'Please try again.',
                  ),
              },
            ),
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.lg,
          paddingTop: insets.top + spacing.sm,
          paddingBottom: spacing.md,
        }}
      >
        <IconButton accessibilityLabel="Back" onPress={() => router.back()}>
          <ArrowLeft size={19} color={palette.foreground2} />
        </IconButton>
        <T style={{ fontSize: typography.fontSize.lg, fontWeight: '700', color: palette.foreground }}>
          Entry
        </T>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxxl,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <Card padded={false}>
            <EmptyState
              variant="error"
              icon={<TriangleAlert size={26} color={palette.loss} />}
              title="Could not load this entry"
              body={error instanceof Error ? error.message : undefined}
            />
          </Card>
        ) : isLoading || !entry ? (
          <Card style={{ gap: spacing.md }}>
            <Skeleton width="50%" height={36} />
            <Skeleton width="70%" height={16} />
            <Skeleton width="40%" height={16} />
          </Card>
        ) : (
          <>
            <Card style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxxl }}>
              <CategoryGlyph
                icon={entry.category?.icon}
                tone={entry.category?.tone}
                artPath={entry.category?.art_path}
                size={64}
              />
              <T
                style={{
                  fontSize: typography.fontSize.lg,
                  fontWeight: '700',
                  color: palette.foreground,
                }}
              >
                {entry.category ? categoryLabel(entry.category as never, locale) : 'Uncategorised'}
              </T>
              {/* Coloured by the SIGN, never by `type`. */}
              <Money paisa={entry.amount_paisa} variant="hero" signed showPlus decimals />
            </Card>

            <Card padded={false}>
              <Detail label="Date" value={entry.date} numeric />
              <Detail
                label="Account"
                value={
                  entry.account
                    ? entry.account.deleted_at
                      ? `${entry.account.name} · Deleted`
                      : `${entry.account.name} · ${ACCOUNT_TYPE_LABEL[entry.account.type] ?? entry.account.type}`
                    : '—'
                }
              />
              {entry.payment_method ? (
                <Detail
                  label="Method"
                  value={PAYMENT_METHOD_LABEL[entry.payment_method] ?? entry.payment_method}
                />
              ) : null}
              <Detail label="Note" value={entry.note || '—'} last />
            </Card>

            <Button
              block
              variant="danger"
              title="Delete entry"
              icon={<Trash2 size={18} color="#FFFFFF" />}
              loading={deleteEntry.isPending}
              onPress={confirmDelete}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Detail({
  label,
  value,
  numeric,
  last,
}: {
  label: string;
  value: string;
  numeric?: boolean;
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
      {numeric ? (
        <Numeric
          style={{ fontSize: typography.fontSize.base, fontWeight: '600', color: palette.foreground }}
        >
          {value}
        </Numeric>
      ) : (
        <T
          style={{
            fontSize: typography.fontSize.base,
            fontWeight: '600',
            color: palette.foreground,
            flexShrink: 1,
            textAlign: 'right',
          }}
          numberOfLines={2}
        >
          {value}
        </T>
      )}
    </View>
  );
}
