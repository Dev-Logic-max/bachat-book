"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import type { Tables, AccountType } from "@/lib/supabase/types";
import { todayISO } from "@/lib/ledger";

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  householdId: string;
  onSuccess?: () => void;
}

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "checking", label: "Current / Checking Account" },
  { value: "savings", label: "Savings / Asaan Account" },
  { value: "wallet", label: "Mobile Wallet (Easypaisa / JazzCash / SadaPay / NayaPay)" },
  { value: "cash", label: "Cash Wallet / Physical Cash" },
  { value: "credit", label: "Credit Card" },
  { value: "investment", label: "Investment / Mutual Fund / NSS" },
];

export function AddAccountModal({
  isOpen,
  onClose,
  householdId,
  onSuccess,
}: AddAccountModalProps) {
  const [institutions, setInstitutions] = React.useState<Tables<"institutions">[]>([]);
  const [institutionId, setInstitutionId] = React.useState<string>("meezan");
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<AccountType>("checking");
  const [last4, setLast4] = React.useState("");
  const [initialBalance, setInitialBalance] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const { showToast } = useToast();
  const supabase = createClient();

  React.useEffect(() => {
    let active = true;
    async function loadInstitutions() {
      const { data } = await supabase
        .from("institutions")
        .select("*")
        .order("name", { ascending: true });

      if (active && data) {
        setInstitutions(data);
      }
    }
    if (isOpen) {
      loadInstitutions();
    }
    return () => {
      active = false;
    };
  }, [isOpen, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast({ type: "error", title: "Missing Name", description: "Please enter an account name." });
      return;
    }

    setLoading(true);

    const initialBalancePaisa = Math.round(parseFloat(initialBalance || "0") * 100);

    // Insert Account
    const { data: newAcc, error: accErr } = await supabase
      .from("accounts")
      .insert({
        household_id: householdId,
        institution_id: institutionId === "none" ? null : institutionId,
        name: name.trim(),
        type,
        account_number_last4: last4.trim() || null,
        currency: "PKR",
        balance_paisa: 0,
      })
      .select()
      .single();

    if (accErr || !newAcc) {
      setLoading(false);
      showToast({ type: "error", title: "Failed to create account", description: accErr?.message });
      return;
    }

    // Insert opening balance transaction if non-zero. Deliberately uncategorised:
    // an opening balance is not salary and not a purchase, and forcing a
    // category id here is what tagged every new account "Monthly Salary".
    if (initialBalancePaisa !== 0) {
      const { error: openingErr } = await supabase.from("transactions").insert({
        household_id: householdId,
        account_id: newAcc.id,
        category_id: null,
        amount_paisa: initialBalancePaisa,
        type: initialBalancePaisa > 0 ? "income" : "expense",
        date: todayISO(),
        note: "Opening balance",
      });

      // This result used to be discarded. A negative opening balance was written
      // with category_id 'general', which is not a real category id, so the FK
      // rejected it and the row silently never existed — the account appeared with
      // a zero balance and no explanation.
      if (openingErr) {
        setLoading(false);
        showToast({
          type: "error",
          title: "Account created, opening balance failed",
          description: `${openingErr.message} — add it from the account's ledger.`,
        });
        onClose();
        if (onSuccess) onSuccess();
        return;
      }
    }

    setLoading(false);
    showToast({ type: "success", title: "Account Created", description: `"${name}" added successfully.` });
    setName("");
    setLast4("");
    setInitialBalance("");
    onClose();
    if (onSuccess) onSuccess();
  };

  const institutionOptions = [
    { value: "none", label: "Other / Physical Cash" },
    ...institutions.map((inst) => ({
      value: inst.id,
      label: `${inst.name} (${inst.short_name})`,
    })),
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Financial Account">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Financial Institution"
          value={institutionId}
          onChange={(e) => setInstitutionId(e.target.value)}
          options={institutionOptions}
        />

        {/*
         * The label and hint steer away from a person's name — the first account
         * created here came out called "Abdul Rehman" with a UBL subtitle. The
         * institution and type fields already carry everything else.
         */}
        <Input
          label="Name this account"
          placeholder="e.g. UBL Current, Meezan Asaan, SadaPay Card"
          hint="Name the account, not yourself. You will pick this from a list when logging money."
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Account Type"
            value={type}
            onChange={(e) => setType(e.target.value as AccountType)}
            options={ACCOUNT_TYPES}
          />

          <Input
            label="Last 4 Digits (Optional)"
            placeholder="e.g. 4821"
            maxLength={4}
            value={last4}
            onChange={(e) => setLast4(e.target.value)}
          />
        </div>

        <Input
          label="Opening balance (PKR)"
          type="number"
          step="any"
          placeholder="e.g. 50000"
          hint="Recorded as an uncategorised opening entry at the top of the ledger."
          value={initialBalance}
          onChange={(e) => setInitialBalance(e.target.value)}
        />

        <div className="flex justify-end gap-3 pt-3 border-t border-border">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={loading}>
            Add Account
          </Button>
        </div>
      </form>
    </Modal>
  );
}
