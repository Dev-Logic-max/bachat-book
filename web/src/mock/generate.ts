import { hijriMonth } from "@/lib/format";
import { CATEGORY_BY_ID, MERCHANTS } from "./catalog";
import type {
  Account,
  Bill,
  Budget,
  Committee,
  Dataset,
  InvestmentPlan,
  NetWorthPoint,
  Task,
  Transaction,
} from "./types";

/**
 * A household in Karachi: salaried IT job, rented house, two kids in school,
 * one car on lease, a committee running, some savings certificates and gold.
 *
 * Everything is seeded and the "today" is pinned, so two runs of the screenshot
 * loop produce byte-identical data and any visual diff is a real design change.
 */

/**
 * Pinned late in the month so the dashboard has a realistically populated
 * month-to-date: salary in, fixed bills paid, budgets part-consumed. On the 3rd
 * every screen would read as an empty state.
 */
export const TODAY = new Date("2026-08-22T00:00:00Z");
const MONTHS_BACK = 18;
const RS = 100; // paisa per rupee

/**
 * Market rates the fixtures price against. Real 2026 Pakistani levels — gold
 * near Rs 4.3 lakh per tola matters, because nisab is derived from it.
 */
export const RATES = {
  goldPerTolaPaisa: 430_000 * RS,
  silverPerTolaPaisa: 4_200 * RS,
  usdPkr: 291.5,
  cpiYoY: 0.078,
};

/** mulberry32 — small, fast, and deterministic across platforms. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = rng(20260805);

const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
const rupees = (lo: number, hi: number) => Math.round(between(lo, hi) / 50) * 50 * RS;
const pick = <T>(xs: T[]): T => xs[Math.floor(rand() * xs.length)];
const chance = (p: number) => rand() < p;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const at = (y: number, m: number, day: number) =>
  new Date(Date.UTC(y, m, Math.min(day, new Date(Date.UTC(y, m + 1, 0)).getUTCDate())));

// ── Accounts ────────────────────────────────────────────────────────────────

export const ACCOUNTS: Account[] = [
  {
    id: "acc-hbl",
    name: "HBL Current",
    kind: "bank",
    institutionId: "hbl",
    currency: "PKR",
    balancePaisa: 842_500 * RS,
    last4: "4417",
  },
  {
    id: "acc-meezan",
    name: "Meezan Savings",
    kind: "bank",
    institutionId: "meezan",
    currency: "PKR",
    balancePaisa: 1_685_000 * RS,
    last4: "9032",
    islamic: true,
  },
  {
    id: "acc-alfalah-cc",
    name: "Alfalah Platinum",
    kind: "credit_card",
    institutionId: "alfalah",
    currency: "PKR",
    balancePaisa: -168_400 * RS,
    last4: "7781",
  },
  {
    id: "acc-jazzcash",
    name: "JazzCash",
    kind: "wallet",
    institutionId: "jazzcash",
    currency: "PKR",
    balancePaisa: 24_300 * RS,
  },
  {
    id: "acc-sadapay",
    name: "SadaPay",
    kind: "wallet",
    institutionId: "sadapay",
    currency: "PKR",
    balancePaisa: 61_750 * RS,
    last4: "2264",
  },
  {
    id: "acc-cash",
    name: "Cash in hand",
    kind: "cash",
    institutionId: null,
    currency: "PKR",
    balancePaisa: 38_000 * RS,
  },
];

const MAIN = "acc-hbl";
const CARD = "acc-alfalah-cc";
const WALLET = "acc-jazzcash";

// ── Recurring skeleton ──────────────────────────────────────────────────────

type Fixed = {
  day: number;
  merchantId: string | null;
  categoryId: string;
  accountId: string;
  amount: number;
  label?: string;
};

/** Same every month, to the rupee — the backbone a real ledger hangs off. */
const FIXED: Fixed[] = [
  { day: 3, merchantId: null, categoryId: "rent", accountId: MAIN, amount: 125_000, label: "House rent" },
  { day: 1, merchantId: null, categoryId: "maid", accountId: "acc-cash", amount: 18_000, label: "Maid salary" },
  { day: 1, merchantId: null, categoryId: "driver", accountId: "acc-cash", amount: 42_000, label: "Driver salary" },
  { day: 1, merchantId: null, categoryId: "chowkidar", accountId: "acc-cash", amount: 9_000, label: "Chowkidar" },
  { day: 2, merchantId: "doodhwala", categoryId: "doodh", accountId: "acc-cash", amount: 11_400 },
  { day: 5, merchantId: "stormfiberbill", categoryId: "internet", accountId: MAIN, amount: 5_500 },
  { day: 5, merchantId: null, categoryId: "society", accountId: MAIN, amount: 4_500, label: "Society maintenance" },
  { day: 7, merchantId: null, categoryId: "emi", accountId: MAIN, amount: 48_000, label: "Car lease instalment" },
  { day: 8, merchantId: "jazzbill", categoryId: "mobile", accountId: WALLET, amount: 2_500 },
  { day: 10, merchantId: "kwsbbill", categoryId: "water", accountId: MAIN, amount: 1_800 },
  { day: 10, merchantId: null, categoryId: "committee", accountId: MAIN, amount: 50_000, label: "Committee — Gulshan circle" },
  { day: 14, merchantId: "netflix", categoryId: "subscriptions", accountId: CARD, amount: 1_450 },
  { day: 20, merchantId: "spotify", categoryId: "subscriptions", accountId: CARD, amount: 599 },
  { day: 22, merchantId: "youtube", categoryId: "subscriptions", accountId: CARD, amount: 899 },
  { day: 25, merchantId: null, categoryId: "insurance", accountId: MAIN, amount: 12_000, label: "Family takaful" },
  { day: 1, merchantId: null, categoryId: "gym", accountId: MAIN, amount: 6_500, label: "Gym membership" },
];

