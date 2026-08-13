"use client";

import * as React from "react";

const KEY = "bb.rail.collapsed";

/**
 * Whether the navigation rail is collapsed to icons.
 *
 * Read through useSyncExternalStore rather than an effect for the usual two
 * reasons — React Compiler bans synchronous setState in useEffect, and this
 * gives an explicit server snapshot. The server cannot know what is in
 * localStorage, so it always renders EXPANDED and React swaps to the stored
 * value on hydration; that is a supported re-render, not a markup mismatch.
 *
 * Nothing else needs to know. The rail is a flex item next to a `flex-1` <main>,
 * so the content area reclaims the width on its own.
 */
export function useRailCollapsed(): [boolean, (next: boolean) => void] {
  const collapsed = React.useSyncExternalStore(subscribe, getSnapshot, () => false);
  return [collapsed, setCollapsed];
}

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Keep two open tabs in step.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    // Private mode, or storage disabled. Expanded is the safe default.
    return false;
  }
}

function setCollapsed(next: boolean) {
  try {
    window.localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    // Ignore — the toggle still works for this session via the notify below.
  }
  for (const l of listeners) l();
}
