/**
 * Writes for the Investments module, and the one bridge into the ledger.
 *
 * THE BRIDGE IS OPT-IN AND OFF BY DEFAULT. Every function here takes an
 * `accountId` that may be null. Null means "record this holding and touch
 * nothing else" — no transaction row, no balance change, nothing in Entries.
 * That is the normal path, and it is what makes Investments usable on day one
 * for the gold and the plot you already owned before you ever opened the app.
 *
 * When an account IS named, the money movement is written as a ONE-LEGGED
 * TRANSFER: `type='transfer'`, `transfer_account_id` null. Three reasons that
 * is the right shape and an expense is not:
 *
 *   1. Buying a certificate is not spending. You still own the money; it has
 *      changed form. Recorded as an expense, the dashboard would report that
 *      you spent Rs 20,00,000 you actually still have.
 *   2. `transactions_amount_sign_check` exempts transfers, so a negative
 *      amount is legal without inventing a fourth transaction type.
 *   3. Every money-in / money-out figure in the product already excludes
 *      transfers, so nothing downstream needs to learn about investments.
 *
 * Profit is the exception: a payout that reaches your bank IS income, because
 * it is new money that was not yours before. It is written as `type='income'`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  InvestmentKind,
  InvestmentStatus,
  PayoutFrequency,
  Tables,
} from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

/**
 * Marks the valuation this code writes on day one, so an edit can realign it
 * without touching a real valuation the user happened to record that same day.
 */
const OPENING_VALUATION_NOTE = "Opening value";

/* -------------------------------------------------------------------------- *
 * The switch
 * -------------------------------------------------------------------------- */

export type Integrations = Tables<"household_integrations">;

/** All false. Used when the household has no row yet, which is the norm. */
export const NO_INTEGRATIONS: Omit<Integrations, "household_id" | "updated_at"> = {
  sync_investments: false,
  sync_committees: false,
  sync_zakat: false,
};

/**
 * Read the household's bridges.
 *
 * A missing row is not an error and must not be treated as one — it is the
 * default state for every household that has never opened Settings. Returning
 * the all-false shape here is what keeps every caller from writing its own
 * `?? false` and getting one of them wrong.
 */
export async function loadIntegrations(
  supabase: Client,
  householdId: string,
): Promise<typeof NO_INTEGRATIONS> {
  const { data, error } = await supabase
    .from("household_integrations")
    .select("sync_investments, sync_committees, sync_zakat")
    .eq("household_id", householdId)
    .maybeSingle();

  if (error) throw error;
  return data ?? NO_INTEGRATIONS;
}

export async function setIntegration(
  supabase: Client,
  householdId: string,
  patch: Partial<typeof NO_INTEGRATIONS>,
): Promise<void> {
  const { error } = await supabase
    .from("household_integrations")
    .upsert(
      { household_id: householdId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: "household_id" },
    );
  if (error) throw error;
}

/* -------------------------------------------------------------------------- *
 * Holdings
 * -------------------------------------------------------------------------- */

export type InvestmentInput = {
  householdId: string;
  name: string;
  kind: InvestmentKind;
  institutionId: string | null;
  purchaseDate: string;
  expectedExitDate: string | null;
  expectedReturnPct: number | null;
  payoutFrequency: PayoutFrequency;
  principalPaisa: number;
  currentValuePaisa: number;
  units: number | null;
  unitLabel: string | null;
  unitCostPaisa: number | null;
  note: string | null;
  /** Null keeps the holding standalone. Only set when the bridge is open. */
  accountId: string | null;
};

