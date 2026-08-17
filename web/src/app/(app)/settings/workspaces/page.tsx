"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Home, Plus, CheckCircle2, Shield } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/types";

export default function WorkspacesSettingsPage() {
  const session = useSession();
  const router = useRouter();
  const { showToast } = useToast();
  const supabase = createClient();

  const [households, setHouseholds] = React.useState<(Tables<"households"> & { userRole: string })[]>([]);

  const [createModalOpen, setCreateModalOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [kind, setKind] = React.useState<"personal" | "family" | "business">("family");
  const [submitting, setSubmitting] = React.useState(false);

  const [refreshKey, setRefreshKey] = React.useState(0);
  const defaultHouseholdId = session.preferences?.default_household_id;

  React.useEffect(() => {
    let active = true;
    supabase
      .from("household_members")
      .select("role, households(*)")
      .eq("user_id", session.user.id)
      .then(({ data }) => {
        if (active && data) {
          const list = data.map((item: Record<string, unknown>) => ({
            ...(item.households as Tables<"households">),
            userRole: item.role as string,
          }));
          setHouseholds(list);
        }
      });

    return () => {
      active = false;
    };
  }, [refreshKey, session.user.id, supabase]);

  const reloadWorkspaces = () => setRefreshKey((k) => k + 1);

  const handleSwitchDefault = async (householdId: string) => {
    const { error } = await supabase
      .from("preferences")
      .update({ default_household_id: householdId })
      .eq("user_id", session.user.id);

    if (error) {
      showToast({ type: "error", title: "Could not switch workspace", description: error.message });
      return;
    }

    showToast({ type: "success", title: "Active workspace updated", description: "Default household updated." });
    router.refresh();
    reloadWorkspaces();
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);

    // Insert new household
    const { data: h, error: hErr } = await supabase
      .from("households")
      .insert({
        name: name.trim(),
        kind,
        owner_id: session.user.id,
        base_currency: "PKR",
      })
      .select()
      .single();

    if (hErr || !h) {
      setSubmitting(false);
      // The workspace cap is a database trigger, so this is where a user on the
      // free plan trying for a third workspace lands. Its message already names
      // the allowance, which beats a generic "Error creating workspace".
      showToast({
        type: "error",
        title: "Could not create workspace",
        description: hErr?.message ?? "Something went wrong.",
      });
      return;
    }

    // Add owner member
    await supabase.from("household_members").insert({
      household_id: h.id,
      user_id: session.user.id,
      role: "owner",
    });

    // No subscription insert: plans belong to the USER, not the workspace. This
    // workspace inherits the plan of whoever owns it.

    setSubmitting(false);
    showToast({ type: "success", title: "Workspace created", description: `"${name}" is ready to use.` });
    setName("");
    setCreateModalOpen(false);
    reloadWorkspaces();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Your Workspaces</h2>
          <p className="text-muted text-xs">
            Manage your personal, family, or business households.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setCreateModalOpen(true)}>
          <Plus size={15} className="me-1" />
          Create Workspace
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {households.map((h) => {
          const isDefault = h.id === defaultHouseholdId;
          return (
            <div
              key={h.id}
              className={`bg-surface border-border flex flex-col justify-between rounded-card border p-5 transition-all shadow-xs ${
                isDefault ? "ring-2 ring-navy-900 dark:ring-brass" : ""
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-base font-semibold truncate">
                    {h.name}
                  </span>
                  {isDefault && (
                    <span className="bg-navy-900 text-on-navy dark:bg-brass dark:text-navy-900 flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold">
                      <CheckCircle2 size={12} /> Active
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-4 text-xs text-muted">
                  <span className="capitalize flex items-center gap-1">
                    <Home size={13} /> {h.kind}
                  </span>
                  <span className="capitalize flex items-center gap-1">
                    <Shield size={13} /> {h.userRole}
                  </span>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                {!isDefault ? (
                  <button
                    onClick={() => handleSwitchDefault(h.id)}
                    className="text-brass-strong text-xs font-semibold hover:underline"
                  >
                    Set as Active
                  </button>
                ) : (
                  <span className="text-faint text-xs">Currently selected</span>
                )}

                <span className="text-faint text-xs">{h.base_currency}</span>
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create New Workspace"
        subtitle="Separate your personal, family, or business transactions"
        onSubmit={handleCreateWorkspace}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              Create Workspace
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Workspace Name"
            placeholder="e.g. Khan Household / Freelance Agency"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />

          <Select
            label="Workspace Type"
            value={kind}
            onChange={(e) => setKind(e.target.value as "personal" | "family" | "business")}
            options={[
              { value: "family", label: "Family Household" },
              { value: "personal", label: "Personal Finances" },
              { value: "business", label: "Business / Freelance" },
            ]}
          />

        </div>
      </Modal>
    </div>
  );
}
