"use client";

import * as React from "react";
import { Lock } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { RichSelect } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  DEFAULT_ACCOUNT_TYPE,
  DEFAULT_INSTITUTION_ID,
  accountTypeOptions,
  defaultTypeForInstitution,
  institutionOptions,
} from "@/components/account-options";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Tables, AccountType } from "@/lib/supabase/types";

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  householdId: string;
  onSuccess?: () => void;
}

export function AddAccountModal({
  isOpen,
  onClose,
  householdId,
  onSuccess,
}: AddAccountModalProps) {
  const [institutions, setInstitutions] = React.useState<Tables<"institutions">[]>([]);
  const [heldCounts, setHeldCounts] = React.useState<Map<string | null, number>>(
    () => new Map(),
  );
  // Opens on cash — the account almost everyone needs first, and the one every
  // entry falls back to. It used to default to "meezan", so a cash-only user had
  // to notice and undo a bank they never picked.
  const [institutionId, setInstitutionId] =
    React.useState<string>(DEFAULT_INSTITUTION_ID);
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<AccountType>(DEFAULT_ACCOUNT_TYPE);
  const [last4, setLast4] = React.useState("");
  const [isLocked, setIsLocked] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const { showToast } = useToast();
  const supabase = createClient();

  React.useEffect(() => {
    if (!isOpen) return;
    let active = true;

    async function load() {
      const [{ data: insts }, { data: existing }] = await Promise.all([
        supabase.from("institutions").select("*").order("name"),
        // Drives the "2 held" badge only. It is a COUNT for display — creating a
        // second account at the same institution stays perfectly legal.
        supabase
          .from("accounts")
          .select("institution_id")
          .eq("household_id", householdId),
      ]);

      if (!active) return;
      if (insts) setInstitutions(insts);
      if (existing) {
        const counts = new Map<string | null, number>();
        for (const row of existing) {
          counts.set(row.institution_id, (counts.get(row.institution_id) ?? 0) + 1);
        }
        setHeldCounts(counts);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [isOpen, householdId, supabase]);

  const selectedInstitution = institutions.find((i) => i.id === institutionId);
  const typeOptions = accountTypeOptions(selectedInstitution);

  const handleInstitutionChange = (value: string) => {
    setInstitutionId(value);
    /*
     * The type must follow the institution, not merely be validated against it.
     * Cash has no institution, a wallet is only ever a wallet, and a bank offers
     * current-or-savings — so every switch lands on a type that is legal for the
     * new choice. Leaving the old value would strand "Current account" under
     * JazzCash, which is what the constrained list exists to prevent.
     */
    setType(defaultTypeForInstitution(institutions.find((i) => i.id === value)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast({ type: "error", title: "Missing Name", description: "Please enter an account name." });
      return;
    }

    setLoading(true);

    /*
     * Every account starts at ZERO. There is no opening-balance field.
     *
     * An opening balance was written as a hidden transaction, so the account held
     * money that no entry accounted for — the exact gap that made Entries and
     * Accounts disagree. Money now arrives the same way it always does: you log an
     * income entry against the account, and it is visible in the log like every
     * other rupee.
     */
    const { error: accErr } = await supabase.from("accounts").insert({
      household_id: householdId,
      institution_id: institutionId === "none" ? null : institutionId,
      name: name.trim(),
      type,
      // Cash never carries one, even if a value was typed before the type
      // was switched — the field is hidden by then, so it would be invisible.
      account_number_last4: type === "cash" ? null : last4.trim() || null,
      currency: "PKR",
      balance_paisa: 0,
      is_locked: isLocked,
    });

    if (accErr) {
      setLoading(false);
      showToast({ type: "error", title: "Failed to create account", description: accErr.message });
      return;
    }

    setLoading(false);
    showToast({
      type: "success",
      title: "Account Created",
      description: `"${name}" starts at Rs 0 — log an income entry to fund it.`,
    });
    setName("");
    setLast4("");
    setIsLocked(false);
    // Institution and type were left behind on the last account, so adding a
    // wallet then reopening the form offered to add a second wallet.
    setInstitutionId(DEFAULT_INSTITUTION_ID);
    setType(DEFAULT_ACCOUNT_TYPE);
    onClose();
    if (onSuccess) onSuccess();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Financial Account"
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={loading}>
            Add Account
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <RichSelect
          label="Financial Institution"
          value={institutionId}
          onChange={handleInstitutionChange}
          options={institutionOptions(institutions, heldCounts)}
          hint="“held” marks where you already have an account — you can add another."
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

        {/*
          CASH HAS NO ACCOUNT NUMBER, so it is not asked for one.
          The field said "(Optional)" and enforced nothing, but offering "Last 4
          Digits" for notes in a drawer is a question with no possible answer —
          the same reason the lock control below is hidden for cash. The type
          select takes the full width rather than leaving a hole beside it.
        */}
        <div className={cn("grid gap-3", type !== "cash" && "grid-cols-2")}>
          <RichSelect
            label="Account Type"
            value={type}
            onChange={(v) => setType(v as AccountType)}
            options={typeOptions}
            disabled={typeOptions.length < 2}
          />

          {type !== "cash" && (
            <Input
              label="Last 4 Digits (Optional)"
              placeholder="e.g. 4821"
              maxLength={4}
              value={last4}
              onChange={(e) => setLast4(e.target.value)}
              className="ltr"
            />
          )}
        </div>

        {/*
          Locking is meaningless for cash — it is the account every entry falls
          back to, so a locked cash account would leave an expense nowhere legal
          to go. The database refuses it too (accounts_cash_never_locked).
        */}
        {type !== "cash" && (
          <label className="border-border hover:bg-surface-subtle flex cursor-pointer items-start gap-2.5 rounded-control border p-3 transition-colors">
            <input
              type="checkbox"
              checked={isLocked}
              onChange={(e) => setIsLocked(e.target.checked)}
              className="accent-navy-900 dark:accent-brass mt-0.5 size-4 shrink-0 rounded"
            />
            <span className="min-w-0">
              <span className="text-foreground flex items-center gap-1.5 text-[12.5px] font-medium">
                <Lock size={13} />
                Savings only — never spend from this
              </span>
              <span className="text-muted mt-0.5 block text-[11.5px] leading-snug">
                Money can be paid in but never taken out. It still counts toward
                what you hold, and it stays visible when logging an expense —
                greyed out, marked “Locked”, so you can see why it is unavailable.
              </span>
            </span>
          </label>
        )}

        <p className="text-faint text-[11px] leading-snug">
          The account starts at <span className="tnum">Rs 0</span>. Add money by
          logging an income entry against it, so every rupee in the balance is
          explained by something you can see in Entries.
        </p>
      </div>
    </Modal>
  );
}
