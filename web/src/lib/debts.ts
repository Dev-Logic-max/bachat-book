/**
 * Udhaar — lending, borrowing, and the shop's customer khata.
 *
 * ONE feature, two faces. Personal lending (`qarz`) and shop customer khata
 * share these tables; the workspace preset decides which screen you see. A
 * shopkeeper who also lends to family gets both without switching apps.
 *
 * THE RULE THAT GOVERNS ALL OF IT: lending is not spending.
 *
 *   You have Rs 10,000 cash and lend Rs 5,000 to your cousin. Your cash
 *   correctly becomes Rs 5,000. Your dashboard must still say "money out this
 *   month: Rs 0" — the Rs 5,000 appears separately as *owed to me*. Nothing was
 *   spent, so nothing is counted as spending.
 *
 * You still own the money; it has changed from cash into a receivable. Written
 * as an expense it would inflate money-out on the dashboard, in Entries, in
 * every budget and in the tax surfaces — telling the user they spent Rs 5,000
 * on nothing. The writes therefore go through `lib/debt-actions.ts` as
 * ONE-LEGGED TRANSFERS, which every flow figure in the product already excludes
 * by TYPE. See that file for why that shape is safe.
 *
 * This module is pure and JSX-free: readers, derivations and labels only.
 */

import type { DebtDirection, DebtKind, DebtStatus, Tables } from "@/lib/supabase/types";
import { daysUntil } from "@/lib/tasks";

export type Debt = Tables<"debts">;
export type DebtPayment = Tables<"debt_payments">;

/** A debt with its repayments attached, which is how every screen wants it. */
export type DebtWithPayments = Debt & { payments: DebtPayment[] };

/* -------------------------------------------------------------------------- *
 * The derived figure
 * -------------------------------------------------------------------------- */

/** Everything repaid so far, as a positive figure. */
export function repaidPaisa(debt: DebtWithPayments): number {
  return debt.payments.reduce((sum, p) => sum + Number(p.amount_paisa), 0);
}

/**
 * What is still owed. DERIVED, never stored.
 *
 * A stored balance and a payment list disagree the first time a payment is
 * edited, and then there are two numbers and no way to tell which is right.
 *
 * Floors at zero: overpayment is allowed (people round up), but "owes -200"
 * is not a sentence anyone should read. `overpaidByPaisa` carries that instead.
 */
export function outstandingPaisa(debt: DebtWithPayments): number {
  return Math.max(0, Number(debt.principal_paisa) - repaidPaisa(debt));
}

/** How far past the principal the repayments went, or 0. People round up. */
export function overpaidByPaisa(debt: DebtWithPayments): number {
  return Math.max(0, repaidPaisa(debt) - Number(debt.principal_paisa));
}

/** 0 → 1. Used for the progress bar on a debt card. */
export function repaidFraction(debt: DebtWithPayments): number {
  const principal = Number(debt.principal_paisa);
  if (principal <= 0) return 1;
  return Math.min(1, repaidPaisa(debt) / principal);
}

/**
 * Is this debt fully repaid by the numbers?
 *
 * Deliberately separate from `status`. The status is what the user declared;
 * this is what the payments say. They can disagree — someone may record the
 * final payment without pressing "settle" — and the screen should offer to
 * close it rather than silently changing a status the user never chose.
 */
export function isFullyRepaid(debt: DebtWithPayments): boolean {
  return repaidPaisa(debt) >= Number(debt.principal_paisa);
}

/* -------------------------------------------------------------------------- *
 * Totals
 * -------------------------------------------------------------------------- */

export type DebtTotals = {
  /** Still to come back to you. */
  owedToUsPaisa: number;
  /** Still to go out from you. */
  owedByUsPaisa: number;
  /** owedToUs − owedByUs. Positive means more is coming in than going out. */
  netPaisa: number;
  openCount: number;
  overdueCount: number;
};

/**
 * Only `open` debts count toward what is owed.
 *
 * `settled` is finished, and `written_off` is money you have decided is not
 * coming back — carrying either into the running total would overstate what you
 * can actually expect.
 */
export function summariseDebts(debts: DebtWithPayments[]): DebtTotals {
  let owedToUsPaisa = 0;
  let owedByUsPaisa = 0;
  let openCount = 0;
  let overdueCount = 0;

  for (const debt of debts) {
    if (debt.status !== "open") continue;
    const outstanding = outstandingPaisa(debt);
    if (outstanding <= 0) continue;

    openCount += 1;
    if (debt.direction === "owed_to_us") owedToUsPaisa += outstanding;
    else owedByUsPaisa += outstanding;

    if (dueTone(debt) === "overdue") overdueCount += 1;
  }

  return {
    owedToUsPaisa,
    owedByUsPaisa,
    netPaisa: owedToUsPaisa - owedByUsPaisa,
    openCount,
    overdueCount,
  };
}

