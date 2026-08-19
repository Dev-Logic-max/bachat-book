import type { Tables } from "@/lib/supabase/types";

export type Category = Tables<"categories">;
export type CategoryKind = Category["kind"];

/**
 * The category catalogue, in one place.
 *
 * Two tiers, and which tier a row is in decides who owns it:
 *
 *   PARENTS  (parent_id null, household_id null) are the platform's. Reports,
 *            budgets and the tax surfaces all group by them, so a household
 *            renaming one would break comparisons for everyone. Super admins
 *            only — enforced by RLS and by the shape trigger, not by this file.
 *   CHILDREN are where a household's own habits live. It may add its own, edit
 *            and delete those, and HIDE the platform defaults it has no use for.
 *
 * `household_id === null` marks a platform row at either tier.
 */

export const KIND_ORDER: CategoryKind[] = ["expense", "income", "transfer"];

export const KIND_META: Record<
  CategoryKind,
  { label: string; labelUr: string; hint: string }
> = {
  expense: {
    label: "Expense",
    labelUr: "اخراجات",
    hint: "Money leaving the household",
  },
  income: {
    label: "Income",
    labelUr: "آمدنی",
    hint: "Money coming in",
  },
  transfer: {
    label: "Transfer",
    labelUr: "منتقلی",
    hint: "Money moving between your own accounts",
  },
};

export const isParent = (c: Category) => c.parent_id === null;
export const isPlatform = (c: Category) => c.household_id === null;

/**
 * Catalogue order: `sort_order` first, name as the tie-break.
 *
 * NOT alphabetical. The whole point of seeding a priority is that Food leads and
 * Tax trails — sorting by name would put "Bills" above "Food" and bury the one
 * category most people open the app to reach. Household-made rows all carry the
 * default 1000, so they settle after the seeded ones and then sort by name
 * among themselves.
 */
export function byCatalogueOrder(a: Category, b: Category) {
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  return a.name.localeCompare(b.name);
}

export type CategoryGroup = {
  parent: Category;
  children: Category[];
};

/**
 * Group a flat list into parent → children, in catalogue order at both tiers.
 *
 * `hiddenIds` drops the platform defaults this household has switched off. Pass
 * it for anything the user PICKS from; leave it out for the settings screen,
 * which has to show hidden rows in order to offer them back.
 */
export function groupCatalogue(
  categories: Category[],
  options: {
    kind?: CategoryKind;
    hiddenIds?: ReadonlySet<string>;
    /** Drop retired categories. Off in settings, on in every picker. */
    activeOnly?: boolean;
    /**
     * Float this household's own subcategories to the top of each group.
     *
     * For the two MANAGEMENT surfaces only. Household rows all carry the default
     * `sort_order` of 1000, so in catalogue order they sit behind every seeded
     * one — which is right in a picker, where the seeded priority is the whole
     * point, and wrong on a screen whose job is to manage the handful of rows
     * you made yourself. Pickers must not pass this.
     */
    ownFirstFor?: string;
    /**
     * Keep this household's own switched-off rows even under `activeOnly`.
     *
     * For the MANAGEMENT surfaces. A row you switched off has to stay on the
     * screen that can switch it back on, or the only way to recover it is to
     * create it again — and the name is still taken, so that fails too.
     */
    keepOwnInactiveFor?: string;
  } = {},
): CategoryGroup[] {
  const { kind, hiddenIds, activeOnly, ownFirstFor, keepOwnInactiveFor } = options;

  const pool = categories.filter((c) => {
    if (kind && c.kind !== kind) return false;
    if (activeOnly && !c.is_active) {
      return Boolean(keepOwnInactiveFor) && c.household_id === keepOwnInactiveFor;
    }
    return true;
  });

  return pool
    .filter(isParent)
    .sort(byCatalogueOrder)
    .map((parent) => ({
      parent,
      children: pool
        .filter((c) => c.parent_id === parent.id)
        .filter((c) => !hiddenIds?.has(c.id))
        .sort((a, b) => {
          if (ownFirstFor) {
            const aOwn = a.household_id === ownFirstFor ? 0 : 1;
            const bOwn = b.household_id === ownFirstFor ? 0 : 1;
            if (aOwn !== bOwn) return aOwn - bOwn;
          }
          return byCatalogueOrder(a, b);
        }),
    }));
}

/**
 * IS THIS ROW SWITCHED OFF FOR THIS HOUSEHOLD — the one answer, in one place.
 *
 * "Off" has TWO storage mechanisms, because the two tiers are owned by
 * different people and a household cannot write to a row it does not own:
 *
 *   YOUR OWN subcategory  →  `is_active = false` on the row itself.
 *   A PLATFORM row        →  a row in `household_hidden_categories`.
 *
 * They must never be confused. `household_hidden_categories` carries a trigger
 * that REJECTS your own rows, so pointing the toggle at it for everything made
 * the switch silently fail on exactly the rows you created — the optimistic
 * flip landed, the write bounced, and the icon snapped back.
 *
 * A platform row that the PLATFORM retired (`is_active = false`, no household
 * id) is off for everyone and is not something a household can turn back on.
 */
export function isCategoryOff(
  category: Category,
  hiddenIds?: ReadonlySet<string>,
): boolean {
  return !category.is_active || Boolean(hiddenIds?.has(category.id));
}

/**
 * Whether this household may edit a given row.
 *
 * Platform rows are read-only here whatever the tier — the admin console is
 * where those change. This is presentation only; the database refuses the write
 * regardless, which is the check that actually matters.
 */
export function canHouseholdEdit(category: Category, householdId: string) {
  return category.household_id === householdId;
}

/**
 * A stable, readable primary key for a household's own subcategory.
 *
 * `categories.id` is TEXT and is the primary key, so two households both adding
 * "Chai" would collide — hence the household prefix. The numeric suffix is for
 * the same household adding a name it already used and then deleted, where the
 * bare slug may still be free but need not be.
 *
 * This is generated, never asked for. The Add Category form used to have a
 * "Category Key (ID)" field, which is an implementation detail wearing the
 * clothes of a question.
 */
export function makeCategoryId(
  householdId: string,
  name: string,
  taken: ReadonlySet<string>,
): string {
  const slug =
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "category";

  const prefix = `h_${householdId.slice(0, 8)}_${slug}`;
  if (!taken.has(prefix)) return prefix;

  for (let n = 2; n < 100; n += 1) {
    const candidate = `${prefix}_${n}`;
    if (!taken.has(candidate)) return candidate;
  }

  // Unreachable in practice; still better than returning a key that collides.
  return `${prefix}_${Date.now().toString(36)}`;
}

/**
 * Whether a name is already used under the same parent.
 *
 * Checked against the household's OWN rows and the platform defaults alike: two
 * "Petrol" entries under Transport are indistinguishable in every picker and in
 * every report, whoever created them.
 */
export function isDuplicateName(
  categories: Category[],
  parentId: string,
  name: string,
  ignoreId?: string,
): boolean {
  const needle = name.trim().toLowerCase();
  return categories.some(
    (c) =>
      c.id !== ignoreId &&
      c.parent_id === parentId &&
      c.name.trim().toLowerCase() === needle,
  );
}
