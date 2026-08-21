"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowDownRight,
  Bot,
  Building,
  CalendarDays,
  CircleDollarSign,
  Contact,
  FileSpreadsheet,
  HandCoins,
  HandHeart,
  Landmark,
  PieChart,
  ScanLine,
  Settings,
  TrendingUp,
  Users,
  Wallet,
  ArrowLeftRight,
  ArrowUpRight,
  LayoutDashboard,
  ListChecks,
  MoreHorizontal,
  NotebookPen,
  Plus,
  X,
} from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Drawer } from "@/components/ui/drawer";
import { QuickAddModal } from "@/components/quick-add-modal";
import { TransferModal } from "@/components/transfer-modal";
import { TaskFormModal } from "@/components/task-form-modal";
import { MODULES, resolveModules, type WorkspacePreset } from "@/lib/modules";
import { cn } from "@/lib/utils";

import type { LucideIcon } from "lucide-react";

/**
 * The phone navigation bar.
 *
 * FIVE FIXED SLOTS. It used to render every module three times over inside a
 * horizontal scroller that looped, self-corrected on `scrollend`, and re-centred
 * on every route change. Those two behaviours fought each other: the centring
 * animation would land mid-flick, the normaliser would yank the strip back by a
 * whole set, and the tab under your thumb shifted sideways while you were
 * reading it. The bar was also 72px + an 18px overhang because the active bubble
 * needed somewhere to rise into, which made it read as a slab rather than a dock.
 *
 * Nothing scrolls now, so none of that can happen: the layout is a five-column
 * grid, the bar is one fixed height, and the only thing that ever moves is the
 * active tab's own glyph. The eleven modules that no longer have a slot live in
 * the More sheet, one tap away and with their names spelled out — which is more
 * discoverable than being the ninth item in a strip you had to drag.
 *
 * The centre is an ACTION, not a destination. Logging money is the thing people
 * open this app to do, and making it a tab would have meant navigating to a page
 * to press a button on it. It owns its own modals so it works from any screen.
 */

type Tab = { icon: LucideIcon; label: string; href: string };

/** Slots 1, 2, 4. Slot 3 is Add and slot 5 is More. */
const TABS: Tab[] = [
  { icon: LayoutDashboard, label: "Overview", href: "/dashboard" },
  { icon: NotebookPen, label: "Entries", href: "/entries" },
  { icon: ArrowLeftRight, label: "Transactions", href: "/transactions" },
];

/** Everything the five slots cannot hold. Order follows the module registry. */
const IN_BAR = new Set([...TABS.map((t) => t.href)]);

