/**
 * Monthly category caps.
 *
 * A budget answers one question: "am I overspending on this, month after month".
 * Event budgets (`lib/event-budgets.ts`) answer a different one — "is this one
 * occasion getting out of hand" — over a date window rather than a calendar
 * month. They sit on the same page because a household planning Ramadan is
 * usually looking at both.
 */

import { isParent, type Category } from "@/lib/categories";
import type { Tables } from "@/lib/supabase/types";

export type Budget = Tables<"budgets">;

/** Just enough of a movement to count it against a cap. */
export interface CountableExpense {
  id: string;
  date: string;
  amount_paisa: number;
  category_id: string | null;
  type: string;
  is_opening: boolean;
}

/* -------------------------------------------------------------------------- *
 * Which spending counts
 * -------------------------------------------------------------------------- */

/**
 * A BUDGET ON A MAIN CATEGORY MUST INCLUDE ITS SUBCATEGORIES.
 *
 * `transactions.category_id` stores the LEAF — the subcategory when one was
 * chosen, the main category otherwise (see `CategoryPicker`). So a budget on
 * "Food & Kiryana" matched literally counts only the entries nobody bothered to
 * sub-classify, and a household that tags properly sees Rs 0 spent against a
 * Rs 45,000 cap. It reads as broken, and it is not obviously so, which is worse.
 *
 * Returns every category id that should count toward a cap on `categoryId`:
 * itself, plus its children when it is a parent.
 */
export function countedCategoryIds(
  categoryId: string,
  categories: Category[],
): Set<string> {
  const ids = new Set<string>([categoryId]);
  const target = categories.find((c) => c.id === categoryId);
  if (target && isParent(target)) {
    for (const child of categories) {
      if (child.parent_id === categoryId) ids.add(child.id);
    }
  }
  return ids;
}

/**
 * What has been spent against one cap this period.
 *
 * Three exclusions, each of which was a real wrong number somewhere in this
 * product before:
 *
 *   TRANSFERS — two legs that cancel. An ATM withdrawal is not spending.
 *   OPENING BALANCES — the money an account STARTED with is not money spent.
 *   FUTURE DATES — an expense scheduled for next month must not eat this
 *     month's cap. The original query had a `>= start of month` bound and no
 *     upper one, so a bill dated for the 3rd of next month already counted.
 *
 * `amount_paisa` is signed and expenses are negative, so the magnitude is taken
 * once, here, rather than at four call sites.
 */
export function spentAgainst(
  budget: Budget,
  expenses: CountableExpense[],
  categories: Category[],
  window: { from: string; to: string },
): number {
  const counted = countedCategoryIds(budget.category_id, categories);

  return expenses.reduce((sum, tx) => {
    if (tx.type !== "expense" || tx.is_opening) return sum;
    if (!tx.category_id || !counted.has(tx.category_id)) return sum;
    if (tx.date < window.from || tx.date > window.to) return sum;
    return sum + Math.abs(Number(tx.amount_paisa));
  }, 0);
}

/* -------------------------------------------------------------------------- *
 * Pace
 * -------------------------------------------------------------------------- */

export type BudgetPace = {
  /** 0…1+, uncapped so an overspend can say by how much. */
  usedFraction: number;
  /** How far through the month we are, 0…1. */
  elapsedFraction: number;
  dayOfMonth: number;
  daysInMonth: number;
  daysLeft: number;
  remainingPaisa: number;
  /** What is left, divided by the days left. Null once the month is over. */
  perDayLeftPaisa: number | null;
  /** Spending faster than the days are passing. */
  aheadOfPace: boolean;
  state: "under" | "close" | "over";
};

/**
 * "Rs 38,200 of Rs 45,000" is not actionable on its own — it depends entirely
 * on whether today is the 3rd or the 28th. Everything here exists to turn the
 * pair of numbers into a decision.
 *
 * `close` starts at 80% of the cap, matching the bar's colour change; the
 * PACE warning is separate and fires whenever spending is running ahead of the
 * calendar, which can happen at 30% used on the 2nd of the month.
 */
