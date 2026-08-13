"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bike,
  Building2,
  Droplets,
  Flame,
  Fuel,
  GraduationCap,
  ImageOff,
  Landmark,
  Search,
  Shirt,
  ShoppingBasket,
  Signal,
  Smartphone,
  Sparkles,
  Stethoscope,
  Store,
  Tag,
  Tv,
  UtensilsCrossed,
  Wallet,
  Zap,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { MerchantMark } from "@/components/merchant-mark";
import { Reveal } from "@/components/reveal";
import { createClient } from "@/lib/supabase/client";
import { institutionLogo } from "@/lib/ledger";
import { cn } from "@/lib/utils";

import type { LucideIcon } from "lucide-react";
import type { InstitutionSector, Tables } from "@/lib/supabase/types";

type Tab = "institutions" | "brands";

/**
 * The platform catalogue — the shared list of real-world companies every
 * household picks from. Two halves, and they are not the same thing:
 *
 *   INSTITUTIONS  where money SITS or is BILLED FROM. Banks and wallets can
 *                 hold an account; utilities and government bodies send you
 *                 bills. This half feeds the Add Account picker.
 *   BRANDS        where money GOES. KFC, Bata, Careem, Imtiaz. These are
 *                 merchants on a transaction — you never open an account with
 *                 one — and they feed the merchant picker and auto-categorising.
 *
 * They lived in separate tables and only one was ever on screen, which is why
 * the brands looked missing. Same catalogue, two tabs.
 */

const INSTITUTION_SECTIONS: Array<{
  key: InstitutionSector;
  title: string;
  icon: LucideIcon;
  /** Can a customer hold an account here? Mirrors ACCOUNT_INSTITUTION_KINDS. */
  holdsAccounts?: boolean;
}> = [
  { key: "retail_bank", title: "Banks", icon: Landmark, holdsAccounts: true },
  { key: "mobile_wallet", title: "Mobile wallets", icon: Smartphone, holdsAccounts: true },
  { key: "telecom", title: "Telecom & internet", icon: Signal },
  { key: "electricity", title: "Electricity", icon: Zap },
  { key: "gas", title: "Gas", icon: Flame },
  { key: "water", title: "Water", icon: Droplets },
  { key: "government", title: "Government & markets", icon: Wallet },
  { key: "other", title: "Other", icon: Tag },
];

/**
 * Brands grouped by what you buy, keyed off `default_category_id`.
 *
 * Grouping by the category a brand ALREADY carries rather than a new column:
 * the mapping has to exist anyway for auto-categorising, so a second field
 * would be one more thing to keep in step for no extra information.
 */
const BRAND_SECTIONS: Array<{
  key: string;
  title: string;
  icon: LucideIcon;
  categories: string[];
}> = [
  {
    key: "food",
    title: "Restaurants & cafes",
    icon: UtensilsCrossed,
    categories: ["restaurant", "delivery"],
  },
  {
    key: "grocery",
    title: "Grocery & superstores",
    icon: ShoppingBasket,
    categories: ["kiryana", "meat", "sabzi", "doodh"],
  },
  {
    key: "apparel",
    title: "Clothing & footwear",
    icon: Shirt,
    categories: ["clothing", "shopping"],
  },
  { key: "fuel", title: "Fuel", icon: Fuel, categories: ["petrol", "generator"] },
  {
    key: "transport",
    title: "Ride-hailing & vehicles",
    icon: Bike,
    categories: ["ridehail", "carmaint", "token"],
  },
  {
    key: "health",
    title: "Health & pharmacy",
    icon: Stethoscope,
    categories: ["doctor", "pharmacy"],
  },
  {
    key: "education",
    title: "Education",
    icon: GraduationCap,
    categories: ["school_fee", "education"],
  },
  {
    key: "digital",
    title: "Subscriptions & digital",
    icon: Tv,
    categories: ["entertainment"],
  },
  {
    key: "bills",
    title: "Utility billers",
    icon: Zap,
    categories: ["electricity", "gas", "water", "internet", "mobile"],
  },
  {
    key: "income",
    title: "Income sources",
    icon: Sparkles,
    categories: ["freelance", "salary", "business"],
  },
];

