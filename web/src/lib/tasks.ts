import { todayISO } from "@/lib/ledger";

import type {
  TaskPriority,
  TaskRepeatRule,
  TaskStatus,
  Tables,
} from "@/lib/supabase/types";

export type Task = Tables<"tasks">;
export type ChecklistItem = Tables<"task_checklist_items">;
export type TaskWithChecklist = Task & {
  task_checklist_items?: ChecklistItem[] | null;
};

/* ------------------------------------------------------------------------- *
 * Status
 * ------------------------------------------------------------------------- */

/**
 * WHICH COLUMN A TASK BELONGS IN — derived, never typed in.
 *
 * The three columns used to be a free choice, which meant they described where
 * someone last dragged a card rather than anything about the work. They are now
 * a function of the subtasks:
 *
 *   To do        no subtask is ticked (or there are none)
 *   In progress  at least one subtask ticked, but not all
 *   Completed    the task itself was completed
 *
 * "Completed" stays an explicit act, never inferred from the last subtask: for a
 * PAID task that act writes money, and money must never move because a checkbox
 * happened to be the final one. Ticking the last subtask moves the card to the
 * top of In progress with "ready to complete" instead.
 */
export function deriveStatus(task: TaskWithChecklist): TaskStatus {
  if (task.status === "done" || task.is_done) return "done";
  const items = task.task_checklist_items ?? [];
  if (items.length === 0) return "todo";
  return items.some((i) => i.is_done) ? "in_progress" : "todo";
}

/** Every subtask ticked, but the task itself not completed yet. */
export function isReadyToComplete(task: TaskWithChecklist): boolean {
  const items = task.task_checklist_items ?? [];
  if (items.length === 0) return false;
  if (task.status === "done" || task.is_done) return false;
  return items.every((i) => i.is_done);
}

export function checklistProgress(task: TaskWithChecklist): {
  done: number;
  total: number;
} {
  const items = task.task_checklist_items ?? [];
  return { done: items.filter((i) => i.is_done).length, total: items.length };
}

