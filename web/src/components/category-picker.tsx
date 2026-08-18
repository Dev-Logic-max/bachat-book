"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import { Tags } from "lucide-react";
import { RichSelect } from "@/components/ui/select";
import { CategoriesModal } from "@/components/categories-modal";
import { CategoryArt, CategoryIcon, categoryLabel } from "@/components/category-icon";
import { byCatalogueOrder, type Category, type CategoryKind } from "@/lib/categories";

import type { SelectOption } from "@/components/ui/select";

/**
 * Two fields, not one dropdown.
 *
 * It used to be a single 150-option list with the parents doubling as group
 * headings, which meant scrolling past every subcategory of Food to reach Bills.
 * The two tiers answer different questions and now look like it:
 *
 *   MAIN CATEGORY is the one that matters. It is what reports, budgets and the
 *   tax surfaces group by, it is set by the platform so those figures compare
 *   across households, and it is required.
 *   SUBCATEGORY is optional and, deliberately, carries no behaviour. It is a
 *   finer label for the user's own recall — "Kiryana" rather than just "Food" —
 *   and nothing in the product branches on it.
 *
 * WHAT IS STORED IS THE LEAF. `transactions.category_id` takes the subcategory
 * when one is chosen and the main category otherwise, because the leaf is
 * strictly more information: the parent is always one join away, so grouping by
 * main category keeps working either way. Storing the parent and dropping the
 * subcategory would throw the detail away at write time, and no report could get
 * it back.
 *
 * The component holds NO state of its own for the selection. Both fields derive
 * from the single `value` the form already owns, so the two can never disagree
 * with each other or with what is about to be saved.
 */
export function CategoryPicker({
  value,
  onChange,
  categories,
  kind,
  householdId,
  hiddenIds,
  onCatalogueChanged,
  readOnly = false,
  label = "Category",
  error,
}: {
  /** The stored `category_id` — a subcategory id, or a main category id. */
  value: string;
  onChange: (categoryId: string) => void;
  categories: Category[];
  kind: CategoryKind;
  householdId: string;
  hiddenIds?: ReadonlySet<string>;
  /** Fires after the Manage sheet writes, so the form can refetch. */
  onCatalogueChanged?: () => void;
  readOnly?: boolean;
  label?: string;
  error?: string;
}) {
  const locale = useLocale();
  const [manageOpen, setManageOpen] = React.useState(false);

  const byId = React.useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  /*
   * Derive both fields from `value`.
   *
   * A selection that is not in this kind's list resolves to empty rather than to
   * something stale: switching income↔expense makes the previous choice
   * meaningless, and the two kinds are disjoint sets.
   */
  const selected = byId.get(value) ?? null;
  const inKind = selected?.kind === kind ? selected : null;
  const mainId = inKind ? (inKind.parent_id ?? inKind.id) : "";
  const subId = inKind?.parent_id ? inKind.id : "";

  const mains = React.useMemo(
    () =>
      categories
        .filter((c) => !c.parent_id && c.kind === kind && c.is_active)
        .sort(byCatalogueOrder),
    [categories, kind],
  );

  const subs = React.useMemo(
    () =>
      mainId
        ? categories
            .filter(
              (c) =>
                c.parent_id === mainId &&
                c.is_active &&
                !hiddenIds?.has(c.id),
            )
            .sort(byCatalogueOrder)
        : [],
    [categories, mainId, hiddenIds],
  );

  const main = byId.get(mainId) ?? null;

  /*
   * The other language sits on the RIGHT of the same row, never on a second
   * line. As a `description` it doubled every row's height for one short word,
   * which turned a 94-item subcategory list into a scroll — and left a visible
   * hole on the household's own rows, which have no Urdu name at all.
   */
  const otherLanguage = (c: Category) =>
    (locale === "ur" ? c.name : c.name_ur) ?? undefined;

  const mainOptions: SelectOption[] = mains.map((c) => ({
    value: c.id,
    label: categoryLabel(c, locale),
    secondaryLabel: otherLanguage(c),
    icon: <CategoryArt category={c} size={22} rounded="rounded-md" />,
  }));

  const subOptions: SelectOption[] = [
    {
      value: "",
      label: main ? `Just ${categoryLabel(main, locale)}` : "No subcategory",
      icon: main ? <CategoryIcon icon={main.icon} size={14} /> : undefined,
    },
    ...subs.map((c) => ({
      value: c.id,
      label: categoryLabel(c, locale),
      secondaryLabel: otherLanguage(c),
      icon: <CategoryIcon icon={c.icon} size={14} />,
      meta: c.household_id ? (
        <span className="bg-brass-soft text-brass-strong rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold">
          Yours
        </span>
      ) : undefined,
    })),
  ];

  return (
    <>
      <div className="space-y-3">
        {/*
          The label row carries its own action. "Which categories exist?" comes
          up mid-form, and the only answer used to be Settings → Categories,
          which meant abandoning a part-filled entry to find out.
        */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-foreground-2 text-xs font-medium">{label}</span>
            <button
              type="button"
              onClick={() => setManageOpen(true)}
              className="text-brass-strong hover:bg-brass-soft -me-1 flex items-center gap-1 rounded-control px-1.5 py-0.5 text-[11px] font-medium transition-colors"
            >
              <Tags size={11} />
              Manage
            </button>
          </div>

          <RichSelect
            value={mainId}
            // Changing the main invalidates the subcategory, so the value falls
            // back to the main itself rather than keeping a child of the old one.
            onChange={(id) => onChange(id)}
            options={mainOptions}
            placeholder={
              mains.length === 0 ? "Loading categories…" : "Choose a main category"
            }
            emptyMessage="No categories for this type"
            error={error}
            searchable={mains.length > 8}
            searchPlaceholder="Search main categories…"
            dense
          />
        </div>

        {/*
          Only once a main is chosen. An empty, disabled second select above the
          field that fills it is a dead control asking to be clicked.
        */}
        {mainId && (
          <RichSelect
            label="Subcategory (optional)"
            value={subId}
            // Empty means "just the main category", so the stored id is the main.
            onChange={(id) => onChange(id || mainId)}
            options={subOptions}
            placeholder={`Just ${main ? categoryLabel(main, locale) : "the main category"}`}
            searchable={subs.length > 6}
            searchPlaceholder="Search subcategories…"
            dense
            hint={
              subs.length === 0
                ? "Nothing under this yet — add one from Manage."
                : "A finer label for your own records. Reports group by the main category either way."
            }
          />
        )}
      </div>

      <CategoriesModal
        isOpen={manageOpen}
        onClose={() => setManageOpen(false)}
        categories={categories}
        householdId={householdId}
        kind={kind}
        readOnly={readOnly}
        onChanged={onCatalogueChanged}
      />
    </>
  );
}