/** The running balance with one person, netted across every open debt. */
export function contactBalancePaisa(
  contactId: string,
  debts: DebtWithPayments[],
): number {
  return debts.reduce((sum, debt) => {
    if (debt.contact_id !== contactId || debt.status !== "open") return sum;
    const outstanding = outstandingPaisa(debt);
    return debt.direction === "owed_to_us" ? sum + outstanding : sum - outstanding;
  }, 0);
}

/* -------------------------------------------------------------------------- *
 * Due dates
 * -------------------------------------------------------------------------- */

export type DebtDueTone = "overdue" | "today" | "soon" | "later" | "none";

/**
 * How a debt's due date should read.
 *
 * Flat 7-day "soon", not the priority-aware window tasks use — a debt has no
 * priority, and money owed does not become more urgent because it was typed in
 * a different colour. A settled or written-off debt is never urgent.
 */
export function dueTone(debt: DebtWithPayments): DebtDueTone {
  if (!debt.due_date || debt.status !== "open") return "none";
  if (outstandingPaisa(debt) <= 0) return "none";

  const days = daysUntil(debt.due_date);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  return days <= 7 ? "soon" : "later";
}

/* -------------------------------------------------------------------------- *
 * Labels
 * -------------------------------------------------------------------------- */

export type DebtKindDef = {
  key: DebtKind;
  label: string;
  labelUr: string;
  /** Lucide icon name; components map it, so this file stays JSX-free. */
  icon: string;
  hint: string;
};

/**
 * Behaviour is identical across all three — this only changes the wording.
 * `qarz` leads because the interest-free loan between family and friends is
 * what most Pakistani households actually run.
 */
export const DEBT_KINDS: DebtKindDef[] = [
  {
    key: "qarz",
    label: "Qarz",
    labelUr: "قرض",
    icon: "HandCoins",
    hint: "Lent to family or a friend, no interest, usually no fixed date",
  },
  {
    key: "khata",
    label: "Khata",
    labelUr: "کھاتہ",
    icon: "BookUser",
    hint: "A running tab — goods given on credit, paid off over time",
  },
  {
    key: "loan",
    label: "Loan",
    labelUr: "اُدھار",
    icon: "Landmark",
    hint: "A formal arrangement with an agreed date to repay",
  },
];

export function debtKind(key: DebtKind | string | null | undefined): DebtKindDef {
  return DEBT_KINDS.find((k) => k.key === key) ?? DEBT_KINDS[0];
}

/**
 * The heading each side of the list gets.
 *
 * Deliberately plain: "Owed to me" beats "Receivables". The people using this
 * are tracking Rs 5,000 lent to a cousin, not running a ledger department.
 */
export const DIRECTION_LABEL: Record<DebtDirection, string> = {
  owed_to_us: "Owed to me",
  owed_by_us: "I owe",
};

export const DIRECTION_LABEL_UR: Record<DebtDirection, string> = {
  owed_to_us: "مجھے ملنا ہے",
  owed_by_us: "مجھے دینا ہے",
};

/** What the button that creates each direction should say. */
export const DIRECTION_ACTION: Record<DebtDirection, string> = {
  owed_to_us: "Lend money",
  owed_by_us: "Record borrowing",
};

export const STATUS_LABEL: Record<DebtStatus, string> = {
  open: "Open",
  settled: "Settled",
  written_off: "Written off",
};

/* -------------------------------------------------------------------------- *
 * Filtering and ordering
 * -------------------------------------------------------------------------- */

/** Free-text match over everything shown on a debt card. */
export function matchesDebt(debt: DebtWithPayments, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    debt.counterparty_name.toLowerCase().includes(q) ||
    (debt.note?.toLowerCase().includes(q) ?? false) ||
    debtKind(debt.kind).label.toLowerCase().includes(q)
  );
}

/**
 * Most urgent first: overdue at the top, then by due date, then the ones with
 * no date at all — a qarz to your brother with no agreed date should not push
 * a bill that is two weeks late off the top of the list.
 */
export function compareDebts(a: DebtWithPayments, b: DebtWithPayments): number {
  if (a.due_date && b.due_date) {
    if (a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
  } else if (a.due_date) {
    return -1;
  } else if (b.due_date) {
    return 1;
  }
  return a.created_at < b.created_at ? 1 : -1;
}

/** Attaches payments to debts, so screens work with one shape. */
export function withPayments(
  debts: Debt[],
  payments: DebtPayment[],
): DebtWithPayments[] {
  const byDebt = new Map<string, DebtPayment[]>();
  for (const payment of payments) {
    const list = byDebt.get(payment.debt_id);
    if (list) list.push(payment);
    else byDebt.set(payment.debt_id, [payment]);
  }
  return debts.map((debt) => ({ ...debt, payments: byDebt.get(debt.id) ?? [] }));
}
