import {
  CATEGORIES,
  CATEGORY_BY_ID,
  INSTITUTIONS_WITH_LOGOS,
  INSTITUTION_BY_ID,
  MERCHANTS_WITH_LOGOS,
  MERCHANT_BY_ID,
} from "./catalog";
import { ACCOUNTS, DATA, RATES, TODAY } from "./generate";
import type { Transaction } from "./types";

export * from "./types";
export { CATEGORY_BY_ID, INSTITUTION_BY_ID, MERCHANT_BY_ID };

export const dataset = {
  ...DATA,
  institutions: INSTITUTIONS_WITH_LOGOS,
  categories: CATEGORIES,
  merchants: MERCHANTS_WITH_LOGOS,
};

const monthKey = (d: Date) => d.toISOString().slice(0, 7);
const THIS_MONTH = monthKey(TODAY);
const LAST_MONTH = monthKey(
  new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth() - 1, 1)),
);

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/**
 * `throughDay` clips the window to the same elapsed day. Comparing 22 days of
 * this month against a full prior month reads as a 30% drop in spending that
 * did not happen.
 */
function flows(key: string, throughDay?: number) {
  const rows = dataset.transactions.filter((t) => {
    if (!t.date.startsWith(key)) return false;
    return throughDay ? Number(t.date.slice(8, 10)) <= throughDay : true;
  });
  return {
    inPaisa: sum(rows.filter((t) => t.amountPaisa > 0).map((t) => t.amountPaisa)),
    outPaisa: Math.abs(
      sum(rows.filter((t) => t.amountPaisa < 0).map((t) => t.amountPaisa)),
    ),
  };
}

const elapsedDay = TODAY.getUTCDate();
const thisMonth = flows(THIS_MONTH);
const lastMonth = flows(LAST_MONTH, elapsedDay);
/** Unclipped, so the savings rate is measured over a month that actually ended. */
const lastMonthFull = flows(LAST_MONTH);

const latestNW = dataset.netWorth[dataset.netWorth.length - 1];
const priorNW = dataset.netWorth[dataset.netWorth.length - 2];
const netWorthNow = latestNW.assetsPaisa - latestNW.liabilitiesPaisa;
const netWorthPrior = priorNW.assetsPaisa - priorNW.liabilitiesPaisa;

const investedPaisa = sum(dataset.plans.map((p) => p.investedPaisa));
const portfolioPaisa = sum(dataset.plans.map((p) => p.currentPaisa));

/**
 * Zakat is 2.5% of zakatable wealth — cash, savings, gold and tradeable
 * securities. The plot file and personal-use items are excluded.
 */
const ZAKATABLE_KINDS = new Set(["gold", "mutual_fund", "equity", "nss_certificate"]);

const zakatCashPaisa = sum(
  ACCOUNTS.filter((a) => a.balancePaisa > 0).map((a) => a.balancePaisa),
);
const zakatGoldPaisa = sum(
  dataset.plans.filter((p) => p.kind === "gold").map((p) => p.currentPaisa),
);
const zakatInvestPaisa = sum(
  dataset.plans
    .filter((p) => ZAKATABLE_KINDS.has(p.kind) && p.kind !== "gold")
    .map((p) => p.currentPaisa),
);
const zakatableBase = zakatCashPaisa + zakatGoldPaisa + zakatInvestPaisa;

/**
 * What the obligation is actually computed over. The plot file and the
 * committee position are excluded — property held to live in or hold long-term
 * is not zakatable, and a committee is a receivable that nets to zero.
 */
export const zakatBreakdown = [
  { label: "Cash & bank", paisa: zakatCashPaisa, tone: "var(--chart-2)" },
  { label: "Gold", paisa: zakatGoldPaisa, tone: "var(--chart-1)" },
  { label: "Investments", paisa: zakatInvestPaisa, tone: "var(--chart-3)" },
];

/**
 * Nisab has two standards: 7.5 tola of gold or 52.5 tola of silver. Pakistani
 * practice overwhelmingly uses the SILVER standard — it sits far lower (roughly
 * Rs 2.2 lakh against Rs 32 lakh), so more wealth is caught and more reaches
 * recipients. Gold is offered as the alternative, not the default.
 */
