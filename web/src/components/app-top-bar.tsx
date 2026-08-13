"use client";

import { Bell } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { UserMenu } from "@/components/user-menu";

/**
 * The one row that is on every screen at every width.
 *
 * It exists because the rail is not dependable: it collapses to icons on
 * desktop and does not render at all below `lg`, so "where do I sign out" had a
 * different answer depending on the window. The account control now lives in a
 * fixed place.
 *
 * The left side carries the workspace name, which matters most on a phone —
 * that is exactly where the rail's workspace switcher is missing, and posting an
 * expense into the wrong household is not a mistake you notice quickly.
 */
export function AppTopBar() {
  const session = useSession();
  const household = session?.household?.name ?? "Personal Finances";

  return (
    <div className="mb-4 flex items-center justify-between gap-3 lg:mb-2">
      <div className="min-w-0">
        <p className="text-faint text-[10px] font-semibold uppercase tracking-[0.16em]">
          Workspace
        </p>
        <p className="text-foreground-2 truncate text-[12.5px] font-medium">
          {household}
        </p>
      </div>

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
