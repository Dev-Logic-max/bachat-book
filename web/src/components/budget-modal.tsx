"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import { CircleDollarSign, Info } from "lucide-react";

import { CategoryIcon, categoryLabel } from "@/components/category-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { RichSelect, type SelectOption } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { groupCatalogue, isParent, type Category } from "@/lib/categories";
import { createClient } from "@/lib/supabase/client";
import { formatPKR } from "@/lib/format";
import {
  countedCategoryIds,
  lastMonthSpentPaisa,
  type Budget,
  type CountableExpense,
} from "@/lib/budgets";

/** The first of this month, which is the budget's `start_date`. */
function monthStartISO(today = new Date()): string {
  return `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, "0")}-01`;
}

export function BudgetModal({
  isOpen,
  onClose,
  onSaved,
  householdId,
  budget,
  categories,
  hiddenIds,
  expenses,
  /** Categories that already have a cap, so the picker can say so. */
  existingByCategory,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  householdId: string;
  /** Null for a new cap. */
  budget: Budget | null;
  categories: Category[];
  hiddenIds?: ReadonlySet<string>;
  expenses: CountableExpense[];
  existingByCategory: Map<string, Budget>;
}) {
  const supabase = createClient();
  const locale = useLocale();
  const { showToast } = useToast();
  const isEdit = Boolean(budget);

  const [categoryId, setCategoryId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const seedKey = `${isOpen}:${budget?.id ?? "new"}`;
  const [seeded, setSeeded] = React.useState(seedKey);
  if (seeded !== seedKey) {
    setSeeded(seedKey);
    setCategoryId(budget?.category_id ?? "");
    setAmount(budget ? String(Number(budget.amount_paisa) / 100) : "");
  }

  /*
   * The picker.
   *
   * Grouped parent → child, with the PARENT itself offered as the first row of
   * its own group. That row is the one most people want: a cap on "Food &
   * Kiryana" covers Kiryana, Bakery, Dining out and everything else beneath it,
   * which is how a household actually thinks about a grocery budget. The flat
   * 126-row list this replaced opened on "Bakery" and had no search.
   */
  const options: SelectOption[] = React.useMemo(() => {
    const groups = groupCatalogue(categories, {
      kind: "expense",
      hiddenIds,
      activeOnly: true,
    });

    const rows: SelectOption[] = [];

    for (const { parent, children } of groups) {
      const groupName = categoryLabel(parent, locale);
      const taken = existingByCategory.get(parent.id);

      rows.push({
        value: parent.id,
        label: categoryLabel(parent, locale),
        secondaryLabel: locale === "ur" ? undefined : (parent.name_ur ?? undefined),
        description:
          children.length > 0
            ? `Covers all ${children.length} inside it`
            : "The whole category",
        group: groupName,
        icon: <CategoryIcon icon={parent.icon} size={17} className="text-brass-strong" />,
        meta: taken && taken.id !== budget?.id ? <TakenChip /> : undefined,
        disabled: Boolean(taken) && taken?.id !== budget?.id,
      });

      for (const child of children) {
        const childTaken = existingByCategory.get(child.id);
        rows.push({
          value: child.id,
          label: categoryLabel(child, locale),
          secondaryLabel: locale === "ur" ? undefined : (child.name_ur ?? undefined),
          group: groupName,
          icon: <CategoryIcon icon={child.icon} size={16} className="text-muted" />,
          meta: childTaken && childTaken.id !== budget?.id ? <TakenChip /> : undefined,
          disabled: Boolean(childTaken) && childTaken?.id !== budget?.id,
        });
      }
    }

    return rows;
  }, [categories, hiddenIds, locale, existingByCategory, budget?.id]);

  const selected = categories.find((c) => c.id === categoryId) ?? null;
  const childCount = selected && isParent(selected)
    ? countedCategoryIds(selected.id, categories).size - 1
    : 0;

  // What they spent on it last month. A blank cap field asks a question most
  // people cannot answer; last month's figure is something to react to.
  const suggestionPaisa = categoryId
    ? lastMonthSpentPaisa(categoryId, expenses, categories)
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!categoryId) {
      showToast({ type: "error", title: "Pick a category", description: "Choose what you are capping." });
      return;
    }
    const amountPaisa = Math.round((parseFloat(amount) || 0) * 100);
    if (amountPaisa <= 0) {
      showToast({ type: "error", title: "Set a limit", description: "Enter how much this category may take." });
      return;
    }

    setSubmitting(true);

    /*
     * `onConflict` naming the real unique key.
     *
     * Without it, PostgREST infers the PRIMARY KEY, and since a new row carries
     * a fresh uuid the primary key never conflicts — so the insert reaches
     * `budgets_household_id_category_id_start_date_key` and fails with a
     * duplicate-key error instead of updating. Setting a cap twice in one month
     * simply broke.
     */
    const { error } = await supabase.from("budgets").upsert(
      {
        ...(budget ? { id: budget.id } : {}),
        household_id: householdId,
        category_id: categoryId,
        period: "monthly",
        amount_paisa: amountPaisa,
        start_date: budget?.start_date ?? monthStartISO(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "household_id,category_id,start_date" },
    );

    setSubmitting(false);

    if (error) {
      showToast({ type: "error", title: "Could not save the budget", description: error.message });
      return;
    }

    showToast({
      type: "success",
      title: isEdit ? "Budget updated" : "Budget set",
      description: `${categoryLabel(selected, locale)} is capped at ${formatPKR(amountPaisa)} a month.`,
    });
    onSaved();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit this budget" : "Set a monthly budget"}
      subtitle="A ceiling for one category, reset on the 1st of every month."
      icon={<CircleDollarSign size={18} />}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={submitting}>
            {isEdit ? "Save changes" : "Set budget"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <RichSelect
          label="Cap which category?"
          value={categoryId}
          onChange={setCategoryId}
          options={options}
          placeholder="Search or choose a category…"
          searchable
          searchPlaceholder="Try “kiryana”, “petrol”, “bijli”…"
          disabled={isEdit}
          hint={
            isEdit
              ? "The category cannot be changed. Delete this budget and set a new one instead."
              : undefined
          }
        />

        {childCount > 0 && (
          <p className="border-border bg-surface-subtle text-muted rounded-control flex items-start gap-2 border px-3 py-2.5 text-[11.5px] leading-relaxed">
            <Info size={14} className="text-brass-strong mt-px shrink-0" />
            <span>
              This covers everything under{" "}
              <span className="text-foreground font-medium">
                {categoryLabel(selected, locale)}
              </span>{" "}
              — all {childCount} subcategories count toward the same cap.
            </span>
          </p>
        )}

        <Input
          label="Monthly limit (PKR)"
          type="number"
          step="any"
          min="0"
          placeholder={suggestionPaisa > 0 ? String(suggestionPaisa / 100) : "e.g. 45000"}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          hint={
            suggestionPaisa > 0
              ? `You spent ${formatPKR(suggestionPaisa)} on this last month.`
              : "Reset to zero on the 1st. The limit itself carries over."
          }
          required
        />

        {suggestionPaisa > 0 && amount.trim() === "" && (
          <button
            type="button"
            onClick={() => setAmount(String(suggestionPaisa / 100))}
            className="border-brass/30 bg-brass/8 text-brass-strong hover:bg-brass/12 rounded-control w-full border px-3 py-2 text-[11.5px] font-medium transition-colors"
          >
            Use last month&rsquo;s {formatPKR(suggestionPaisa)}
          </button>
        )}
      </div>
    </Modal>
  );
}

function TakenChip() {
  return (
    <span className="border-border bg-surface-subtle text-muted rounded-full border px-1.5 py-0.5 text-[10px] leading-none font-medium">
      Already capped
    </span>
  );
}