/** Electricity swings hard with the AC season; gas swings the opposite way. */
function electricityFor(month: number): number {
  const summer = [4, 5, 6, 7, 8]; // May–Sep
  const shoulder = [3, 9];
  if (summer.includes(month)) return Math.round(between(52_000, 78_000));
  if (shoulder.includes(month)) return Math.round(between(30_000, 44_000));
  return Math.round(between(17_000, 26_000));
}

function gasFor(month: number): number {
  const winter = [10, 11, 0, 1]; // Nov–Feb
  if (winter.includes(month)) return Math.round(between(9_000, 17_000));
  return Math.round(between(2_200, 4_500));
}

// ── Generation ──────────────────────────────────────────────────────────────

function generateTransactions(): Transaction[] {
  const out: Transaction[] = [];
  let n = 0;
  const add = (t: Omit<Transaction, "id">) => {
    out.push({ ...t, id: `txn-${String(++n).padStart(5, "0")}` });
  };

  const start = new Date(
    Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth() - MONTHS_BACK, 1),
  );

  for (let i = 0; i <= MONTHS_BACK; i++) {
    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    const y = cursor.getUTCFullYear();
    const mo = cursor.getUTCMonth();
    const daysInMonth = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();

    const inMonth = (day: number) => at(y, mo, day) <= TODAY;

    // Salary — credited on the 1st for the month just worked, which is the
    // common Pakistani cycle. Steps up at the July increment.
    //
    // Sized against the outgoings below, not picked in isolation: rent 125k,
    // three staff at 69k, a car lease and Beaconhouse fees describe a household
    // earning north of Rs 7 lakh. At 385k the ledger showed spending above
    // income every month while net worth climbed — two contradictory stories.
    const salaryDay = 1;
    const base = y >= 2026 && mo >= 6 ? 812_000 : y >= 2026 ? 755_000 : 672_000;
    if (inMonth(salaryDay)) {
      add({
        date: iso(at(y, mo, salaryDay)),
        accountId: MAIN,
        merchantId: "employer",
        categoryId: "salary",
        amountPaisa: base * RS,
        kind: "income",
        note: "Monthly salary",
      });
    }

    // Rent from an inherited flat in Nazimabad — a very common second income.
    if (inMonth(5)) {
      add({
        date: iso(at(y, mo, 5)),
        accountId: MAIN,
        merchantId: null,
        categoryId: "rental",
        amountPaisa: 45_000 * RS,
        kind: "income",
        note: "Flat rent — Nazimabad",
      });
    }

    // Fixed obligations.
    for (const f of FIXED) {
      if (!inMonth(f.day)) continue;
      add({
        date: iso(at(y, mo, f.day)),
        accountId: f.accountId,
        merchantId: f.merchantId,
        categoryId: f.categoryId,
        amountPaisa: -f.amount * RS,
        kind: "expense",
        note: f.label,
      });
    }

    // Utilities — variable by season.
    if (inMonth(12)) {
      add({
        date: iso(at(y, mo, 12)),
        accountId: MAIN,
        merchantId: "kelectric",
        categoryId: "electricity",
        amountPaisa: -electricityFor(mo) * RS,
        kind: "expense",
      });
    }
    if (inMonth(15)) {
      add({
        date: iso(at(y, mo, 15)),
        accountId: MAIN,
        merchantId: "sngplbill",
        categoryId: "gas",
        amountPaisa: -gasFor(mo) * RS,
        kind: "expense",
      });
    }

    // School fees — quarterly.
    if ([0, 3, 6, 9].includes(mo) && inMonth(10)) {
      add({
        date: iso(at(y, mo, 10)),
        accountId: MAIN,
        merchantId: "beaconhouse",
        categoryId: "schoolfee",
        amountPaisa: -145_000 * RS,
        kind: "expense",
        note: "Term fee — two children",
      });
    }

    // Freelance USD, roughly quarterly, with the FX rate snapshotted.
    if (mo % 3 === 1 && inMonth(18)) {
      const usd = Math.round(between(700, 1_800));
      const rate = between(281, 296);
      add({
        date: iso(at(y, mo, 18)),
        accountId: "acc-sadapay",
        merchantId: "payoneer",
        categoryId: "freelance",
        amountPaisa: Math.round(usd * rate) * RS,
        kind: "income",
        originalCurrency: "USD",
        originalAmount: usd,
        fxRate: Number(rate.toFixed(2)),
        note: "Payoneer withdrawal",
      });
    }

    // Profit on savings certificates, with withholding deducted at source.
    if (mo % 6 === 0 && inMonth(6)) {
      const gross = Math.round(between(38_000, 46_000));
      add({
        date: iso(at(y, mo, 6)),
        accountId: "acc-meezan",
        merchantId: "cdnsprofit",
        categoryId: "profit",
        amountPaisa: Math.round(gross * 0.85) * RS,
        kind: "income",
        withholdingPaisa: Math.round(gross * 0.15) * RS,
        note: "Profit on certificates (15% WHT, filer)",
      });
    }

    // ── Seasonal, driven off the Hijri calendar, not hardcoded dates ────────
    const hijriOf = (day: number) => hijriMonth(at(y, mo, day));
    const ramadanDays = Array.from({ length: daysInMonth }, (_, d) => d + 1).filter(
      (d) => hijriOf(d) === 9,
    );
    const hajjDays = Array.from({ length: daysInMonth }, (_, d) => d + 1).filter(
      (d) => hijriOf(d) === 12,
    );
    const shawwalDays = Array.from({ length: daysInMonth }, (_, d) => d + 1).filter(
      (d) => hijriOf(d) === 10,
    );
    const isRamadan = ramadanDays.length > 3;
    const eidFitr = shawwalDays.length > 0 ? shawwalDays[0] : null;

    // Zakat — paid at the start of Ramadan, on the lunar anniversary.
    if (isRamadan && inMonth(ramadanDays[0])) {
      add({
        date: iso(at(y, mo, ramadanDays[0])),
        accountId: "acc-meezan",
        merchantId: null,
        categoryId: "zakat",
        amountPaisa: -Math.round(between(148_000, 172_000)) * RS,
        kind: "expense",
        note: "Annual Zakat",
      });
    }

    // Qurbani — Zil Hajj.
    if (hajjDays.length > 8 && inMonth(hajjDays[8])) {
      add({
        date: iso(at(y, mo, hajjDays[8])),
        accountId: "acc-cash",
        merchantId: null,
        categoryId: "qurbani",
        amountPaisa: -Math.round(between(155_000, 185_000)) * RS,
        kind: "expense",
        note: "Qurbani — bakra",
      });
    }

    // Eid — clothing burst and Eidi.
    if (eidFitr && inMonth(eidFitr)) {
      for (const brand of ["khaadi", "gulahmed", "junaidjamshed", "sapphire"].slice(0, 2 + Math.floor(rand() * 3))) {
        add({
          date: iso(at(y, mo, Math.max(1, eidFitr - Math.floor(between(2, 9))))),
          accountId: CARD,
          merchantId: brand,
          categoryId: "clothing",
          amountPaisa: -rupees(14_000, 46_000),
          kind: "expense",
          note: "Eid shopping",
        });
      }
      add({
        date: iso(at(y, mo, eidFitr)),
        accountId: "acc-cash",
        merchantId: null,
        categoryId: "eidi",
        amountPaisa: -rupees(22_000, 45_000),
        kind: "expense",
        note: "Eidi",
      });
    }

    // ── Everyday variable spend ────────────────────────────────────────────
    const groceryMultiplier = isRamadan ? 1.7 : 1;

    // Weekly kiryana run.
    for (let w = 0; w < 4; w++) {
      const day = 3 + w * 7 + Math.floor(between(0, 3));
      if (!inMonth(day) || day > daysInMonth) continue;
      add({
        date: iso(at(y, mo, day)),
        accountId: chance(0.6) ? CARD : MAIN,
        merchantId: pick(["imtiaz", "alfatah", "naheed", "chaseup", "carrefour"]),
        categoryId: "kiryana",
        amountPaisa: -Math.round(rupees(13_000, 31_000) * groceryMultiplier),
        kind: "expense",
      });
    }

    // Sabzi twice a week, meat weekly.
    for (let k = 0; k < 8; k++) {
      const day = 2 + Math.floor(between(0, daysInMonth - 2));
      if (!inMonth(day)) continue;
      add({
        date: iso(at(y, mo, day)),
        accountId: "acc-cash",
        merchantId: "sabzimandi",
        categoryId: "sabzi",
        amountPaisa: -Math.round(rupees(1_100, 3_400) * groceryMultiplier),
        kind: "expense",
      });
    }
    for (let k = 0; k < 4; k++) {
      const day = 4 + k * 7;
      if (!inMonth(day) || day > daysInMonth) continue;
      add({
        date: iso(at(y, mo, day)),
        accountId: "acc-cash",
        merchantId: "alrahim",
        categoryId: "meat",
        amountPaisa: -Math.round(rupees(3_200, 8_400) * groceryMultiplier),
        kind: "expense",
      });
    }

    // Petrol — clustered near the fortnightly OGRA price revisions.
    for (const anchor of [2, 9, 17, 24]) {
      const day = anchor + Math.floor(between(0, 3));
      if (!inMonth(day) || day > daysInMonth) continue;
      add({
        date: iso(at(y, mo, day)),
        accountId: chance(0.5) ? CARD : MAIN,
        merchantId: pick(["pso", "shell", "totalparco"]),
        categoryId: "petrol",
        amountPaisa: -rupees(6_500, 11_500),
        kind: "expense",
      });
    }

    // Delivery, dining, ride-hailing, chai, pharmacy, salon.
    const scatter = (
      count: number,
      merchantIds: string[],
      categoryId: string,
      lo: number,
      hi: number,
      accountId?: string,
    ) => {
      for (let k = 0; k < count; k++) {
        const day = 1 + Math.floor(between(0, daysInMonth));
        if (!inMonth(day)) continue;
        add({
          date: iso(at(y, mo, day)),
          accountId: accountId ?? (chance(0.55) ? CARD : WALLET),
          merchantId: pick(merchantIds),
          categoryId,
          amountPaisa: -rupees(lo, hi),
          kind: "expense",
        });
      }
    };

    scatter(isRamadan ? 4 : 7, ["foodpanda"], "delivery", 1_400, 5_200);
    scatter(3, ["kfc", "mcdonalds", "cheezious", "broadway", "johnnyjugnu", "kababjees", "studentbiryani"], "restaurant", 3_200, 14_000);
    scatter(9, ["careem", "bykea", "indrive"], "ridehail", 350, 1_900, WALLET);
    scatter(5, ["gloria", "chaiwala"], "chai", 550, 2_400);
    scatter(2, ["dvago"], "pharmacy", 900, 4_800);
    if (chance(0.5)) scatter(1, ["chughtai"], "lab", 2_500, 9_000);
    if (chance(0.7)) scatter(1, ["daraz"], "electronics", 3_500, 38_000);
    if (chance(0.4)) scatter(1, ["bata", "servis"], "footwear", 4_500, 16_000);

    // Cash withdrawal — carries the filer withholding rate above Rs 50,000.
    if (inMonth(16)) {
      const amt = rupees(60_000, 120_000);
      add({
        date: iso(at(y, mo, 16)),
        accountId: MAIN,
        merchantId: null,
        categoryId: "withholding",
        amountPaisa: -Math.round(amt * 0.006),
        kind: "expense",
        note: "WHT on cash withdrawal (0.6% filer)",
      });
    }
  }

  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

