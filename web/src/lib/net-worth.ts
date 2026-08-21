/**
 * What a household is worth, and what it actually holds.
 *
 * TWO figures, and conflating them is the mistake this file exists to stop.
 *
 *   CASH IN HAND  — the sum of live account balances. Nothing else. This is the
 *                   number you can walk into a bank and reconcile against. It
 *                   already reflects lending (the money left) and borrowing (the
 *                   money arrived), because both wrote a real ledger row.
 *
 *   NET WORTH     — cash, plus what you own that is not cash, plus what is owed
 *                   to you, minus what you owe.
 *
 * The dashboard shows both, side by side, because they answer different
 * questions and the old screen answered only one of them twice: "Saved this
 * month" and "Total net worth" sat on the same band while neither said how much
 * money the household was actually holding.
 *
 * THE FOUR RULES, each of which is a bug someone would otherwise hit:
 *
 *   1. Money you LENT is not subtracted again. The transfer leg already took it
 *      out of the account, so cash is down by Rs 5,000 and the receivable adds
 *      Rs 5,000 back. Net worth does not move when you lend — correctly, because
 *      lending is not spending.
 *
 *   2. Money you BORROWED is not added again, and the liability IS subtracted.
 *      Cash went up Rs 50,000 and you owe Rs 50,000, so net worth is flat. The
 *      owner's instinct here — "it is in my hand, so count it" — would count the
 *      cash without the debt and inflate net worth by every rupee borrowed. That
 *      is why the payable is netted off rather than ignored.
 *
 *   3. A WRITTEN-OFF receivable drops out. You have decided it is not coming
 *      back, so it is no longer an asset. The ledger row that took the money out
 *      of your account stays exactly where it is — the rupees really did leave —
 *      which is why writing off lowers net worth and touches no balance.
 *
 *   4. A HOLDING counts at what it is worth today, not what you paid. Whether it
 *      was funded through the ledger or not, you own it; a plot bought before
 *      the app existed is part of your net worth even though no account was ever
 *      charged for it. What that DOES require is that an account which paid for
 *      a holding actually records the payment — an unsynced holding funded from
 *      an untouched UBL balance is counted twice, and the sync icon on the card
 *      exists to close exactly that gap.
 *
 * Net worth can therefore be LOWER than cash in hand, and that is not a bug: it
 * is what owing more than you are owed looks like. It is the ordinary state of
 * anyone repaying a loan.
 */

import type { DebtWithPayments } from "@/lib/debts";
import { outstandingPaisa } from "@/lib/debts";
import type { Investment } from "@/lib/investments";
import { isOpen as isHoldingOpen } from "@/lib/investments";
import type { Account } from "@/lib/ledger";
import { isLiveAccount } from "@/lib/ledger";

export type NetWorthParts = {
  /** Live account balances. The reconcilable number. */
  cashPaisa: number;
  /** Open holdings at current value. */
  holdingsPaisa: number;
  /** Open udhaar owed TO you, outstanding only. */
  receivablePaisa: number;
  /** Open udhaar owed BY you, outstanding only. Reported POSITIVE. */
  payablePaisa: number;
  /** cash + holdings + receivable − payable. */
  netWorthPaisa: number;
};

export function netWorthBreakdown({
  accounts = [],
  holdings = [],
  debts = [],
}: {
  accounts?: Account[];
  holdings?: Investment[];
  debts?: DebtWithPayments[];
}): NetWorthParts {
  const cashPaisa = accounts
    .filter(isLiveAccount)
    .reduce((sum, a) => sum + Number(a.balance_paisa), 0);

  const holdingsPaisa = holdings
    .filter(isHoldingOpen)
    .reduce((sum, h) => sum + Number(h.current_value_paisa), 0);

  let receivablePaisa = 0;
  let payablePaisa = 0;
  for (const debt of debts) {
    // Rule 3. `settled` is finished and `written_off` is money you have stopped
    // expecting; neither is an asset or a liability any more.
    if (debt.status !== "open") continue;
    const outstanding = outstandingPaisa(debt);
    if (outstanding <= 0) continue;
    if (debt.direction === "owed_to_us") receivablePaisa += outstanding;
    else payablePaisa += outstanding;
  }

  return {
    cashPaisa,
    holdingsPaisa,
    receivablePaisa,
    payablePaisa,
    netWorthPaisa: cashPaisa + holdingsPaisa + receivablePaisa - payablePaisa,
  };
}

export type NetWorthLine = {
  key: keyof Omit<NetWorthParts, "netWorthPaisa">;
  label: string;
  /** How it enters the total. Drives the sign and the colour. */
  sign: 1 | -1;
  valuePaisa: number;
  /** Where the figure came from, so no line on the screen is unexplained. */
  source: string;
};

/**
 * The total, itemised — only the lines that are non-zero.
 *
 * A hero figure nobody can decompose is a figure nobody trusts, and this one is
 * now built from four places instead of one. Zero lines are dropped rather than
 * rendered as "Rs 0": a household with no udhaar should not be shown two empty
 * rows explaining a feature it does not use.
 */
export function netWorthLines(parts: NetWorthParts): NetWorthLine[] {
  const lines: NetWorthLine[] = [
    {
      key: "cashPaisa",
      label: "In your accounts",
      sign: 1,
      valuePaisa: parts.cashPaisa,
      source: "Every live account balance added up",
    },
    {
      key: "holdingsPaisa",
      label: "Investments",
      sign: 1,
      valuePaisa: parts.holdingsPaisa,
      source: "What your open holdings are worth today",
    },
    {
      key: "receivablePaisa",
      label: "Owed to you",
      sign: 1,
      valuePaisa: parts.receivablePaisa,
      source: "Open udhaar, still outstanding",
    },
    {
      key: "payablePaisa",
      label: "You owe",
      sign: -1,
      valuePaisa: parts.payablePaisa,
      source: "Open udhaar you have still to repay",
    },
  ];

  // Cash always shows, even at zero — "you hold nothing" is a real answer and
  // an itemisation that starts at "Investments" reads as if cash was forgotten.
  return lines.filter((line) => line.key === "cashPaisa" || line.valuePaisa !== 0);
}
