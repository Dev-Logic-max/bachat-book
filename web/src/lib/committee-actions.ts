/**
 * Writes for Committee, and the one bridge into the ledger.
 *
 * THE LEDGER RULE, and it is the OPPOSITE of udhaar's — worth stating plainly
 * because the two modules sit next to each other and look similar:
 *
 *   MY OWN contribution IS spending. The money leaves and does not come back as
 *   itself; what comes back is the payout, once, on my turn. So it is written as
 *   a real `expense`, not a transfer. Nothing downstream needs to learn about
 *   committees — an expense on a cash account already shows in Entries, and on a
 *   bank account in Transactions.
 *
 *   MY payout IS income. It is genuinely new money arriving in my account.
 *
 *   EVERYONE ELSE'S instalments never touch the ledger. Ahmed paying his
 *   Rs 5,000 into the pool is not a movement in MY accounts, and recording it as
 *   one would invent money I never held. Those rows carry `transaction_id` NULL
 *   and are tracked for the grid only.
 *
 * Every write here keeps the pair in step: create, edit and delete all move the
 * ledger row with the payment, the same contract `debt-actions.ts` holds.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/supabase/types";
import type { Committee, CommitteeMember, CommitteePayment } from "@/lib/committees";

type Client = SupabaseClient<Database>;

/* -------------------------------------------------------------------------- *
 * Members
 * -------------------------------------------------------------------------- */

export type MemberInput = {
  householdId: string;
  committeeId: string;
  contactId: string | null;
  memberName: string;
  payoutMonth: number | null;
  isMe: boolean;
  note: string | null;
};

