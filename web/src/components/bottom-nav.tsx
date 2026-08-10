"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  CalendarDays,
  LayoutDashboard,
  Settings,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { icon: LayoutDashboard, label: "Home", href: "/dashboard" },
  { icon: ArrowLeftRight, label: "Activity", href: "/transactions" },
  { icon: CalendarDays, label: "Calendar", href: "/calendar" },
  { icon: TrendingUp, label: "Wealth", href: "/budgets" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-4 bottom-4 z-30 lg:hidden">
      <ul className="bg-navy-900 flex items-center justify-between rounded-full px-3 py-2 shadow-lg">
        {ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <li key={item.label}>
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-full px-3 py-1.5 transition-colors",
                  isActive && "bg-brass",
                )}
              >
                <item.icon
                  size={18}
                  strokeWidth={1.75}
                  className={isActive ? "text-navy-900" : "text-on-navy-muted"}
                />
                <span
                  className={cn(
                    "text-[9.5px] font-medium",
                    isActive ? "text-navy-900" : "text-on-navy-muted",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

