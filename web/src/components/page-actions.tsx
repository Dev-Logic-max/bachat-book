"use client";

import * as React from "react";
import { MoreHorizontal } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

import type { LucideIcon } from "lucide-react";

export type PageAction = {
  label: string;
  /** Shown instead of `label` on the narrowest screens. Keep it to one word. */
  shortLabel?: string;
  /** One line under the label in the mobile sheet. Ignored on desktop. */
  hint?: string;
  icon: LucideIcon;
  onClick: () => void;
  /** `primary` renders as the filled navy/brass pill. */
  tone?: "primary" | "default";
  /** Tints the glyph — `gain` for income, `loss` for expense. */
  glyphClass?: string;
  /**
   * Keep this action on screen at EVERY width instead of folding it into the
   * sheet. Defaults to true for `tone: "primary"`.
   */
  alwaysVisible?: boolean;
  disabled?: boolean;
};

/**
 * A page's actions, in the header row.
 *
 * Every action used to collapse into ONE 3-dot button below `lg`. That was the
 * right fix for the wrong problem: the problem was two 90px pills wrapping onto
 * their own line, and the fix took "Add expense" — the single thing most people
 * open this app to do — and buried it two taps deep behind an unlabelled glyph.
 * Most pages here have exactly one action, so on a phone they had a ⋮ menu
 * containing one item.
 *
 * The split now follows FREQUENCY, not width:
 *
 *   ALWAYS VISIBLE — the primary action, plus anything explicitly marked. Real
 *   buttons at every width; icon-only below 380px, where a label would push the
 *   page title out. The glyph carries the meaning there (a red down-arrow and a
 *   green up-arrow are not mistakable for each other) and `title`/`aria-label`
 *   carry the words.
 *   EVERYTHING ELSE — real buttons from `lg` up, and below that the sheet, which
 *   gives each one a line of explanation a 90px pill never had room for.
 *
 * The ⋮ only appears when there is actually something behind it.
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

  const isPinned = (a: PageAction) => a.alwaysVisible ?? a.tone === "primary";
  const pinned = actions.filter(isPinned);
  const overflow = actions.filter((a) => !isPinned(a));

  return (
    <div className={cn("flex shrink-0 items-center gap-2", className)}>
      {/* Pinned: on screen at every width. */}
      {pinned.map((a) => (
        <ActionButton key={a.label} action={a} />
      ))}

      {/* Overflow: real buttons on desktop… */}
      {overflow.map((a) => (
        <span key={a.label} className="hidden lg:block">
          <ActionButton action={a} />
        </span>
      ))}

      {/* …and one button below lg, but only if it has something to hold. */}
      {overflow.length > 0 && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`More ${title} actions`}
          title={`More ${title} actions`}
          className="border-border bg-surface hover:bg-surface-subtle shadow-xs flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors lg:hidden"
        >
          <MoreHorizontal size={16} />
        </button>
      )}

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
          {overflow.map((a) => (
            <li key={a.label}>
              <button
                type="button"
                disabled={a.disabled}
                onClick={() => {
                  setOpen(false);
                  a.onClick();
                }}
                className="border-border hover:bg-surface-subtle flex w-full items-center gap-3 rounded-card border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50"
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
    </div>
  );
}

/**
 * One action as a real button.
 *
 * Below 380px it is a 36px square holding only the glyph — the label is in
 * `title` and `aria-label`, so it is still announced and still hoverable, but it
 * cannot squeeze the page title off its own header row.
 */
function ActionButton({ action: a }: { action: PageAction }) {
  const isPrimary = a.tone === "primary";

  return (
    <button
      type="button"
      onClick={a.onClick}
      disabled={a.disabled}
      title={a.label}
      aria-label={a.label}
      className={cn(
        "flex h-9 shrink-0 items-center justify-center gap-1.5 text-[12.5px] font-medium transition-colors",
        // Square only on the very narrowest phones, where words would squeeze
        // the page title off its own row.
        "w-9 rounded-full px-0 min-[380px]:w-auto min-[380px]:rounded-control min-[380px]:px-3.5",
        isPrimary
          ? "bg-navy-900 text-on-navy dark:bg-brass dark:text-navy-900 min-[380px]:rounded-full transition-transform active:scale-95"
          : "border-border bg-surface hover:bg-surface-subtle shadow-xs border",
        "disabled:cursor-not-allowed disabled:opacity-50",
      )}
    >
      <a.icon size={15} className={isPrimary ? "" : a.glyphClass} />
      <span className="hidden min-[380px]:inline">{a.shortLabel ?? a.label}</span>
    </button>
  );
}
