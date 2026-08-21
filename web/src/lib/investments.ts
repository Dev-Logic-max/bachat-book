/**
 * Investments — everything you own that is not liquid.
 *
 * This module is SEALED by default. A holding lives in `investments` and touches
 * nothing in the daily ledger: adding Rs 20,00,000 in a cement factory does not
 * debit an account, does not appear in Entries, and does not move net worth on
 * the dashboard. `household_integrations.sync_investments` is the one switch
 * that opens the bridge, and it starts off.
 *
 * That separation is deliberate rather than lazy. With the bridge shut, the app
 * never took the Rs 20,00,000 out of your bank, so ALSO adding the holding into
 * dashboard net worth would count the same money twice — the "two contradictory
 * stories on one screen" failure this codebase has hit before. The dashboard
 * therefore answers "what is my daily money doing"; this page answers "what do I
 * own, what has it earned, and when do I get it back".
 *
 * Writes and the ledger bridge live in `investment-actions.ts`.
 */

import type {
  InvestmentKind,
  InvestmentStatus,
  PayoutFrequency,
  Tables,
} from "@/lib/supabase/types";

export type Investment = Tables<"investments">;
export type InvestmentValuation = Tables<"investment_valuations">;
export type InvestmentPayout = Tables<"investment_payouts">;

/* -------------------------------------------------------------------------- *
 * The catalogue
 * -------------------------------------------------------------------------- */

export type InvestmentKindDef = {
  key: InvestmentKind;
  label: string;
  labelUr: string;
  /** Lucide icon name; components map it, so this file stays JSX-free. */
  icon: string;
  /**
   * Whether a unit count means anything here. 100 shares and 5 tola do; a plot
   * and a share of a factory do not, and forcing a number on them produces a
   * fake "1 unit at Rs 20,00,000" that helps nobody.
   */
  hasUnits: boolean;
  unitLabel?: string;
  /** Typical annual return, shown as placeholder text only. Never applied. */
  hint: string;
};

export const INVESTMENT_KINDS: InvestmentKindDef[] = [
  {
    key: "nss",
    label: "National Savings",
    labelUr: "قومی بچت",
    icon: "Landmark",
    hasUnits: false,
    hint: "Behbood, Pensioners, Regular Income, Defence Savings — profit paid in cash, value stays flat.",
  },
  {
    key: "prize_bond",
    label: "Prize bond",
    labelUr: "پرائز بانڈ",
    icon: "Ticket",
    hasUnits: true,
    unitLabel: "bonds",
    hint: "Face value never changes. The return is the draw, so record a win as a payout.",
  },
  {
    key: "psx",
    label: "Shares (PSX)",
    labelUr: "حصص",
    icon: "TrendingUp",
    hasUnits: true,
    unitLabel: "shares",
    hint: "Enter how many and what you paid. Update the price to re-value the lot.",
  },
  {
    key: "mutual_fund",
    label: "Mutual fund",
    labelUr: "میوچل فنڈ",
    icon: "ChartPie",
    hasUnits: true,
    unitLabel: "units",
    hint: "Meezan, UBL, Al Meezan. Dividends are usually reinvested rather than paid out.",
  },
  {
    key: "gold",
    label: "Gold & silver",
    labelUr: "سونا",
    icon: "Gem",
    hasUnits: true,
    unitLabel: "tola",
    hint: "Held in tola. Update the rate and the whole holding re-values itself.",
  },
  {
    key: "property",
    label: "Plot or property",
    labelUr: "جائیداد",
    icon: "Map",
    hasUnits: false,
    hint: "A plot file, a shop, a house. No units — just what it is worth today.",
  },
  {
    key: "business",
    label: "Business stake",
    labelUr: "کاروبار",
    icon: "Factory",
    hasUnits: false,
    hint: "A share of a factory, a shop or a partnership. Profit arrives as a payout.",
  },
  {
    key: "fixed_deposit",
    label: "Term deposit",
    labelUr: "مدتی کھاتہ",
    icon: "Vault",
    hasUnits: false,
    hint: "A bank TDR or a fixed deposit with a maturity date.",
  },
  {
    key: "foreign_currency",
    label: "Foreign currency",
    labelUr: "غیر ملکی کرنسی",
    icon: "Globe",
    hasUnits: true,
    unitLabel: "USD",
    hint: "Dollars held as a store of value. Re-value at today's rate.",
  },
  { key: "crypto", label: "Crypto", labelUr: "کرپٹو", icon: "Bitcoin", hasUnits: true, unitLabel: "coins", hint: "Held off-exchange. Volatile — re-value often." },
  { key: "other", label: "Something else", labelUr: "دیگر", icon: "Boxes", hasUnits: false, hint: "Anything the list above does not cover." },
];