/** The transfer leg that takes the money out of an account, or null. */
async function writeFundingLeg(
  supabase: Client,
  input: Pick<InvestmentInput, "householdId" | "accountId" | "principalPaisa" | "purchaseDate" | "name">,
): Promise<string | null> {
  if (!input.accountId || input.principalPaisa <= 0) return null;

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      household_id: input.householdId,
      account_id: input.accountId,
      // Negative: money leaving. A transfer with no second leg, because the
      // other side of it is the holding, which is not an account.
      amount_paisa: -Math.abs(input.principalPaisa),
      type: "transfer",
      transfer_account_id: null,
      date: input.purchaseDate,
      note: `Invested in ${input.name}`,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

export async function createInvestment(
  supabase: Client,
  input: InvestmentInput,
): Promise<Tables<"investments">> {
  const fundingTransactionId = await writeFundingLeg(supabase, input);

  const { data, error } = await supabase
    .from("investments")
    .insert({
      household_id: input.householdId,
      name: input.name,
      kind: input.kind,
      institution_id: input.institutionId,
      purchase_date: input.purchaseDate,
      expected_exit_date: input.expectedExitDate,
      expected_return_pct: input.expectedReturnPct,
      payout_frequency: input.payoutFrequency,
      principal_paisa: input.principalPaisa,
      current_value_paisa: input.currentValuePaisa,
      value_as_of: input.purchaseDate,
      units: input.units,
      unit_label: input.unitLabel,
      unit_cost_paisa: input.unitCostPaisa,
      account_id: input.accountId,
      funding_transaction_id: fundingTransactionId,
      note: input.note,
    })
    .select("*")
    .single();

  if (error || !data) {
    // The holding failed after the money already left the account. Put it back,
    // or the balance is wrong with nothing on any screen to explain why.
    if (fundingTransactionId) {
      await supabase.from("transactions").delete().eq("id", fundingTransactionId);
    }
    throw error ?? new Error("Could not save the holding.");
  }

  // The opening valuation, so the value chart starts at day one rather than at
  // the first time somebody remembered to update it.
  const { error: valuationError } = await supabase.from("investment_valuations").insert({
    investment_id: data.id,
    household_id: input.householdId,
    as_of: input.purchaseDate,
    value_paisa: input.currentValuePaisa,
    unit_price_paisa: input.unitCostPaisa,
    note: OPENING_VALUATION_NOTE,
  });
  if (valuationError) throw valuationError;

  return data;
}

export async function updateInvestment(
  supabase: Client,
  holding: Tables<"investments">,
  input: Omit<InvestmentInput, "householdId" | "currentValuePaisa">,
): Promise<void> {
  /*
   * Keep the ledger leg in step with the holding it funded.
   *
   * Four cases, and only writing three of them is how the old entry/transaction
   * pair used to leak: a leg exists and is still wanted (update it), a leg
   * exists and the account was cleared (delete it), no leg but an account has
   * now been named (create it), and neither (do nothing).
   */
  let fundingTransactionId = holding.funding_transaction_id;

  if (holding.funding_transaction_id && input.accountId) {
    const { error } = await supabase
      .from("transactions")
      .update({
        account_id: input.accountId,
        amount_paisa: -Math.abs(input.principalPaisa),
        date: input.purchaseDate,
        note: `Invested in ${input.name}`,
      })
      .eq("id", holding.funding_transaction_id);
    if (error) throw error;
  } else if (holding.funding_transaction_id && !input.accountId) {
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", holding.funding_transaction_id);
    if (error) throw error;
    fundingTransactionId = null;
  } else if (!holding.funding_transaction_id && input.accountId) {
    fundingTransactionId = await writeFundingLeg(supabase, {
      householdId: holding.household_id,
      accountId: input.accountId,
      principalPaisa: input.principalPaisa,
      purchaseDate: input.purchaseDate,
      name: input.name,
    });
  }

  const { error } = await supabase
    .from("investments")
    .update({
      name: input.name,
      kind: input.kind,
      institution_id: input.institutionId,
      purchase_date: input.purchaseDate,
      expected_exit_date: input.expectedExitDate,
      expected_return_pct: input.expectedReturnPct,
      payout_frequency: input.payoutFrequency,
      principal_paisa: input.principalPaisa,
      units: input.units,
      unit_label: input.unitLabel,
      unit_cost_paisa: input.unitCostPaisa,
      account_id: input.accountId,
      funding_transaction_id: fundingTransactionId,
      note: input.note,
      updated_at: new Date().toISOString(),
    })
    .eq("id", holding.id);

  if (error) throw error;

  await realignOpeningValuation(supabase, holding, input.purchaseDate, input.principalPaisa);
}

/**
 * Keep the day-one valuation matching what was actually paid.
 *
 * Correcting a holding's principal from Rs 20,00,000 to Rs 25,00,000 used to
 * leave the opening valuation at the old figure. With no later valuation the
 * trigger then held `current_value_paisa` at Rs 20,00,000, and the card reported
 * a Rs 5,00,000 LOSS on a holding nobody had re-valued — invented purely by an
 * edit. Moving the purchase date had the same effect and stranded an orphan data
 * point on the old date.
 *
 * Only the row this code created is touched, identified by its note. A real
 * valuation the user recorded on the purchase date is left exactly alone.
 */
async function realignOpeningValuation(
  supabase: Client,
  holding: Tables<"investments">,
  purchaseDate: string,
  principalPaisa: number,
): Promise<void> {
  const dateChanged = holding.purchase_date !== purchaseDate;
  const principalChanged = Number(holding.principal_paisa) !== principalPaisa;
  if (!dateChanged && !principalChanged) return;

  const { data: opening, error } = await supabase
    .from("investment_valuations")
    .select("id")
    .eq("investment_id", holding.id)
    .eq("as_of", holding.purchase_date)
    .eq("note", OPENING_VALUATION_NOTE)
    .maybeSingle();
  if (error) throw error;
  if (!opening) return;

  // Delete-then-insert rather than update: the date is half of the unique key,
  // so moving it is a different row, and an in-place update would collide with
  // any valuation already recorded on the new date.
  const { error: deleteError } = await supabase
    .from("investment_valuations")
    .delete()
    .eq("id", opening.id);
  if (deleteError) throw deleteError;

  const { error: insertError } = await supabase.from("investment_valuations").upsert(
    {
      investment_id: holding.id,
      household_id: holding.household_id,
      as_of: purchaseDate,
      value_paisa: principalPaisa,
      note: OPENING_VALUATION_NOTE,
    },
    { onConflict: "investment_id,as_of" },
  );
  if (insertError) throw insertError;
}

/**
 * Attach a standalone holding to an account after the fact.
 *
 * This is the deliberate, one-at-a-time path for holdings recorded while the
 * bridge was shut. Turning the switch on never does this in bulk: backfilling
 * twelve holdings would swing your balances by lakhs on one click, with no
 * screen able to say why.
 */
export async function linkInvestmentToAccount(
  supabase: Client,
  holding: Tables<"investments">,
  accountId: string,
): Promise<void> {
  if (holding.funding_transaction_id) {
    throw new Error("This holding is already linked to an account.");
  }

  const fundingTransactionId = await writeFundingLeg(supabase, {
    householdId: holding.household_id,
    accountId,
    principalPaisa: holding.principal_paisa,
    purchaseDate: holding.purchase_date,
    name: holding.name,
  });

  const { error } = await supabase
    .from("investments")
    .update({
      account_id: accountId,
      funding_transaction_id: fundingTransactionId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", holding.id);

  if (error) {
    if (fundingTransactionId) {
      await supabase.from("transactions").delete().eq("id", fundingTransactionId);
    }
    throw error;
  }
}

/** Every ledger row this holding is responsible for. */
export async function investmentLedgerIds(
  supabase: Client,
  holding: Tables<"investments">,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("investment_payouts")
    .select("transaction_id")
    .eq("investment_id", holding.id)
    .not("transaction_id", "is", null);
  if (error) throw error;

  return [
    holding.funding_transaction_id,
    holding.exit_transaction_id,
    ...(data ?? []).map((p) => p.transaction_id),
  ].filter((id): id is string => Boolean(id));
}

/**
 * Remove a holding.
 *
 * `cascadeLedger` is a real choice, not a formality. Checked, the account
 * entries go too and the money returns to the balance it came from — right when
 * the holding was recorded by mistake. Unchecked, they stay: the rupees really
 * did leave your bank, and tidying up a record here must not silently un-spend
 * them. The surviving rows are ordinary transfers and still read "Invested in …".
 *
 * The ledger rows are deleted FIRST either way. `investment_payouts` cascades
 * with the holding, but its `transaction_id` is ON DELETE SET NULL — which
 * points the wrong way, so dropping the holding first would strand them.
 */
export async function deleteInvestment(
  supabase: Client,
  holding: Tables<"investments">,
  cascadeLedger = true,
): Promise<void> {
  if (cascadeLedger) {
    const ledgerIds = await investmentLedgerIds(supabase, holding);
    if (ledgerIds.length > 0) {
      const { error } = await supabase.from("transactions").delete().in("id", ledgerIds);
      if (error) throw error;
    }
  }

  const { error } = await supabase.from("investments").delete().eq("id", holding.id);
  if (error) throw error;
}

/* -------------------------------------------------------------------------- *
 * Re-valuation
 * -------------------------------------------------------------------------- */

/**
 * Record what the holding is worth now.
 *
 * `investments.current_value_paisa` is NOT written here. A trigger copies the
 * newest valuation onto it, so the two can never disagree — writing both from
 * the client is how a denormalised column drifts.
 *
 * The unique key is (investment_id, as_of), so re-valuing twice on the same day
 * corrects that day rather than stacking two rows on one date.
 */
export async function recordValuation(
  supabase: Client,
  holding: Tables<"investments">,
  input: { asOf: string; valuePaisa: number; unitPricePaisa: number | null; note: string | null },
): Promise<void> {
  const { error } = await supabase.from("investment_valuations").upsert(
    {
      investment_id: holding.id,
      household_id: holding.household_id,
      as_of: input.asOf,
      value_paisa: input.valuePaisa,
      unit_price_paisa: input.unitPricePaisa,
      note: input.note,
    },
    { onConflict: "investment_id,as_of" },
  );
  if (error) throw error;
}

/* -------------------------------------------------------------------------- *
 * Payouts
 * -------------------------------------------------------------------------- */

export type PayoutInput = {
  date: string;
  amountPaisa: number;
  /** Null = reinvested. An account id = received into that account. */
  accountId: string | null;
  reinvest: boolean;
  note: string | null;
};

/**
 * Log profit that arrived.
 *
 * Reinvested payouts write NOTHING to the ledger and carry no account: no cash
 * moved, and the growth is already inside the holding's value. Writing an income
 * row for it would invent money the household never received.
 *
 * A received payout with no account named still records the profit — the bridge
 * is simply shut, so the ledger does not hear about it.
 */
export async function recordPayout(
  supabase: Client,
  holding: Tables<"investments">,
  input: PayoutInput,
): Promise<void> {
  let transactionId: string | null = null;

  if (!input.reinvest && input.accountId) {
    const { data, error } = await supabase
      .from("transactions")
      .insert({
        household_id: holding.household_id,
        account_id: input.accountId,
        // Positive and type 'income': unlike the principal, this IS new money.
        amount_paisa: Math.abs(input.amountPaisa),
        type: "income",
        date: input.date,
        note: `Profit from ${holding.name}`,
      })
      .select("id")
      .single();
    if (error) throw error;
    transactionId = data.id;
  }

  const { error } = await supabase.from("investment_payouts").insert({
    investment_id: holding.id,
    household_id: holding.household_id,
    date: input.date,
    amount_paisa: Math.abs(input.amountPaisa),
    destination: input.reinvest ? "reinvested" : "received",
    account_id: input.reinvest ? null : input.accountId,
    transaction_id: transactionId,
    note: input.note,
  });

  if (error) {
    if (transactionId) await supabase.from("transactions").delete().eq("id", transactionId);
    throw error;
  }

  // Reinvested profit grows the holding, so its value has to follow or the
  // money vanishes: not in the bank, and not in the certificate either.
  if (input.reinvest) {
    await recordValuation(supabase, holding, {
      asOf: input.date,
      valuePaisa: Number(holding.current_value_paisa) + Math.abs(input.amountPaisa),
      unitPricePaisa: null,
      note: "Profit reinvested",
    });
  }
}

/**
 * Remove a payout that was recorded by mistake.
 *
 * A REINVESTED payout has to be unwound in two places, not one. Recording it
 * grew the holding's value, so deleting only the payout row left the growth
 * behind — money that was in neither the bank nor the certificate, and a return
 * figure permanently overstated by the amount of every deleted mistake.
 */
export async function deletePayout(
  supabase: Client,
  holding: Tables<"investments">,
  payout: Tables<"investment_payouts">,
): Promise<void> {
  if (payout.transaction_id) {
    const { error } = await supabase.from("transactions").delete().eq("id", payout.transaction_id);
    if (error) throw error;
  }

  const { error } = await supabase.from("investment_payouts").delete().eq("id", payout.id);
  if (error) throw error;

  if (payout.destination === "reinvested") {
    // Walk the value back down by the same amount, dated today rather than
    // rewriting the original day — the holding really was worth that then, and
    // history is a record, not a draft.
    await recordValuation(supabase, holding, {
      asOf: todayISODate(),
      valuePaisa: Math.max(0, Number(holding.current_value_paisa) - Number(payout.amount_paisa)),
      unitPricePaisa: null,
      note: "Reinvested profit removed",
    });
  }
}

/** Local YYYY-MM-DD. `toISOString()` is UTC and lands on the wrong day in PKT. */
function todayISODate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`;
}

/* -------------------------------------------------------------------------- *
 * Closing a holding
 * -------------------------------------------------------------------------- */

export type ExitInput = {
  status: Extract<InvestmentStatus, "sold" | "closed">;
  exitDate: string;
  exitValuePaisa: number;
  /** Where the money landed, when the bridge is open. */
  accountId: string | null;
  note: string | null;
};

/**
 * Cash the holding in.
 *
 * The return leg is a transfer IN, mirroring the funding leg: the money coming
 * back was always yours, so it is not income. Only the profit ever was, and
 * that was recorded payout by payout as it arrived.
 */
export async function closeInvestment(
  supabase: Client,
  holding: Tables<"investments">,
  input: ExitInput,
): Promise<void> {
  let exitTransactionId: string | null = null;

  if (input.accountId && input.exitValuePaisa > 0) {
    const { data, error } = await supabase
      .from("transactions")
      .insert({
        household_id: holding.household_id,
        account_id: input.accountId,
        amount_paisa: Math.abs(input.exitValuePaisa),
        type: "transfer",
        transfer_account_id: null,
        date: input.exitDate,
        note: `Withdrew from ${holding.name}`,
      })
      .select("id")
      .single();
    if (error) throw error;
    exitTransactionId = data.id;
  }

  const { error } = await supabase
    .from("investments")
    .update({
      status: input.status,
      exit_date: input.exitDate,
      exit_value_paisa: input.exitValuePaisa,
      exit_transaction_id: exitTransactionId,
      // APPENDED, not replaced. There is no separate exit-note column, and
      // overwriting would throw away "In Abbu's name, certificate no. 4471" —
      // the one line that identifies the holding — to record why it was sold.
      note: [holding.note, input.note].filter(Boolean).join(" · ") || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", holding.id);

  if (error) {
    if (exitTransactionId) {
      await supabase.from("transactions").delete().eq("id", exitTransactionId);
    }
    throw error;
  }
}

/** Undo a close: the money never actually came back. */
export async function reopenInvestment(
  supabase: Client,
  holding: Tables<"investments">,
): Promise<void> {
  if (holding.exit_transaction_id) {
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", holding.exit_transaction_id);
    if (error) throw error;
  }

  const { error } = await supabase
    .from("investments")
    .update({
      status: "active",
      exit_date: null,
      exit_value_paisa: null,
      exit_transaction_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", holding.id);
  if (error) throw error;
}
