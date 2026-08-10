"use client";

import * as React from "react";
import { Check, Zap, Sparkles } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { formatPKR } from "@/lib/format";
import type { Tables } from "@/lib/supabase/types";

export default function PlanSettingsPage() {
  const session = useSession();
  const { showToast } = useToast();
  const supabase = createClient();

  const [plans, setPlans] = React.useState<Tables<"plans">[]>([]);

  const currentPlanId = session.subscription?.plan_id;

  React.useEffect(() => {
    async function fetchPlans() {
      const { data } = await supabase
        .from("plans")
        .select("*")
        .order("sort_order", { ascending: true });

      if (data) setPlans(data);
    }
    fetchPlans();
  }, [supabase]);

  const handleUpgrade = (planName: string) => {
    showToast({
      type: "info",
      title: `${planName} Upgrade`,
      description: "Online payment gateway integration (JazzCash / EasyPaisa / Card) is coming soon!",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold">Subscription & Plan Tiers</h2>
        <p className="text-muted text-xs">
          Compare features and limits for Bachat Book plans.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId || (plan.code === "free" && !currentPlanId);
          const isPro = plan.code === "pro";
          const limits = (plan.limits as Record<string, unknown>) || {};

          return (
            <div
              key={plan.id}
              className={`bg-surface border-border flex flex-col justify-between rounded-panel border p-6 shadow-md transition-all ${
                isPro ? "border-brass ring-1 ring-brass" : ""
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-display text-xl font-bold flex items-center gap-2">
                    {plan.name}
                    {isPro && <Sparkles size={18} className="text-brass-strong" />}
                  </span>
                  {isCurrent && (
                    <span className="bg-navy-900 text-on-navy dark:bg-brass dark:text-navy-900 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider">
                      Current Plan
                    </span>
                  )}
                </div>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="font-display text-3xl font-bold">
                    {plan.price_monthly_paisa === 0
                      ? "Free"
                      : formatPKR(plan.price_monthly_paisa)}
                  </span>
                  {plan.price_monthly_paisa > 0 && (
                    <span className="text-muted text-xs">/ month</span>
                  )}
                </div>

                {/* Features & Limits */}
                <ul className="mt-6 space-y-3 border-t border-border pt-5 text-xs">
                  <li className="flex items-center gap-2.5">
                    <Check size={16} className="text-gain shrink-0" />
                    <span>
                      <strong>{String(limits.households ?? "Unlimited")}</strong> Household workspaces
                    </span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check size={16} className="text-gain shrink-0" />
                    <span>
                      <strong>{String(limits.members_per_household ?? "Unlimited")}</strong> Members per household
                    </span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check size={16} className="text-gain shrink-0" />
                    <span>
                      <strong>{String(limits.accounts ?? "Unlimited")}</strong> Accounts & Banks
                    </span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check size={16} className="text-gain shrink-0" />
                    <span>FBR Tax Filer optimization engine</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check size={16} className="text-gain shrink-0" />
                    <span>Committee circle tracking</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-4">
                {isCurrent ? (
                  <Button variant="secondary" className="w-full" disabled>
                    Active Plan
                  </Button>
                ) : (
                  <Button
                    variant="brass"
                    className="w-full gap-2"
                    onClick={() => handleUpgrade(plan.name)}
                  >
                    <Zap size={16} />
                    Upgrade to {plan.name}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
