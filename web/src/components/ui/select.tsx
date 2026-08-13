"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  avatarUrl?: string | null;
  icon?: React.ReactNode;
  description?: string;
  /** Optional group heading — used to render categories parent → child. */
  group?: string;
  /**
   * Trailing status shown at the right edge of the row (e.g. "2 accounts").
   * Purely informational — it must never imply the option is unavailable, so it
   * sits alongside the tick rather than replacing it and does not set `disabled`.
   */
  meta?: React.ReactNode;
  disabled?: boolean;
}

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Array<SelectOption>;
}

/** Native select. Kept for simple non-visual cases; prefer RichSelect. */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, id, ...props }, ref) => {
    const generatedId = React.useId();
    const selectId = id || generatedId;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="text-foreground-2 block text-xs font-medium"
          >
            {label}
          </label>
        )}
        <select
          id={selectId}
          className={cn(
            "border-border bg-surface text-foreground focus:border-navy-900 focus:ring-navy-900/10 dark:focus:border-brass flex h-10 w-full rounded-control border px-3.5 py-2 text-sm transition-all outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-loss focus:border-loss focus:ring-loss/10",
            className,
          )}
          ref={ref}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-loss text-[11.5px] font-medium">{error}</p>}
      </div>
    );
  },
);

Select.displayName = "Select";

export interface RichSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  emptyMessage?: string;
  hint?: string;
}

/**
 * Select with logos, icons and subtitles.
 *
 * Two things here are load-bearing rather than decorative:
 *
 * 1. The popover is rendered through a PORTAL with fixed positioning. Absolutely
 *    positioned it was clipped by any `overflow-y-auto` ancestor — including the
 *    Modal body, which is exactly where a 37-option category list is used, so the
 *    last options were unreachable.
 * 2. Full keyboard support (arrows / Home / End / Enter / Escape / typeahead) plus
 *    listbox roles. A long option list is unusable without it, and the trigger is
 *    a <button>, so screen readers get nothing from the markup alone.
 */
