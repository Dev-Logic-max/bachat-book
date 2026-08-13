"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
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
      close();
      return;
    }

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

  // The 6x7 grid: leading blanks for the weekday offset, then the month's days.
  const monthStart = startOfMonth(viewMonth);
  const daysInMonth = new Date(
    viewMonth.getFullYear(),
    viewMonth.getMonth() + 1,
    0,
  ).getDate();
  const lead = mondayIndex(monthStart);
  const cells: Array<string | null> = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      iso(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i + 1)),
    ),
  ];

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

  const monthLabel = viewMonth.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

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
              // Flip above the trigger when there is no room below, and never
              // let the panel hang off the right edge on a narrow screen.
              top:
                rect.bottom + 320 > window.innerHeight && rect.top > 320
                  ? rect.top - 314
                  : rect.bottom + 6,
              left: Math.min(
                Math.max(8, rect.left),
                window.innerWidth - panelWidth - 8,
              ),
            }}
            className="border-border bg-surface z-60 rounded-panel border p-3 shadow-xl"
          >
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewMonth((m) => addMonths(m, -1))}
                aria-label="Previous month"
                className="text-muted hover:text-foreground hover:bg-surface-subtle flex size-7 items-center justify-center rounded-full transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="font-display text-[13px] font-semibold">
                {monthLabel}
              </span>
              <button
                type="button"
                onClick={() => setViewMonth((m) => addMonths(m, 1))}
                aria-label="Next month"
                className="text-muted hover:text-foreground hover:bg-surface-subtle flex size-7 items-center justify-center rounded-full transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7 gap-0.5">
              {WEEKDAYS.map((w) => (
                <span
                  key={w}
                  className="text-faint flex h-6 items-center justify-center text-[10px] font-semibold uppercase"
                >
                  {w}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((day, i) => {
                if (!day) return <span key={`blank-${i}`} />;
                const blocked = isBlocked(day);
                const isSelected = day === value;
                const isToday = day === todayStr;
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={blocked}
                    aria-current={isToday ? "date" : undefined}
                    aria-pressed={isSelected}
                    onClick={() => commit(day)}
                    className={cn(
                      "tnum flex h-8 items-center justify-center rounded-control text-[12.5px] transition-colors",
                      !blocked && !isSelected && "hover:bg-surface-subtle",
                      isSelected &&
                        "bg-navy-900 text-on-navy dark:bg-brass dark:text-navy-900 font-semibold",
                      // Today is a ring, not a fill — a fill competes with the
                      // selected day and the two become indistinguishable.
                      isToday && !isSelected && "ring-brass/60 text-brass-strong ring-1",
                      blocked && "text-faint cursor-not-allowed opacity-40",
                    )}
                  >
                    {Number(day.slice(-2))}
                  </button>
                );
              })}
            </div>

            <div className="border-border mt-2.5 flex items-center justify-between border-t pt-2.5">
              <button
                type="button"
                onClick={() => commit(todayStr)}
                disabled={isBlocked(todayStr)}
                className="text-brass-strong hover:bg-brass-soft rounded-control px-2 py-1 text-[11.5px] font-semibold transition-colors disabled:opacity-40"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => close()}
                className="text-muted hover:text-foreground rounded-control px-2 py-1 text-[11.5px] font-medium transition-colors"
              >
                Done
              </button>
            </div>
          </div>,
          document.body,
        )}

      {hint && !error && <p className="text-faint text-[11px]">{hint}</p>}
      {error && <p className="text-loss text-[11.5px] font-medium">{error}</p>}
    </div>
  );
}
