/**
 * Reports — aggregation over the single ledger.
 *
 * THE THREE EXCLUSIONS. Every figure on this page applies all of them, and each
 * one was a real wrong number somewhere in this product before:
 *
 *   TRANSFERS      two legs that cancel. An ATM withdrawal is not spending, and
 *                  money lent is not spent — it is still yours.
 *   OPENING BALANCES  the money an account STARTED with is not money earned.
 *                  The previous Reports page missed this one, so every opening
 *                  balance was counted as household income.
 *   OUT OF RANGE   a report for August must not include September.
 *
 * Amounts are signed paisa. The SIGN is read, never `type` — they cannot
 * disagree, and the sign is what the balance trigger actually used.
 *
 * Pure and JSX-free: no fetching, no formatting, no components.
 */

import type { Tables } from "@/lib/supabase/types";

export type Category = Tables<"categories">;

/** Just enough of a movement to report on. */
export interface ReportMovement {
  id: string;
  date: string;
  amount_paisa: number;
  type: string;
  is_opening: boolean;
  category_id: string | null;
  account_id: string;
  note: string | null;
}

export type DateRange = { from: string; to: string; label: string };

/* -------------------------------------------------------------------------- *
 * Ranges
 * -------------------------------------------------------------------------- */

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * The FBR tax year runs JULY to JUNE, not January to December.
 *
 * A "this year" report on a Pakistani finance app that runs to the calendar
 * year is the wrong number for the one purpose people actually print a report
 * for, which is tax.
 */
export function fbrTaxYear(ref: Date = new Date()): DateRange {
  const year = ref.getMonth() >= 6 ? ref.getFullYear() : ref.getFullYear() - 1;
  return {
    from: `${year}-07-01`,
    to: `${year + 1}-06-30`,
    label: `FBR tax year ${year}–${String(year + 1).slice(2)}`,
  };
}

export function monthRange(ref: Date = new Date()): DateRange {
  const from = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const to = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  return { from: iso(from), to: iso(to), label: `${MONTH_NAMES[ref.getMonth()]} ${ref.getFullYear()}` };
}

export function lastMonthRange(ref: Date = new Date()): DateRange {
  return monthRange(new Date(ref.getFullYear(), ref.getMonth() - 1, 1));
}

/** N whole months back, ending today. */
export function lastNMonths(n: number, ref: Date = new Date()): DateRange {
  const from = new Date(ref.getFullYear(), ref.getMonth() - (n - 1), 1);
  return { from: iso(from), to: iso(ref), label: `Last ${n} months` };
}

export const RANGE_PRESETS = [
  { key: "this_month", label: "This month", build: () => monthRange() },
  { key: "last_month", label: "Last month", build: () => lastMonthRange() },
  { key: "last_3", label: "Last 3 months", build: () => lastNMonths(3) },
  { key: "last_12", label: "Last 12 months", build: () => lastNMonths(12) },
  { key: "tax_year", label: "FBR tax year", build: () => fbrTaxYear() },
] as const;

export type RangePresetKey = (typeof RANGE_PRESETS)[number]["key"] | "custom";

/* -------------------------------------------------------------------------- *
 * Filtering
 * -------------------------------------------------------------------------- */

/**
 * Does this movement count toward money in and money out?
 *
 * The single gate every figure on the page passes through, so a new report can
 * never accidentally omit one of the exclusions.
 */
export function countsAsFlow(m: ReportMovement, range: DateRange): boolean {
  if (m.is_opening) return false;
  if (m.type === "transfer") return false;
  return m.date >= range.from && m.date <= range.to;
}

/* -------------------------------------------------------------------------- *
 * Totals
 * -------------------------------------------------------------------------- */

export type ReportTotals = {
  incomePaisa: number;
  expensePaisa: number;
  netPaisa: number;
  /** Share of income kept, 0–1. Null when nothing came in. */
  savingsRate: number | null;
  incomeCount: number;
  expenseCount: number;
};

export function reportTotals(movements: ReportMovement[], range: DateRange): ReportTotals {
  let incomePaisa = 0;
  let expensePaisa = 0;
  let incomeCount = 0;
  let expenseCount = 0;

  for (const m of movements) {
    if (!countsAsFlow(m, range)) continue;
    const amount = Number(m.amount_paisa);
    if (amount >= 0) {
      incomePaisa += amount;
      incomeCount += 1;
    } else {
      expensePaisa += Math.abs(amount);
      expenseCount += 1;
    }
  }

  const netPaisa = incomePaisa - expensePaisa;
  return {
    incomePaisa,
    expensePaisa,
    netPaisa,
    savingsRate: incomePaisa > 0 ? netPaisa / incomePaisa : null,
    incomeCount,
    expenseCount,
  };
}

