/**
 * The contract every satellite module holds with the one ledger.
 *
 * Investments, Udhaar, Committee and Zakat all keep their own records AND, when
 * a record names an account, write exactly one row into `transactions`. That row
 * is the money; the module row is the meaning. This file holds the three things
 * all four of them need and none of them should re-implement:
 *
 *   1. WHERE a ledger row can be seen — so every module card can offer a link
 *      into Entries or Transactions instead of asking the user to go hunting.
 *   2. WHETHER an account can afford a movement — the same rule the database
 *      enforces in `assert_account_has_funds`, said early and in plain words.
 *   3. WHICH FOUR CASES an edit has to cover when a record's account changes.
 *      Writing only three of them is how the old entry/transaction pair leaked.
 *
 * Money never lives here. This file is pure: strings, numbers and decisions.
 */

import { formatPKR } from "@/lib/format";
import type { Account, Movement } from "@/lib/ledger";
import type { TransactionType } from "@/lib/supabase/types";

/* -------------------------------------------------------------------------- *
 * 1. Where a ledger row can be seen
 * -------------------------------------------------------------------------- */

export type LedgerRef = {
  /** Deep link that lands on the row itself, not just the screen it is on. */
  href: string;
  /** What the chip says. Names the screen, because that is the promise. */
  label: string;
  /** Long form, for a title attribute and for screen readers. */
  title: string;
};

/**
 * The screen a ledger row belongs to, and a link that opens it there.
 *
 * The two screens are FILTERED VIEWS of one table, so a row can appear on one,
 * the other, or both:
 *
 *   Entries      — income and expense, cash included, `is_opening` excluded.
 *   Transactions — transfers, plus anything on a bank or wallet account.
 *
 * A one-legged transfer (a loan, a holding's funding leg) only ever shows in
 * Transactions, which is why lending Rs 5,000 from cash cannot be found in
 * Entries and pointing there would be a broken promise.
 *
 * Both links carry the MONTH as well as the id. Both screens open on the current
 * month, so an id alone lands on a page that does not contain the row — the
 * lesson the task receipt chip already learned.
 */
export function ledgerRef(
  row: Pick<Movement, "id" | "date" | "type">,
): LedgerRef {
  const month = row.date.slice(0, 7);

  if (row.type === "transfer") {
    return {
      href: `/transactions?month=${month}&tx=${row.id}`,
      label: "View in Transactions",
      title: `Open this movement on the Transactions screen, in ${month}`,
    };
  }

  return {
    href: `/entries?month=${month}&entry=${row.id}`,
    label: "View in Entries",
    title: `Open this movement on the Entries screen, in ${month}`,
  };
}

/**
 * The same link when all that survives is the id and the date.
 *
 * Module rows store `transaction_id` and their own date, not the ledger row's
 * `type`. Callers that know the shape they wrote — a debt leg is always a
 * transfer, a committee instalment is always an expense — pass it; the rest get
 * Entries, which is the safer default because it holds both signs.
 */
export function ledgerRefFor(
  transactionId: string,
  date: string,
  type: TransactionType = "expense",
): LedgerRef {
  return ledgerRef({ id: transactionId, date, type });
}

/* -------------------------------------------------------------------------- *
 * 2. Whether an account can afford it
 * -------------------------------------------------------------------------- */

export type FundsCheck = {
  /** How far short the account is, in paisa. Zero when it can afford it. */
  shortfallPaisa: number;
  /** Null when the movement is fine. A finished sentence when it is not. */
  message: string | null;
};

/**
 * Can this account take this movement?
 *
 * `deltaPaisa` is SIGNED and is the change to the balance — negative for money
 * leaving. Only outgoing money can fail, and only when the account is not
 * allowed to go below zero.
 *
 * This is the EXPLANATION, not the protection. `assert_account_has_funds`
 * enforces the same rule in the database, because a form that checks first still
 * loses the race against an import, a REST call, or a second tab. What this
 * gives is a sentence naming the account and the amount, in place of a Postgres
 * error surfaced through a toast.
 *
 * `replacingPaisa` matters for edits: changing an existing Rs 5,000 expense to
 * Rs 6,000 only asks the account for Rs 1,000 more, and treating it as a fresh
 * Rs 6,000 would refuse edits the account can plainly afford.
 */
export function checkFunds(
  account: Pick<Account, "name" | "balance_paisa" | "allow_negative_balance"> | null | undefined,
  deltaPaisa: number,
  replacingPaisa = 0,
): FundsCheck {
  if (!account || account.allow_negative_balance) {
    return { shortfallPaisa: 0, message: null };
  }

  const projected = Number(account.balance_paisa) + deltaPaisa - replacingPaisa;
  if (projected >= 0) return { shortfallPaisa: 0, message: null };

  return {
    shortfallPaisa: -projected,
    message:
      `${account.name} holds ${formatPKR(Number(account.balance_paisa))}, which is ` +
      `${formatPKR(-projected)} short. Pick another account, record it without one, or ` +
      `allow that account to go below zero in Edit Account.`,
  };
}

/* -------------------------------------------------------------------------- *
 * 3. The four cases an edit has to cover
 * -------------------------------------------------------------------------- */

export type LegAction = "create" | "update" | "delete" | "none";

/**
 * What has to happen to a module row's ledger leg when it is saved.
 *
 * FOUR cases, and writing only three of them is the exact shape of the bug the
 * single ledger exists to prevent: the old entry/transaction pair had branches
 * for adding a link and for removing one, none for MOVING one, so changing an
 * entry's account was a silent no-op. Naming all four in one place means every
 * module gets the same answer.
 */
export function legAction(
  existingLegId: string | null | undefined,
  nextAccountId: string | null | undefined,
): LegAction {
  if (existingLegId && nextAccountId) return "update";
  if (existingLegId && !nextAccountId) return "delete";
  if (!existingLegId && nextAccountId) return "create";
  return "none";
}

/**
 * What removing a module record does to the account it charged.
 *
 * Used to caption the delete dialog. Returns null when nothing would move,
 * which is what keeps a standalone record's dialog from showing an empty
 * "balance impact" panel with two identical figures in it.
 */
export function balanceImpactOf(
  account: Pick<Account, "name" | "balance_paisa"> | null | undefined,
  reversedPaisa: number,
): { accountName: string; fromPaisa: number; toPaisa: number } | null {
  if (!account || reversedPaisa === 0) return null;
  return {
    accountName: account.name,
    fromPaisa: Number(account.balance_paisa),
    toPaisa: Number(account.balance_paisa) + reversedPaisa,
  };
}
