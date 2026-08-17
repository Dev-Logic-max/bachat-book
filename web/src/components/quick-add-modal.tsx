"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { CategoryPicker } from "@/components/category-picker";
import { Input } from "@/components/ui/input";
import { RichSelect } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useHiddenCategoryIds } from "@/lib/use-hidden-categories";
import { DatePicker } from "@/components/ui/date-picker";
import { accountSelectOptions } from "@/components/account-options";
import { createClient } from "@/lib/supabase/client";
import { ensureCashAccount } from "@/lib/ledger-actions";
import { toSignedPaisa, todayISO } from "@/lib/ledger";
import { formatPKR } from "@/lib/format";

import type { SelectOption } from "@/components/ui/select";
import type { Tables } from "@/lib/supabase/types";

type AccountWithInstitution = Tables<"accounts"> & {
  institutions: Tables<"institutions"> | null;
};

/**
 * The draft an edit passes back in. `account_id` is not optional — under the
 * single-ledger model every movement names an account.
 */
export interface QuickEntryDraft {
  id: string;
  type: "income" | "expense";
  amount_paisa: number;
  category_id: string | null;
  note: string | null;
  entry_date: string;
  account_id: string;
}

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: "expense" | "income";
  householdId: string;
  userId: string;
  onSuccess?: () => void;
  /** Present = edit mode. */
  entry?: QuickEntryDraft | null;
  /**
   * Pre-selects an account, for the "Log Transaction" door into this same form.
   * Without it the form opens on cash.
   */
  defaultAccountId?: string | null;
}

