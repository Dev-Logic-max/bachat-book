"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  User,
  Sliders,
  Home,
  CreditCard,
  Tag,
  Wand2,
  Link2,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/settings/profile", label: "Profile", icon: User },
  { href: "/settings/preferences", label: "Preferences", icon: Sliders },
  { href: "/settings/workspaces", label: "Workspaces", icon: Home },
  { href: "/settings/categories", label: "Categories", icon: Tag },
  { href: "/settings/rules", label: "Rules", icon: Wand2 },
  { href: "/settings/integrations", label: "Integrations", icon: Link2 },
  { href: "/settings/plan", label: "Plan Tiers", icon: CreditCard },
  { href: "/settings/guide", label: "Guide", icon: BookOpen },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    /*
     * No px/py here. (app)/layout.tsx already owns page padding; adding more put
     * every settings form in roughly double the whitespace of /accounts and made
     * the module read as a different design system. max-w-4xl stays — that is a
     * reading measure for forms, not padding.
     */
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="font-display truncate text-[19px] font-semibold tracking-[-0.02em] sm:text-[22px]">
          Settings
        </h1>
        <p className="text-muted mt-0.5 text-[12.5px]">
          Manage your account details, workspace preferences, and plan tier.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-border mb-6 border-b">
        <nav className="-mb-px flex gap-4 overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 border-b-2 py-3 px-1 text-xs font-semibold transition-colors shrink-0",
                  isActive
                    ? "border-navy-900 text-foreground dark:border-brass"
                    : "border-transparent text-muted hover:text-foreground",
                )}
              >
                <item.icon size={15} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div>{children}</div>
    </div>
  );
}
