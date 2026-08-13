import { ensureCashAccount } from "@/lib/ledger-actions";
import { nextDueDate, shouldSpawnNext } from "@/lib/tasks";
import { toSignedPaisa, todayISO } from "@/lib/ledger";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, MovementDirection } from "@/lib/supabase/types";
import type { Task, TaskWithChecklist } from "@/lib/tasks";

type Client = SupabaseClient<Database>;

/** What the completion dialog finally settled on. */
export interface SettleInput {
  /** UNSIGNED rupee magnitude in paisa. */
  amountPaisa: number;
  direction: MovementDirection;
  accountId: string;
  categoryId: string | null;
  /** The day the money actually moved — not necessarily the due date. */
  date: string;
}

/**
 * Complete a task.
 *
 * For a PAID task this is the moment a to-do becomes money: it writes one row
 * into `transactions` — the same single ledger Entries and Transactions read —
 * and stores its id on the task. From then on the two are kept in step by the
 * `sync_task_to_transaction` / `sync_transaction_to_task` trigger pair, so
 * correcting the amount in either place corrects it in both.
 *
 * The settle values come from the DIALOG, not from the task, because the
 * estimate on a bill is rarely what the bill says. The task is then updated to
 * match what was actually paid, which is also what keeps next month's estimate
 * honest.
 */
export async function completeTask(
  supabase: Client,
  task: Task,
  settle: SettleInput | null,
  userId: string,
): Promise<{ transactionId: string | null; spawnedId: string | null }> {
  let transactionId: string | null = null;

  if (task.is_paid && settle) {
    // Never write a movement that belongs to no account — the invariant the
    // whole ledger rests on. Cash is the honest fallback.
    const accountId =
      settle.accountId || (await ensureCashAccount(supabase, task.household_id));

    const { data, error } = await supabase
      .from("transactions")
      .insert({
        household_id: task.household_id,
        account_id: accountId,
        category_id: settle.categoryId,
        amount_paisa: toSignedPaisa(settle.direction, settle.amountPaisa),
        type: settle.direction,
        date: settle.date,
        note: task.title,
        created_by: userId,
      })
      .select("id")
      .single();

    if (error || !data) throw error ?? new Error("Could not write the entry.");
    transactionId = data.id;
  }

  const { error: taskErr } = await supabase
    .from("tasks")
    .update({
      status: "done",
      is_done: true,
      completed_at: new Date().toISOString(),
      settled_transaction_id: transactionId,
      // Fold what was actually paid back onto the task, so the record and the
      // ledger agree and the next occurrence inherits the real figure.
      ...(settle
        ? {
            amount_paisa: settle.amountPaisa,
            direction: settle.direction,
            account_id: settle.accountId || null,
            category_id: settle.categoryId,
          }
        : {}),
    })
    .eq("id", task.id);
  if (taskErr) throw taskErr;

  /*
   * Spawn the next turn only if the calendar says it is time.
   *
   * Completion does not drive recurrence — the lead time does. Completing
   * August's bill on the 2nd must not put September's on the board four weeks
   * early; it appears on its own schedule, whether or not August was paid.
   */
  const spawnedId = shouldSpawnNext(task)
    ? await spawnNextOccurrence(supabase, task, settle)
    : null;

  return { transactionId, spawnedId };
}

/** Un-complete: put the task back and remove the entry it wrote. */
export async function uncompleteTask(
  supabase: Client,
  task: Task,
  removeEntry: boolean,
): Promise<void> {
  /*
   * The entry goes FIRST, while the task still points at it. `on delete set
   * null` then clears the link for us, and the balance trigger re-settles the
   * account. Clearing the link first would orphan the row — money missing from
   * a balance with nothing on any screen explaining it.
   */
  if (removeEntry && task.settled_transaction_id) {
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", task.settled_transaction_id);
    if (error) throw error;
  }

  const { error } = await supabase
    .from("tasks")
    .update({
      status: "todo",
      is_done: false,
      completed_at: null,
      ...(removeEntry ? { settled_transaction_id: null } : {}),
    })
    .eq("id", task.id);
  if (error) throw error;
}

