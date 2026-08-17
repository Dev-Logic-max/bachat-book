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
    <div className="mb-4 flex items-center justify-between gap-3 lg:mb-2">
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
  );
}
