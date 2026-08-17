"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  Circle,
  Clock,
  Kanban,
  ListChecks,
  Plus,
  Repeat,
  Sparkles,
  Wallet2,
} from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Reveal } from "@/components/reveal";
import { EmptyState } from "@/components/empty-state";
import { PageActions } from "@/components/page-actions";
import { TaskFormModal } from "@/components/task-form-modal";
import { CompleteTaskModal } from "@/components/complete-task-modal";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
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
} from "@/lib/tasks";
import { formatPKR } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { AccountWithInstitution } from "@/components/account-options";
import type { SettleInput } from "@/lib/task-actions";
import type { DueTone, TaskWithChecklist } from "@/lib/tasks";
import type { TaskPriority, TaskStatus, Tables } from "@/lib/supabase/types";

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
  const [deleting, setDeleting] = React.useState<TaskWithChecklist | null>(null);
  const [busy, setBusy] = React.useState(false);

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

  const byStatus = React.useMemo(() => {
    const todo: TaskWithChecklist[] = [];
    const inProgress: TaskWithChecklist[] = [];
    const done: TaskWithChecklist[] = [];
    for (const t of tasks) {
      const s = deriveStatus(t);
      if (s === "done") done.push(t);
      else if (s === "in_progress") inProgress.push(t);
      else todo.push(t);
    }
    // Open work: soonest due first. Completed: most recently finished first.
    todo.sort(compareOpen);
    inProgress.sort(compareOpen);
    done.sort(compareDone);
    return { todo, inProgress, done };
  }, [tasks]);

  const openTasks = byStatus.todo.length + byStatus.inProgress.length;
  const overdue = [...byStatus.todo, ...byStatus.inProgress].filter(
    (t) => dueTone(t.due_date, t.priority) === "overdue",
  );

  /** Ticking the circle never completes silently — it always confirms first. */
  const requestComplete = (task: TaskWithChecklist) => {
    if (deriveStatus(task) === "done") {
      void handleUncomplete(task);
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

  const handleUncomplete = async (task: TaskWithChecklist) => {
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
      reload();
    } catch (err) {
      showToast({
        type: "error",
        title: "Could not reopen the task",
        description: err instanceof Error ? err.message : "Unknown error.",
      });
    }
  };

  const toggleItem = async (item: Tables<"task_checklist_items">) => {
    // Optimistic: the column a card sits in is derived from these, so the card
    // must move the instant the box is ticked.
    setTasks((prev) =>
      prev.map((t) =>
        t.id === item.task_id
          ? {
              ...t,
              task_checklist_items: (t.task_checklist_items ?? []).map((i) =>
                i.id === item.id ? { ...i, is_done: !i.is_done } : i,
              ),
            }
          : t,
      ),
    );
    await supabase
      .from("task_checklist_items")
      .update({ is_done: !item.is_done })
      .eq("id", item.id);
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

      {/* Overdue is stated, never left to be noticed. */}
      {overdue.length > 0 && (
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
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3">
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
          </div>
        </Reveal>
      ) : (
        <Reveal index={1}>
          <div className="bg-surface border-border divide-border divide-y overflow-hidden rounded-panel border shadow-sm">
            <div className="bg-surface-subtle text-muted px-4 py-2 text-[10px] font-semibold uppercase tracking-widest">
              {openTasks} open · {byStatus.done.length} completed
            </div>
            {[...byStatus.todo, ...byStatus.inProgress, ...byStatus.done].map((t) => (
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
  onToggleItem: (i: Tables<"task_checklist_items">) => void;
  onDelete: (t: TaskWithChecklist) => void;
  accounts: AccountWithInstitution[];
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
  tone: "neutral" | "brass" | "gain";
} & CardHandlers) {
  return (
    <section className="bg-surface-subtle border-border rounded-panel border">
      <header className="border-border flex items-center gap-2 border-b px-4 py-3">
        <span
          className={cn(
            "size-2 shrink-0 rounded-full",
            tone === "gain" && "bg-gain",
            tone === "brass" && "bg-brass",
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

function TaskCard({
  task,
  variant,
  onOpen,
  onToggle,
  onToggleItem,
  onDelete,
  accounts,
}: { task: TaskWithChecklist; variant: "card" | "row" } & CardHandlers) {
  const status = deriveStatus(task);
  const isDone = status === "done";
  const { done, total } = checklistProgress(task);
  const ready = isReadyToComplete(task);
  const tone = dueTone(task.due_date, task.priority);
  const account = accounts.find((a) => a.id === task.account_id);

  return (
    <div
      className={cn(
        "group bg-surface border-border relative transition-colors",
        variant === "card" && "rounded-card border p-3.5 shadow-xs hover:shadow-md",
        variant === "row" && "hover:bg-surface-subtle/60 px-4 py-3",
        isDone && "opacity-70",
      )}
    >
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
          className="mt-0.5 shrink-0 transition-colors"
        >
          {isDone ? (
            <CheckCircle2 size={17} className="text-gain" />
          ) : (
            <Circle
              size={17}
              className={cn(
                "text-border-strong hover:text-brass",
                ready && "text-brass",
              )}
            />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={() => onOpen(task)}
              className="min-w-0 flex-1 text-left"
            >
              <span
                className={cn(
                  "block truncate text-[12.5px] font-medium",
                  isDone && "text-muted line-through",
                )}
              >
                {task.title}
              </span>
            </button>

            <div className="flex shrink-0 items-center gap-1.5">
              <PriorityDot priority={task.priority} />
              <RowActions
                onEdit={() => onOpen(task)}
                onDelete={() => onDelete(task)}
                editLabel="Edit task"
                deleteLabel="Delete task"
                reveal="hover"
              />
            </div>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px]">
            <DueChip due={task.due_date} tone={tone} isDone={isDone} />

            {task.is_paid && task.amount_paisa && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium",
                  task.direction === "income"
                    ? "bg-gain-soft text-gain"
                    : "bg-surface-subtle text-foreground-2",
                )}
              >
                <Wallet2 size={10} />
                <span className="tnum">{formatPKR(task.amount_paisa)}</span>
                {account && <span className="text-faint">· {account.name}</span>}
              </span>
            )}

            {task.repeat_rule !== "none" && (
              <span className="text-faint inline-flex items-center gap-1">
                <Repeat size={10} />
                {REPEAT_LABEL[task.repeat_rule].replace("Every ", "")}
              </span>
            )}

            {total > 0 && (
              <span className="text-faint tnum inline-flex items-center gap-1">
                <CheckSquare size={10} />
                {done}/{total}
              </span>
            )}

            {ready && (
              <span className="bg-brass-soft text-brass-strong inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold">
                <Sparkles size={10} />
                Ready to complete
              </span>
            )}
          </div>

          {/* Subtasks are tickable in place — the column follows them, so making
              you open a drawer to move a card would be a wasted step. */}
          {variant === "card" && total > 0 && !isDone && (
            <ul className="mt-2.5 space-y-1">
              {(task.task_checklist_items ?? [])
                .slice()
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((item) => (
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
                          "min-w-0 truncate text-[11.5px]",
                          item.is_done ? "text-faint line-through" : "text-foreground-2",
                        )}
                      >
                        {item.title}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function PriorityDot({ priority }: { priority: TaskPriority }) {
  return (
    <span
      title={`${priority} priority`}
      aria-label={`${priority} priority`}
      className={cn(
        "block size-2 shrink-0 rounded-full",
        priority === "high" && "bg-loss",
        priority === "medium" && "bg-brass",
        priority === "low" && "bg-border-strong",
      )}
    />
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
      <Clock size={10} />
      <span className="ltr">{isDone ? due : dueLabel(due)}</span>
    </span>
  );
}

/** Kept so a future status filter has a name to import. */
export type { TaskStatus };