export function QuickAddModal({
  isOpen,
  onClose,
  defaultType = "expense",
  householdId,
  userId,
  onSuccess,
  entry = null,
  defaultAccountId = null,
}: QuickAddModalProps) {
  const isEdit = Boolean(entry);

  const [type, setType] = React.useState<"expense" | "income">(defaultType);
  const [amount, setAmount] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [note, setNote] = React.useState("");
  const [entryDate, setEntryDate] = React.useState(todayISO());
  const [accountId, setAccountId] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const [categories, setCategories] = React.useState<Tables<"categories">[]>([]);
  const [catalogueKey, setCatalogueKey] = React.useState(0);
  const [accounts, setAccounts] = React.useState<AccountWithInstitution[]>([]);

  const { showToast } = useToast();
  const supabase = createClient();
  const hiddenCategoryIds = useHiddenCategoryIds(householdId);


  // Re-seed whenever the modal opens or the caller switches which entry is being
  // edited. A state initialiser cannot do this — the component stays mounted
  // between openings — and React Compiler bans setState in an effect.
  const formKey = `${isOpen}:${entry?.id ?? "new"}:${defaultType}:${defaultAccountId ?? ""}`;
  const [seededKey, setSeededKey] = React.useState(formKey);
  if (seededKey !== formKey) {
    setSeededKey(formKey);
    if (isOpen) {
      if (entry) {
        setType(entry.type);
        setAmount((entry.amount_paisa / 100).toString());
        setCategoryId(entry.category_id ?? "");
        setNote(entry.note ?? "");
        setEntryDate(entry.entry_date);
        setAccountId(entry.account_id);
      } else {
        setType(defaultType);
        setAmount("");
        setCategoryId("");
        setNote("");
        setEntryDate(todayISO());
        // Resolved to the cash account once accounts load, unless the caller
        // named one.
        setAccountId(defaultAccountId ?? "");
      }
    }
  }

  React.useEffect(() => {
    if (!isOpen || !householdId) return;
    let active = true;

    async function load() {
      const [catRes, accRes] = await Promise.all([
        // Catalogue order, not alphabetical -- groupCategories sorts on it.
        supabase
          .from("categories")
          .select("*")
          .order("sort_order")
          .order("name"),
        supabase
          .from("accounts")
          .select("*, institutions(*)")
          .eq("household_id", householdId)
          .is("deleted_at", null)
          .order("created_at"),
      ]);

      if (!active) return;
      if (catRes.data) setCategories(catRes.data);
      if (accRes.data) setAccounts(accRes.data as unknown as AccountWithInstitution[]);
    }

    load();
    return () => {
      active = false;
    };
  }, [isOpen, householdId, supabase, catalogueKey]);

  /*
   * Default to cash — DERIVED, not stored.
   *
   * Every movement must name an account, so the form can never sit on "nothing
   * selected". Cash is the honest default: money you spent without saying where
   * from is money out of your pocket. Resolving it here rather than at submit
   * time means you SEE which balance you are about to move before you save.
   *
   * Accounts arrive asynchronously, so the obvious version of this is an effect
   * that calls setAccountId once they land — but that is a synchronous setState
   * in useEffect, which React Compiler rejects. Falling back at read time needs
   * no effect and cannot fight an explicit choice.
   */
  const cashAccountId =
    accounts.find((a) => a.type === "cash" && !a.is_archived && !a.deleted_at)?.id ?? "";
  const effectiveAccountId = accountId || cashAccountId;

  /*
   * Switching income/expense invalidates the chosen category — the two kinds are
   * disjoint sets in the DB. Derived during render rather than reset in an
   * effect, which React Compiler rejects.
   *
   * CategoryPicker splits this single id back into its two fields, so there is
   * no second piece of state here that could disagree with what gets saved.
   */
  const chosenCategory = categories.find((c) => c.id === categoryId);
  const effectiveCategoryId = chosenCategory?.kind === type ? categoryId : "";

  /*
   * Unavailable accounts are SHOWN, not hidden — greyed with the reason on the
   * right. One shared builder so every account picker in the app renders the
   * same mark, balance and chip.
   */
  const accountOptions: SelectOption[] = React.useMemo(
    () => accountSelectOptions(accounts, { direction: type }),
    [accounts, type],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const numAmount = parseFloat(amount);
    if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
      showToast({
        type: "error",
        title: "Invalid amount",
        description: "Enter a rupee amount greater than zero.",
      });
      return;
    }
    if (!effectiveCategoryId) {
      showToast({
        type: "error",
        title: "Pick a category",
        description: "Every entry needs a category so reports can group it.",
      });
      return;
    }
    if (entryDate > todayISO()) {
      showToast({
        type: "error",
        title: "Date is in the future",
        description: "An entry records money that already moved.",
      });
      return;
    }

    setLoading(true);
    try {
      /*
       * Never save without an account. If the accounts query has not landed yet,
       * or the household genuinely has no cash account, create one rather than
       * writing a movement that belongs nowhere — that is exactly the standalone
       * entry this model exists to eliminate.
       */
      const targetAccountId =
        effectiveAccountId || (await ensureCashAccount(supabase, householdId));
      const signedPaisa = toSignedPaisa(type, Math.round(numAmount * 100));

      if (isEdit && entry) {
        /*
         * ONE row, so one UPDATE — including `account_id`. Changing the account
         * used to be a silent no-op: the old code had branches for adding and
         * removing a link but none for moving one, so the money never followed.
         * sync_account_balance_trigger settles BOTH the old and new account off
         * this single write.
         */
        const { error } = await supabase
          .from("transactions")
          .update({
            account_id: targetAccountId,
            category_id: effectiveCategoryId,
            amount_paisa: signedPaisa,
            type,
            date: entryDate,
            note: note.trim() || null,
          })
          .eq("id", entry.id);
        if (error) throw error;

        showToast({ type: "success", title: "Entry updated" });
      } else {
        const { error } = await supabase.from("transactions").insert({
          household_id: householdId,
          account_id: targetAccountId,
          category_id: effectiveCategoryId,
          amount_paisa: signedPaisa,
          type,
          date: entryDate,
          note: note.trim() || null,
          created_by: userId,
        });
        if (error) throw error;

        const accountName =
          accounts.find((a) => a.id === targetAccountId)?.name ?? "your cash";
        showToast({
          type: "success",
          title: type === "expense" ? "Expense added" : "Income added",
          description: `Rs ${numAmount.toLocaleString()} ${
            type === "expense" ? "out of" : "into"
          } ${accountName}.`,
        });
      }

      onClose();
      onSuccess?.();
    } catch (err) {
      showToast({
        type: "error",
        title: isEdit ? "Could not update entry" : "Could not add entry",
        description: err instanceof Error ? err.message : "Unknown error.",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedAccount = accounts.find((a) => a.id === effectiveAccountId);
  const previewPaisa = Math.round((parseFloat(amount) || 0) * 100);
  const projectedPaisa = selectedAccount
    ? Number(selectedAccount.balance_paisa) +
      (type === "income" ? previewPaisa : -previewPaisa)
    : 0;

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isEdit ? "Edit entry" : type === "expense" ? "Add Expense" : "Add Income"
      }
      subtitle={
        isEdit
          ? "The account balance follows this entry"
          : "Every entry moves one of your accounts"
      }
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={loading}>
            {isEdit ? "Save changes" : "Save entry"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="bg-surface-subtle grid grid-cols-2 gap-1 rounded-control p-1">
          {(["expense", "income"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              aria-pressed={type === t}
              className={`rounded-control py-1.5 text-xs font-medium capitalize transition-colors ${
                type === t
                  ? "bg-surface text-foreground shadow-xs"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Amount (PKR)"
            type="number"
            step="any"
            min="0"
            placeholder="e.g. 2500"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            autoFocus
            className="tnum"
          />

          {/*
           * Date used to be hardcoded to today with no field at all. Backdating is
           * the most common correction in a finance app.
           */}
          <DatePicker
            label="Date"
            value={entryDate}
            onChange={setEntryDate}
            max={todayISO()}
            required
          />
        </div>

        {/*
          The label row carries its own action. "Which categories exist?" comes
          up mid-form, and the only answer used to be Settings → Categories,
          which meant abandoning a part-filled entry to find out.
        */}
        <CategoryPicker
          value={effectiveCategoryId}
          onChange={setCategoryId}
          categories={categories}
          kind={type}
          householdId={householdId}
          hiddenIds={hiddenCategoryIds}
          onCatalogueChanged={() => setCatalogueKey((k) => k + 1)}
        />

        {/*
         * Required, not optional. There is no "standalone entry" any more — an
         * entry that belonged to no account was money the app claimed you earned
         * or spent while no balance anywhere reflected it.
         */}
        <RichSelect
          label="Account"
          value={effectiveAccountId}
          onChange={setAccountId}
          options={accountOptions}
          placeholder={accounts.length === 0 ? "Loading accounts…" : "Choose an account"}
          emptyMessage="Add an account first"
          hint={
            selectedAccount && previewPaisa > 0
              ? `${formatPKR(Number(selectedAccount.balance_paisa))} → ${formatPKR(projectedPaisa)} after this`
              : selectedAccount
                ? `Holds ${formatPKR(Number(selectedAccount.balance_paisa))}`
                : "Defaults to cash — every entry moves an account."
          }
        />

        <Input
          label="Note (optional)"
          placeholder="e.g. Monthly kiryana at Al-Fatah"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </Modal>

    </>
  );
}
