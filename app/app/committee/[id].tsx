import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';
import { formatRupees } from '../../src/lib/format';
import { T } from '../../src/components/T';
import type { Tables } from '../../types/database';
import { ArrowLeft, Users, Info } from 'lucide-react-native';

export default function CommitteeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [committee, setCommittee] = useState<Tables<'committees'> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('committees')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) setCommittee(data);
        setLoading(false);
      });
  }, [id]);

  if (loading || !committee) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={20} color={colors.light.foreground} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} color={colors.light.foreground} />
        </TouchableOpacity>
        <T style={styles.headerTitle}>{committee.name}</T>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Users size={24} color={colors.light.brassStrong} />
            <T style={styles.cardTitle}>{committee.name}</T>
          </View>

          <View style={styles.row}>
            <T style={styles.label}>Monthly Contribution</T>
            <Text style={styles.val}>{formatRupees(committee.monthly_contribution_paisa)}</Text>
          </View>

          <View style={styles.row}>
            <T style={styles.label}>Total Members</T>
            <Text style={styles.val}>{committee.total_members}</Text>
          </View>

          <View style={styles.row}>
            <T style={styles.label}>My Payout Month</T>
            <Text style={styles.val}>Month {committee.my_payout_month}</Text>
          </View>

          <View style={styles.row}>
            <T style={styles.label}>Payout Status</T>
            <T style={[styles.val, { color: committee.payout_received ? colors.light.gain : colors.light.warn }]}>
              {committee.payout_received ? 'Received' : 'Pending'}
            </T>
          </View>

          {committee.notes && (
            <View style={styles.notesBox}>
              <T style={styles.label}>Notes</T>
              <T style={styles.notesText}>{committee.notes}</T>
            </View>
          )}
        </View>

        <View style={styles.infoBox}>
          <Info size={18} color={colors.light.navy900} />
          <T style={styles.infoText}>
            Committee details are read-only on mobile (v1). Member schedule management and XIRR benchmarks are managed via the web portal.
          </T>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.light.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.navy900,
  },
  content: {
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.light.surface,
    borderRadius: radii.card,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    marginBottom: spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  cardTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.navy900,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  label: {
    fontSize: typography.fontSize.xs,
    color: colors.light.muted,
  },
  val: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.light.foreground,
    fontVariant: ['tabular-nums'],
    writingDirection: 'ltr',
  },
  notesBox: {
    marginTop: spacing.md,
  },
  notesText: {
    fontSize: typography.fontSize.sm,
    color: colors.light.foreground2,
    marginTop: 4,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.brassSoft,
    padding: spacing.md,
    borderRadius: radii.md,
    gap: spacing.sm,
  },
  infoText: {
    fontSize: typography.fontSize.xs,
    color: colors.light.navy900,
    flex: 1,
    lineHeight: 18,
  },
});