/**
 * Delete a task, and optionally the ledger entry it wrote.
 *
 * `alsoEntry` defaults to FALSE at every call site. The money genuinely left
 * your account; tidying a to-do list must not quietly un-spend it.
 */
export async function deleteTask(
  supabase: Client,
  task: Task,
  alsoEntry: boolean,
): Promise<void> {
  if (alsoEntry && task.settled_transaction_id) {
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", task.settled_transaction_id);
    if (error) throw error;
  }
  // Subtasks go with it — `task_checklist_items.task_id` cascades.
  const { error } = await supabase.from("tasks").delete().eq("id", task.id);
  if (error) throw error;
}

/**
 * Create the next turn of a repeating task.
 *
 * Copies the shape — title, account, category, amount, priority, repeat rule —
 * and the SUBTASK LIST, unticked. A bill whose checklist ("download invoice,
 * pay, file receipt") had to be retyped every month is a checklist nobody keeps.
 */
export async function spawnNextOccurrence(
  supabase: Client,
  task: Task,
  settle: SettleInput | null = null,
): Promise<string | null> {
  const nextDue = nextDueDate(task.due_date, task.repeat_rule);
  if (!nextDue) return null;

  const seriesId = task.series_id ?? task.id;

  // Never two live copies of the same turn — a double-fire (two tabs, a retry)
  // would otherwise put September's bill on the board twice.
  const { data: existing } = await supabase
    .from("tasks")
    .select("id")
    .eq("series_id", seriesId)
    .eq("due_date", nextDue)
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("tasks")
    .insert({
      user_id: task.user_id,
      household_id: task.household_id,
      title: task.title,
      description: task.description,
      due_date: nextDue,
      priority: task.priority,
      status: "todo",
      is_done: false,
      is_paid: task.is_paid,
      // Last month's actual is a better estimate than the original guess.
      amount_paisa: settle?.amountPaisa ?? task.amount_paisa,
      direction: settle?.direction ?? task.direction,
      account_id: settle?.accountId ?? task.account_id,
      category_id: settle?.categoryId ?? task.category_id,
      repeat_rule: task.repeat_rule,
      repeat_lead_days: task.repeat_lead_days,
      series_id: seriesId,
    })
    .select("id")
    .single();

  if (error || !created) throw error ?? new Error("Could not create the next task.");

  // Stamp the series onto the original too, so both turns are findable as one.
  if (!task.series_id) {
    await supabase.from("tasks").update({ series_id: seriesId }).eq("id", task.id);
  }

  const items = (task as TaskWithChecklist).task_checklist_items ?? [];
  if (items.length > 0) {
    await supabase.from("task_checklist_items").insert(
      items.map((i) => ({
        task_id: created.id,
        title: i.title,
        sort_order: i.sort_order,
        is_done: false,
      })),
    );
  }

  return created.id;
}

/**
 * Catch up any repeating series whose next turn is now due to appear.
 *
 * Runs on load. Recurrence is calendar-driven rather than completion-driven, so
 * something has to notice that the date has arrived — and with no scheduler in
 * front of the database yet, opening the module is that something. It is
 * idempotent: `spawnNextOccurrence` returns the existing row when the turn has
 * already been created.
 */
export async function catchUpRecurringTasks(
  supabase: Client,
  tasks: Task[],
): Promise<number> {
  const today = todayISO();
  const due = tasks.filter(
    (t) => t.repeat_rule !== "none" && shouldSpawnNext(t, today),
  );

  // spawnNextOccurrence returns the EXISTING row when the turn is already on
  // the board, so a returned id that we already knew about is not a new task.
  const known = new Set(tasks.map((t) => t.id));

  let created = 0;
  for (const t of due) {
    const id = await spawnNextOccurrence(supabase, t);
    if (id && !known.has(id)) {
      known.add(id);
      created += 1;
    }
  }
  return created;
}
