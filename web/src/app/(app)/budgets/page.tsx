"use client";

import * as React from "react";
import { Plus, CircleDollarSign, AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { PageActions } from "@/components/page-actions";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { formatPKR } from "@/lib/format";
import type { Tables } from "@/lib/supabase/types";

type BudgetWithCategory = Tables<"budgets"> & {
  categories?: Tables<"categories"> | null;
  spent_paisa?: number;
};

export default function BudgetsPage() {
  const session = useSession();
  const supabase = createClient();
  const { showToast } = useToast();

  const householdId = session.household?.id || "";

  const [budgets, setBudgets] = React.useState<BudgetWithCategory[]>([]);
  const [categories, setCategories] = React.useState<Tables<"categories">[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [addModalOpen, setAddModalOpen] = React.useState(false);

  const [selectedCategoryId, setSelectedCategoryId] = React.useState("");
  const [amountPKR, setAmountPKR] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    if (!householdId) return;

    async function loadBudgets() {
      // 1. Fetch categories
      const catRes = await supabase.from("categories").select("*").eq("kind", "expense");
      const categoryList = catRes.data || [];
      if (active) setCategories(categoryList);

      // 2. Fetch budgets
      const { data: budgetData } = await supabase
        .from("budgets")
        .select("*, categories(*)")
        .eq("household_id", householdId);

      // 3. Calculate spent for current month
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

      const { data: txData } = await supabase
        .from("transactions")
        .select("category_id, amount_paisa")
        .eq("household_id", householdId)
        .eq("type", "expense")
        .gte("date", startOfMonth);

      const spentMap: Record<string, number> = {};
      (txData || []).forEach((tx) => {
        if (tx.category_id) {
          spentMap[tx.category_id] = (spentMap[tx.category_id] || 0) + Math.abs(tx.amount_paisa);
        }
      });

      if (active && budgetData) {
        const enriched = (budgetData as unknown as BudgetWithCategory[]).map((b) => ({
          ...b,
          spent_paisa: spentMap[b.category_id] || 0,
        }));
        setBudgets(enriched);
        setLoading(false);
      }
    }

    loadBudgets();
    return () => {
      active = false;
    };
  }, [householdId, refreshKey, supabase]);

  const handleAddBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategoryId || !amountPKR) {
      showToast({ type: "error", title: "Missing fields", description: "Select category and budget amount." });
      return;
    }

    setSubmitting(true);
    const amountPaisa = Math.round(parseFloat(amountPKR) * 100);

    const { error } = await supabase.from("budgets").upsert({
      household_id: householdId,
      category_id: selectedCategoryId,
      period: "monthly",
      amount_paisa: amountPaisa,
      start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0],
    });

    setSubmitting(false);

    if (error) {
      showToast({ type: "error", title: "Failed to save budget", description: error.message });
      return;
    }

    showToast({ type: "success", title: "Budget Saved", description: "Category monthly budget updated." });
    setAmountPKR("");
    setAddModalOpen(false);
    setRefreshKey((k) => k + 1);
  };

  const totalBudgetedPaisa = budgets.reduce((sum, b) => sum + Number(b.amount_paisa), 0);
  const totalSpentPaisa = budgets.reduce((sum, b) => sum + Number(b.spent_paisa || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display truncate text-[19px] font-semibold tracking-[-0.02em] sm:text-[22px]">
            Budgets
          </h1>
          <p className="text-muted mt-0.5 text-[12.5px]">
            Monthly spending limits per category, with a warning before you cross one.
          </p>
        </div>

        <PageActions
          title="Budgets"
          actions={[
            {
              label: "Set budget",
              hint: "Cap what one category can take in a month",
              icon: Plus,
              tone: "primary",
              onClick: () => setAddModalOpen(true),
            },
          ]}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="bg-surface border border-border rounded-panel p-5 shadow-xs">
          <span className="text-muted text-xs font-semibold block">Total Monthly Budget</span>
          <span className="font-display text-xl font-bold mt-1 block text-foreground">
            {formatPKR(totalBudgetedPaisa)}
          </span>
        </div>

        <div className="bg-surface border border-border rounded-panel p-5 shadow-xs">
          <span className="text-muted text-xs font-semibold block">Spent This Month</span>
          <span className="font-display text-xl font-bold mt-1 block text-foreground">
            {formatPKR(totalSpentPaisa)}
          </span>
        </div>

        <div className="bg-surface border border-border rounded-panel p-5 shadow-xs">
          <span className="text-muted text-xs font-semibold block">Remaining Allocation</span>
          <span className="font-display text-xl font-bold mt-1 block text-brass">
            {formatPKR(Math.max(0, totalBudgetedPaisa - totalSpentPaisa))}
          </span>
        </div>
      </div>

      {/* Budget Cards List */}
      {loading ? (
        <div className="bg-surface border-border rounded-panel border p-8 text-center text-muted text-xs">
          Loading budgets...
        </div>
      ) : budgets.length === 0 ? (
        <div className="bg-surface border-border rounded-panel border p-12 text-center">
          <CircleDollarSign size={40} className="text-muted mx-auto mb-3" />
          <h3 className="font-display text-base font-semibold">No Category Budgets Set</h3>
          <p className="text-muted text-xs mt-1 max-w-sm mx-auto">
            Set spending limits for Kiryana, Fuel, Utilities, or Dining out.
          </p>
          <Button variant="primary" onClick={() => setAddModalOpen(true)} className="mt-4">
            + Set First Budget
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {budgets.map((budget) => {
            const limit = budget.amount_paisa / 100;
            const spent = (budget.spent_paisa || 0) / 100;
            const percent = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;

            let barColor = "bg-gain";
            if (percent >= 100) barColor = "bg-loss";
            else if (percent >= 80) barColor = "bg-brass";

            return (
              <div key={budget.id} className="bg-surface border border-border rounded-panel p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-bold text-foreground">
                    {budget.categories?.name || "Category"}
                  </h3>
                  <span className="text-xs font-semibold text-muted">
                    {Math.round(percent)}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2.5 bg-surface-subtle border border-border rounded-full overflow-hidden">
                  <div
                    className={`h-full ${barColor} transition-all duration-300`}
                    style={{ width: `${percent}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-muted font-mono">
                    Spent: {formatPKR(budget.spent_paisa || 0)}
                  </span>
                  <span className="font-bold font-mono text-foreground">
                    Limit: {formatPKR(budget.amount_paisa)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Budget Modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Set Category Budget"
        onSubmit={handleAddBudget}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              Save Budget
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Category"
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            options={[
              { value: "", label: "Select Category..." },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />

          <Input
            label="Monthly Limit (PKR)"
            placeholder="e.g. 50000"
            type="number"
            value={amountPKR}
            onChange={(e) => setAmountPKR(e.target.value)}
            required
          />

        </div>
      </Modal>
    </div>
  );
}
