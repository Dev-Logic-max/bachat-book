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
  const baseId = React.useId();

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const hasSteps = steps && steps.length > 0;
  const progressPercent = hasSteps ? ((currentStepIndex + 1) / steps.length) * 100 : 0;
  const titleId = `${baseId}-modal-title`;

  const shellClass = "flex min-h-0 flex-1 flex-col";
  const shellBody = (
    <>
      <div className="flex-1 overflow-y-auto p-6">{children}</div>

      {footer && (
        <div className="border-border bg-surface-subtle/50 flex shrink-0 items-center justify-end gap-3 border-t px-6 py-4">
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
        <div className="flex shrink-0 flex-col border-b border-border bg-surface-subtle/50 px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {icon && (
                <div className="w-9 h-9 rounded-full bg-brass/10 text-brass flex items-center justify-center font-bold text-sm shrink-0">
                  {icon}
                </div>
              )}
              <div>
                <h2
                  id={titleId}
                  className="font-display text-base font-bold tracking-tight text-foreground"
                >
                  {title}
                </h2>
                {subtitle && (
                  <p className="text-muted text-xs mt-0.5">{subtitle}</p>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              className="text-muted hover:text-foreground hover:bg-surface-subtle flex h-8 w-8 items-center justify-center rounded-full transition-colors"
            >
              <X size={16} />
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
