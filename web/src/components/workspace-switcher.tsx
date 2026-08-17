"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Check,
  ChevronsUpDown,
  EyeOff,
  Plus,
  Settings2,
  User,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover } from "@/components/ui/popover";
import { useSession } from "@/components/session-provider";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { formatLimit, isUnlimited, type WorkspaceAccess } from "@/lib/plan";

import type { HouseholdKind } from "@/lib/supabase/types";

const KIND_ICON: Record<HouseholdKind, typeof User> = {
  personal: User,
  family: Users,
  business: Building2,
};

/**
 * Workspace switcher, now in the top bar rather than the rail.
 *
 * It lived in the rail, which collapses on desktop and does not render at all
 * below `lg` — so on a phone there was no way to tell which workspace you were
 * posting into, and posting an expense into the wrong household is not a mistake
 * you notice quickly.
 *
 * Reads `workspace_access`, which already resolves rank, read-only state, the
 * effective plan and seat usage in one query. Building that in the client would
 * mean re-deriving the entitlement rules in a second place.
 *
 * The active workspace is resolved SERVER-side from
 * preferences.default_household_id, so updating that row changes nothing on
 * screen by itself — `router.refresh()` is what re-runs the server layout.
 */
export function WorkspaceSwitcher() {
  const session = useSession();
  const router = useRouter();
  const { showToast } = useToast();
  const supabase = createClient();

  const [rows, setRows] = React.useState<WorkspaceAccess[] | null>(null);
  const [switching, setSwitching] = React.useState(false);

  const currentId = session?.household?.id ?? null;
  const currentName = session?.household?.name ?? "Personal Finances";
  const currentKind = session?.household?.kind ?? null;
  const current = session?.workspace ?? null;

  // Fetched once the panel is opened rather than on every page mount: the rail
  // used to load this list on every screen and it is rarely looked at.
  const loadWorkspaces = React.useCallback(async () => {
    const { data, error } = await supabase
      .from("workspace_access")
      .select("*")
      .order("owner_rank");

    if (error) {
      showToast({
        type: "error",
        title: "Could not load workspaces",
        description: error.message,
      });
      setRows([]);
      return;
    }
    setRows(data ?? []);
  }, [supabase, showToast]);

  const switchTo = async (id: string, close: () => void) => {
    if (id === currentId) {
      close();
      return;
    }

    setSwitching(true);
    const { error } = await supabase
      .from("preferences")
      .update({ default_household_id: id })
      .eq("user_id", session.user.id);
    setSwitching(false);

    if (error) {
      showToast({
        type: "error",
        title: "Could not switch workspace",
        description: error.message,
      });
      return;
    }

    close();
    router.refresh();
  };

  const CurrentIcon = currentKind ? KIND_ICON[currentKind] : Users;

  // Only workspaces you OWN count against the allowance; ones you were invited
  // into belong to someone else's plan.
  const owned = rows?.filter((r) => r.owner_id === session.user.id) ?? [];
  const limit = current?.workspace_limit ?? 2;
  const atLimit = !isUnlimited(limit) && owned.length >= limit;

  return (
    <Popover
      align="start"
      width={300}
      triggerLabel="Switch workspace"
      triggerClassName="border-border bg-surface hover:bg-surface-subtle shadow-xs flex min-w-0 max-w-[240px] items-center gap-2 rounded-control border px-2 py-1.5 text-left transition-colors"
      trigger={
        <>
          <span className="bg-brass-soft text-brass-strong flex size-6 shrink-0 items-center justify-center rounded-md">
            <CurrentIcon size={13} strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-faint block text-[9px] font-semibold uppercase tracking-[0.14em] leading-tight">
              Workspace
            </span>
            <span className="text-foreground block truncate text-[12.5px] font-medium leading-tight">
              {currentName}
            </span>
          </span>
          {current && !current.is_active && (
            <span className="bg-loss-soft text-loss shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold">
              View only
            </span>
          )}
          <ChevronsUpDown size={13} className="text-faint shrink-0" />
        </>
      }
    >
      {({ close }) => (
        <WorkspacePanel
          rows={rows}
          onMount={loadWorkspaces}
          currentId={currentId}
          switching={switching}
          onSwitch={(id) => switchTo(id, close)}
          ownedCount={owned.length}
          limit={limit}
          atLimit={atLimit}
          onNavigate={(href) => {
            close();
            router.push(href);
          }}
        />
      )}
    </Popover>
  );
}