// ── Derived collections ─────────────────────────────────────────────────────

/**
 * A rolling forward window, not "this calendar month". On the 22nd almost every
 * bill for the month is already paid, and an Upcoming panel showing one row is
 * a design artefact rather than a real state.
 */
function buildBills(): Bill[] {
  const spec: Array<[string, string, string | null, string, number, number, boolean]> = [
    ["ke", "K-Electric", "kelectric", "electricity", 12, 61_400, false],
    ["gas", "SNGPL", "sngplbill", "gas", 15, 3_150, false],
    ["water", "KWSB", "kwsbbill", "water", 10, 1_800, true],
    ["net", "StormFiber", "stormfiberbill", "internet", 5, 5_500, true],
    ["emi", "Car lease instalment", null, "emi", 7, 48_000, true],
    ["committee", "Committee — Gulshan circle", null, "committee", 10, 50_000, true],
    ["takaful", "Family takaful", null, "insurance", 25, 12_000, true],
    ["rent", "House rent", null, "rent", 3, 125_000, true],
    ["staff", "Household staff", null, "staff", 1, 69_000, true],
  ];

  const out: Bill[] = [];
  const horizon = new Date(TODAY.getTime() + 45 * 86_400_000);

  for (let offset = 0; offset <= 1; offset++) {
    const y = TODAY.getUTCFullYear();
    const mo = TODAY.getUTCMonth() + offset;
    for (const [key, name, merchantId, categoryId, day, amount, fixed] of spec) {
      const due = at(y, mo, day);
      if (due < TODAY || due > horizon) continue;
      out.push({
        id: `bill-${key}-${offset}`,
        name,
        merchantId,
        categoryId,
        accountId: MAIN,
        // Utilities are never the same twice; fixed obligations are.
        amountPaisa: Math.round(fixed ? amount : amount * between(0.82, 1.18)) * RS,
        dueDate: iso(due),
        status: "due",
        fixed,
      });
    }
  }

  // Quarterly school fee, if it lands inside the window.
  const feeMonth = [0, 3, 6, 9].find(
    (m) => at(TODAY.getUTCFullYear(), m, 10) >= TODAY && at(TODAY.getUTCFullYear(), m, 10) <= horizon,
  );
  if (feeMonth !== undefined) {
    out.push({
      id: "bill-school",
      name: "Beaconhouse term fee",
      merchantId: "beaconhouse",
      categoryId: "schoolfee",
      accountId: MAIN,
      amountPaisa: 145_000 * RS,
      dueDate: iso(at(TODAY.getUTCFullYear(), feeMonth, 10)),
      status: "due",
      fixed: true,
    });
  }

  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

function buildBudgets(transactions: Transaction[]): Budget[] {
  const monthKey = TODAY.toISOString().slice(0, 7);
  const spentBy = new Map<string, number>();

  for (const t of transactions) {
    if (!t.date.startsWith(monthKey) || t.amountPaisa >= 0) continue;
    const cat = CATEGORY_BY_ID[t.categoryId];
    const rootId = cat?.parentId ?? t.categoryId;
    spentBy.set(rootId, (spentBy.get(rootId) ?? 0) + Math.abs(t.amountPaisa));
  }

  const limits: Array<[string, number]> = [
    ["food", 165_000],
    ["transport", 62_000],
    ["home", 235_000],
    ["shopping", 55_000],
    ["health", 25_000],
    ["personal", 18_000],
  ];

  return limits.map(([categoryId, limit]) => ({
    id: `budget-${categoryId}`,
    categoryId,
    limitPaisa: limit * RS,
    spentPaisa: spentBy.get(categoryId) ?? 0,
  }));
}

function buildNetWorth(): NetWorthPoint[] {
  const points: NetWorthPoint[] = [];
  let assets = 6_420_000;
  let liabilities = 1_980_000;

  for (let i = MONTHS_BACK; i >= 0; i--) {
    const d = new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth() - i, 1));
    // Savings accumulate; the lease amortises down.
    assets += between(95_000, 220_000);
    // Gold and the plot file revalue in bursts, not smoothly.
    if (chance(0.3)) assets += between(60_000, 240_000);
    liabilities = Math.max(0, liabilities - between(38_000, 52_000));
    points.push({
      date: iso(d),
      assetsPaisa: Math.round(assets) * RS,
      liabilitiesPaisa: Math.round(liabilities) * RS,
    });
  }
  return points;
}

