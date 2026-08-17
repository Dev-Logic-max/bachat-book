"use client";

import * as React from "react";
import { Wand2, Plus, Trash2 } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/types";

type RuleFull = Tables<"rules"> & {
  categories?: Tables<"categories"> | null;
  merchants?: Tables<"merchants"> | null;
};

export default function RulesSettingsPage() {
  const session = useSession();
  const supabase = createClient();
  const { showToast } = useToast();

  const householdId = session.household?.id || "";

  const [rules, setRules] = React.useState<RuleFull[]>([]);
  const [categories, setCategories] = React.useState<Tables<"categories">[]>([]);
  const [merchants, setMerchants] = React.useState<Tables<"merchants">[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [addModalOpen, setAddModalOpen] = React.useState(false);

  const [pattern, setPattern] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [merchantId, setMerchantId] = React.useState("none");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    if (!householdId) return;

    async function loadData() {
      const [rRes, cRes, mRes] = await Promise.all([
        supabase
          .from("rules")
          .select("*, categories(*), merchants(*)")
          .eq("household_id", householdId)
          .order("created_at", { ascending: false }),
        supabase
          .from("categories")
          .select("*")
          .order("sort_order")
          .order("name"),
        supabase.from("merchants").select("*").order("name", { ascending: true }),
      ]);

      if (active) {
        if (rRes.data) setRules(rRes.data as unknown as RuleFull[]);
        if (cRes.data) {
          setCategories(cRes.data);
          if (cRes.data.length > 0 && !categoryId) setCategoryId(cRes.data[0].id);
        }
        if (mRes.data) setMerchants(mRes.data);
        setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [householdId, categoryId, supabase]);

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pattern.trim()) {
      showToast({ type: "error", title: "Missing Pattern", description: "Please enter text match pattern." });
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.from("rules").insert({
      household_id: householdId,
      pattern: pattern.trim(),
      category_id: categoryId,
      merchant_id: merchantId === "none" ? null : merchantId,
    });

    setSubmitting(false);

    if (error) {
      showToast({ type: "error", title: "Error Creating Rule", description: error.message });
      return;
    }

    showToast({ type: "success", title: "Rule Created", description: `Pattern "${pattern}" will auto-categorize.` });
    setPattern("");
    setAddModalOpen(false);

    // Refresh rules
    const { data } = await supabase
      .from("rules")
      .select("*, categories(*), merchants(*)")
      .eq("household_id", householdId)
      .order("created_at", { ascending: false });

    if (data) setRules(data as unknown as RuleFull[]);
  };

  const handleDeleteRule = async (id: string) => {
    const { error } = await supabase.from("rules").delete().eq("id", id);
    if (error) {
      showToast({ type: "error", title: "Could not delete rule", description: error.message });
      return;
    }
    showToast({ type: "success", title: "Rule Deleted", description: "Automation rule removed." });
    setRules(rules.filter((r) => r.id !== id));
  };

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));
  const merchantOptions = [
    { value: "none", label: "None" },
    ...merchants.map((m) => ({ value: m.id, label: m.name })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Categorization Rules</h2>
          <p className="text-muted text-xs">
            Auto-categorize transactions matching text patterns or merchant keywords.
          </p>
        </div>
        <Button variant="primary" onClick={() => setAddModalOpen(true)} className="flex items-center gap-1.5">
          <Plus size={16} />
          <span>Add Rule</span>
        </Button>
      </div>

      {loading ? (
        <div className="bg-surface border-border rounded-panel border p-8 text-center text-muted text-xs">
          Loading automation rules...
        </div>
      ) : rules.length === 0 ? (
        <div className="bg-surface border-border rounded-panel border p-12 text-center">
          <Wand2 size={40} className="text-muted mx-auto mb-3" />
          <h3 className="font-display text-base font-semibold">No Rules Created Yet</h3>
          <p className="text-muted text-xs mt-1 max-w-sm mx-auto">
            Create rules like &quot;K-Electric&quot; to auto-assign categories to future transactions.
          </p>
          <Button variant="primary" onClick={() => setAddModalOpen(true)} className="mt-4">
            + Create First Rule
          </Button>
        </div>
      ) : (
        <div className="bg-surface border-border rounded-panel border overflow-hidden shadow-sm">
          <div className="divide-y divide-border">
            {rules.map((rule) => (
              <div key={rule.id} className="p-4 flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brass/10 text-brass flex items-center justify-center font-bold">
                    <Wand2 size={16} />
                  </div>
                  <div>
                    <span className="font-mono text-xs font-semibold bg-surface-subtle border border-border px-2 py-0.5 rounded">
                      &quot;{rule.pattern}&quot;
                    </span>
                    <span className="text-muted mx-2">assigns to</span>
                    <span className="font-semibold text-foreground">{rule.categories?.name}</span>
                    {rule.merchants && (
                      <span className="text-muted text-[11px] ml-2">({rule.merchants.name})</span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteRule(rule.id)}
                  className="p-1.5 text-muted hover:text-loss rounded-full transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Rule Modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Create Automation Rule"
        onSubmit={handleAddRule}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              Save Rule
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="If Text Pattern Contains..."
            placeholder="e.g. K-Electric, Foodpanda, Imtiaz"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            required
          />

          <Select
            label="Assign to Category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            options={categoryOptions}
          />

          <Select
            label="Assign to Merchant (Optional)"
            value={merchantId}
            onChange={(e) => setMerchantId(e.target.value)}
            options={merchantOptions}
          />

        </div>
      </Modal>
    </div>
  );
}