export function investmentKind(key: string | null | undefined): InvestmentKindDef {
  return INVESTMENT_KINDS.find((k) => k.key === key) ?? INVESTMENT_KINDS[INVESTMENT_KINDS.length - 1];
}

export const INVESTMENT_STATUSES: {
  key: InvestmentStatus;
  label: string;
  hint: string;
}[] = [
  { key: "active", label: "Active", hint: "Still held, still earning." },
  { key: "matured", label: "Matured", hint: "Its term is up but the money has not come back yet." },
  { key: "sold", label: "Sold", hint: "Disposed of. Records what it went for." },
  { key: "closed", label: "Closed", hint: "Wound up or withdrawn." },
];

export const PAYOUT_FREQUENCIES: {
  key: PayoutFrequency;
  label: string;
  /** Payments per year. `null` where the question does not apply. */
  perYear: number | null;
}[] = [
  { key: "monthly", label: "Every month", perYear: 12 },
  { key: "quarterly", label: "Every 3 months", perYear: 4 },
  { key: "biannual", label: "Twice a year", perYear: 2 },
  { key: "annual", label: "Once a year", perYear: 1 },
  { key: "on_maturity", label: "All at maturity", perYear: null },
  { key: "none", label: "Never — value just grows", perYear: null },
];

export function payoutsPerYear(frequency: PayoutFrequency): number | null {
  return PAYOUT_FREQUENCIES.find((f) => f.key === frequency)?.perYear ?? null;
}

/* -------------------------------------------------------------------------- *
 * What a holding has done
 * -------------------------------------------------------------------------- */

/**
 * Total return, in paisa.
 *
 * Two components, and BOTH are needed or half the catalogue reads as flat:
 *
 *   capital  — what it is worth now, less what you paid. Shares and gold live
 *              here. A Behbood certificate never moves on this axis.
 *   income   — cash payouts that actually arrived. Behbood lives here, and if
 *              you only measured capital it would show a lifetime return of
 *              zero on the best-performing thing most Pakistani savers own.
 *
 * Reinvested payouts are deliberately excluded from `income`: no cash arrived,
 * and the money is already inside `current_value_paisa`. Counting it in both
 * places is the same double-count the ledger bridge exists to avoid.
 */
export function investmentReturn(
  holding: Investment,
  payouts: InvestmentPayout[],
): { capitalPaisa: number; incomePaisa: number; totalPaisa: number } {
  const settledValue =
    holding.exit_value_paisa !== null ? holding.exit_value_paisa : holding.current_value_paisa;

  const capitalPaisa = settledValue - holding.principal_paisa;
  const incomePaisa = payouts
    .filter((p) => p.destination === "received")
    .reduce((sum, p) => sum + Number(p.amount_paisa), 0);

  return { capitalPaisa, incomePaisa, totalPaisa: capitalPaisa + incomePaisa };
}

/** Total return as a fraction of what was put in. Null when nothing was. */
export function investmentReturnFraction(
  holding: Investment,
  payouts: InvestmentPayout[],
): number | null {
  if (holding.principal_paisa <= 0) return null;
  return investmentReturn(holding, payouts).totalPaisa / holding.principal_paisa;
}

/** Whole days held, floored at 1 so a same-day holding cannot divide by zero. */
export function daysHeld(holding: Investment, today = new Date()): number {
  const start = new Date(holding.purchase_date);
  const end = holding.exit_date ? new Date(holding.exit_date) : today;
  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000);
  return Math.max(1, days);
}

/**
 * Annualised return — the number that makes two holdings comparable.
 *
 * 8% earned over four months is not worse than 15% earned over three years, and
 * a list sorted on raw return says it is. Simple annualisation rather than a
 * compounded CAGR: it is what a plain reading of "per year" means, and a holding
 * three weeks old should not be reported as making 400% a year, which is why
 * anything under 60 days returns null instead of a headline.
 */
