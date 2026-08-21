"use client";

import * as React from "react";
import { Banknote, Info } from "lucide-react";

import { accountSelectOptions, type AccountWithInstitution } from "@/components/account-options";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { RichSelect } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { outstandingPaisa, type DebtPayment, type DebtWithPayments } from "@/lib/debts";
import { recordPayment, updateDebtPayment } from "@/lib/debt-actions";
import { formatPKR } from "@/lib/format";
import { todayISO } from "@/lib/ledger";
import { checkFunds } from "@/lib/module-ledger";
import { createClient } from "@/lib/supabase/client";

const NO_ACCOUNT = "__none__";

/**
 * Record a repayment, or correct one.
 *
 * Opens on the FULL outstanding amount, because paying off the whole thing is
 * the common case and part-payment is the exception — but the field is plain
 * and editable, since a khata is settled in pieces all the time.
 *
 * Overpayment is allowed, not blocked. People round up: someone who owes
 * Rs 4,800 hands over Rs 5,000 and says keep it. Refusing that entry would send
 * them to a calculator; showing "Rs 200 more than owed" tells the truth.
 *
 * THE ACCOUNT IS OFFERED ON EDIT TOO. It used to be add-only, so a repayment
 * logged without an account could never be attached to one — the only route was
 * to delete it and type it again, and the delete dialog rightly warns about
 * removing a ledger row, which made a correction feel destructive.
 */
export function DebtPaymentModal({
  isOpen,
  onClose,
  onSaved,
  debt,
  accounts,
  payment = null,
  /** Which account the payment's existing ledger row sits on, when there is one. */
  paymentAccountId = null,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  debt: DebtWithPayments | null;
  accounts: AccountWithInstitution[];
  /** Set to EDIT an existing repayment instead of adding one. */
  payment?: DebtPayment | null;
  paymentAccountId?: string | null;
}) {
  const supabase = createClient();
  const { showToast } = useToast();

  const [amount, setAmount] = React.useState("");
  const [date, setDate] = React.useState(todayISO());
  const [accountId, setAccountId] = React.useState(NO_ACCOUNT);
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const outstanding = debt ? outstandingPaisa(debt) : 0;

  const isEdit = Boolean(payment);

  const seedKey = `${isOpen}:${debt?.id ?? "none"}:${payment?.id ?? "new"}:${paymentAccountId ?? ""}`;
  const [seeded, setSeeded] = React.useState(seedKey);
  if (seeded !== seedKey) {
    setSeeded(seedKey);
    if (isOpen && debt) {
      setAmount(
        payment
          ? String(Number(payment.amount_paisa) / 100)
          : outstanding > 0
            ? String(outstanding / 100)
            : "",
      );
      setDate(payment?.date ?? todayISO());
      setAccountId(payment ? (paymentAccountId ?? NO_ACCOUNT) : NO_ACCOUNT);
      setNote(payment?.note ?? "");
    }
  }

  const paisa = Math.round((parseFloat(amount) || 0) * 100);
  const resolvedAccountId = accountId === NO_ACCOUNT ? null : accountId;
  const isIncoming = debt?.direction === "owed_to_us";

  // A repayment moves the opposite way to the loan. Money coming BACK to me
  // arrives (income); money I pay back leaves (expense) and a lock should bite.
  const moneyDirection = isIncoming ? "income" : "expense";

  /*
   * Only a repayment I MAKE can run an account short — money coming back to me
   * only ever adds. On an edit the account already carries the old leg, so what
   * is being asked for is the difference.
   */
  const selectedAccount = accounts.find((a) => a.id === resolvedAccountId);
  const alreadyOnThisAccount = isEdit && paymentAccountId === resolvedAccountId;
  const funds = checkFunds(
    selectedAccount,
    isIncoming ? paisa : -paisa,
    alreadyOnThisAccount ? (isIncoming ? 1 : -1) * Number(payment?.amount_paisa ?? 0) : 0,
  );

  if (!debt) return null;

  const overpayBy = Math.max(0, paisa - outstanding);
  const remaining = Math.max(0, outstanding - paisa);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paisa <= 0) {
      showToast({
        type: "error",
        title: "How much was paid?",
        description: "An amount greater than zero is needed.",
      });
      return;
    }
    if (funds.message) {
      showToast({ type: "error", title: "Not enough in that account", description: funds.message });
      return;
    }

    setSubmitting(true);
    try {
      if (payment) {
        await updateDebtPayment(supabase, debt, payment, {
          amountPaisa: paisa,
          date,
          note: note.trim() || null,
          accountId: resolvedAccountId,
        });
      } else {
        await recordPayment(supabase, debt, {
          amountPaisa: paisa,
          date,
          note: note.trim() || null,
          accountId: resolvedAccountId,
        });
      }
      showToast({
        type: "success",
        title: payment ? "Repayment updated" : "Repayment recorded",
        description: payment
          ? resolvedAccountId
            ? "The account entry it wrote was updated to match."
            : "It is not linked to an account, so no balance changed."
          : remaining > 0
            ? `${formatPKR(remaining)} still ${isIncoming ? "owed to you" : "to pay"}.`
            : "That clears it.",
      });
      onSaved();
      onClose();
    } catch (error) {
      showToast({
        type: "error",
        title: "Could not record it",
        description: error instanceof Error ? error.message : "Something went wrong.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit this payment" : isIncoming ? "Record a repayment" : "Record a payment"}
      subtitle={debt.counterparty_name}
      icon={<Banknote size={18} />}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={submitting}>
            {isEdit
              ? "Save changes"
              : paisa > 0
                ? `Record ${formatPKR(paisa)}`
                : "Record it"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="border-border bg-surface-subtle rounded-control flex items-baseline justify-between border px-3 py-2.5">
          <span className="text-muted text-[11.5px]">
            {isIncoming ? "Still owed to you" : "Still to pay"}
          </span>
          <span className="tnum text-foreground text-[15px] font-semibold">
            {formatPKR(outstanding)}
          </span>
        </div>

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
          <DatePicker label="Date" value={date} onChange={setDate} max={todayISO()} />
        </div>

        <RichSelect
          label={isIncoming ? "Which account did it go into?" : "Which account did it come from?"}
          value={accountId}
          onChange={setAccountId}
          searchable={accounts.length >= 8}
          options={[
            {
              value: NO_ACCOUNT,
              label: "No account — just track it",
              description: "Records the repayment without moving a balance",
            },
            ...accountSelectOptions(accounts, { direction: moneyDirection }),
          ]}
          hint={
            isEdit
              ? paymentAccountId
                ? "Changing this moves the entry to the other account. Clearing it removes the entry and puts the balance back."
                : "This payment has no entry in your accounts. Naming one now writes it, dated as above."
              : undefined
          }
        />

        {funds.message && (
          <p className="border-loss/25 bg-loss/8 text-loss rounded-control flex items-start gap-2 border px-3 py-2.5 text-[11.5px] leading-relaxed">
            <Info size={14} className="mt-px shrink-0" />
            <span>{funds.message}</span>
          </p>
        )}

        <Input
          label="Note"
          placeholder="e.g. gave it at Eid"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {overpayBy > 0 && (
          <p className="border-brass/30 bg-brass/8 text-brass-strong rounded-control border px-3 py-2 text-[11.5px] leading-snug">
            That is <span className="tnum font-semibold">{formatPKR(overpayBy)}</span> more
            than owed. Recorded as given — nothing here rounds it away.
          </p>
        )}
      </div>
    </Modal>
  );
}
