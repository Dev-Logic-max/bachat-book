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
  footer?: React.ReactNode;
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
}: ModalProps) {
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      {/* Glassmorphic Backdrop */}
      <div
        className="fixed inset-0 bg-navy-950/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog Shell */}
      <div
        className={cn(
          "bg-surface border-border relative z-10 w-full max-w-lg rounded-t-modal border shadow-2xl transition-all sm:rounded-modal flex flex-col max-h-[90vh] overflow-hidden",
          "animate-in fade-in-0 zoom-in-95 duration-150",
        )}
      >
        {/* Header */}
        <div className="flex flex-col border-b border-border bg-surface-subtle/50 px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {icon && (
                <div className="w-9 h-9 rounded-full bg-brass/10 text-brass flex items-center justify-center font-bold text-sm shrink-0">
                  {icon}
                </div>
              )}
              <div>
                <h2 className="font-display text-base font-bold tracking-tight text-foreground">
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

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto flex-1">{children}</div>

        {/* Footer (If Provided) */}
        {footer && (
          <div className="border-t border-border bg-surface-subtle/30 px-6 py-4 flex items-center justify-between gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
