"use client";

import * as React from "react";
import { Link2Off } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { RichSelect } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { ACCOUNT_TYPE_LABEL } from "@/lib/ledger";
import { formatPKR } from "@/lib/format";

import type { AccountType, Tables } from "@/lib/supabase/types";

const ACCOUNT_TYPES = (
  ["checking", "savings", "wallet", "cash", "credit", "investment"] as AccountType[]
).map((value) => ({ value, label: ACCOUNT_TYPE_LABEL[value] ?? value }));

export function EditAccountModal({
  isOpen,
  onClose,
  account,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  account: (Tables<"accounts"> & { institutions?: Tables<"institutions"> | null }) | null;
  onSuccess?: () => void;
}) {
  const supabase = createClient();
  const { showToast } = useToast();

  const [institutions, setInstitutions] = React.useState<Tables<"institutions">[]>([]);
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<AccountType>("checking");
  const [institutionId, setInstitutionId] = React.useState("none");
  const [last4, setLast4] = React.useState("");
  const [allowEntryLink, setAllowEntryLink] = React.useState(true);
  const [correctedBalance, setCorrectedBalance] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const seedKey = `${isOpen}:${account?.id ?? "none"}`;
  const [seeded, setSeeded] = React.useState(seedKey);
  if (seeded !== seedKey) {
    setSeeded(seedKey);
    if (isOpen && account) {
      setName(account.name);
      setType(account.type as AccountType);
      setInstitutionId(account.institution_id ?? "none");
      setLast4(account.account_number_last4 ?? "");
      setAllowEntryLink(account.allow_entry_link);
      setCorrectedBalance((Number(account.balance_paisa) / 100).toString());
    }
  }

  React.useEffect(() => {
    if (!isOpen) return;
    let active = true;
    supabase
      .from("institutions")
      .select("*")
      .order("name")
      .then(({ data }) => {
        if (active && data) setInstitutions(data);
      });
    return () => {
      active = false;
    };
  }, [isOpen, supabase]);

  if (!account) return null;

  const currentBalance = Number(account.balance_paisa);
  const targetPaisa = Math.round((parseFloat(correctedBalance) || 0) * 100);
  const adjustmentPaisa = targetPaisa - currentBalance;

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
          institution_id: institutionId === "none" ? null : institutionId,
          account_number_last4: last4.trim() || null,
          allow_entry_link: allowEntryLink,
        })
        .eq("id", account.id);
      if (error) throw error;

      /*
       * A balance correction is written as a real adjustment TRANSACTION, never as
       * a direct write to accounts.balance_paisa. The balance is derived by
       * sync_account_balance_trigger; setting it by hand would be silently undone
       * by the next transaction and would leave the ledger not adding up to the
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

      // Unlinking the account does not retroactively break existing links; the
      // flag governs new ones. Say so rather than let the user assume otherwise.
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

  const institutionOptions = [
    { value: "none", label: "Other / physical cash" },
    ...institutions.map((i) => ({
      value: i.id,
      label: i.name,
      description: i.short_name ?? undefined,
      avatarUrl: i.logo_path,
    })),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit account"
      subtitle="Name, institution, type and linking behaviour"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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

        <RichSelect
          label="Institution"
          value={institutionId}
          onChange={setInstitutionId}
          options={institutionOptions}
        />

        <div className="grid grid-cols-2 gap-3">
          <RichSelect
            label="Account type"
            value={type}
            onChange={(v) => setType(v as AccountType)}
            options={ACCOUNT_TYPES}
          />
          <Input
            label="Last 4 digits"
            value={last4}
            maxLength={4}
            onChange={(e) => setLast4(e.target.value)}
            placeholder="4821"
            className="ltr"
          />
        </div>

        <div className="border-border space-y-3 rounded-card border p-3.5">
          <Input
            label="Correct the balance (PKR)"
            type="number"
            step="any"
            value={correctedBalance}
            onChange={(e) => setCorrectedBalance(e.target.value)}
            className="tnum"
          />
          <p className="text-muted text-[11.5px] leading-snug">
            Currently{" "}
            <span className="tnum font-medium">{formatPKR(currentBalance)}</span>.
            {adjustmentPaisa !== 0 ? (
              <>
                {" "}
                Saving adds a{" "}
                <span className="tnum font-medium">
                  {formatPKR(Math.abs(adjustmentPaisa))}
                </span>{" "}
                {adjustmentPaisa > 0 ? "credit" : "debit"} labelled “Balance
                correction” to the ledger, so the ledger still sums to the balance.
              </>
            ) : (
              " Change this only to reconcile against a bank statement."
            )}
          </p>
        </div>

        <label className="border-border hover:bg-surface-subtle flex cursor-pointer items-start gap-2.5 rounded-control border p-3 transition-colors">
          <input
            type="checkbox"
            checked={!allowEntryLink}
            onChange={(e) => setAllowEntryLink(!e.target.checked)}
            className="accent-navy-900 dark:accent-brass mt-0.5 size-4 shrink-0 rounded"
          />
          <span className="min-w-0">
            <span className="text-foreground flex items-center gap-1.5 text-[12.5px] font-medium">
              <Link2Off size={13} />
              Run this account independently
            </span>
            <span className="text-muted mt-0.5 block text-[11.5px] leading-snug">
              Quick entries will not be able to link to it, so it behaves as a pure
              bank ledger. It still counts toward your net worth. Existing links are
              left alone.
            </span>
          </span>
        </label>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={loading}>
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
