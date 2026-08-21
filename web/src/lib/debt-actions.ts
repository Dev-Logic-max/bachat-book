/**
 * Writes for Udhaar, and the one bridge into the ledger.
 *
 * LENDING IS NOT SPENDING, and this file is where that is enforced.
 *
 * Every movement here is written as a ONE-LEGGED TRANSFER — `type='transfer'`,
 * `transfer_account_id` null — exactly as `investment-actions.ts` does. Three
 * reasons that is the right shape and an expense is not:
 *
 *   1. Lending Rs 5,000 is not spending Rs 5,000. You still own the money; it
 *      has changed from cash into a receivable. Recorded as an expense, the
 *      dashboard would report you spent Rs 5,000 you are still owed, and it
 *      would poison every budget, report and tax surface at the same time.
 *   2. `transactions_amount_sign_check` exempts transfers, so a negative amount
 *      is legal without inventing a fourth transaction type.
 *   3. Every money-in / money-out figure in the product already excludes
 *      transfers BY TYPE — `isEntryMovement`, `spentAgainst`, `countsToward`
 *      and `summariseContact` all test `type`, not whether a second leg
 *      exists. So nothing downstream has to learn that debts exist.
 *
 * The account balance still moves, because `sync_account_balance_trigger` adds
 * `amount_paisa` directly. That is the whole trick: balances move, flow does not.
 *
 * THE SIGN. Opening and repayment are exact opposites of each other:
 *
 *                        opening leg      repayment leg
 *   owed_to_us (I lent)   − money out      + money back
 *   owed_by_us (I owe)    + money in       − money out
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, DebtDirection, DebtKind, DebtStatus, Tables } from "@/lib/supabase/types";
import type { Debt, DebtPayment } from "@/lib/debts";

type Client = SupabaseClient<Database>;

/* -------------------------------------------------------------------------- *
 * The ledger bridge
 * -------------------------------------------------------------------------- */

/** −1 when money leaves the account, +1 when it arrives. */
function openingSign(direction: DebtDirection): -1 | 1 {
  return direction === "owed_to_us" ? -1 : 1;
}

/** A repayment always moves the opposite way to the opening leg. */
function repaymentSign(direction: DebtDirection): -1 | 1 {
  return direction === "owed_to_us" ? 1 : -1;
}

/**
 * What the row says on the Transactions screen.
 *
 * These transfers WILL show there — `isBankingMovement` returns true for every
 * transfer — so the note has to explain itself without the debt beside it.
 * "Transfer" alone next to Rs 5,000 leaving your account is how a user
 * concludes the app lost their money.
 */
function openingNote(direction: DebtDirection, name: string): string {
  return direction === "owed_to_us" ? `Lent to ${name}` : `Borrowed from ${name}`;
}

function repaymentNote(direction: DebtDirection, name: string): string {
  return direction === "owed_to_us" ? `${name} repaid` : `Repaid ${name}`;
}

/**
 * Writes one leg, or null when no account was named.
 *
 * A null account is a real case, not an edge case: money that changed hands
 * before the app existed, or a khata the shopkeeper is only now writing down.
 * The debt is still tracked; it simply never touched a balance.
 */
