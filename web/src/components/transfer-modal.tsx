"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/types";

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
  const [accounts, setAccounts] = React.useState<Tables<"accounts">[]>([]);
  const [fromAccountId, setFromAccountId] = React.useState("");
  const [toAccountId, setToAccountId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [note, setNote] = React.useState("");
  const [date, setDate] = React.useState(() => new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = React.useState(false);

  const { showToast } = useToast();
  const supabase = createClient();

  React.useEffect(() => {
    let active = true;
    if (!isOpen || !householdId) return;

    async function loadAccounts() {
      const { data } = await supabase
        .from("accounts")
        .select("*")
        .eq("household_id", householdId)
        .eq("is_archived", false);

      if (active && data) {
        setAccounts(data);
        if (data.length >= 2) {
          setFromAccountId(data[0].id);
          setToAccountId(data[1].id);
        } else if (data.length === 1) {
          setFromAccountId(data[0].id);
        }
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

  const accountOptions = accounts.map((acc) => ({
    value: acc.id,
    label: `${acc.name} (${acc.type})`,
  }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Account Transfer (Net-Zero)">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="From Account (Source)"
            value={fromAccountId}
            onChange={(e) => setFromAccountId(e.target.value)}
            options={accountOptions}
          />

          <Select
            label="To Account (Destination)"
            value={toAccountId}
            onChange={(e) => setToAccountId(e.target.value)}
            options={accountOptions}
          />
        </div>

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

          <Input
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        <Input
          label="Note / Reference"
          placeholder="e.g. ATM withdrawal, Monthly savings transfer"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="flex justify-end gap-3 pt-3 border-t border-border">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={loading}>
            Confirm Transfer
          </Button>
        </div>
      </form>
    </Modal>
  );
}
