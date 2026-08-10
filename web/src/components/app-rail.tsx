"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  Bot,
  CalendarDays,
  CircleDollarSign,
  FileSpreadsheet,
  HandHeart,
  Landmark,
  LayoutDashboard,
  ListChecks,
  LogOut,
  NotebookPen,
  PieChart,
  ScanLine,
  Settings,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/lib/supabase/actions";
import { Avatar } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { formatName } from "@/lib/format";

import type { LucideIcon } from "lucide-react";
import type { UserSession } from "@/lib/session";

export function AppRail({ session }: { session?: UserSession | null }) {
  const pathname = usePathname();

  const PRIMARY = [
    { icon: LayoutDashboard, label: "Overview", href: "/dashboard" },
    { icon: Bot, label: "AI Copilot", href: "/ai-assistant" },
    { icon: NotebookPen, label: "Entries", href: "/entries" },
    { icon: ArrowLeftRight, label: "Transactions", href: "/transactions" },
    { icon: FileSpreadsheet, label: "Import Statement", href: "/transactions/import" },
    { icon: Wallet, label: "Accounts", href: "/accounts" },
    { icon: CalendarDays, label: "Calendar", href: "/calendar" },
    { icon: ListChecks, label: "Tasks", href: "/tasks" },
    { icon: ScanLine, label: "Receipts", href: "/receipts" },
  ];

  const MONEY = [
    { icon: TrendingUp, label: "Investments", href: "/wealth/investments" },
    { icon: Users, label: "Committee", href: "/wealth/committees" },
    { icon: HandHeart, label: "Zakat", href: "/wealth/zakat" },
    { icon: CircleDollarSign, label: "Budgets", href: "/budgets" },
    { icon: Users, label: "Contacts", href: "/contacts" },
  ];

  const CLOSING = [
    { icon: PieChart, label: "Reports", href: "/reports" },
    { icon: Landmark, label: "Tax & FBR", href: "/tax" },
    { icon: ShieldCheck, label: "Admin Console", href: "/admin" },
    { icon: Settings, label: "Settings", href: "/settings" },
  ];

  // Never invent an identity: fall back to the email local part, then a neutral
  // label. A hardcoded person's name here shipped into every empty session.
  const profileName = session?.profile
    ? formatName(session.profile.first_name, session.profile.last_name)
    : session?.user?.email?.split("@")[0] || "Your account";

  const householdName = session?.household?.name || "Personal Finances";
  // Non-filer until the ATL says otherwise — the honest default in Pakistan.
  const isFiler = session?.preferences?.is_filer ?? false;

  const renderGroup = (
    label: string,
    items: Array<{ icon: LucideIcon; label: string; href: string }>,
  ) => (
    <div>
      <p className="text-on-navy-muted/70 px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em]">
        {label}
      </p>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <li key={item.label}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-control px-3 py-2 text-[13px] transition-colors",
                  isActive
                    ? "bg-brass/12 text-on-navy font-medium"
                    : "text-on-navy-muted hover:bg-white/5",
                )}
              >
                <item.icon
                  size={16}
                  strokeWidth={1.75}
                  className={isActive ? "text-brass" : ""}
                />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    /*
     * `h-screen sticky top-0` is what makes the rail a pinned column: the page
     * scrolls behind it and only the <nav> below scrolls internally. Without it
     * the whole rail scrolled away with the content, taking the sign-out button
     * and workspace switcher off screen.
     */
    <aside className="bg-navy-900 sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col lg:flex">
      {/* Pinned header: brand + workspace switcher */}
      <div className="shrink-0 px-4 pb-4 pt-6">
        <div className="flex items-center gap-2.5 min-w-0 px-1">
          <img
            src="/branding/logo.jpg"
            alt=""
            className="w-8 h-8 rounded-[9px] object-cover shrink-0 shadow-xs border border-brass/40"
          />
          <span className="text-on-navy font-display text-[15px] font-semibold tracking-tight truncate">
            Bachat Book
          </span>
        </div>
        <div className="mt-3">
          <WorkspaceSwitcher
            currentName={householdName}
            currentId={session?.household?.id ?? null}
            currentKind={session?.household?.kind ?? null}
          />
        </div>
      </div>

      {/* The only scrolling region. Scrollbar hidden, still scrollable. */}
      <nav className="scrollbar-none flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-2">
        {renderGroup("Daily", PRIMARY)}
        {renderGroup("Wealth", MONEY)}
        {renderGroup("Review", CLOSING)}
      </nav>

      {/*
       * Filer status stays here and is deliberately NOT a money value — it is a
       * state. The dashboard KPI row used to render it as "Rs 100", which is
       * what made that copy meaningless and why it was removed from there.
       */}
      <div className="shrink-0 px-4 pt-3">
        <div className="border-navy-700 rounded-card border p-3">
          <div className="flex items-center justify-between">
            <span className="text-on-navy-muted text-[11px]">FBR status</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                isFiler ? "bg-gain-soft text-gain" : "bg-surface-subtle text-muted",
              )}
            >
              {isFiler ? "Filer" : "Non-filer"}
            </span>
          </div>
          <p className="text-on-navy-muted mt-1.5 text-[11px] leading-snug">
            {isFiler
              ? "Active on ATL · Saved on tax withholding"
              : "Tax rate applies on returns"}
          </p>
        </div>
      </div>

      {/* Pinned footer: profile + sign out */}
      <div className="shrink-0 px-4 pb-6 pt-4">
        <div className="border-navy-700 flex items-center justify-between gap-2 border-t px-1 pt-4">
          <Link
            href="/settings/profile"
            className="flex min-w-0 items-center gap-2.5 rounded-control -mx-1 px-1 py-0.5 transition-colors hover:bg-white/5"
          >
            <Avatar
              name={profileName}
              src={session?.profile?.avatar_url ?? undefined}
              size="sm"
            />
            <div className="min-w-0">
              <p className="text-on-navy truncate text-xs font-semibold">
                {profileName}
              </p>
              {session?.user?.email && (
                <p className="text-on-navy-muted truncate text-[10.5px]">
                  {session.user.email}
                </p>
              )}
            </div>
          </Link>
          {/*
           * Theme toggle lives in the shell, not on one page. It used to render
           * only inside the dashboard header, so every other route had no way to
           * switch mode.
           */}
          <div className="flex shrink-0 items-center gap-0.5">
            <ThemeToggle variant="rail" />
            <button
              onClick={() => signOutAction()}
              title="Sign out"
              aria-label="Sign out"
              className="text-on-navy-muted hover:text-on-navy hover:bg-white/5 flex size-7 shrink-0 items-center justify-center rounded-full transition-colors"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