export function annualisedReturnFraction(
  holding: Investment,
  payouts: InvestmentPayout[],
  today = new Date(),
): number | null {
  const fraction = investmentReturnFraction(holding, payouts);
  if (fraction === null) return null;

  const days = daysHeld(holding, today);
  if (days < 60) return null;

  return (fraction * 365) / days;
}

/** Days until the money is expected back. Negative means it is overdue. */
export function daysToExit(holding: Investment, today = new Date()): number | null {
  if (!holding.expected_exit_date) return null;
  const exit = new Date(holding.expected_exit_date);
  return Math.round((exit.getTime() - today.getTime()) / 86_400_000);
}

/** Holdings still in play. Matured counts — the money has not returned yet. */
export function isOpen(holding: Investment): boolean {
  return holding.status === "active" || holding.status === "matured";
}

/* -------------------------------------------------------------------------- *
 * Portfolio totals
 * -------------------------------------------------------------------------- */

export type PortfolioTotals = {
  /** What you put in, across everything still held. */
  investedPaisa: number;
  /** What it is worth today. */
  valuePaisa: number;
  /** Value less cost — unrealised. */
  capitalPaisa: number;
  /** Cash payouts that arrived, over all time, closed holdings included. */
  incomePaisa: number;
  /** Realised gain on holdings that have been sold or closed. */
  realisedPaisa: number;
  openCount: number;
  closedCount: number;
};

export function portfolioTotals(
  holdings: Investment[],
  payoutsByHolding: Record<string, InvestmentPayout[]>,
): PortfolioTotals {
  let investedPaisa = 0;
  let valuePaisa = 0;
  let incomePaisa = 0;
  let realisedPaisa = 0;
  let openCount = 0;
  let closedCount = 0;

  for (const holding of holdings) {
    const payouts = payoutsByHolding[holding.id] ?? [];
    const { capitalPaisa, incomePaisa: income } = investmentReturn(holding, payouts);

    // Income counts whether or not the holding is still open — a certificate
    // cashed out last year still paid you real money this year.
    incomePaisa += income;

    if (isOpen(holding)) {
      investedPaisa += Number(holding.principal_paisa);
      valuePaisa += Number(holding.current_value_paisa);
      openCount += 1;
    } else {
      realisedPaisa += capitalPaisa;
      closedCount += 1;
    }
  }

  return {
    investedPaisa,
    valuePaisa,
    capitalPaisa: valuePaisa - investedPaisa,
    incomePaisa,
    realisedPaisa,
    openCount,
    closedCount,
  };
}

/* -------------------------------------------------------------------------- *
 * Profit over time — weekly, monthly, yearly
 * -------------------------------------------------------------------------- */

export type PayoutPeriod = "week" | "month" | "quarter" | "year";

/** ISO Monday of the week containing `date`, as YYYY-MM-DD. */
function weekStart(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // getUTCDay is 0 for Sunday; shift so Monday is the start of the week.
  const offset = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

/** The bucket key a payout falls into, for the given grain. */
export function periodKey(isoDate: string, period: PayoutPeriod): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  switch (period) {
    case "week":
      return weekStart(date);
    case "month":
      return isoDate.slice(0, 7);
    case "quarter":
      return `${isoDate.slice(0, 4)}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
    case "year":
      return isoDate.slice(0, 4);
  }
}

export type PayoutBucket = {
  key: string;
  label: string;
  receivedPaisa: number;
  reinvestedPaisa: number;
  count: number;
  /**
   * The rows this bucket totals, newest first.
   *
   * Carried so the roll-up can be OPENED. A period row is an aggregate, and an
   * aggregate has no edit or delete — correcting a profit typed as 115000
   * instead of 11500 means reaching the individual payment, which the summary
   * alone could not do.
   */
  payouts: InvestmentPayout[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function bucketLabel(key: string, period: PayoutPeriod): string {
  switch (period) {
    case "week":
      return `Week of ${new Date(`${key}T00:00:00Z`).getUTCDate()} ${MONTHS[new Date(`${key}T00:00:00Z`).getUTCMonth()]}`;
    case "month":
      return `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
    case "quarter":
    case "year":
      return key;
  }
}

