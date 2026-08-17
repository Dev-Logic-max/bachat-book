"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut, Settings, User } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Popover, PopoverItem } from "@/components/ui/popover";
import { useSession } from "@/components/session-provider";
import { signOutAction } from "@/lib/supabase/actions";
import { formatName } from "@/lib/format";
import { daysUntil, expiryTone, periodEndsAt, subscriptionLabel } from "@/lib/plan";
import { cn } from "@/lib/utils";

/**
 * The account control, pinned top-right on every screen.
 *
 * A small panel under the avatar rather than the full-height drawer this used to
 * be: three destinations do not need a sheet, and a drawer covering the page to
 * offer "Profile / Settings / Sign out" reads as heavier than the choice is.
 *
 * Appearance is gone from here. It was duplicated — the theme toggle already
 * lives in Settings → Preferences and in the rail footer — and a menu is easier
 * to read when every row is a destination rather than a mix of links and
 * controls.
 */
export function UserMenu() {
  const session = useSession();
  const router = useRouter();

  const name = session?.profile
    ? formatName(session.profile.first_name, session.profile.last_name)
    : (session?.user?.email?.split("@")[0] ?? "Your account");
  const email = session?.user?.email ?? "";

  const planCode = session?.workspace?.plan_code ?? "free";
  const statusLabel = subscriptionLabel(session?.subscription ?? null, planCode);
  const days = daysUntil(periodEndsAt(session?.subscription ?? null));
  const tone = expiryTone(days);

  return (
    <Popover
      align="end"
      width={272}
      triggerLabel="Your account"
      triggerClassName="border-border bg-surface hover:bg-surface-subtle shadow-xs flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors"
      trigger={
        <Avatar name={name} src={session?.profile?.avatar_url ?? undefined} size="sm" />
      }
    >
      {({ close }) => (
        <>
          <div className="flex items-center gap-2.5 px-2 py-2">
            <Avatar
              name={name}
              src={session?.profile?.avatar_url ?? undefined}
              size="md"
            />
            <div className="min-w-0">
              <p className="text-foreground truncate text-[13px] font-semibold leading-tight">
                {name}
              </p>
              {email && <p className="text-muted truncate text-[11px]">{email}</p>}
            </div>
          </div>

          {/*
            The plan sits in the menu because this is where people look when they
            want to know "what am I on" — and because a trial that is running out
            should be visible without going hunting for it.
          */}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              router.push("/settings/plan");
            }}
            className="bg-surface-subtle hover:bg-surface-3 border-border mx-0.5 mb-1 flex w-[calc(100%-4px)] items-center justify-between gap-2 rounded-control border px-2.5 py-1.5 transition-colors"
          >
            <span className="text-faint text-[10px] font-semibold uppercase tracking-[0.12em]">
              {planCode === "pro" ? "Bachat Pro" : "Bachat"}
            </span>
            <span
              className={cn(
                "text-[10.5px] font-semibold tabular-nums",
                tone === "expired" && "text-loss",
                tone === "urgent" && "text-loss",
                tone === "soon" && "text-brass-strong",
                tone === "fine" && "text-muted",
              )}
            >
              {days !== null && days > 0
                ? `${statusLabel} · ${days}d left`
                : statusLabel}
            </span>
          </button>

          <PopoverItem
            icon={<User size={14} />}
            label="Profile"
            hint="Name, photo and contact details"
            onClick={() => {
              close();
              router.push("/settings/profile");
            }}
          />
          <PopoverItem
            icon={<Settings size={14} />}
            label="Settings"
            hint="Preferences, workspaces and plan"
            onClick={() => {
              close();
              router.push("/settings");
            }}
          />

          {/*
            Separated and last. Grouped with the links it is one mis-tap from
            ending the session while reaching for Settings.
          */}
          <div className="border-border mt-1 border-t pt-1">
            <PopoverItem
              icon={<LogOut size={14} />}
              label="Sign out"
              tone="danger"
              onClick={() => signOutAction()}
            />
          </div>
        </>
      )}
    </Popover>
  );
}
