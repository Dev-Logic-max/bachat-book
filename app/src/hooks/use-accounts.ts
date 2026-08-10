import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSession } from '../providers/auth-provider';
import type { Tables } from '../../types/database';

export function useAccounts() {
  const { householdId } = useSession();

  return useQuery({
    queryKey: ['accounts', householdId],
    queryFn: async (): Promise<Tables<'accounts'>[]> => {
      if (!householdId) return [];
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('household_id', householdId)
        .eq('is_archived', false)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!householdId,
  });
}

export function useAccountLedger(accountId: string) {
  return useQuery({
    queryKey: ['transactions', accountId],
    queryFn: async (): Promise<Tables<'transactions'>[]> => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('account_id', accountId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });
}