const BAR = 64;

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();

  const householdId = session?.household?.id ?? "";
  const userId = session?.user?.id ?? "";

  const [addOpen, setAddOpen] = React.useState(false);
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [entryOpen, setEntryOpen] = React.useState(false);
  const [entryType, setEntryType] = React.useState<"expense" | "income">(
    "expense",
  );
  const [transferOpen, setTransferOpen] = React.useState(false);
  const [taskOpen, setTaskOpen] = React.useState(false);

  const isActive = (href: string) =>
    pathname === href ||
    (href !== "/dashboard" && pathname.startsWith(href));

  /*
   * The More sheet lists what this workspace's preset actually enables, read
   * from the one registry the rail and the create-workspace picker also read.
   * The bottom bar used to carry its own hardcoded array, which is how it came
   * to list "Activity" and "Wealth" — two names that existed nowhere else in the
   * product.
   */
  const moreModules = React.useMemo(() => {
    const preset = (session?.household?.preset ?? "personal") as WorkspacePreset;
    const enabled = new Set(resolveModules(preset).map((m) => m.href));
    return MODULES.filter(
      (m) => enabled.has(m.href) && !IN_BAR.has(m.href) && m.status === "live",
    );
  }, [session?.household?.preset]);

  const moreIsActive = moreModules.some((m) => isActive(m.href));

  const openEntry = (type: "expense" | "income") => {
    setEntryType(type);
    setAddOpen(false);
    setEntryOpen(true);
  };

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 lg:hidden"
        style={{
          // Clears the iOS home indicator without a magic number on every device.
          paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
        }}
      >
        <div
          className="bg-navy-900 mx-3 grid grid-cols-5 items-center rounded-full shadow-lg"
          style={{ height: BAR }}
        >
          {TABS.slice(0, 2).map((tab) => (
            <NavTab key={tab.href} tab={tab} active={isActive(tab.href)} />
          ))}

          {/* Centre: the action. */}
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              aria-label="Add"
              aria-expanded={addOpen}
              className={cn(
                "bg-brass text-navy-900 ring-navy-900 flex size-12 items-center justify-center rounded-full shadow-lg ring-4 transition-transform active:scale-90",
              )}
              style={{
                // Rises out of the bar rather than stretching it — the bar's
                // height is what used to grow to fit the raised control.
                transform: `translateY(-10px)${addOpen ? " rotate(45deg)" : ""}`,
              }}
            >
              <Plus size={22} strokeWidth={2.25} />
            </button>
          </div>

          {TABS.slice(2).map((tab) => (
            <NavTab key={tab.href} tab={tab} active={isActive(tab.href)} />
          ))}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="More modules"
            aria-expanded={moreOpen}
            className="group/tab flex h-full flex-col items-center justify-center gap-1"
          >
            <MoreHorizontal
              size={19}
              strokeWidth={1.75}
              className={cn(
                "transition-colors",
                moreIsActive
                  ? "text-brass"
                  : "text-on-navy-muted group-hover/tab:text-on-navy",
              )}
            />
            <span
              className={cn(
                "text-[9.5px] font-medium transition-colors",
                moreIsActive ? "text-on-navy" : "text-on-navy-muted",
              )}
            >
              More
            </span>
          </button>
        </div>
      </nav>

      {/* ---- The Add chooser ------------------------------------------- */}
      <Drawer
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add"
        subtitle="What happened?"
      >
        <ul className="space-y-2">
          <AddChoice
            icon={ArrowDownRight}
            glyph="text-loss"
            label="Expense"
            hint="Money out — defaults to cash"
            onClick={() => openEntry("expense")}
          />
          <AddChoice
            icon={ArrowUpRight}
            glyph="text-gain"
            label="Income"
            hint="Money in — pick the account it landed in"
            onClick={() => openEntry("income")}
          />
          <AddChoice
            icon={ArrowLeftRight}
            glyph="text-brass-strong"
            label="Transfer"
            hint="Between two of your own accounts"
            onClick={() => {
              setAddOpen(false);
              setTransferOpen(true);
            }}
          />
          <AddChoice
            icon={ListChecks}
            glyph="text-brass-strong"
            label="Task"
            hint="A bill, a to-do, or something that moves money later"
            onClick={() => {
              setAddOpen(false);
              setTaskOpen(true);
            }}
          />
        </ul>
      </Drawer>

      {/* ---- The More sheet -------------------------------------------- */}
      <Drawer
        isOpen={moreOpen}
        onClose={() => setMoreOpen(false)}
        title="All modules"
        subtitle="Everything this workspace includes"
      >
        <ul className="grid grid-cols-3 gap-2">
          {moreModules.map((m) => {
            const active = isActive(m.href);
            return (
              <li key={m.key}>
                <Link
                  href={m.href}
                  onClick={() => setMoreOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-full flex-col items-center gap-1.5 rounded-card border p-3 text-center transition-colors",
                    active
                      ? "border-brass/40 bg-brass-soft"
                      : "border-border hover:bg-surface-subtle",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-full",
                      active
                        ? "bg-brass/20 text-brass-strong"
                        : "bg-surface-subtle text-foreground-2",
                    )}
                  >
                    <ModuleGlyph name={m.icon} />
                  </span>
                  <span className="text-foreground text-[11px] font-medium leading-tight">
                    {m.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={() => setMoreOpen(false)}
          className="border-border text-muted hover:bg-surface-subtle mt-4 flex w-full items-center justify-center gap-1.5 rounded-card border py-2.5 text-[12px] font-medium transition-colors"
        >
          <X size={14} />
          Close
        </button>
      </Drawer>

      {/* ---- What the centre button opens ------------------------------ */}
      <QuickAddModal
        isOpen={entryOpen}
        onClose={() => setEntryOpen(false)}
        defaultType={entryType}
        householdId={householdId}
        userId={userId}
        // The nav sits outside every page, so it cannot call a page's own
        // reload. `refresh()` re-runs the server layout and the route below it,
        // which is what makes a logged expense appear on whatever screen you
        // happened to be looking at.
        onSuccess={() => router.refresh()}
      />

      <TransferModal
        isOpen={transferOpen}
        onClose={() => setTransferOpen(false)}
        householdId={householdId}
        onSuccess={() => router.refresh()}
      />

      <TaskFormModal
        isOpen={taskOpen}
        onClose={() => setTaskOpen(false)}
        householdId={householdId}
        userId={userId}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}

function NavTab({ tab, active }: { tab: Tab; active: boolean }) {
  return (
    <Link
      href={tab.href}
      aria-current={active ? "page" : undefined}
      className="group/tab flex h-full flex-col items-center justify-center gap-1"
    >
      <tab.icon
        size={19}
        strokeWidth={1.75}
        className={cn(
          "transition-colors",
          active
            ? "text-brass"
            : "text-on-navy-muted group-hover/tab:text-on-navy",
        )}
      />
      {/*
        Rendered for every tab, not just the active one — conditional text would
        change each slot's height and make the whole bar jump on navigation.
      */}
      <span
        className={cn(
          "max-w-full truncate px-1 text-[9.5px] font-medium transition-colors",
          active ? "text-on-navy" : "text-on-navy-muted",
        )}
      >
        {tab.label}
      </span>
    </Link>
  );
}

function AddChoice({
  icon: Icon,
  glyph,
  label,
  hint,
  onClick,
}: {
  icon: LucideIcon;
  glyph: string;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="border-border hover:bg-surface-subtle flex w-full items-center gap-3 rounded-card border p-3 text-left transition-colors"
      >
        <span
          className={cn(
            "bg-surface-subtle flex size-9 shrink-0 items-center justify-center rounded-full",
            glyph,
          )}
        >
          <Icon size={16} />
        </span>
        <span className="min-w-0">
          <span className="text-foreground block text-[13px] font-medium">
            {label}
          </span>
          <span className="text-faint mt-0.5 block text-[11px] italic leading-snug">
            {hint}
          </span>
        </span>
      </button>
    </li>
  );
}

/**
 * The registry stores icons as NAMES so `lib/modules.ts` stays JSX-free and can
 * be imported by server code. Mapped explicitly for the same reason as the
 * category glyphs: a dynamic lookup pulls all of Lucide into the client.
 */
function ModuleGlyph({ name }: { name: string }) {
  const Icon = MODULE_ICONS[name] ?? MoreHorizontal;
  return <Icon size={17} strokeWidth={1.75} />;
}

const MODULE_ICONS: Record<string, LucideIcon> = {
  Wallet,
  ListChecks,
  CalendarDays,
  CircleDollarSign,
  TrendingUp,
  Users,
  HandHeart,
  HandCoins,
  Contact,
  PieChart,
  Landmark,
  FileSpreadsheet,
  ScanLine,
  Bot,
  Settings,
  Building,
};