function WorkspacePanel({
  rows,
  onMount,
  currentId,
  switching,
  onSwitch,
  ownedCount,
  limit,
  atLimit,
  onNavigate,
}: {
  rows: WorkspaceAccess[] | null;
  onMount: () => void;
  currentId: string | null;
  switching: boolean;
  onSwitch: (id: string) => void;
  ownedCount: number;
  limit: number;
  atLimit: boolean;
  onNavigate: (href: string) => void;
}) {
  // The fetch is kicked off by the panel mounting, which only happens when the
  // popover opens. Guarded so a re-render does not refetch.
  const started = React.useRef(false);
  React.useEffect(() => {
    if (started.current) return;
    started.current = true;
    onMount();
  }, [onMount]);

  return (
    <>
      <div className="scroll-hidden max-h-72 overflow-y-auto">
        {rows === null ? (
          <p className="text-muted px-2.5 py-3 text-[11.5px]">Loading workspaces…</p>
        ) : rows.length === 0 ? (
          <p className="text-muted px-2.5 py-3 text-[11.5px]">No workspaces yet.</p>
        ) : (
          rows.map((w) => {
            const Icon = KIND_ICON[w.kind] ?? Users;
            const isCurrent = w.id === currentId;
            return (
              <button
                key={w.id}
                type="button"
                role="menuitem"
                disabled={switching}
                onClick={() => onSwitch(w.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-left transition-colors disabled:opacity-50",
                  isCurrent ? "bg-brass-soft" : "hover:bg-surface-subtle",
                )}
              >
                <Icon
                  size={14}
                  strokeWidth={1.75}
                  className={cn("shrink-0", isCurrent ? "text-brass-strong" : "text-muted")}
                />
                <span className="min-w-0 flex-1">
                  <span className="text-foreground block truncate text-[12.5px] leading-tight">
                    {w.name}
                  </span>
                  <span className="text-faint block text-[10px] capitalize leading-tight">
                    {w.kind}
                    {w.plan_code === "pro" && " · Pro"}
                    {w.member_count > 1 && ` · ${w.member_count} members`}
                  </span>
                </span>
                {/*
                  A read-only workspace is LISTED, marked, and still switchable
                  to. Hiding it would read as data loss — everything inside is
                  intact and still readable.
                */}
                {!w.is_active && (
                  <span
                    title="View only on your current plan"
                    className="bg-loss-soft text-loss flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold"
                  >
                    <EyeOff size={9} />
                    View only
                  </span>
                )}
                {isCurrent && w.is_active && (
                  <Check size={13} className="text-brass-strong shrink-0" />
                )}
              </button>
            );
          })
        )}
      </div>

      <div className="border-border mt-1 border-t pt-1">
        <div className="flex items-center justify-between px-2.5 py-1.5">
          <span className="text-faint text-[10px] font-medium">
            {ownedCount} of {formatLimit(limit)} workspaces
          </span>
          {atLimit && (
            <button
              type="button"
              onClick={() => onNavigate("/settings/plan")}
              className="text-brass-strong text-[10px] font-semibold hover:underline"
            >
              Upgrade
            </button>
          )}
        </div>

        <button
          type="button"
          role="menuitem"
          onClick={() => onNavigate("/settings/workspaces")}
          className="text-foreground-2 hover:bg-surface-subtle flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-[12px] transition-colors"
        >
          {atLimit ? (
            <Settings2 size={14} strokeWidth={1.75} className="shrink-0" />
          ) : (
            <Plus size={14} strokeWidth={1.75} className="shrink-0" />
          )}
          {atLimit ? "Manage workspaces" : "Create or manage workspaces"}
        </button>
      </div>
    </>
  );
}
