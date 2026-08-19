/**
 * The category catalogue — two tiers, different owners.
 *
 *   PARENTS  (parent_id null, household_id null) are the platform's: 26 main
 *            categories, 16 expense / 6 income / 4 transfer. Reports, budgets
 *            and the tax surfaces group by them, so a household renaming one
 *            would break comparisons for everyone.
 *   CHILDREN are where a household's own habits live. It may add its own, edit
 *            and delete those, and HIDE the platform defaults it has no use for.
 *
 * `assert_category_shape` enforces the shape in the database — a household
 * literally cannot create a top-level category, a third tier, or a subcategory
 * whose `kind` disagrees with its parent. The app should not try.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSession } from '../providers/auth-provider';
import {
  byCatalogueOrder,
  categoryLabel,
  type Category,
  type CategoryKind,
} from '../lib/ledger';

export function useCategories() {
  const { householdId } = useSession();

  return useQuery({
    queryKey: ['categories', householdId],
    queryFn: async (): Promise<Category[]> => {
      // Platform rows (household_id null) plus this household's own. Ordering
      // happens in `byCatalogueOrder`, not here: `sort_order` encodes how often
      // a Pakistani household reaches for each category — Food first, Tax last.
      // Alphabetical order opens every picker on "Bakery" and buries the one
      // most sessions start with.
      let query = supabase.from('categories').select('*');

      query = householdId
        ? query.or(`household_id.is.null,household_id.eq.${householdId}`)
        : query.is('household_id', null);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).sort(byCatalogueOrder);
    },
    // The catalogue is 152 rows that change rarely. Long stale time, but not
    // infinite — a subcategory added on another device should turn up.
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * The platform subcategories this household has switched off.
 *
 * Every PICKER filters by this; the Manage-categories screen deliberately does
 * not, because it is the only place they can be switched back on.
 *
 * Returns an empty set while loading. That is the deliberate direction to fail
 * in — a picker briefly showing one category too many is recoverable, whereas
 * one that briefly hides the category you were reaching for reads as data loss.
 */
export function useHiddenCategoryIds(): ReadonlySet<string> {
  const { householdId } = useSession();

  const { data } = useQuery({
    queryKey: ['hidden_categories', householdId],
    queryFn: async (): Promise<string[]> => {
      if (!householdId) return [];
      const { data, error } = await supabase
        .from('household_hidden_categories')
        .select('category_id')
        .eq('household_id', householdId);

      if (error) throw error;
      return (data ?? []).map((r) => r.category_id);
    },
    enabled: !!householdId,
    staleTime: 5 * 60 * 1000,
  });

  return new Set(data ?? []);
}

export type CategoryGroup = {
  parent: Category;
  /** Subcategories, in catalogue order. Empty when the parent is a leaf. */
  children: Category[];
};

/**
 * Group a flat catalogue into parent → children for a two-step picker: choose a
 * main category, then a subcategory under it.
 *
 * What gets STORED is one `category_id` — the subcategory when one is chosen,
 * else the main category. Subcategories exist for the user's own understanding;
 * reports still group by the parent tier either way.
 */
export function useCategoryGroups(options: {
  kind?: CategoryKind;
  /** Off for the manage screen, on for every picker. */
  forPicking?: boolean;
} = {}): CategoryGroup[] {
  const { kind, forPicking = true } = options;
  const { data: categories = [] } = useCategories();
  const hiddenIds = useHiddenCategoryIds();

  const pool = categories.filter((c) => {
    if (kind && c.kind !== kind) return false;
    if (forPicking) {
      // Retired by an admin, or switched off by this household. Both leave the
      // picker and both stay on history, which is why this is filtered here and
      // not in the query — the rows still have to render on old entries.
      if (!c.is_active) return false;
      if (c.parent_id && hiddenIds.has(c.id)) return false;
    }
    return true;
  });

  const parents = pool.filter((c) => !c.parent_id).sort(byCatalogueOrder);
  const byParent = new Map<string, Category[]>();

  for (const c of pool) {
    if (!c.parent_id) continue;
    const list = byParent.get(c.parent_id) ?? [];
    list.push(c);
    byParent.set(c.parent_id, list);
  }

  return parents.map((parent) => ({
    parent,
    children: (byParent.get(parent.id) ?? []).sort(byCatalogueOrder),
  }));
}

/** Resolve a stored `category_id` back to its row, for rendering an entry. */
export function useCategoryLookup(): Map<string, Category> {
  const { data: categories = [] } = useCategories();
  return new Map(categories.map((c) => [c.id, c]));
}

export { categoryLabel };

/**
 * Add a subcategory of the household's own.
 *
 * `kind` is inherited from the parent rather than accepted as an argument —
 * `assert_category_shape` rejects a child whose kind disagrees with its parent,
 * and there is no case where the caller knows better than the parent row.
 */
export function useCreateSubcategory() {
  const queryClient = useQueryClient();
  const { householdId } = useSession();

  return useMutation({
    mutationFn: async (params: { name: string; parent: Category; icon?: string }) => {
      if (!householdId) throw new Error('Unauthenticated');

      const { data, error } = await supabase
        .from('categories')
        .insert({
          // `categories.id` is text, not a generated uuid — the seeded rows use
          // readable slugs and a household's own must not collide with them.
          id: `hh_${householdId.slice(0, 8)}_${Date.now().toString(36)}`,
          name: params.name.trim(),
          parent_id: params.parent.id,
          kind: params.parent.kind,
          household_id: householdId,
          icon: params.icon ?? params.parent.icon,
          tone: params.parent.tone,
          // Household rows all carry the default, so they settle after the
          // seeded ones and then sort by name among themselves.
          sort_order: 1000,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', householdId] });
    },
  });
}

/**
 * Hide a platform default, or switch it back on.
 *
 * Platform rows are SHARED, so they are hidden per household rather than
 * deleted — this household's own history still names them, and so does every
 * other household's.
 */
export function useToggleHiddenCategory() {
  const queryClient = useQueryClient();
  const { householdId } = useSession();

  return useMutation({
    mutationFn: async (params: { categoryId: string; hidden: boolean }) => {
      if (!householdId) throw new Error('Unauthenticated');

      if (params.hidden) {
        const { error } = await supabase
          .from('household_hidden_categories')
          .insert({ household_id: householdId, category_id: params.categoryId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('household_hidden_categories')
          .delete()
          .eq('household_id', householdId)
          .eq('category_id', params.categoryId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hidden_categories', householdId] });
    },
  });
}

/**
 * Delete one of the household's own subcategories.
 *
 * `transactions.category_id` is ON DELETE SET NULL, so entries survive and
 * merely lose their label — but `budgets` and `rules` are ON DELETE CASCADE and
 * go with it silently. The caller should confirm before reaching here.
 */
export function useDeleteSubcategory() {
  const queryClient = useQueryClient();
  const { householdId } = useSession();

  return useMutation({
    mutationFn: async (categoryId: string) => {
      if (!householdId) throw new Error('Unauthenticated');
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId)
        .eq('household_id', householdId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', householdId] });
    },
  });
}
