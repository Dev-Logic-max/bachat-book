"use client";

import * as React from "react";
import { Check, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { formatPKR } from "@/lib/format";
import { yearlySavingPercent } from "@/lib/plan";

import type { Json, Tables } from "@/lib/supabase/types";

/** The limits an operator actually changes. Others stay in the jsonb untouched. */
const LIMIT_FIELDS: { key: string; label: string; hint: string }[] = [
  { key: "workspaces", label: "Workspaces", hint: "Separate sets of books one person may own" },
  { key: "household_members", label: "Seats per workspace", hint: "Counts the owner" },
  { key: "accounts", label: "Accounts", hint: "−1 for unlimited" },
  { key: "budget_categories", label: "Budget categories", hint: "−1 for unlimited" },
  { key: "committees", label: "Committees", hint: "−1 for unlimited" },
  { key: "receipts_per_month", label: "Receipts per month", hint: "−1 for unlimited" },
  { key: "trial_days", label: "Trial days", hint: "New signups get this many days of Pro. 0 turns trials off." },
];

/**
 * Prices and limits, editable without a migration.
 *
 * Money is entered in RUPEES and stored in PAISA. That conversion is exactly
 * where the original error came from — Pro was stored as 90000000, which is
 * Rs 900,000/month rather than Rs 900 — so every price field echoes back the
 * formatted value it is about to save. Getting it wrong should be visible
 * before you press the button, not after a customer sees the pricing page.
 */
export function AdminPlanEditor() {
  const supabase = createClient();
  const { showToast } = useToast();

  const [plans, setPlans] = React.useState<Tables<"plans">[] | null>(null);
  const [reload, setReload] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    supabase
      .from("plans")
      .select("*")
      .order("sort_order")
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          showToast({ type: "error", title: "Could not load plans", description: error.message });
          setPlans([]);
          return;
        }
        setPlans(data ?? []);
      });
    return () => {
      active = false;
    };
  }, [supabase, reload, showToast]);

  if (plans === null) {
    return <div className="bg-surface border-border shimmer rounded-panel h-64 border" />;
  }

  return (
    <div className="space-y-4">
      {plans.map((p) => (
        <PlanCard key={p.id} plan={p} onSaved={() => setReload((n) => n + 1)} />
      ))}
    </div>
  );
}

function PlanCard({ plan, onSaved }: { plan: Tables<"plans">; onSaved: () => void }) {
  const supabase = createClient();
  const { showToast } = useToast();

  const limits = (plan.limits ?? {}) as Record<string, Json>;

  const [name, setName] = React.useState(plan.name);
  const [description, setDescription] = React.useState(plan.description ?? "");
  // Rupees in the field, paisa in the database.
  const [monthly, setMonthly] = React.useState(String(plan.price_monthly_paisa / 100));
  const [yearly, setYearly] = React.useState(String(plan.price_yearly_paisa / 100));
  const [limitValues, setLimitValues] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      LIMIT_FIELDS.map((f) => [f.key, String(limits[f.key] ?? (f.key === "trial_days" ? 0 : 0))]),
    ),
  );
  const [saving, setSaving] = React.useState(false);

  const monthlyPaisa = Math.round((parseFloat(monthly) || 0) * 100);
  const yearlyPaisa = Math.round((parseFloat(yearly) || 0) * 100);
  const saving20 = yearlySavingPercent(monthlyPaisa, yearlyPaisa);

  // A yearly price above twelve months is not a discount, it is a typo.
  const yearlyTooHigh = monthlyPaisa > 0 && yearlyPaisa > monthlyPaisa * 12;

  const save = async () => {
    if (yearlyTooHigh) {
      showToast({
        type: "error",
        title: "Yearly price is higher than 12 months",
        description: "That would cost more than paying monthly.",
      });
      return;
    }

    setSaving(true);
    const nextLimits: Record<string, Json> = { ...limits };
    for (const f of LIMIT_FIELDS) {
      const raw = limitValues[f.key];
      if (raw !== undefined && raw !== "") nextLimits[f.key] = parseInt(raw, 10);
    }

    const { error } = await supabase
      .from("plans")
      .update({
        name: name.trim(),
        description: description.trim() || null,
        price_monthly_paisa: monthlyPaisa,
        price_yearly_paisa: yearlyPaisa,
        limits: nextLimits as Json,
      })
      .eq("id", plan.id);

    setSaving(false);

    if (error) {
      showToast({ type: "error", title: "Could not save plan", description: error.message });
      return;
    }
    showToast({
      type: "success",
      title: `${name} saved`,
      description: monthlyPaisa > 0 ? `${formatPKR(monthlyPaisa)} per month` : "Free plan updated",
    });
    onSaved();
  };

  return (
    <div className="bg-surface border-border rounded-panel border p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold">{plan.name}</h3>
          <code className="text-faint text-[11px]">{plan.code}</code>
        </div>
        <Button variant="primary" size="sm" onClick={save} disabled={saving}>
          {saving ? (
            <Loader2 size={14} className="me-1.5 animate-spin" />
          ) : (
            <Check size={14} className="me-1.5" />
          )}
          Save
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Display name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Shown on the plan page"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Input
            label="Monthly price (Rs)"
            inputMode="decimal"
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
          />
          {/*
            The echo IS the guardrail. Typing 79900 here instead of 799 is the
            same slip that put Rs 900,000/month into production, and the only
            thing that catches it is seeing the formatted figure first.
          */}
          <p className="text-faint mt-1 text-[11px] tabular-nums">
            Saves as {monthlyPaisa.toLocaleString("en-PK")} paisa ={" "}
            <strong className="text-foreground-2">{formatPKR(monthlyPaisa)}</strong> per month
          </p>
        </div>

        <div>
          <Input
            label="Yearly price (Rs)"
            inputMode="decimal"
            value={yearly}
            onChange={(e) => setYearly(e.target.value)}
            error={yearlyTooHigh ? "Higher than paying monthly for 12 months" : undefined}
          />
          <p className="text-faint mt-1 text-[11px] tabular-nums">
            {formatPKR(yearlyPaisa)} per year
            {saving20 > 0 && (
              <span className="text-gain font-semibold"> · saves {saving20}%</span>
            )}
          </p>
        </div>
      </div>

      <div className="border-border mt-5 border-t pt-4">
        <p className="text-faint mb-3 text-[10px] font-semibold uppercase tracking-[0.14em]">
          Limits
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {LIMIT_FIELDS.map((f) => (
            <div key={f.key}>
              <Input
                label={f.label}
                inputMode="numeric"
                value={limitValues[f.key] ?? ""}
                onChange={(e) =>
                  setLimitValues((v) => ({ ...v, [f.key]: e.target.value }))
                }
              />
              <p className="text-faint mt-1 text-[10.5px] leading-snug">{f.hint}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