async function writeLeg(
  supabase: Client,
  input: {
    householdId: string;
    accountId: string | null;
    amountPaisa: number;
    date: string;
    note: string;
    contactId: string | null;
    signedBy: -1 | 1;
  },
): Promise<string | null> {
  if (!input.accountId || input.amountPaisa <= 0) return null;

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      household_id: input.householdId,
      account_id: input.accountId,
      amount_paisa: input.signedBy * Math.abs(input.amountPaisa),
      type: "transfer",
      // No second leg: the other side is a person, not an account of yours.
      transfer_account_id: null,
      date: input.date,
      note: input.note,
      contact_id: input.contactId,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

/* -------------------------------------------------------------------------- *
 * Debts
 * -------------------------------------------------------------------------- */

export type DebtInput = {
  householdId: string;
  contactId: string | null;
  counterpartyName: string;
  direction: DebtDirection;
  kind: DebtKind;
  principalPaisa: number;
  date: string;
  dueDate: string | null;
  note: string | null;
  /** Null records the debt without moving any balance. */
  accountId: string | null;
};

export async function createDebt(supabase: Client, input: DebtInput): Promise<Debt> {
  const openingTransactionId = await writeLeg(supabase, {
    householdId: input.householdId,
    accountId: input.accountId,
    amountPaisa: input.principalPaisa,
    date: input.date,
    note: openingNote(input.direction, input.counterpartyName),
    contactId: input.contactId,
    signedBy: openingSign(input.direction),
  });

  const { data, error } = await supabase
    .from("debts")
    .insert({
      household_id: input.householdId,
      contact_id: input.contactId,
      counterparty_name: input.counterpartyName,
      direction: input.direction,
      kind: input.kind,
      principal_paisa: input.principalPaisa,
      // The day the money changed hands, which is not the day the row was typed.
      // Without this a loan backdated to June said "lent" today on its own card.
      opened_on: input.date,
      due_date: input.dueDate,
      opening_transaction_id: openingTransactionId,
      note: input.note,
    })
    .select("*")
    .single();

  if (error || !data) {
    // The debt failed after the money already moved. Put it back, or the
    // balance is wrong with nothing on any screen to explain why.
    if (openingTransactionId) {
      await supabase.from("transactions").delete().eq("id", openingTransactionId);
    }
    throw error ?? new Error("Could not record the debt");
  }

  return data;
}

/**
 * Edit the record AND the money it moved, together.
 *
 * The amount and the account used to be un-editable here, on the grounds that
 * changing either would leave the opening transfer disagreeing with the debt. It
 * would — if only the debt were written. The answer is to write BOTH, which is
 * what `updateInvestment` already does and what `sync_task_to_transaction`
 * already guarantees for tasks: the pair can never hold two different values for
 * one fact, so keep them in step rather than freezing one of them.
 *
 * Refusing the edit cost more than it saved. Correcting a typo meant deleting
 * the debt — losing every repayment recorded against it — and a repayment
 * recorded before an account existed could never be attached to one.
 *
 * ALL FOUR LEG CASES, and writing only three is the old entry/transaction bug:
 * a leg that stays (update it), a leg whose account was cleared (delete it), no
 * leg where an account has now been named (create it), and neither (nothing).
 */
export async function updateDebt(
  supabase: Client,
  debt: Tables<"debts">,
  next: {
    counterpartyName: string;
    contactId: string | null;
    kind: DebtKind;
    principalPaisa: number;
    openedOn: string;
    dueDate: string | null;
    note: string | null;
    /** Null detaches the ledger leg and puts the balance back. */
    accountId: string | null;
  },
): Promise<void> {
  let openingTransactionId = debt.opening_transaction_id;

  if (debt.opening_transaction_id && next.accountId) {
    const { error } = await supabase
      .from("transactions")
      .update({
        account_id: next.accountId,
        amount_paisa: openingSign(debt.direction) * Math.abs(next.principalPaisa),
        date: next.openedOn,
        note: openingNote(debt.direction, next.counterpartyName),
        contact_id: next.contactId,
      })
      .eq("id", debt.opening_transaction_id);
    if (error) throw error;
  } else if (debt.opening_transaction_id && !next.accountId) {
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", debt.opening_transaction_id);
    if (error) throw error;
    openingTransactionId = null;
  } else if (!debt.opening_transaction_id && next.accountId) {
    openingTransactionId = await writeLeg(supabase, {
      householdId: debt.household_id,
      accountId: next.accountId,
      amountPaisa: next.principalPaisa,
      date: next.openedOn,
      note: openingNote(debt.direction, next.counterpartyName),
      contactId: next.contactId,
      signedBy: openingSign(debt.direction),
    });
  }

  const { error } = await supabase
    .from("debts")
    .update({
      counterparty_name: next.counterpartyName,
      contact_id: next.contactId,
      kind: next.kind,
      principal_paisa: next.principalPaisa,
      opened_on: next.openedOn,
      due_date: next.dueDate,
      note: next.note,
      opening_transaction_id: openingTransactionId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", debt.id);
  if (error) throw error;
}

/**
 * Settle, write off, or reopen.
 *
 * `written_off` keeps every row and every payment. It is a status and never a
 * delete, because the money genuinely left and last year's totals must not
 * silently change because you gave up on it this year.
 */
export async function setDebtStatus(
  supabase: Client,
  debtId: string,
  status: DebtStatus,
): Promise<void> {
  const { error } = await supabase.from("debts").update({ status }).eq("id", debtId);
  if (error) throw error;
}

/**
 * Remove a debt entirely.
 *
 * `cascadeLedger` is a real choice, mirroring `deleteInvestment`. Checked, the
 * opening leg and every repayment leg go too and the balances return to where
 * they were — right when the debt was recorded by mistake. Unchecked, they
 * stay: the rupees really did change hands, and tidying a record here must not
 * silently un-move them.
 *
 * The ledger rows go FIRST either way. `debt_payments` cascades with the debt,
 * but its `transaction_id` is ON DELETE SET NULL — which points the wrong way,
 * so dropping the debt first would strand the legs with nothing naming them.
 */
export async function deleteDebt(
  supabase: Client,
  debt: Tables<"debts">,
  cascadeLedger = true,
): Promise<void> {
  if (cascadeLedger) {
    const { data, error: readError } = await supabase
      .from("debt_payments")
      .select("transaction_id")
      .eq("debt_id", debt.id)
      .not("transaction_id", "is", null);
    if (readError) throw readError;

    const ledgerIds = [
      debt.opening_transaction_id,
      ...(data ?? []).map((p) => p.transaction_id),
    ].filter((id): id is string => Boolean(id));

    if (ledgerIds.length > 0) {
      const { error } = await supabase.from("transactions").delete().in("id", ledgerIds);
      if (error) throw error;
    }
  }

  const { error } = await supabase.from("debts").delete().eq("id", debt.id);
  if (error) throw error;
}

/* -------------------------------------------------------------------------- *
 * Repayments
 * -------------------------------------------------------------------------- */

export type PaymentInput = {
  amountPaisa: number;
  date: string;
  note: string | null;
  /** Null records the repayment without moving any balance. */
  accountId: string | null;
};

/**
 * Record money coming back (or going out, if you are the one who owes).
 *
 * Overpayment is ALLOWED and not blocked here — people round up, and Rs 200
 * more than owed is a real thing that happens. The screen shows it as such
 * rather than refusing the entry.
 *
 * The status is deliberately NOT flipped to `settled` when the final payment
 * lands. What the payments say and what the user declared are two different
 * facts; the screen offers to close it instead of changing a status nobody chose.
 */
export async function recordPayment(
  supabase: Client,
  debt: Tables<"debts">,
  input: PaymentInput,
): Promise<DebtPayment> {
  const transactionId = await writeLeg(supabase, {
    householdId: debt.household_id,
    accountId: input.accountId,
    amountPaisa: input.amountPaisa,
    date: input.date,
    note: repaymentNote(debt.direction, debt.counterparty_name),
    contactId: debt.contact_id,
    signedBy: repaymentSign(debt.direction),
  });

  const { data, error } = await supabase
    .from("debt_payments")
    .insert({
      household_id: debt.household_id,
      debt_id: debt.id,
      amount_paisa: input.amountPaisa,
      date: input.date,
      transaction_id: transactionId,
      note: input.note,
    })
    .select("*")
    .single();

  if (error || !data) {
    // Same rollback as createDebt: the money moved, the record did not.
    if (transactionId) {
      await supabase.from("transactions").delete().eq("id", transactionId);
    }
    throw error ?? new Error("Could not record the repayment");
  }

  return data;
}

/**
 * Edit a repayment, and carry the change onto the ledger row it wrote.
 *
 * BOTH SIDES MOVE TOGETHER. Correcting Rs 1,000 to Rs 10,000 here without
 * touching the transfer would leave the debt saying one thing and the bank
 * balance another, and nothing on either screen would explain the gap. This is
 * the same contract `sync_task_to_transaction` holds for tasks — the pair can
 * never hold two different values for the same fact.
 *
 * The SIGN is recomputed from the debt's direction rather than carried over,
 * so an edit can never flip money the wrong way.
 */
export async function updateDebtPayment(
  supabase: Client,
  debt: Tables<"debts">,
  payment: Pick<DebtPayment, "id" | "transaction_id">,
  input: {
    amountPaisa: number;
    date: string;
    note: string | null;
    /**
     * Where the money moved. Null records the repayment without touching a
     * balance — and, when a leg already exists, removes it.
     *
     * This used to be missing entirely, on the reasoning that moving a repayment
     * between accounts "is a delete-and-re-record". In practice it meant a
     * repayment logged without an account could NEVER be attached to one: the
     * only route was to delete the payment and type it again. All four cases are
     * handled here instead, so a correction is a correction.
     */
    accountId: string | null;
  },
): Promise<void> {
  let transactionId = payment.transaction_id;

  if (payment.transaction_id && input.accountId) {
    const { error } = await supabase
      .from("transactions")
      .update({
        account_id: input.accountId,
        // Recomputed from the debt's direction rather than carried over, so an
        // edit can never flip money the wrong way.
        amount_paisa: repaymentSign(debt.direction) * Math.abs(input.amountPaisa),
        date: input.date,
        note: repaymentNote(debt.direction, debt.counterparty_name),
        contact_id: debt.contact_id,
      })
      .eq("id", payment.transaction_id);
    if (error) throw error;
  } else if (payment.transaction_id && !input.accountId) {
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", payment.transaction_id);
    if (error) throw error;
    transactionId = null;
  } else if (!payment.transaction_id && input.accountId) {
    transactionId = await writeLeg(supabase, {
      householdId: debt.household_id,
      accountId: input.accountId,
      amountPaisa: input.amountPaisa,
      date: input.date,
      note: repaymentNote(debt.direction, debt.counterparty_name),
      contactId: debt.contact_id,
      signedBy: repaymentSign(debt.direction),
    });
  }

  const { error } = await supabase
    .from("debt_payments")
    .update({
      amount_paisa: input.amountPaisa,
      date: input.date,
      note: input.note,
      transaction_id: transactionId,
    })
    .eq("id", payment.id);
  if (error) throw error;
}

/**
 * Delete a repayment, and the ledger row it wrote.
 *
 * The ledger row goes FIRST, while the link still points at it — mirroring
 * `uncompleteTask`. Drop the payment first and `transaction_id` goes with it,
 * leaving a transfer in the account that nothing on any screen explains, so the
 * balance holds money the debt no longer accounts for.
 */
export async function deletePayment(
  supabase: Client,
  payment: Pick<DebtPayment, "id" | "transaction_id">,
): Promise<void> {
  if (payment.transaction_id) {
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", payment.transaction_id);
    if (error) throw error;
  }

  const { error } = await supabase.from("debt_payments").delete().eq("id", payment.id);
  if (error) throw error;
}
