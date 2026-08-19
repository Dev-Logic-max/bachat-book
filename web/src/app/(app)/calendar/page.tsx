"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Cake,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Plus,
  Repeat,
} from "lucide-react";
import { useSession } from "@/components/session-provider";
import { PageActions } from "@/components/page-actions";
import { Reveal } from "@/components/reveal";
import { EmptyState } from "@/components/empty-state";
import { AddEventModal } from "@/components/add-event-modal";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { birthdaysBetween, turningAge, type Contact } from "@/lib/contacts";
import { formatHijri, formatPKR } from "@/lib/format";
import { todayISO } from "@/lib/ledger";
import { cn } from "@/lib/utils";
import type { Tables } from "@/lib/supabase/types";

type CalendarView = "month" | "agenda";
type CalendarEvent = Tables<"calendar_events">;
type CalendarTask = Tables<"tasks">;

/**
 * One thing on one day, in the form the grid draws it.
 *
 * Tasks and events are different records with different lifecycles, but a
 * calendar cell only needs four facts about either: what colour it is, what it
 * says, whether it is finished, and where it came from. Flattening them here is
 * what lets the cell render one list instead of two interleaved ones.
 */
type DayItem = {
  id: string;
  kind: "task" | "event" | "birthday";
  title: string;
  color: string;
  done: boolean;
  /** Past its due date and still open — tasks only. */
  overdue: boolean;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Monday-first, matching the day picker and most Pakistani wall calendars. */
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const TYPE_COLOR: Record<string, string> = {
  general: "#C6A15B",
  bill: "#d92b1f",
  salary: "#009639",
  committee: "#00539b",
  tax: "#1b4d2e",
  holiday: "#00693e",
  birthday: "#e05a1c",
};

/* Tasks are ONE family, coloured by state rather than by kind. Their identity on
   this grid is "something you have to do", and splitting them by priority would
   compete with the event palette for the same seven cells. */
const TASK_COLOR = {
  open: "#4a5b73",
  overdue: "#d92b1f",
  done: "#009639",
} as const;

const LEGEND: Array<{ label: string; color: string; task?: boolean }> = [
  { label: "Task", color: TASK_COLOR.open, task: true },
  { label: "Bill", color: TYPE_COLOR.bill },
  { label: "Salary", color: TYPE_COLOR.salary },
  { label: "Committee", color: TYPE_COLOR.committee },
  { label: "Tax / FBR", color: TYPE_COLOR.tax },
  { label: "Other", color: TYPE_COLOR.general },
];

function iso(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** `getDay()` is Sunday-first; the grid and headers are Monday-first. */
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export default function CalendarPage() {
  const session = useSession();
  const supabase = createClient();

  const householdId = session.household?.id || "";
  const userId = session.user.id;

  /*
   * Opens on the CURRENT month. It was `new Date(2026, 7, 1)` — hardcoded to
   * August 2026 — so the calendar opened on a fixed month forever and "Today"
   * was the only way to reach the real one.
   */
  const [cursor, setCursor] = React.useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [view, setView] = React.useState<CalendarView>("month");
  const [events, setEvents] = React.useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = React.useState<CalendarTask[]>([]);
  const [contacts, setContacts] = React.useState<Contact[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [addModalOpen, setAddModalOpen] = React.useState(false);
  const [selectedDateStr, setSelectedDateStr] = React.useState("");
  const [openDayKey, setOpenDayKey] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    if (!householdId) return;

    async function load() {
      /*
       * Tasks are READ here and never written.
       *
       * A calendar shows you when things fall; it is not a second place to
       * complete them. Completing a paid task writes a real ledger entry, and a
       * grid of 42 small boxes is the worst possible surface for that — a
       * mis-tap on the wrong day would move a bank balance. Everything on this
       * screen links back to Tasks instead.
       */
      const [evRes, taskRes, contactRes] = await Promise.all([
        supabase
          .from("calendar_events")
          .select("*")
          .eq("household_id", householdId)
          .order("start_at", { ascending: true }),
        supabase
          .from("tasks")
          .select("*")
          .eq("household_id", householdId)
          .order("due_date", { ascending: true }),
        /*
         * Birthdays are DERIVED, never stored as calendar rows.
         *
         * A birthday recurs every year forever, so writing it into
         * `calendar_events` would mean generating rows into infinity and
         * regenerating them whenever a date is corrected. The contact row is
         * the single source; the grid computes the occurrence for whichever
         * year it is showing.
         */
        supabase
          .from("contacts")
          .select("*")
          .eq("household_id", householdId)
          .not("birthday", "is", null),
      ]);

      if (!active) return;
      if (evRes.data) setEvents(evRes.data);
      if (taskRes.data) setTasks(taskRes.data);
      if (contactRes.data) setContacts(contactRes.data);
      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [householdId, refreshKey, supabase]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const today = todayISO();

  const prevMonth = () => setCursor(new Date(year, month - 1, 1));
  const nextMonth = () => setCursor(new Date(year, month + 1, 1));
  const goToday = () => {
    const now = new Date();
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  /*
   * A FULL six-week grid, including the tail of the previous month and the head
   * of the next.
   *
   * The old version emitted leading blanks and then stopped at the last day, so
   * the final row was ragged and the panel changed height every month. Real
   * calendars are a fixed 6x7 block; the outside days are shown muted rather
   * than left as holes.
   */
  const days = React.useMemo(() => {
    const first = new Date(year, month, 1);
    const start = new Date(year, month, 1 - mondayIndex(first));
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      return { date: d, key: iso(d), inMonth: d.getMonth() === month };
    });
  }, [year, month]);

  /*
   * Both kinds bucketed by local day, once, rather than filtered per cell —
   * 42 cells × two `.filter()` passes each is 84 sweeps of the whole dataset on
   * every keystroke of the month arrows.
   *
   * TASKS FIRST inside a day. What you have to do outranks what merely happens,
   * and with only two rows visible before the overflow counter, the ordering
   * decides which one you see at a glance.
   */
  const itemsByDay = React.useMemo(() => {
    const map = new Map<string, DayItem[]>();
    const push = (key: string, item: DayItem) => {
      const list = map.get(key);
      if (list) list.push(item);
      else map.set(key, [item]);
    };

    for (const t of tasks) {
      const done = t.is_done || t.status === "done";
      const overdue = !done && t.due_date < today;
      push(t.due_date, {
        id: t.id,
        kind: "task",
        title: t.title,
        color: done
          ? TASK_COLOR.done
          : overdue
            ? TASK_COLOR.overdue
            : TASK_COLOR.open,
        done,
        overdue,
      });
    }

    for (const e of events) {
      push(iso(new Date(e.start_at)), {
        id: e.id,
        kind: "event",
        title: e.title,
        color:
          e.color_code || TYPE_COLOR[e.event_type] || TYPE_COLOR.general,
        done: false,
        overdue: false,
      });
    }

    // The grid draws six weeks, so the window is the whole 42-day block rather
    // than the calendar month — a birthday in the visible tail of the previous
    // month has to appear too.
    for (const { contact, date } of birthdaysBetween(
      contacts,
      days[0].key,
      days[days.length - 1].key,
    )) {
      const age = turningAge(contact.birthday!);
      push(date, {
        id: `birthday-${contact.id}-${date}`,
        kind: "birthday",
        title: age !== null ? `${contact.name} turns ${age}` : `${contact.name}'s birthday`,
        color: TYPE_COLOR.birthday,
        done: false,
        overdue: false,
      });
    }

    // Tasks first, then events, then birthdays. Only two rows show before the
    // overflow counter, and what you have to DO outranks what merely happens.
    const rank = (kind: DayItem["kind"]) =>
      kind === "task" ? 0 : kind === "event" ? 1 : 2;
    for (const list of map.values()) {
      list.sort((a, b) => rank(a.kind) - rank(b.kind));
    }
    return map;
  }, [events, tasks, contacts, days, today]);

  const monthItemCount = days.reduce(
    (n, d) => (d.inMonth ? n + (itemsByDay.get(d.key)?.length ?? 0) : n),
    0,
  );

  const addEventOn = (dateStr: string) => {
    setSelectedDateStr(dateStr);
    setAddModalOpen(true);
  };

  /*
   * The agenda carries BOTH kinds too.
   *
   * A list that showed only events while the grid beside it showed tasks was
   * two answers to one question — and the agenda is the view you switch to on a
   * phone, which is exactly where the grid's two-row limit bites hardest.
   */
  const agenda = React.useMemo(() => {
    const rows: Array<{ date: string; item: DayItem; time: string | null }> = [];

    for (const t of tasks) {
      const done = t.is_done || t.status === "done";
      const overdue = !done && t.due_date < today;
      rows.push({
        date: t.due_date,
        time: null,
        item: {
          id: t.id,
          kind: "task",
          title: t.title,
          color: done
            ? TASK_COLOR.done
            : overdue
              ? TASK_COLOR.overdue
              : TASK_COLOR.open,
          done,
          overdue,
        },
      });
    }

    for (const e of events) {
      const at = new Date(e.start_at);
      rows.push({
        date: iso(at),
        time: e.is_all_day
          ? null
          : at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        item: {
          id: e.id,
          kind: "event",
          title: e.title,
          color: e.color_code || TYPE_COLOR[e.event_type] || TYPE_COLOR.general,
          done: false,
          overdue: false,
        },
      });
    }

    /*
     * The agenda spans a YEAR either side, not the six visible weeks.
     *
     * It is a list rather than a grid, so it is not bounded by the month on
     * screen — and it is the view a phone opens on. Bounding it to the grid's
     * window would have made a birthday appear in the month view and vanish
     * from the agenda beside it, which is two answers to one question.
     */
    const agendaFrom = iso(new Date(year - 1, month, 1));
    const agendaTo = iso(new Date(year + 1, month + 1, 0));

    for (const { contact, date } of birthdaysBetween(contacts, agendaFrom, agendaTo)) {
      const age = turningAge(contact.birthday!);
      rows.push({
        date,
        time: null,
        item: {
          id: `birthday-${contact.id}-${date}`,
          kind: "birthday",
          title: age !== null ? `${contact.name} turns ${age}` : `${contact.name}'s birthday`,
          color: TYPE_COLOR.birthday,
          done: false,
          overdue: false,
        },
      });
    }

    rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return rows;
  }, [events, tasks, contacts, year, month, today]);

  // Upcoming first — an agenda that opens on last year's entries is a log, not a plan.
  const upcoming = agenda.filter((r) => r.date >= today);
  const past = agenda.filter((r) => r.date < today).reverse();

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-[19px] font-semibold tracking-[-0.02em] sm:text-[22px]">
              {MONTHS[month]} {year}
            </h1>
            <span className="bg-brass-soft text-brass-strong rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
              {formatHijri(cursor)}
            </span>
          </div>
          <p className="text-muted mt-0.5 text-[12.5px]">
            {monthItemCount === 0
              ? "Nothing this month — pick a day to add something."
              : `${monthItemCount} ${monthItemCount === 1 ? "thing" : "things"} this month. Tasks are shown here; you complete them in Tasks.`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2.5 self-start">
          {/* The view switch stays a real control at every width — it is two
              words, and hiding it behind a menu would cost a tap on the thing
              you toggle most on this screen. */}
          <div className="bg-surface border-border flex items-center gap-1 rounded-control border p-1">
            {(["month", "agenda"] as CalendarView[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={cn(
                  "rounded-control px-2.5 py-1 text-[12px] font-medium capitalize transition-colors",
                  view === v
                    ? "bg-navy-900 text-on-navy dark:bg-brass dark:text-navy-900"
                    : "text-muted hover:text-foreground",
                )}
              >
                {v}
              </button>
            ))}
          </div>

          <PageActions
            title="Calendar"
            actions={[
              {
                label: "Add event",
              shortLabel: "Event",
                hint: "A bill date, a birthday, or anything with a day attached",
                icon: Plus,
                tone: "primary",
                onClick: () => addEventOn(today),
              },
            ]}
          />
        </div>
      </header>

      <Reveal index={0}>
        <div className="bg-surface border-border flex flex-col gap-3 rounded-panel border p-3 shadow-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1">
            <button
              onClick={prevMonth}
              aria-label="Previous month"
              className="text-muted hover:text-foreground hover:bg-surface-subtle flex size-8 items-center justify-center rounded-full transition-colors"
            >
              <ChevronLeft size={17} />
            </button>
            <button
              onClick={goToday}
              className="text-foreground-2 hover:bg-surface-subtle rounded-control px-3 py-1.5 text-xs font-semibold transition-colors"
            >
              Today
            </button>
            <button
              onClick={nextMonth}
              aria-label="Next month"
              className="text-muted hover:text-foreground hover:bg-surface-subtle flex size-8 items-center justify-center rounded-full transition-colors"
            >
              <ChevronRight size={17} />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
            {LEGEND.map((l) => (
              <span key={l.label} className="text-muted flex items-center gap-1.5 text-[11px]">
                {/* The task swatch is a bar with a tick, matching how a task
                    actually draws in the grid — a dot identical to the event
                    dots would say the two are the same kind of thing. */}
                {l.task ? (
                  <CheckCircle2
                    size={11}
                    className="shrink-0"
                    style={{ color: l.color }}
                  />
                ) : (
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: l.color }}
                  />
                )}
                {l.label}
              </span>
            ))}
          </div>
        </div>
      </Reveal>

      {view === "month" ? (
        <Reveal index={1}>
          <div className="bg-surface border-border overflow-hidden rounded-panel border shadow-xs">
            <div className="border-border bg-surface-subtle text-muted grid grid-cols-7 border-b py-2 text-center text-[10px] font-bold uppercase tracking-[0.08em]">
              {WEEKDAYS.map((d) => (
                <div key={d}>
                  {/* The three-letter form is unreadable at 390px. */}
                  <span className="hidden sm:inline">{d}</span>
                  <span className="sm:hidden">{d[0]}</span>
                </div>
              ))}
            </div>

            <div className="divide-border grid grid-cols-7 divide-x divide-y">
              {days.map(({ date, key, inMonth }) => {
                const items = itemsByDay.get(key) ?? [];
                const isToday = key === today;
                // Two rows fit at 390px without the cell growing. The rest are
                // counted, and the counter is what opens the full day.
                const shown = items.slice(0, 2);
                const hidden = items.length - shown.length;

                return (
                  /*
                    ONE button per cell, not one per item. Nested buttons are
                    invalid markup and unreachable by keyboard, and a calendar
                    cell only ever answers one question: what is on this day.
                    Everything specific happens in the dialog it opens.
                  */
                  <button
                    key={key}
                    type="button"
                    onClick={() => setOpenDayKey(key)}
                    aria-label={`${date.getDate()} ${MONTHS[date.getMonth()]} — ${
                      items.length === 0
                        ? "nothing scheduled"
                        : `${items.length} scheduled`
                    }. Open this day.`}
                    className={cn(
                      "hover:bg-surface-subtle/80 focus-visible:ring-brass/40 flex min-h-23 flex-col gap-1 p-1.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none sm:min-h-27 sm:p-2",
                      // Outside days stay visible but recede, so the block keeps
                      // its shape without pretending those days belong here.
                      !inMonth && "bg-surface-subtle/30",
                      isToday && "bg-brass-soft/50",
                    )}
                  >
                    <span
                      className={cn(
                        "tnum flex size-6 shrink-0 items-center justify-center rounded-full text-[11.5px]",
                        isToday
                          ? "bg-brass text-navy-900 font-bold"
                          : inMonth
                            ? "text-foreground font-semibold"
                            : "text-faint",
                      )}
                    >
                      {date.getDate()}
                    </span>

                    <span className="flex min-w-0 flex-col gap-0.5">
                      {shown.map((item) => (
                        <DayBlock key={item.id} item={item} dimmed={!inMonth} />
                      ))}

                      {hidden > 0 && (
                        <span className="text-muted hover:text-foreground mt-0.5 self-start rounded-full px-1 text-[9.5px] font-semibold">
                          +{hidden} more
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </Reveal>
      ) : (
        <Reveal index={1}>
          <div className="space-y-6">
            <AgendaList
              title="Upcoming"
              rows={upcoming}
              emptyLabel="Nothing coming up."
              loading={loading}
              onAdd={() => addEventOn(today)}
            />
            {past.length > 0 && (
              <AgendaList title="Past" rows={past} emptyLabel="" loading={false} muted />
            )}
          </div>
        </Reveal>
      )}

      <DayDetailModal
        dateKey={openDayKey}
        onClose={() => setOpenDayKey(null)}
        events={events}
        tasks={tasks}
        contacts={contacts}
        today={today}
        onAddEvent={(dateStr) => {
          setOpenDayKey(null);
          addEventOn(dateStr);
        }}
      />

      <AddEventModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        householdId={householdId}
        userId={userId}
        defaultDate={selectedDateStr}
        onSuccess={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}

/**
 * One coloured bar in a day cell.
 *
 * A left rule in the full-strength colour, a 12%-tint fill and a hairline
 * outline — three uses of one hue, which is what lets a 9.5px label stay legible
 * on both grounds without a second palette for dark mode. The colours arrive as
 * inline styles because they come from the database (`calendar_events.color_code`
 * is user-set), so there is no class to reach for.
 */
function DayBlock({ item, dimmed }: { item: DayItem; dimmed: boolean }) {
  return (
    <span
      title={item.title}
      className={cn(
        /*
          Below `sm` this is a BAR, not a label.
          Seven columns across 390px leaves about 40px of text, which renders
          every title as "G…" — a truncation that carries no information at all
          and still costs the row height. A stack of coloured bars at least says
          how many things there are and what kind; the day dialog is one tap
          away for the names.
        */
        "flex h-1.5 min-w-0 items-center gap-1 rounded-e-sm border border-s-2 leading-tight sm:h-auto sm:px-1 sm:py-px sm:text-[9.5px]",
        dimmed && "opacity-45",
      )}
      style={{
        // Order matters: the shorthand comes last so it wins on the start edge.
        borderColor: `color-mix(in oklab, ${item.color} 28%, transparent)`,
        borderInlineStart: `2px solid ${item.color}`,
        background: `color-mix(in oklab, ${item.color} 12%, transparent)`,
        color: item.color,
      }}
    >
      {/* The glyph is what separates the two kinds at a glance. An event is a
          bar of colour; a task is a bar of colour with something to tick. */}
      {item.kind === "task" && (
        <CheckCircle2
          size={8}
          strokeWidth={2.5}
          className="hidden shrink-0 sm:block"
        />
      )}
      <span
        className={cn(
          "hidden truncate font-medium sm:block",
          item.done && "line-through opacity-70",
        )}
      >
        {item.title}
      </span>
    </span>
  );
}

/**
 * Everything on one day.
 *
 * The cell can only show two rows, so this is where the rest live — and it is
 * the only place a busy day is fully readable. Tasks here are READ-ONLY and link
 * out: completing one writes a real ledger entry, which must happen on the screen
 * that shows you the amount and the account, not from a calendar square.
 */
function DayDetailModal({
  dateKey,
  onClose,
  events,
  tasks,
  contacts,
  today,
  onAddEvent,
}: {
  dateKey: string | null;
  onClose: () => void;
  events: CalendarEvent[];
  tasks: CalendarTask[];
  contacts: Contact[];
  today: string;
  onAddEvent: (dateStr: string) => void;
}) {
  const dayTasks = dateKey ? tasks.filter((t) => t.due_date === dateKey) : [];
  const dayEvents = dateKey
    ? events.filter((e) => iso(new Date(e.start_at)) === dateKey)
    : [];
  const dayBirthdays = dateKey ? birthdaysBetween(contacts, dateKey, dateKey) : [];

  const when = dateKey
    ? (() => {
        const [y, m, d] = dateKey.split("-").map(Number);
        return new Date(y, m - 1, d);
      })()
    : null;

  return (
    <Modal
      isOpen={dateKey !== null}
      onClose={onClose}
      title={
        when
          ? when.toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })
          : ""
      }
      subtitle={
        dayTasks.length + dayEvents.length + dayBirthdays.length === 0
          ? "Nothing on this day"
          : [
              dayTasks.length > 0 &&
                `${dayTasks.length} ${dayTasks.length === 1 ? "task" : "tasks"}`,
              dayEvents.length > 0 &&
                `${dayEvents.length} ${dayEvents.length === 1 ? "event" : "events"}`,
              dayBirthdays.length > 0 &&
                `${dayBirthdays.length} ${dayBirthdays.length === 1 ? "birthday" : "birthdays"}`,
            ]
              .filter(Boolean)
              .join(" · ")
      }
      icon={<CalendarDays size={16} />}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => dateKey && onAddEvent(dateKey)}
          >
            <Plus size={14} />
            Add event
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {dayTasks.length > 0 && (
          <section>
            <p className="text-muted mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]">
              <ListChecks size={11} />
              Due
            </p>
            <ul className="space-y-1.5">
              {dayTasks.map((t) => {
                const done = t.is_done || t.status === "done";
                const overdue = !done && t.due_date < today;
                const color = done
                  ? TASK_COLOR.done
                  : overdue
                    ? TASK_COLOR.overdue
                    : TASK_COLOR.open;

                return (
                  <li key={t.id}>
                    <Link
                      href="/tasks"
                      className="hover:bg-surface-subtle group flex items-center gap-2.5 rounded-card border border-s-2 p-2.5 transition-colors"
                      style={{
                        borderColor: `color-mix(in oklab, ${color} 28%, transparent)`,
                        borderInlineStart: `3px solid ${color}`,
                        background: `color-mix(in oklab, ${color} 7%, transparent)`,
                      }}
                    >
                      <CheckCircle2
                        size={14}
                        className="shrink-0"
                        style={{ color }}
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "text-foreground block truncate text-[12px] font-medium",
                            done && "text-muted line-through",
                          )}
                        >
                          {t.title}
                        </span>
                        <span className="text-faint mt-0.5 flex flex-wrap items-center gap-x-2 text-[10.5px]">
                          <span className="capitalize">{t.priority} priority</span>
                          {t.is_paid && t.amount_paisa ? (
                            <span className="tnum">
                              {formatPKR(Number(t.amount_paisa))}
                            </span>
                          ) : null}
                          {t.repeat_rule !== "none" && (
                            <span className="inline-flex items-center gap-1">
                              <Repeat size={9} />
                              {t.repeat_rule}
                            </span>
                          )}
                          {overdue && (
                            <span className="text-loss font-semibold">Overdue</span>
                          )}
                        </span>
                      </span>
                      <ArrowUpRight
                        size={13}
                        className="text-faint group-hover:text-foreground-2 shrink-0"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
            <p className="text-faint mt-1.5 text-[10.5px] italic leading-snug">
              Shown here, completed in Tasks — a paid task writes a real entry,
              so it is confirmed on the screen that shows the amount and account.
            </p>
          </section>
        )}

        {dayBirthdays.length > 0 && (
          <section>
            <p className="text-muted mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]">
              <Cake size={11} />
              Birthdays
            </p>
            <ul className="space-y-1.5">
              {dayBirthdays.map(({ contact }) => {
                const color = TYPE_COLOR.birthday;
                const age = turningAge(contact.birthday!);
                return (
                  <li key={contact.id}>
                    <Link
                      href="/contacts"
                      className="hover:bg-surface-subtle group flex items-center gap-2.5 rounded-card border border-s-2 p-2.5 transition-colors"
                      style={{
                        borderColor: `color-mix(in oklab, ${color} 28%, transparent)`,
                        borderInlineStart: `3px solid ${color}`,
                        background: `color-mix(in oklab, ${color} 7%, transparent)`,
                      }}
                    >
                      <Cake size={14} className="shrink-0" style={{ color }} />
                      <span className="min-w-0 flex-1">
                        <span className="text-foreground block truncate text-[12px] font-medium">
                          {contact.name}
                        </span>
                        <span className="text-faint mt-0.5 block text-[10.5px]">
                          {age !== null ? `Turning ${age}` : "Birthday"}
                          {contact.phone && ` · ${contact.phone}`}
                        </span>
                      </span>
                      <ArrowUpRight
                        size={13}
                        className="text-faint group-hover:text-foreground-2 shrink-0"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {dayEvents.length > 0 && (
          <section>
            <p className="text-muted mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]">
              <CalendarDays size={11} />
              Events
            </p>
            <ul className="space-y-1.5">
              {dayEvents.map((e) => {
                const color =
                  e.color_code || TYPE_COLOR[e.event_type] || TYPE_COLOR.general;
                const at = new Date(e.start_at);
                return (
                  <li
                    key={e.id}
                    className="flex items-center gap-2.5 rounded-card border p-2.5"
                    style={{
                      borderColor: `color-mix(in oklab, ${color} 28%, transparent)`,
                      borderInlineStart: `3px solid ${color}`,
                      background: `color-mix(in oklab, ${color} 7%, transparent)`,
                    }}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="text-foreground block truncate text-[12px] font-medium">
                        {e.title}
                      </span>
                      <span className="text-faint mt-0.5 block truncate text-[10.5px] capitalize">
                        {e.event_type}
                        {e.description ? ` · ${e.description}` : ""}
                      </span>
                    </span>
                    <span className="ltr text-muted shrink-0 text-[10.5px]">
                      {e.is_all_day
                        ? "All day"
                        : at.toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {dayTasks.length + dayEvents.length === 0 && (
          <p className="text-muted py-4 text-center text-[12px]">
            Nothing scheduled. Add an event, or set a task due on this day from
            the Tasks module.
          </p>
        )}
      </div>
    </Modal>
  );
}

type AgendaRow = { date: string; item: DayItem; time: string | null };

function AgendaList({
  title,
  rows,
  emptyLabel,
  loading,
  muted = false,
  onAdd,
}: {
  title: string;
  rows: AgendaRow[];
  emptyLabel: string;
  loading: boolean;
  muted?: boolean;
  onAdd?: () => void;
}) {
  return (
    <div>
      <p className="text-muted mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em]">
        {title}
      </p>
      <div className="bg-surface border-border overflow-hidden rounded-panel border shadow-xs">
        {loading ? (
          <ul className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <li key={i} className="shimmer h-12 rounded-control" />
            ))}
          </ul>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={emptyLabel}
              description="Bills, salary dates, committee draws, tax deadlines and every task due date all land here."
              action={
                onAdd ? (
                  <button
                    onClick={onAdd}
                    className="bg-navy-900 text-on-navy dark:bg-brass dark:text-navy-900 rounded-control px-4 py-2 text-xs font-semibold"
                  >
                    <CalendarDays size={14} className="mr-1.5 inline" />
                    Add an event
                  </button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <ul className={cn("divide-border divide-y", muted && "opacity-70")}>
            {rows.map(({ date, item, time }) => {
              const [y, m, d] = date.split("-").map(Number);
              const when = new Date(y, m - 1, d);
              const isTask = item.kind === "task";

              const row = (
                <>
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="h-9 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "text-foreground truncate text-xs font-medium",
                          item.done && "text-muted line-through",
                        )}
                      >
                        {item.title}
                      </p>
                      <p className="text-muted mt-0.5 flex items-center gap-1 truncate text-[11px]">
                        {isTask ? (
                          <>
                            <CheckCircle2 size={10} className="shrink-0" />
                            {item.done
                              ? "Task · completed"
                              : item.overdue
                                ? "Task · overdue"
                                : "Task · due"}
                          </>
                        ) : item.kind === "birthday" ? (
                          <>
                            <Cake size={10} className="shrink-0" />
                            Birthday
                          </>
                        ) : (
                          <>
                            <CalendarDays size={10} className="shrink-0" />
                            Event
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="ltr text-foreground block text-xs font-semibold">
                      {when.toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                    <span className="text-faint ltr text-[10px]">
                      {time ?? "All day"}
                    </span>
                  </div>
                </>
              );

              return (
                <li key={`${item.kind}-${item.id}`}>
                  {/* A task row leaves for Tasks and a birthday for Contacts —
                      the screens that own those records. An event has nowhere
                      further to go, so it stays a plain row rather than a dead
                      link. */}
                  {isTask || item.kind === "birthday" ? (
                    <Link
                      href={isTask ? "/tasks" : "/contacts"}
                      className="hover:bg-surface-subtle flex items-center justify-between gap-4 px-5 py-3 transition-colors"
                    >
                      {row}
                    </Link>
                  ) : (
                    <div className="hover:bg-surface-subtle flex items-center justify-between gap-4 px-5 py-3 transition-colors">
                      {row}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
