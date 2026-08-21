"use client";

import * as React from "react";
import { Grid3x3, Plus } from "lucide-react";
import type { AccountWithInstitution } from "@/components/account-options";
import { CommitteeGridModal } from "@/components/committee-grid-modal";
import { CommitteeMemberModal, CommitteePaymentModal } from "@/components/committee-modals";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { EmptyState } from "@/components/empty-state";
import { PageActions } from "@/components/page-actions";
import { RowActions } from "@/components/ui/row-actions";
import type { Contact } from "@/lib/contacts";
import {
  committeeTotals,
  myMember,
  type CommitteeFull,
  type CommitteeMember,
  type CommitteePayment,
} from "@/lib/committees";
import { deleteCommittee, deleteCommitteePayment, deleteMember } from "@/lib/committee-actions";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { formatPKR } from "@/lib/format";
import { ledgerRefFor } from "@/lib/module-ledger";
import type { Tables } from "@/lib/supabase/types";

/**
 * Is your turn early, late, or in the middle?
 *
 * A BC is two different products wearing one name. Take the pool in month 2 of
 * 10 and you have BORROWED: you hold the whole amount having paid in a fifth of
 * it, and the remaining instalments are the repayment. Take it in month 10 and
 * you have SAVED: you funded everyone else's turn first and got your own money
 * back at the end.
 *
 * Stated as a third of the length rather than a fixed month, because "month 3"
 * means opposite things in a 4-person and a 20-person committee.
 */
function payoutVerdict(committee: Tables<"committees">): {
  tone: "borrow" | "save" | "even";
  label: string;
} {
  const total = Math.max(1, committee.total_members);
  const position = committee.my_payout_month / total;

  if (position <= 1 / 3) {
    return {
      tone: "borrow",
      label:
        "Your turn comes early — this behaves like borrowing. You receive the pool long before you have paid it in, and the rest of the instalments are the repayment.",
    };
  }
  if (position >= 2 / 3) {
    return {
      tone: "save",
      label:
        "Your turn comes late — this behaves like saving. You fund everyone else first and take your own money back at the end, so treat it as a savings plan, not a windfall.",
    };
  }
  return {
    tone: "even",
    label:
      "Your turn falls mid-way, so this is close to break-even — roughly what you put in is what you take out, at about the time you have put it in.",
  };
}

/**
 * The ledger rows my own cells wrote.
 *
 * `committee_payments.transaction_id` names the row but carries neither its DATE
 * — which the deep link into Entries needs, since that screen opens on the
 * current month — nor its ACCOUNT, which the edit form now offers to move.
 */
type LedgerRow = { id: string; date: string; type: string; account_id: string };

