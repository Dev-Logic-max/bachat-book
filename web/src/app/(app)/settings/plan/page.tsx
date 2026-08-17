"use client";

import * as React from "react";
import { Check, Sparkles, Zap } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { CheckoutModal, type BillingCycle } from "@/components/checkout-modal";
import { createClient } from "@/lib/supabase/client";
import { formatPKR } from "@/lib/format";
import {
  daysUntil,
  expiryTone,
  formatLimit,
  periodEndsAt,
  subscriptionLabel,
  yearlySavingPercent,
  type WorkspaceAccess,
} from "@/lib/plan";
import { cn } from "@/lib/utils";

import type { Tables } from "@/lib/supabase/types";

/** Rows shown on each plan card, read from the real `limits` keys. */
const FEATURES: { key: string; label: string }[] = [
  { key: "workspaces", label: "Workspaces" },
  { key: "household_members", label: "Seats per workspace" },
  { key: "accounts", label: "Accounts" },
  { key: "budget_categories", label: "Budget categories" },
  { key: "committees", label: "Committees" },
  { key: "receipts_per_month", label: "Receipts each month" },
];

export default function PlanSettingsPage() {
  const session = useSession();
  const supabase = createClient();

  const [plans, setPlans] = React.useState<Tables<"plans">[]>([]);
  const [workspaces, setWorkspaces] = React.useState<WorkspaceAccess[]>([]);
  const [cycle, setCycle] = React.useState<BillingCycle>("monthly");
  const [checkoutFor, setCheckoutFor] = React.useState<Tables<"plans"> | null>(null);
  const [supportEmail, setSupportEmail] = React.useState<string | undefined>();

  React.useEffect(() => {
    let active = true;

    Promise.all([
      supabase.from("plans").select("*").order("sort_order"),
      supabase.from("workspace_access").select("*"),
    ]).then(([p, w]) => {
      if (!active) return;
      if (p.data) setPlans(p.data);
      if (w.data) setWorkspaces(w.data);
    });

    return () => {
      active = false;
    };
  }, [supabase]);

  // Read separately and allowed to fail: this table is admin-only, so a normal
  // user simply gets no support address rather than an error.
  React.useEffect(() => {
    let active = true;
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "billing")
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        const v = data.value as { support_email?: string };
        if (v?.support_email) setSupportEmail(v.support_email);
      });
    return () => {
      active = false;
    };
  }, [supabase]);

  const sub = session.subscription;
  const currentCode = plans.find((p) => p.id === sub?.plan_id)?.code ?? "free";
  const statusLabel = subscriptionLabel(sub, currentCode);
  const ends = periodEndsAt(sub);
  const left = daysUntil(ends);
  const tone = expiryTone(left);

  const owned = workspaces.filter((w) => w.owner_id === session.user.id);
  const wsLimit = session.workspace?.workspace_limit ?? 2;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold">Plan and billing</h2>
        <p className="text-muted text-xs">What you are on, and what changes if you upgrade.</p>
      </div>

      {/* ---- Your plan ------------------------------------------------- */}
      <div className="bg-surface border-border rounded-panel border p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-faint text-[10px] font-semibold uppercase tracking-[0.14em]">
              Your plan
            </p>
            <p className="font-display mt-0.5 flex items-center gap-2 text-xl font-semibold">
              {plans.find((p) => p.code === currentCode)?.name ?? "Bachat"}
              {currentCode === "pro" && <Sparkles size={16} className="text-brass-strong" />}
            </p>
          </div>

          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold",
              tone === "expired"
                ? "bg-loss-soft text-loss"
                : tone === "urgent"
                  ? "bg-loss-soft text-loss"
                  : tone === "soon"
                    ? "bg-brass-soft text-brass-strong"
                    : "bg-surface-subtle text-muted",
            )}
          >
            {statusLabel}
          </span>
        </div>

        <dl className="border-border mt-4 grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
          <Fact label="Started" value={sub ? fmtDate(sub.created_at) : "—"} />
          <Fact
            label={sub?.status === "trialing" ? "Trial ends" : "Renews on"}
            value={ends ? fmtDate(ends) : "No end date"}
          />
          <Fact
            label="Time left"
            value={left === null ? "—" : left > 0 ? `${left} days` : "Ended"}
            tone={tone === "urgent" || tone === "expired" ? "loss" : undefined}
          />
          <Fact
            label="Workspaces"
            value={`${owned.length} of ${formatLimit(wsLimit)}`}
          />
        </dl>

        {/*
          Only shown when it is actually close. A countdown that is always there
          stops being read, and free never expires so it has nothing to count.
        */}
        {left !== null && left <= 14 && (
          <p
            className={cn(
              "mt-3 rounded-card border p-3 text-[12px] leading-snug",
              left <= 0
                ? "border-loss/25 bg-loss-soft text-loss"
                : "border-brass/30 bg-brass-soft text-brass-strong",
            )}
          >
            {left <= 0
              ? "Your plan has ended. You are on the free limits now — any workspaces beyond the first two are readable but cannot be edited. Nothing has been deleted."
              : `${left} day${left === 1 ? "" : "s"} left. When this ends you drop to the free limits, and any workspace beyond the first two becomes view-only. Everything in them stays readable.`}
          </p>
        )}
      </div>

      {/* ---- Compare ----------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {plans.map((plan) => {
          const isCurrent = plan.code === currentCode;
          const isPro = plan.code === "pro";
          const limits = (plan.limits ?? {}) as Record<string, number>;
          const price = cycle === "yearly" ? plan.price_yearly_paisa : plan.price_monthly_paisa;
          const saving = yearlySavingPercent(plan.price_monthly_paisa, plan.price_yearly_paisa);

          return (
            <div
              key={plan.id}
              className={cn(
                "bg-surface border-border flex flex-col rounded-panel border p-5 shadow-xs",
                isPro && "border-brass ring-brass ring-1",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-display flex items-center gap-2 text-lg font-semibold">
                  {plan.name}
                  {isPro && <Sparkles size={15} className="text-brass-strong" />}
                </span>
                {isCurrent && (
                  <span className="bg-navy-900 text-on-navy dark:bg-brass dark:text-navy-900 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    Current
                  </span>
                )}
              </div>

              {plan.description && (
                <p className="text-muted mt-1.5 text-[12px] leading-snug">{plan.description}</p>
              )}

              <div className="mt-4 flex items-baseline gap-1.5">
                <span className="font-display text-3xl font-semibold tabular-nums">
                  {price === 0 ? "Free" : formatPKR(price)}
                </span>
                {price > 0 && (
                  <span className="text-muted text-xs">
                    / {cycle === "yearly" ? "year" : "month"}
                  </span>
                )}
                {isPro && cycle === "yearly" && saving > 0 && (
                  <span className="bg-gain-soft text-gain ms-1 rounded-full px-2 py-0.5 text-[10px] font-bold">
                    save {saving}%
                  </span>
                )}
              </div>

              {isPro && (
                <div className="border-border bg-surface-subtle mt-3 flex gap-1 rounded-control border p-1">
                  {(["monthly", "yearly"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCycle(c)}
                      aria-pressed={cycle === c}
                      className={cn(
                        "flex-1 rounded-control px-2 py-1 text-[11.5px] font-medium capitalize transition-colors",
                        cycle === c
                          ? "bg-surface text-foreground shadow-xs"
                          : "text-muted hover:text-foreground",
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}

              <ul className="border-border mt-4 space-y-2.5 border-t pt-4 text-xs">
                {FEATURES.map((f) => (
                  <li key={f.key} className="flex items-center gap-2.5">
                    <Check size={15} className="text-gain shrink-0" />
                    <span className="text-foreground-2">
                      <strong className="text-foreground">{formatLimit(limits[f.key])}</strong>{" "}
                      {f.label.toLowerCase()}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-5 pt-1">
                {isCurrent ? (
                  <Button variant="secondary" className="w-full" disabled>
                    Your current plan
                  </Button>
                ) : isPro ? (
                  <Button
                    variant="brass"
                    className="w-full gap-2"
                    onClick={() => setCheckoutFor(plan)}
                  >
                    <Zap size={15} />
                    Upgrade to {plan.name}
                  </Button>
                ) : (
                  <Button variant="secondary" className="w-full" disabled>
                    Included
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-faint text-[11px]">
        Prices are in Pakistani rupees. Downgrading never deletes anything — workspaces
        beyond the free allowance become view-only, and come back in the same order if
        you subscribe again.
      </p>

      <CheckoutModal
        isOpen={checkoutFor !== null}
        onClose={() => setCheckoutFor(null)}
        plan={checkoutFor}
        cycle={cycle}
        onCycleChange={setCycle}
        supportEmail={supportEmail}
      />
    </div>
  );
}

function Fact({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "loss";
}) {
  return (
    <div>
      <dt className="text-faint text-[10px] font-semibold uppercase tracking-[0.12em]">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-0.5 text-[13px] font-medium tabular-nums",
          tone === "loss" ? "text-loss" : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
