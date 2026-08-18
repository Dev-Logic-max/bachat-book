"use client";

import * as React from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  GripVertical,
  ListChecks,
  Plus,
  Repeat,
  Trash2,
  Wallet2,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { RichSelect } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/components/ui/toast";
import { CategoryPicker } from "@/components/category-picker";
import { useHiddenCategoryIds } from "@/lib/use-hidden-categories";
import { accountSelectOptions } from "@/components/account-options";
import { createClient } from "@/lib/supabase/client";
import { todayISO } from "@/lib/ledger";
import {
  MIN_GENERATION_LEAD,
  NOTIFY_LEAD,
  PERIOD_DAYS,
  REPEAT_LABEL,
  generationLeadDays,
  nextDueDate,
} from "@/lib/tasks";
import { cn } from "@/lib/utils";

import type { AccountWithInstitution } from "@/components/account-options";
import type { SelectOption } from "@/components/ui/select";
import type { TaskWithChecklist } from "@/lib/tasks";
import type {
  MovementDirection,
  TaskPriority,
  TaskRepeatRule,
  Tables,
} from "@/lib/supabase/types";

type DraftItem = { id: string | null; title: string; is_done: boolean };

/**
 * Create and edit a task — one form, because a create screen that omits half the
 * fields teaches you the feature does not exist.
 *
 * Three things live here that a plain to-do does not have:
 *
 *  - SUBTASKS, which are also what drives the board column. No subtask ticked is
 *    "To do", some ticked is "In progress" — so the column means something
 *    instead of recording where a card was last dragged.
 *  - PAYMENT, so completing the task writes the entry rather than sending you to
 *    the Entries form to type what you just did again.
 *  - REPEAT, so a monthly bill is set up once.
 */
