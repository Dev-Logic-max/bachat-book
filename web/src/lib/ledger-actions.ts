import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

/**
 * Deletion for linked entry/transaction pairs.
 *
 * Owner-decided semantics:
 *   cascade = true  -> the whole linked set goes
 *   cascade = false -> UNLINK FIRST, then delete only the record asked for
 *
 * The unlink-then-delete order is not cosmetic. quick_entries.linked_transaction_id
 * is ON DELETE SET NULL, so deleting the transaction while still linked would also
 * be safe — but deleting the ENTRY while linked leaves nothing to unlink, and the
 * surviving transaction would keep no record that it was ever paired. Doing the
 * unlink as its own statement keeps the two cases symmetrical and auditable.
 *
 * Balance handling: transactions are always removed with a plain DELETE so
 * sync_account_balance_trigger fires and re-settles accounts.balance_paisa. Never
 * write a corrected balance by hand.
 */
export async function deleteQuickEntry(
  supabase: Client,
  entry: { id: string; linked_transaction_id: string | null },
  cascade: boolean,
): Promise<void> {
  const linkedId = entry.linked_transaction_id;

  if (linkedId && cascade) {
    // Transaction first: the balance trigger runs on this statement.
    const { error: txErr } = await supabase
      .from("transactions")
      .delete()
      .eq("id", linkedId);
    if (txErr) throw txErr;
  } else if (linkedId) {
    const { error: unlinkErr } = await supabase
      .from("quick_entries")
      .update({ linked_transaction_id: null })
      .eq("id", entry.id);
    if (unlinkErr) throw unlinkErr;
  }

  const { error } = await supabase.from("quick_entries").delete().eq("id", entry.id);
  if (error) throw error;
}

/**
 * Deleting from the transaction side. Mirrors the above.
 *
 * `cascade` here means "delete the quick entry that is linked to this transaction
 * as well". When false the entry is unlinked and kept, which must happen BEFORE
 * the transaction row disappears — otherwise the FK's ON DELETE SET NULL fires
 * first and the entry is silently unlinked regardless of what the user chose.
 * Same end state, but the explicit update is what makes the intent visible.
 */
export async function deleteTransaction(
  supabase: Client,
  transactionId: string,
  linkedEntryId: string | null,
  cascade: boolean,
): Promise<void> {
  if (linkedEntryId && cascade) {
    const { error: entryErr } = await supabase
      .from("quick_entries")
      .delete()
      .eq("id", linkedEntryId);
    if (entryErr) throw entryErr;
  } else if (linkedEntryId) {
    const { error: unlinkErr } = await supabase
      .from("quick_entries")
      .update({ linked_transaction_id: null })
      .eq("id", linkedEntryId);
    if (unlinkErr) throw unlinkErr;
  }

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", transactionId);
  if (error) throw error;
}

/**
 * Finds the quick entry linked to a transaction, if any. The FK lives on
 * quick_entries, so a transaction cannot name its partner without this lookup.
 */
export async function findLinkedEntry(
  supabase: Client,
  transactionId: string,
): Promise<{ id: string; amount_paisa: number; note: string | null } | null> {
  const { data } = await supabase
    .from("quick_entries")
    .select("id, amount_paisa, note")
    .eq("linked_transaction_id", transactionId)
    .maybeSingle();

  return data ?? null;
}

/**
 * Ensures a "Cash in Hand" account exists and returns its id.
 *
 * Called lazily the first time a user wants to link cash spending, rather than
 * created for everyone at signup — an account nobody asked for is clutter until
 * it is needed.
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
