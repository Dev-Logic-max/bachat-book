"use client";

import * as React from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Filter controls: a grid on desktop, one button and a sheet below `lg`.
 *
 * Four dropdowns stacked on a phone is four full-width rows — roughly a third of
 * the viewport spent on controls before a single row of data appears. Collapsed
 * to a button, the list starts at the top of the screen where it belongs, and
 * the badge means you never lose track of a filter you forgot you set.
 *
 * The SAME children render in both places, so there is one set of controls to
 * keep correct rather than a desktop set and a mobile set that drift.
 */
export function FilterBar({
  children,
  /** How many filters are away from their default. Drives the badge and Clear. */
  activeCount = 0,
  onClear,
  className,
}: {
  children: React.ReactNode;
  activeCount?: number;
  onClear?: () => void;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <div
        className={cn(
          "hidden gap-3 lg:grid lg:grid-cols-2 xl:grid-cols-4",
          className,
        )}
      >
        {children}
      </div>

      <div className="flex items-center gap-2 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="border-border bg-surface hover:bg-surface-subtle shadow-xs flex h-9 flex-1 items-center justify-center gap-2 rounded-control border text-[12.5px] font-medium transition-colors"
        >
          <SlidersHorizontal size={15} className="text-brass-strong" />
          Filters
          {activeCount > 0 && (
            <span className="bg-brass text-navy-900 tnum rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none">
              {activeCount}
            </span>
          )}
        </button>

        {/* Clearing is reachable without opening the sheet — the badge tells you
            something is filtered, so the fix should be one tap away. */}
        {activeCount > 0 && onClear && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear all filters"
            title="Clear all filters"
            className="border-border bg-surface text-muted hover:text-foreground hover:bg-surface-subtle flex size-9 shrink-0 items-center justify-center rounded-control border transition-colors"
          >
            <X size={15} />
          </button>
        )}
      </div>

      <Drawer
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Filters"
        subtitle={activeCount > 0 ? `${activeCount} applied` : "Narrow the list down"}
        icon={<SlidersHorizontal size={15} />}
      >
        {/*
          The controls filter LIVE, so there is nothing to submit. "Show results"
          would be a button that only closes a panel while pretending to apply
          something — the list behind has already changed.
        */}
        <div className="space-y-3">{children}</div>

        {onClear && (
          <Button
            type="button"
            variant="secondary"
            onClick={onClear}
            disabled={activeCount === 0}
            className="mt-4 w-full"
          >
            Clear all filters
          </Button>
        )}
      </Drawer>
    </>
  );
}