export function RichSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Select option…",
  error,
  disabled = false,
  emptyMessage = "Nothing to choose from",
  hint,
}: RichSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [rect, setRect] = React.useState<DOMRect | null>(null);

  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const typeahead = React.useRef({ query: "", at: 0 });

  const baseId = React.useId();
  const listboxId = `${baseId}-listbox`;

  const selectable = React.useMemo(
    () => options.filter((o) => !o.disabled),
    [options],
  );
  const selectedOption = options.find((opt) => opt.value === value);

  const measure = React.useCallback(() => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
  }, []);

  const open = () => {
    if (disabled) return;
    measure();
    setPendingRefocus(false);
    const i = selectable.findIndex((o) => o.value === value);
    setActiveIndex(i >= 0 ? i : 0);
    setIsOpen(true);
  };

  /*
   * Refocus intent is STATE, not a ref, and the focus call itself lives in the
   * effect below.
   *
   * react-hooks/refs rejects any handler that touches `.current` once it is passed
   * down as a prop — it cannot tell that the handler only ever runs from an event,
   * so `onClick={() => commit(opt)}` errored with "Cannot access refs during
   * render" while `commit` still reached a ref through `close`.
   */
  const [pendingRefocus, setPendingRefocus] = React.useState(false);

  const close = React.useCallback((refocus = true) => {
    setPendingRefocus(refocus);
    setIsOpen(false);
    setActiveIndex(-1);
  }, []);

  React.useEffect(() => {
    if (isOpen || !pendingRefocus) return;
    // Not reset here — `open()` clears it, which keeps this effect free of a
    // synchronous setState (CLAUDE.md §Traps).
    triggerRef.current?.focus();
  }, [isOpen, pendingRefocus]);

  const commit = (opt: SelectOption) => {
    onChange(opt.value);
    setPendingRefocus(true);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  // Reposition on scroll/resize while open. `true` captures scrolls on ancestor
  // containers, not just the window — the modal body is one of them.
  React.useEffect(() => {
    if (!isOpen) return;
    const onScrollOrResize = () => measure();
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
      if (
        !triggerRef.current?.contains(t) &&
        !listRef.current?.contains(t)
      ) {
        close(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [isOpen, close]);

  // Keep the active option scrolled into view as the user arrows through.
  React.useEffect(() => {
    if (!isOpen || activeIndex < 0 || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [isOpen, activeIndex]);

  const step = (delta: number) => {
    if (selectable.length === 0) return;
    setActiveIndex((i) => {
      const next = i + delta;
      if (next < 0) return selectable.length - 1;
      if (next >= selectable.length) return 0;
      return next;
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        open();
      }
      return;
    }

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        /*
         * Escape here dismisses the LIST, not whatever contains it. Modal listens
         * for Escape on `window`; without this the keypress kept travelling and
         * closed the entire Add Account dialog, throwing away a part-filled form
         * because the user wanted to back out of a dropdown.
         */
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
        close();
        return;
      case "Tab":
        // Tab commits nothing and closes — matches native select behaviour.
        close(false);
        return;
      case "ArrowDown":
        e.preventDefault();
        step(1);
        return;
      case "ArrowUp":
        e.preventDefault();
        step(-1);
        return;
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        return;
      case "End":
        e.preventDefault();
        setActiveIndex(selectable.length - 1);
        return;
      case "Enter":
      case " ":
        e.preventDefault();
        if (selectable[activeIndex]) commit(selectable[activeIndex]);
        return;
    }

    // Typeahead: printable single characters accumulate for 700ms.
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const now = e.timeStamp;
      const t = typeahead.current;
      t.query = now - t.at > 700 ? e.key : t.query + e.key;
      t.at = now;
      const q = t.query.toLowerCase();
      const found = selectable.findIndex((o) =>
        o.label.toLowerCase().startsWith(q),
      );
      if (found >= 0) setActiveIndex(found);
    }
  };

  // Group headings, preserving the order options were given in.
  const rendered: Array<
    { kind: "heading"; label: string } | { kind: "option"; opt: SelectOption }
  > = [];
  let lastGroup: string | undefined;
  for (const opt of options) {
    if (opt.group && opt.group !== lastGroup) {
      rendered.push({ kind: "heading", label: opt.group });
      lastGroup = opt.group;
    }
    rendered.push({ kind: "option", opt });
  }

  const activeValue =
    activeIndex >= 0 ? selectable[activeIndex]?.value : undefined;

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label
          htmlFor={`${baseId}-trigger`}
          className="text-foreground-2 block text-xs font-medium"
        >
          {label}
        </label>
      )}

      <button
        id={`${baseId}-trigger`}
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-activedescendant={
          isOpen && activeValue ? `${baseId}-opt-${activeValue}` : undefined
        }
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
          {selectedOption?.avatarUrl && (
            <img
              src={selectedOption.avatarUrl}
              alt=""
              className="size-5 shrink-0 rounded-full object-contain"
            />
          )}
          {selectedOption?.icon && (
            <span className="text-brass-strong shrink-0">{selectedOption.icon}</span>
          )}
          <span
            className={cn(
              "truncate",
              selectedOption ? "text-foreground font-medium" : "text-muted",
            )}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>
        <ChevronDown
          size={16}
          className={cn(
            "text-muted shrink-0 transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen &&
        rect &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label={label}
            style={{
              position: "fixed",
              top: rect.bottom + 6,
              /*
               * The list may be WIDER than its trigger. Locked to `rect.width` it
               * inherited the trigger's column, and a half-width control such as
               * Account Type truncated every label it was meant to explain
               * ("Savings / Asaan acco…"). It is still clamped to the viewport and
               * nudged back inside if that overflows the right edge.
               */
              ...(() => {
                const w = Math.min(
                  Math.max(rect.width, 264),
                  window.innerWidth - 16,
                );
                return {
                  width: w,
                  left: Math.min(Math.max(8, rect.left), window.innerWidth - w - 8),
                };
              })(),
              // Never taller than the gap to the viewport bottom, so the last
              // option is always reachable on a short mobile screen.
              maxHeight: Math.max(160, window.innerHeight - rect.bottom - 24),
            }}
            className="border-border bg-surface z-60 overflow-y-auto rounded-panel border p-1 shadow-xl"
          >
            {options.length === 0 ? (
              <p className="text-muted px-3 py-3 text-[11.5px]">{emptyMessage}</p>
            ) : (
              rendered.map((row, i) => {
                if (row.kind === "heading") {
                  return (
                    <p
                      key={`h-${row.label}-${i}`}
                      role="presentation"
                      className="text-faint px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                    >
                      {row.label}
                    </p>
                  );
                }

                const opt = row.opt;
                const isSelected = opt.value === value;
                const idx = selectable.indexOf(opt);
                const isActive = idx >= 0 && idx === activeIndex;

                return (
                  <button
                    key={opt.value}
                    id={`${baseId}-opt-${opt.value}`}
                    data-index={idx}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={opt.disabled}
                    // Pointer down rather than click: the trigger's blur would
                    // otherwise close the list before click landed.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => commit(opt)}
                    onMouseEnter={() => idx >= 0 && setActiveIndex(idx)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-control px-3 py-2 text-left text-xs transition-colors",
                      // Colour and the check mark carry selection. `font-bold`
                      // used to be applied here, which reflowed the row width.
                      isActive && "bg-surface-subtle",
                      isSelected && "text-brass-strong",
                      opt.disabled && "cursor-not-allowed opacity-40",
                      opt.group && "ps-6",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      {opt.avatarUrl && (
                        <img
                          src={opt.avatarUrl}
                          alt=""
                          className="size-5 shrink-0 rounded-full object-contain"
                        />
                      )}
                      {opt.icon && (
                        <span
                          className={cn(
                            "shrink-0",
                            isSelected ? "text-brass-strong" : "text-foreground-2",
                          )}
                        >
                          {opt.icon}
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate">{opt.label}</span>
                        {opt.description && (
                          <span className="text-muted block truncate text-[10px] font-normal">
                            {opt.description}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {opt.meta}
                      {isSelected && (
                        <Check size={14} className="text-brass-strong" />
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>,
          document.body,
        )}

      {hint && !error && <p className="text-faint text-[11px]">{hint}</p>}
      {error && <p className="text-loss text-[11.5px] font-medium">{error}</p>}
    </div>
  );
}
