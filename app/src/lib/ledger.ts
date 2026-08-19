/**
 * PORTED FROM `web/src/lib/ledger.ts` — keep the two in step.
 *
 * ONE LEDGER. `transactions` is the only store of money movement. Entries and
 * Transactions are two FILTERED VIEWS of these rows, never two copies:
 *
 *   Entries      — every income and expense, cash included. Answers "what came
 *                  in, what went out, what's left".
 *   Transactions — money that touched a bank or wallet, plus transfers between
 *                  accounts. Cash spending stays out.
 *   Accounts     — the balances those rows add up to.
 *
 * There used to be a second table, `quick_entries`, holding the same movement
 * again with an OPTIONAL link between the copies. Three triggers tried to keep
 * them matching and the gaps were where the bugs lived. It was deleted, and this
 * app's entry hook kept writing to it — which is why every entry write on the
 * phone failed until M0.
 */

import type { Tables } from '../../types/database';

export type Category = Tables<'categories'>;
export type Account = Tables<'accounts'>;
export type Movement = Tables<'transactions'>;

/**
 * Derived from the row rather than imported: the types file exports aliases for
 * most CHECK constraints but not this one, and re-declaring the union here would
 * be a second copy to keep in step with `categories_kind_check`.
 */
export type CategoryKind = Category['kind'];

/**
 * A form collects a POSITIVE amount plus a direction. The column is SIGNED and
 * `sync_account_balance_trigger` adds it straight to the account, so income must
 * be stored positive and expense negative. `transactions_amount_sign_check` ties
 * the sign to `type` in the database. This is the only place that conversion
 * happens.
 */
export function toSignedPaisa(
  type: 'income' | 'expense',
  unsignedPaisa: number,
): number {
  const magnitude = Math.abs(unsignedPaisa);
  return type === 'income' ? magnitude : -magnitude;
}

/**
 * The inverse, for seeding an edit form from a stored row.
 *
 * Reads the SIGN, never `type`. They cannot disagree — the check constraint sees
 * to that — and the sign is what the balance trigger actually used.
 */
export function fromSignedPaisa(signedPaisa: number): {
  type: 'income' | 'expense';
  amount_paisa: number;
} {
  return {
    type: signedPaisa >= 0 ? 'income' : 'expense',
    amount_paisa: Math.abs(signedPaisa),
  };
}

/** Account types whose movements belong on the Transactions screen. */
export const BANKING_ACCOUNT_TYPES = ['checking', 'savings', 'wallet'] as const;

/**
 * Why an account cannot take a movement right now — or null when it can.
 *
 * Returned as a short label rather than a boolean because the pickers SHOW these
 * accounts rather than hiding them: an account that silently vanishes reads as
 * data loss, while a greyed row with "Locked" beside it explains itself.
 * `assert_account_accepts_movement` enforces the same three rules in the
 * database, so this is the explanation, not the protection — a disabled row
 * stops a tap, not a replay out of the offline outbox.
 */
export function accountBlockedReason(
  account: Pick<Account, 'is_archived' | 'is_locked' | 'deleted_at'>,
  direction: 'income' | 'expense',
): string | null {
  if (account.deleted_at) return 'Deleted';
  if (account.is_archived) return 'Deactivated';
  // A lock only bites on the way out. Paying into savings is the point of it.
  if (account.is_locked && direction === 'expense') return 'Locked';
  return null;
}

/** Accounts that still count toward what you hold. */
export function isLiveAccount(
  account: Pick<Account, 'is_archived' | 'deleted_at'>,
): boolean {
  return !account.is_archived && !account.deleted_at;
}

/**
 * Does this movement belong on the Entries screen?
 *
 * Opening balances are excluded: they are the position an account STARTED at,
 * not money that came in. Transfers are excluded too — they are neither income
 * nor expense, and both legs would cancel anyway. Counting either put the same
 * rupees into inflow AND outflow, so an ATM withdrawal read as "Rs 20,000 in,
 * Rs 20,000 out".
 */
export function isEntryMovement(
  movement: Pick<Movement, 'type' | 'is_opening'>,
): boolean {
  return !movement.is_opening && movement.type !== 'transfer';
}

/**
 * Does this movement belong on the Transactions screen?
 *
 * Transfers always do — moving money between accounts is what the screen is for,
 * and both legs must show or the pair reads as money vanishing. Otherwise it
 * shows only what touched a bank or wallet; cash spending is already on Entries.
 */
export function isBankingMovement(
  movement: Pick<Movement, 'type'>,
  accountType: string | undefined,
): boolean {
  if (movement.type === 'transfer') return true;
  return BANKING_ACCOUNT_TYPES.includes(
    accountType as (typeof BANKING_ACCOUNT_TYPES)[number],
  );
}

/**
 * Net money in and out over a set of movements.
 *
 * NEVER sum across directions without netting first. The amounts are signed, so
 * the split is by sign — adding a Rs 35,000 salary to Rs 2,000 of groceries
 * produced "Rs 37,000 logged", which measures nothing.
 */
export function flowTotals(movements: Movement[]): {
  inPaisa: number;
  outPaisa: number;
  netPaisa: number;
} {
  let inPaisa = 0;
  let outPaisa = 0;

  for (const m of movements) {
    if (!isEntryMovement(m)) continue;
    const amount = Number(m.amount_paisa);
    if (amount >= 0) inPaisa += amount;
    else outPaisa += Math.abs(amount);
  }

  return { inPaisa, outPaisa, netPaisa: inPaisa - outPaisa };
}

/** Catalogue order: `sort_order` first, name as the tie-break. Never alphabetical. */
export function byCatalogueOrder(a: Category, b: Category): number {
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  return a.name.localeCompare(b.name);
}

/**
 * The label to render for a category.
 *
 * Urdu for categories lives in the DATABASE, not in `ur.json`. A household
 * invents its own subcategories at runtime, so a bundle compiled at build time
 * can never contain "Chai Dhaba" — `name_ur` is NULL for exactly those rows and
 * this falls back to `name`. A missing bundle key would have rendered blank.
 */
export function categoryLabel(category: Category, locale: string): string {
  return locale === 'ur' && category.name_ur ? category.name_ur : category.name;
}

export const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  checking: 'Current',
  savings: 'Savings',
  wallet: 'Wallet',
  cash: 'Cash',
  credit: 'Credit card',
  investment: 'Investment',
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: 'Cash',
  debit_card: 'Debit card',
  credit_card: 'Credit card',
  bank_transfer: 'Bank transfer',
  raast: 'Raast',
  cheque: 'Cheque',
  mobile_wallet: 'Mobile wallet',
  other: 'Other',
};