const COMMITTEES: Committee[] = [
  {
    id: "cmt-gulshan",
    name: "Gulshan circle",
    monthlyPaisa: 50_000 * RS,
    startDate: "2026-01-10",
    currentMonth: 8,
    accountId: MAIN,
    members: [
      { id: "cm-1", name: "Adnan bhai", payoutMonth: 1, paidThisMonth: true },
      { id: "cm-2", name: "Sana apa", payoutMonth: 2, paidThisMonth: true },
      { id: "cm-3", name: "Faisal", payoutMonth: 3, paidThisMonth: true },
      { id: "cm-4", name: "Nadia", payoutMonth: 4, paidThisMonth: true },
      { id: "cm-5", name: "Imran", payoutMonth: 5, paidThisMonth: true },
      { id: "cm-6", name: "Hira", payoutMonth: 6, paidThisMonth: false },
      { id: "cm-7", name: "You", payoutMonth: 7, paidThisMonth: true, isSelf: true },
      { id: "cm-8", name: "Zeeshan", payoutMonth: 8, paidThisMonth: true },
      { id: "cm-9", name: "Ayesha", payoutMonth: 9, paidThisMonth: false },
      { id: "cm-10", name: "Bilal", payoutMonth: 10, paidThisMonth: true },
      { id: "cm-11", name: "Rabia", payoutMonth: 11, paidThisMonth: true },
      { id: "cm-12", name: "Usman", payoutMonth: 12, paidThisMonth: false },
    ],
  },
];