/* -------------------------------------------------------------------------- *
 * Where the money went
 * -------------------------------------------------------------------------- */

export type CategorySlice = {
  categoryId: string | null;
  name: string;
  /** The PARENT's name, so a breakdown can group two tiers. */
  parentName: string | null;
  amountPaisa: number;
  share: number;
  count: number;
};

/**
 * Expense by category, largest first.
 *
 * Rolled up to the PARENT tier. A 152-row catalogue produces a chart with 152
 * slices, which is not a chart — it is a legend. "Food · Rs 34,000" is the
 * answer; which of the eight Food subcategories it came from is a drill-down.
 */
export function expenseByCategory(
  movements: ReportMovement[],
  categories: Category[],
  range: DateRange,
  { rollUpToParent = true }: { rollUpToParent?: boolean } = {},
): CategorySlice[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const buckets = new Map<string, CategorySlice>();
  let total = 0;

  for (const m of movements) {
    if (!countsAsFlow(m, range)) continue;
    const amount = Number(m.amount_paisa);
    if (amount >= 0) continue;

    const own = m.category_id ? byId.get(m.category_id) : undefined;
    const parent = own?.parent_id ? byId.get(own.parent_id) : undefined;
    const target = rollUpToParent ? (parent ?? own) : own;

    const key = target?.id ?? "__none__";
    const existing = buckets.get(key) ?? {
      categoryId: target?.id ?? null,
      name: target?.name ?? "Uncategorised",
      parentName: rollUpToParent ? null : (parent?.name ?? null),
      amountPaisa: 0,
      share: 0,
      count: 0,
    };

    existing.amountPaisa += Math.abs(amount);
    existing.count += 1;
    buckets.set(key, existing);
    total += Math.abs(amount);
  }

  const slices = [...buckets.values()].sort((a, b) => b.amountPaisa - a.amountPaisa);
  for (const slice of slices) {
    slice.share = total > 0 ? slice.amountPaisa / total : 0;
  }
  return slices;
}

/* -------------------------------------------------------------------------- *
 * Over time
 * -------------------------------------------------------------------------- */

export type MonthPoint = {
  key: string;
  label: string;
  incomePaisa: number;
  expensePaisa: number;
  netPaisa: number;
};

/**
 * Month by month across the range.
 *
 * EVERY month in the range is emitted, including empty ones. Skipping a month
 * with no movements makes a bar chart lie — the gap closes up and a quiet
 * February renders as if it never happened.
 */
export function monthlySeries(movements: ReportMovement[], range: DateRange): MonthPoint[] {
  const points = new Map<string, MonthPoint>();

  const [fy, fm] = range.from.split("-").map(Number);
  const [ty, tm] = range.to.split("-").map(Number);
  let y = fy;
  let m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    points.set(key, {
      key,
      label: `${MONTH_NAMES[m - 1].slice(0, 3)} ${String(y).slice(2)}`,
      incomePaisa: 0,
      expensePaisa: 0,
      netPaisa: 0,
    });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }

  for (const mv of movements) {
    if (!countsAsFlow(mv, range)) continue;
    const point = points.get(mv.date.slice(0, 7));
    if (!point) continue;
    const amount = Number(mv.amount_paisa);
    if (amount >= 0) point.incomePaisa += amount;
    else point.expensePaisa += Math.abs(amount);
  }

  const series = [...points.values()];
  for (const point of series) point.netPaisa = point.incomePaisa - point.expensePaisa;
  return series;
}

/* -------------------------------------------------------------------------- *
 * CSV
 * -------------------------------------------------------------------------- */

/**
 * RFC-4180 escaping, which the old export did not do at all.
 *
 * It joined on commas with no quoting, so a category called "Food, Drink" —
 * or any note containing a comma, which is most of them — silently split into
 * two columns and shifted every value after it on that row.
 */
export function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  // A leading BOM so Excel opens Urdu category names as UTF-8 rather than mojibake.
  return "﻿" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

/** Rupees with two decimals and no separators — a spreadsheet wants a number. */
export function csvAmount(paisa: number): string {
  return (paisa / 100).toFixed(2);
}
