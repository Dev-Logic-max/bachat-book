import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';
import { rupeesToPaisa, toDateString } from '../../src/lib/format';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { T } from '../../src/components/T';
import { useCategories } from '../../src/hooks/use-categories';
import { useAccounts } from '../../src/hooks/use-accounts';
import { useCreateQuickEntry } from '../../src/hooks/use-entries';
import { X, ArrowDownLeft, ArrowUpRight, Link as LinkIcon, Tag } from 'lucide-react-native';

export default function NewEntryScreen() {
  const router = useRouter();
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const { data: accounts = [], isLoading: accountsLoading } = useAccounts();
  const createEntryMutation = useCreateQuickEntry();

  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amountRupees, setAmountRupees] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [note, setNote] = useState('');
  const [entryDate, setEntryDate] = useState(toDateString(new Date())); // L9 Karachi date bug fix
  const [linkAccount, setLinkAccount] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Filter categories by type
  const filteredCategories = categories.filter((c) => c.kind === type || c.kind === 'transfer');
  const availableAccounts = accounts.filter((a) => a.allow_entry_link);

  const handleSave = async () => {
    const parsedRupees = parseFloat(amountRupees);
    if (isNaN(parsedRupees) || parsedRupees <= 0) {
      setErrorMsg('Please enter a valid amount');
      return;
    }

    // Determine category name & category_id (L2 fix)
    let categoryName = customCategoryName.trim();
    let catId: string | null = selectedCategoryId;

    if (selectedCategoryId) {
      const found = categories.find((c) => c.id === selectedCategoryId);
      if (found) categoryName = found.name;
    }

    if (!categoryName) {
      categoryName = type === 'income' ? 'Income' : 'Expense';
    }

    setErrorMsg('');

    try {
      const amountPaisa = rupeesToPaisa(parsedRupees);

      // Single atomic save mutation (L2 fix: pre-populates linked_transaction_id on initial insert)
      await createEntryMutation.mutateAsync({
        type,
        amount_paisa: amountPaisa,
        category: categoryName,
        category_id: catId,
        note: note.trim() || null,
        entry_date: entryDate,
        linked_account_id: linkAccount ? selectedAccountId || availableAccounts[0]?.id : null,
      });

      router.back();
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to save entry');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <X size={20} color={colors.light.foreground} />
          </TouchableOpacity>
          <T style={styles.headerTitle}>New Entry</T>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Income / Expense Switcher */}
          <View style={styles.typeSwitcher}>
            <TouchableOpacity
              style={[styles.typeBtn, type === 'expense' ? styles.typeBtnExpense : undefined]}
              onPress={() => {
                setType('expense');
                setSelectedCategoryId(null);
              }}
            >
              <ArrowUpRight size={18} color={type === 'expense' ? colors.light.loss : colors.light.muted} />
              <T style={[styles.typeText, type === 'expense' ? styles.typeTextExpense : undefined]}>Expense</T>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.typeBtn, type === 'income' ? styles.typeBtnIncome : undefined]}
              onPress={() => {
                setType('income');
                setSelectedCategoryId(null);
              }}
            >
              <ArrowDownLeft size={18} color={type === 'income' ? colors.light.gain : colors.light.muted} />
              <T style={[styles.typeText, type === 'income' ? styles.typeTextIncome : undefined]}>Income</T>
            </TouchableOpacity>
          </View>

          {!!errorMsg && (
            <View style={styles.errorBox}>
              <Text style={styles.errorBoxText}>{errorMsg}</Text>
            </View>
          )}

          {/* Amount Field */}
          <Input
            label="Amount (PKR)"
            placeholder="0.00"
            keyboardType="decimal-pad"
            value={amountRupees}
            onChangeText={setAmountRupees}
            style={styles.amountInput}
          />

          {/* DB Category Selector (L2 Fix) */}
          <View style={styles.sectionContainer}>
            <T style={styles.label}>Category</T>
            {categoriesLoading ? (
              <ActivityIndicator size="small" color={colors.light.brass} style={{ alignSelf: 'flex-start' }} />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {filteredCategories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryChip,
                      selectedCategoryId === cat.id ? styles.categoryChipActive : undefined,
                    ]}
                    onPress={() => {
                      setSelectedCategoryId(cat.id);
                      setCustomCategoryName(cat.name);
                    }}
                  >
                    <Tag size={14} color={selectedCategoryId === cat.id ? colors.light.navy900 : colors.light.muted} />
                    <T
                      style={[
                        styles.categoryChipText,
                        selectedCategoryId === cat.id ? styles.categoryChipTextActive : undefined,
                      ]}
                    >
                      {cat.name}
                    </T>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <Input
              placeholder="Or type custom category..."
              value={customCategoryName}
              onChangeText={(val) => {
                setCustomCategoryName(val);
                setSelectedCategoryId(null);
              }}
              containerStyle={{ marginTop: spacing.xs }}
            />
          </View>

          {/* Note */}
          <Input
            label="Note / Details"
            placeholder="Optional description"
            value={note}
            onChangeText={setNote}
          />

          {/* Date */}
          <Input
            label="Date"
            placeholder="YYYY-MM-DD"
            value={entryDate}
            onChangeText={setEntryDate}
          />

          {/* Optional Account Link */}
          {availableAccounts.length > 0 && (
            <View style={styles.linkCard}>
              <TouchableOpacity
                style={styles.linkToggle}
                onPress={() => setLinkAccount(!linkAccount)}
              >
                <View style={styles.linkToggleLeft}>
                  <LinkIcon size={18} color={linkAccount ? colors.light.brassStrong : colors.light.muted} />
                  <T style={styles.linkToggleText}>Link to Bank / Cash Account</T>
                </View>
                <View style={[styles.checkbox, linkAccount ? styles.checkboxActive : undefined]}>
                  {linkAccount && <Text style={styles.checkmark}>✓</Text>}
                </View>
              </TouchableOpacity>

              {linkAccount && (
                <View style={styles.accountSelector}>
                  <T style={styles.selectorLabel}>Select Account:</T>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.accountList}>
                    {availableAccounts.map((acc) => (
                      <TouchableOpacity
                        key={acc.id}
                        style={[
                          styles.accountChip,
                          (selectedAccountId || availableAccounts[0]?.id) === acc.id
                            ? styles.accountChipActive
                            : undefined,
                        ]}
                        onPress={() => setSelectedAccountId(acc.id)}
                      >
                        <T
                          style={[
                            styles.chipText,
                            (selectedAccountId || availableAccounts[0]?.id) === acc.id
                              ? styles.chipTextActive
                              : undefined,
                          ]}
                        >
                          {acc.name}
                        </T>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          )}

          <Button
            title="Save Entry"
            onPress={handleSave}
            loading={createEntryMutation.isPending}
            style={styles.submitBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>
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
  closeBtn: {
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
  scrollContent: {
    padding: spacing.lg,
  },
  typeSwitcher: {
    flexDirection: 'row',
    backgroundColor: colors.light.surfaceSubtle,
    borderRadius: radii.md,
    padding: 4,
    marginBottom: spacing.lg,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    gap: spacing.xs,
  },
  typeBtnExpense: {
    backgroundColor: colors.light.lossSoft,
  },
  typeBtnIncome: {
    backgroundColor: colors.light.gainSoft,
  },
  typeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.light.muted,
  },
  typeTextExpense: {
    color: colors.light.loss,
    fontWeight: typography.fontWeight.bold,
  },
  typeTextIncome: {
    color: colors.light.gain,
    fontWeight: typography.fontWeight.bold,
  },
  amountInput: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    height: 56,
  },
  sectionContainer: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.light.foreground2,
    marginBottom: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    marginRight: spacing.xs,
  },
  categoryChipActive: {
    backgroundColor: colors.light.brassSoft,
    borderColor: colors.light.brass,
  },
  categoryChipText: {
    fontSize: typography.fontSize.xs,
    color: colors.light.foreground,
  },
  categoryChipTextActive: {
    color: colors.light.navy900,
    fontWeight: typography.fontWeight.bold,
  },
  errorBox: {
    backgroundColor: colors.light.lossSoft,
    borderRadius: radii.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorBoxText: {
    color: colors.light.loss,
    fontSize: typography.fontSize.sm,
  },
  linkCard: {
    backgroundColor: colors.light.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.light.border,
    marginBottom: spacing.lg,
  },
  linkToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linkToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  linkToggleText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.light.foreground,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.light.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.light.brass,
    borderColor: colors.light.brass,
  },
  checkmark: {
    color: colors.light.navy900,
    fontSize: 12,
    fontWeight: 'bold',
  },
  accountSelector: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  selectorLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.light.muted,
    marginBottom: spacing.xs,
  },
  accountList: {
    flexDirection: 'row',
  },
  accountChip: {
    backgroundColor: colors.light.surfaceSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    marginRight: spacing.xs,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  accountChipActive: {
    backgroundColor: colors.light.brassSoft,
    borderColor: colors.light.brass,
  },
  chipText: {
    fontSize: typography.fontSize.xs,
    color: colors.light.foreground2,
  },
  chipTextActive: {
    color: colors.light.brassStrong,
    fontWeight: typography.fontWeight.bold,
  },
  submitBtn: {
    marginTop: spacing.md,
  },
});
