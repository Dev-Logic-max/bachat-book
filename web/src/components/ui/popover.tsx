"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type Align = "start" | "end";

type PopoverProps = {
  /** Visual content of the trigger. Popover owns the <button> and its ref. */
  trigger: React.ReactNode;
  triggerClassName?: string;
  triggerLabel: string;
  /** Receives `close` so an item can dismiss the panel after acting. */
  children: (helpers: { close: () => void }) => React.ReactNode;
  align?: Align;
  width?: number;
  className?: string;
};

/**
 * A small panel anchored under its trigger.
 *
 * Three things here are load-bearing, all learned elsewhere in this codebase:
 *
 * 1. **Portal + fixed positioning.** Absolutely positioned, the panel is clipped
 *    by any `overflow` ancestor — and the top bar sits inside exactly such a
 *    container.
 * 2. **Escape is caught in the CAPTURE phase and stopped.** `Modal` listens for
 *    Escape while bubbling on `window`, so without this a popover opened inside
 *    a dialog would dismiss the dialog too and throw away a part-filled form.
 *    Capture on `document` runs before `window`'s bubble listener, and
 *    `stopPropagation` there halts the rest of the trip.
 * 3. **Refocus intent is STATE; the `.focus()` call happens in an effect.**
 *    `react-hooks/refs` is an error here and fires transitively — any handler
 *    passed as a prop that can reach `ref.current`, however indirectly, fails
 *    the build.
 *
 * It deliberately does NOT lock page scroll or join the modal stack: this is a
 * menu, not a dialog, and a menu that freezes the page behind it feels broken.
 */
export function Popover({
  trigger,
  triggerClassName,
  triggerLabel,
  children,
  align = "end",
  width = 264,
  className,
}: PopoverProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const [pendingRefocus, setPendingRefocus] = React.useState(false);

  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  const measure = React.useCallback(() => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
  }, []);

  const close = React.useCallback((refocus = true) => {
    setPendingRefocus(refocus);
    setIsOpen(false);
  }, []);

  const toggle = () => {
    if (isOpen) {
      close();
      return;
    }
    measure();
    // Cleared on open rather than in the effect below, which keeps that effect
    // free of a synchronous setState — React Compiler rejects those.
    setPendingRefocus(false);
    setIsOpen(true);
  };

  React.useEffect(() => {
    if (isOpen || !pendingRefocus) return;
    triggerRef.current?.focus();
  }, [isOpen, pendingRefocus]);

  React.useEffect(() => {
    if (!isOpen) return;

    const onScrollOrResize = () => measure();
    // `true` also catches scrolls on ancestor containers, not just the window.
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);

    const onPointerDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !panelRef.current?.contains(t)) {
        close(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Both are needed. React attaches at the root container, so
      // stopPropagation alone still lets the key reach listeners already bound
      // on the same node.
      e.stopPropagation();
      e.stopImmediatePropagation();
      close();
    };
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [isOpen, measure, close]);

  const panelStyle = React.useMemo((): React.CSSProperties | null => {
    if (!rect) return null;

    const margin = 8;
    const w = Math.min(width, window.innerWidth - margin * 2);
    // Anchor to the chosen edge, then nudge back inside the viewport. A menu
    // hanging off a right-aligned avatar would otherwise overflow the page.
    const raw = align === "end" ? rect.right - w : rect.left;
    const left = Math.min(Math.max(margin, raw), window.innerWidth - w - margin);

    return {
      position: "fixed",
      top: rect.bottom + 6,
      left,
      width: w,
      maxHeight: window.innerHeight - rect.bottom - 20,
      zIndex: 60,
    };
  }, [rect, align, width]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={triggerLabel}
        className={triggerClassName}
      >
        {trigger}
      </button>

      {isOpen &&
        panelStyle &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            aria-label={triggerLabel}
            style={panelStyle}
            className={cn(
              "bg-surface border-border rounded-panel scroll-hidden overflow-y-auto border p-1.5 shadow-xl",
              "origin-top animate-[popover-in_120ms_ease-out]",
              className,
            )}
          >
            {children({ close })}
          </div>,
          document.body,
        )}
    </>
  );
}

/** Shared row inside a popover — link or button, same shape either way. */
export function PopoverItem({
  icon,
  label,
  hint,
  onClick,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick?: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-left transition-colors",
        tone === "danger"
          ? "text-loss hover:bg-loss-soft"
          : "text-foreground hover:bg-surface-subtle",
      )}
    >
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full",
          tone === "danger" ? "bg-loss-soft text-loss" : "bg-surface-subtle text-brass-strong",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[12.5px] font-medium leading-tight">{label}</span>
        {hint && <span className="text-faint block text-[10.5px] leading-snug">{hint}</span>}
      </span>
    </button>
  );
}