export async function addMember(
  supabase: Client,
  input: MemberInput,
): Promise<CommitteeMember> {
  const { data, error } = await supabase
    .from("committee_members")
    .insert({
      household_id: input.householdId,
      committee_id: input.committeeId,
      contact_id: input.contactId,
      member_name: input.memberName,
      payout_month: input.payoutMonth,
      is_me: input.isMe,
      note: input.note,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function updateMember(
  supabase: Client,
  memberId: string,
  patch: {
    memberName?: string;
    contactId?: string | null;
    payoutMonth?: number | null;
    isMe?: boolean;
    note?: string | null;
  },
): Promise<void> {
  const { error } = await supabase
    .from("committee_members")
    .update({
      ...(patch.memberName !== undefined && { member_name: patch.memberName }),
      ...(patch.contactId !== undefined && { contact_id: patch.contactId }),
      ...(patch.payoutMonth !== undefined && { payout_month: patch.payoutMonth }),
      ...(patch.isMe !== undefined && { is_me: patch.isMe }),
      ...(patch.note !== undefined && { note: patch.note }),
    })
    .eq("id", memberId);
  if (error) throw error;
}

/**
 * Remove a member, and any ledger rows their cells wrote.
 *
 * Only MY OWN row can have written anything, so for every other member this is
 * a plain delete. The ledger rows go FIRST — `committee_payments` cascades with
 * the member, and its `transaction_id` is ON DELETE SET NULL, which points the
 * wrong way and would strand them.
 */
export async function deleteMember(
  supabase: Client,
  member: CommitteeMember,
  cascadeLedger = true,
): Promise<void> {
  if (cascadeLedger) {
    const { data, error: readError } = await supabase
      .from("committee_payments")
      .select("transaction_id")
      .eq("member_id", member.id)
      .not("transaction_id", "is", null);
    if (readError) throw readError;

    const ids = (data ?? [])
      .map((p) => p.transaction_id)
      .filter((id): id is string => Boolean(id));
    if (ids.length > 0) {
      const { error } = await supabase.from("transactions").delete().in("id", ids);
      if (error) throw error;
    }
  }

  const { error } = await supabase.from("committee_members").delete().eq("id", member.id);
  if (error) throw error;
}

/* -------------------------------------------------------------------------- *
 * The ledger bridge
 * -------------------------------------------------------------------------- */

function ledgerNote(committee: Committee, kind: "contribution" | "payout", month: number): string {
  return kind === "payout"
    ? `${committee.name} — payout received`
    : `${committee.name} — instalment ${month}`;
}

/**
 * Writes the ledger row for one of MY cells, or null.
 *
 * Returns null for another member's instalment, for a cell recorded without an
 * account, and for a zero amount. A contribution is an EXPENSE and therefore
 * negative; `transactions_amount_sign_check` requires it.
 */
async function writeLeg(
  supabase: Client,
  input: {
    householdId: string;
    accountId: string | null;
    amountPaisa: number;
    date: string;
    note: string;
    kind: "contribution" | "payout";
    isMine: boolean;
  },
): Promise<string | null> {
  if (!input.isMine || !input.accountId || input.amountPaisa <= 0) return null;

  const isPayout = input.kind === "payout";
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      household_id: input.householdId,
      account_id: input.accountId,
      // Income positive, expense negative — the constraint ties the sign to type.
      amount_paisa: isPayout ? Math.abs(input.amountPaisa) : -Math.abs(input.amountPaisa),
      type: isPayout ? "income" : "expense",
      date: input.date,
      note: input.note,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

/* -------------------------------------------------------------------------- *
 * Payments
 * -------------------------------------------------------------------------- */

export type PaymentInput = {
  committee: Committee;
  member: CommitteeMember;
  monthIndex: number;
  amountPaisa: number;
  paidOn: string;
  kind: "contribution" | "payout";
  /** Only meaningful on my own row; ignored for everyone else. */
  accountId: string | null;
  note: string | null;
};

export async function recordCommitteePayment(
  supabase: Client,
  input: PaymentInput,
): Promise<CommitteePayment> {
  const transactionId = await writeLeg(supabase, {
    householdId: input.committee.household_id,
    accountId: input.accountId,
    amountPaisa: input.amountPaisa,
    date: input.paidOn,
    note: ledgerNote(input.committee, input.kind, input.monthIndex),
    kind: input.kind,
    isMine: input.member.is_me,
  });

  const { data, error } = await supabase
    .from("committee_payments")
    .insert({
      household_id: input.committee.household_id,
      committee_id: input.committee.id,
      member_id: input.member.id,
      month_index: input.monthIndex,
      amount_paisa: input.amountPaisa,
      paid_on: input.paidOn,
      kind: input.kind,
      transaction_id: transactionId,
      note: input.note,
    })
    .select("*")
    .single();

  if (error || !data) {
    // The cell failed after the money already moved. Put it back, or the
    // balance is wrong with nothing on any screen to explain why.
    if (transactionId) {
      await supabase.from("transactions").delete().eq("id", transactionId);
    }
    throw error ?? new Error("Could not record the payment");
  }

  return data;
}

/**
 * Edit one cell, carrying the change onto the ledger row it wrote.
 *
 * BOTH SIDES MOVE TOGETHER, the same contract as `updateDebtPayment`. Changing
 * Rs 5,000 to Rs 50,000 here without touching the expense would leave the grid
 * and the bank balance disagreeing, with nothing to explain the gap.
 */
export async function updateCommitteePayment(
  supabase: Client,
  committee: Committee,
  member: CommitteeMember,
  payment: CommitteePayment,
  input: {
    amountPaisa: number;
    paidOn: string;
    note: string | null;
    /**
     * Where the money moved. Null keeps the cell on the grid only — and, when a
     * leg already exists, removes it and puts the balance back.
     *
     * Only meaningful on MY OWN row; another member's instalment never passes
     * through my accounts, so it is ignored for everyone else. Enforced here
     * rather than trusted from the form: the picker is hidden for them, and a
     * hidden control is not a guarantee.
     */
    accountId: string | null;
  },
): Promise<void> {
  const isPayout = payment.kind === "payout";
  const signed = isPayout ? Math.abs(input.amountPaisa) : -Math.abs(input.amountPaisa);
  const nextAccountId = member.is_me ? input.accountId : null;

  let transactionId = payment.transaction_id;

  if (payment.transaction_id && nextAccountId) {
    const { error } = await supabase
      .from("transactions")
      .update({
        account_id: nextAccountId,
        amount_paisa: signed,
        date: input.paidOn,
        note: ledgerNote(committee, payment.kind, payment.month_index),
      })
      .eq("id", payment.transaction_id);
    if (error) throw error;
  } else if (payment.transaction_id && !nextAccountId) {
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", payment.transaction_id);
    if (error) throw error;
    transactionId = null;
  } else if (!payment.transaction_id && nextAccountId) {
    transactionId = await writeLeg(supabase, {
      householdId: committee.household_id,
      accountId: nextAccountId,
      amountPaisa: input.amountPaisa,
      date: input.paidOn,
      note: ledgerNote(committee, payment.kind, payment.month_index),
      kind: payment.kind,
      isMine: member.is_me,
    });
  }

  const { error } = await supabase
    .from("committee_payments")
    .update({
      amount_paisa: input.amountPaisa,
      paid_on: input.paidOn,
      note: input.note,
      transaction_id: transactionId,
    })
    .eq("id", payment.id);
  if (error) throw error;
}

/**
 * Delete one cell, and the ledger row it wrote.
 *
 * The ledger row goes FIRST, while the link still points at it. Drop the
 * payment first and `transaction_id` goes with it, leaving an expense in the
 * account that nothing on any screen explains.
 */
export async function deleteCommitteePayment(
  supabase: Client,
  payment: Pick<CommitteePayment, "id" | "transaction_id">,
): Promise<void> {
  if (payment.transaction_id) {
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", payment.transaction_id);
    if (error) throw error;
  }

  const { error } = await supabase.from("committee_payments").delete().eq("id", payment.id);
  if (error) throw error;
}

/**
 * Remove a committee, and every ledger row it ever wrote.
 *
 * Members and payments cascade with it in the database; the transactions do
 * not, so they are collected and deleted first.
 */
export async function deleteCommittee(
  supabase: Client,
  committee: Tables<"committees">,
  cascadeLedger = true,
): Promise<void> {
  if (cascadeLedger) {
    const { data, error: readError } = await supabase
      .from("committee_payments")
      .select("transaction_id")
      .eq("committee_id", committee.id)
      .not("transaction_id", "is", null);
    if (readError) throw readError;

    const ids = (data ?? [])
      .map((p) => p.transaction_id)
      .filter((id): id is string => Boolean(id));
    if (ids.length > 0) {
      const { error } = await supabase.from("transactions").delete().in("id", ids);
      if (error) throw error;
    }
  }

  const { error } = await supabase.from("committees").delete().eq("id", committee.id);
  if (error) throw error;
}
