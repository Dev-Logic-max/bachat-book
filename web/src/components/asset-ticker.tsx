"use client";

import * as React from "react";
import { MerchantMark } from "@/components/merchant-mark";
import { formatPKRCompact } from "@/lib/format";

export type TickerAsset = {
  id: string;
  name: string;
  balancePaisa: number;
  logoPath: string | null;
  brandColor: string | null;
};

/**
 * Cycles through account balances under the hero figure:
 *   "Rs 2,000 in UBL"  ->  3s  ->  "Rs 13,000 in JazzCash"
 *
 * Two rules from CLAUDE.md are load-bearing here:
 *
 * 1. Animation is CSS, not a library. The rotation is a `key`-driven re-mount that
 *    replays a keyframe class.
 * 2. NEVER switch element type on a client-only hook. Reduced motion changes the
 *    animation CLASS and stops the interval; it renders the same <span> tree either
 *    way. Swapping to a different element under `prefers-reduced-motion` is the
 *    hydration mismatch that blanked a whole subtree once already.
 */
export function AssetTicker({ assets }: { assets: TickerAsset[] }) {
  const [index, setIndex] = React.useState(0);
  const reduced = usePrefersReducedMotion();

  const rotating = assets.length > 1 && !reduced;

  React.useEffect(() => {
    if (!rotating) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % assets.length);
    }, 3200);
    return () => window.clearInterval(id);
  }, [rotating, assets.length]);

  // Guard against an account being archived mid-rotation.
  const safeIndex = index % Math.max(1, assets.length);
  const asset = assets[safeIndex];

  if (assets.length === 0) return null;

  // With reduced motion, or a single account, show a static list instead of a
  // rotation the user cannot follow.
  if (!rotating) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {assets.slice(0, 3).map((a) => (
          <AssetLine key={a.id} asset={a} />
        ))}
        {assets.length > 3 && (
          <span className="text-on-navy-muted/70 text-[11.5px]">
            +{assets.length - 3} more
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 flex h-[22px] items-center" aria-live="off">
      {/* `key` remounts the row so the CSS keyframe replays on each rotation. */}
      <span key={asset.id + safeIndex} className="ticker-swap inline-flex">
        <AssetLine asset={asset} />
      </span>
    </div>
  );
}

function AssetLine({ asset }: { asset: TickerAsset }) {
  return (
    <span className="inline-flex items-center gap-2">
      {/*
       * Real institution mark when /public/logos has one, otherwise the
       * brand-coloured monogram MerchantMark already renders. Never a grey box.
       */}
      <MerchantMark
        name={asset.name}
        brand={asset.brandColor || "#1b3563"}
        logo={asset.logoPath ?? undefined}
        size={18}
      />
      <span className="text-on-navy-muted text-[12.5px]">
        <span className="tnum text-on-navy font-medium">
          {formatPKRCompact(asset.balancePaisa)}
        </span>{" "}
        in {asset.name}
      </span>
    </span>
  );
}

/**
 * useSyncExternalStore rather than an effect: React Compiler bans synchronous
 * setState in useEffect, and this also gives a correct server snapshot (false).
 */
function usePrefersReducedMotion(): boolean {
  return React.useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false);
}

function subscribeReducedMotion(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
