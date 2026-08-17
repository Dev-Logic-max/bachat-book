"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { RichSelect } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";

import type { SubscriptionStatus, Tables } from "@/lib/supabase/types";

/**
 * Grant, extend or revoke a subscription by hand.
 *
 * This is how someone becomes Pro until a payment gateway is wired: you take
 * the money out of band and record the period here. It writes the same
 * `current_period_end` a gateway webhook eventually would, so the countdown, the
 * read-only rules and the plan page all behave identically either way — the only
 * thing that changes later is who writes the row.
 *
 * Goes through an RPC because `subscriptions` is deliberately not writable from
 * the client, or a user could point their own row at the pro plan.
 */
export function AdminGrantPlanModal({
  isOpen,
  onClose,
  profile,
  plans,
  current,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  profile: Tables<"profiles"> | null;
  plans: Tables<"plans">[];
  current: Tables<"subscriptions"> | null;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const { showToast } = useToast();

  const currentCode =
    plans.find((p) => p.id === current?.plan_id)?.code ?? "free";

  const [planCode, setPlanCode] = React.useState(currentCode);
  const [status, setStatus] = React.useState<SubscriptionStatus>(
    current?.status ?? "active",
  );
  const [endDate, setEndDate] = React.useState(
    current?.current_period_end?.slice(0, 10) ?? defaultEnd(),
  );
  const [trialEnd, setTrialEnd] = React.useState(
    current?.trial_ends_at?.slice(0, 10) ?? defaultTrialEnd(),
  );
  const [saving, setSaving] = React.useState(false);

  /*
    There is deliberately no effect re-seeding these fields when a different
    person is opened. React Compiler rejects a synchronous setState inside an
    effect, and the parent instead gives this component a `key` of the profile
    id — so opening someone else remounts it and the initialisers above run
    against the right subscription.
  */

  const isPaid = planCode !== "free";
  const isTrial = status === "trialing";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);
    const { error } = await supabase.rpc("admin_set_subscription", {
      _user_id: profile.id,
      _plan_code: planCode,
      _status: status,
      // A free plan carries no end date; that is what makes it permanent.
      _period_end:
        isPaid && status === "active" && endDate
          ? new Date(`${endDate}T23:59:59Z`).toISOString()
          : null,
      _trial_ends_at:
        isTrial && trialEnd ? new Date(`${trialEnd}T23:59:59Z`).toISOString() : null,
    });
    setSaving(false);

    if (error) {
      showToast({ type: "error", title: "Could not update plan", description: error.message });
      return;
    }

    showToast({
      type: "success",
      title: "Subscription updated",
      description: `${profile.email} is now on ${planCode}.`,
    });
    onSaved();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Change subscription"
      subtitle={profile?.email ?? ""}
      onSubmit={submit}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={saving}>
            Save subscription
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <RichSelect
          label="Plan"
          value={planCode}
          onChange={setPlanCode}
          options={plans.map((p) => ({
            value: p.code,
            label: p.name,
            description:
              p.price_monthly_paisa > 0
                ? `Rs ${(p.price_monthly_paisa / 100).toLocaleString("en-PK")} per month`
                : "No charge",
          }))}
        />

        <RichSelect
          label="Status"
          value={status}
          onChange={(v) => setStatus(v as SubscriptionStatus)}
          options={[
            { value: "active", label: "Active", description: "Paid and running" },
            { value: "trialing", label: "Trialing", description: "Free access until the trial date" },
            { value: "past_due", label: "Payment due", description: "Treated as lapsed — limits drop to free" },
            { value: "canceled", label: "Cancelled", description: "Treated as lapsed — limits drop to free" },
          ]}
        />

        {isTrial && (
          <Input
            label="Trial ends"
            type="date"
            value={trialEnd}
            onChange={(e) => setTrialEnd(e.target.value)}
            hint="Access drops to the free limits the moment this passes. No job runs — it is checked on read."
          />
        )}

        {isPaid && status === "active" && (
          <Input
            label="Renews on"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            hint="Required. Without a date the subscription would never expire."
          />
        )}

        {!isPaid && (
          <p className="text-muted bg-surface-subtle border-border rounded-card border p-3 text-[12px] leading-snug">
            Moving someone to free takes effect immediately. Any workspaces beyond
            the free allowance become view-only — nothing is deleted, and they come
            back in the same order if the plan is restored.
          </p>
        )}
      </div>
    </Modal>
  );
}

function defaultEnd() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

function defaultTrialEnd() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}
