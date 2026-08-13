"use client";

import * as React from "react";
import { MoreVertical } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

import type { LucideIcon } from "lucide-react";

export type PageAction = {
  label: string;
  /** One line under the label in the mobile sheet. Ignored on desktop. */
  hint?: string;
  icon: LucideIcon;
  onClick: () => void;
  /** `primary` renders as the filled navy/brass pill on desktop. */
  tone?: "primary" | "default";
  /** Tints the glyph — `gain` for income, `loss` for expense. */
  glyphClass?: string;
};

/**
 * A page's actions, in the header row.
 *
 * Desktop keeps them as real buttons — they are the point of the page and there
 * is room. Below `lg` they collapse into ONE 3-dot button beside the title and
 * open as a sheet.
 *
 * The reason is width, not taste: "Transfer" + "Add Transaction" side by side
 * wrapped onto their own line on a phone, pushing the whole page down by a row
 * before anything useful was on screen. A sheet also gives each action a line of
 * explanation, which a 90px pill never had room for.
 */
export function PageActions({
  title,
  actions,
  className,
}: {
  /** Sheet heading — the module name, e.g. "Entries". */
  title: string;
  actions: PageAction[];
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);

  if (actions.length === 0) return null;

  return (
    <>
      {/* Desktop: the real buttons. */}
      <div className={cn("hidden shrink-0 items-center gap-2.5 lg:flex", className)}>
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={a.onClick}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-control px-3.5 text-[12.5px] font-medium transition-colors",
              a.tone === "primary"
                ? "bg-navy-900 text-on-navy dark:bg-brass dark:text-navy-900 rounded-full transition-transform active:scale-95"
                : "border-border bg-surface hover:bg-surface-subtle shadow-xs border",
            )}
          >
            <a.icon size={15} className={a.tone === "primary" ? "" : a.glyphClass} />
            {a.label}
          </button>
        ))}
      </div>

      {/* Below lg: one button, on the title's row. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${title} actions`}
        title={`${title} actions`}
        className="border-border bg-surface hover:bg-surface-subtle shadow-xs flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors lg:hidden"
      >
        <MoreVertical size={16} />
      </button>

      {/*
        A DRAWER, not a dialog. This is a list of choices, not a form to fill
        in — and a panel from the edge leaves the page visible behind it, so you
        can still see what you were looking at when you picked.
      */}
      <Drawer
        isOpen={open}
        onClose={() => setOpen(false)}
        title={title}
        subtitle="What would you like to do?"
      >
        <ul className="space-y-2">
          {actions.map((a) => (
            <li key={a.label}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  a.onClick();
                }}
                className="border-border hover:bg-surface-subtle flex w-full items-center gap-3 rounded-card border p-3 text-left transition-colors"
              >
                <span
                  className={cn(
                    "bg-surface-subtle flex size-9 shrink-0 items-center justify-center rounded-full",
                    a.glyphClass ?? "text-brass-strong",
                  )}
                >
                  <a.icon size={16} />
                </span>
                <span className="min-w-0">
                  <span className="text-foreground block text-[13px] font-medium">
                    {a.label}
                  </span>
                  {a.hint && (
                    <span className="text-faint mt-0.5 block text-[11px] italic leading-snug">
                      {a.hint}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Drawer>
    </>
  );
}
