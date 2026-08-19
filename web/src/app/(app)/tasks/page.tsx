"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ChevronUp,
  Circle,
  Coins,
  Flag,
  Kanban,
  Landmark,
  ListChecks,
  Minus,
  Plus,
  Receipt,
  Repeat,
  RotateCcw,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Reveal } from "@/components/reveal";
import { EmptyState } from "@/components/empty-state";
import { PageActions } from "@/components/page-actions";
import { TaskFormModal } from "@/components/task-form-modal";
import { CompleteTaskModal } from "@/components/complete-task-modal";
import { SubtaskPriceModal } from "@/components/subtask-price-modal";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { ConfirmActionModal } from "@/components/confirm-action-modal";
import { CategoryIcon, categoryLabel, toneColor } from "@/components/category-icon";
import { RowActions } from "@/components/ui/row-actions";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import {
  catchUpRecurringTasks,
  completeTask,
  deleteTask,
  uncompleteTask,
} from "@/lib/task-actions";
import {
  REPEAT_LABEL,
  checklistProgress,
  compareDone,
  compareOpen,
  deriveStatus,
  dueLabel,
  dueTone,
  isReadyToComplete,
  orderedItems,
  subtaskTotalPaisa,
} from "@/lib/tasks";
import { formatPKR } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { AccountWithInstitution } from "@/components/account-options";
import type { SettleInput } from "@/lib/task-actions";
import type { ChecklistItem, DueTone, TaskWithChecklist } from "@/lib/tasks";
import type { TaskPriority, TaskStatus, Tables } from "@/lib/supabase/types";

/** Just enough of the settled entry to link to it and say what it was. */
type SettledRef = { id: string; date: string; amount_paisa: number };

type ViewMode = "board" | "list";

/**
 * Tasks.
 *
 * Two rules make this more than a to-do list:
 *
 * 1. THE COLUMN IS DERIVED. To do / In progress / Completed is a function of the
 *    subtasks, not a field you drag between. A column that records where a card
 *    was last dropped tells you nothing you did not already know.
 * 2. A TASK CAN MOVE MONEY. Completing a paid task writes one row into the same
 *    single ledger Entries and Transactions read, after a dialog where you fix
 *    the amount and the account. The task and that entry stay in step in both
 *    directions — the database keeps them there, not the modal.
 */