export default function CataloguePage() {
  const supabase = createClient();

  const [institutions, setInstitutions] = React.useState<Tables<"institutions">[]>([]);
  const [merchants, setMerchants] = React.useState<Tables<"merchants">[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState<Tab>("institutions");
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    let active = true;
    async function load() {
      const [i, m] = await Promise.all([
        supabase.from("institutions").select("*").order("name"),
        supabase.from("merchants").select("*").order("name"),
      ]);
      if (!active) return;
      if (i.data) setInstitutions(i.data);
      if (m.data) setMerchants(m.data);
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [supabase]);

  const q = query.trim().toLowerCase();
  const match = (name: string, short?: string) =>
    !q || name.toLowerCase().includes(q) || (short ?? "").toLowerCase().includes(q);

  const visibleInstitutions = institutions.filter((i) => match(i.name, i.short_name));
  const visibleMerchants = merchants.filter((m) => match(m.name));

  const institutionSections = INSTITUTION_SECTIONS.map((s) => ({
    ...s,
    rows: visibleInstitutions
      .filter((i) => (i.sector ?? "other") === s.key)
      .map(toEntry),
  }));

  const brandSections = React.useMemo(() => {
    const claimed = new Set<string>();
    const sections = BRAND_SECTIONS.map((s) => {
      const rows = visibleMerchants.filter((m) => {
        if (!m.default_category_id) return false;
        if (!s.categories.includes(m.default_category_id)) return false;
        claimed.add(m.id);
        return true;
      });
      return { ...s, rows: rows.map(toEntry) };
    });

    // Anything the map above does not cover still has to appear — a brand that
    // silently vanishes from the catalogue is a brand nobody can pick.
    const rest = visibleMerchants.filter((m) => !claimed.has(m.id));
    if (rest.length > 0) {
      sections.push({
        key: "unsorted",
        title: "Uncategorised",
        icon: Store,
        categories: [],
        rows: rest.map(toEntry),
      });
    }
    return sections;
  }, [visibleMerchants]);

  const sections = tab === "institutions" ? institutionSections : brandSections;
  const total = tab === "institutions" ? institutions.length : merchants.length;
  const awaitingLogo = (tab === "institutions" ? institutions : merchants).filter(
    (r) => !r.logo_path,
  ).length;
  const nothingMatches = sections.every((s) => s.rows.length === 0);

  return (
    <div className="space-y-5">
      <header className="flex items-start gap-3">
        <Link
          href="/admin"
          aria-label="Back to the console"
          className="border-border bg-surface hover:bg-surface-subtle text-muted hover:text-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors"
        >
          <ArrowLeft size={15} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="font-display truncate text-[19px] font-semibold tracking-[-0.02em] sm:text-[22px]">
            Catalogue
          </h1>
          <p className="text-muted mt-0.5 text-[12.5px]">
            The shared list of real companies every household picks from —{" "}
            {institutions.length} institutions, {merchants.length} brands.
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="border-border bg-surface flex w-fit items-center gap-1 rounded-control border p-1">
          {(
            [
              { v: "institutions" as const, label: "Institutions", Icon: Building2 },
              { v: "brands" as const, label: "Brands", Icon: Store },
            ]
          ).map(({ v, label, Icon }) => (
            <button
              key={v}
              onClick={() => setTab(v)}
              aria-pressed={tab === v}
              className={cn(
                "flex items-center gap-1.5 rounded-control px-2.5 py-1 text-[12px] font-medium transition-colors",
                tab === v
                  ? "bg-navy-900 text-on-navy dark:bg-brass dark:text-navy-900"
                  : "text-muted hover:text-foreground",
              )}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        <div className="relative sm:w-72">
          <Search
            size={14}
            className="text-muted pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
          />
          <Input
            placeholder="Search the catalogue…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8 text-xs"
          />
        </div>
      </div>

      <p className="text-faint text-[11.5px] italic leading-snug">
        {tab === "institutions"
          ? "Where money sits or is billed from. Only banks and wallets can hold an account — the rest are billers you pay."
          : "Where money goes. Brands appear on a transaction and set its category automatically; you never open an account with one."}
        {awaitingLogo > 0 && (
          <span className="text-brass-strong not-italic">
            {" "}
            {awaitingLogo} still awaiting an authentic logo.
          </span>
        )}
      </p>

      {loading ? (
        <div className="space-y-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="shimmer h-32 rounded-panel" />
          ))}
        </div>
      ) : nothingMatches ? (
        <p className="text-muted py-12 text-center text-xs">
          Nothing in the catalogue matches “{query}”. {total} entries in total.
        </p>
      ) : (
        <div className="space-y-7">
          {sections.map((section, i) => {
            if (section.rows.length === 0) return null;
            return (
              <Reveal key={section.key} index={Math.min(i, 4)}>
                <section className="space-y-3">
                  {/*
                    Full-width heading on the page itself, NOT a bar inside a
                    bordered panel. Nesting a header strip inside a card meant
                    two frames around every group and a ~60px band before a
                    single logo appeared; this is one 24px line.
                  */}
                  <div className="border-border flex items-center gap-2 border-b pb-2">
                    <section.icon size={14} className="text-brass-strong shrink-0" />
                    <h2 className="font-display text-[13px] font-semibold">
                      {section.title}
                    </h2>
                    <span className="text-faint tnum text-[11px]">
                      {section.rows.length}
                    </span>
                    {"holdsAccounts" in section && section.holdsAccounts && (
                      <span
                        title="Customers can open an account with these"
                        className="bg-brass-soft text-brass-strong ms-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      >
                        Holds accounts
                      </span>
                    )}
                  </div>

                  {/* Separate rounded cards with real gaps — hover lands on one
                      card rather than on a row inside a shared block. */}
                  <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                    {section.rows.map((row) => (
                      <li key={row.id}>
                        <div className="lift bg-surface border-border flex items-center gap-2.5 rounded-card border p-2.5">
                          <MerchantMark
                            name={row.short || row.name}
                            brand={row.brand}
                            logo={institutionLogo(row.logo) ?? undefined}
                            awaitingLogo={!row.logo}
                            size={30}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-foreground truncate text-[12.5px] font-medium">
                              {row.name}
                            </p>
                            <p className="text-faint ltr truncate text-[10.5px]">
                              {row.short ? `${row.short} · ` : ""}
                              {row.id}
                            </p>
                          </div>
                          {!row.logo && (
                            <span
                              title="No authentic logo yet — the placeholder is deliberate"
                              className="text-faint shrink-0"
                            >
                              <ImageOff size={13} />
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              </Reveal>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** One catalogue row, whichever table it came from. */
type Entry = {
  id: string;
  name: string;
  short: string | null;
  brand: string;
  logo: string | null;
};

function toEntry(r: Tables<"institutions"> | Tables<"merchants">): Entry {
  return {
    id: r.id,
    name: r.name,
    short: "short_name" in r ? r.short_name : null,
    brand: r.brand_color,
    logo: r.logo_path,
  };
}
