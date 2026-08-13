"use client";

import * as React from "react";
import { ArrowRight } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { RichSelect } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { accountSelectOptions } from "@/components/account-options";
import type { AccountWithInstitution } from "@/components/account-options";
import { createClient } from "@/lib/supabase/client";
import { formatPKR } from "@/lib/format";
import { todayISO } from "@/lib/ledger";
import { cn } from "@/lib/utils";

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  householdId: string;
  onSuccess?: () => void;
}

export function TransferModal({
  isOpen,
  onClose,
  householdId,
  onSuccess,
}: TransferModalProps) {
  const [accounts, setAccounts] = React.useState<AccountWithInstitution[]>([]);
  const [fromAccountId, setFromAccountId] = React.useState("");
  const [toAccountId, setToAccountId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [note, setNote] = React.useState("");
  // Local date. toISOString() is UTC and lands on yesterday before 05:00 PKT.
  const [date, setDate] = React.useState(todayISO);
  const [loading, setLoading] = React.useState(false);

  const { showToast } = useToast();
  const supabase = createClient();

  React.useEffect(() => {
    let active = true;
    if (!isOpen || !householdId) return;

    async function loadAccounts() {
      const { data } = await supabase
        .from("accounts")
        .select("*, institutions(*)")
        .eq("household_id", householdId)
        .eq("is_archived", false)
        .is("deleted_at", null);

      if (active && data) {
        const list = data as unknown as AccountWithInstitution[];
        setAccounts(list);

        /*
         * Seed the SOURCE from an account money can actually leave.
         *
         * This used to take `data[0]` and `data[1]` blindly, so a locked savings
         * account sitting first in creation order was pre-selected as the source
         * — greyed out in its own dropdown, with the save guaranteed to fail.
         */
        const source = list.find((a) => !a.is_locked);
        const target = list.find((a) => a.id !== source?.id);
        if (source) setFromAccountId(source.id);
        if (target) setToAccountId(target.id);
      }
    }

    loadAccounts();
    return () => {
      active = false;
    };
  }, [isOpen, householdId, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!parsed || isNaN(parsed) || parsed <= 0) {
      showToast({ type: "error", title: "Invalid Amount", description: "Please enter a valid rupee amount." });
      return;
    }

    if (!fromAccountId || !toAccountId || fromAccountId === toAccountId) {
      showToast({
        type: "error",
        title: "Invalid Account Selection",
        description: "Please select two different accounts for the transfer.",
      });
      return;
    }

    setLoading(true);
    const amountPaisa = Math.round(parsed * 100);

    // 1. Create Outgoing Transaction on Source Account
    const { data: outTx, error: outErr } = await supabase
      .from("transactions")
      .insert({
        household_id: householdId,
        account_id: fromAccountId,
        transfer_account_id: toAccountId,
        amount_paisa: -amountPaisa,
        type: "transfer",
        category_id: "transfer",
        date,
        note: note.trim() ? `Transfer out: ${note.trim()}` : "Transfer out",
      })
      .select()
      .single();

    if (outErr || !outTx) {
      setLoading(false);
      showToast({ type: "error", title: "Transfer Failed", description: outErr?.message });
      return;
    }

    // 2. Create Incoming Transaction on Target Account linked to Source
    const { data: inTx, error: inErr } = await supabase
      .from("transactions")
      .insert({
        household_id: householdId,
        account_id: toAccountId,
        transfer_account_id: fromAccountId,
        linked_transaction_id: outTx.id,
        amount_paisa: amountPaisa,
        type: "transfer",
        category_id: "transfer",
        date,
        note: note.trim() ? `Transfer in: ${note.trim()}` : "Transfer in",
      })
      .select()
      .single();

    if (!inErr && inTx) {
      // Backlink outTx to inTx
      await supabase
        .from("transactions")
        .update({ linked_transaction_id: inTx.id })
        .eq("id", outTx.id);
    }

    setLoading(false);
    showToast({
      type: "success",
      title: "Transfer Recorded",
      description: `Rs ${parsed.toLocaleString()} transferred cleanly with net-zero impact to net worth.`,
    });

    setAmount("");
    setNote("");
    onClose();
    if (onSuccess) onSuccess();
  };

  /*
   * A transfer OUT is spending by another name, so the source list is scored as
   * an expense: a locked account is shown greyed with its reason rather than
   * quietly missing. The destination is scored as income, where a lock is no
   * obstacle — paying into savings is the point of it.
   */
  const sourceOptions = accountSelectOptions(accounts, { direction: "expense" });
  const targetOptions = accountSelectOptions(accounts, { direction: "income" }).map(
    (o) =>
      // Sending to the same account you took it from is a no-op the DB would
      // happily store as two cancelling rows.
      o.value === fromAccountId
        ? { ...o, disabled: true, meta: sameAccountChip }
        : o,
  );

  const fromAccount = accounts.find((a) => a.id === fromAccountId);
  const toAccount = accounts.find((a) => a.id === toAccountId);
  const amountPaisaPreview = Math.round((parseFloat(amount) || 0) * 100);
  const overdrawn =
    fromAccount !== undefined &&
    amountPaisaPreview > Number(fromAccount.balance_paisa);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Account Transfer (Net-Zero)"
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={loading}>
            Confirm Transfer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <RichSelect
            label="From — money leaves here"
            value={fromAccountId}
            onChange={setFromAccountId}
            options={sourceOptions}
            placeholder={accounts.length === 0 ? "Loading accounts…" : "Choose an account"}
            emptyMessage="Add an account first"
            hint={
              fromAccount
                ? `Holds ${formatPKR(Number(fromAccount.balance_paisa))}`
                : undefined
            }
          />

          <RichSelect
            label="To — money arrives here"
            value={toAccountId}
            onChange={setToAccountId}
            options={targetOptions}
            placeholder={accounts.length === 0 ? "Loading accounts…" : "Choose an account"}
            emptyMessage="Add an account first"
            hint={
              toAccount ? `Holds ${formatPKR(Number(toAccount.balance_paisa))}` : undefined
            }
          />
        </div>

        {/*
          The whole point of a transfer screen: what each side looks like AFTER.
          Two dropdowns and an amount box asked the user to do this arithmetic in
          their head, which is where an accidental overdraft comes from.
        */}
        {fromAccount && toAccount && amountPaisaPreview > 0 && (
          <div className="bg-surface-subtle border-border rounded-card border p-3.5">
            <div className="flex items-center gap-3">
              <BalanceSide
                name={fromAccount.name}
                before={Number(fromAccount.balance_paisa)}
                after={Number(fromAccount.balance_paisa) - amountPaisaPreview}
                negative={overdrawn}
              />
              <ArrowRight size={16} className="text-muted shrink-0" />
              <BalanceSide
                name={toAccount.name}
                before={Number(toAccount.balance_paisa)}
                after={Number(toAccount.balance_paisa) + amountPaisaPreview}
              />
            </div>
            {overdrawn && (
              <p className="text-loss mt-2.5 text-[11.5px] font-medium">
                {fromAccount.name} only holds{" "}
                {formatPKR(Number(fromAccount.balance_paisa))}. This transfer would
                take it below zero.
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Transfer Amount (PKR)"
            type="number"
            step="any"
            placeholder="e.g. 10000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />

          <DatePicker
            label="Date"
            value={date}
            onChange={setDate}
            max={todayISO()}
            required
          />
        </div>

        <Input
          label="Note / Reference"
          placeholder="e.g. ATM withdrawal, Monthly savings transfer"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

      </div>
    </Modal>
  );
}

const sameAccountChip = (
  <span className="border-border bg-surface-subtle text-muted rounded-full border px-1.5 py-0.5 text-[10px] leading-none font-medium">
    Same account
  </span>
);

/** One side of the before/after preview. */
function BalanceSide({
  name,
  before,
  after,
  negative = false,
}: {
  name: string;
  before: number;
  after: number;
  negative?: boolean;
}) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-muted truncate text-[11px]">{name}</p>
      <p className="mt-0.5 flex items-baseline gap-1.5">
        <span className="tnum text-faint text-[11px] line-through">
          {formatPKR(before)}
        </span>
        <span
          className={cn(
            "tnum text-[13px] font-semibold",
            negative ? "text-loss" : "text-foreground",
          )}
        >
          {formatPKR(after)}
        </span>
      </p>
    </div>
  );
}
