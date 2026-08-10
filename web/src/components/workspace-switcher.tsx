"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronsUpDown, Plus, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/components/session-provider";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";

import type { HouseholdKind, Tables } from "@/lib/supabase/types";

const KIND_ICON: Record<HouseholdKind, typeof User> = {
  personal: User,
  family: Users,
  business: Building2,
};

/**
 * Workspace switcher for the rail header.
 *
 * The active household is resolved SERVER-side in lib/session.ts from
 * preferences.default_household_id, so updating that row changes nothing on
 * screen by itself — `router.refresh()` is what re-runs the server layout. Without
 * it the user picks a workspace, the toast says it worked, and the rail keeps
 * showing the old one until a hard reload.
 */
export function WorkspaceSwitcher({
  currentName,
  currentId,
  currentKind,
}: {
  currentName: string;
  currentId: string | null;
  currentKind: HouseholdKind | null;
}) {
  const session = useSession();
  const router = useRouter();
  const { showToast } = useToast();
  const supabase = createClient();

  const [open, setOpen] = React.useState(false);
  const [households, setHouseholds] = React.useState<Tables<"households">[]>([]);
  const [switching, setSwitching] = React.useState<string | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);

  // Only fetch the list once the popover is actually opened — the rail mounts on
  // every page and this list is rarely looked at.
  React.useEffect(() => {
    if (!open || households.length > 0) return;
    let active = true;

    supabase
      .from("household_members")
      .select("households(*)")
      .eq("user_id", session.user.id)
      .then(({ data }) => {
        if (!active || !data) return;
        setHouseholds(
          data
            .map((row) => (row as unknown as { households: Tables<"households"> }).households)
            .filter(Boolean),
        );
      });

    return () => {
      active = false;
    };
  }, [open, households.length, session.user.id, supabase]);

  React.useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const switchTo = async (householdId: string) => {
    if (householdId === currentId) {
      setOpen(false);
      return;
    }

    setSwitching(householdId);
    const { error } = await supabase
      .from("preferences")
      .update({ default_household_id: householdId })
      .eq("user_id", session.user.id);
    setSwitching(null);

    if (error) {
      showToast({
        type: "error",
        title: "Could not switch workspace",
        description: error.message,
      });
      return;
    }

    setOpen(false);
    router.refresh();
  };

  const CurrentIcon = currentKind ? KIND_ICON[currentKind] : Users;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "border-navy-700 hover:bg-white/5 flex w-full items-center gap-2 rounded-control border px-2.5 py-2 text-left transition-colors",
          open && "bg-white/5",
        )}
      >
        <span className="bg-brass/15 text-brass flex size-6 shrink-0 items-center justify-center rounded-md">
          <CurrentIcon size={13} strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-on-navy-muted/70 block text-[9.5px] font-semibold uppercase tracking-[0.14em]">
            Workspace
          </span>
          <span className="text-on-navy block truncate text-[12.5px] font-medium">
            {currentName}
          </span>
        </span>
        <ChevronsUpDown size={13} className="text-on-navy-muted shrink-0" />
      </button>

      {open && (
        <div
          role="listbox"
          className="bg-navy-800 border-navy-700 absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-panel border p-1 shadow-xl"
        >
          <div className="max-h-64 overflow-y-auto scrollbar-none">
            {households.length === 0 ? (
              <p className="text-on-navy-muted px-2.5 py-3 text-[11.5px]">
                Loading workspaces…
              </p>
            ) : (
              households.map((h) => {
                const Icon = KIND_ICON[h.kind] ?? Users;
                const isCurrent = h.id === currentId;
                return (
                  <button
                    key={h.id}
                    type="button"
                    role="option"
                    aria-selected={isCurrent}
                    disabled={switching !== null}
                    onClick={() => switchTo(h.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-left transition-colors disabled:opacity-50",
                      isCurrent ? "bg-brass/12" : "hover:bg-white/5",
                    )}
                  >
                    <Icon
                      size={14}
                      strokeWidth={1.75}
                      className={isCurrent ? "text-brass shrink-0" : "text-on-navy-muted shrink-0"}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="text-on-navy block truncate text-[12.5px]">
                        {h.name}
                      </span>
                      <span className="text-on-navy-muted block text-[10px] capitalize">
                        {h.kind}
                      </span>
                    </span>
                    {isCurrent && <Check size={13} className="text-brass shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          <div className="border-navy-700 mt-1 border-t pt-1">
            <Link
              href="/settings/workspaces"
              onClick={() => setOpen(false)}
              className="text-on-navy-muted hover:bg-white/5 hover:text-on-navy flex items-center gap-2.5 rounded-control px-2.5 py-2 text-[12px] transition-colors"
            >
              <Plus size={14} strokeWidth={1.75} className="shrink-0" />
              Create or manage workspaces
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
