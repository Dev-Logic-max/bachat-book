import type { Tables } from "@/lib/supabase/types";

export type Category = Tables<"categories">;
export type Account = Tables<"accounts">;
export type QuickEntry = Tables<"quick_entries">;

/**
 * quick_entries.amount_paisa is UNSIGNED with direction in `type`.
 * transactions.amount_paisa is SIGNED (income > 0, expense < 0) — the account
 * balance trigger adds it directly.
 *
 * These two helpers are the only place that conversion should happen in app code.
 * The database triggers from migration 0011 do the same thing for linked pairs;
 * duplicating the logic inline is how the two drift apart.
 */
export function entryToSignedPaisa(
  type: "income" | "expense",
  unsignedPaisa: number,
): number {
  const magnitude = Math.abs(unsignedPaisa);
  return type === "income" ? magnitude : -magnitude;
}

export function signedToEntry(signedPaisa: number): {
  type: "income" | "expense";
  amount_paisa: number;
} {
  return {
    type: signedPaisa >= 0 ? "income" : "expense",
    amount_paisa: Math.abs(signedPaisa),
  };
}

/**
 * Orders categories parent-first with children under them, and returns each
 * child tagged with its parent's name so a dropdown can group them.
 *
 * The DB holds 37 rows in a two-level tree; a flat alphabetical list of 37 mixes
 * "Electricity" between "Education" and "Entertainment" with no indication that
 * one is a bill and the others are not.
 */
export function groupCategories(
  categories: Category[],
  kind?: "income" | "expense" | "transfer",
): Array<{ category: Category; groupLabel?: string }> {
  const pool = kind ? categories.filter((c) => c.kind === kind) : categories;
  const parents = pool.filter((c) => !c.parent_id);
  const byParent = new Map<string, Category[]>();

  for (const c of pool) {
    if (!c.parent_id) continue;
    const list = byParent.get(c.parent_id) ?? [];
    list.push(c);
    byParent.set(c.parent_id, list);
  }

  const out: Array<{ category: Category; groupLabel?: string }> = [];
  const byName = (a: Category, b: Category) => a.name.localeCompare(b.name);

  for (const parent of [...parents].sort(byName)) {
    const children = (byParent.get(parent.id) ?? []).sort(byName);
    if (children.length === 0) {
      // A parent with no children is a leaf and selectable on its own.
      out.push({ category: parent });
      continue;
    }
    // The parent becomes the group heading AND stays selectable, so "Food &
    // Dining" is available when none of its children fit.
    out.push({ category: parent, groupLabel: parent.name });
    for (const child of children) {
      out.push({ category: child, groupLabel: parent.name });
    }
  }

  // Orphans: a child whose parent is filtered out by `kind`.
  for (const c of pool) {
    if (c.parent_id && !parents.some((p) => p.id === c.parent_id)) {
      out.push({ category: c });
    }
  }

  return out;
}

/** Institution logo path, or null to fall back to a brand-coloured monogram. */
export function institutionLogo(
  logoPath: string | null | undefined,
): string | null {
  if (!logoPath) return null;
  return logoPath.startsWith("/") ? logoPath : `/logos/${logoPath}`;
}

export const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  checking: "Current",
  savings: "Savings",
  wallet: "Wallet",
  cash: "Cash",
  credit: "Credit card",
  investment: "Investment",
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: "Cash",
  debit_card: "Debit card",
  credit_card: "Credit card",
  bank_transfer: "Bank transfer",
  raast: "Raast",
  cheque: "Cheque",
  mobile_wallet: "Mobile wallet",
  other: "Other",
};

/** Local YYYY-MM-DD. `toISOString()` shifts to UTC and can land on yesterday. */
export function todayISO(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function monthBounds(ref: Date = new Date()): { from: string; to: string } {
  const first = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const last = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`;
  return { from: iso(first), to: iso(last) };
}

/**
 * Reconstructs a historical net-worth series from current account balances and
 * transaction history, walking backwards:
 *
 *   netWorth(d) = sum(balances now) − sum(transactions dated after d)
 *
 * No schema change is needed for this. The dashboard previously drew four points
 * derived as `todayBalance × 0.4, 0.6, 0.8, 1.0` labelled Jan–Apr, which produced
 * a rising line even for a user who lost money every month.
 */
export function netWorthSeries(
  currentTotalPaisa: number,
  transactions: Array<{ date: string; amount_paisa: number }>,
  points: Array<{ date: string; label: string }>,
): Array<{ date: string; label: string; value: number }> {
  // Newest first so we can subtract as we walk back through time.
  const sorted = [...transactions].sort((a, b) => (a.date < b.date ? 1 : -1));

  return [...points]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((p) => {
      let after = 0;
      for (const t of sorted) {
        if (t.date > p.date) after += Number(t.amount_paisa);
        else break;
      }
      return { ...p, value: currentTotalPaisa - after };
    })
    .reverse();
}

export type RangeKey = "1M" | "6M" | "1Y" | "ALL";

export const RANGE_LABEL: Record<RangeKey, string> = {
  "1M": "1M",
  "6M": "6M",
  "1Y": "1Y",
  ALL: "All",
};

/**
 * Month-end sample points for a range. Returns [] when there is no history to
 * cover the range, which the caller must render as an empty state — a single flat
 * line reads as "you had exactly this much all year".
 */
export function rangePoints(
  range: RangeKey,
  earliest: string | null,
): Array<{ date: string; label: string }> {
  if (!earliest) return [];

  const now = new Date();
  const months = range === "1M" ? 1 : range === "6M" ? 6 : range === "1Y" ? 12 : null;

  const earliestDate = new Date(`${earliest}T00:00:00`);
  const start =
    months === null
      ? earliestDate
      : new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  const from = start < earliestDate && months !== null ? earliestDate : start;

  const out: Array<{ date: string; label: string }> = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);

  while (
    cursor.getFullYear() < now.getFullYear() ||
    (cursor.getFullYear() === now.getFullYear() && cursor.getMonth() <= now.getMonth())
  ) {
    const isCurrentMonth =
      cursor.getFullYear() === now.getFullYear() && cursor.getMonth() === now.getMonth();
    // Month end, except the current month which samples today.
    const d = isCurrentMonth
      ? now
      : new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);

    out.push({
      date: `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`,
      label: d.toLocaleDateString("en-GB", { month: "short" }),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  // A single point cannot draw a trend.
  return out.length < 2 ? [] : out;
}
