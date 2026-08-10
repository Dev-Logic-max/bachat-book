"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { RichSelect } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { CategoryIcon } from "@/components/category-icon";
import { createClient } from "@/lib/supabase/client";
import {
  ACCOUNT_TYPE_LABEL,
  entryToSignedPaisa,
  groupCategories,
  todayISO,
} from "@/lib/ledger";

import type { SelectOption } from "@/components/ui/select";
import type { Tables } from "@/lib/supabase/types";

/** Sentinel for "not linked". A RichSelect value must be a string. */
const NO_LINK = "__none__";

export interface QuickEntryDraft {
  id: string;
  type: "income" | "expense";
  amount_paisa: number;
  category: string;
  category_id: string | null;
  note: string | null;
  entry_date: string;
  linked_transaction_id: string | null;
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
}

export function QuickAddModal({
  isOpen,
  onClose,
  defaultType = "expense",
  householdId,
  userId,
  onSuccess,
  entry = null,
}: QuickAddModalProps) {
  const isEdit = Boolean(entry);

  const [type, setType] = React.useState<"expense" | "income">(defaultType);
  const [amount, setAmount] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [note, setNote] = React.useState("");
  const [entryDate, setEntryDate] = React.useState(todayISO());
  const [accountId, setAccountId] = React.useState(NO_LINK);
  const [loading, setLoading] = React.useState(false);

  const [categories, setCategories] = React.useState<Tables<"categories">[]>([]);
  const [accounts, setAccounts] = React.useState<
    Array<Tables<"accounts"> & { institutions: Tables<"institutions"> | null }>
  >([]);

  const { showToast } = useToast();
  const supabase = createClient();

  // Re-seed the form whenever the modal opens, or the caller switches which entry
  // is being edited. A state initialiser cannot do this — the component stays
  // mounted between openings — and React Compiler bans setState in an effect.
  const formKey = `${isOpen}:${entry?.id ?? "new"}:${defaultType}`;
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
        setAccountId(NO_LINK); // resolved below once accounts load
      } else {
        setType(defaultType);
        setAmount("");
        setCategoryId("");
        setNote("");
        setEntryDate(todayISO());
        setAccountId(NO_LINK);
      }
    }
  }

  React.useEffect(() => {
    if (!isOpen || !householdId) return;
    let active = true;

    async function load() {
      const [catRes, accRes] = await Promise.all([
        supabase.from("categories").select("*").order("name"),
        supabase
          .from("accounts")
          .select("*, institutions(*)")
          .eq("household_id", householdId)
          .eq("is_archived", false)
          // Accounts opted out of linking must not even appear as a choice.
          // The database rejects them too (assert_entry_link_valid).
          .eq("allow_entry_link", true)
          .order("name"),
      ]);

      if (!active) return;
      if (catRes.data) setCategories(catRes.data);
      if (accRes.data) {
        setAccounts(
          accRes.data as unknown as Array<
            Tables<"accounts"> & { institutions: Tables<"institutions"> | null }
          >,
        );
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [isOpen, householdId, supabase]);

  // In edit mode, resolve which account the linked transaction belongs to so the
  // picker shows the existing link rather than "Not linked".
  const linkedTxId = entry?.linked_transaction_id ?? null;
  React.useEffect(() => {
    if (!isOpen || !linkedTxId) return;
    let active = true;

    supabase
      .from("transactions")
      .select("account_id")
      .eq("id", linkedTxId)
      .single()
      .then(({ data }) => {
        if (active && data?.account_id) setAccountId(data.account_id);
      });

    return () => {
      active = false;
    };
  }, [isOpen, linkedTxId, supabase]);

  const categoryOptions: SelectOption[] = React.useMemo(
    () =>
      groupCategories(categories, type).map(({ category, groupLabel }) => ({
        value: category.id,
        label: category.name,
        group: groupLabel,
        icon: <CategoryIcon icon={category.icon} size={15} />,
      })),
    [categories, type],
  );

  // Switching income/expense invalidates the chosen category — the two kinds are
  // disjoint sets in the DB.
  const categoryStillValid = categoryOptions.some((o) => o.value === categoryId);
  const effectiveCategoryId = categoryStillValid ? categoryId : "";

  const accountOptions: SelectOption[] = React.useMemo(
    () => [
      {
        value: NO_LINK,
        label: "Not linked — standalone entry",
        description: "Stays in Entries only. No account balance changes.",
      },
      ...accounts.map((a) => ({
        value: a.id,
        label: a.name,
        description: [
          a.institutions?.short_name ?? a.institutions?.name,
          ACCOUNT_TYPE_LABEL[a.type] ?? a.type,
        ]
          .filter(Boolean)
          .join(" · "),
        avatarUrl: a.institutions?.logo_path ?? null,
      })),
    ],
    [accounts],
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
    const unsignedPaisa = Math.round(numAmount * 100);
    const wantsLink = accountId !== NO_LINK;

    try {
      if (isEdit && entry) {
        // The 0011 trigger propagates these fields to a linked transaction, so
        // the entry update is the only write needed for the shared fields.
        const { error } = await supabase
          .from("quick_entries")
          .update({
            type,
            amount_paisa: unsignedPaisa,
            category: effectiveCategoryId,
            category_id: effectiveCategoryId,
            note: note.trim() || null,
            entry_date: entryDate,
          })
          .eq("id", entry.id);
        if (error) throw error;

        // Link changes are a separate concern from field edits.
        const hadLink = Boolean(entry.linked_transaction_id);
        if (!wantsLink && hadLink) {
          const { error: unlinkErr } = await supabase
            .from("quick_entries")
            .update({ linked_transaction_id: null })
            .eq("id", entry.id);
          if (unlinkErr) throw unlinkErr;
        } else if (wantsLink && !hadLink) {
          const txId = await createLinkedTransaction(unsignedPaisa);
          const { error: linkErr } = await supabase
            .from("quick_entries")
            .update({ linked_transaction_id: txId })
            .eq("id", entry.id);
          if (linkErr) throw linkErr;
        }

        showToast({ type: "success", title: "Entry updated" });
      } else {
        const txId = wantsLink ? await createLinkedTransaction(unsignedPaisa) : null;

        const { error } = await supabase.from("quick_entries").insert({
          user_id: userId,
          household_id: householdId,
          type,
          amount_paisa: unsignedPaisa,
          category: effectiveCategoryId,
          category_id: effectiveCategoryId,
          note: note.trim() || null,
          entry_date: entryDate,
          linked_transaction_id: txId,
        });
        if (error) throw error;

        showToast({
          type: "success",
          title: type === "expense" ? "Expense added" : "Income added",
          description: wantsLink
            ? `Rs ${numAmount.toLocaleString()} logged and synced to the account.`
            : `Rs ${numAmount.toLocaleString()} logged.`,
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

  async function createLinkedTransaction(unsignedPaisa: number): Promise<string> {
    const { data, error } = await supabase
      .from("transactions")
      .insert({
        household_id: householdId,
        account_id: accountId,
        category_id: effectiveCategoryId,
        amount_paisa: entryToSignedPaisa(type, unsignedPaisa),
        type,
        date: entryDate,
        note: note.trim() || null,
      })
      .select("id")
      .single();

    if (error || !data) {
      throw error ?? new Error("Could not create the linked transaction.");
    }
    return data.id;
  }

  const linkedAccountName =
    accountId !== NO_LINK
      ? accounts.find((a) => a.id === accountId)?.name
      : undefined;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isEdit
          ? "Edit entry"
          : type === "expense"
            ? "Add Expense"
            : "Add Income"
      }
      subtitle={
        isEdit
          ? "Changes apply to the linked transaction too"
          : "Log a quick entry to your active workspace"
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
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
          />

          {/*
           * Date used to be hardcoded to today with no field at all. Backdating is
           * the most common correction in a finance app.
           */}
          <Input
            label="Date"
            type="date"
            value={entryDate}
            max={todayISO()}
            onChange={(e) => setEntryDate(e.target.value)}
            required
            className="ltr"
          />
        </div>

        <RichSelect
          label="Category"
          value={effectiveCategoryId}
          onChange={setCategoryId}
          options={categoryOptions}
          placeholder={
            categoryOptions.length === 0 ? "Loading categories…" : "Choose a category"
          }
          emptyMessage="No categories for this type"
        />

        <RichSelect
          label="Link to account (optional)"
          value={accountId}
          onChange={setAccountId}
          options={accountOptions}
          hint={
            linkedAccountName
              ? `Creates a matching transaction in ${linkedAccountName}. Editing either side updates both.`
              : "Leave unlinked to keep this entry independent of your accounts."
          }
        />

        <Input
          label="Note (optional)"
          placeholder="e.g. Monthly kiryana at Al-Fatah"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={loading}>
            {isEdit ? "Save changes" : "Save entry"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
