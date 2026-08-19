"use client";

import * as React from "react";
import Link from "next/link";
import {
  Building2,
  Cog,
  CreditCard,
  Landmark,
  Tags,
  Pencil,
  Search,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Reveal } from "@/components/reveal";
import { AdminPlanEditor } from "@/components/admin-plan-editor";
import { AdminPlatformSettings } from "@/components/admin-platform-settings";
import { AdminGrantPlanModal } from "@/components/admin-grant-plan-modal";
import { createClient } from "@/lib/supabase/client";
import { getEmailKeyPresent } from "@/lib/admin-actions";
import { formatName } from "@/lib/format";
import { daysUntil, expiryTone, periodEndsAt, subscriptionLabel } from "@/lib/plan";
import { cn } from "@/lib/utils";

import type { AppRole, HouseholdKind, Tables } from "@/lib/supabase/types";

type Tab = "workspaces" | "people" | "plans" | "settings";

/**
 * The platform console.
 *
 * DELIBERATELY NO MONEY ON THIS PAGE. It used to show "Managed Volume (PKR)",
 * summed from every household's transactions — a super admin reading the real
 * balances of every family using the product. Being able to query it is not a
 * reason to put it on a dashboard. What an operator actually needs is who is
 * here, what they are on, and whether anything is expiring: counts, plans and
 * statuses, never amounts.
 *
 * Everything below is readable because the RLS policies already grant
 * `is_platform_admin()` a SELECT on these tables — this page adds no new
 * privilege, it just presents what the role could already see.
 */
