"use client";

import * as React from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { PageActions } from "@/components/page-actions";
import { Reveal } from "@/components/reveal";
import { EmptyState } from "@/components/empty-state";
import { AddEventModal } from "@/components/add-event-modal";
import { createClient } from "@/lib/supabase/client";
import { formatHijri } from "@/lib/format";
import { todayISO } from "@/lib/ledger";
import { cn } from "@/lib/utils";
import type { Tables } from "@/lib/supabase/types";

type CalendarView = "month" | "agenda";
type CalendarEvent = Tables<"calendar_events">;

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

const LEGEND = [
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
  const [loading, setLoading] = React.useState(true);
  const [addModalOpen, setAddModalOpen] = React.useState(false);
  const [selectedDateStr, setSelectedDateStr] = React.useState("");
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    if (!householdId) return;

    async function loadEvents() {
      const { data } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("household_id", householdId)
        .order("start_at", { ascending: true });

      if (!active) return;
      if (data) setEvents(data);
      setLoading(false);
    }

    loadEvents();
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

  // Events bucketed by local day once, rather than filtered per cell.
  const eventsByDay = React.useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const key = iso(new Date(e.start_at));
      const list = map.get(key);
      if (list) list.push(e);
      else map.set(key, [e]);
    }
    return map;
  }, [events]);

  const monthEventCount = days.reduce(
    (n, d) => (d.inMonth ? n + (eventsByDay.get(d.key)?.length ?? 0) : n),
    0,
  );

  const openDay = (dateStr: string) => {
    setSelectedDateStr(dateStr);
    setAddModalOpen(true);
  };

  // Upcoming first — an agenda that opens on last year's events is a log, not a plan.
  const upcoming = events.filter((e) => iso(new Date(e.start_at)) >= today);
  const past = events
    .filter((e) => iso(new Date(e.start_at)) < today)
    .reverse();

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
            {monthEventCount === 0
              ? "Nothing scheduled this month — pick a day to add something."
              : `${monthEventCount} ${monthEventCount === 1 ? "event" : "events"} this month.`}
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
                onClick: () => openDay(today),
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

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {LEGEND.map((l) => (
              <span key={l.label} className="text-muted flex items-center gap-1.5 text-[11px]">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: l.color }}
                />
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
                const dayEvents = eventsByDay.get(key) ?? [];
                const isToday = key === today;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => openDay(key)}
                    aria-label={`${date.getDate()} ${MONTHS[date.getMonth()]} — ${
                      dayEvents.length
                    } events. Add an event.`}
                    className={cn(
                      "hover:bg-surface-subtle/80 focus-visible:ring-brass/40 flex min-h-23 flex-col gap-1.5 p-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none sm:min-h-27",
                      // Outside days stay visible but recede, so the block keeps
                      // its shape without pretending those days belong here.
                      !inMonth && "bg-surface-subtle/30",
                      isToday && "bg-brass-soft/50",
                    )}
                  >
                    <span className="flex items-center justify-between">
                      <span
                        className={cn(
                          "tnum flex size-6 items-center justify-center rounded-full text-[11.5px]",
                          isToday
                            ? "bg-brass text-navy-900 font-bold"
                            : inMonth
                              ? "text-foreground font-semibold"
                              : "text-faint",
                        )}
                      >
                        {date.getDate()}
                      </span>
                      {dayEvents.length > 2 && (
                        <span className="text-faint tnum text-[9.5px] font-semibold">
                          +{dayEvents.length - 2}
                        </span>
                      )}
                    </span>

                    <span className="flex flex-col gap-1">
                      {dayEvents.slice(0, 2).map((event) => (
                        <span
                          key={event.id}
                          className="flex items-center gap-1.5 truncate rounded-sm text-[10px] font-medium"
                        >
                          <span
                            className="size-1.5 shrink-0 rounded-full"
                            style={{
                              backgroundColor:
                                event.color_code || TYPE_COLOR[event.event_type] || TYPE_COLOR.general,
                            }}
                          />
                          <span
                            className={cn(
                              "truncate",
                              inMonth ? "text-foreground-2" : "text-faint",
                            )}
                          >
                            {event.title}
                          </span>
                        </span>
                      ))}
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
              events={upcoming}
              emptyLabel="Nothing coming up."
              loading={loading}
              onAdd={() => openDay(today)}
            />
            {past.length > 0 && (
              <AgendaList title="Past" events={past} emptyLabel="" loading={false} muted />
            )}
          </div>
        </Reveal>
      )}

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

function AgendaList({
  title,
  events,
  emptyLabel,
  loading,
  muted = false,
  onAdd,
}: {
  title: string;
  events: CalendarEvent[];
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
        ) : events.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={emptyLabel}
              description="Bills, salary dates, committee draws and tax deadlines all live here."
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
            {events.map((event) => {
              const when = new Date(event.start_at);
              return (
                <li
                  key={event.id}
                  className="hover:bg-surface-subtle flex items-center justify-between gap-4 px-5 py-3 transition-colors"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="h-9 w-1 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          event.color_code || TYPE_COLOR[event.event_type] || TYPE_COLOR.general,
                      }}
                    />
                    <div className="min-w-0">
                      <p className="text-foreground truncate text-xs font-medium">
                        {event.title}
                      </p>
                      <p className="text-muted mt-0.5 truncate text-[11px] capitalize">
                        {event.event_type}
                        {event.description ? ` · ${event.description}` : ""}
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
                      {event.is_all_day
                        ? "All day"
                        : when.toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
