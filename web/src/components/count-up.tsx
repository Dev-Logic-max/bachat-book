"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counts a figure up on first paint — SPEC §8 puts this at 800-1000ms, ease-out.
 *
 * `value` is the source of truth and is rendered directly whenever no animation is
 * in flight. That ordering matters: the previous version seeded state with `value`
 * and only ever updated it from inside the animation, so a value that arrived
 * AFTER mount — which is every client-fetched figure in this app — was stuck at
 * whatever the first render passed. With `prefers-reduced-motion: reduce` the
 * animation never runs at all, so the dashboard hero rendered "Rs 0" permanently
 * against a populated KPI row.
 *
 * setState happens only inside the rAF callback, which is the sanctioned escape
 * hatch (CLAUDE.md §Traps — React Compiler bans a synchronous setState in an
 * effect).
 */
export function CountUp({
  value,
  duration = 900,
  format,
  className,
}: {
  value: number;
  duration?: number;
  format: (n: number) => string;
  className?: string;
}) {
  // null = not animating, show `value` as-is.
  const [animated, setAnimated] = useState<number | null>(null);
  const frame = useRef<number>(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (value === 0) return; // nothing to count toward

    const start = performance.now();
    const from = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic — fast then settling, never bouncing past the value
      const eased = 1 - Math.pow(1 - t, 3);
      if (t < 1) {
        setAnimated(from + (value - from) * eased);
        frame.current = requestAnimationFrame(tick);
      } else {
        // Hand control back to `value` so later updates are never stale.
        setAnimated(null);
      }
    };

    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [value, duration]);

  return (
    <span className={className} suppressHydrationWarning>
      {format(animated ?? value)}
    </span>
  );
}
