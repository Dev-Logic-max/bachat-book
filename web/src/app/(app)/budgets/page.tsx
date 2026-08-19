"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import { AlertTriangle, CircleDollarSign, Plus, TrendingDown } from "lucide-react";

import { BudgetModal } from "@/components/budget-modal";
import { CategoryIcon, categoryLabel } from "@/components/category-icon";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { EmptyState } from "@/components/empty-state";
import { EventBudgetPanel } from "@/components/event-budget-panel";
import { PageActions } from "@/components/page-actions";
import { Reveal } from "@/components/reveal";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { RowActions } from "@/components/ui/row-actions";
import { useToast } from "@/components/ui/toast";
import {
  budgetPace,
  budgetTotals,
  countedCategoryIds,
  spentAgainst,
  type Budget,
  type CountableExpense,
} from "@/lib/budgets";
import { isParent, type Category } from "@/lib/categories";
import { formatPKR, formatPKRCompact } from "@/lib/format";
import { monthBounds } from "@/lib/ledger";
import { createClient } from "@/lib/supabase/client";
import { useHiddenCategoryIds } from "@/lib/use-hidden-categories";

export default function BudgetsPage() {
  const session = useSession();
  const supabase = createClient();
  const locale = useLocale();
  const { showToast } = useToast();

  const householdId = session.household?.id || "";
  const readOnly = session.workspace ? !session.workspace.is_active : false;
  const hiddenIds = useHiddenCategoryIds(householdId);

  const [budgets, setBudgets] = React.useState<Budget[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [expenses, setExpenses] = React.useState<CountableExpense[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const [addOpen, setAddOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Budget | null>(null);
  const [deleting, setDeleting] = React.useState<Budget | null>(null);

  /*
   * The window every figure on this page is measured over.
   *
   * Held in state seeded once rather than recomputed on each render, so a
   * component that re-renders across midnight cannot silently change the
   * numbers under the user mid-session.
   */
  const [monthWindow] = React.useState(() => monthBounds());

  React.useEffect(() => {
    let active = true;
    if (!householdId) return;

    async function load() {
      /*
       * Two months of expenses, not one: the create form suggests last month's
       * actual spend as a starting cap, and re-fetching for that would double
       * the queries on a page that has already loaded the rows.
       */
      const from = new Date();
      from.setMonth(from.getMonth() - 1, 1);
      const previousStart = `${from.getFullYear()}-${`${from.getMonth() + 1}`.padStart(2, "0")}-01`;

      const [budgetRes, categoryRes, expenseRes] = await Promise.all([
        supabase.from("budgets").select("*").eq("household_id", householdId),
        supabase.from("categories").select("*"),
        supabase
          .from("transactions")
          .select("id, date, amount_paisa, category_id, type, is_opening")
          .eq("household_id", householdId)
          .eq("type", "expense")
          .gte("date", previousStart)
          .lte("date", monthWindow.to),
      ]);

      if (!active) return;

      // `error` checked separately from "no rows" — an empty array from a failed
      // query wearing the empty state's clothes is a bug this codebase has had.
      const firstError = budgetRes.error || categoryRes.error || expenseRes.error;
      if (firstError) {
        setLoadError(firstError.message);
        setLoading(false);
        return;
      }

      setBudgets(budgetRes.data ?? []);
      setCategories(categoryRes.data ?? []);
      setExpenses((expenseRes.data ?? []) as CountableExpense[]);
      setLoadError(null);
      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [householdId, refreshKey, supabase, monthWindow.to]);

  const refresh = () => setRefreshKey((k) => k + 1);

  const categoryById = React.useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const spentByBudget = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const budget of budgets) {
      map[budget.id] = spentAgainst(budget, expenses, categories, monthWindow);
    }
    return map;
  }, [budgets, expenses, categories, monthWindow]);

  const totals = React.useMemo(
    () => budgetTotals(budgets, spentByBudget, expenses, categories, monthWindow),
    [budgets, spentByBudget, expenses, categories, monthWindow],
  );

  const overallPace = budgetPace(totals.limitPaisa, totals.spentPaisa);

  // Over first, then close, then the rest — the ones needing a decision on top.
  const ordered = React.useMemo(() => {
    const rank = (b: Budget) => {
      const pace = budgetPace(Number(b.amount_paisa), spentByBudget[b.id] ?? 0);
      return pace.state === "over" ? 0 : pace.state === "close" ? 1 : 2;
    };
    return [...budgets].sort((a, b) => {
      const byState = rank(a) - rank(b);
      if (byState !== 0) return byState;
      return Number(b.amount_paisa) - Number(a.amount_paisa);
    });
  }, [budgets, spentByBudget]);

  const existingByCategory = React.useMemo(
    () => new Map(budgets.map((b) => [b.category_id, b])),
    [budgets],
  );

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("budgets").delete().eq("id", deleting.id);
    if (error) {
      showToast({ type: "error", title: "Could not remove it", description: error.message });
      return;
    }
    showToast({
      type: "success",
      title: "Budget removed",
      description: "The cap is gone. Your spending records are untouched.",
    });
    setDeleting(null);
    refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display truncate text-[19px] font-semibold tracking-[-0.02em] sm:text-[22px]">
            Budgets
          </h1>
          <p className="text-muted mt-0.5 text-[12.5px]">
            A monthly ceiling per category, and a warning before you cross one.
          </p>
        </div>

        <PageActions
          title="Budgets"
          actions={[
            {
              label: "Set budget",
              shortLabel: "Budget",
              hint: "Cap what one category can take in a month",
              icon: Plus,
              tone: "primary",
              disabled: readOnly,
              onClick: () => {
                setEditing(null);
                setAddOpen(true);
              },
            },
          ]}
        />
      </div>

      {loadError && (
        <div className="border-loss/25 bg-loss/8 text-loss rounded-panel border px-4 py-3 text-[12.5px]">
          Could not load your budgets: {loadError}
        </div>
      )}

      {/* ---- The month, in four numbers that each say something different --- */}
      {budgets.length > 0 && (
        <Reveal>
          <div className="bg-surface border-border rounded-panel border p-5 shadow-xs">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-[15px] font-semibold tracking-[-0.01em]">
                This month so far
              </h2>
              <span className="text-muted tnum text-[11.5px]">
                Day {overallPace.dayOfMonth} of {overallPace.daysInMonth}
                {overallPace.daysLeft > 0 && ` · ${overallPace.daysLeft} left`}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-4">
              <Stat label="Capped in total" value={formatPKR(totals.limitPaisa)} />
              <Stat
                label="Spent against caps"
                value={formatPKR(totals.spentPaisa)}
                tone={totals.spentPaisa > totals.limitPaisa ? "loss" : undefined}
              />
              {/*
                The figure the original three cards were missing. "Rs 380 a day"
                is a decision; "Rs 12,000 remaining" on the 4th and on the 27th
                are the same number meaning opposite things.
              */}
              <Stat
                label={overallPace.daysLeft > 0 ? "Left to spend, per day" : "Left today"}
                value={
                  totals.remainingPaisa > 0
                    ? formatPKR(overallPace.perDayLeftPaisa ?? 0)
                    : formatPKR(0)
                }
                tone={totals.remainingPaisa > 0 ? undefined : "loss"}
                sub={
                  totals.remainingPaisa > 0
                    ? `${formatPKRCompact(totals.remainingPaisa)} in the pot`
                    : `${formatPKRCompact(Math.abs(totals.remainingPaisa))} over`
                }
              />
              <Stat
                label="Spent outside any cap"
                value={formatPKR(totals.uncappedPaisa)}
                sub={
                  totals.uncappedPaisa > totals.spentPaisa
                    ? "More than your capped spending"
                    : "Not covered by a budget"
                }
              />
            </div>

            {(totals.overCount > 0 || overallPace.aheadOfPace) && (
              <p
                className={`mt-4 flex items-start gap-2 rounded-control border px-3 py-2.5 text-[11.5px] leading-relaxed ${
                  totals.overCount > 0
                    ? "border-loss/25 bg-loss/8 text-loss"
                    : "border-brass/30 bg-brass/8 text-brass-strong"
                }`}
              >
                <AlertTriangle size={14} className="mt-px shrink-0" />
                <span>
                  {totals.overCount > 0
                    ? `${totals.overCount} ${totals.overCount === 1 ? "budget is" : "budgets are"} over the line${
                        totals.closeCount > 0 ? `, and ${totals.closeCount} close to it` : ""
                      }.`
                    : `You are ${overallPace.dayOfMonth === 1 ? "already " : ""}spending faster than the month is passing — ${Math.round(
                        overallPace.usedFraction * 100,
                      )}% used with ${Math.round((1 - overallPace.elapsedFraction) * 100)}% of the month left.`}
                </span>
              </p>
            )}
          </div>
        </Reveal>
      )}

      {/* ---- The caps ------------------------------------------------------ */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-surface border-border rounded-panel shimmer h-32 border" />
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <EmptyState
          title="No budgets yet"
          description="Cap the categories that get away from you — Kiryana, petrol, bijli, dining out. A cap on a main category covers everything inside it."
          action={
            <Button variant="primary" onClick={() => setAddOpen(true)} disabled={readOnly}>
              Set your first budget
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ordered.map((budget, i) => (
            <Reveal key={budget.id} index={i}>
              <BudgetCard
                budget={budget}
                category={categoryById.get(budget.category_id) ?? null}
                childCount={
                  countedCategoryIds(budget.category_id, categories).size - 1
                }
                spentPaisa={spentByBudget[budget.id] ?? 0}
                locale={locale}
                readOnly={readOnly}
                onEdit={() => setEditing(budget)}
                onDelete={() => setDeleting(budget)}
              />
            </Reveal>
          ))}
        </div>
      )}

      {/*
        Event budgets sit UNDER the monthly caps rather than behind a tab.
        They are the same question — "how much am I allowing for this?" — asked
        over a different window, and a household planning Ramadan is usually
        looking at both at once. A tab would hide whichever one you were not
        thinking about at the moment you arrived.
      */}
      <div className="border-border border-t pt-6">
        <EventBudgetPanel
          householdId={householdId}
          categories={categories}
          readOnly={readOnly}
        />
      </div>

      <BudgetModal
        isOpen={addOpen || editing !== null}
        onClose={() => {
          setAddOpen(false);
          setEditing(null);
        }}
        onSaved={refresh}
        householdId={householdId}
        budget={editing}
        categories={categories}
        hiddenIds={hiddenIds}
        expenses={expenses}
        existingByCategory={existingByCategory}
      />

      <ConfirmDeleteModal
        isOpen={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Remove this budget?"
        recordLabel={
          deleting
            ? categoryLabel(categoryById.get(deleting.category_id), locale) || "This category"
            : ""
        }
        recordMeta={deleting ? `${formatPKR(Number(deleting.amount_paisa))} a month` : undefined}
        cascadeHint="Only the cap is removed. Every expense you logged against this category stays exactly where it is."
        confirmLabel="Remove budget"
      />
    </div>
  );
}

/* ========================================================================== */

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "loss";
}) {
  return (
    <div className="min-w-0">
      <p className="text-muted text-[10px] font-semibold uppercase tracking-widest">{label}</p>
      <p
        className={`font-display tnum mt-1 truncate text-[17px] font-bold ${
          tone === "loss" ? "text-loss" : "text-foreground"
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-faint mt-0.5 truncate text-[10.5px]">{sub}</p>}
    </div>
  );
}

function BudgetCard({
  budget,
  category,
  childCount,
  spentPaisa,
  locale,
  readOnly,
  onEdit,
  onDelete,
}: {
  budget: Budget;
  category: Category | null;
  childCount: number;
  spentPaisa: number;
  locale: string;
  readOnly: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const limitPaisa = Number(budget.amount_paisa);
  const pace = budgetPace(limitPaisa, spentPaisa);

  const barWidth = Math.min(100, pace.usedFraction * 100);
  const barColor =
    pace.state === "over" ? "bg-loss" : pace.state === "close" ? "bg-brass" : "bg-gain";

  return (
    // `group` drives the hover reveal in RowActions. Without it the edit and
    // delete buttons never appear at desktop widths — see the same note on the
    // holding card and on the accounts page.
    <div className="group bg-surface border-border rounded-panel focus-within:border-brass/40 flex h-full flex-col border p-5 shadow-xs transition-colors">
      <div className="flex items-start gap-3">
        <span className="bg-brass/10 text-brass-strong flex size-8 shrink-0 items-center justify-center rounded-card">
          <CategoryIcon icon={category?.icon} size={16} />
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="font-display text-foreground truncate text-[13.5px] font-semibold">
            {categoryLabel(category, locale) || "Category"}
          </h3>
          <p className="text-muted truncate text-[11px]">
            {category && isParent(category) && childCount > 0
              ? `All ${childCount} subcategories`
              : "This subcategory only"}
          </p>
        </div>

        {!readOnly && (
          <RowActions
            onEdit={onEdit}
            onDelete={onDelete}
            editLabel="Edit budget"
            deleteLabel="Remove budget"
            reveal="always"
          />
        )}
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-display tnum text-foreground text-base font-bold">
            {formatPKR(spentPaisa)}
          </span>
          <span className="text-muted tnum text-[11.5px]">
            of {formatPKR(limitPaisa)}
          </span>
        </div>

        {/*
          The bar alone cannot say whether 60% used is early or late — that
          depends entirely on the date. The notch marks how far through the month
          we are, so "am I ahead or behind" is one glance rather than arithmetic.
        */}
        <div className="bg-surface-subtle border-border relative mt-2 h-2 w-full overflow-hidden rounded-full border">
          <div
            className={`h-full ${barColor} transition-[width] duration-500`}
            style={{ width: `${barWidth}%` }}
          />
          <span
            aria-hidden
            className="bg-foreground/45 absolute inset-y-0 w-px"
            style={{ insetInlineStart: `${pace.elapsedFraction * 100}%` }}
            title={`Day ${pace.dayOfMonth} of ${pace.daysInMonth}`}
          />
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
          <span
            className={
              pace.state === "over"
                ? "text-loss font-medium"
                : pace.aheadOfPace
                  ? "text-brass-strong font-medium"
                  : "text-muted"
            }
          >
            {pace.state === "over" ? (
              <>
                <TrendingDown size={11} className="mb-px me-1 inline" />
                <span className="tnum">{formatPKR(Math.abs(pace.remainingPaisa))}</span> over
              </>
            ) : pace.aheadOfPace ? (
              <>Running ahead of the month</>
            ) : (
              <>
                <span className="tnum">{formatPKR(pace.remainingPaisa)}</span> left
              </>
            )}
          </span>

          <span className="text-faint tnum">
            {pace.state === "over"
              ? `${Math.round(pace.usedFraction * 100)}%`
              : pace.daysLeft > 0
                ? `${formatPKRCompact(pace.perDayLeftPaisa ?? 0)}/day`
                : "Last day"}
          </span>
        </div>
      </div>
    </div>
  );
}
