"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ModalStep {
  id: string;
  title: string;
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  // Multi-step props
  steps?: ModalStep[];
  currentStepIndex?: number;
  onStepChange?: (index: number) => void;
  /**
   * Action row. Rendered in a full-bleed strip pinned below the scrollable body,
   * mirroring the header — pass the buttons alone, not a wrapper with padding.
   */
  footer?: React.ReactNode;
  /**
   * When given, the body AND the footer are wrapped in a single <form>, so a
   * `type="submit"` button in `footer` submits the fields in `children` without
   * needing a `form="…"` id. Passing the buttons through `footer` while leaving
   * the <form> inside `children` would put them outside the form entirely.
   */
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
}

/*
 * Every OPEN modal, innermost last.
 *
 * Modals nest — "Manage categories" opens over a half-filled Add Expense form —
 * and without a stack two things break. Escape reaches every listener at once, so
 * backing out of the inner dialog throws away the form behind it. And the inner
 * one's cleanup ran `overflow: unset` on close, unlocking page scroll while the
 * outer dialog was still up, so the page scrolled behind an open modal.
 *
 * Module scope rather than context: this is a property of the document, and a
 * provider would have to wrap every route to be worth anything.
 */
const MODAL_STACK: string[] = [];

/**
 * Register an overlay on the stack: locks page scroll, and answers Escape only
 * while it is the TOPMOST layer.
 *
 * Exported because Drawer needs identical behaviour. Two independent
 * implementations of "am I on top?" is how a drawer opened over a modal ends up
 * closing both.
 */
export function useOverlayLayer(isOpen: boolean, onClose: () => void) {
  const id = React.useId();

  React.useEffect(() => {
    if (!isOpen) return;

    MODAL_STACK.push(id);
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (MODAL_STACK[MODAL_STACK.length - 1] !== id) return;
      onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      const at = MODAL_STACK.lastIndexOf(id);
      if (at >= 0) MODAL_STACK.splice(at, 1);
      window.removeEventListener("keydown", handleKeyDown);
      // Scroll comes back only once nothing is left open.
      if (MODAL_STACK.length === 0) document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose, id]);

  return id;
}

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  steps,
  currentStepIndex = 0,
  // Reserved for the multi-step flow; the indicator is currently read-only.
  onStepChange: _onStepChange,
  footer,
  onSubmit,
}: ModalProps) {
  const baseId = useOverlayLayer(isOpen, onClose);

  if (!isOpen) return null;

  const hasSteps = steps && steps.length > 0;
  const progressPercent = hasSteps ? ((currentStepIndex + 1) / steps.length) * 100 : 0;
  const titleId = `${baseId}-modal-title`;

  const shellClass = "flex min-h-0 flex-1 flex-col";
  const shellBody = (
    <>
      {/*
        `scroll-hidden`: no visible bar at all. An 8px grey track down the right
        edge of a cream dialog is the loudest thing in it, and the fold plus the
        pinned footer below already say there is more to scroll to.
      */}
      <div className="scroll-hidden flex-1 overflow-y-auto p-5">{children}</div>

      {/* py-2.5 with h-9 buttons = a 56px strip. It was 72px, which made the
          action row heavier than the fields it belongs to. */}
      {footer && (
        <div className="border-border bg-surface-subtle/50 flex shrink-0 items-center justify-end gap-2 border-t px-5 py-2.5">
          {footer}
        </div>
      )}
    </>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      {/* Glassmorphic Backdrop */}
      <div
        className="fixed inset-0 bg-navy-950/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/*
        Modal dialog shell.

        role="dialog" + aria-modal is not decoration. Without it a screen reader
        gives no indication the page behind is inert, and every control on that
        page still answers to a role query — the fields BEHIND the modal are
        indistinguishable from the ones inside it.
      */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "bg-surface border-border relative z-10 w-full max-w-lg rounded-t-modal border shadow-2xl transition-all sm:rounded-modal flex flex-col max-h-[90vh] overflow-hidden",
          "animate-in fade-in-0 zoom-in-95 duration-150",
        )}
      >
        {/* Header */}
        <div className="flex shrink-0 flex-col border-b border-border bg-surface-subtle/50 px-5 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-2.5">
              {icon && (
                <div className="size-8 rounded-full bg-brass/10 text-brass flex items-center justify-center font-bold text-sm shrink-0">
                  {icon}
                </div>
              )}
              <div className="min-w-0">
                <h2
                  id={titleId}
                  className="font-display truncate text-[15px] font-bold tracking-tight text-foreground"
                >
                  {title}
                </h2>
                {subtitle && (
                  <p className="text-muted mt-0.5 text-[11.5px]">{subtitle}</p>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              aria-label="Close"
              className="text-muted hover:text-foreground hover:bg-surface-subtle flex size-7 shrink-0 items-center justify-center rounded-full transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          {/* Multi-Step Indicator */}
          {hasSteps && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-muted">
                <span>
                  Step {currentStepIndex + 1} of {steps.length}: {steps[currentStepIndex]?.title}
                </span>
                <span>{Math.round(progressPercent)}%</span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-brass transition-all duration-300 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/*
          Body + footer share one flex column so the footer is pinned to the
          bottom edge of the dialog and its rule runs the full width, exactly
          like the header — it is NOT part of the `p-6` scroll area.
        */}
        {onSubmit ? (
          <form onSubmit={onSubmit} className={shellClass}>
            {shellBody}
          </form>
        ) : (
          <div className={shellClass}>{shellBody}</div>
        )}
      </div>
    </div>
  );
}
