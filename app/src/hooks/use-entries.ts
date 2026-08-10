import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../lib/supabase';
import { useSession } from '../providers/auth-provider';
import { enqueueAction, generateClientUuid, isPermanentError } from '../lib/outbox';
import type { Tables, TablesInsert } from '../../types/database';

/**
 * A write that failed for a retryable reason belongs in the outbox, not on the
 * floor. `NetInfo.fetch()` reporting "connected" is a snapshot, not a guarantee
 * — the request can still die in flight, which on an intermittent connection is
 * the common case rather than the edge case.
 */
function isTransient(error: unknown): boolean {
  return !isPermanentError(error);
}

export function useQuickEntries() {
  const { householdId } = useSession();

  return useQuery({
    queryKey: ['quick_entries', householdId],
    queryFn: async (): Promise<Tables<'quick_entries'>[]> => {
      if (!householdId) return [];
      const { data, error } = await supabase
        .from('quick_entries')
        .select('*')
        .eq('household_id', householdId)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!householdId,
  });
}

export function useCreateQuickEntry() {
  const queryClient = useQueryClient();
  const { user, householdId } = useSession();

  return useMutation({
    mutationFn: async (params: {
      type: 'income' | 'expense';
      amount_paisa: number;
      category: string;
      category_id?: string | null;
      note?: string | null;
      entry_date: string;
      linked_account_id?: string | null;
    }) => {
      if (!user || !householdId) throw new Error('Unauthenticated');

      const entryId = generateClientUuid();
      let transactionId: string | null = null;

      const state = await NetInfo.fetch();

      // If user linked an account, create matching transaction
      if (params.linked_account_id) {
        transactionId = generateClientUuid();
        const signedAmount = params.type === 'income' ? params.amount_paisa : -params.amount_paisa;

        const txPayload: TablesInsert<'transactions'> = {
          id: transactionId,
          household_id: householdId,
          account_id: params.linked_account_id,
          category_id: params.category_id || null,
          type: params.type === 'income' ? 'income' : 'expense',
          amount_paisa: signedAmount,
          date: params.entry_date,
          note: params.note || `Quick entry: ${params.category}`,
        };

        if (state.isConnected) {
          const { error: txError } = await supabase.from('transactions').insert(txPayload);
          // A transient failure here must not lose the write. NetInfo said
          // "connected", but connectivity can drop between the check and the
          // request — the normal case on a Pakistani mobile connection.
          if (txError) {
            if (isTransient(txError)) {
              await enqueueAction('transactions', 'INSERT', txPayload, householdId, transactionId);
            } else {
              throw txError;
            }
          }
        } else {
          await enqueueAction('transactions', 'INSERT', txPayload, householdId, transactionId);
        }
      }

      // Quick Entry payload (L2 fix: pre-populate linked_transaction_id in initial insert!)
      const entryPayload: TablesInsert<'quick_entries'> = {
        id: entryId,
        user_id: user.id,
        household_id: householdId,
        type: params.type,
        amount_paisa: params.amount_paisa,
        category: params.category,
        category_id: params.category_id || null,
        note: params.note || null,
        entry_date: params.entry_date,
        linked_transaction_id: transactionId,
      };

      if (state.isConnected) {
        const { data, error } = await supabase
          .from('quick_entries')
          .insert(entryPayload)
          .select()
          .single();

        if (error) {
          if (isTransient(error)) {
            await enqueueAction('quick_entries', 'INSERT', entryPayload, householdId, entryId);
            return { ...entryPayload, created_at: new Date().toISOString() } as Tables<'quick_entries'>;
          }

          // The transaction landed and already moved the account balance, but
          // the entry it belongs to was rejected — assert_entry_link_valid, a
          // bad category_id FK, an RLS refusal. Leaving it there is a phantom
          // balance change with nothing on any screen to explain it, and no
          // way for the user to find or undo it. Compensate before rethrowing.
          if (transactionId) {
            await supabase.from('transactions').delete().eq('id', transactionId);
          }
          throw error;
        }
        return data;
      } else {
        await enqueueAction('quick_entries', 'INSERT', entryPayload, householdId, entryId);
        return {
          ...entryPayload,
          created_at: new Date().toISOString(),
        } as Tables<'quick_entries'>;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick_entries', householdId] });
      queryClient.invalidateQueries({ queryKey: ['accounts', householdId] });
    },
  });
}

export function useDeleteQuickEntry() {
  const queryClient = useQueryClient();
  const { householdId } = useSession();

  return useMutation({
    mutationFn: async (params: { entryId: string; linkedTransactionId?: string | null; deleteLinked?: boolean }) => {
      if (!householdId) throw new Error('Unauthenticated');

      const state = await NetInfo.fetch();

      // Deleting a transaction moves an account balance through the balance
      // trigger. A swallowed error here tells the user their money moved when it
      // did not — every one of these calls must be checked.
      const remove = async (table: 'transactions' | 'quick_entries', id: string) => {
        if (!state.isConnected) {
          await enqueueAction(table, 'DELETE', { id }, householdId);
          return;
        }
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (!error) return;
        if (isTransient(error)) {
          await enqueueAction(table, 'DELETE', { id }, householdId);
          return;
        }
        throw error;
      };

      if (params.linkedTransactionId && params.deleteLinked) {
        // Transaction first. quick_entries.linked_transaction_id is
        // ON DELETE SET NULL, so if the second delete fails the entry survives
        // as a valid unlinked row rather than pointing at a row that is gone.
        await remove('transactions', params.linkedTransactionId);
      }

      await remove('quick_entries', params.entryId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick_entries', householdId] });
      queryClient.invalidateQueries({ queryKey: ['accounts', householdId] });
    },
  });
}