export default function AdminConsolePage() {
  const supabase = createClient();

  const [profiles, setProfiles] = React.useState<Tables<"profiles">[]>([]);
  const [households, setHouseholds] = React.useState<Tables<"households">[]>([]);
  const [members, setMembers] = React.useState<Tables<"household_members">[]>([]);
  const [subs, setSubs] = React.useState<Tables<"subscriptions">[]>([]);
  const [plans, setPlans] = React.useState<Tables<"plans">[]>([]);
  const [roles, setRoles] = React.useState<Tables<"user_roles">[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState<Tab>("workspaces");
  const [query, setQuery] = React.useState("");
  const [grantFor, setGrantFor] = React.useState<Tables<"profiles"> | null>(null);
  const [refresh, setRefresh] = React.useState(0);
  const [emailKeyPresent, setEmailKeyPresent] = React.useState(false);

  // The key itself never leaves the server; this only reports whether one is
  // set, so the settings screen can say what is missing.
  React.useEffect(() => {
    let active = true;
    getEmailKeyPresent().then((present) => {
      if (active) setEmailKeyPresent(present);
    });
    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    let active = true;

    async function load() {
      const [p, h, m, s, pl, r] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("households").select("*").order("created_at"),
        supabase.from("household_members").select("*"),
        supabase.from("subscriptions").select("*"),
        supabase.from("plans").select("*").order("sort_order"),
        supabase.from("user_roles").select("*"),
      ]);

      if (!active) return;
      if (p.data) setProfiles(p.data);
      if (h.data) setHouseholds(h.data);
      if (m.data) setMembers(m.data);
      if (s.data) setSubs(s.data);
      if (pl.data) setPlans(pl.data);
      if (r.data) setRoles(r.data);
      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
    // `refresh` re-runs this after a subscription is changed, so the row the
    // operator just edited shows its new plan without a page reload.
  }, [supabase, refresh]);

  const profileById = React.useMemo(
    () => new Map(profiles.map((p) => [p.id, p])),
    [profiles],
  );
  const planById = React.useMemo(() => new Map(plans.map((p) => [p.id, p])), [plans]);
  // Plans belong to the user now, so a workspace's plan is looked up through
  // its OWNER rather than by its own id.
  const subByUser = React.useMemo(
    () => new Map(subs.map((s) => [s.user_id, s])),
    [subs],
  );
  const rolesByUser = React.useMemo(() => {
    const map = new Map<string, AppRole>();
    // super_admin wins over admin wins over user, so a person with two rows is
    // never shown as the weaker one.
    const rank: Record<AppRole, number> = { super_admin: 0, admin: 1, user: 2 };
    for (const r of roles) {
      const current = map.get(r.user_id);
      if (!current || rank[r.role] < rank[current]) map.set(r.user_id, r.role);
    }
    return map;
  }, [roles]);

  const membersByHousehold = React.useMemo(() => {
    const map = new Map<string, Tables<"household_members">[]>();
    for (const m of members) {
      const list = map.get(m.household_id) ?? [];
      list.push(m);
      map.set(m.household_id, list);
    }
    return map;
  }, [members]);

  const householdsByUser = React.useMemo(() => {
    const map = new Map<string, Tables<"households">[]>();
    const hById = new Map(households.map((h) => [h.id, h]));
    for (const m of members) {
      const h = hById.get(m.household_id);
      if (!h) continue;
      const list = map.get(m.user_id) ?? [];
      list.push(h);
      map.set(m.user_id, list);
    }
    return map;
  }, [members, households]);

  const q = query.trim().toLowerCase();

  const visibleHouseholds = households.filter((h) => {
    if (!q) return true;
    const owner = profileById.get(h.owner_id);
    return (
      h.name.toLowerCase().includes(q) ||
      (owner?.email ?? "").toLowerCase().includes(q) ||
      formatName(owner?.first_name, owner?.last_name, "").toLowerCase().includes(q)
    );
  });

  const visibleProfiles = profiles.filter((p) => {
    if (!q) return true;
    return (
      (p.email ?? "").toLowerCase().includes(q) ||
      formatName(p.first_name, p.last_name, "").toLowerCase().includes(q)
    );
  });

  const activeSubs = subs.filter(
    (s) => s.status === "active" || s.status === "trialing",
  ).length;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display truncate text-[19px] font-semibold tracking-[-0.02em] sm:text-[22px]">
              Platform console
            </h1>
            <span className="bg-brass/20 text-brass-strong border-brass/40 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold">
              <ShieldCheck size={10} />
              Super admin
            </span>
          </div>
          <p className="text-muted mt-0.5 text-[12.5px]">
            Who is on the platform, what they are subscribed to, and which
            workspaces they belong to.
          </p>
        </div>

        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          <Link
            href="/admin/categories"
            className="border-border bg-surface hover:bg-surface-subtle shadow-xs flex h-9 items-center gap-1.5 rounded-control border px-3.5 text-[12.5px] font-medium transition-colors"
          >
            <Tags size={15} className="text-brass-strong" />
            Category catalogue
          </Link>
          <Link
            href="/admin/institutions"
            className="border-border bg-surface hover:bg-surface-subtle shadow-xs flex h-9 items-center gap-1.5 rounded-control border px-3.5 text-[12.5px] font-medium transition-colors"
          >
            <Landmark size={15} className="text-brass-strong" />
            Bank catalogue
          </Link>
        </div>
      </header>

      {/*
        A visible, permanent reminder of what this page does not show. An
        operator console without one invites the next feature request to be
        "can we also see their balances".
      */}
      <p className="border-border text-faint rounded-card border border-dashed px-3.5 py-2.5 text-[11.5px] italic leading-snug">
        Balances, transactions and entry details are never loaded here. A platform
        role exists to run the service, not to read anyone&apos;s money.
      </p>

      <Reveal index={0}>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat icon={<Users size={17} />} label="People" value={profiles.length} />
          <Stat
            icon={<Building2 size={17} />}
            label="Workspaces"
            value={households.length}
          />
          <Stat
            icon={<CreditCard size={17} />}
            label="Live subscriptions"
            value={activeSubs}
            footnote={`${subs.length} total`}
          />
          <Stat
            icon={<ShieldCheck size={17} />}
            label="Staff accounts"
            value={
              [...rolesByUser.values()].filter((r) => r !== "user").length
            }
            footnote="admin or super admin"
          />
        </div>
      </Reveal>

      <Reveal index={1}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="border-border bg-surface flex w-fit items-center gap-1 rounded-control border p-1">
            {(
              [
                { v: "workspaces" as const, label: "Workspaces", Icon: Building2 },
                { v: "people" as const, label: "People", Icon: User },
                { v: "plans" as const, label: "Plans", Icon: CreditCard },
                { v: "settings" as const, label: "Settings", Icon: Cog },
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
              placeholder="Search name or email…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8 text-xs"
            />
          </div>
        </div>
      </Reveal>

      {loading ? (
        <div className="shimmer h-64 rounded-panel" />
      ) : tab === "workspaces" ? (
        <Reveal index={2}>
          <div className="bg-surface border-border overflow-hidden rounded-panel border shadow-sm">
            <ul className="divide-border divide-y">
              <li className="bg-surface-subtle text-muted grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_100px_120px_90px]">
                <span>Workspace</span>
                <span className="hidden lg:block">Owner</span>
                <span className="hidden lg:block">Members</span>
                <span className="hidden lg:block">Plan</span>
                <span className="text-right">Status</span>
              </li>

              {visibleHouseholds.map((h) => {
                const owner = profileById.get(h.owner_id);
                const sub = subByUser.get(h.owner_id);
                const plan = sub ? planById.get(sub.plan_id) : null;
                const count = membersByHousehold.get(h.id)?.length ?? 0;

                return (
                  <li
                    key={h.id}
                    className="hover:bg-surface-subtle/60 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2.5 transition-colors lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_100px_120px_90px]"
                  >
                    <span className="min-w-0">
                      <span className="text-foreground block truncate text-[12.5px] font-medium">
                        {h.name}
                      </span>
                      <span className="text-faint block truncate text-[11px]">
                        <KindLabel kind={h.kind} />
                        {h.city && ` · ${h.city}`}
                        <span className="lg:hidden">
                          {" · "}
                          {count} member{count === 1 ? "" : "s"}
                        </span>
                      </span>
                    </span>

                    <span className="hidden min-w-0 items-center gap-2 lg:flex">
                      <Avatar
                        name={formatName(owner?.first_name, owner?.last_name, "?")}
                        src={owner?.avatar_url ?? undefined}
                        size="sm"
                      />
                      <span className="min-w-0">
                        <span className="text-foreground-2 block truncate text-[12px]">
                          {formatName(owner?.first_name, owner?.last_name, "Unknown")}
                        </span>
                        <span className="text-faint block truncate text-[10.5px]">
                          {owner?.email ?? "—"}
                        </span>
                      </span>
                    </span>

                    <span className="text-foreground-2 tnum hidden text-[12px] lg:block">
                      {count}
                    </span>

                    <span className="hidden lg:block">
                      <span className="border-border text-foreground-2 rounded-full border px-2 py-0.5 text-[10.5px] font-medium">
                        {plan?.name ?? "No plan"}
                      </span>
                    </span>

                    <span className="flex justify-end">
                      <SubStatus status={sub?.status ?? null} />
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </Reveal>
      ) : tab === "people" ? (
        <Reveal index={2}>
          <div className="bg-surface border-border overflow-hidden rounded-panel border shadow-sm">
            <ul className="divide-border divide-y">
              <li className="bg-surface-subtle text-muted grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)_150px_110px]">
                <span>Person</span>
                <span className="hidden lg:block">Workspaces</span>
                <span className="hidden lg:block">Plan</span>
                <span className="text-right">Platform role</span>
              </li>

              {visibleProfiles.map((p) => {
                const theirs = householdsByUser.get(p.id) ?? [];
                const role = rolesByUser.get(p.id) ?? "user";
                const sub = subByUser.get(p.id) ?? null;
                const plan = sub ? planById.get(sub.plan_id) : null;
                const ends = periodEndsAt(sub);
                const left = daysUntil(ends);
                const tone = expiryTone(left);

                return (
                  <li
                    key={p.id}
                    className="hover:bg-surface-subtle/60 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2.5 transition-colors lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)_150px_110px]"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Avatar
                        name={formatName(p.first_name, p.last_name, "?")}
                        src={p.avatar_url ?? undefined}
                        size="sm"
                      />
                      <span className="min-w-0">
                        <span className="text-foreground block truncate text-[12.5px] font-medium">
                          {formatName(p.first_name, p.last_name, "Unnamed")}
                        </span>
                        <span className="text-faint block truncate text-[11px]">
                          {p.email ?? "no email"}
                        </span>
                      </span>
                    </span>

                    <span className="hidden min-w-0 lg:block">
                      <span className="text-foreground-2 block truncate text-[12px]">
                        {theirs.length === 0
                          ? "—"
                          : theirs.map((h) => h.name).join(" · ")}
                      </span>
                      <span className="text-faint block text-[10.5px] italic">
                        {theirs.length} workspace{theirs.length === 1 ? "" : "s"}
                      </span>
                    </span>

                    {/*
                      Plan, status and time remaining — the three things an
                      operator is asked about. Still no money: what someone pays
                      is a platform fact, what their household holds is not.
                    */}
                    <span className="hidden min-w-0 lg:block">
                      <button
                        type="button"
                        onClick={() => setGrantFor(p)}
                        className="border-border hover:border-brass hover:bg-surface-subtle flex w-full items-center gap-1.5 rounded-control border px-2 py-1 text-left transition-colors"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="text-foreground-2 block truncate text-[11.5px] font-medium">
                            {plan?.name ?? "No plan"}
                          </span>
                          <span
                            className={cn(
                              "block text-[10px] tabular-nums",
                              tone === "expired" || tone === "urgent"
                                ? "text-loss"
                                : tone === "soon"
                                  ? "text-brass-strong"
                                  : "text-faint",
                            )}
                          >
                            {subscriptionLabel(sub, plan?.code ?? "free")}
                            {left !== null && left > 0 && ` · ${left}d left`}
                          </span>
                        </span>
                        <Pencil size={11} className="text-faint shrink-0" />
                      </button>
                    </span>

                    <span className="flex justify-end">
                      <RoleChip role={role} />
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </Reveal>
      ) : tab === "plans" ? (
        <Reveal index={2}>
          <AdminPlanEditor />
        </Reveal>
      ) : (
        <Reveal index={2}>
          <AdminPlatformSettings emailKeyPresent={emailKeyPresent} />
        </Reveal>
      )}

      {/*
        Keyed on the person so opening a different row remounts the modal with
        their subscription. Re-seeding it with an effect would be a synchronous
        setState in an effect, which React Compiler rejects.
      */}
      <AdminGrantPlanModal
        key={grantFor?.id ?? "none"}
        isOpen={grantFor !== null}
        onClose={() => setGrantFor(null)}
        profile={grantFor}
        plans={plans}
        current={grantFor ? (subByUser.get(grantFor.id) ?? null) : null}
        onSaved={() => setRefresh((n) => n + 1)}
      />
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  footnote,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  footnote?: string;
}) {
  return (
    <div className="lift bg-surface border-border rounded-card border p-4 shadow-xs">
      <div className="text-brass-strong flex items-center gap-1.5">
        {icon}
        <span className="text-muted text-[11px] font-medium uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="font-display tnum mt-1.5 text-[22px] font-semibold">{value}</p>
      {footnote && <p className="text-faint mt-0.5 text-[11px]">{footnote}</p>}
    </div>
  );
}

function KindLabel({ kind }: { kind: HouseholdKind }) {
  const label = { personal: "Personal", family: "Family", business: "Business" }[kind];
  return <span>{label}</span>;
}

function SubStatus({ status }: { status: string | null }) {
  if (!status) {
    return (
      <span className="border-border text-faint rounded-full border px-2 py-0.5 text-[10px] font-medium">
        None
      </span>
    );
  }
  const label = {
    active: "Active",
    trialing: "Trial",
    past_due: "Past due",
    canceled: "Canceled",
  }[status] ?? status;

  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
        status === "active" && "bg-gain-soft text-gain",
        status === "trialing" && "bg-brass-soft text-brass-strong",
        status === "past_due" && "bg-loss-soft text-loss",
        status === "canceled" && "bg-surface-subtle text-muted",
      )}
    >
      {label}
    </span>
  );
}

function RoleChip({ role }: { role: AppRole }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
        role === "super_admin" && "bg-brass/20 text-brass-strong",
        role === "admin" && "bg-surface-subtle text-foreground-2 border-border border",
        role === "user" && "text-faint",
      )}
    >
      {role !== "user" && <ShieldCheck size={9} />}
      {role === "super_admin" ? "Super admin" : role === "admin" ? "Admin" : "User"}
    </span>
  );
}