export default function TasksPage() {
  const session = useSession();
  const supabase = createClient();
  const { showToast } = useToast();

  const householdId = session.household?.id || "";
  const userId = session.user.id;

  const [tasks, setTasks] = React.useState<TaskWithChecklist[]>([]);
  const [accounts, setAccounts] = React.useState<AccountWithInstitution[]>([]);
  const [categories, setCategories] = React.useState<Tables<"categories">[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [viewMode, setViewMode] = React.useState<ViewMode>("board");
  const [refreshKey, setRefreshKey] = React.useState(0);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<TaskWithChecklist | null>(null);
  const [completing, setCompleting] = React.useState<TaskWithChecklist | null>(null);
  const [reopening, setReopening] = React.useState<TaskWithChecklist | null>(null);
  const [deleting, setDeleting] = React.useState<TaskWithChecklist | null>(null);
  const [pricing, setPricing] = React.useState<{
    item: ChecklistItem;
    task: TaskWithChecklist;
  } | null>(null);
  const [busy, setBusy] = React.useState(false);

  /** The ledger entries completed tasks wrote, keyed by task id. */
  const [settledRefs, setSettledRefs] = React.useState<Map<string, SettledRef>>(
    () => new Map(),
  );

  const reload = () => setRefreshKey((k) => k + 1);

  React.useEffect(() => {
    if (!householdId) return;
    let active = true;

    async function load() {
      const [taskRes, accRes, catRes] = await Promise.all([
        supabase
          .from("tasks")
          .select("*, task_checklist_items(*)")
          .eq("household_id", householdId)
          .order("due_date", { ascending: true }),
        supabase
          .from("accounts")
          .select("*, institutions(*)")
          .eq("household_id", householdId)
          .is("deleted_at", null)
          .order("created_at"),
        supabase.from("categories").select("*").order("sort_order").order("name"),
      ]);

      if (!active) return;
      if (accRes.data) setAccounts(accRes.data as unknown as AccountWithInstitution[]);
      if (catRes.data) setCategories(catRes.data);

      const rows = (taskRes.data ?? []) as unknown as TaskWithChecklist[];
      setTasks(rows);
      setLoading(false);

      /*
       * Fetch the entries the completed tasks wrote, so a finished card can link
       * to the money rather than merely claim it moved. The date is what makes
       * the link land: Entries opens on a month, and a task completed in June is
       * nowhere to be seen on the August page.
       */
      const settledIds = rows
        .map((t) => t.settled_transaction_id)
        .filter((id): id is string => Boolean(id));

      if (settledIds.length > 0) {
        const { data: txs } = await supabase
          .from("transactions")
          .select("id, date, amount_paisa")
          .in("id", settledIds);
        if (!active) return;

        const byTx = new Map((txs ?? []).map((t) => [t.id, t as SettledRef]));
        setSettledRefs(
          new Map(
            rows.flatMap((t) => {
              const ref = t.settled_transaction_id
                ? byTx.get(t.settled_transaction_id)
                : undefined;
              return ref ? [[t.id, ref] as const] : [];
            }),
          ),
        );
      }

      /*
       * Bring any repeating series up to date.
       *
       * Recurrence is calendar-driven, not completion-driven, so SOMETHING has
       * to notice the date arrived. With no scheduler in front of the database
       * yet, opening the module is that something. It is idempotent — a turn
       * already on the board is never created twice.
       */
      const created = await catchUpRecurringTasks(supabase, rows);
      if (created > 0 && active) {
        showToast({
          type: "success",
          title: `${created} repeating ${created === 1 ? "task is" : "tasks are"} due soon`,
          description: "Added to your board ahead of time.",
        });
        setRefreshKey((k) => k + 1);
      }
    }

    load();
    return () => {
      active = false;
    };
    // `showToast` is stable; including it would re-run the catch-up on render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId, supabase, refreshKey]);

  /*
   * FOUR columns, and OVERDUE is the first of them.
   *
   * It is not a fourth status — it is To do and In progress past their date —
   * but leaving those cards mixed in with work that is merely scheduled buries
   * the only ones costing money in late fees. Pulling them out is the whole
   * reason a board beats a list here.
   *
   * The column is dropped entirely when empty rather than shown with a cheerful
   * zero: a permanent "Overdue 0" is a scolding shape on a screen where nothing
   * is wrong.
   */
  const byStatus = React.useMemo(() => {
    const overdue: TaskWithChecklist[] = [];
    const todo: TaskWithChecklist[] = [];
    const inProgress: TaskWithChecklist[] = [];
    const done: TaskWithChecklist[] = [];

    for (const t of tasks) {
      const s = deriveStatus(t);
      if (s === "done") {
        done.push(t);
      } else if (dueTone(t.due_date, t.priority) === "overdue") {
        overdue.push(t);
      } else if (s === "in_progress") {
        inProgress.push(t);
      } else {
        todo.push(t);
      }
    }

    // Open work: soonest due first. Completed: most recently finished first.
    overdue.sort(compareOpen);
    todo.sort(compareOpen);
    inProgress.sort(compareOpen);
    done.sort(compareDone);
    return { overdue, todo, inProgress, done };
  }, [tasks]);

  const overdue = byStatus.overdue;
  const openTasks =
    byStatus.todo.length + byStatus.inProgress.length + overdue.length;

  /**
   * Ticking the circle never changes anything silently — in EITHER direction.
   *
   * Completing was already a dialog, because for a paid task it writes an entry.
   * Reopening one used to fire on the click: it DELETES that entry and
   * re-settles the account, so a mis-aimed tap on a finished card silently
   * un-spent real money and the only notice was a toast that had already
   * happened. Both directions now ask first.
   */
  const requestComplete = (task: TaskWithChecklist) => {
    if (deriveStatus(task) === "done") {
      setReopening(task);
      return;
    }
    setCompleting(task);
  };

  const handleComplete = async (settle: SettleInput | null) => {
    if (!completing) return;
    setBusy(true);
    try {
      const { transactionId, spawnedId } = await completeTask(
        supabase,
        completing,
        settle,
        userId,
      );
      showToast({
        type: "success",
        title: "Task completed",
        description: [
          transactionId && settle
            ? `${formatPKR(settle.amountPaisa)} recorded in your ledger.`
            : null,
          spawnedId ? "The next one is on the board." : null,
        ]
          .filter(Boolean)
          .join(" ") || undefined,
      });
      setCompleting(null);
      reload();
    } catch (err) {
      showToast({
        type: "error",
        title: "Could not complete the task",
        description: err instanceof Error ? err.message : "Unknown error.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleUncomplete = async () => {
    const task = reopening;
    if (!task) return;
    setBusy(true);
    try {
      const hadEntry = Boolean(task.settled_transaction_id);
      await uncompleteTask(supabase, task, hadEntry);
      showToast({
        type: "success",
        title: "Task reopened",
        description: hadEntry
          ? "The entry it created was removed and the balance re-settled."
          : undefined,
      });
      setReopening(null);
      reload();
    } catch (err) {
      showToast({
        type: "error",
        title: "Could not reopen the task",
        description: err instanceof Error ? err.message : "Unknown error.",
      });
    } finally {
      setBusy(false);
    }
  };

  /**
   * Write one subtask's state, optimistically.
   *
   * Optimistic because the board COLUMN is derived from these — ticking the
   * first box moves the card to In progress — and a card that jumps a beat after
   * the click reads as a bug rather than as a consequence.
   */
  const writeItem = async (
    item: ChecklistItem,
    patch: { is_done: boolean; amount_paisa?: number | null },
  ) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === item.task_id
          ? {
              ...t,
              task_checklist_items: (t.task_checklist_items ?? []).map((i) =>
                i.id === item.id ? { ...i, ...patch } : i,
              ),
            }
          : t,
      ),
    );
    await supabase.from("task_checklist_items").update(patch).eq("id", item.id);
  };

  /*
   * Ticking an item on a PAID task asks what it cost first.
   *
   * The alternative is adding three receipts up on a phone at the counter, which
   * is exactly the arithmetic the module exists to remove. Untickng never asks —
   * that is a correction, and the price is kept so re-ticking remembers it.
   */
  const toggleItem = (item: ChecklistItem) => {
    const task = tasks.find((t) => t.id === item.task_id);
    if (!item.is_done && task?.is_paid) {
      setPricing({ item, task });
      return;
    }
    void writeItem(item, { is_done: !item.is_done });
  };

  const handlePriced = async (amountPaisa: number | null) => {
    if (!pricing) return;
    setBusy(true);
    try {
      await writeItem(pricing.item, {
        is_done: true,
        // A skipped price CLEARS any old one. Ticking without a figure means you
        // are not counting this item, not that last month's still applies.
        amount_paisa: amountPaisa,
      });
      setPricing(null);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (alsoEntry: boolean) => {
    if (!deleting) return;
    try {
      await deleteTask(supabase, deleting, alsoEntry);
      showToast({
        type: "success",
        title: "Task deleted",
        description: alsoEntry
          ? "The entry it created was removed too."
          : deleting.settled_transaction_id
            ? "The entry it created was kept in your ledger."
            : undefined,
      });
      setDeleting(null);
      reload();
    } catch (err) {
      showToast({
        type: "error",
        title: "Could not delete the task",
        description: err instanceof Error ? err.message : "Unknown error.",
      });
    }
  };

  const cardProps = {
    onOpen: (t: TaskWithChecklist) => {
      setEditing(t);
      setFormOpen(true);
    },
    onToggle: requestComplete,
    onToggleItem: toggleItem,
    onDelete: (t: TaskWithChecklist) => setDeleting(t),
    accounts,
    categories,
    settledRefs,
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display truncate text-[19px] font-semibold tracking-[-0.02em] sm:text-[22px]">
            Tasks
          </h1>
          <p className="text-muted mt-0.5 text-[12.5px]">
            Bills, deadlines and chores. A task that moves money writes the entry
            for you when you complete it.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          <div className="border-border bg-surface hidden items-center gap-1 rounded-control border p-1 lg:flex">
            {(
              [
                { v: "board" as const, label: "Board", Icon: Kanban },
                { v: "list" as const, label: "List", Icon: ListChecks },
              ]
            ).map(({ v, label, Icon }) => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                aria-pressed={viewMode === v}
                className={cn(
                  "flex items-center gap-1.5 rounded-control px-2.5 py-1 text-[12px] font-medium transition-colors",
                  viewMode === v
                    ? "bg-navy-900 text-on-navy dark:bg-brass dark:text-navy-900"
                    : "text-muted hover:text-foreground",
                )}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>

          <PageActions
            title="Tasks"
            actions={[
              {
                label: "New task",
              shortLabel: "Task",
                hint: "A one-off, a repeating bill, or something that moves money",
                icon: Plus,
                tone: "primary",
                onClick: () => {
                  setEditing(null);
                  setFormOpen(true);
                },
              },
            ]}
          />
        </div>
      </header>

      {/*
        Overdue is stated, never left to be noticed — but only where nothing
        else is saying it. The board now has a column of its own for these, and
        a banner above it repeating the same two names is the second copy of one
        fact, which is how a screen starts feeling nagging rather than useful.
      */}
      {overdue.length > 0 && viewMode === "list" && (
        <Reveal index={0}>
          <div className="border-loss/30 bg-loss-soft flex items-start gap-2.5 rounded-card border p-3.5">
            <AlertTriangle size={15} className="text-loss mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-loss text-[12.5px] font-semibold">
                {overdue.length} {overdue.length === 1 ? "task is" : "tasks are"} past
                their due date
              </p>
              <p className="text-foreground-2 mt-0.5 text-[11.5px] leading-snug">
                {overdue
                  .slice(0, 3)
                  .map((t) => t.title)
                  .join(" · ")}
                {overdue.length > 3 && ` · +${overdue.length - 3} more`}
              </p>
            </div>
          </div>
        </Reveal>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="shimmer h-64 rounded-panel" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          title="Nothing on your list"
          description="Add a bill, a deadline or a chore. Mark it as one that moves money and completing it will log the payment for you."
          action={
            <button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="bg-navy-900 text-on-navy dark:bg-brass dark:text-navy-900 rounded-control px-4 py-2 text-xs font-semibold"
            >
              <Plus size={14} className="mr-1.5 inline" />
              Add first task
            </button>
          }
        />
      ) : viewMode === "board" ? (
        <Reveal index={1}>
          {/*
            Four columns only when something is overdue. The grid tracks change
            with it rather than leaving a gap — three columns at 4/3 width look
            like a layout bug, not like good news.
          */}
          <div
            className={cn(
              "grid grid-cols-1 items-start gap-4",
              overdue.length > 0
                ? "md:grid-cols-2 xl:grid-cols-4"
                : "md:grid-cols-3",
            )}
          >
            <Column
              title="To do"
              hint="Nothing ticked yet"
              tasks={byStatus.todo}
              tone="neutral"
              {...cardProps}
            />
            <Column
              title="In progress"
              hint="Some subtasks done"
              tasks={byStatus.inProgress}
              tone="brass"
              {...cardProps}
            />
            <Column
              title="Completed"
              hint="Newest first"
              tasks={byStatus.done}
              tone="gain"
              {...cardProps}
            />
            {/* Last, not first. The three status columns are a pipeline that
                reads left to right, and cutting into the front of it made the
                board start on the exception. Overdue is a filter across the
                first two, so it belongs beside them rather than ahead. */}
            {overdue.length > 0 && (
              <Column
                title="Overdue"
                hint="Past their date"
                tasks={overdue}
                tone="loss"
                {...cardProps}
              />
            )}
          </div>
        </Reveal>
      ) : (
        <Reveal index={1}>
          <div className="bg-surface border-border divide-border divide-y overflow-hidden rounded-panel border shadow-sm">
            <div className="bg-surface-subtle text-muted px-4 py-2 text-[10px] font-semibold uppercase tracking-widest">
              {openTasks} open · {byStatus.done.length} completed
            </div>
            {/* The list keeps due-date order across the open columns, so an
                overdue row is already at the top by definition — there is no
                separate group to place here. */}
            {[
              ...[...overdue, ...byStatus.todo, ...byStatus.inProgress].sort(
                compareOpen,
              ),
              ...byStatus.done,
            ].map((t) => (
              <TaskCard key={t.id} task={t} variant="row" {...cardProps} />
            ))}
          </div>
        </Reveal>
      )}

      <TaskFormModal
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        householdId={householdId}
        userId={userId}
        task={editing}
        onSuccess={reload}
      />

      <CompleteTaskModal
        isOpen={completing !== null}
        onClose={() => setCompleting(null)}
        onConfirm={handleComplete}
        task={completing}
        accounts={accounts}
        categories={categories}
        busy={busy}
      />

      {/*
        Reopening is not the harmless half of a toggle.
        For a paid task it DELETES the entry that was written and re-settles the
        account, so the dialog says which balance moves and by how much before
        anything happens.
      */}
      <ConfirmActionModal
        isOpen={reopening !== null}
        onClose={() => setReopening(null)}
        onConfirm={handleUncomplete}
        title="Reopen this task?"
        subtitle={reopening?.title}
        icon={<RotateCcw size={16} />}
        confirmLabel="Reopen task"
        tone={reopening?.settled_transaction_id ? "warn" : "neutral"}
        busy={busy}
        headline={
          reopening?.settled_transaction_id ? (
            <span className="text-foreground-2 text-[12.5px]">
              <span className="tnum font-semibold">
                {formatPKR(Math.abs(Number(reopening.amount_paisa ?? 0)))}
              </span>{" "}
              returns to{" "}
              <span className="font-medium">
                {accounts.find((a) => a.id === reopening.account_id)?.name ??
                  "the account it came from"}
              </span>
              .
            </span>
          ) : undefined
        }
        points={
          reopening?.settled_transaction_id
            ? [
                {
                  icon: <Receipt size={13} />,
                  label: "The entry it wrote is deleted",
                  detail:
                    "The account is re-settled, so the balance goes back to what it was before you completed this.",
                },
                {
                  icon: <RotateCcw size={13} />,
                  label: "The task returns to the board",
                  detail:
                    "Its subtasks and their prices are kept, so you can complete it again without retyping anything.",
                },
                {
                  icon: <AlertTriangle size={13} />,
                  label: "Only do this if the payment did not happen",
                  detail:
                    "If it did and the figure is wrong, edit the task instead — the entry follows it, and no money is invented.",
                },
              ]
            : [
                {
                  icon: <RotateCcw size={13} />,
                  label: "It just goes back onto the board",
                  detail:
                    "This task does not move money, so nothing in your ledger changes.",
                },
              ]
        }
      />

      <SubtaskPriceModal
        isOpen={pricing !== null}
        onClose={() => setPricing(null)}
        onConfirm={handlePriced}
        item={pricing?.item ?? null}
        otherTotalPaisa={
          pricing
            ? (pricing.task.task_checklist_items ?? [])
                .filter((i) => i.id !== pricing.item.id)
                .reduce((sum, i) => sum + Number(i.amount_paisa ?? 0), 0)
            : 0
        }
        busy={busy}
      />

      {/*
        The cascade box defaults to UNCHECKED here, unlike a transfer leg.
        The money genuinely left the account; tidying a to-do list must not
        quietly un-spend it.
      */}
      <ConfirmDeleteModal
        isOpen={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete this task?"
        recordLabel={deleting?.title ?? ""}
        recordMeta={
          deleting
            ? `Due ${deleting.due_date}${deleting.is_paid && deleting.amount_paisa ? ` · ${formatPKR(deleting.amount_paisa)}` : ""}`
            : undefined
        }
        defaultCascade={false}
        cascadeLabel="Also delete the ledger entry it created"
        cascadeHint="The entry stays in your ledger and your balances do not change. Only the task is removed."
        linkedRefs={
          deleting?.settled_transaction_id
            ? [
                {
                  kind: "Ledger entry",
                  label: `${deleting.title} · ${formatPKR(deleting.amount_paisa ?? 0)}`,
                },
              ]
            : []
        }
        confirmLabel="Delete task"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

type CardHandlers = {
  onOpen: (t: TaskWithChecklist) => void;
  onToggle: (t: TaskWithChecklist) => void;
  onToggleItem: (i: ChecklistItem) => void;
  onDelete: (t: TaskWithChecklist) => void;
  accounts: AccountWithInstitution[];
  categories: Tables<"categories">[];
  settledRefs: Map<string, SettledRef>;
};

function Column({
  title,
  hint,
  tasks,
  tone,
  ...handlers
}: {
  title: string;
  hint: string;
  tasks: TaskWithChecklist[];
  tone: "neutral" | "brass" | "gain" | "loss";
} & CardHandlers) {
  return (
    <section
      className={cn(
        "bg-surface-subtle border-border rounded-panel border",
        // Overdue gets a tinted border — it is the one column you want to find
        // without reading the headings.
        tone === "loss" && "border-loss/30 bg-loss-soft/40",
      )}
    >
      <header className="border-border flex items-center gap-2 border-b px-4 py-3">
        <span
          className={cn(
            "size-2 shrink-0 rounded-full",
            tone === "gain" && "bg-gain",
            tone === "brass" && "bg-brass",
            tone === "loss" && "bg-loss",
            tone === "neutral" && "bg-border-strong",
          )}
        />
        <h2 className="font-display text-[13px] font-semibold">{title}</h2>
        <span className="bg-surface text-muted border-border tnum rounded-full border px-1.5 py-0.5 text-[10px] font-semibold">
          {tasks.length}
        </span>
        <span className="text-faint ms-auto text-[10.5px] italic">{hint}</span>
      </header>

      <div className="space-y-2.5 p-3">
        {tasks.length === 0 ? (
          <p className="text-faint py-6 text-center text-[11.5px] italic">
            Nothing here
          </p>
        ) : (
          tasks.map((t) => <TaskCard key={t.id} task={t} variant="card" {...handlers} />)
        )}
      </div>
    </section>
  );
}

/**
 * One task, in three bands separated by hairlines.
 *
 *   title    what it is, plus how urgent and the two controls
 *   tags     everything measurable about it, in one small-text row
 *   detail   the subtasks, or — once it is finished — the entry it wrote
 *
 * The bands exist because the card carries far more than a to-do normally does
 * (a due date, a priority, a category, an amount, a recurrence, a checklist and
 * a ledger link) and a single flowing block of that is unreadable. Rules cost
 * one pixel each and let every value shrink to 10–11px while staying scannable.
 *
 * Priority is a TAG, not a coloured dot. A dot is a legend you have to have
 * memorised; the word is the same width once it is set small, and the flag glyph
 * slides in on hover for anyone who prefers the shape.
 */
function TaskCard({
  task,
  variant,
  onOpen,
  onToggle,
  onToggleItem,
  onDelete,
  accounts,
  categories,
  settledRefs,
}: { task: TaskWithChecklist; variant: "card" | "row" } & CardHandlers) {
  const locale = useLocale();
  const status = deriveStatus(task);
  const isDone = status === "done";
  const { done, total } = checklistProgress(task);
  const ready = isReadyToComplete(task);
  const tone = dueTone(task.due_date, task.priority);
  const account = accounts.find((a) => a.id === task.account_id);
  const category = categories.find((c) => c.id === task.category_id);
  const settled = settledRefs.get(task.id);
  const items = orderedItems(task);
  const runningTotal = subtaskTotalPaisa(task);

  // The figure the card shows: what the subtasks have come to so far, falling
  // back to the estimate. On a completed task the estimate IS the actual.
  const shownPaisa = isDone
    ? task.amount_paisa
    : (runningTotal ?? task.amount_paisa);

  const showSubtasks = total > 0 && !isDone;
  const showFooter = isDone && Boolean(settled);

  return (
    <div
      className={cn(
        "group bg-surface border-border relative transition-all",
        variant === "card" &&
          "rounded-card border p-3 shadow-xs hover:border-border-strong hover:shadow-md",
        variant === "row" && "hover:bg-surface-subtle/60 px-4 py-2.5",
        isDone && "opacity-75 hover:opacity-100",
      )}
    >
      {/* ---- Band 1: what it is ------------------------------------- */}
      <div className="flex items-start gap-2.5">
        {/*
          Completing is an explicit act, never inferred. For a paid task it moves
          real money, so this opens a confirmation rather than toggling.
        */}
        <button
          type="button"
          onClick={() => onToggle(task)}
          aria-label={isDone ? `Reopen ${task.title}` : `Complete ${task.title}`}
          title={isDone ? "Reopen this task" : "Complete this task"}
          className="mt-px shrink-0 transition-colors"
        >
          {isDone ? (
            <CheckCircle2 size={16} className="text-gain" />
          ) : (
            <Circle
              size={16}
              className={cn(
                "text-border-strong hover:text-brass",
                ready && "text-brass",
              )}
            />
          )}
        </button>

        {/*
          The TITLE completes the task; it does not edit it.
          Reading a card and reaching for its name is the gesture of "I have done
          this", not "I want to change what it says" — and on a paid task the
          edit form it used to open is the one place a stray keystroke rewrites a
          ledger entry. Editing and deleting are deliberate acts and now live
          only behind their own icons.
        */}
        <button
          type="button"
          onClick={() => onToggle(task)}
          title={isDone ? "Reopen this task" : "Complete this task"}
          className="min-w-0 flex-1 text-left"
        >
          {/*
            One line with an ellipsis, not two.
            The card is ~290px at four columns and the header already carries a
            tag and two controls; a title allowed to wrap made a two-line card
            in one column and a one-line card in the next, so a board of them
            never lined up. The full text is in the tooltip and in both dialogs.
          */}
          <span
            className={cn(
              "block truncate text-[12.5px] font-medium",
              isDone && "text-muted line-through",
            )}
          >
            {task.title}
          </span>
        </button>

        {/*
          PRIORITY IS PINNED TO THE RIGHT EDGE. The controls fade in OVER the
          tail of the title, immediately to its left.

          Both used to sit in one flex group with the actions outermost, so the
          tag slid sideways every time the pointer crossed the card — the one
          thing you scan a whole column for was the one thing that would not
          hold still. Reserving the space instead just moved the problem: the
          title then truncated early on every card to hold room for two buttons
          that are invisible most of the time.

          So the actions are ABSOLUTE, anchored to the tag's start edge, and
          painted on an opaque background. Nothing in the row reflows on hover —
          the title keeps its full width, the tag never moves, and the buttons
          are simply covering the last few characters for as long as the pointer
          is there. `pointer-events-none` at rest, or an invisible control would
          still be swallowing clicks meant for the title underneath.
        */}
        <div className="relative flex shrink-0 items-center">
          <div
            className={cn(
              "pointer-events-none absolute end-full z-10 flex items-center rounded-control opacity-0 transition-opacity duration-150",
              "group-hover:pointer-events-auto group-hover:opacity-100",
              "group-focus-within:pointer-events-auto group-focus-within:opacity-100",
              variant === "card" ? "bg-surface" : "bg-surface-subtle",
            )}
          >
            <RowActions
              onEdit={() => onOpen(task)}
              onDelete={() => onDelete(task)}
              editLabel="Edit task"
              deleteLabel="Delete task"
              reveal="always"
              className="ps-2"
            />
          </div>
          <PriorityTag priority={task.priority} dimmed={isDone} />
        </div>
      </div>

      {/* ---- Band 2: everything measurable -------------------------- */}
      {/* Flush left, not indented to clear the tick. The indent was there to
          line the tags up under the title, but it left a column of dead space
          down the card and pushed the row toward the right edge, which is the
          one place a wrapping chip has nowhere to go. */}
      <div className="border-border/70 mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 border-t pt-2 text-[10px]">
        <DueChip due={task.due_date} tone={tone} isDone={isDone} />

        {category && (
          <span
            className="inline-flex max-w-40 items-center gap-1 rounded-full px-1.5 py-0.5 font-medium"
            style={{
              background: `color-mix(in oklab, ${toneColor(category.tone)} 12%, transparent)`,
              color: toneColor(category.tone),
            }}
          >
            <CategoryIcon icon={category.icon} size={9} />
            <span dir="auto" className="copy truncate">
              {categoryLabel(category, locale)}
            </span>
          </span>
        )}

        {task.is_paid && Boolean(shownPaisa) && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold",
              task.direction === "income"
                ? "bg-gain-soft text-gain"
                : "bg-surface-subtle text-foreground-2",
            )}
            title={
              runningTotal !== null && !isDone
                ? "Totalled from the subtask prices so far"
                : isDone
                  ? "What was actually paid"
                  : "Your estimate — you confirm the real figure on completion"
            }
          >
            {task.direction === "income" ? (
              <Plus size={9} strokeWidth={3} />
            ) : (
              <Minus size={9} strokeWidth={3} />
            )}
            <span className="tnum">{formatPKR(Number(shownPaisa))}</span>
            {!isDone && runningTotal === null && (
              <span className="opacity-60">est.</span>
            )}
          </span>
        )}

        {/*
          The account gets its own mark, not just a name. "Abdul Rehman" beside
          "Rs 980" reads as a person the money went TO until the glyph says it is
          a place you hold it — and with four or five accounts named after the
          same person, the type icon is the only thing telling them apart.
        */}
        {account && task.is_paid && (
          <span className="text-faint inline-flex max-w-32 items-center gap-1">
            <AccountGlyph type={account.type} />
            <span className="truncate">{account.name}</span>
          </span>
        )}

        {task.repeat_rule !== "none" && (
          <span className="text-faint inline-flex items-center gap-1">
            <Repeat size={9} />
            {REPEAT_LABEL[task.repeat_rule].replace("Every ", "")}
          </span>
        )}

        {total > 0 && (
          <span className="text-faint tnum inline-flex items-center gap-1">
            <CheckSquare size={9} />
            {done}/{total}
          </span>
        )}

        {ready && (
          <span className="bg-brass-soft text-brass-strong inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold">
            <Sparkles size={9} />
            Ready
          </span>
        )}
      </div>

      {/* ---- Band 3a: the checklist --------------------------------- */}
      {/*
        Tickable in place. The column a card sits in follows these, so making
        someone open a drawer to move a card would be a wasted step — and on a
        paid task each tick is where the price is captured.
      */}
      {showSubtasks && (
        <ul className="border-border/70 mt-2 space-y-px border-t pt-1.5">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onToggleItem(item)}
                className="hover:bg-surface-subtle flex w-full items-center gap-2 rounded-control px-1.5 py-1 text-left transition-colors"
              >
                <span
                  className={cn(
                    "flex size-3.5 shrink-0 items-center justify-center rounded border transition-colors",
                    item.is_done
                      ? "bg-gain border-gain text-white"
                      : "border-border-strong",
                  )}
                >
                  {item.is_done && <CheckSquare size={9} strokeWidth={3} />}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-[11.5px]",
                    item.is_done ? "text-faint line-through" : "text-foreground-2",
                  )}
                >
                  {item.title}
                </span>
                {item.amount_paisa !== null && item.amount_paisa !== undefined && (
                  <span className="tnum text-muted shrink-0 text-[10.5px]">
                    {formatPKR(Number(item.amount_paisa))}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* ---- Band 3b: the money it moved ---------------------------- */}
      {/*
        A completed paid task claims money left an account. This is the receipt:
        the actual entry, its date and its amount, one click away. The link
        carries the month because Entries opens on one — without it a task
        completed in June lands on an August page that does not contain it.
      */}
      {showFooter && settled && (
        <div className="border-border/70 mt-2 border-t pt-2">
          <a
            href={`/entries?month=${settled.date.slice(0, 7)}&entry=${settled.id}`}
            className="bg-surface-subtle hover:bg-brass-soft hover:text-brass-strong text-foreground-2 group/ref inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-1 text-[10.5px] font-medium transition-colors"
          >
            <Receipt size={10} className="shrink-0" />
            <span className="tnum">
              {formatPKR(Math.abs(Number(settled.amount_paisa)))}
            </span>
            <span className="ltr text-faint group-hover/ref:text-brass-strong">
              {settled.date}
            </span>
            <ArrowUpRight size={10} className="shrink-0 opacity-60" />
          </a>
        </div>
      )}
    </div>
  );
}

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  high: "bg-loss-soft text-loss",
  medium: "bg-brass-soft text-brass-strong",
  low: "bg-surface-subtle text-muted",
};

/**
 * Priority as a word.
 *
 * The glyph is collapsed to zero width and expands on hover, so the resting card
 * shows only the label — three of these stacked in a column with permanent icons
 * turned the right edge into a stripe of noise.
 */
function PriorityTag({
  priority,
  dimmed,
}: {
  priority: TaskPriority;
  dimmed: boolean;
}) {
  return (
    <span
      title={`${priority} priority`}
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold capitalize",
        PRIORITY_STYLE[priority],
        dimmed && "opacity-60",
      )}
    >
      <span className="w-0 overflow-hidden transition-all duration-150 group-hover:me-1 group-hover:w-2.5">
        {priority === "high" ? (
          <ChevronUp size={10} strokeWidth={2.5} />
        ) : (
          <Flag size={10} strokeWidth={2.5} />
        )}
      </span>
      {priority}
    </span>
  );
}

function DueChip({
  due,
  tone,
  isDone,
}: {
  due: string;
  tone: DueTone;
  isDone: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium",
        isDone && "text-faint",
        !isDone && tone === "overdue" && "bg-loss-soft text-loss",
        !isDone && tone === "today" && "bg-brass-soft text-brass-strong",
        !isDone && tone === "soon" && "text-brass-strong",
        !isDone && tone === "later" && "text-faint",
      )}
    >
      {/* A DATE icon, not a clock. Nothing on a task carries a time of day —
          the field is a due DATE, and a clock face promised a precision the
          model does not have. */}
      <CalendarDays size={9} />
      <span className="ltr">{isDone ? due : dueLabel(due)}</span>
    </span>
  );
}

/** The account's type, as one small glyph. Mirrors `ACCOUNT_TYPE_BY_VALUE`. */
function AccountGlyph({ type }: { type: string }) {
  const Icon =
    type === "cash"
      ? Banknote
      : type === "wallet"
        ? Smartphone
        : type === "savings"
          ? Coins
          : Landmark;
  return <Icon size={9} className="shrink-0" strokeWidth={1.9} />;
}

/** Kept so a future status filter has a name to import. */
export type { TaskStatus };