/** Subtasks in display order. Sorting lives here so no screen invents its own. */
export function orderedItems(task: TaskWithChecklist): ChecklistItem[] {
  return (task.task_checklist_items ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * What the subtasks add up to — the figure the completion dialog opens on.
 *
 * A grocery run is one payment made of prices nobody knows in advance. Each one
 * is entered as its item is ticked, so by the time the task itself is completed
 * the total is already there instead of being added up at the counter.
 *
 * Returns null when NOTHING carries a price, which is the difference between
 * "these came to zero" and "no one priced anything" — the first should seed the
 * amount field, the second must leave the saved estimate alone.
 */
export function subtaskTotalPaisa(task: TaskWithChecklist): number | null {
  const priced = (task.task_checklist_items ?? []).filter(
    (i) => i.amount_paisa !== null && i.amount_paisa !== undefined,
  );
  if (priced.length === 0) return null;
  return priced.reduce((sum, i) => sum + Number(i.amount_paisa ?? 0), 0);
}

/* ------------------------------------------------------------------------- *
 * Due dates and reminders
 * ------------------------------------------------------------------------- */

/**
 * How many days before the due date a reminder fires. Owner rule:
 * low 1 day, medium 2, high 3.
 *
 * Mirrors task_notify_lead() in the database. Kept in both places on purpose —
 * the DB copy is what a scheduled job will read, this one renders the chip.
 */
export const NOTIFY_LEAD: Record<TaskPriority, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

/**
 * The MINIMUM lead for generating the next occurrence — deliberately one day
 * longer than the reminder lead, so the task exists before its own first
 * reminder is due to fire.
 */
export const MIN_GENERATION_LEAD: Record<TaskPriority, number> = {
  low: 3,
  medium: 4,
  high: 5,
};

export const PERIOD_DAYS: Record<TaskRepeatRule, number | null> = {
  none: null,
  daily: 1,
  weekly: 7,
  monthly: 30,
  yearly: 365,
};

/**
 * The generation lead actually used, after the cap. Mirrors task_lead_days().
 *
 * The owner's rule is "at least 3/4/5 days by priority, and you may raise it".
 * That is right for monthly and yearly and impossible for short periods: a DAILY
 * task with a 3-day lead would spawn tomorrow's copy and the next day's while
 * today's is still open — three live rows for one habit.
 *
 * Capping at period − 1 guarantees at most ONE live occurrence of a series.
 * Daily lands on 0 (created on the day), weekly tops out at 6, monthly and
 * yearly are untouched — the owner's numbers survive wherever they meant
 * something.
 */
export function generationLeadDays(
  rule: TaskRepeatRule,
  priority: TaskPriority,
  requested: number | null,
): number | null {
  const period = PERIOD_DAYS[rule];
  if (period === null) return null;
  const floor = MIN_GENERATION_LEAD[priority];
  return Math.min(Math.max(requested ?? floor, floor), period - 1);
}

/** Whole days from today to `due`. Negative = overdue. */
export function daysUntil(due: string, from: string = todayISO()): number {
  const [dy, dm, dd] = due.split("-").map(Number);
  const [fy, fm, fd] = from.split("-").map(Number);
  return Math.round(
    (new Date(dy, dm - 1, dd).getTime() - new Date(fy, fm - 1, fd).getTime()) /
      86_400_000,
  );
}

export type DueTone = "overdue" | "today" | "soon" | "later";

/**
 * How a due date should read.
 *
 * `soon` is priority-aware rather than a flat "within 3 days": it turns on
 * exactly when this task's reminder would fire, so the colour on the card and
 * the notification in your pocket always agree about what is urgent.
 */
export function dueTone(due: string, priority: TaskPriority): DueTone {
  const days = daysUntil(due);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  return days <= NOTIFY_LEAD[priority] ? "soon" : "later";
}

export function dueLabel(due: string): string {
  const days = daysUntil(due);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days < 0) return `${-days} days overdue`;
  if (days <= 7) return `In ${days} days`;
  const [y, m, d] = due.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

/** The next due date for a repeating task. Mirrors task_next_due(). */
export function nextDueDate(due: string, rule: TaskRepeatRule): string | null {
  if (rule === "none") return null;
  const [y, m, d] = due.split("-").map(Number);
  const base = new Date(y, m - 1, d);

  if (rule === "daily") base.setDate(base.getDate() + 1);
  else if (rule === "weekly") base.setDate(base.getDate() + 7);
  else if (rule === "yearly") base.setFullYear(base.getFullYear() + 1);
  else {
    /*
     * Month arithmetic clamps to the end of the target month. Without this,
     * "the 31st, monthly" rolls into 1 March — a rent reminder that skips
     * February entirely and then lands on the wrong day forever after.
     */
    const targetMonth = base.getMonth() + 1;
    const lastDay = new Date(base.getFullYear(), targetMonth + 1, 0).getDate();
    base.setDate(Math.min(d, lastDay));
    base.setMonth(targetMonth);
  }

  const mm = `${base.getMonth() + 1}`.padStart(2, "0");
  const dd = `${base.getDate()}`.padStart(2, "0");
  return `${base.getFullYear()}-${mm}-${dd}`;
}

/**
 * Is it time to create the next occurrence of this series?
 *
 * Deliberately NOT tied to completion. A bill that has not been paid still owes
 * its money, and next month's bill arrives whether or not you cleared this one —
 * so generation is driven by the calendar and the overdue task stays put, flagged.
 */
export function shouldSpawnNext(task: Task, from: string = todayISO()): boolean {
  if (task.repeat_rule === "none") return false;
  const next = nextDueDate(task.due_date, task.repeat_rule);
  if (!next) return false;
  const lead = generationLeadDays(
    task.repeat_rule,
    task.priority,
    task.repeat_lead_days,
  );
  if (lead === null) return false;
  return daysUntil(next, from) <= lead;
}

/* ------------------------------------------------------------------------- *
 * Ordering
 * ------------------------------------------------------------------------- */

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

/**
 * Open tasks: soonest first, and priority only breaks ties on the same day.
 *
 * Sorting by priority first is the classic mistake — it buries a low-priority
 * bill that is due today under three high-priority ones due next week, and the
 * one that actually costs you a late fee is the one off screen.
 */
export function compareOpen(a: Task, b: Task): number {
  if (a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
}

/** Completed tasks: most recently finished first — the opposite direction. */
export function compareDone(a: Task, b: Task): number {
  const at = a.completed_at ?? a.updated_at;
  const bt = b.completed_at ?? b.updated_at;
  return at < bt ? 1 : at > bt ? -1 : 0;
}

export const REPEAT_LABEL: Record<TaskRepeatRule, string> = {
  none: "Does not repeat",
  daily: "Every day",
  weekly: "Every week",
  monthly: "Every month",
  yearly: "Every year",
};
