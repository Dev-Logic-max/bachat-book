"use client";

import { Bell } from "lucide-react";
import { UserMenu } from "@/components/user-menu";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";

/**
 * The one row that is on every screen at every width.
 *
 * It exists because the rail is not dependable: it collapses to icons on
 * desktop and does not render at all below `lg`, so "where do I sign out" had a
 * different answer depending on the window. The account control now lives in a
 * fixed place.
 *
 * The left side carries the workspace SWITCHER, not just its name. It used to
 * be a read-only label here and an interactive control in the rail — which
 * collapses on desktop and is absent below `lg`, so on a phone there was no way
 * to change workspace at all, and posting an expense into the wrong household is
 * not a mistake you notice quickly.
 */
export function AppTopBar() {
  return (
    /*
     * A CONSTANT 64px band, flush to the top, ruled off by a hairline.
     *
     * It used to be a bare flex row INSIDE <main>, so <main>'s own
     * `p-4 sm:p-6 lg:p-8` pushed it 16/24/32px down the page and its rule
     * stopped short of both edges — a header inset from the page it heads does
     * not read as chrome. `mb-4 lg:mb-2` then moved the page under it by a
     * different amount again, so two screens side by side started their content
     * on two different lines.
     *
     * 64px is also exactly the rail's own header band, and both are flush to
     * the top, so the two rules run through as one edge across the whole app.
     * Weight above, less below: 64 in the band against <main>'s 20 underneath.
     *
     * STICKY, because the rail is. The workspace you are posting into and the
     * way out of it should not scroll away — that pairing is the one thing on
     * screen that is true of every module.
     */
    <header className="bg-canvas/80 border-border sticky top-0 z-20 shrink-0 border-b backdrop-blur-md">
      {/*
        Inner column matches <main>'s own max-width and side padding, so the
        switcher sits directly above the page title rather than 24px off it —
        while the RULE stays full-bleed and reads as the edge of the chrome.
      */}
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <WorkspaceSwitcher />

        <div className="flex shrink-0 items-center gap-2">
          {/*
            Present and deliberately inert. Reminders are computed and drive the
            colour of every due chip, but nothing delivers them yet — a bell that
            silently never rings would be worse than one that says so.
          */}
          <button
            type="button"
            disabled
            title="Reminders are not delivered yet"
            aria-label="Notifications — not available yet"
            className="border-border bg-surface text-faint flex size-9 shrink-0 cursor-not-allowed items-center justify-center rounded-full border opacity-60"
          >
            <Bell size={15} />
          </button>

          <UserMenu />
        </div>
      </div>
    </header>
  );
}
