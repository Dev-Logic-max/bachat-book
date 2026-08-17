"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, CheckCircle2, EyeOff, Plus, Shield, User, Users } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { WorkspaceMembers } from "@/components/workspace-members";
import { WorkspacePresetPicker } from "@/components/workspace-preset-picker";
import { createClient } from "@/lib/supabase/client";
import { formatLimit, isUnlimited, type WorkspaceAccess } from "@/lib/plan";
import { presetByKey, type WorkspacePreset } from "@/lib/modules";
import { cn } from "@/lib/utils";

import type { HouseholdKind } from "@/lib/supabase/types";

const KIND_ICON: Record<HouseholdKind, typeof User> = {
  personal: User,
  family: Users,
  business: Building2,
};

export default function WorkspacesSettingsPage() {
  const session = useSession();
  const router = useRouter();
  const { showToast } = useToast();
  const supabase = createClient();

  const [rows, setRows] = React.useState<WorkspaceAccess[] | null>(null);
  const [reload, setReload] = React.useState(0);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  // The preset is what the user picks; `kind` is derived from it. Keeping the
  // behavioural discriminator at three values is the whole point of having both.
  const [preset, setPreset] = React.useState<WorkspacePreset>("family");
  const [submitting, setSubmitting] = React.useState(false);

  const defaultHouseholdId = session.preferences?.default_household_id;

  React.useEffect(() => {
    let active = true;
    supabase
      .from("workspace_access")
      .select("*")
      .order("owner_rank")
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          showToast({
            type: "error",
            title: "Could not load workspaces",
            description: error.message,
          });
          setRows([]);
          return;
        }
        setRows(data ?? []);
      });
    return () => {
      active = false;
    };
  }, [reload, supabase, showToast]);

  const refresh = () => setReload((n) => n + 1);

  const owned = rows?.filter((r) => r.owner_id === session.user.id) ?? [];
  const limit = session.workspace?.workspace_limit ?? 2;
  const atLimit = !isUnlimited(limit) && owned.length >= limit;

  const handleSwitchDefault = async (id: string) => {
    const { error } = await supabase
      .from("preferences")
      .update({ default_household_id: id })
      .eq("user_id", session.user.id);

    if (error) {
      showToast({ type: "error", title: "Could not switch workspace", description: error.message });
      return;
    }
    showToast({ type: "success", title: "Active workspace updated" });
    router.refresh();
    refresh();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    const { data: h, error } = await supabase
      .from("households")
      .insert({
        name: name.trim(),
        // Derived, never picked directly: seven presets map onto three kinds.
        kind: presetByKey(preset).kind,
        preset,
        owner_id: session.user.id,
        base_currency: "PKR",
      })
      .select()
      .single();

    if (error || !h) {
      setSubmitting(false);
      // The workspace cap is a database trigger, and its message already names
      // the allowance — better copy than a generic failure.
      showToast({
        type: "error",
        title: "Could not create workspace",
        description: error?.message ?? "Something went wrong.",
      });
      return;
    }

    await supabase.from("household_members").insert({
      household_id: h.id,
      user_id: session.user.id,
      role: "owner",
    });

    // No subscription row: plans belong to the USER, and this workspace runs on
    // whichever plan its owner is on.
    setSubmitting(false);
    showToast({ type: "success", title: "Workspace created", description: `"${name}" is ready.` });
    setName("");
    setCreateOpen(false);
    refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Your workspaces</h2>
          <p className="text-muted text-xs">
            {owned.length} of {formatLimit(limit)} on your plan
            {atLimit && " · limit reached"}
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          disabled={atLimit}
          title={atLimit ? "Upgrade to create another workspace" : undefined}
          onClick={() => setCreateOpen(true)}
        >
          <Plus size={15} className="me-1" />
          Create workspace
        </Button>
      </div>

      <div className="space-y-4">
        {rows === null ? (
          <div className="bg-surface border-border shimmer rounded-panel h-32 border" />
        ) : (
          rows.map((w) => {
            const isDefault = w.id === defaultHouseholdId;
            const isOwner = w.owner_id === session.user.id;
            const Icon = KIND_ICON[w.kind] ?? Users;

            return (
              <div key={w.id} className="space-y-3">
                <div
                  className={cn(
                    "bg-surface border-border rounded-card border p-5 shadow-xs",
                    isDefault && "ring-navy-900 dark:ring-brass ring-2",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="bg-brass-soft text-brass-strong flex size-9 shrink-0 items-center justify-center rounded-card">
                        <Icon size={16} strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0">
                        <p className="font-display truncate text-base font-semibold">
                          {w.name}
                        </p>
                        <p className="text-muted flex flex-wrap items-center gap-x-3 text-xs capitalize">
                          <span>{w.kind}</span>
                          <span className="flex items-center gap-1">
                            <Shield size={12} />
                            {isOwner ? "owner" : "member"}
                          </span>
                          {w.plan_code === "pro" && (
                            <span className="text-brass-strong font-semibold">Pro</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {!w.is_active && (
                        <span className="bg-loss-soft text-loss flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold">
                          <EyeOff size={11} />
                          View only
                        </span>
                      )}
                      {isDefault && (
                        <span className="bg-navy-900 text-on-navy dark:bg-brass dark:text-navy-900 flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold">
                          <CheckCircle2 size={12} /> Active
                        </span>
                      )}
                    </div>
                  </div>

                  {!w.is_active && (
                    <p className="text-muted border-border mt-3 border-t pt-3 text-[11.5px] leading-snug">
                      Beyond your plan&apos;s allowance of {formatLimit(w.workspace_limit)}{" "}
                      workspaces. Everything in it is safe and readable — it just cannot be
                      edited until you upgrade.
                    </p>
                  )}

                  {!isDefault && (
                    <div className="border-border mt-4 border-t pt-3">
                      <button
                        onClick={() => handleSwitchDefault(w.id)}
                        className="text-brass-strong text-xs font-semibold hover:underline"
                      >
                        Switch to this workspace
                      </button>
                    </div>
                  )}
                </div>

                <WorkspaceMembers
                  householdId={w.id}
                  isOwner={isOwner}
                  memberLimit={w.member_limit}
                  isActive={w.is_active}
                  onChanged={refresh}
                />
              </div>
            );
          })
        )}
      </div>

      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create a workspace"
        subtitle="Keep separate books for a family, a business or yourself"
        onSubmit={handleCreate}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              Create workspace
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Name first, then the type — the order you asked for. */}
          <Input
            label="Workspace name"
            placeholder="e.g. Khan Household"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />

          <WorkspacePresetPicker value={preset} onChange={setPreset} />
        </div>
      </Modal>
    </div>
  );
}
