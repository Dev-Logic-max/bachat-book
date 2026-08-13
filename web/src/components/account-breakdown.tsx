"use client";

import * as React from "react";
import { MerchantMark } from "@/components/merchant-mark";
import { formatPKR } from "@/lib/format";
import { institutionLogo } from "@/lib/ledger";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/utils";

import type { Tables } from "@/lib/supabase/types";

export type BreakdownSlice = {
  id: string;
  name: string;
  amountPaisa: number;
  logo: string | null;
  brand: string;
  awaitingLogo: boolean;
};

/**
 * Splits a total across the accounts that make it up.
 *
 * A summary figure answers "how much"; this answers "where", which is the
 * question that actually comes next — "Rs 35,000 logged in" is only useful once
 * you know Rs 25,000 of it landed in JazzCash and Rs 10,000 in cash. Same idea
 * as the dashboard's asset ticker, sized for a light stat card rather than the
 * navy hero band.
 *
 * Rotation is a `key`-driven remount replaying a CSS keyframe — animation here is
 * CSS, never a library.
 */
export function AccountBreakdown({
  slices,
  /** "in" for money that arrived, "from" for money that left, "held in" for balances. */
  preposition = "in",
  className,
}: {
  slices: BreakdownSlice[];
  preposition?: string;
  className?: string;
}) {
  const [index, setIndex] = React.useState(0);
  const reduced = usePrefersReducedMotion();
  const rotating = slices.length > 1 && !reduced;

  React.useEffect(() => {
    if (!rotating) return;
    const id = window.setInterval(() => {
      setIndex((i) => i + 1);
    }, 3000);
    return () => window.clearInterval(id);
  }, [rotating, slices.length]);

  if (slices.length === 0) return null;

  /*
   * Modulo at READ time, never stored. The filters above this can shrink the
   * list while the interval is mid-cycle, and an index held in state would then
   * point past the end and render nothing at all.
   */
  const safeIndex = index % slices.length;
  const slice = slices[safeIndex];

  // With reduced motion, or a single account, show the one line statically —
  // rotation nobody can follow is worse than no rotation.
  if (!rotating) {
    return (
      <div className={cn("mt-2 space-y-1", className)}>
        {slices.slice(0, 2).map((s) => (
          <SliceLine key={s.id} slice={s} preposition={preposition} />
        ))}
        {slices.length > 2 && (
          <p className="text-faint text-[10.5px]">+{slices.length - 2} more</p>
        )}
      </div>
    );
  }

  return (
    <div className={cn("mt-2 flex h-[18px] items-center gap-2", className)}>
      <span key={slice.id + safeIndex} className="ticker-swap min-w-0 flex-1">
        <SliceLine slice={slice} preposition={preposition} />
      </span>

      {/* Which of N you are looking at — otherwise the line just flickers. */}
      <span className="flex shrink-0 items-center gap-1" aria-hidden>
        {slices.map((s, i) => (
          <span
            key={s.id}
            className={cn(
              "block size-1 rounded-full transition-colors",
              i === safeIndex ? "bg-brass" : "bg-border-strong",
            )}
          />
        ))}
      </span>
    </div>
  );
}

function SliceLine({
  slice,
  preposition,
}: {
  slice: BreakdownSlice;
  preposition: string;
}) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <MerchantMark
        name={slice.name}
        brand={slice.brand}
        logo={slice.logo ?? undefined}
        awaitingLogo={slice.awaitingLogo}
        size={14}
      />
      <span className="text-muted min-w-0 truncate text-[11px]">
        <span className="tnum text-foreground-2 font-medium">
          {formatPKR(Math.abs(slice.amountPaisa))}
        </span>{" "}
        {preposition} {slice.name}
      </span>
    </span>
  );
}

/**
 * Rolls per-account totals into slices, largest first, dropping zeroes.
 *
 * Zero-value accounts are dropped rather than shown: an account that took no
 * part in the figure above is noise in a rotation, and with three of them the
 * one line that matters is off screen most of the time.
 */
export function buildSlices(
  totalsByAccount: Map<string, number>,
  accounts: Array<Tables<"accounts"> & { institutions?: Tables<"institutions"> | null }>,
): BreakdownSlice[] {
  const byId = new Map(accounts.map((a) => [a.id, a]));

  return [...totalsByAccount.entries()]
    .filter(([, amount]) => amount !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .map(([accountId, amountPaisa]) => {
      const account = byId.get(accountId);
      const inst = account?.institutions ?? null;
      return {
        id: accountId,
        name: account?.name ?? "Deleted account",
        amountPaisa,
        logo: institutionLogo(inst?.logo_path),
        brand: inst?.brand_color ?? "#16233a",
        awaitingLogo: Boolean(inst && !inst.logo_path),
      };
    });
}
