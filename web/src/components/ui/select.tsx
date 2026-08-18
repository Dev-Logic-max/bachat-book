"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  avatarUrl?: string | null;
  icon?: React.ReactNode;
  description?: string;
  /**
   * The SAME fact in another form, shown right-aligned on the same row rather
   * than on a second line: the Urdu name beside the English one.
   *
   * `description` sets a second line and doubles the row height. For 94
   * subcategories that turned a picker into a scroll, and the second line was
   * carrying one short word. Omitted when it is missing — a household's own
   * "Chai Dhaba" has no Urdu name, and an empty second column reads as a gap.
   */
  secondaryLabel?: string;
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
  /**
   * Badge pinned to the right of the TRIGGER, before the chevron — not part of
   * any option. For facts about the current selection that the label cannot
   * carry: the month filter uses it for the number of days the range covers,
   * which is the thing you actually want to know and would otherwise have to
   * work out from "August 2026".
   */
  trailing?: React.ReactNode;
  /** Extra classes for the trigger, e.g. to widen a filter row control. */
  className?: string;
  /**
   * A filter box pinned above the options.
   *
   * Typeahead alone only jumps to what a label STARTS with, which is the wrong
   * shape for this catalogue — "Kiryana" is under Food, and someone looking for
   * it types the word, not the letter F. Matches label, secondary label and
   * description, so the Urdu name finds the English row and back again.
   */
  searchable?: boolean;
  searchPlaceholder?: string;
  /**
   * Single-line rows, tighter padding. For long lists whose options are a name
   * and nothing else.
   */
  dense?: boolean;
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
  trailing,
  className,
  searchable = false,
  searchPlaceholder = "Search…",
  dense = false,
}: RichSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const [query, setQuery] = React.useState("");

  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const typeahead = React.useRef({ query: "", at: 0 });

  const baseId = React.useId();
  const listboxId = `${baseId}-listbox`;

  /*
   * The filter matches every string on the option, not just the label. Someone
   * scanning an Urdu picker types the Urdu word; someone who set "Kiryana" up in
   * English types that. Both have to land on the same row.
   */
  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!searchable || !q) return options;
    return options.filter((o) =>
      [o.label, o.secondaryLabel, o.description]
        .filter(Boolean)
        .some((s) => s!.toLowerCase().includes(q)),
    );
  }, [options, query, searchable]);

  const selectable = React.useMemo(
    () => visible.filter((o) => !o.disabled),
    [visible],
  );
  // Looked up in the FULL list — a filtered-out selection is still the selection.
  const selectedOption = options.find((opt) => opt.value === value);

  const measure = React.useCallback(() => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
  }, []);

  const open = () => {
    if (disabled) return;
    measure();
    setPendingRefocus(false);
    // Never reopen onto the last filter — the list you saw last time is not the
    // list you are looking for now.
    setQuery("");
    const i = options.filter((o) => !o.disabled).findIndex((o) => o.value === value);
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
    setQuery("");
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

    // Typeahead: printable single characters accumulate for 700ms. Skipped when
    // there is a search box — the same keystrokes belong to it, and typeahead
    // only ever matched the START of a label anyway.
    if (!searchable && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
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
  for (const opt of visible) {
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
          className,
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
        <span className="flex shrink-0 items-center gap-1.5">
          {selectedOption?.secondaryLabel && (
            <span
              dir="auto"
              className="copy text-faint hidden max-w-28 truncate text-[11.5px] font-normal sm:inline"
            >
              {selectedOption.secondaryLabel}
            </span>
          )}
          {trailing}
          <ChevronDown
            size={16}
            className={cn(
              "text-muted transition-transform",
              isOpen && "rotate-180",
            )}
          />
        </span>
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
            className="border-border bg-surface z-60 flex flex-col overflow-hidden rounded-panel border shadow-xl"
          >
            {/*
              Pinned, not scrolled with the options — a filter box that leaves
              the viewport as you scroll is a filter box you cannot correct.
            */}
            {searchable && (
              <div className="border-border bg-surface sticky top-0 shrink-0 border-b p-1.5">
                <div className="relative">
                  <Search
                    size={13}
                    className="text-muted pointer-events-none absolute inset-s-2.5 top-1/2 -translate-y-1/2"
                  />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      // Filtering changes what index 0 means; leaving the old
                      // one would highlight a row nobody searched for.
                      setActiveIndex(0);
                    }}
                    onKeyDown={onKeyDown}
                    placeholder={searchPlaceholder}
                    aria-label={searchPlaceholder}
                    className="border-border bg-surface-subtle text-foreground placeholder:text-faint h-8 w-full rounded-control border ps-7 pe-2 text-[12px] outline-none focus:border-brass/50"
                  />
                </div>
              </div>
            )}

            <div className="scroll-hidden min-h-0 flex-1 overflow-y-auto p-1">
            {visible.length === 0 ? (
              <p className="text-muted px-3 py-3 text-[11.5px]">
                {options.length === 0
                  ? emptyMessage
                  : `Nothing matches “${query.trim()}”.`}
              </p>
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
                      "flex w-full items-center justify-between gap-2.5 rounded-control text-left text-xs transition-colors",
                      dense ? "px-2.5 py-1.5" : "px-3 py-2",
                      // Colour and the check mark carry selection. `font-bold`
                      // used to be applied here, which reflowed the row width.
                      isActive && "bg-surface-subtle",
                      isSelected && "text-brass-strong",
                      opt.disabled && "cursor-not-allowed opacity-40",
                      opt.group && "ps-6",
                    )}
                  >
                    <span
                      className={cn(
                        "flex min-w-0 flex-1 items-center",
                        dense ? "gap-2" : "gap-2.5",
                      )}
                    >
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
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{opt.label}</span>
                        {opt.description && (
                          <span className="text-muted block truncate text-[10px] font-normal">
                            {opt.description}
                          </span>
                        )}
                      </span>
                      {/*
                        The other language, on the same line. `dir="auto"` and
                        `.copy` because this is Urdu prose, not a number — the
                        script has to be allowed to run right-to-left inside its
                        own box while the row itself never mirrors.
                      */}
                      {opt.secondaryLabel && (
                        <span
                          dir="auto"
                          className="copy text-faint max-w-[42%] shrink-0 truncate text-[11px] font-normal"
                        >
                          {opt.secondaryLabel}
                        </span>
                      )}
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
            </div>
          </div>,
          document.body,
        )}

      {hint && !error && <p className="text-faint text-[11px]">{hint}</p>}
      {error && <p className="text-loss text-[11.5px] font-medium">{error}</p>}
    </div>
  );
}
