/**
 * Committee (BC) — the pool, its members, and the payment grid.
 *
 * A committee is two different financial products wearing one name. Take the
 * pool in month 2 of 10 and you have BORROWED: you hold the whole amount having
 * paid in a fifth of it, and the rest of the instalments are the repayment.
 * Take it in month 10 and you have SAVED. Saying which one you agreed to is the
 * most useful thing this module does.
 *
 * This file is pure and JSX-free: readers and derivations only. Writes — and
 * the one bridge into the ledger — live in `committee-actions.ts`.
 */

import type { Tables } from "@/lib/supabase/types";

export type Committee = Tables<"committees">;
export type CommitteeMember = Tables<"committee_members">;
export type CommitteePayment = Tables<"committee_payments">;

/** A committee with everything the grid needs, which is how screens want it. */
export type CommitteeFull = Committee & {
  members: CommitteeMember[];
  payments: CommitteePayment[];
};

/* -------------------------------------------------------------------------- *
 * The grid
 * -------------------------------------------------------------------------- */

/** 1..total_members — every round the committee will run. */
export function monthIndexes(committee: Committee): number[] {
  return Array.from({ length: Math.max(1, committee.total_members) }, (_, i) => i + 1);
}

/** Fast lookup for one cell of the grid. */
export function paymentKey(memberId: string, monthIndex: number): string {
  return `${memberId}:${monthIndex}`;
}

/**
 * Contributions only, indexed by cell.
 *
 * Payouts are deliberately excluded: a payout is not an instalment and must
 * never fill a grid square, or the month someone RECEIVED the pool would read
 * as the month they paid into it.
 */
export function contributionsByCell(
  payments: CommitteePayment[],
): Map<string, CommitteePayment> {
  const map = new Map<string, CommitteePayment>();
  for (const payment of payments) {
    if (payment.kind !== "contribution") continue;
    map.set(paymentKey(payment.member_id, payment.month_index), payment);
  }
  return map;
}

/** The member row that is me, or null while the committee is still being set up. */
export function myMember(members: CommitteeMember[]): CommitteeMember | null {
  return members.find((m) => m.is_me) ?? null;
}

/* -------------------------------------------------------------------------- *
 * Money
 * -------------------------------------------------------------------------- */

export type CommitteeTotals = {
  /** What I have actually paid in so far. */
  paidInPaisa: number;
  /** What I have taken out — the payout, if it has landed. */
  takenOutPaisa: number;
  /** What I am committed to over the whole cycle. */
  commitmentPaisa: number;
  /** The pool one turn is worth. */
  poolPaisa: number;
  /** How many of my own instalments are recorded. */
  myPaidCount: number;
  /** Every instalment across every member, for the completion bar. */
  filledCells: number;
  totalCells: number;
};

export function committeeTotals(committee: CommitteeFull): CommitteeTotals {
  const me = myMember(committee.members);
  const monthly = Number(committee.monthly_contribution_paisa);
  const total = Math.max(1, committee.total_members);

  let paidInPaisa = 0;
  let takenOutPaisa = 0;
  let myPaidCount = 0;
  let filledCells = 0;

  for (const payment of committee.payments) {
    if (payment.kind === "contribution") filledCells += 1;
    if (!me || payment.member_id !== me.id) continue;

    if (payment.kind === "payout") {
      takenOutPaisa += Number(payment.amount_paisa);
    } else {
      paidInPaisa += Number(payment.amount_paisa);
      myPaidCount += 1;
    }
  }

  return {
    paidInPaisa,
    takenOutPaisa,
    commitmentPaisa: monthly * total,
    poolPaisa: monthly * total,
    myPaidCount,
    filledCells,
    totalCells: total * Math.max(1, committee.members.length),
  };
}

/**
 * Is the committee finished?
 *
 * Every member has an instalment recorded for every round. Derived, never
 * stored — a stored "completed" flag and a grid will disagree the first time a
 * cell is corrected.
 */
export function isComplete(committee: CommitteeFull): boolean {
  if (committee.members.length === 0) return false;
  const needed = committee.members.length * Math.max(1, committee.total_members);
  return contributionsByCell(committee.payments).size >= needed;
}

/**
 * Which round the committee is on right now, from the start date.
 *
 * Calendar-driven, exactly like task generation: month 3 arrives whether or not
 * month 2 was collected, so an unpaid round stays visibly unpaid rather than
 * holding the whole committee back.
 */
export function currentMonthIndex(committee: Committee, today = new Date()): number {
  const [y, m] = committee.start_date.split("-").map(Number);
  const months = (today.getFullYear() - y) * 12 + (today.getMonth() + 1 - m) + 1;
  return Math.min(Math.max(1, months), Math.max(1, committee.total_members));
}

/* -------------------------------------------------------------------------- *
 * Borrow or save
 * -------------------------------------------------------------------------- */

export type PayoutStance = "borrow" | "save" | "even";

/**
 * Stated as a THIRD of the length, not a fixed month — "month 3" means opposite
 * things in a 4-person and a 20-person committee.
 */
export function payoutStance(payoutMonth: number, totalMembers: number): PayoutStance {
  const position = payoutMonth / Math.max(1, totalMembers);
  if (position <= 1 / 3) return "borrow";
  if (position >= 2 / 3) return "save";
  return "even";
}

export const STANCE_LABEL: Record<PayoutStance, string> = {
  borrow:
    "Your turn comes early — this behaves like borrowing. You receive the pool long before you have paid it in, and the rest of the instalments are the repayment.",
  save: "Your turn comes late — this behaves like saving. You fund everyone else first and take your own money back at the end.",
  even: "Your turn falls mid-way, so this is close to break-even — roughly what you put in is what you take out.",
};
