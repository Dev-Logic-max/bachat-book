"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

import type { LucideIcon } from "lucide-react";

/**
 * The shell every error and empty-route screen is built from.
 *
 * One component so a 404, a crashed render and a permission wall read as three
 * states of the same product rather than three different websites. What changes
 * between them is the glyph, the sentence and the way out — never the layout.
 *
 * Copy rules, applied at every call site below:
 *   · say what happened in plain words, never a status code as the headline
 *   · never apologise, never blame the user
 *   · always offer a way forward that is not the browser's back button
 */
export function StatusPage({
  code,
  icon: Icon,
  title,
  description,
  detail,
  actions,
  tone = "neutral",
}: {
  /** Shown small, above the title. Context, not the message. */
  code?: string;
  icon: LucideIcon;
  title: string;
  description: string;
  /** Technical text — a digest or message. Monospaced and de-emphasised. */
  detail?: string;
  actions: React.ReactNode;
  tone?: "neutral" | "loss";
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        <span
          className={cn(
            "mx-auto flex size-14 items-center justify-center rounded-full",
            tone === "loss" ? "bg-loss-soft text-loss" : "bg-brass-soft text-brass-strong",
          )}
        >
          <Icon size={24} strokeWidth={1.6} />
        </span>

        {code && (
          <p className="text-faint tnum mt-5 text-[11px] font-semibold uppercase tracking-[0.18em]">
            {code}
          </p>
        )}

        <h1 className="font-display mt-2 text-[22px] font-semibold tracking-[-0.02em]">
          {title}
        </h1>

        <p className="text-muted mx-auto mt-2 max-w-sm text-[13px] leading-relaxed">
          {description}
        </p>

        {detail && (
          <p className="border-border bg-surface-subtle text-faint mt-4 truncate rounded-control border px-3 py-2 font-mono text-[11px]">
            {detail}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          {actions}
        </div>
      </div>
    </div>
  );
}

/** Filled action. A link, because most ways out of an error are navigations. */
export function StatusLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="bg-navy-900 text-on-navy dark:bg-brass dark:text-navy-900 flex h-9 items-center gap-1.5 rounded-control px-3.5 text-[12.5px] font-medium transition-transform active:scale-95"
    >
      {children}
    </Link>
  );
}

/** Secondary action — retry, reload, go back. */
export function StatusButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-border bg-surface hover:bg-surface-subtle shadow-xs flex h-9 items-center gap-1.5 rounded-control border px-3.5 text-[12.5px] font-medium transition-colors"
    >
      {children}
    </button>
  );
}
