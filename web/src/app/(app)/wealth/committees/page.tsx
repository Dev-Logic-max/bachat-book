"use client";

import * as React from "react";
import { Users, Plus, Calendar, CheckCircle2, Circle, Trash2, ShieldCheck } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { PageActions } from "@/components/page-actions";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { formatPKR } from "@/lib/format";
import type { Tables } from "@/lib/supabase/types";

export default function CommitteesPage() {
  const session = useSession();
  const supabase = createClient();
  const { showToast } = useToast();

  const householdId = session.household?.id || "";

  const [committees, setCommittees] = React.useState<Tables<"committees">[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [addModalOpen, setAddModalOpen] = React.useState(false);

  const [name, setName] = React.useState("");
  const [totalMembers, setTotalMembers] = React.useState("10");
  const [monthlyContribution, setMonthlyContribution] = React.useState("50000");
  const [startDate, setStartDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [myPayoutMonth, setMyPayoutMonth] = React.useState("6");
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    if (!householdId) return;

    async function loadCommittees() {
      const { data } = await supabase
        .from("committees")
        .select("*")
        .eq("household_id", householdId);

      if (active && data) {
        setCommittees(data);
        setLoading(false);
      }
    }

    loadCommittees();
    return () => {
      active = false;
    };
  }, [householdId, supabase]);

  const handleAddCommittee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !monthlyContribution) {
      showToast({ type: "error", title: "Missing fields", description: "Enter committee name & monthly contribution." });
      return;
    }

    setSubmitting(true);
    const contributionPaisa = Math.round(parseFloat(monthlyContribution) * 100);

    const { error } = await supabase.from("committees").insert({
      household_id: householdId,
      name: name.trim(),
      total_members: parseInt(totalMembers) || 10,
      monthly_contribution_paisa: contributionPaisa,
      start_date: startDate,
      my_payout_month: parseInt(myPayoutMonth) || 1,
      notes: notes.trim() || null,
    });

    setSubmitting(false);

    if (error) {
      showToast({ type: "error", title: "Add Failed", description: error.message });
      return;
    }

    showToast({ type: "success", title: "Committee Created", description: `"${name}" added.` });
    setName("");
    setAddModalOpen(false);

    const { data } = await supabase.from("committees").select("*").eq("household_id", householdId);
    if (data) setCommittees(data);
  };

  const handleTogglePayout = async (committee: Tables<"committees">) => {
    const nextStatus = !committee.payout_received;
    setCommittees(
      committees.map((c) => (c.id === committee.id ? { ...c, payout_received: nextStatus } : c))
    );

    await supabase.from("committees").update({ payout_received: nextStatus }).eq("id", committee.id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display truncate text-[19px] font-semibold tracking-[-0.02em] sm:text-[22px]">
            Committee
          </h1>
          <p className="text-muted mt-0.5 text-[12.5px]">
            Your BC pools — monthly instalments, members, and the month your payout
            lands.
          </p>
        </div>

        <PageActions
          title="Committee"
          actions={[
            {
              label: "Create committee",
              hint: "A new BC pool with its members and draw month",
              icon: Plus,
              tone: "primary",
              onClick: () => setAddModalOpen(true),
            },
          ]}
        />
      </div>

      {loading ? (
        <div className="bg-surface border-border rounded-panel border p-8 text-center text-muted text-xs">
          Loading committees...
        </div>
      ) : committees.length === 0 ? (
        <div className="bg-surface border-border rounded-panel border p-12 text-center">
          <Users size={40} className="text-muted mx-auto mb-3" />
          <h3 className="font-display text-base font-semibold">No Active Committees</h3>
          <p className="text-muted text-xs mt-1 max-w-sm mx-auto">
            Create a Bachat Committee pool to track your monthly contributions & payout month.
          </p>
          <Button variant="primary" onClick={() => setAddModalOpen(true)} className="mt-4">
            + Create First Committee
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {committees.map((committee) => {
            const totalPoolPaisa = committee.monthly_contribution_paisa * committee.total_members;

            return (
              <div key={committee.id} className="bg-surface border border-border rounded-panel p-5 shadow-sm space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
                    <h3 className="font-display text-base font-bold text-foreground">{committee.name}</h3>
                    <button
                      type="button"
                      onClick={() => handleTogglePayout(committee)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ${
                        committee.payout_received
                          ? "bg-gain-subtle text-gain border-gain/20"
                          : "bg-brass/10 text-brass-strong border-brass/20"
                      }`}
                    >
                      {committee.payout_received ? "Payout Received" : "Payout Pending"}
                    </button>
                  </div>

                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted">Total Pool Amount:</span>
                      <span className="font-display font-bold text-foreground">{formatPKR(totalPoolPaisa)}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-muted">My Monthly Installment:</span>
                      <span className="font-mono text-foreground font-semibold">{formatPKR(committee.monthly_contribution_paisa)}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-muted">Draw Month:</span>
                      <span className="font-semibold text-brass">Month #{committee.my_payout_month} of {committee.total_members}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Committee Modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Create Bachat Committee (BC)"
        onSubmit={handleAddCommittee}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              Save Committee
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Committee Name"
            placeholder="e.g. Family Bachat Committee #3"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Total Members"
              type="number"
              value={totalMembers}
              onChange={(e) => setTotalMembers(e.target.value)}
              required
            />

            <Input
              label="Monthly Contribution (PKR)"
              type="number"
              value={monthlyContribution}
              onChange={(e) => setMonthlyContribution(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <DatePicker
              label="Start Date"
              value={startDate}
              onChange={setStartDate}
              required
            />

            <Input
              label="My Payout Draw Month (e.g. 1st, 6th)"
              type="number"
              value={myPayoutMonth}
              onChange={(e) => setMyPayoutMonth(e.target.value)}
              required
            />
          </div>

          <Input
            label="Notes / Description"
            placeholder="e.g. Managed by Tariq Bhai"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

        </div>
      </Modal>
    </div>
  );
}
