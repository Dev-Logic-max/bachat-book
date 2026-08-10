import { defineRouting } from "next-intl/routing";

/**
 * The LAYOUT NEVER MIRRORS. `<html>` stays `dir="ltr"` in every locale, so the
 * rail stays on the left, cards keep their order, and there is exactly one
 * layout to design and screenshot.
 *
 * Urdu changes the TEXT only: strings render right-to-left inside their own
 * box, via `dir="auto"` on copy-bearing elements (see `components/t.tsx`).
 * The earlier build flipped the whole document and produced a second, mirrored
 * dashboard — two layouts to maintain for no gain.
 */
export const routing = defineRouting({
  locales: ["en", "ur"],
  defaultLocale: "en",
});

export type Locale = (typeof routing.locales)[number];

/** Locales whose copy reads right-to-left. Text-level only, never layout. */
export const rtlLocales: ReadonlySet<Locale> = new Set<Locale>(["ur"]);

export const isRtlLocale = (locale: string) =>
  rtlLocales.has(locale as Locale);