/**
 * Rates are the CDNS schedule effective 5 Jan 2026. Stored on the plan rather
 * than hardcoded in a component, because they get revised.
 */
const PLANS: InvestmentPlan[] = [
  {
    id: "plan-dsc",
    name: "Defence Savings Certificate",
    kind: "nss_certificate",
    provider: "National Savings",
    investedPaisa: 1_500_000 * RS,
    currentPaisa: 1_942_000 * RS,
    startDate: "2023-04-18",
    maturityDate: "2033-04-18",
    ratePct: 11.08,
    xirr: 0.1108,
    shariah: false,
  },
  {
    id: "plan-ssc",
    name: "Special Savings Certificate",
    kind: "nss_certificate",
    provider: "National Savings",
    investedPaisa: 800_000 * RS,
    currentPaisa: 906_400 * RS,
    startDate: "2025-02-10",
    maturityDate: "2028-02-10",
    ratePct: 10.2,
    xirr: 0.1024,
    shariah: false,
  },
  {
    id: "plan-meezan-islamic",
    name: "Meezan Islamic Fund",
    kind: "mutual_fund",
    provider: "Al Meezan",
    investedPaisa: 1_200_000 * RS,
    currentPaisa: 1_614_800 * RS,
    startDate: "2024-07-01",
    xirr: 0.183,
    shariah: true,
  },
  {
    id: "plan-rozana",
    name: "Meezan Rozana Amdani",
    kind: "mutual_fund",
    provider: "Al Meezan",
    investedPaisa: 650_000 * RS,
    currentPaisa: 719_600 * RS,
    startDate: "2025-06-12",
    xirr: 0.106,
    shariah: true,
  },
  {
    id: "plan-psx",
    name: "PSX basket",
    kind: "equity",
    provider: "KMI-30",
    investedPaisa: 900_000 * RS,
    currentPaisa: 1_338_500 * RS,
    startDate: "2024-11-05",
    xirr: 0.271,
    shariah: true,
  },
  {
    id: "plan-gold",
    name: "Gold",
    kind: "gold",
    provider: "Physical, 24k",
    investedPaisa: 2_400_000 * RS,
    currentPaisa: 3_440_000 * RS,
    startDate: "2024-02-20",
    xirr: 0.224,
    shariah: true,
    grams: 93.31, // 8 tola, at Rs 4.3 lakh/tola
  },
  {
    id: "plan-dha",
    name: "DHA Phase 8 plot file",
    kind: "property",
    provider: "DHA Karachi",
    investedPaisa: 3_200_000 * RS,
    currentPaisa: 3_740_000 * RS,
    startDate: "2023-09-14",
    xirr: 0.061,
    shariah: true,
  },
  {
    id: "plan-prizebond",
    name: "Prize bonds — Rs 40,000 premium",
    kind: "prize_bond",
    provider: "National Savings",
    investedPaisa: 120_000 * RS,
    currentPaisa: 120_000 * RS,
    startDate: "2025-03-01",
    xirr: 0.038,
    shariah: false,
  },
];

