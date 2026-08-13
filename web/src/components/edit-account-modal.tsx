"use client";

import * as React from "react";
import { ArrowRight, CalendarClock, Lock, Scale } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { RichSelect } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { MerchantMark } from "@/components/merchant-mark";
import { accountTypeOptions } from "@/components/account-options";
import { createClient } from "@/lib/supabase/client";
import { ACCOUNT_TYPE_LABEL, institutionLogo } from "@/lib/ledger";
import { formatPKR } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { AccountType, Tables } from "@/lib/supabase/types";

type AccountWithInstitution = Tables<"accounts"> & {
  institutions?: Tables<"institutions"> | null;
};

export function EditAccountModal({
  isOpen,
  onClose,
  account,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  account: AccountWithInstitution | null;
  onSuccess?: () => void;
}) {
  const supabase = createClient();
  const { showToast } = useToast();

  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<AccountType>("checking");
  const [last4, setLast4] = React.useState("");
  const [isLocked, setIsLocked] = React.useState(false);
  const [correctedBalance, setCorrectedBalance] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const seedKey = `${isOpen}:${account?.id ?? "none"}`;
  const [seeded, setSeeded] = React.useState(seedKey);
  if (seeded !== seedKey) {
    setSeeded(seedKey);
    if (isOpen && account) {
      setName(account.name);
      setType(account.type as AccountType);
      setLast4(account.account_number_last4 ?? "");
      setIsLocked(account.is_locked);
      setCorrectedBalance((Number(account.balance_paisa) / 100).toString());
    }
  }

  if (!account) return null;

  const inst = account.institutions ?? null;
  const isCash = account.type === "cash";
  const currentBalance = Number(account.balance_paisa);
  const targetPaisa = Math.round((parseFloat(correctedBalance) || 0) * 100);
  const adjustmentPaisa = targetPaisa - currentBalance;

  /*
   * The institution is IDENTITY, not a field.
   *
   * It moved out of the form and into the header above: which bank an account
   * belongs to is not something you correct in passing, and the picker sitting
   * among the editable fields invited exactly that. Repointing an account at a
   * different bank while its transactions stay put would silently relabel every
   * one of them — if that is genuinely needed, the honest move is a new account.
   */
  const typeOptions = accountTypeOptions(inst ?? undefined);
  const typeOptionsWithCurrent = typeOptions.some((o) => o.value === type)
    ? typeOptions
    : [...typeOptions, { value: type, label: ACCOUNT_TYPE_LABEL[type] ?? type }];

  const created = new Date(account.created_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast({ type: "error", title: "Account name is required" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("accounts")
        .update({
          name: name.trim(),
          type,
          account_number_last4: last4.trim() || null,
          // Cash can never be locked; the DB rejects it too.
          is_locked: isCash ? false : isLocked,
        })
        .eq("id", account.id);
      if (error) throw error;

      /*
       * A balance correction is written as a real adjustment MOVEMENT, never as a
       * direct write to accounts.balance_paisa. The balance is derived by
       * sync_account_balance_trigger; setting it by hand would be silently undone
       * by the next movement and would leave the ledger not adding up to the
       * balance shown above it.
       */
      if (adjustmentPaisa !== 0) {
        const { error: adjErr } = await supabase.from("transactions").insert({
          household_id: account.household_id,
          account_id: account.id,
          amount_paisa: adjustmentPaisa,
          type: adjustmentPaisa > 0 ? "income" : "expense",
          note: "Balance correction",
          category_id: null,
        });
        if (adjErr) throw adjErr;
      }

      showToast({
        type: "success",
        title: "Account updated",
        description:
          adjustmentPaisa !== 0
            ? `A balance correction of ${formatPKR(Math.abs(adjustmentPaisa))} was added to the ledger.`
            : undefined,
      });
      onClose();
      onSuccess?.();
    } catch (err) {
      showToast({
        type: "error",
        title: "Could not update account",
        description: err instanceof Error ? err.message : "Unknown error.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit account"
      subtitle="Name, type and balance"
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={loading}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/*
          Identity band: who this account is with, and since when.

          Read-only on purpose. Repointing an account at a different bank while
          its transactions stay put would silently relabel every one of them — if
          that is genuinely needed, the honest move is a new account.
        */}
        <div className="bg-surface-subtle border-border flex items-center gap-3 rounded-card border p-3.5">
          <MerchantMark
            name={inst?.short_name ?? (isCash ? "Cash" : account.name)}
            brand={inst?.brand_color ?? "#16233a"}
            logo={institutionLogo(inst?.logo_path) ?? undefined}
            awaitingLogo={Boolean(inst && !inst.logo_path)}
            size={38}
          />
          <div className="min-w-0 flex-1">
            <p className="text-foreground truncate text-[13px] font-semibold">
              {inst?.name ?? "Cash in hand"}
            </p>
            <p className="text-faint mt-0.5 flex items-center gap-1 text-[11px]">
              <CalendarClock size={11} className="shrink-0" />
              <span className="italic">
                added <span className="ltr not-italic">{created}</span>
              </span>
            </p>
          </div>
          <span className="border-border text-faint shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium">
            {isCash ? "Default account" : "Institution"}
          </span>
        </div>

        <Input
          label="Account name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. UBL Current"
          // The seeded account came out named after a person. The account name is
          // the account; the person is the workspace owner.
          hint="Name the account, not yourself — e.g. “UBL Current”, “JazzCash Wallet”."
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <RichSelect
            label="Account type"
            value={type}
            onChange={(v) => setType(v as AccountType)}
            options={typeOptionsWithCurrent}
            disabled={typeOptionsWithCurrent.length < 2}
          />
          <Input
            label="Last 4 digits"
            value={last4}
            maxLength={4}
            onChange={(e) => setLast4(e.target.value)}
            placeholder="4821"
            className="ltr"
            disabled={isCash}
          />
        </div>

        {/*
          Reconciliation, not a balance field.

          The number here is DERIVED from the ledger, so this box does not set it
          — it works out the difference and writes that difference as a real
          movement. Saying so matters: an input pre-filled with the current
          balance looks editable, and a user who types over it expects the figure
          to change silently rather than a "Balance correction" row to appear in
          their August spending.
        */}
        <div className="border-border overflow-hidden rounded-card border">
          <div className="bg-surface-subtle border-border flex items-center gap-2 border-b px-3.5 py-2.5">
            <Scale size={13} className="text-brass-strong shrink-0" />
            <span className="text-foreground-2 text-[12px] font-medium">
              Reconcile against your statement
            </span>
            <span className="text-faint ms-auto text-[10.5px] italic">optional</span>
          </div>

          <div className="space-y-3 p-3.5">
            <Input
              label="What the balance should be (PKR)"
              type="number"
              step="any"
              value={correctedBalance}
              onChange={(e) => setCorrectedBalance(e.target.value)}
              className="tnum"
            />

            <div className="flex items-center gap-2.5 text-[11.5px]">
              <span className="text-muted shrink-0">Now</span>
              <span className="tnum text-foreground-2 font-medium">
                {formatPKR(currentBalance)}
              </span>
              {adjustmentPaisa !== 0 && (
                <>
                  <ArrowRight size={12} className="text-faint shrink-0" />
                  <span
                    className={cn(
                      "tnum font-semibold",
                      adjustmentPaisa > 0 ? "text-gain" : "text-loss",
                    )}
                  >
                    {formatPKR(targetPaisa)}
                  </span>
                  <span
                    className={cn(
                      "ms-auto shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
                      adjustmentPaisa > 0
                        ? "bg-gain-soft text-gain"
                        : "bg-loss-soft text-loss",
                    )}
                  >
                    {adjustmentPaisa > 0 ? "+" : "−"}
                    {formatPKR(Math.abs(adjustmentPaisa))}
                  </span>
                </>
              )}
            </div>

            <p className="text-faint text-[11px] italic leading-snug">
              {adjustmentPaisa !== 0 ? (
                <>
                  Saving writes a{" "}
                  <span className="tnum not-italic">
                    {formatPKR(Math.abs(adjustmentPaisa))}
                  </span>{" "}
                  {adjustmentPaisa > 0 ? "credit" : "debit"} labelled “Balance
                  correction” into the ledger — the balance is derived from the
                  ledger, so it is the only honest way to move it.
                </>
              ) : (
                "Use this only when a bank statement disagrees with the figure above. Everyday income and spending belong in Entries."
              )}
            </p>
          </div>
        </div>

        {/* Cash is the fallback every entry lands on, so it can never be locked. */}
        {!isCash && (
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
                Money can be paid in but never taken out. It still counts toward what
                you hold, and it stays visible when logging an expense — greyed out
                and marked “Locked”, so you can see why it is unavailable.
              </span>
            </span>
          </label>
        )}
      </div>
    </Modal>
  );
}
