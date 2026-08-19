import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowDownLeft, ArrowUpRight, Check, X } from 'lucide-react-native';
import { Button, IconButton } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { Card, ChipRow, Chip } from '../../src/components/ui/Surfaces';
import { CategoryGlyph } from '../../src/components/ui/CategoryGlyph';
import { NUMERIC } from '../../src/components/ui/Money';
import { T } from '../../src/components/T';
import { usePalette } from '../../src/providers/theme-provider';
import { useSession } from '../../src/providers/auth-provider';
import { useCreateEntry } from '../../src/hooks/use-entries';
import { useCategoryGroups, categoryLabel } from '../../src/hooks/use-categories';
import { useAccounts, useCashAccountId } from '../../src/hooks/use-accounts';
import { accountBlockedReason, ACCOUNT_TYPE_LABEL } from '../../src/lib/ledger';
import { rupeesToPaisa, toDateString } from '../../src/lib/format';
import { radii, spacing, toneOf, typography } from '../../src/theme/tokens';

type Direction = 'expense' | 'income';

export default function NewEntryScreen() {
  const palette = usePalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useSession();
  const locale = profile?.locale ?? 'en';

  const [direction, setDirection] = useState<Direction>('expense');
  const [amount, setAmount] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [childId, setChildId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [date] = useState(() => toDateString(new Date()));

  const groups = useCategoryGroups({ kind: direction });
  const { data: accounts = [] } = useAccounts();
  const cashAccountId = useCashAccountId();
  const createEntry = useCreateEntry();

  // DERIVED, never a `setAccountId` in an effect once accounts load — that is a
  // synchronous setState in useEffect and React Compiler rejects it. The form
  // defaults to cash; `ensureCashAccount()` is the submit-time backstop for a
  // household that has no cash account yet.
  const effectiveAccountId = accountId ?? cashAccountId;

  const activeGroup = useMemo(
    () => groups.find((g) => g.parent.id === parentId) ?? null,
    [groups, parentId],
  );

  const amountPaisa = rupeesToPaisa(Number(amount.replace(/,/g, '')) || 0);
  const canSave = amountPaisa > 0 && !createEntry.isPending;

  const selectedAccount = accounts.find((a) => a.id === effectiveAccountId);
  const blocked = selectedAccount ? accountBlockedReason(selectedAccount, direction) : null;

  const submit = () => {
    if (!canSave) return;
    if (blocked) {
      Alert.alert(
        `That account is ${blocked.toLowerCase()}`,
        'Pick another account for this entry.',
      );
      return;
    }

    createEntry.mutate(
      {
        type: direction,
        // POSITIVE magnitude. The sign is applied once, in `toSignedPaisa`.
        amount_paisa: amountPaisa,
        category_id: childId ?? parentId,
        account_id: effectiveAccountId,
        note: note.trim() || null,
        entry_date: date,
      },
      {
        onSuccess: () => router.back(),
        onError: (err) =>
          Alert.alert('Could not save', err instanceof Error ? err.message : 'Please try again.'),
      },
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      {/* ---- Header --------------------------------------------------- */}
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
        <IconButton accessibilityLabel="Close" onPress={() => router.back()}>
          <X size={19} color={palette.foreground2} />
        </IconButton>
        <T style={{ fontSize: typography.fontSize.lg, fontWeight: '700', color: palette.foreground }}>
          New entry
        </T>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xxxl * 2,
            gap: spacing.xl,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ---- Direction ------------------------------------------- */}
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <DirectionButton
              label="Money out"
              active={direction === 'expense'}
              tint={palette.loss}
              icon={<ArrowUpRight size={18} color={direction === 'expense' ? '#FFF' : palette.loss} strokeWidth={2.6} />}
              onPress={() => {
                setDirection('expense');
                setParentId(null);
                setChildId(null);
              }}
            />
            <DirectionButton
              label="Money in"
              active={direction === 'income'}
              tint={palette.gain}
              icon={<ArrowDownLeft size={18} color={direction === 'income' ? '#FFF' : palette.gain} strokeWidth={2.6} />}
              onPress={() => {
                setDirection('income');
                setParentId(null);
                setChildId(null);
              }}
            />
          </View>

          {/* ---- Amount ---------------------------------------------- */}
          <Card>
            <T style={{ fontSize: typography.fontSize.sm, color: palette.muted, fontWeight: '600' }}>
              Amount
            </T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
              <Text
                style={[
                  NUMERIC,
                  { fontSize: 22, fontWeight: '700', color: palette.muted },
                ]}
              >
                Rs
              </Text>
              <Input
                containerStyle={{ flex: 1 }}
                style={{ fontSize: 34, fontWeight: '800', height: 56 }}
                numeric
                value={amount}
                onChangeText={(text) => setAmount(text.replace(/[^0-9.]/g, ''))}
                placeholder="0"
                keyboardType="decimal-pad"
                autoFocus
              />
            </View>
          </Card>

          {/* ---- Category, two steps --------------------------------- */}
          <View style={{ gap: spacing.md }}>
            <T style={{ fontSize: typography.fontSize.sm, fontWeight: '700', color: palette.foreground }}>
              Category
            </T>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {groups.map((group) => {
                const active = group.parent.id === parentId;
                const role = toneOf(palette, group.parent.tone);
                return (
                  <Pressable
                    key={group.parent.id}
                    onPress={() => {
                      setParentId(active ? null : group.parent.id);
                      setChildId(null);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                      paddingVertical: spacing.sm,
                      paddingHorizontal: spacing.md,
                      borderRadius: radii.full,
                      backgroundColor: active ? role.ink : role.fill,
                      borderWidth: 1,
                      borderColor: active ? role.ink : role.edge,
                    }}
                  >
                    <CategoryGlyph
                      icon={group.parent.icon}
                      tone={group.parent.tone}
                      artPath={group.parent.art_path}
                      size={26}
                    />
                    <T
                      style={{
                        fontSize: typography.fontSize.sm,
                        fontWeight: '600',
                        color: active ? '#FFFFFF' : palette.foreground,
                      }}
                    >
                      {categoryLabel(group.parent, locale)}
                    </T>
                  </Pressable>
                );
              })}
            </View>

            {/* Subcategories exist for the user's own understanding. What gets
                STORED is one category_id — the subcategory when chosen, else
                the main — so reports are unaffected either way. */}
            {activeGroup && activeGroup.children.length > 0 ? (
              <ChipRow>
                {activeGroup.children.map((child) => (
                  <Chip
                    key={child.id}
                    label={categoryLabel(child, locale)}
                    tone={child.tone}
                    selected={child.id === childId}
                    onPress={() => setChildId(child.id === childId ? null : child.id)}
                  />
                ))}
              </ChipRow>
            ) : null}
          </View>

          {/* ---- Account --------------------------------------------- */}
          <View style={{ gap: spacing.md }}>
            <T style={{ fontSize: typography.fontSize.sm, fontWeight: '700', color: palette.foreground }}>
              Paid from
            </T>
            <ChipRow>
              {accounts.map((account) => {
                const reason = accountBlockedReason(account, direction);
                const selected = account.id === effectiveAccountId;
                return (
                  <Pressable
                    key={account.id}
                    // Unavailable accounts are SHOWN, greyed, with the reason —
                    // never hidden. The database enforces the rule anyway
                    // (`assert_account_accepts_movement`); this is the
                    // explanation, not the protection.
                    disabled={!!reason}
                    onPress={() => setAccountId(account.id)}
                    style={{
                      paddingHorizontal: spacing.lg,
                      paddingVertical: spacing.md - 2,
                      borderRadius: radii.full,
                      backgroundColor: selected ? palette.navy900 : palette.surface,
                      borderWidth: 1,
                      borderColor: selected ? palette.navy900 : palette.border,
                      opacity: reason ? 0.5 : 1,
                    }}
                  >
                    <T
                      style={{
                        fontSize: typography.fontSize.sm,
                        fontWeight: '600',
                        color: selected ? palette.onNavy : palette.foreground,
                      }}
                    >
                      {account.name}
                      {reason ? ` · ${reason}` : ''}
                    </T>
                    <T
                      style={{
                        fontSize: 10,
                        color: selected ? palette.onNavyMuted : palette.faint,
                        marginTop: 1,
                      }}
                    >
                      {ACCOUNT_TYPE_LABEL[account.type] ?? account.type}
                    </T>
                  </Pressable>
                );
              })}
            </ChipRow>
            {accounts.length === 0 ? (
              <T style={{ fontSize: typography.fontSize.xs, color: palette.muted }}>
                No accounts yet — this will be logged against Cash, which is created for you.
              </T>
            ) : null}
          </View>

          {/* ---- Note ------------------------------------------------- */}
          <Input
            label="Note"
            placeholder="What was this for?"
            value={note}
            onChangeText={setNote}
            hint={`Dated ${date}`}
          />
        </ScrollView>

        {/* ---- Save --------------------------------------------------- */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: Math.max(insets.bottom, spacing.lg),
            borderTopWidth: 1,
            borderTopColor: palette.border,
            backgroundColor: palette.surface,
          }}
        >
          <Button
            block
            size="lg"
            title={direction === 'expense' ? 'Save expense' : 'Save income'}
            icon={<Check size={19} color={palette.onNavy} strokeWidth={2.6} />}
            disabled={!canSave}
            loading={createEntry.isPending}
            onPress={submit}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function DirectionButton({
  label,
  active,
  tint,
  icon,
  onPress,
}: {
  label: string;
  active: boolean;
  tint: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.lg,
        borderRadius: radii.lg,
        backgroundColor: active ? tint : palette.surface,
        borderWidth: 1.5,
        borderColor: active ? tint : palette.border,
        opacity: pressed ? 0.88 : 1,
      })}
    >
      {icon}
      <T
        style={{
          fontSize: typography.fontSize.base,
          fontWeight: '700',
          color: active ? '#FFFFFF' : palette.foreground,
        }}
      >
        {label}
      </T>
    </Pressable>
  );
}
