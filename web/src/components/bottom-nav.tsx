"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  CalendarDays,
  CircleDollarSign,
  Contact,
  HandHeart,
  Landmark,
  LayoutDashboard,
  ListChecks,
  NotebookPen,
  PieChart,
  Settings,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The phone navigation rail.
 *
 * Every module usable on a phone, under the same NAMES as the sidebar — the old
 * bar had five items called "Activity" and "Wealth", words that exist nowhere
 * else in the product. Left out: the three unfinished modules and the Admin
 * console, which is a desk job.
 *
 * Three behaviours, in order of how much they matter:
 *
 * 1. IT LOOPS. The list is rendered three times and the scroller silently jumps
 *    back a set whenever it drifts out of the middle one. Without it, selecting
 *    Overview left dead space on the left — the first item can never be centred
 *    in a finite list, so the bar looked broken exactly where users start.
 * 2. THE SELECTED BUBBLE BREAKS THE STRIP. The bar is 72px; the active bubble
 *    rises out of its top edge into a taller transparent track, so the strip
 *    itself never grows and the selection reads as lifted rather than inflated.
 * 3. TOUCH AND HOVER SCALE. Pressing or hovering a tab eases it up — the
 *    feedback a native dock gives you before the screen has changed.
 */
const ITEMS = [
  { icon: LayoutDashboard, label: "Overview", href: "/dashboard" },
  { icon: NotebookPen, label: "Entries", href: "/entries" },
  { icon: Wallet, label: "Accounts", href: "/accounts" },
  { icon: ArrowLeftRight, label: "Transactions", href: "/transactions" },
  { icon: ListChecks, label: "Tasks", href: "/tasks" },
  { icon: CalendarDays, label: "Calendar", href: "/calendar" },
  { icon: CircleDollarSign, label: "Budgets", href: "/budgets" },
  { icon: TrendingUp, label: "Investments", href: "/wealth/investments" },
  { icon: Users, label: "Committee", href: "/wealth/committees" },
  { icon: HandHeart, label: "Zakat", href: "/wealth/zakat" },
  { icon: Contact, label: "Contacts", href: "/contacts" },
  { icon: PieChart, label: "Reports", href: "/reports" },
  { icon: Landmark, label: "Tax & FBR", href: "/tax" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

/** One tab's slot width. The loop maths depends on every slot being equal. */
const SLOT = 62;
/** Strip height. The bubble is taller than this and overhangs the top edge. */
const STRIP = 72;
/** How far the active bubble rises out of the strip. */
const LIFT = 18;

const COPIES = 3;
const MIDDLE = 1;

export function BottomNav() {
  const pathname = usePathname();
  const railRef = React.useRef<HTMLDivElement>(null);
  const setWidth = ITEMS.length * SLOT;

  const activeIndex = ITEMS.findIndex(
    (item) =>
      pathname === item.href ||
      (item.href !== "/dashboard" && pathname.startsWith(item.href)),
  );

  /*
   * Keep the scroller inside the middle copy.
   *
   * `scrollLeft` is assigned with `behavior: auto` so the correction is
   * invisible: every copy is identical, so shifting by exactly one set width
   * lands on a pixel-identical frame. Doing it on `scrollend` (falling back to a
   * debounce) rather than on every `scroll` event keeps it from fighting an
   * in-progress flick.
   */
  React.useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    let timer: number | undefined;

    const normalise = () => {
      const min = setWidth * 0.5;
      const max = setWidth * (COPIES - 1.5);
      if (rail.scrollLeft < min) rail.scrollLeft += setWidth;
      else if (rail.scrollLeft > max) rail.scrollLeft -= setWidth;
    };

    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(normalise, 120);
    };

    rail.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      rail.removeEventListener("scroll", onScroll);
    };
  }, [setWidth]);

  /*
   * Centre the active tab on every route change.
   *
   * Always the MIDDLE copy, so there is a full set of tabs to scroll through in
   * both directions no matter which module is selected. `scrollIntoView` would
   * pick whichever copy is nearest, which defeats the point.
   */
  React.useEffect(() => {
    const rail = railRef.current;
    if (!rail || activeIndex < 0) return;

    const target =
      MIDDLE * setWidth +
      activeIndex * SLOT +
      SLOT / 2 -
      rail.clientWidth / 2;

    // First paint jumps; later navigations glide.
    const first = rail.dataset.settled !== "1";
    rail.scrollTo({ left: target, behavior: first ? "auto" : "smooth" });
    rail.dataset.settled = "1";
  }, [activeIndex, pathname, setWidth]);

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 lg:hidden"
      style={{ height: STRIP + LIFT + 12 }}
    >
      {/* The strip itself. Fixed height — the bubble overhangs it rather than
          stretching it, which is what kept the bar growing before. */}
      <span
        aria-hidden
        className="bg-navy-900 absolute inset-x-3 bottom-3 rounded-full shadow-lg"
        style={{ height: STRIP }}
      />

      {/* Edge fades: without them the rail stops mid-icon and reads as a
          rendering fault instead of "there is more this way". */}
      <span
        aria-hidden
        className="from-navy-900 pointer-events-none absolute bottom-3 left-3 z-20 w-10 rounded-l-full bg-linear-to-r to-transparent"
        style={{ height: STRIP }}
      />
      <span
        aria-hidden
        className="from-navy-900 pointer-events-none absolute bottom-3 right-3 z-20 w-10 rounded-r-full bg-linear-to-l to-transparent"
        style={{ height: STRIP }}
      />

      <div
        ref={railRef}
        className="scroll-hidden absolute inset-x-3 bottom-3 z-10 flex items-end overflow-x-auto overscroll-x-contain"
        style={{ height: STRIP + LIFT, paddingTop: LIFT }}
      >
        {Array.from({ length: COPIES }, (_, copy) =>
          ITEMS.map((item, i) => {
            const isActive = i === activeIndex;
            return (
              <Link
                key={`${copy}-${item.href}`}
                href={item.href}
                // Only the middle copy is a real navigation target for screen
                // readers; the outer two are visual padding for the loop.
                aria-hidden={copy !== MIDDLE}
                tabIndex={copy === MIDDLE ? undefined : -1}
                aria-current={isActive && copy === MIDDLE ? "page" : undefined}
                className="group/tab flex shrink-0 flex-col items-center justify-end"
                style={{ width: SLOT, height: STRIP }}
              >
                <span
                  className={cn(
                    "flex items-center justify-center rounded-full transition-all duration-300 ease-out",
                    "group-hover/tab:scale-110 group-active/tab:scale-95",
                    isActive
                      ? "bg-brass text-navy-900 ring-navy-900 size-12 shadow-lg ring-4"
                      : "text-on-navy-muted group-hover/tab:text-on-navy size-9",
                  )}
                  // The active bubble is pushed up out of the strip. Everything
                  // else stays put, so only one thing ever moves.
                  style={isActive ? { transform: `translateY(-${LIFT}px)` } : undefined}
                >
                  <item.icon size={isActive ? 20 : 18} strokeWidth={1.75} />
                </span>

                {/* Rendered for every tab, revealed only for the active one —
                    conditional rendering would change each tab's height and
                    make the whole bar jitter as you scroll. */}
                <span
                  className={cn(
                    "w-full truncate px-0.5 text-center text-[9.5px] font-medium transition-all duration-300",
                    isActive
                      ? "text-on-navy pb-2 opacity-100"
                      : "h-0 overflow-hidden opacity-0",
                  )}
                  style={isActive ? { marginTop: -LIFT + 4 } : undefined}
                >
                  {item.label}
                </span>
              </Link>
            );
          }),
        )}
      </div>
    </nav>
  );
}
