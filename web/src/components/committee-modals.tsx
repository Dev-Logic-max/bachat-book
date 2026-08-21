"use client";

import * as React from "react";
import { Banknote, Info, UserPlus } from "lucide-react";

import { accountSelectOptions, type AccountWithInstitution } from "@/components/account-options";
import { LedgerRefChip } from "@/components/ledger-ref-chip";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { RichSelect } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast";
import type { Contact } from "@/lib/contacts";
import type { Committee, CommitteeMember, CommitteePayment } from "@/lib/committees";
import {
  addMember,
  recordCommitteePayment,
  updateCommitteePayment,
  updateMember,
} from "@/lib/committee-actions";
import { formatPKR } from "@/lib/format";
import { todayISO } from "@/lib/ledger";
import { checkFunds } from "@/lib/module-ledger";
import { createClient } from "@/lib/supabase/client";

const NO_CONTACT = "__none__";
const NO_ACCOUNT = "__none__";

/* ========================================================================== *
 * Member
 * ========================================================================== */

export function CommitteeMemberModal({
  isOpen,
  onClose,
  onSaved,
  committee,
  member,
  contacts,
  takenMonths,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  committee: Committee | null;
  /** Null to add. */
  member: CommitteeMember | null;
  contacts: Contact[];
  /** Turns already claimed by other members, so two cannot hold the same one. */
  takenMonths: number[];
}) {
  const supabase = createClient();
  const { showToast } = useToast();
  const isEdit = Boolean(member);

  const [contactId, setContactId] = React.useState(NO_CONTACT);
  const [typedName, setTypedName] = React.useState("");
  const [payoutMonth, setPayoutMonth] = React.useState("");
  const [isMe, setIsMe] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const seedKey = `${isOpen}:${member?.id ?? "new"}`;
  const [seeded, setSeeded] = React.useState(seedKey);
  if (seeded !== seedKey) {
    setSeeded(seedKey);
    if (isOpen) {
      setContactId(member?.contact_id ?? NO_CONTACT);
      setTypedName(member && !member.contact_id ? member.member_name : "");
      setPayoutMonth(member?.payout_month ? String(member.payout_month) : "");
      setIsMe(member?.is_me ?? false);
      setNote(member?.note ?? "");
    }
  }

  if (!committee) return null;

  const chosen = contacts.find((c) => c.id === contactId) ?? null;
  const resolvedName = chosen?.name ?? typedName.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvedName) {
      showToast({ type: "error", title: "Who is this?", description: "Pick a contact or type a name." });
      return;
    }

    setSubmitting(true);
    try {
      const month = payoutMonth ? parseInt(payoutMonth) : null;
      if (isEdit && member) {
        await updateMember(supabase, member.id, {
          memberName: resolvedName,
          contactId: contactId === NO_CONTACT ? null : contactId,
          payoutMonth: month,
          isMe,
          note: note.trim() || null,
        });
      } else {
        await addMember(supabase, {
          householdId: committee.household_id,
          committeeId: committee.id,
          contactId: contactId === NO_CONTACT ? null : contactId,
          memberName: resolvedName,
          payoutMonth: month,
          isMe,
          note: note.trim() || null,
        });
      }
      showToast({
        type: "success",
        title: isEdit ? "Member updated" : "Member added",
        description: `${resolvedName} is in ${committee.name}.`,
      });
      onSaved();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong.";
      showToast({
        type: "error",
        title: "Could not save",
        // The two partial unique indexes are the likely cause, and their raw
        // Postgres text says nothing a person can act on.
        description: message.includes("one_me_per_committee")
          ? "One member is already marked as you. Unmark them first."
          : message.includes("one_member_per_month")
            ? "Another member already has that turn."
            : message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit member" : "Add a member"}
      subtitle={committee.name}
      icon={<UserPlus size={18} />}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={submitting}>
            {isEdit ? "Save changes" : "Add member"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <RichSelect
          label="Who is in the committee?"
          value={contactId}
          onChange={setContactId}
          searchable={contacts.length >= 8}
          options={[
            { value: NO_CONTACT, label: "Not in my contacts", description: "Type their name instead" },
            ...contacts.map((c) => ({
              value: c.id,
              label: c.name,
              description: c.phone ?? undefined,
              avatarUrl: c.avatar_url,
            })),
          ]}
        />

        {contactId === NO_CONTACT && (
          <Input
            label="Their name"
            placeholder="e.g. Tariq bhai"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            required
          />
        )}

        <Input
          label="Which turn is theirs?"
          type="number"
          min="1"
          max={String(committee.total_members)}
          placeholder={`1 to ${committee.total_members}`}
          value={payoutMonth}
          onChange={(e) => setPayoutMonth(e.target.value)}
          className="tnum"
          hint={
            takenMonths.length > 0
              ? `Already taken: ${takenMonths.join(", ")}. Leave empty if the draw has not happened.`
              : "Leave empty if the draw has not happened yet."
          }
        />

        <Toggle
          checked={isMe}
          onChange={setIsMe}
          label="This is me"
          description="Only your own instalments and payout reach your accounts. Everyone else's are tracked on the grid only."
        />

        <Input
          label="Note"
          placeholder="e.g. pays late most months"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </Modal>
  );
}

/* ========================================================================== *
 * One cell of the grid
 * ========================================================================== */

export function CommitteePaymentModal({
  isOpen,
  onClose,
  onSaved,
  committee,
  member,
  monthIndex,
  payment,
  kind,
  accounts,
  ledgerRow = null,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  committee: Committee | null;
  member: CommitteeMember | null;
  monthIndex: number;
  /** Set to EDIT an existing cell. */
  payment: CommitteePayment | null;
  kind: "contribution" | "payout";
  accounts: AccountWithInstitution[];
  /** The ledger row this cell wrote, when it wrote one. */
  ledgerRow?: { id: string; date: string; type: string; account_id: string } | null;
}) {
  const supabase = createClient();
  const { showToast } = useToast();
  const isEdit = Boolean(payment);

  const [amount, setAmount] = React.useState("");
  const [paidOn, setPaidOn] = React.useState(todayISO());
  const [accountId, setAccountId] = React.useState(NO_ACCOUNT);
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const seedKey = `${isOpen}:${payment?.id ?? `${member?.id}:${monthIndex}:${kind}`}:${ledgerRow?.account_id ?? ""}`;
  const [seeded, setSeeded] = React.useState(seedKey);
  if (seeded !== seedKey) {
    setSeeded(seedKey);
    if (isOpen && committee) {
      setAmount(
        payment
          ? String(Number(payment.amount_paisa) / 100)
          : kind === "payout"
            ? String(
                (Number(committee.monthly_contribution_paisa) * committee.total_members) / 100,
              )
            : String(Number(committee.monthly_contribution_paisa) / 100),
      );
      setPaidOn(payment?.paid_on ?? todayISO());
      setAccountId(payment ? (ledgerRow?.account_id ?? NO_ACCOUNT) : NO_ACCOUNT);
      setNote(payment?.note ?? "");
    }
  }

  const paisa = Math.round((parseFloat(amount) || 0) * 100);
  const isPayout = (payment?.kind ?? kind) === "payout";
  const touchesLedger = Boolean(member?.is_me);
  const resolvedAccountId = accountId === NO_ACCOUNT ? null : accountId;

  /*
   * My instalment leaves my account, so it can run it short; my payout arrives,
   * so it never can. On an edit the account already carries the old row, which
   * is what `replacing` accounts for.
   */
  const selectedAccount = accounts.find((a) => a.id === resolvedAccountId);
  const alreadyOnThisAccount = Boolean(payment) && ledgerRow?.account_id === resolvedAccountId;
  const funds = checkFunds(
    touchesLedger ? selectedAccount : undefined,
    isPayout ? paisa : -paisa,
    alreadyOnThisAccount ? (isPayout ? 1 : -1) * Number(payment?.amount_paisa ?? 0) : 0,
  );

  if (!committee || !member) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paisa <= 0) {
      showToast({ type: "error", title: "How much?", description: "An amount above zero is needed." });
      return;
    }
    if (funds.message) {
      showToast({ type: "error", title: "Not enough in that account", description: funds.message });
      return;
    }

    setSubmitting(true);
    try {
      if (payment) {
        await updateCommitteePayment(supabase, committee, member, payment, {
          amountPaisa: paisa,
          paidOn,
          note: note.trim() || null,
          accountId: resolvedAccountId,
        });
      } else {
        await recordCommitteePayment(supabase, {
          committee,
          member,
          monthIndex,
          amountPaisa: paisa,
          paidOn,
          kind,
          accountId: accountId === NO_ACCOUNT ? null : accountId,
          note: note.trim() || null,
        });
      }
      showToast({
        type: "success",
        title: isEdit ? "Payment updated" : isPayout ? "Payout recorded" : "Instalment recorded",
        description: touchesLedger
          ? isPayout
            ? "Logged as income in that account."
            : "Logged as an expense in that account."
          : `Tracked against ${member.member_name} — your accounts are untouched.`,
      });
      onSaved();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong.";
      showToast({
        type: "error",
        title: "Could not save",
        description: message.includes("one_per_cell")
          ? "That round is already recorded for this member."
          : message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isEdit
          ? "Edit this payment"
          : isPayout
            ? "Record my payout"
            : `Round ${monthIndex} · ${member.member_name}`
      }
      subtitle={committee.name}
      icon={<Banknote size={18} />}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={submitting}>
            {isEdit ? "Save changes" : paisa > 0 ? `Record ${formatPKR(paisa)}` : "Record it"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Amount (PKR)"
            type="number"
            step="any"
            min="0"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="tnum"
            autoFocus
            required
          />
          <DatePicker label="Paid on" value={paidOn} onChange={setPaidOn} max={todayISO()} />
        </div>

        {/*
          The account is asked for ONLY on my own row. Another member's
          instalment never passes through my accounts, so offering a picker
          would invite recording money I never held.

          It is offered on EDIT as well as on create. It used to be add-only, so
          a cell recorded without an account could never be given one — the only
          route was to delete the cell and tick it again.
        */}
        {touchesLedger && (
          <>
            <RichSelect
              label={isPayout ? "Which account did it arrive in?" : "Which account did it come from?"}
              value={accountId}
              onChange={setAccountId}
              searchable={accounts.length >= 8}
              options={[
                {
                  value: NO_ACCOUNT,
                  label: "No account — just track it",
                  description: "Records it on the grid without moving a balance",
                },
                ...accountSelectOptions(accounts, {
                  direction: isPayout ? "income" : "expense",
                }),
              ]}
              hint={
                isEdit
                  ? ledgerRow
                    ? "Changing this moves the entry to the other account. Clearing it removes the entry and puts the balance back."
                    : "This cell has no entry in your accounts. Naming one now writes it, dated as above."
                  : undefined
              }
            />
            {ledgerRow && (
              <LedgerRefChip
                transactionId={ledgerRow.id}
                date={ledgerRow.date}
                type={ledgerRow.type as "income" | "expense" | "transfer"}
              />
            )}
            {funds.message && (
              <p className="border-loss/25 bg-loss/8 text-loss rounded-control flex items-start gap-2 border px-3 py-2.5 text-[11.5px] leading-relaxed">
                <Info size={14} className="mt-px shrink-0" />
                <span>{funds.message}</span>
              </p>
            )}
          </>
        )}

        {!touchesLedger && (
          <p className="border-border bg-surface-subtle text-foreground-2 rounded-control border px-3 py-2 text-[11.5px] leading-snug">
            This is {member.member_name}&apos;s instalment, so nothing is written to
            your accounts — their money never passes through them. It is recorded
            on the grid so you can see who has paid.
          </p>
        )}

        <Input
          label="Note"
          placeholder="e.g. paid a week late"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </Modal>
  );
}
