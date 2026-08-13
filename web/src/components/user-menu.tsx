"use client";

import * as React from "react";
import Link from "next/link";
import { LogOut, Settings, User } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme";
import { Drawer } from "@/components/ui/drawer";
import { useSession } from "@/components/session-provider";
import { signOutAction } from "@/lib/supabase/actions";
import { formatName } from "@/lib/format";

/**
 * The account control, pinned top-right on every screen.
 *
 * On desktop the rail already carries a profile row, but the rail COLLAPSES and
 * does not exist at all below `lg` — so "where do I sign out from" had different
 * answers depending on your window width. This is the one place that never
 * moves.
 *
 * A drawer rather than a dropdown: the same three choices need to work under a
 * thumb on a phone, and one panel is cheaper to keep right than two.
 */
export function UserMenu() {
  const session = useSession();
  const [open, setOpen] = React.useState(false);

  const name = session?.profile
    ? formatName(session.profile.first_name, session.profile.last_name)
    : (session?.user?.email?.split("@")[0] ?? "Your account");
  const email = session?.user?.email ?? "";
  const household = session?.household?.name ?? "Personal Finances";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Your account"
        title={name}
        className="border-border bg-surface hover:bg-surface-subtle shadow-xs flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors"
      >
        <Avatar name={name} src={session?.profile?.avatar_url ?? undefined} size="sm" />
      </button>

      <Drawer
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Your account"
        subtitle={household}
      >
        <div className="space-y-4">
          <div className="bg-surface-subtle border-border flex items-center gap-3 rounded-card border p-3">
            <Avatar
              name={name}
              src={session?.profile?.avatar_url ?? undefined}
              size="md"
            />
            <div className="min-w-0">
              <p className="text-foreground truncate text-[13px] font-semibold">
                {name}
              </p>
              {email && (
                <p className="text-muted truncate text-[11.5px]">{email}</p>
              )}
            </div>
          </div>

          <ul className="space-y-1.5">
            <li>
              <MenuLink
                href="/settings/profile"
                icon={<User size={15} />}
                label="Profile"
                hint="Your name, photo and contact details"
                onNavigate={() => setOpen(false)}
              />
            </li>
            <li>
              <MenuLink
                href="/settings"
                icon={<Settings size={15} />}
                label="Settings"
                hint="Preferences, workspaces, plan and categories"
                onNavigate={() => setOpen(false)}
              />
            </li>
          </ul>

          <div className="border-border flex items-center justify-between gap-3 rounded-card border p-3">
            <span className="min-w-0">
              <span className="text-foreground block text-[12.5px] font-medium">
                Appearance
              </span>
              <span className="text-faint block text-[11px] italic">
                Light, dark or follow your device
              </span>
            </span>
            <ThemeToggle />
          </div>

          {/*
            Sign out is separated and last. Grouped with the navigation links it
            is one mis-tap from ending the session while you were reaching for
            Settings.
          */}
          <button
            type="button"
            onClick={() => signOutAction()}
            className="border-loss/30 text-loss hover:bg-loss-soft flex w-full items-center gap-2.5 rounded-card border p-3 text-left transition-colors"
          >
            <LogOut size={15} className="shrink-0" />
            <span className="text-[12.5px] font-medium">Sign out</span>
          </button>
        </div>
      </Drawer>
    </>
  );
}

function MenuLink({
  href,
  icon,
  label,
  hint,
  onNavigate,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  hint: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="border-border hover:bg-surface-subtle flex items-center gap-3 rounded-card border p-3 transition-colors"
    >
      <span className="bg-surface-subtle text-brass-strong flex size-8 shrink-0 items-center justify-center rounded-full">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="text-foreground block text-[12.5px] font-medium">{label}</span>
        <span className="text-faint block text-[11px] italic leading-snug">{hint}</span>
      </span>
    </Link>
  );
}
