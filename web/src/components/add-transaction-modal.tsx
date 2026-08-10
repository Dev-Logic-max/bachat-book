"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/types";

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  householdId: string;
  onSuccess?: () => void;
}

export function AddTransactionModal({
  isOpen,
  onClose,
  householdId,
  onSuccess,
}: AddTransactionModalProps) {
  const [accounts, setAccounts] = React.useState<Tables<"accounts">[]>([]);
  const [categories, setCategories] = React.useState<Tables<"categories">[]>([]);
  const [merchants, setMerchants] = React.useState<Tables<"merchants">[]>([]);

  const [accountId, setAccountId] = React.useState("");
  const [type, setType] = React.useState<"expense" | "income">("expense");
  const [amount, setAmount] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [merchantId, setMerchantId] = React.useState("none");
  const [note, setNote] = React.useState("");
  const [date, setDate] = React.useState(() => new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = React.useState(false);

  const { showToast } = useToast();
  const supabase = createClient();

  React.useEffect(() => {
    let active = true;
    if (!isOpen || !householdId) return;

    async function loadData() {
      const [accRes, catRes, merRes] = await Promise.all([
        supabase.from("accounts").select("*").eq("household_id", householdId).eq("is_archived", false),
        supabase.from("categories").select("*").order("name", { ascending: true }),
        supabase.from("merchants").select("*").order("name", { ascending: true }),
      ]);

      if (active) {
        if (accRes.data) {
          setAccounts(accRes.data);
          if (accRes.data.length > 0 && !accountId) setAccountId(accRes.data[0].id);
        }
        if (catRes.data) {
          setCategories(catRes.data);
          if (catRes.data.length > 0 && !categoryId) setCategoryId(catRes.data[0].id);
        }
        if (merRes.data) setMerchants(merRes.data);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [isOpen, householdId, accountId, categoryId, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!parsed || isNaN(parsed) || parsed <= 0) {
      showToast({ type: "error", title: "Invalid Amount", description: "Please enter a valid rupee amount." });
      return;
    }

    if (!accountId) {
      showToast({ type: "error", title: "No Account Selected", description: "Please select an account." });
      return;
    }

    setLoading(true);

    const amountPaisa = Math.round(parsed * 100);
    const signedAmountPaisa = type === "income" ? amountPaisa : -amountPaisa;

    const { error } = await supabase.from("transactions").insert({
      household_id: householdId,
      account_id: accountId,
      category_id: categoryId || null,
      merchant_id: merchantId === "none" ? null : merchantId,
      amount_paisa: signedAmountPaisa,
      type,
      date,
      note: note.trim() || null,
    });

    setLoading(false);

    if (error) {
      showToast({ type: "error", title: "Transaction failed", description: error.message });
      return;
    }

    showToast({
      type: "success",
      title: `${type === "income" ? "Income" : "Expense"} Recorded`,
      description: `Rs ${parsed.toLocaleString()} logged cleanly.`,
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

  const filteredCategories = categories.filter((c) => (type === "income" ? c.kind === "income" : c.kind !== "income"));

  const categoryOptions = filteredCategories.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  const merchantOptions = [
    { value: "none", label: "None / Manual Merchant" },
    ...merchants.map((m) => ({
      value: m.id,
      label: m.name,
    })),
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Log Transaction">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type Toggle */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-surface-subtle border border-border rounded-control">
          <button
            type="button"
            onClick={() => setType("expense")}
            className={`py-1.5 text-xs font-semibold rounded-control transition-colors ${
              type === "expense"
                ? "bg-loss text-white shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            - Expense
          </button>
          <button
            type="button"
            onClick={() => setType("income")}
            className={`py-1.5 text-xs font-semibold rounded-control transition-colors ${
              type === "income"
                ? "bg-gain text-white shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            + Income
          </button>
        </div>

        <Select
          label="Account"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          options={accountOptions}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Amount (PKR)"
            type="number"
            step="any"
            placeholder="e.g. 2500"
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

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            options={categoryOptions}
          />

          <Select
            label="Merchant (Optional)"
            value={merchantId}
            onChange={(e) => setMerchantId(e.target.value)}
            options={merchantOptions}
          />
        </div>

        <Input
          label="Note / Description"
          placeholder="e.g. Kiryana items, Fuel, Salary"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="flex justify-end gap-3 pt-3 border-t border-border">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={loading}>
            Save Transaction
          </Button>
        </div>
      </form>
    </Modal>
  );
}
