"use client";

import * as React from "react";
import { X } from "lucide-react";
import { useOverlayLayer } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

/**
 * A panel that slides in from the edge.
 *
 * Used where a Modal would be the wrong shape: a LIST of choices rather than a
 * form. A centred dialog announces "stop and fill this in"; a drawer announces
 * "pick one and carry on", which is what an actions or filters menu is.
 *
 * Header only, never a footer. Every row inside is itself the confirm — a
 * footer would add a second button that does nothing the rows do not.
 *
 * Shares Modal's overlay stack, so a drawer opened over a dialog answers Escape
 * on its own and page scroll is restored only when the last layer closes.
 */
export function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  side = "right",
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  /** `bottom` below `sm` regardless — a right panel on a phone is a modal. */
  side?: "right" | "left";
  children: React.ReactNode;
}) {
  const baseId = useOverlayLayer(isOpen, onClose);
  if (!isOpen) return null;

  const titleId = `${baseId}-drawer-title`;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="bg-navy-950/70 animate-in fade-in-0 fixed inset-0 backdrop-blur-xs duration-150"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "bg-surface border-border absolute flex flex-col shadow-2xl",
          // Phone: a bottom sheet, because a 320px side panel on a 390px screen
          // is a modal wearing a drawer's clothes.
          "inset-x-0 bottom-0 max-h-[85vh] rounded-t-modal border-t",
          "animate-in slide-in-from-bottom-4 duration-200",
          // Tablet and up: a real edge panel, full height.
          side === "right"
            ? "sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[22rem] sm:rounded-none sm:rounded-l-modal sm:border-l sm:border-t-0 sm:slide-in-from-right-4"
            : "sm:inset-y-0 sm:right-auto sm:left-0 sm:max-h-none sm:w-[22rem] sm:rounded-none sm:rounded-r-modal sm:border-r sm:border-t-0 sm:slide-in-from-left-4",
        )}
      >
        <header className="border-border bg-surface-subtle/50 flex shrink-0 items-center gap-2.5 border-b px-4 py-3">
          {icon && (
            <span className="bg-brass/10 text-brass flex size-8 shrink-0 items-center justify-center rounded-full">
              {icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="font-display truncate text-[15px] font-bold tracking-tight"
            >
              {title}
            </h2>
            {subtitle && (
              <p className="text-muted mt-0.5 truncate text-[11.5px]">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted hover:text-foreground hover:bg-surface-subtle flex size-7 shrink-0 items-center justify-center rounded-full transition-colors"
          >
            <X size={15} />
          </button>
        </header>

        <div className="scroll-hidden flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
