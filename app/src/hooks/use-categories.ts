import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSession } from '../providers/auth-provider';
import type { Tables } from '../../types/database';

export function useCategories() {
  const { householdId } = useSession();

  return useQuery({
    queryKey: ['categories', householdId],
    queryFn: async (): Promise<Tables<'categories'>[]> => {
      // Fetch system categories (household_id IS NULL) + household specific categories
      let query = supabase.from('categories').select('*').order('name', { ascending: true });

      if (householdId) {
        query = query.or(`household_id.is.null,household_id.eq.${householdId}`);
      } else {
        query = query.is('household_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
  });
}
