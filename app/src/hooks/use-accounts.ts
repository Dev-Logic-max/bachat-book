import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSession } from '../providers/auth-provider';
import { isLiveAccount, type Account } from '../lib/ledger';
import type { Tables } from '../../types/database';

/**
 * Every account this household has, INCLUDING archived and deleted ones.
 *
 * Deliberately unfiltered at the query. Three account states mean three
 * different renderings, and every one of them has to be reachable:
 *
 *   `is_archived`  deactivated, reversible — greyed in pickers, out of the total
 *   `deleted_at`   a tombstone, never a real DELETE — past transactions survive
 *                  and render a "Deleted account" tag
 *   `is_locked`    savings you may pay into but never spend from
 *
 * Filtering here is what made an account VANISH from a picker, which reads as
 * data loss and sends the user hunting for money that is still there.
 */
export function useAccounts() {
  const { householdId } = useSession();

  return useQuery({
    queryKey: ['accounts', householdId],
    queryFn: async (): Promise<Account[]> => {
      if (!householdId) return [];
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!householdId,
  });
}

/** Accounts that still count toward what the household holds. */
export function useLiveAccounts(): Account[] {
  const { data = [] } = useAccounts();
  return data.filter(isLiveAccount);
}

/**
 * What the household holds, in paisa.
 *
 * Archived and deleted accounts are out — an archived account's money is not
 * spendable and a deleted one's rows only exist so history still reads.
 */
export function useHeldTotal(): number {
  return useLiveAccounts().reduce((sum, a) => sum + Number(a.balance_paisa), 0);
}

/** The account an entry falls back to when the user picks none. */
export function useCashAccountId(): string | null {
  const accounts = useLiveAccounts();
  return accounts.find((a) => a.type === 'cash')?.id ?? null;
}

/**
 * One account's statement.
 *
 * The embed NAMES its foreign key. `transactions` reaches `accounts` through
 * `account_id` AND `transfer_account_id`, so an unqualified `accounts(*)` is
 * ambiguous — PostgREST answers `300 / PGRST201` and returns no rows at all.
 */
export function useAccountLedger(accountId: string | undefined) {
  return useQuery({
    queryKey: ['account_ledger', accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from('transactions')
        .select(
          `*,
           category:categories(id, name, name_ur, icon, tone),
           transfer_account:accounts!transactions_transfer_account_id_fkey(id, name)`,
        )
        .eq('account_id', accountId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as Array<
        Tables<'transactions'> & {
          category: Pick<Tables<'categories'>, 'id' | 'name' | 'name_ur' | 'icon' | 'tone'> | null;
          transfer_account: Pick<Tables<'accounts'>, 'id' | 'name'> | null;
        }
      >;
    },
    enabled: !!accountId,
  });
}
