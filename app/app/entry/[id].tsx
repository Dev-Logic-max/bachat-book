import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';
import { formatRupees } from '../../src/lib/format';
import { Button } from '../../src/components/ui/Button';
import { T } from '../../src/components/T';
import { useDeleteQuickEntry } from '../../src/hooks/use-entries';
import type { Tables } from '../../types/database';
import { ArrowLeft, Trash2, Link as LinkIcon, AlertTriangle } from 'lucide-react-native';

export default function EntryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const deleteEntryMutation = useDeleteQuickEntry();

  const [entry, setEntry] = useState<Tables<'quick_entries'> | null>(null);
  const [loading, setLoading] = useState(true);

  // Delete modal state (MOBILE-PLAN.md §10)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLinked, setDeleteLinked] = useState(true);

  const fetchEntry = async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('quick_entries')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && data) {
        setEntry(data);
      }
    } catch (e) {
      console.warn('Error fetching entry detail:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntry();
  }, [id]);

  const handleDelete = async () => {
    if (!entry) return;

    try {
      await deleteEntryMutation.mutateAsync({
        entryId: entry.id,
        linkedTransactionId: entry.linked_transaction_id,
        deleteLinked,
      });

      setShowDeleteModal(false);
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to delete entry');
    }
  };

  if (loading || !entry) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={20} color={colors.light.foreground} />
          </TouchableOpacity>
        </View>
        <View style={styles.centerContent}>
          <T style={styles.loadingText}>Loading entry...</T>
        </View>
      </SafeAreaView>
    );
  }

  const isIncome = entry.type === 'income';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} color={colors.light.foreground} />
        </TouchableOpacity>

        <T style={styles.headerTitle}>Entry Details</T>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.deleteIconBtn}
            onPress={() => setShowDeleteModal(true)}
          >
            <Trash2 size={18} color={colors.light.loss} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Main Amount Display */}
        <View style={styles.amountCard}>
          <T style={styles.typeLabel}>{isIncome ? 'INCOME' : 'EXPENSE'}</T>
          <Text
            style={[
              styles.amountText,
              { color: isIncome ? colors.light.gain : colors.light.foreground },
            ]}
          >
            {isIncome ? '+' : '-'}{formatRupees(entry.amount_paisa)}
          </Text>
          <T style={styles.dateText}>{entry.entry_date}</T>
        </View>

        {/* Info List */}
        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <T style={styles.detailLabel}>Category</T>
            <T style={styles.detailVal}>{entry.category}</T>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <T style={styles.detailLabel}>Note / Description</T>
            <T style={styles.detailVal}>{entry.note || 'None'}</T>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <T style={styles.detailLabel}>Linked Transaction</T>
            <View style={styles.linkStatusRow}>
              {entry.linked_transaction_id ? (
                <>
                  <LinkIcon size={14} color={colors.light.brassStrong} />
                  <T style={styles.linkedYes}>Linked to Ledger</T>
                </>
              ) : (
                <T style={styles.linkedNo}>Standalone Log</T>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Delete Confirmation Modal (MOBILE-PLAN.md §10) */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconBg}>
              <AlertTriangle size={24} color={colors.light.loss} />
            </View>

            <T style={styles.modalTitle}>Delete Entry?</T>
            <T style={styles.modalSub}>
              "{entry.category} - {formatRupees(entry.amount_paisa)}" on {entry.entry_date}.
            </T>

            {entry.linked_transaction_id && (
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setDeleteLinked(!deleteLinked)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkbox, deleteLinked ? styles.checkboxActive : undefined]}>
                  {deleteLinked && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <T style={styles.checkboxLabel}>Also delete linked bank transaction</T>
              </TouchableOpacity>
            )}

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setShowDeleteModal(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Delete"
                variant="danger"
                onPress={handleDelete}
                loading={deleteEntryMutation.isPending}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.light.lossSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.light.muted,
  },
  content: {
    padding: spacing.lg,
  },
  amountCard: {
    backgroundColor: colors.light.surface,
    borderRadius: radii.card,
    padding: spacing.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.light.border,
    marginBottom: spacing.lg,
  },
  typeLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.light.muted,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 1,
  },
  amountText: {
    fontSize: 36,
    fontWeight: typography.fontWeight.bold,
    marginVertical: spacing.sm,
    fontVariant: ['tabular-nums'],
    writingDirection: 'ltr',
  },
  dateText: {
    fontSize: typography.fontSize.sm,
    color: colors.light.faint,
  },
  detailsCard: {
    backgroundColor: colors.light.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  detailRow: {
    paddingVertical: spacing.sm,
  },
  detailLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.light.muted,
    marginBottom: 2,
  },
  detailVal: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.light.foreground,
  },
  divider: {
    height: 1,
    backgroundColor: colors.light.border,
    marginVertical: spacing.xs,
  },
  linkStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  linkedYes: {
    fontSize: typography.fontSize.sm,
    color: colors.light.brassStrong,
    fontWeight: typography.fontWeight.semibold,
  },
  linkedNo: {
    fontSize: typography.fontSize.sm,
    color: colors.light.muted,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 26, 51, 0.5)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.light.surface,
    borderRadius: radii.modal,
    padding: spacing.xl,
    alignItems: 'center',
  },
  modalIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.light.lossSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.navy900,
  },
  modalSub: {
    fontSize: typography.fontSize.sm,
    color: colors.light.muted,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.light.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.light.loss,
    borderColor: colors.light.loss,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.light.foreground,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
});
