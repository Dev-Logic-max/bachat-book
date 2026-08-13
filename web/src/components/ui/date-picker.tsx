"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Date picker.
 *
 * `<input type="date">` renders a different control in every browser, cannot be
 * styled past the border, and on Windows Chrome puts a grey system panel over a
 * cream modal. This is the same popover machinery as RichSelect — portalled,
 * fixed-position, viewport-clamped — so it escapes the modal's `overflow-y-auto`
 * instead of being clipped by it.
 *
 * Values are LOCAL `YYYY-MM-DD` throughout. `toISOString()` converts to UTC and
 * in PKT (+05:00) that lands on the previous day for anything before 05:00, so
 * dates are formatted by hand from the local parts.
 */

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function iso(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function parseISO(value: string | undefined): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  const parsed = new Date(y, m - 1, d);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * "today", "yesterday", "3 days ago", "in 2 days".
 *
 * The footer used to hold a "Done" button that did the same thing as clicking
 * away. This slot is worth more spent saying how far back the chosen date is —
 * the thing you actually want confirmed when backdating an expense.
 */
function relativeDay(value: string, today: string): string {
  const a = parseISO(value);
  const b = parseISO(today);
  if (!a || !b) return "";
  const days = Math.round((a.getTime() - b.getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === -1) return "yesterday";
  if (days === 1) return "tomorrow";
  if (days < 0) return `${-days} days ago`;
  return `in ${days} days`;
}

/** Monday-first offset. `getDay()` is Sunday-first, which shifts the whole grid. */
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export interface DatePickerProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  /** Latest selectable day, inclusive. */
  max?: string;
  /** Earliest selectable day, inclusive. */
  min?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export function DatePicker({
  label,
  value,
  onChange,
  max,
  min,
  hint,
  error,
  disabled = false,
  required = false,
  className,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  /** Day grid vs the twelve-month grid. Reset every time the panel opens. */
  const [pickingMonth, setPickingMonth] = React.useState(false);

  const selected = parseISO(value);
  const todayStr = iso(new Date());

  // Which month the grid is showing. Seeded from the value, and re-seeded when
  // the value jumps to a different month while closed.
  const [viewMonth, setViewMonth] = React.useState<Date>(
    () => startOfMonth(selected ?? new Date()),
  );
  const viewKey = `${value}:${isOpen}`;
  const [seenKey, setSeenKey] = React.useState(viewKey);
  if (seenKey !== viewKey) {
    setSeenKey(viewKey);
    const target = parseISO(value);
    if (isOpen && target) setViewMonth(startOfMonth(target));
  }

  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const baseId = React.useId();

  const measure = React.useCallback(() => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
  }, []);

  /*
   * Refocus intent is STATE, and the focus call lives in the effect below.
   * react-hooks/refs rejects any handler passed as a prop that reaches
   * `.current`, even transitively — the same trap RichSelect hit.
   */
  const [pendingRefocus, setPendingRefocus] = React.useState(false);

  const close = React.useCallback((refocus = true) => {
    setPendingRefocus(refocus);
    setIsOpen(false);
  }, []);

  React.useEffect(() => {
    if (isOpen || !pendingRefocus) return;
    triggerRef.current?.focus();
  }, [isOpen, pendingRefocus]);

  const open = () => {
    if (disabled) return;
    measure();
    setPendingRefocus(false);
    setViewMonth(startOfMonth(parseISO(value) ?? new Date()));
    // Always open on days. The month grid is a detour, never the landing state.
    setPickingMonth(false);
    setIsOpen(true);
  };

  React.useEffect(() => {
    if (!isOpen) return;
    const onScrollOrResize = () => measure();
    // `true` captures scrolls on ancestors, not just the window — the modal body
    // is one of them.
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [isOpen, measure]);

  React.useEffect(() => {
    if (!isOpen) return;
    function onPointerDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !panelRef.current?.contains(t)) {
        close(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [isOpen, close]);

  const isBlocked = (day: string) =>
    (max !== undefined && day > max) || (min !== undefined && day < min);

  /*
   * A month is only unreachable when BOTH its ends are out of range. Testing the
   * 1st alone would grey out the current month on every backdating field, since
   * `max` is today and the 1st is in range but a mid-month `min` is not.
   */
  const isMonthFullyBlocked = (year: number, monthIndex: number) => {
    const first = iso(new Date(year, monthIndex, 1));
    const last = iso(new Date(year, monthIndex + 1, 0));
    return (max !== undefined && first > max) || (min !== undefined && last < min);
  };

  const commit = (day: string) => {
    if (isBlocked(day)) return;
    onChange(day);
    setPendingRefocus(true);
    setIsOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!isOpen) {
      if (["ArrowDown", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        open();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      /*
       * Escape closes the CALENDAR, not the modal containing it. Modal listens on
       * `window`; without stopping here the key kept travelling and threw away a
       * part-filled form because someone wanted out of the date panel.
       */
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      // One level at a time: month grid → day grid → closed.
      if (pickingMonth) setPickingMonth(false);
      else close();
      return;
    }

    // Day arithmetic makes no sense while the month grid is up.
    if (pickingMonth) return;

    // Arrow keys walk days; PageUp/PageDown walk months.
    const step: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (step[e.key] !== undefined) {
      e.preventDefault();
      const from = parseISO(value) ?? new Date();
      const next = new Date(from);
      next.setDate(next.getDate() + step[e.key]);
      if (!isBlocked(iso(next))) {
        onChange(iso(next));
        setViewMonth(startOfMonth(next));
      }
      return;
    }
    if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      setViewMonth((m) => addMonths(m, e.key === "PageUp" ? -1 : 1));
    }
  };

  /*
   * A full 6×7 block, always.
   *
   * The leading gap used to be empty <span>s and the trailing one did not exist,
   * so February drew four rows and August six — the panel changed height as you
   * paged through months and everything below it jumped. Neighbouring days are
   * rendered muted and stay selectable: clicking 1 September from the August
   * grid is the obvious thing to do.
   */
  const monthStart = startOfMonth(viewMonth);
  const lead = mondayIndex(monthStart);
  const gridStart = new Date(
    viewMonth.getFullYear(),
    viewMonth.getMonth(),
    1 - lead,
  );
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    return {
      day: iso(d),
      date: d.getDate(),
      outside: d.getMonth() !== viewMonth.getMonth(),
      // Sat/Sun sit a shade back — a month grid is read by working weeks.
      weekend: d.getDay() === 0 || d.getDay() === 6,
    };
  });

  /*
   * "12 Aug 2026", not "Wed, 12 Aug 2026". These controls sit in half-width grid
   * columns beside an amount box; with the weekday and the Today chip the label
   * clipped to "Wed, 12 Aug 20…", losing the year — the one part you cannot
   * infer from context.
   */
  const display = selected
    ? selected.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Choose a date";

  const monthName = viewMonth.toLocaleDateString("en-GB", { month: "long" });

  const panelWidth = 292;

  return (
    <div className={cn("w-full space-y-1.5", className)}>
      {label && (
        <label
          htmlFor={`${baseId}-trigger`}
          className="text-foreground-2 block text-xs font-medium"
        >
          {label}
          {required && <span className="text-loss ms-0.5">*</span>}
        </label>
      )}

      <button
        id={`${baseId}-trigger`}
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={onKeyDown}
        className={cn(
          "border-border bg-surface text-foreground flex h-10 w-full items-center justify-between gap-2 rounded-control border px-3.5 py-2 text-sm transition-colors outline-none",
          "hover:bg-surface-subtle/60 focus-visible:ring-2 focus-visible:ring-navy-900/10 dark:focus-visible:ring-brass/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-loss",
        )}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <CalendarDays size={15} className="text-muted shrink-0" />
          {/* Latin date text inside Urdu copy still reads left to right. */}
          <span
            className={cn("ltr truncate", selected ? "text-foreground font-medium" : "text-muted")}
          >
            {display}
          </span>
        </span>
        {value === todayStr && (
          <span className="bg-brass-soft text-brass-strong shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
            Today
          </span>
        )}
      </button>

      {isOpen &&
        rect &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={label ?? "Choose a date"}
            onKeyDown={onKeyDown}
            style={{
              position: "fixed",
              width: panelWidth,
              /*
               * Flip above the trigger when there is no room below, and never
               * let the panel hang off the right edge on a narrow screen.
               *
               * ~336px: header strip, six full weeks and the footer. The grid is
               * always six rows now, so unlike the old ragged version this height
               * does not change from month to month.
               */
              top:
                rect.bottom + 336 > window.innerHeight && rect.top > 336
                  ? rect.top - 342
                  : rect.bottom + 6,
              left: Math.min(
                Math.max(8, rect.left),
                window.innerWidth - panelWidth - 8,
              ),
            }}
            className="border-border bg-surface z-60 overflow-hidden rounded-panel border shadow-lg"
          >
            {/*
              Header sits on its own tinted strip, mirroring Modal. It gives the
              panel a top edge to hang from — three loose rows of controls on a
              flat white sheet read as unfinished, not minimal.
            */}
            {/*
              The header arrows step by ONE unit of whatever is on screen: a
              month in the day grid, a year in the month grid. Paging twelve
              times to reach last December is the thing this picker exists to
              avoid, so the title itself is the switch between the two.
            */}
            <div className="bg-surface-subtle/60 border-border flex items-center justify-between border-b px-2.5 py-2">
              <button
                type="button"
                onClick={() =>
                  setViewMonth((m) => (pickingMonth ? addMonths(m, -12) : addMonths(m, -1)))
                }
                aria-label={pickingMonth ? "Previous year" : "Previous month"}
                className="text-muted hover:text-foreground hover:bg-surface flex size-7 items-center justify-center rounded-full transition-colors"
              >
                <ChevronLeft size={15} />
              </button>

              <button
                type="button"
                onClick={() => setPickingMonth((p) => !p)}
                aria-expanded={pickingMonth}
                title={pickingMonth ? "Back to days" : "Pick a month"}
                className="hover:bg-surface flex items-center gap-1.5 rounded-control px-2 py-0.5 leading-tight transition-colors"
              >
                <span className="text-center">
                  <span className="font-display block text-[13px] font-semibold">
                    {pickingMonth ? viewMonth.getFullYear() : monthName}
                  </span>
                  {!pickingMonth && (
                    <span className="text-faint tnum block text-[10px] tracking-[0.14em]">
                      {viewMonth.getFullYear()}
                    </span>
                  )}
                </span>
                <ChevronDown
                  size={12}
                  className={cn(
                    "text-faint shrink-0 transition-transform",
                    pickingMonth && "rotate-180",
                  )}
                />
              </button>

              <button
                type="button"
                onClick={() =>
                  setViewMonth((m) => (pickingMonth ? addMonths(m, 12) : addMonths(m, 1)))
                }
                aria-label={pickingMonth ? "Next year" : "Next month"}
                className="text-muted hover:text-foreground hover:bg-surface flex size-7 items-center justify-center rounded-full transition-colors"
              >
                <ChevronRight size={15} />
              </button>
            </div>

            {pickingMonth ? (
              /*
               * Twelve months of the year on screen. Sized to the same block the
               * day grid occupies so the panel does not resize when you switch —
               * a popover that changes height under the pointer feels broken.
               */
              <div className="grid h-59 grid-cols-3 content-center gap-1.5 p-2.5">
                {MONTHS.map((label, i) => {
                  const isViewed = i === viewMonth.getMonth();
                  const isSelectedMonth =
                    selected &&
                    selected.getMonth() === i &&
                    selected.getFullYear() === viewMonth.getFullYear();
                  // Grey a month out only when EVERY day in it is out of range.
                  const monthBlocked = isMonthFullyBlocked(viewMonth.getFullYear(), i);

                  return (
                    <button
                      key={label}
                      type="button"
                      disabled={monthBlocked}
                      onClick={() => {
                        setViewMonth(new Date(viewMonth.getFullYear(), i, 1));
                        setPickingMonth(false);
                      }}
                      className={cn(
                        "flex h-11 items-center justify-center rounded-control text-[12.5px] transition-colors",
                        !monthBlocked && !isSelectedMonth && "hover:bg-surface-subtle",
                        isSelectedMonth &&
                          "bg-navy-900 text-on-navy dark:bg-brass dark:text-navy-900 font-semibold",
                        isViewed && !isSelectedMonth && "text-brass-strong font-semibold",
                        monthBlocked && "text-faint cursor-not-allowed opacity-40",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            ) : (
            <div className="p-2.5">
              <div className="mb-1 grid grid-cols-7 gap-0.5">
                {WEEKDAYS.map((w, i) => (
                  <span
                    key={w}
                    className={cn(
                      "flex h-6 items-center justify-center text-[10px] font-semibold uppercase tracking-wide",
                      i >= 5 ? "text-faint/70" : "text-faint",
                    )}
                  >
                    {w}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-0.5">
                {cells.map((cell) => {
                  const blocked = isBlocked(cell.day);
                  const isSelected = cell.day === value;
                  const isToday = cell.day === todayStr;
                  return (
                    <button
                      key={cell.day}
                      type="button"
                      disabled={blocked}
                      aria-current={isToday ? "date" : undefined}
                      aria-pressed={isSelected}
                      onClick={() => commit(cell.day)}
                      className={cn(
                        "tnum relative flex h-8 items-center justify-center rounded-control text-[12.5px] transition-all",
                        !blocked && !isSelected && "hover:bg-surface-subtle",
                        cell.outside && !isSelected && "text-faint/60",
                        cell.weekend && !cell.outside && !isSelected && "text-muted",
                        isSelected &&
                          "bg-navy-900 text-on-navy dark:bg-brass dark:text-navy-900 font-semibold shadow-sm",
                        // Today is a DOT under the number, not a fill or a ring:
                        // a fill competes with the selected day, and a ring on a
                        // 32px cell sat a pixel off the hover background.
                        isToday && !isSelected && "text-brass-strong font-semibold",
                        blocked && "text-faint cursor-not-allowed opacity-40",
                      )}
                    >
                      {cell.date}
                      {isToday && (
                        <span
                          aria-hidden
                          className={cn(
                            "absolute bottom-1 size-1 rounded-full",
                            isSelected ? "bg-on-navy dark:bg-navy-900" : "bg-brass",
                          )}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            )}

            <div className="border-border bg-surface-subtle/40 flex items-center justify-between border-t px-2.5 py-2">
              <button
                type="button"
                onClick={() => {
                  setPickingMonth(false);
                  commit(todayStr);
                }}
                disabled={isBlocked(todayStr)}
                className="text-brass-strong hover:bg-brass-soft rounded-control px-2 py-1 text-[11.5px] font-semibold transition-colors disabled:opacity-40"
              >
                Today
              </button>
              <span className="text-faint text-[10.5px] italic">
                {selected ? relativeDay(value, todayStr) : "no date set"}
              </span>
            </div>
          </div>,
          document.body,
        )}

      {hint && !error && <p className="text-faint text-[11px]">{hint}</p>}
      {error && <p className="text-loss text-[11.5px] font-medium">{error}</p>}
    </div>
  );
}
