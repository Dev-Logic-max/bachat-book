"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  ArrowRight,
  Bot,
  CalendarDays,
  CircleDollarSign,
  FileSpreadsheet,
  HandCoins,
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
  Contact,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/lib/supabase/actions";
import { Avatar } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme";
import { formatName } from "@/lib/format";
import { MODULES, resolveModules, type WorkspacePreset } from "@/lib/modules";
import { useRailCollapsed } from "@/lib/rail-state";

import type { LucideIcon } from "lucide-react";
import type { UserSession } from "@/lib/session";

/* -------------------------------------------------------------------------- *
 * FBR card dismissal
 *
 * A per-DEVICE preference about a panel, so localStorage rather than the
 * `preferences` table — the household does not share "I have read this".
 * The custom event is what lets the card disappear the instant it is dismissed
 * instead of on the next navigation; `storage` only fires in OTHER tabs.
 * -------------------------------------------------------------------------- */
const FILER_CARD_KEY = "bb-filer-card";
const FILER_CARD_EVENT = "bb-filer-card-change";

function subscribeToFilerCard(onChange: () => void) {
  window.addEventListener(FILER_CARD_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(FILER_CARD_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Bring it back. Called from Settings → Preferences. */
export function restoreFilerCard() {
  window.localStorage.removeItem(FILER_CARD_KEY);
  window.dispatchEvent(new Event(FILER_CARD_EVENT));
}

/** Whether it is currently hidden — so Settings can show the right control. */
export function isFilerCardHidden() {
  return window.localStorage.getItem(FILER_CARD_KEY) === "hidden";
}

type RailItem = {
  icon: LucideIcon;
  label: string;
  href: string;
  soon?: boolean;
};

export function AppRail({ session }: { session?: UserSession | null }) {
  const pathname = usePathname();
  // Read-only here. The TOGGLE lives in the header (`app-top-bar.tsx`); both
  // read the same store, so the rail still re-renders when it changes.
  const [collapsed] = useRailCollapsed();

  /*
   * Ordered by how often a rupee-a-day user actually touches each screen, not by
   * how the modules were built. Logging money comes first, planning second, the
   * once-a-month surfaces last.
   *
   * `soon` marks a module that is wired but not finished. It stays reachable —
   * hiding it would make it impossible to keep testing — but the chip stops it
   * from reading as a working feature.
   */
  const DAILY: RailItem[] = [
    { icon: LayoutDashboard, label: "Overview", href: "/dashboard" },
    { icon: NotebookPen, label: "Entries", href: "/entries" },
    { icon: Wallet, label: "Accounts", href: "/accounts" },
    { icon: ArrowLeftRight, label: "Transactions", href: "/transactions" },
  ];

  const PLANNER: RailItem[] = [
    { icon: ListChecks, label: "Tasks", href: "/tasks" },
    { icon: CalendarDays, label: "Calendar", href: "/calendar" },
  ];

  const MONEY: RailItem[] = [
    { icon: CircleDollarSign, label: "Budgets", href: "/budgets" },
    { icon: TrendingUp, label: "Investments", href: "/wealth/investments" },
    { icon: Users, label: "Committee", href: "/wealth/committees" },
    { icon: HandHeart, label: "Zakat", href: "/wealth/zakat" },
    { icon: HandCoins, label: "Udhaar", href: "/debts" },
    { icon: Contact, label: "Contacts", href: "/contacts" },
  ];

  const TOOLS: RailItem[] = [
    { icon: PieChart, label: "Reports", href: "/reports" },
    { icon: Landmark, label: "Tax & FBR", href: "/tax" },
    { icon: Bot, label: "AI Copilot", href: "/ai-assistant", soon: true },
    {
      icon: FileSpreadsheet,
      label: "Import Statement",
      href: "/transactions/import",
      soon: true,
    },
    { icon: ScanLine, label: "Receipts", href: "/receipts", soon: true },
  ];

  const CLOSING: RailItem[] = [
    { icon: ShieldCheck, label: "Admin Console", href: "/admin" },
    { icon: Settings, label: "Settings", href: "/settings" },
  ];

  /*
    Hide what this workspace's preset does not include.

    Matched by href against the registry in lib/modules.ts. Anything the
    registry does not know about — the admin console, for one — is always
    shown, so a module can never disappear just because it was left out of the
    list. The vertical modules are not in the rail yet; they arrive with the
    screens behind them.
  */
  const enabledHrefs = React.useMemo(() => {
    const preset = (session?.household?.preset ?? "personal") as WorkspacePreset;
    return new Set(resolveModules(preset).map((m) => m.href));
  }, [session?.household?.preset]);

  const forPreset = React.useCallback(
    (items: RailItem[]) =>
      items.filter(
        (item) =>
          !MODULES.some((m) => m.href === item.href) || enabledHrefs.has(item.href),
      ),
    [enabledHrefs],
  );

  // Never invent an identity: fall back to the email local part, then a neutral
  // label. A hardcoded person's name here shipped into every empty session.
  const profileName = session?.profile
    ? formatName(session.profile.first_name, session.profile.last_name)
    : session?.user?.email?.split("@")[0] || "Your account";

  // Non-filer until the ATL says otherwise — the honest default in Pakistan.
  const isFiler = session?.preferences?.is_filer ?? false;

  /*
   * Whether the FBR card is still wanted, read from localStorage.
   *
   * `useSyncExternalStore` rather than an effect: React Compiler rejects a
   * synchronous setState in useEffect, and reading localStorage during render
   * would mismatch the server, which renders nothing there. The server snapshot
   * is deliberately `true` — the card is shown until the client says otherwise,
   * so the first paint never flashes an empty gap for someone who kept it.
   */
  const filerCardHidden = React.useSyncExternalStore(
    subscribeToFilerCard,
    () => window.localStorage.getItem(FILER_CARD_KEY) === "hidden",
    () => false,
  );
  const showFilerCard = !filerCardHidden;

  const dismissFilerCard = () => {
    window.localStorage.setItem(FILER_CARD_KEY, "hidden");
    window.dispatchEvent(new Event(FILER_CARD_EVENT));
  };

  const renderGroup = (label: string, items: RailItem[]) => (
    <div>
      {collapsed ? (
        // The heading has nowhere to go at 72px. A hairline keeps the grouping
        // legible without it; dropping both would make one 18-item list.
        <div className="border-navy-700 mx-3 mb-2 border-t" />
      ) : (
        <p className="text-on-navy-muted/70 px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em]">
          {label}
        </p>
      )}

      <ul className="space-y-0.5">
        {items.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <li key={item.label}>
              <Link
                href={item.href}
                // The label becomes the tooltip once it is no longer on screen.
                title={collapsed ? `${item.label}${item.soon ? " — coming soon" : ""}` : undefined}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group/nav relative flex items-center rounded-control text-[13px] transition-colors",
                  collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2",
                  isActive
                    ? "bg-brass/12 text-on-navy font-medium"
                    : "text-on-navy-muted hover:bg-white/[0.07] hover:text-on-navy",
                )}
              >
                {/*
                  Brass bar at the leading edge of the active row.

                  The tint alone was doing all the work, and at 12% opacity on
                  navy it is nearly invisible in dark mode, where the rail itself
                  lifts rather than darkens. A hard edge reads at any brightness
                  and survives being the only marker when the rail is collapsed.
                */}
                {isActive && (
                  <span
                    aria-hidden
                    className="bg-brass absolute inset-y-1.5 inset-s-0 w-0.75 rounded-e-full"
                  />
                )}

                <item.icon
                  size={16}
                  strokeWidth={1.75}
                  className={cn(
                    "shrink-0 transition-colors",
                    isActive ? "text-brass" : "group-hover/nav:text-on-navy",
                  )}
                />

                {!collapsed && (
                  <>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.soon && (
                      <span className="bg-white/10 text-on-navy-muted shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]">
                        Soon
                      </span>
                    )}
                  </>
                )}

                {/* Collapsed: the chip has no room, so "unfinished" is a dot. */}
                {collapsed && item.soon && (
                  <span
                    aria-hidden
                    className="bg-brass/70 absolute right-2.5 top-2 size-1.5 rounded-full"
                  />
                )}
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
     *
     * The content area is a `flex-1` <main> beside this, so narrowing the rail
     * widens the page with no coordination between the two.
     */
    <aside
      className={cn(
        "bg-navy-900 sticky top-0 hidden h-screen shrink-0 flex-col transition-[width] duration-200 ease-out lg:flex",
        collapsed ? "w-18" : "w-62",
      )}
    >
      {/*
        Pinned header: the brand.

        A 64px band flush to the top, matching the top bar's exactly, so the two
        rules meet and run through as one edge across the whole app. It used to
        be `pb-4 pt-6` around a 32px logo, which ended at 72 and missed the bar's
        rule by enough to read as a mistake rather than a decision.

        Full-bleed, so it crosses the rail the way the bar's rule crosses the
        page. The padding lives on the inner row instead.
      */}
      <div className="border-navy-700 shrink-0 border-b">
        <div
          className={cn(
            "flex h-16 min-w-0 items-center",
            collapsed ? "justify-center px-3" : "gap-2.5 px-5",
          )}
        >
          <img
            src="/branding/logo.jpg"
            alt=""
            className="border-brass/40 shadow-xs size-8 shrink-0 rounded-[9px] border object-cover"
          />
          {!collapsed && (
            <span className="text-on-navy font-display truncate text-[15px] font-semibold tracking-tight">
              Bachat Book
            </span>
          )}
        </div>

        {/*
          The workspace switcher used to sit here. It moved to the top bar,
          which is the one row that renders at every width — this rail is hidden
          below `lg`, so a control that only lives here does not exist on a
          phone.
        */}
      </div>

      {/* The only scrolling region. Scrollbar hidden, still scrollable. */}
      <nav
        className={cn(
          "scrollbar-none flex min-h-0 flex-1 flex-col overflow-y-auto pb-2 pt-4",
          collapsed ? "gap-2 px-3" : "gap-5 px-4",
        )}
      >
        {renderGroup("Daily", forPreset(DAILY))}
        {renderGroup("Planner", forPreset(PLANNER))}
        {renderGroup("Wealth", forPreset(MONEY))}
        {renderGroup("Insights & tools", forPreset(TOOLS))}
        {renderGroup("System", CLOSING)}
      </nav>

      {/*
       * Filer status stays here and is deliberately NOT a money value — it is a
       * state. The dashboard KPI row used to render it as "Rs 100", which is
       * what made that copy meaningless and why it was removed from there.
       */}
      {/*
       * Filer status is a STATE, not a money value — the dashboard KPI row once
       * rendered it as "Rs 100", which is what made that copy meaningless.
       *
       * Dismissible, and the dismissal STICKS. It is a standing fact about the
       * household rather than news: once you have read it, a permanent card
       * above your own name is just furniture. It comes back from Settings →
       * Preferences, and the link says so, so dismissing it is not a one-way
       * door. Stored in localStorage rather than the database because it is a
       * per-device preference about a panel, not something the household shares.
       */}
      {!collapsed && showFilerCard && (
        <div className="shrink-0 px-4 pt-3">
          <div
            className={cn(
              "group/fbr relative overflow-hidden rounded-card border p-3",
              // Brass for a filer, plain for a non-filer. Being on the ATL is
              // the good outcome and the card should feel like it.
              isFiler
                ? "border-brass/30 bg-linear-to-br from-brass/[0.14] to-transparent"
                : "border-navy-700 bg-navy-800/40",
            )}
          >
            {/* A soft corner glow, clipped by the card. Cheap depth that does
                not cost a shadow on a dark surface, where shadows do nothing. */}
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute -inset-e-6 -top-8 size-20 rounded-full blur-2xl",
                isFiler ? "bg-brass/25" : "bg-white/4",
              )}
            />

            <div className="relative flex items-center gap-2">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full",
                  isFiler ? "bg-brass/20 text-brass" : "bg-white/6 text-on-navy-muted",
                )}
              >
                {isFiler ? <ShieldCheck size={13} /> : <Landmark size={13} />}
              </span>

              <span className="text-on-navy-muted min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-widest">
                FBR status
              </span>

              <button
                type="button"
                onClick={dismissFilerCard}
                aria-label="Hide the FBR status card"
                title="Hide — you can bring it back from Settings → Preferences"
                className="text-on-navy-muted hover:bg-white/9 hover:text-on-navy -me-1 flex size-5 shrink-0 items-center justify-center rounded-full opacity-100 transition-all lg:opacity-0 lg:group-hover/fbr:opacity-100 lg:group-focus-within/fbr:opacity-100"
              >
                <X size={12} />
              </button>
            </div>

            <p
              className={cn(
                "relative mt-2 text-[13px] font-semibold leading-none",
                isFiler ? "text-brass" : "text-on-navy",
              )}
            >
              {isFiler ? "Filer" : "Non-filer"}
            </p>

            <p className="text-on-navy-muted relative mt-1.5 text-[10.5px] leading-snug">
              {isFiler
                ? "Active on the ATL — you pay the lower withholding rate."
                : "You pay the higher withholding rate on most transactions."}
            </p>

            <Link
              href="/tax"
              className={cn(
                "relative mt-2 inline-flex items-center gap-1 text-[10.5px] font-semibold transition-colors",
                isFiler
                  ? "text-brass/80 hover:text-brass"
                  : "text-on-navy-muted hover:text-on-navy",
              )}
            >
              {isFiler ? "See what it saves you" : "See what it costs you"}
              <ArrowRight size={11} />
            </Link>
          </div>
        </div>
      )}

      {/*
        Pinned footer: profile and sign out.

        The collapse toggle used to live here. It moved to the LEFT END OF THE
        HEADER, which is where a sidebar toggle is looked for — and where it is
        reachable below `lg`, since the rail does not render at all at those
        widths and a control buried inside it could never be used to bring it
        back. See `app-top-bar.tsx`; both read the same `useRailCollapsed` store.
      */}
      <div className={cn("shrink-0 pb-6 pt-4", collapsed ? "px-3" : "px-4")}>
        <div
          className={cn(
            "border-navy-700 flex items-center border-t pt-4",
            collapsed ? "flex-col gap-2" : "justify-between gap-2 px-1",
          )}
        >
          <Link
            href="/settings/profile"
            title={collapsed ? profileName : undefined}
            className={cn(
              "flex min-w-0 items-center rounded-control transition-colors hover:bg-white/5",
              collapsed ? "justify-center p-1" : "-mx-1 gap-2.5 px-1 py-0.5",
            )}
          >
            <Avatar
              name={profileName}
              src={session?.profile?.avatar_url ?? undefined}
              size="sm"
            />
            {!collapsed && (
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
            )}
          </Link>

          {/*
           * Theme toggle lives in the shell, not on one page. It used to render
           * only inside the dashboard header, so every other route had no way to
           * switch mode.
           */}
          <div
            className={cn(
              "flex shrink-0 items-center",
              collapsed ? "flex-col gap-1" : "gap-0.5",
            )}
          >
            <ThemeToggle variant="rail" />
            <button
              onClick={() => signOutAction()}
              title="Sign out"
              aria-label="Sign out"
              className="text-on-navy-muted hover:text-on-navy flex size-7 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/5"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>

        {/*
          The build number lived here and has moved into the account menu
          (`user-menu.tsx`). A version string is asked for perhaps twice a year,
          and pinning it under the profile block gave a rarely-wanted fact a
          permanent seat at the bottom of every screen. It is now one click away
          in the menu people already open for Settings and Sign out.
        */}
      </div>
    </aside>
  );
}
