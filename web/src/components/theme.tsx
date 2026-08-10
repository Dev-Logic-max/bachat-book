"use client";

import { ThemeProvider, useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

/** Hydration-safe "am I on the client". No effect, so no setState-in-effect. */
const subscribe = () => () => {};
const useMounted = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

/**
 * Surface mode, not accent. DECISIONS.md §1 keeps these on separate axes: the
 * mode owns canvas/surface/rail/text, and brass is the single accent in both.
 *
 * `attribute="data-mode"` matches the `[data-mode="dark"]` selectors in
 * globals.css and the `@custom-variant dark` Tailwind uses.
 */
export function Themes({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="data-mode"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}

/**
 * `variant="rail"` renders for the navy rail, where a cream `bg-surface` pill
 * would punch a light hole in the dark column.
 */
export function ThemeToggle({ variant = "surface" }: { variant?: "surface" | "rail" }) {
  const { resolvedTheme, setTheme } = useTheme();
  // The server cannot know the stored theme, so the icon is only correct once
  // hydrated. Gating on `mounted` keeps server and client markup identical.
  const mounted = useMounted();
  const dark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(dark ? "light" : "dark")}
      className={
        variant === "rail"
          ? "text-on-navy-muted hover:text-on-navy hover:bg-white/5 flex size-7 items-center justify-center rounded-full transition-colors"
          : "border-border bg-surface text-foreground-2 hover:bg-surface-subtle flex size-9 items-center justify-center rounded-full border transition-colors"
      }
    >
      {dark ? <Sun size={14} strokeWidth={1.75} /> : <Moon size={14} strokeWidth={1.75} />}
    </button>
  );
}
