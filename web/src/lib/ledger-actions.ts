import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

/**
 * Writes against the single ledger (`transactions`).
 *
 * There is no entry/transaction pair to keep in step any more, so there is no
 * cascade choice and no unlink step: deleting a movement is one DELETE, and
 * sync_account_balance_trigger re-settles accounts.balance_paisa off the back of
 * it. Never write a corrected balance by hand — it would be undone by the next
 * movement and the ledger would stop adding up to the balance shown above it.
 */
export async function deleteMovement(
  supabase: Client,
  movementId: string,
): Promise<void> {
  const { error } = await supabase.from("transactions").delete().eq("id", movementId);
  if (error) throw error;
}

/**
 * Deletes a transfer as a PAIR.
 *
 * A transfer is two rows pointing at each other through `linked_transaction_id`.
 * Deleting one leg alone leaves the other behind, so one account keeps the
 * credit while the other never gave it up — money appears from nowhere.
 */
export async function deleteTransfer(
  supabase: Client,
  movementId: string,
  linkedLegId: string | null,
): Promise<void> {
  const ids = linkedLegId ? [movementId, linkedLegId] : [movementId];
  const { error } = await supabase.from("transactions").delete().in("id", ids);
  if (error) throw error;
}

/**
 * Deactivate: reversible. The account stops appearing anywhere and stops
 * counting toward what you hold, but every row it carries is untouched and
 * `setAccountActive(true)` puts it straight back.
 */
export async function setAccountActive(
  supabase: Client,
  accountId: string,
  active: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("accounts")
    .update({ is_archived: !active })
    .eq("id", accountId)
    // A deleted account must never come back through the reactivate path.
    .is("deleted_at", null);
  if (error) throw error;
}

/**
 * Delete: permanent, but a TOMBSTONE rather than a DELETE.
 *
 * The transactions stay. Wiping them would silently rewrite history — last
 * month's totals would change because an account was tidied up today — and the
 * requirement is that old rows survive and label themselves as belonging to a
 * deleted account. Archiving alongside the tombstone means every existing
 * "hide archived" filter keeps working without knowing about deletion.
 */
export async function deleteAccount(
  supabase: Client,
  accountId: string,
): Promise<void> {
  const { error } = await supabase
    .from("accounts")
    .update({ deleted_at: new Date().toISOString(), is_archived: true })
    .eq("id", accountId);
  if (error) throw error;
}

/** How many rows would start showing a "Deleted account" tag. */
export async function countAccountMovements(
  supabase: Client,
  accountId: string,
): Promise<number> {
  const { count } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId);
  return count ?? 0;
}

/**
 * The account every entry falls back to.
 *
 * Every movement must name an account — that is the invariant the whole model
 * rests on — so "I spent Rs 500" with nothing selected has to mean something.
 * It means cash. This finds the household's cash account, or creates one the
 * first time it is needed rather than seeding an account nobody asked for.
 *
 * Returns the OLDEST cash account when several exist, so the fallback is stable
 * across sessions instead of hopping to whichever was made last.
 */
export async function ensureCashAccount(
  supabase: Client,
  householdId: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from("accounts")
    .select("id")
    .eq("household_id", householdId)
    .eq("type", "cash")
    .eq("is_archived", false)
    .is("deleted_at", null)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from("accounts")
    .insert({
      household_id: householdId,
      name: "Cash in Hand",
      type: "cash",
      currency: "PKR",
      balance_paisa: 0,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw error ?? new Error("Could not create the Cash in Hand account.");
  }
  return data.id;
}
