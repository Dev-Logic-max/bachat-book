"use client";

import * as React from "react";

/**
 * `prefers-reduced-motion: reduce`, as a hook.
 *
 * useSyncExternalStore rather than an effect for two reasons: React Compiler
 * bans synchronous setState in useEffect, and this gives a correct server
 * snapshot (false) so the first client render matches the HTML.
 *
 * NEVER use the result to switch element TYPE — only classes, intervals and
 * other attributes. Rendering `div` vs `motion.div` off a client-only value is a
 * hydration mismatch, and React drops the whole subtree when it hits one
 * (CLAUDE.md §Traps — it once rendered a header over empty canvas).
 */
export function usePrefersReducedMotion(): boolean {
  return React.useSyncExternalStore(subscribe, getSnapshot, () => false);
}

function subscribe(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getSnapshot() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