export function budgetPace(
  limitPaisa: number,
  spentPaisa: number,
  today = new Date(),
): BudgetPace {
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const dayOfMonth = today.getDate();
  const daysLeft = Math.max(0, daysInMonth - dayOfMonth);

  const usedFraction = limitPaisa > 0 ? spentPaisa / limitPaisa : 0;
  const elapsedFraction = dayOfMonth / daysInMonth;
  const remainingPaisa = limitPaisa - spentPaisa;

  return {
    usedFraction,
    elapsedFraction,
    dayOfMonth,
    daysInMonth,
    daysLeft,
    remainingPaisa,
    // Divided by the days REMAINING including today, so on the last day it says
    // what is left rather than dividing by zero.
    perDayLeftPaisa: remainingPaisa > 0 ? Math.round(remainingPaisa / Math.max(1, daysLeft + 1)) : 0,
    aheadOfPace: usedFraction > elapsedFraction + 0.05 && usedFraction < 1,
    state: usedFraction >= 1 ? "over" : usedFraction >= 0.8 ? "close" : "under",
  };
}

/* -------------------------------------------------------------------------- *
 * Totals
 * -------------------------------------------------------------------------- */

export type BudgetTotals = {
  limitPaisa: number;
  spentPaisa: number;
  remainingPaisa: number;
  overCount: number;
  closeCount: number;
  /** Expenses in the window with no cap on their category. */
  uncappedPaisa: number;
};

/**
 * `uncappedPaisa` is the figure the three original summary cards were missing.
 *
 * Budgeted / spent / remaining all describe the categories you thought to cap,
 * and say nothing about the rest — which for most households is where the money
 * actually goes. "Rs 12,000 left across your budgets" beside Rs 60,000 of
 * unbudgeted spending is a comforting number that means nothing.
 */
export function budgetTotals(
  budgets: Budget[],
  spentByBudget: Record<string, number>,
  expenses: CountableExpense[],
  categories: Category[],
  window: { from: string; to: string },
): BudgetTotals {
  let limitPaisa = 0;
  let spentPaisa = 0;
  let overCount = 0;
  let closeCount = 0;

  /*
   * Only TOP-LEVEL caps are summed.
   *
   * A cap on Food already includes Dining out, so adding a Dining out cap into
   * the same total counts those rupees twice — in both the limit and the spend.
   * A budget is "nested" when some other budget's counted set contains it.
   */
  const cappedIds = new Set(budgets.map((b) => b.category_id));
  const nested = new Set<string>();
  for (const budget of budgets) {
    for (const id of countedCategoryIds(budget.category_id, categories)) {
      if (id !== budget.category_id && cappedIds.has(id)) nested.add(id);
    }
  }

  for (const budget of budgets) {
    const spent = spentByBudget[budget.id] ?? 0;
    const pace = budgetPace(Number(budget.amount_paisa), spent);

    if (pace.state === "over") overCount += 1;
    else if (pace.state === "close") closeCount += 1;

    if (nested.has(budget.category_id)) continue;
    limitPaisa += Number(budget.amount_paisa);
    spentPaisa += spent;
  }

  // Everything counted by at least one cap, so the leftover is genuinely uncapped.
  const covered = new Set<string>();
  for (const budget of budgets) {
    for (const id of countedCategoryIds(budget.category_id, categories)) covered.add(id);
  }

  const uncappedPaisa = expenses.reduce((sum, tx) => {
    if (tx.type !== "expense" || tx.is_opening) return sum;
    if (tx.date < window.from || tx.date > window.to) return sum;
    if (tx.category_id && covered.has(tx.category_id)) return sum;
    return sum + Math.abs(Number(tx.amount_paisa));
  }, 0);

  return {
    limitPaisa,
    spentPaisa,
    remainingPaisa: limitPaisa - spentPaisa,
    overCount,
    closeCount,
    uncappedPaisa,
  };
}

/**
 * Last month's actual spend on a category, to suggest a starting figure.
 *
 * A blank "Monthly limit" box asks a question most people cannot answer. What
 * they spent last month they can at least react to.
 */
export function lastMonthSpentPaisa(
  categoryId: string,
  expenses: CountableExpense[],
  categories: Category[],
  today = new Date(),
): number {
  const ref = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const pad = (n: number) => `${n}`.padStart(2, "0");
  const from = `${ref.getFullYear()}-${pad(ref.getMonth() + 1)}-01`;
  const lastDay = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
  const to = `${ref.getFullYear()}-${pad(ref.getMonth() + 1)}-${pad(lastDay)}`;

  const counted = countedCategoryIds(categoryId, categories);

  return expenses.reduce((sum, tx) => {
    if (tx.type !== "expense" || tx.is_opening) return sum;
    if (!tx.category_id || !counted.has(tx.category_id)) return sum;
    if (tx.date < from || tx.date > to) return sum;
    return sum + Math.abs(Number(tx.amount_paisa));
  }, 0);
}
