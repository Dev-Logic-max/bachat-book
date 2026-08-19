/**
 * Transactions — the other FILTERED VIEW of the one ledger.
 *
 *   Transactions = `type = 'transfer'` OR the account is a bank or wallet.
 *
 * Transfers always belong here: moving money between your own accounts is what
 * the screen is for, and BOTH legs must show or the pair reads as money
 * vanishing. Cash spending stays out — it is already on Entries.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSession } from '../providers/auth-provider';
import { isBankingMovement } from '../lib/ledger';
import type { Tables } from '../../types/database';

export type MovementRow = Tables<'transactions'> & {
  account: Pick<Tables<'accounts'>, 'id' | 'name' | 'type' | 'deleted_at'> | null;
  transfer_account: Pick<Tables<'accounts'>, 'id' | 'name'> | null;
  category: Pick<Tables<'categories'>, 'id' | 'name' | 'name_ur' | 'icon' | 'tone'> | null;
};

/**
 * A PostgREST embed must NAME its foreign key when two exist. This query is the
 * exact one that broke on web: `transactions` reaches `accounts` through
 * `account_id` AND `transfer_account_id`, so `accounts(*)` is ambiguous —
 * PostgREST answers `300 / PGRST201` and returns NO rows, and a screen that does
 * not check `error` renders "No transactions found" for every household.
 */
const SELECT = `
  *,
  account:accounts!transactions_account_id_fkey(id, name, type, deleted_at),
  transfer_account:accounts!transactions_transfer_account_id_fkey(id, name),
  category:categories(id, name, name_ur, icon, tone)
`;

export function useTransactions() {
  const { householdId } = useSession();

  return useQuery({
    queryKey: ['transactions', householdId],
    queryFn: async (): Promise<MovementRow[]> => {
      if (!householdId) return [];

      const { data, error } = await supabase
        .from('transactions')
        .select(SELECT)
        .eq('household_id', householdId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rows = (data ?? []) as unknown as MovementRow[];
      // The banking filter needs the embedded account type, so it happens here
      // rather than in the query.
      return rows.filter((row) => isBankingMovement(row, row.account?.type));
    },
    enabled: !!householdId,
  });
}

/**
 * Delete a transfer — BOTH legs.
 *
 * Deleting one leg creates money: the receiving account keeps its credit while
 * the sender never gave it up. The pair is joined by `linked_transaction_id`.
 */
export function useDeleteTransfer() {
  const queryClient = useQueryClient();
  const { householdId } = useSession();

  return useMutation({
    mutationFn: async (transaction: Pick<Tables<'transactions'>, 'id' | 'linked_transaction_id'>) => {
      const ids = [transaction.id, transaction.linked_transaction_id].filter(
        (id): id is string => !!id,
      );

      const { error } = await supabase.from('transactions').delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', householdId] });
      queryClient.invalidateQueries({ queryKey: ['entries', householdId] });
      queryClient.invalidateQueries({ queryKey: ['accounts', householdId] });
    },
  });
}