export const NISAB = {
  silverPaisa: Math.round(52.5 * RATES.silverPerTolaPaisa),
  goldPaisa: Math.round(7.5 * RATES.goldPerTolaPaisa),
};

const nisabPaisa = NISAB.silverPaisa;

export const summary = {
  today: dataset.today,
  netWorthPaisa: netWorthNow,
  netWorthDeltaPaisa: netWorthNow - netWorthPrior,
  netWorthDeltaFraction: (netWorthNow - netWorthPrior) / netWorthPrior,

  monthInPaisa: thisMonth.inPaisa,
  monthOutPaisa: thisMonth.outPaisa,
  monthNetPaisa: thisMonth.inPaisa - thisMonth.outPaisa,
  lastMonthOutPaisa: lastMonth.outPaisa,
  spendDeltaFraction:
    lastMonth.outPaisa > 0
      ? (thisMonth.outPaisa - lastMonth.outPaisa) / lastMonth.outPaisa
      : 0,
  /**
   * Month-to-date only. It runs hot early in the month because salary lands on
   * the 1st while spending accrues daily — headline it as a rate and it reads
   * as a 49% saver on the 22nd. Use `savingsRateLastMonth` for anything that
   * claims to describe habit rather than progress.
   */
  savingsRate:
    thisMonth.inPaisa > 0
      ? (thisMonth.inPaisa - thisMonth.outPaisa) / thisMonth.inPaisa
      : 0,
  savingsRateLastMonth:
    lastMonthFull.inPaisa > 0
      ? (lastMonthFull.inPaisa - lastMonthFull.outPaisa) / lastMonthFull.inPaisa
      : 0,
  lastMonthLabel: new Date(`${LAST_MONTH}-01T00:00:00Z`).toLocaleString("en", {
    month: "long",
  }),

  investedPaisa,
  portfolioPaisa,
  portfolioGainPaisa: portfolioPaisa - investedPaisa,
  portfolioGainFraction: (portfolioPaisa - investedPaisa) / investedPaisa,

  zakatablePaisa: zakatableBase,
  nisabPaisa,
  nisabStandard: "silver" as const,
  zakatDuePaisa: zakatableBase > nisabPaisa ? Math.round(zakatableBase * 0.025) : 0,

  goldPerTolaPaisa: RATES.goldPerTolaPaisa,
  usdPkr: RATES.usdPkr,
};

export const recentTransactions = (limit = 8): Transaction[] =>
  dataset.transactions.slice(0, limit);

export const upcomingBills = () =>
  dataset.bills
    .filter((b) => b.status !== "paid")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

/** Last 12 months of net worth, oldest first — the hero chart's series. */
export const netWorthSeries = () =>
  dataset.netWorth.slice(-12).map((p) => ({
    date: p.date,
    value: (p.assetsPaisa - p.liabilitiesPaisa) / 100,
    label: new Date(`${p.date}T00:00:00Z`).toLocaleString("en", {
      month: "short",
    }),
  }));

/** Money in vs money out per month, for the cash-flow block. */
export const cashflowSeries = () => {
  const out: Array<{ label: string; inRs: number; outRs: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth() - i, 1));
    const f = flows(monthKey(d));
    out.push({
      label: d.toLocaleString("en", { month: "short" }),
      inRs: f.inPaisa / 100,
      outRs: f.outPaisa / 100,
    });
  }
  return out;
};

export const committee = dataset.committees[0];

export const committeeStatus = () => {
  const paid = committee.members.filter((m) => m.paidThisMonth).length;
  const self = committee.members.find((m) => m.isSelf);
  return {
    paid,
    total: committee.members.length,
    potPaisa: committee.monthlyPaisa * committee.members.length,
    myPayoutMonth: self?.payoutMonth ?? null,
    collected: (self?.payoutMonth ?? 0) <= committee.currentMonth,
  };
};

export const budgetsWithProgress = () =>
  dataset.budgets.map((b) => ({
    ...b,
    category: CATEGORY_BY_ID[b.categoryId],
    fraction: b.limitPaisa > 0 ? b.spentPaisa / b.limitPaisa : 0,
  }));

export const openTasks = () => dataset.tasks.filter((t) => !t.done);