/**
 * Payouts rolled up by period, newest first.
 *
 * Received and reinvested are kept apart rather than summed. "Rs 34,500 came
 * into your account" and "Rs 34,500 was rolled back into the fund" are different
 * facts, and only the first one is money you could have spent.
 */
export function payoutsByPeriod(
  payouts: InvestmentPayout[],
  period: PayoutPeriod,
): PayoutBucket[] {
  const buckets = new Map<string, PayoutBucket>();

  for (const payout of payouts) {
    const key = periodKey(payout.date, period);
    const bucket = buckets.get(key) ?? {
      key,
      label: bucketLabel(key, period),
      receivedPaisa: 0,
      reinvestedPaisa: 0,
      count: 0,
      payouts: [],
    };

    if (payout.destination === "received") bucket.receivedPaisa += Number(payout.amount_paisa);
    else bucket.reinvestedPaisa += Number(payout.amount_paisa);
    bucket.count += 1;
    bucket.payouts.push(payout);

    buckets.set(key, bucket);
  }

  for (const bucket of buckets.values()) {
    bucket.payouts.sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  return [...buckets.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
}

/**
 * What the holding is expected to pay in a year, from its own stated rate.
 *
 * A projection, never a record — nothing on the page adds this to real money.
 * It exists so a certificate bought last week can still say what it is FOR.
 */
export function projectedAnnualIncomePaisa(holding: Investment): number | null {
  if (holding.expected_return_pct === null || !isOpen(holding)) return null;
  if (payoutsPerYear(holding.payout_frequency) === null) return null;
  return Math.round((Number(holding.principal_paisa) * Number(holding.expected_return_pct)) / 100);
}

/* -------------------------------------------------------------------------- *
 * Search and sort
 * -------------------------------------------------------------------------- */

export type InvestmentSort =
  | "value_desc"
  | "return_desc"
  | "annualised_desc"
  | "exit_soonest"
  | "newest";

export const INVESTMENT_SORTS: { key: InvestmentSort; label: string }[] = [
  { key: "value_desc", label: "Largest first" },
  { key: "return_desc", label: "Best total return" },
  { key: "annualised_desc", label: "Best per year" },
  { key: "exit_soonest", label: "Maturing soonest" },
  { key: "newest", label: "Recently added" },
];

/**
 * Free-text match across everything visible on the card.
 *
 * Deliberately includes the KIND LABEL, not just the name: someone typing
 * "gold" expects their tola holding back even though the row is called
 * "Mother's set". Same reason the note and the unit label are in here.
 */
export function matchesQuery(
  holding: Investment,
  query: string,
  institutionName?: string | null,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const haystack = [
    holding.name,
    investmentKind(holding.kind).label,
    investmentKind(holding.kind).labelUr,
    holding.note,
    holding.unit_label,
    institutionName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Every word must appear somewhere, so "gold 2024" narrows rather than widens.
  return q.split(/\s+/).every((word) => haystack.includes(word));
}

export function sortInvestments(
  holdings: Investment[],
  payoutsByHolding: Record<string, InvestmentPayout[]>,
  sort: InvestmentSort,
  today = new Date(),
): Investment[] {
  const rows = [...holdings];

  switch (sort) {
    case "value_desc":
      return rows.sort((a, b) => Number(b.current_value_paisa) - Number(a.current_value_paisa));

    case "return_desc":
      return rows.sort(
        (a, b) =>
          (investmentReturnFraction(b, payoutsByHolding[b.id] ?? []) ?? -Infinity) -
          (investmentReturnFraction(a, payoutsByHolding[a.id] ?? []) ?? -Infinity),
      );

    case "annualised_desc":
      return rows.sort(
        (a, b) =>
          (annualisedReturnFraction(b, payoutsByHolding[b.id] ?? [], today) ?? -Infinity) -
          (annualisedReturnFraction(a, payoutsByHolding[a.id] ?? [], today) ?? -Infinity),
      );

    case "exit_soonest":
      // Holdings with no exit date sort last rather than first — an unknown
      // date is not "due today", which is what a null would sort as.
      return rows.sort((a, b) => {
        const aExit = a.expected_exit_date ?? "9999-12-31";
        const bExit = b.expected_exit_date ?? "9999-12-31";
        return aExit < bExit ? -1 : aExit > bExit ? 1 : 0;
      });

    case "newest":
      return rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }
}