export function TaskFormModal({
  isOpen,
  onClose,
  householdId,
  userId,
  task = null,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  householdId: string;
  userId: string;
  /** Present = edit mode. */
  task?: TaskWithChecklist | null;
  onSuccess?: () => void;
}) {
  const supabase = createClient();
  const hiddenCategoryIds = useHiddenCategoryIds(householdId);

  const { showToast } = useToast();
  const isEdit = Boolean(task);

  /*
   * A COMPLETED task is a different form.
   *
   * Its money has already moved and its subtasks are already ticked, so the due
   * date, the priority, the recurrence and the "this moves money" switch are all
   * decisions that can no longer take effect — offering them again reads as if
   * changing one would do something. What is still worth correcting is what the
   * ledger row says: the name, the note, the figure and the label. Those write
   * through to the entry, because the database keeps the two in step.
   */
  const isSettled = Boolean(task && (task.is_done || task.status === "done"));

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [dueDate, setDueDate] = React.useState(todayISO());
  /*
   * LOW by default.
   *
   * Priority here only decides how many days early the reminder fires, and a new
   * task is not urgent until someone says so. Defaulting to medium put every
   * chore on a two-day warning ladder and made the setting mean nothing, because
   * everything sat at the same rung.
   */
  const [priority, setPriority] = React.useState<TaskPriority>("low");
  const [repeatRule, setRepeatRule] = React.useState<TaskRepeatRule>("none");
  const [leadDays, setLeadDays] = React.useState("");
  const [isPaid, setIsPaid] = React.useState(false);
  const [direction, setDirection] = React.useState<MovementDirection>("expense");
  const [amount, setAmount] = React.useState("");
  const [accountId, setAccountId] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [items, setItems] = React.useState<DraftItem[]>([]);
  const [newItem, setNewItem] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const [accounts, setAccounts] = React.useState<AccountWithInstitution[]>([]);
  const [categories, setCategories] = React.useState<Tables<"categories">[]>([]);

  // Re-seed on open / when the edited task changes. The component stays mounted
  // between openings, so a state initialiser cannot do it, and React Compiler
  // rejects a synchronous setState in an effect.
  const seedKey = `${isOpen}:${task?.id ?? "new"}`;
  const [seeded, setSeeded] = React.useState(seedKey);
  if (seeded !== seedKey) {
    setSeeded(seedKey);
    if (isOpen) {
      setTitle(task?.title ?? "");
      setDescription(task?.description ?? "");
      setDueDate(task?.due_date ?? todayISO());
      setPriority(task?.priority ?? "low");
      setRepeatRule(task?.repeat_rule ?? "none");
      setLeadDays(task?.repeat_lead_days ? String(task.repeat_lead_days) : "");
      setIsPaid(task?.is_paid ?? false);
      setDirection(task?.direction ?? "expense");
      setAmount(task?.amount_paisa ? String(task.amount_paisa / 100) : "");
      setAccountId(task?.account_id ?? "");
      setCategoryId(task?.category_id ?? "");
      setItems(
        (task?.task_checklist_items ?? [])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((i) => ({ id: i.id, title: i.title, is_done: i.is_done })),
      );
      setNewItem("");
    }
  }

  React.useEffect(() => {
    if (!isOpen || !householdId) return;
    let active = true;

    async function load() {
      const [accRes, catRes] = await Promise.all([
        supabase
          .from("accounts")
          .select("*, institutions(*)")
          .eq("household_id", householdId)
          .is("deleted_at", null)
          .order("created_at"),
        supabase.from("categories").select("*").order("name"),
      ]);
      if (!active) return;
      if (accRes.data) setAccounts(accRes.data as unknown as AccountWithInstitution[]);
      if (catRes.data) setCategories(catRes.data);
    }

    load();
    return () => {
      active = false;
    };
  }, [isOpen, householdId, supabase]);

  /*
   * A DAILY task can only be low priority.
   *
   * "High priority, every day" is a contradiction — the reminder ladder exists
   * to warn you days ahead, and there are no days ahead. Enforced by a database
   * constraint too, so an import cannot sneak one in.
   */
  const priorityForced = repeatRule === "daily";
  const effectivePriority: TaskPriority = priorityForced ? "low" : priority;

  const cashAccountId =
    accounts.find((a) => a.type === "cash" && !a.is_archived && !a.deleted_at)?.id ?? "";
  const effectiveAccountId = accountId || cashAccountId;

  const accountOptions: SelectOption[] = React.useMemo(
    () => accountSelectOptions(accounts, { direction }),
    [accounts, direction],
  );

  /*
   * Switching the direction invalidates the chosen category — the kinds are
   * disjoint sets in the DB. Derived during render rather than reset in an
   * effect, which React Compiler rejects. CategoryPicker splits this single id
   * back into its main/sub fields, so nothing here can disagree with it.
   */
  const chosenCategory = categories.find((c) => c.id === categoryId);
  const effectiveCategoryId =
    chosenCategory?.kind === direction ? categoryId : "";

  const minLead = MIN_GENERATION_LEAD[effectivePriority];
  const effectiveLead = generationLeadDays(
    repeatRule,
    effectivePriority,
    leadDays ? Number(leadDays) : null,
  );
  const period = PERIOD_DAYS[repeatRule];
  const nextDue = nextDueDate(dueDate, repeatRule);

  const addItem = () => {
    const t = newItem.trim();
    if (!t) return;
    setItems((prev) => [...prev, { id: null, title: t, is_done: false }]);
    setNewItem("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast({ type: "error", title: "Give the task a name" });
      return;
    }
    const paisa = Math.round((parseFloat(amount) || 0) * 100);
    const needsAmount = isSettled ? Boolean(task?.is_paid) : isPaid;
    if (needsAmount && paisa <= 0) {
      showToast({
        type: "error",
        title: "This task needs an amount",
        description: isSettled
          ? "Its ledger entry cannot be worth nothing."
          : "Without one, completing it could not write an entry.",
      });
      return;
    }

    setLoading(true);
    try {
      /*
       * A completed task writes back only what the ledger row can still follow.
       * Re-sending due_date, priority or repeat_rule from a form that never
       * showed them would quietly reset them to this component's defaults.
       */
      const payload = isSettled
        ? {
            title: title.trim(),
            description: description.trim() || null,
            ...(task?.is_paid
              ? {
                  amount_paisa: paisa,
                  account_id: effectiveAccountId || null,
                  category_id: effectiveCategoryId || null,
                }
              : {}),
          }
        : {
            title: title.trim(),
            description: description.trim() || null,
            due_date: dueDate,
            priority: effectivePriority,
            repeat_rule: repeatRule,
            repeat_lead_days: leadDays ? Number(leadDays) : null,
            is_paid: isPaid,
            // Cleared together with is_paid: a stale amount on an unpaid task
            // would reappear as an estimate the day someone ticks "this costs
            // money".
            amount_paisa: isPaid ? paisa : null,
            direction: isPaid ? direction : null,
            account_id: isPaid ? effectiveAccountId || null : null,
            category_id: isPaid ? effectiveCategoryId || null : null,
          };

      let taskId = task?.id ?? "";

      if (isEdit && task) {
        const { error } = await supabase.from("tasks").update(payload).eq("id", task.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("tasks")
          .insert({ ...payload, user_id: userId, household_id: householdId })
          .select("id")
          .single();
        if (error || !data) throw error ?? new Error("Could not create the task.");
        taskId = data.id;
      }

      // The subtask editor is not shown for a completed task, so `items` holds a
      // stale copy of the list. Writing it back would delete nothing and update
      // nothing, but there is no reason to send the statements.
      if (!isSettled) await saveChecklist(taskId);

      showToast({
        type: "success",
        title: isEdit ? "Task updated" : "Task created",
        description: isSettled
          ? task?.settled_transaction_id
            ? "Its ledger entry was updated to match."
            : undefined
          : isPaid
            ? "Completing it will write an entry you can adjust first."
            : undefined,
      });
      onClose();
      onSuccess?.();
    } catch (err) {
      showToast({
        type: "error",
        title: isEdit ? "Could not update the task" : "Could not create the task",
        description: err instanceof Error ? err.message : "Unknown error.",
      });
    } finally {
      setLoading(false);
    }
  };

  /** Replace the subtask list, keeping the ticked state of surviving rows. */
  async function saveChecklist(taskId: string) {
    const keptIds = items.map((i) => i.id).filter(Boolean) as string[];

    if (isEdit) {
      const removed = (task?.task_checklist_items ?? [])
        .filter((i) => !keptIds.includes(i.id))
        .map((i) => i.id);
      if (removed.length > 0) {
        await supabase.from("task_checklist_items").delete().in("id", removed);
      }
    }

    for (const [index, item] of items.entries()) {
      if (item.id) {
        await supabase
          .from("task_checklist_items")
          .update({ title: item.title, sort_order: index })
          .eq("id", item.id);
      } else {
        await supabase.from("task_checklist_items").insert({
          task_id: taskId,
          title: item.title,
          sort_order: index,
          is_done: false,
        });
      }
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isSettled ? "Edit completed task" : isEdit ? "Edit task" : "New task"}
      subtitle={
        isSettled
          ? task?.settled_transaction_id
            ? "Changes here update its ledger entry too"
            : "Already completed"
          : isPaid
            ? "Completing this will record a payment"
            : "A to-do or a reminder"
      }
      icon={isSettled ? <CheckCircle2 size={16} /> : <ListChecks size={16} />}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={loading}>
            {isEdit ? "Save changes" : "Create task"}
          </Button>
        </>
      }
    >
      {isSettled ? (
        <SettledFields
          task={task!}
          title={title}
          setTitle={setTitle}
          description={description}
          setDescription={setDescription}
          amount={amount}
          setAmount={setAmount}
          accountId={effectiveAccountId}
          setAccountId={setAccountId}
          accountOptions={accountOptions}
          accountsLoaded={accounts.length > 0}
          categoryId={effectiveCategoryId}
          setCategoryId={setCategoryId}
          categories={categories}
          direction={direction}
          householdId={householdId}
          hiddenCategoryIds={hiddenCategoryIds}
        />
      ) : (
      <div className="space-y-4">
        <Input
          label="Task"
          placeholder="e.g. Pay K-Electric bill"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          autoFocus
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DatePicker label="Due date" value={dueDate} onChange={setDueDate} required />
          <RichSelect
            label="Priority"
            value={effectivePriority}
            onChange={(v) => setPriority(v as TaskPriority)}
            disabled={priorityForced}
            options={PRIORITY_OPTIONS}
            hint={
              priorityForced
                ? "Daily tasks are always low — there is no room for a warning ladder."
                : `Reminds you ${NOTIFY_LEAD[effectivePriority]} day${NOTIFY_LEAD[effectivePriority] === 1 ? "" : "s"} before it is due.`
            }
          />
        </div>

        <Input
          label="Notes (optional)"
          placeholder="e.g. Meter reading is on the back gate"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        {/* ---- Subtasks ------------------------------------------------- */}
        <section className="border-border overflow-hidden rounded-card border">
          <header className="bg-surface-subtle border-border flex items-center gap-2 border-b px-3.5 py-2.5">
            <ListChecks size={13} className="text-brass-strong shrink-0" />
            <span className="text-foreground-2 text-[12px] font-medium">Subtasks</span>
            <span className="text-faint ms-auto text-[10.5px] italic">
              {items.length === 0
                ? "optional"
                : `${items.filter((i) => i.is_done).length}/${items.length} done`}
            </span>
          </header>

          <div className="space-y-2 p-3.5">
            <p className="text-faint text-[11px] italic leading-snug">
              Ticking the first one moves this task to In progress; ticking them
              all marks it ready to complete. The board column follows the list,
              so you never drag a card.
            </p>

            {items.length > 0 && (
              <ul className="space-y-1.5">
                {items.map((item, i) => (
                  <li
                    key={item.id ?? `new-${i}`}
                    className="bg-surface-subtle flex items-center gap-2 rounded-control px-2.5 py-1.5"
                  >
                    <GripVertical size={12} className="text-faint shrink-0" />
                    <input
                      value={item.title}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((p, pi) =>
                            pi === i ? { ...p, title: e.target.value } : p,
                          ),
                        )
                      }
                      className="text-foreground min-w-0 flex-1 bg-transparent text-[12px] outline-none"
                    />
                    {item.is_done && (
                      <span className="bg-gain-soft text-gain shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold">
                        done
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setItems((prev) => prev.filter((_, pi) => pi !== i))}
                      aria-label={`Remove ${item.title}`}
                      title="Remove"
                      className="text-loss/80 hover:text-loss hover:bg-loss-soft flex size-6 shrink-0 items-center justify-center rounded-full transition-colors"
                    >
                      <Trash2 size={12} strokeWidth={1.75} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-center gap-2">
              <input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => {
                  // Enter adds a subtask; it must NOT submit the whole form.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addItem();
                  }
                }}
                placeholder="Add a step and press Enter"
                className="border-border bg-surface text-foreground placeholder:text-faint h-9 min-w-0 flex-1 rounded-control border px-3 text-[12px] outline-none"
              />
              <Button type="button" variant="secondary" size="sm" onClick={addItem}>
                <Plus size={13} />
                Add
              </Button>
            </div>
          </div>
        </section>

        {/* ---- Money ---------------------------------------------------- */}
        <section className="border-border overflow-hidden rounded-card border">
          <label className="bg-surface-subtle border-border flex cursor-pointer items-start gap-2.5 border-b px-3.5 py-3">
            <input
              type="checkbox"
              checked={isPaid}
              onChange={(e) => setIsPaid(e.target.checked)}
              className="accent-navy-900 dark:accent-brass mt-0.5 size-4 shrink-0 rounded"
            />
            <span className="min-w-0">
              <span className="text-foreground flex items-center gap-1.5 text-[12.5px] font-medium">
                <Wallet2 size={13} />
                This task moves money
              </span>
              <span className="text-muted mt-0.5 block text-[11.5px] leading-snug">
                Completing it writes one entry into your ledger — you confirm the
                amount and account first, so a wrong estimate never becomes a
                wrong balance.
              </span>
            </span>
          </label>

          {isPaid && (
            <div className="space-y-3 p-3.5">
              <div className="bg-surface-subtle grid grid-cols-2 gap-1 rounded-control p-1">
                {(
                  [
                    { v: "expense" as const, label: "Money out", Icon: ArrowDownRight },
                    { v: "income" as const, label: "Money in", Icon: ArrowUpRight },
                  ]
                ).map(({ v, label, Icon }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setDirection(v)}
                    aria-pressed={direction === v}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-control py-1.5 text-xs font-medium transition-colors",
                      direction === v
                        ? "bg-surface text-foreground shadow-xs"
                        : "text-muted hover:text-foreground",
                    )}
                  >
                    <Icon
                      size={13}
                      className={v === "expense" ? "text-loss" : "text-gain"}
                    />
                    {label}
                  </button>
                ))}
              </div>

              <Input
                label="Usual amount (PKR)"
                type="number"
                step="any"
                min="0"
                placeholder="e.g. 8400"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="tnum"
                hint="An estimate is fine — you confirm the real figure when you complete it."
              />

              <RichSelect
                label="Pay from"
                value={effectiveAccountId}
                onChange={setAccountId}
                options={accountOptions}
                placeholder={accounts.length === 0 ? "Loading…" : "Choose an account"}
                emptyMessage="Add an account first"
                hint="Defaults to cash. You can switch account at the moment you pay."
              />

              <CategoryPicker
                value={effectiveCategoryId}
                onChange={setCategoryId}
                categories={categories}
                kind={direction}
                householdId={householdId}
                hiddenIds={hiddenCategoryIds}
              />
            </div>
          )}
        </section>

        {/* ---- Repeat --------------------------------------------------- */}
        {/*
          One row, not a panel. A one-off task is the common case and the whole
          section used to be a bordered box with a heading, a select, a number
          field and two paragraphs of explanation sitting under every task anyone
          created. The explanation only says something once a rule is picked.
        */}
        <section className="border-border overflow-hidden rounded-card border">
          <div className="bg-surface-subtle flex items-center gap-2.5 px-3.5 py-2">
            <Repeat size={13} className="text-brass-strong shrink-0" />
            <span className="text-foreground-2 shrink-0 text-[12px] font-medium">
              Repeat
            </span>
            <div className="ms-auto min-w-0 max-w-52 flex-1">
              <RichSelect
                value={repeatRule}
                onChange={(v) => setRepeatRule(v as TaskRepeatRule)}
                options={REPEAT_OPTIONS}
                className="h-8 text-[12px]"
              />
            </div>
          </div>

          {repeatRule !== "none" && (
            <div className="border-border space-y-2.5 border-t p-3.5">
              {period !== 1 && (
                <Input
                  label="Create the next one this many days early"
                  type="number"
                  min={minLead}
                  max={period ? period - 1 : 365}
                  placeholder={String(minLead)}
                  value={leadDays}
                  onChange={(e) => setLeadDays(e.target.value)}
                  className="tnum"
                />
              )}

              <p className="text-faint flex items-start gap-2 text-[11px] italic leading-snug">
                <Bell size={12} className="text-brass-strong mt-0.5 shrink-0" />
                <span>
                  {period === 1 ? (
                    <>
                      A daily task appears on the day it is due — creating it
                      early would only stack up copies of the same day&apos;s work.
                    </>
                  ) : (
                    <>
                      The next one appears{" "}
                      <span className="text-foreground-2 not-italic">
                        {effectiveLead} day{effectiveLead === 1 ? "" : "s"}
                      </span>{" "}
                      early
                      {nextDue && (
                        <>
                          , around{" "}
                          <span className="ltr text-foreground-2 not-italic">
                            {nextDue}
                          </span>
                        </>
                      )}
                      . Completing this one does not bring it forward — an unpaid
                      bill still owes its money.
                      {leadDays && Number(leadDays) !== effectiveLead && (
                        <> Your {leadDays} was trimmed to fit one {repeatRule} cycle.</>
                      )}
                    </>
                  )}
                </span>
              </p>
            </div>
          )}
        </section>
      </div>
      )}
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * The completed-task form: only what a settled ledger row can still follow.
 *
 * `sync_task_to_transaction` fires on title, amount, direction, account and
 * category, so each of these writes through to the entry. Anything else on the
 * task — due date, priority, recurrence — cannot reach it, and showing a control
 * whose only effect is on a record nobody will look at again is worse than not
 * showing it.
 */
function SettledFields({
  task,
  title,
  setTitle,
  description,
  setDescription,
  amount,
  setAmount,
  accountId,
  setAccountId,
  accountOptions,
  accountsLoaded,
  categoryId,
  setCategoryId,
  categories,
  direction,
  householdId,
  hiddenCategoryIds,
}: {
  task: TaskWithChecklist;
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  amount: string;
  setAmount: (v: string) => void;
  accountId: string;
  setAccountId: (v: string) => void;
  accountOptions: SelectOption[];
  accountsLoaded: boolean;
  categoryId: string;
  setCategoryId: (v: string) => void;
  categories: Tables<"categories">[];
  direction: MovementDirection;
  householdId: string;
  hiddenCategoryIds: ReadonlySet<string>;
}) {
  return (
    <div className="space-y-4">
      <Input
        label="Task"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        autoFocus
        hint={
          task.settled_transaction_id
            ? "This is also what the ledger entry is called."
            : undefined
        }
      />

      <Input
        label="Notes (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      {task.is_paid && (
        <>
          <Input
            label={direction === "income" ? "Amount received (PKR)" : "Amount paid (PKR)"}
            type="number"
            step="any"
            min="0"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="tnum"
            required
          />

          <RichSelect
            label={direction === "income" ? "Received into" : "Paid from"}
            value={accountId}
            onChange={setAccountId}
            options={accountOptions}
            placeholder={accountsLoaded ? "Choose an account" : "Loading…"}
            emptyMessage="Add an account first"
          />

          <CategoryPicker
            value={categoryId}
            onChange={setCategoryId}
            categories={categories}
            kind={direction}
            householdId={householdId}
            hiddenIds={hiddenCategoryIds}
          />

          <p className="text-faint text-[11px] italic leading-snug">
            Correcting the amount here moves the balance by the difference — the
            entry is the same row your account was settled from, not a copy of it.
          </p>
        </>
      )}
    </div>
  );
}

const PRIORITY_OPTIONS: SelectOption[] = [
  {
    value: "high",
    label: "High",
    description: "Reminds 3 days before",
    icon: <span className="bg-loss block size-2 rounded-full" />,
  },
  {
    value: "medium",
    label: "Medium",
    description: "Reminds 2 days before",
    icon: <span className="bg-brass block size-2 rounded-full" />,
  },
  {
    value: "low",
    label: "Low",
    description: "Reminds 1 day before",
    icon: <span className="bg-border-strong block size-2 rounded-full" />,
  },
];

const REPEAT_OPTIONS: SelectOption[] = (
  ["none", "daily", "weekly", "monthly", "yearly"] as TaskRepeatRule[]
).map((r) => ({
  value: r,
  label: REPEAT_LABEL[r],
  description:
    r === "none"
      ? "A one-off"
      : r === "daily"
        ? "Low priority only"
        : `Next one is created before it is due`,
}));