const TASKS: Task[] = [
  {
    id: "task-1",
    title: "Pay committee — Gulshan circle",
    dueDate: "2026-08-10",
    done: false,
    priority: "high",
    linkedLabel: "Rs 50,000",
  },
  {
    id: "task-2",
    title: "3 receipts unmatched from last week",
    dueDate: "2026-08-06",
    done: false,
    priority: "normal",
    auto: true,
  },
  {
    id: "task-3",
    title: "File FBR return for 2025-26",
    dueDate: "2026-09-30",
    done: false,
    priority: "high",
    linkedLabel: "IRIS",
  },
  {
    id: "task-4",
    title: "Renew car token tax",
    dueDate: "2026-08-22",
    done: false,
    priority: "normal",
  },
  {
    id: "task-5",
    title: "Special Savings Certificate profit due",
    dueDate: "2026-08-10",
    done: false,
    priority: "low",
    auto: true,
    linkedLabel: "Rs 40,800",
  },
  {
    id: "task-6",
    title: "Submit CZ-50 Zakat declaration",
    dueDate: "2027-02-08",
    done: true,
    priority: "normal",
  },
];

// ── Assembled dataset ───────────────────────────────────────────────────────

const transactions = generateTransactions();

export const DATA: Dataset = {
  today: iso(TODAY),
  institutions: [],
  accounts: ACCOUNTS,
  categories: [],
  merchants: MERCHANTS,
  transactions,
  bills: buildBills(),
  budgets: buildBudgets(transactions),
  committees: COMMITTEES,
  plans: PLANS,
  netWorth: buildNetWorth(),
  tasks: TASKS,
};
