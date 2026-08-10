"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/types";

export default function CategorySettingsPage() {
  const supabase = createClient();
  const { showToast } = useToast();
  const session = useSession();
  const householdId = session.household?.id ?? "";

  const [categories, setCategories] = React.useState<Tables<"categories">[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [addModalOpen, setAddModalOpen] = React.useState(false);

  const [id, setId] = React.useState("");
  const [name, setName] = React.useState("");
  const [parentId, setParentId] = React.useState<string>("none");
  const [kind, setKind] = React.useState<"expense" | "income" | "transfer">("expense");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    async function loadCategories() {
      const { data } = await supabase
        .from("categories")
        .select("*")
        .order("name", { ascending: true });

      if (active && data) {
        setCategories(data);
        setLoading(false);
      }
    }
    loadCategories();
    return () => {
      active = false;
    };
  }, [supabase]);

  const parents = categories.filter((c) => !c.parent_id);
  const getSubcategories = (pId: string) => categories.filter((c) => c.parent_id === pId);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !id.trim()) {
      showToast({ type: "error", title: "Missing Fields", description: "Please enter category name and identifier." });
      return;
    }

    setSubmitting(true);

    // household_id is required. A NULL here means "system catalog row", which
    // RLS now restricts to platform admins -- and before that policy existed,
    // every custom category leaked into every other household's list.
    // The id is namespaced for the same reason: it is the primary key, so two
    // households both adding "Chai" would otherwise collide.
    const slug = id.toLowerCase().trim().replace(/\s+/g, "_");

    const { error } = await supabase.from("categories").insert({
      id: `h_${householdId.slice(0, 8)}_${slug}`,
      name: name.trim(),
      icon: "Tag",
      tone: 1,
      parent_id: parentId === "none" ? null : parentId,
      kind,
      household_id: householdId,
    });

    setSubmitting(false);

    if (error) {
      showToast({ type: "error", title: "Failed to Add Category", description: error.message });
      return;
    }

    showToast({ type: "success", title: "Category Added", description: `"${name}" created successfully.` });
    setName("");
    setId("");
    setAddModalOpen(false);

    // Refresh categories
    const { data } = await supabase.from("categories").select("*").order("name", { ascending: true });
    if (data) setCategories(data);
  };

  const parentOptions = [
    { value: "none", label: "None (Top-level Parent Category)" },
    ...parents.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Category Hierarchy</h2>
          <p className="text-muted text-xs">
            System and custom categories tailored for Pakistani household finances.
          </p>
        </div>
        <Button variant="primary" onClick={() => setAddModalOpen(true)} className="flex items-center gap-1.5">
          <Plus size={16} />
          <span>Add Custom Category</span>
        </Button>
      </div>

      {loading ? (
        <div className="bg-surface border-border rounded-panel border p-8 text-center text-muted text-xs">
          Loading categories...
        </div>
      ) : (
        <div className="space-y-4">
          {parents.map((parent) => {
            const subs = getSubcategories(parent.id);

            return (
              <div key={parent.id} className="bg-surface border-border rounded-panel border p-5 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-brass/10 text-brass flex items-center justify-center font-bold text-xs">
                      {parent.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-display text-sm font-bold">{parent.name}</h3>
                      <span className="text-muted text-[11px] capitalize">{parent.kind} category</span>
                    </div>
                  </div>
                  <span className="bg-surface-subtle border border-border text-muted text-[10px] rounded-full px-2.5 py-0.5 font-mono">
                    {subs.length} subcategories
                  </span>
                </div>

                {subs.length > 0 && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {subs.map((sub) => (
                      <div
                        key={sub.id}
                        className="bg-surface-subtle border border-border rounded-control p-2.5 flex items-center justify-between text-xs"
                      >
                        <span className="font-medium text-foreground">{sub.name}</span>
                        <span className="text-[10px] text-muted font-mono">{sub.id}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Category Modal */}
      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Add Category">
        <form onSubmit={handleAddCategory} className="space-y-4">
          <Input
            label="Category Name"
            placeholder="e.g. Solar Panel Maintenance"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!id) setId(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "_"));
            }}
            required
          />

          <Input
            label="Category Key (ID)"
            placeholder="e.g. solar_maint"
            value={id}
            onChange={(e) => setId(e.target.value)}
            required
          />

          <Select
            label="Parent Category (Optional)"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            options={parentOptions}
          />

          <Select
            label="Kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as "expense" | "income" | "transfer")}
            options={[
              { value: "expense", label: "Expense" },
              { value: "income", label: "Income" },
              { value: "transfer", label: "Transfer" },
            ]}
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              Create Category
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