export default function CommitteesPage() {
  const session = useSession();
  const supabase = createClient();
  const { showToast } = useToast();

  const householdId = session.household?.id || "";

  const readOnly = session.workspace ? !session.workspace.is_active : false;

  const [committees, setCommittees] = React.useState<Tables<"committees">[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [editing, setEditing] = React.useState<Tables<"committees"> | null>(null);
  const [deleting, setDeleting] = React.useState<Tables<"committees"> | null>(null);

  const [members, setMembers] = React.useState<CommitteeMember[]>([]);
  const [payments, setPayments] = React.useState<CommitteePayment[]>([]);
  const [ledgerRows, setLedgerRows] = React.useState<Record<string, LedgerRow>>({});
  const [contacts, setContacts] = React.useState<Contact[]>([]);
  const [accounts, setAccounts] = React.useState<AccountWithInstitution[]>([]);

  /** Which committee's grid is open. */
  const [gridFor, setGridFor] = React.useState<string | null>(null);
  const [memberModal, setMemberModal] = React.useState<{
    committee: Tables<"committees">;
    member: CommitteeMember | null;
  } | null>(null);
  const [deletingMember, setDeletingMember] = React.useState<CommitteeMember | null>(null);
  const [cellModal, setCellModal] = React.useState<{
    committee: Tables<"committees">;
    member: CommitteeMember;
    monthIndex: number;
    payment: CommitteePayment | null;
    kind: "contribution" | "payout";
  } | null>(null);
  const [deletingPayment, setDeletingPayment] = React.useState<CommitteePayment | null>(null);

  const [name, setName] = React.useState("");
  const [totalMembers, setTotalMembers] = React.useState("10");
  const [monthlyContribution, setMonthlyContribution] = React.useState("50000");
  const [startDate, setStartDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [myPayoutMonth, setMyPayoutMonth] = React.useState("6");
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  // Re-seed the form per opening. Done in render, not an effect — React
  // Compiler rejects a synchronous setState inside useEffect.
  const seedKey = `${addModalOpen || editing !== null}:${editing?.id ?? "new"}`;
  const [seeded, setSeeded] = React.useState(seedKey);
  if (seeded !== seedKey) {
    setSeeded(seedKey);
    setName(editing?.name ?? "");
    setTotalMembers(String(editing?.total_members ?? 10));
    setMonthlyContribution(
      editing ? String(Number(editing.monthly_contribution_paisa) / 100) : "50000",
    );
    setStartDate(editing?.start_date ?? new Date().toISOString().split("T")[0]);
    setMyPayoutMonth(String(editing?.my_payout_month ?? 6));
    setNotes(editing?.notes ?? "");
  }

  React.useEffect(() => {
    let active = true;
    if (!householdId) return;

    async function loadCommittees() {
      const [
        { data, error },
        memberRes,
        paymentRes,
        contactRes,
        accountRes,
      ] = await Promise.all([
        supabase
          .from("committees")
          .select("*")
          .eq("household_id", householdId)
          .order("start_date", { ascending: false }),
        supabase.from("committee_members").select("*").eq("household_id", householdId),
        supabase.from("committee_payments").select("*").eq("household_id", householdId),
        supabase.from("contacts").select("*").eq("household_id", householdId).order("name"),
        supabase
          .from("accounts")
          .select("*, institutions(*)")
          .eq("household_id", householdId)
          .is("deleted_at", null)
          .eq("is_archived", false)
          .order("name"),
      ]);

      if (!active) return;

      setMembers(memberRes.data ?? []);
      setPayments(paymentRes.data ?? []);
      setContacts(contactRes.data ?? []);
      setAccounts((accountRes.data ?? []) as unknown as AccountWithInstitution[]);

      // `error` is surfaced SEPARATELY from "no rows". The old version checked
      // only `data`, so a real failure left the page on its loading text
      // forever with nothing said — the same shape of bug that made the
      // Transactions page show an empty state for every household.
      if (error) {
        setLoadError(error.message);
        setLoading(false);
        return;
      }

      setCommittees(data ?? []);
      setLoadError(null);
      setLoading(false);

      /*
       * The ledger rows behind my own cells, fetched second because their ids
       * only exist once the payments are back. They carry the DATE the deep link
       * needs and the ACCOUNT the edit form now offers to move.
       */
      const ids = (paymentRes.data ?? [])
        .map((p) => p.transaction_id)
        .filter((id): id is string => Boolean(id));

      if (ids.length === 0) {
        setLedgerRows({});
        return;
      }

      const { data: rows } = await supabase
        .from("transactions")
        .select("id, date, type, account_id")
        .eq("household_id", householdId)
        .in("id", ids);

      if (!active) return;
      setLedgerRows(
        Object.fromEntries(((rows ?? []) as LedgerRow[]).map((r) => [r.id, r])),
      );
    }

    loadCommittees();
    return () => {
      active = false;
    };
  }, [householdId, supabase, refreshKey]);

  const handleAddCommittee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !monthlyContribution) {
      showToast({ type: "error", title: "Missing fields", description: "Enter committee name & monthly contribution." });
      return;
    }

    setSubmitting(true);
    const contributionPaisa = Math.round(parseFloat(monthlyContribution) * 100);

    const payload = {
      household_id: householdId,
      name: name.trim(),
      total_members: parseInt(totalMembers) || 10,
      monthly_contribution_paisa: contributionPaisa,
      start_date: startDate,
      my_payout_month: parseInt(myPayoutMonth) || 1,
      notes: notes.trim() || null,
    };

    const { error } = editing
      ? await supabase.from("committees").update(payload).eq("id", editing.id)
      : await supabase.from("committees").insert(payload);

    setSubmitting(false);

    if (error) {
      showToast({
        type: "error",
        title: editing ? "Could not save" : "Could not create it",
        description: error.message,
      });
      return;
    }

    showToast({
      type: "success",
      title: editing ? "Committee updated" : "Committee created",
      description: `"${name.trim()}" saved.`,
    });
    setName("");
    setAddModalOpen(false);
    setEditing(null);

    refresh();
  };

  const refresh = () => setRefreshKey((k) => k + 1);

  /** The committee whose grid is open, with its members and payments attached. */
  const openGrid: CommitteeFull | null = React.useMemo(() => {
    const committee = committees.find((c) => c.id === gridFor);
    if (!committee) return null;
    return {
      ...committee,
      members: members.filter((m) => m.committee_id === committee.id),
      payments: payments.filter((p) => p.committee_id === committee.id),
    };
  }, [committees, gridFor, members, payments]);

  const handleDelete = async (cascade: boolean) => {
    if (!deleting) return;
    try {
      await deleteCommittee(supabase, deleting, cascade);
      showToast({
        type: "success",
        title: "Committee removed",
        description: cascade
          ? "Its members, the grid and the account entries it wrote went with it."
          : "Its members and grid are gone; the account entries stay.",
      });
      setDeleting(null);
      refresh();
    } catch (error) {
      showToast({
        type: "error",
        title: "Could not remove it",
        description: error instanceof Error ? error.message : "Something went wrong.",
      });
    }
  };

  const handleDeleteMember = async () => {
    if (!deletingMember) return;
    try {
      await deleteMember(supabase, deletingMember, true);
      showToast({
        type: "success",
        title: "Member removed",
        description: `${deletingMember.member_name} and their squares are gone.`,
      });
      setDeletingMember(null);
      refresh();
    } catch (error) {
      showToast({
        type: "error",
        title: "Could not remove them",
        description: error instanceof Error ? error.message : "Something went wrong.",
      });
    }
  };

  const handleDeletePayment = async () => {
    if (!deletingPayment) return;
    try {
      await deleteCommitteePayment(supabase, deletingPayment);
      showToast({
        type: "success",
        title: "Payment removed",
        description: deletingPayment.transaction_id
          ? "The account entry it wrote went with it."
          : "It never touched an account, so no balance changed.",
      });
      setDeletingPayment(null);
      refresh();
    } catch (error) {
      showToast({
        type: "error",
        title: "Could not remove it",
        description: error instanceof Error ? error.message : "Something went wrong.",
      });
    }
  };

  /*
   * `handleTogglePayout` used to sit here, unreferenced.
   *
   * It flipped `committees.payout_received` optimistically and never checked the
   * write — a dead path to a field the grid now DERIVES from whether my payout
   * cell exists. Two places claiming to know whether the payout arrived is one
   * too many, and the dead one is the one that could disagree silently.
   */

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
              shortLabel: "Committee",
              hint: "A new BC pool with its members and draw month",
              icon: Plus,
              tone: "primary",
              onClick: () => setAddModalOpen(true),
            },
          ]}
        />
      </div>

      {loadError && (
        <div className="border-loss/25 bg-loss/8 text-loss rounded-panel border px-4 py-3 text-[12.5px]">
          Could not load your committees: {loadError}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-surface border-border rounded-panel shimmer h-56 border" />
          ))}
        </div>
      ) : committees.length === 0 ? (
        <EmptyState
          title="No committees yet"
          imageSrc="/art/empty-committee.webp"
          description="Track a BC pool — who runs it, what you pay each month, and which month your turn lands. The app works out whether your draw was worth taking."
          action={
            <Button variant="primary" onClick={() => setAddModalOpen(true)}>
              Create your first committee
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {committees.map((committee) => {
            const totalPoolPaisa = committee.monthly_contribution_paisa * committee.total_members;
            const verdict = payoutVerdict(committee);

            const own = members.filter((m) => m.committee_id === committee.id);
            const memberCount = own.length;
            const myPaid = committeeTotals({
              ...committee,
              members: own,
              payments: payments.filter((p) => p.committee_id === committee.id),
            }).myPaidCount;

            return (
              // `group` drives the hover reveal in RowActions, exactly as on the
              // budget, holding and udhaar cards.
              <div
                key={committee.id}
                className="group bg-surface border-border rounded-panel focus-within:border-brass/40 flex h-full flex-col justify-between border p-5 shadow-xs transition-colors"
              >
                <div>
                  <div className="border-border flex items-start justify-between gap-2 border-b pb-3">
                    <div className="min-w-0">
                      <h3 className="font-display text-foreground truncate text-[13.5px] font-semibold">
                        {committee.name}
                      </h3>
                      <p className="text-muted text-[11px]">
                        <span className="tnum">{committee.total_members}</span> members ·
                        starts <span className="ltr">{committee.start_date}</span>
                      </p>
                    </div>

                    {!readOnly && (
                      <RowActions
                        onEdit={() => setEditing(committee)}
                        onDelete={() => setDeleting(committee)}
                        editLabel="Edit committee"
                        deleteLabel="Remove committee"
                        reveal="hover"
                      />
                    )}
                  </div>

                  <div className="mt-3 space-y-2 text-[11.5px]">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted">Total pool</span>
                      <span className="font-display tnum text-foreground font-bold">
                        {formatPKR(totalPoolPaisa)}
                      </span>
                    </div>

                    <div className="flex justify-between gap-2">
                      <span className="text-muted">My instalment</span>
                      <span className="tnum text-foreground font-semibold">
                        {formatPKR(committee.monthly_contribution_paisa)}
                      </span>
                    </div>

                    <div className="flex justify-between gap-2">
                      <span className="text-muted">My turn</span>
                      <span className="text-brass-strong font-semibold">
                        Month <span className="tnum">{committee.my_payout_month}</span> of{" "}
                        <span className="tnum">{committee.total_members}</span>
                      </span>
                    </div>
                  </div>

                  {/*
                    The line that makes a BC legible.

                    Taking month 2 of 10 is BORROWING — you receive the pool long
                    before you have paid it in. Taking month 10 is SAVING. Same
                    committee, same instalment, opposite financial product, and
                    nothing on the old card said which one you had agreed to.
                  */}
                  <p
                    className={`mt-3 rounded-control border px-2.5 py-2 text-[11px] leading-snug ${
                      verdict.tone === "borrow"
                        ? "border-brass/30 bg-brass/8 text-brass-strong"
                        : verdict.tone === "save"
                          ? "border-gain/25 bg-gain/8 text-gain"
                          : "border-border bg-surface-subtle text-muted"
                    }`}
                  >
                    {verdict.label}
                  </p>
                </div>

                {/*
                  The grid is where the module actually lives. The card is a
                  summary; who has paid for which round is a table, and a table
                  does not fit in a card.
                */}
                <div className="mt-4 space-y-2">
                  <div className="text-muted flex items-center justify-between gap-2 text-[11px]">
                    <span>
                      <span className="tnum">{memberCount}</span>{" "}
                      {memberCount === 1 ? "member" : "members"} added
                    </span>
                    <span className="tnum">
                      {myPaid} of {committee.total_members} paid by me
                    </span>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => setGridFor(committee.id)}
                  >
                    <Grid3x3 size={13} />
                    {memberCount === 0 ? "Add members" : "Open payment grid"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Committee Modal */}
      <Modal
        isOpen={addModalOpen || editing !== null}
        onClose={() => {
          setAddModalOpen(false);
          setEditing(null);
        }}
        title={editing ? "Edit committee" : "Create Bachat Committee (BC)"}
        onSubmit={handleAddCommittee}
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setAddModalOpen(false);
                setEditing(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              {editing ? "Save changes" : "Save Committee"}
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

      <CommitteeGridModal
        isOpen={gridFor !== null}
        onClose={() => setGridFor(null)}
        committee={openGrid}
        readOnly={readOnly}
        onAddMember={() => {
          if (openGrid) setMemberModal({ committee: openGrid, member: null });
        }}
        onEditMember={(member) => {
          if (openGrid) setMemberModal({ committee: openGrid, member });
        }}
        onDeleteMember={setDeletingMember}
        onCell={(member, monthIndex) => {
          if (openGrid) {
            setCellModal({
              committee: openGrid,
              member,
              monthIndex,
              payment: null,
              kind: "contribution",
            });
          }
        }}
        onEditPayment={(member, payment) => {
          if (openGrid) {
            setCellModal({
              committee: openGrid,
              member,
              monthIndex: payment.month_index,
              payment,
              kind: payment.kind,
            });
          }
        }}
        onRecordPayout={() => {
          const me = openGrid ? myMember(openGrid.members) : null;
          if (openGrid && me) {
            setCellModal({
              committee: openGrid,
              member: me,
              monthIndex: me.payout_month ?? openGrid.my_payout_month,
              payment: null,
              kind: "payout",
            });
          }
        }}
      />

      <CommitteeMemberModal
        isOpen={memberModal !== null}
        onClose={() => setMemberModal(null)}
        onSaved={refresh}
        committee={memberModal?.committee ?? null}
        member={memberModal?.member ?? null}
        contacts={contacts}
        takenMonths={
          memberModal
            ? members
                .filter(
                  (m) =>
                    m.committee_id === memberModal.committee.id &&
                    m.id !== memberModal.member?.id &&
                    m.payout_month !== null,
                )
                .map((m) => m.payout_month as number)
                .sort((a, b) => a - b)
            : []
        }
      />

      <CommitteePaymentModal
        isOpen={cellModal !== null}
        onClose={() => setCellModal(null)}
        onSaved={refresh}
        committee={cellModal?.committee ?? null}
        member={cellModal?.member ?? null}
        monthIndex={cellModal?.monthIndex ?? 1}
        payment={cellModal?.payment ?? null}
        kind={cellModal?.kind ?? "contribution"}
        accounts={accounts}
        ledgerRow={
          cellModal?.payment?.transaction_id
            ? (ledgerRows[cellModal.payment.transaction_id] ?? null)
            : null
        }
      />

      <ConfirmDeleteModal
        isOpen={deletingMember !== null}
        onClose={() => setDeletingMember(null)}
        onConfirm={handleDeleteMember}
        title="Remove this member?"
        recordLabel={deletingMember?.member_name ?? ""}
        recordMeta={
          deletingMember?.payout_month ? `Turn ${deletingMember.payout_month}` : undefined
        }
        cascadeHint={
          deletingMember?.is_me
            ? "This is YOUR row, so every instalment recorded on it — and the account entries they wrote — goes too, and those balances return to where they were."
            : "Their squares on the grid go with them. Nothing in your accounts changes, because their instalments never touched your accounts."
        }
        confirmLabel="Remove member"
      />

      <ConfirmDeleteModal
        isOpen={deletingPayment !== null}
        onClose={() => setDeletingPayment(null)}
        onConfirm={handleDeletePayment}
        title="Remove this payment?"
        recordLabel={
          deletingPayment ? formatPKR(Number(deletingPayment.amount_paisa)) : ""
        }
        recordMeta={deletingPayment?.paid_on}
        linkedRefs={
          deletingPayment?.transaction_id
            ? [
                {
                  kind: "Account entry",
                  label: `${deletingPayment.kind === "payout" ? "Payout received" : `Instalment ${deletingPayment.month_index}`} · ${formatPKR(Number(deletingPayment.amount_paisa))}`,
                  // Named AND reachable. A dialog that lists what it is about to
                  // destroy but offers no way to look at it asks for trust
                  // rather than judgement.
                  href: ledgerRefFor(
                    deletingPayment.transaction_id,
                    ledgerRows[deletingPayment.transaction_id]?.date ?? deletingPayment.paid_on,
                    deletingPayment.kind === "payout" ? "income" : "expense",
                  ).href,
                },
              ]
            : []
        }
        cascadeHint={
          deletingPayment?.transaction_id
            ? "The account entry this wrote is removed with it, so the balance goes back to where it was."
            : "This never touched an account, so no balance changes."
        }
        confirmLabel="Remove payment"
      />

      <ConfirmDeleteModal
        isOpen={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Remove this committee?"
        recordLabel={deleting?.name ?? ""}
        recordMeta={
          deleting
            ? `${formatPKR(Number(deleting.monthly_contribution_paisa))} a month · ${deleting.total_members} members`
            : undefined
        }
        cascadeLabel="Also delete the account entries this created"
        cascadeHint="Checked — the default — every instalment and payout of yours is removed from your accounts and the balances go back. Unchecked, the grid goes but those entries stay, because the money really did leave."
        confirmLabel="Remove committee"
      />
    </div>
  );
}
