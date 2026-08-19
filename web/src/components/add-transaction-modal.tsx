"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { RichSelect } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { CategoryPicker } from "@/components/category-picker";
import { useHiddenCategoryIds } from "@/lib/use-hidden-categories";
import { MerchantMark } from "@/components/merchant-mark";
import { accountSelectOptions } from "@/components/account-options";
import type { AccountWithInstitution } from "@/components/account-options";
import { createClient } from "@/lib/supabase/client";
import { relationship } from "@/lib/contacts";
import { BANKING_ACCOUNT_TYPES, todayISO } from "@/lib/ledger";
import { formatPKR } from "@/lib/format";
import type { SelectOption } from "@/components/ui/select";
import type { Tables } from "@/lib/supabase/types";

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  householdId: string;
  userId: string;
  onSuccess?: () => void;
}

/**
 * The Transactions door into the single ledger.
 *
 * Writes exactly the same row the Entries form writes — there is one table. The
 * only difference is which accounts it offers: this screen shows bank and wallet
 * movement, so logging a CASH expense here would save a row that then vanished
 * from the list that created it. Cash belongs on Entries.
 */
export function AddTransactionModal({
  isOpen,
  onClose,
  householdId,
  userId,
  onSuccess,
}: AddTransactionModalProps) {
  const [accounts, setAccounts] = React.useState<AccountWithInstitution[]>([]);
  const [categories, setCategories] = React.useState<Tables<"categories">[]>([]);
  const [merchants, setMerchants] = React.useState<Tables<"merchants">[]>([]);
  const [contacts, setContacts] = React.useState<Tables<"contacts">[]>([]);

  const [accountId, setAccountId] = React.useState("");
  const [type, setType] = React.useState<"expense" | "income">("expense");
  const [amount, setAmount] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [merchantId, setMerchantId] = React.useState("none");
  const [contactId, setContactId] = React.useState("none");
  const [note, setNote] = React.useState("");
  // Local date. toISOString() is UTC and lands on yesterday before 05:00 PKT.
  const [date, setDate] = React.useState(todayISO);
  const [loading, setLoading] = React.useState(false);

  const { showToast } = useToast();
  const supabase = createClient();
  const hiddenCategoryIds = useHiddenCategoryIds(householdId);


  React.useEffect(() => {
    let active = true;
    if (!isOpen || !householdId) return;

    async function loadData() {
      const [accRes, catRes, merRes, conRes] = await Promise.all([
        supabase
          .from("accounts")
          .select("*, institutions(*)")
          .eq("household_id", householdId)
          .eq("is_archived", false)
          .is("deleted_at", null)
          .in("type", [...BANKING_ACCOUNT_TYPES]),
        supabase
          .from("categories")
          .select("*")
          .order("sort_order")
          .order("name"),
        supabase.from("merchants").select("*").order("name", { ascending: true }),
        supabase
          .from("contacts")
          .select("*")
          .eq("household_id", householdId)
          .order("name"),
      ]);

      if (active) {
        if (accRes.data) {
          setAccounts(accRes.data as unknown as AccountWithInstitution[]);
          if (accRes.data.length > 0 && !accountId) setAccountId(accRes.data[0].id);
        }
        if (catRes.data) {
          setCategories(catRes.data);
          if (catRes.data.length > 0 && !categoryId) setCategoryId(catRes.data[0].id);
        }
        if (merRes.data) setMerchants(merRes.data);
        if (conRes.data) setContacts(conRes.data);
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
      contact_id: contactId === "none" ? null : contactId,
      amount_paisa: signedAmountPaisa,
      type,
      date,
      note: note.trim() || null,
      created_by: userId,
    });

    setLoading(false);

    if (error) {
      showToast({ type: "error", title: "Transaction failed", description: error.message });
      return;
    }

    showToast({
      type: "success",
      title: `${type === "income" ? "Income" : "Expense"} Recorded`,
      description: `Rs ${parsed.toLocaleString()} — the account balance has moved.`,
    });

    setAmount("");
    setNote("");
    setContactId("none");
    onClose();
    if (onSuccess) onSuccess();
  };

  const accountOptions = accountSelectOptions(accounts, { direction: type });

  // Parent-first with children grouped underneath. A flat alphabetical list of

  const merchantOptions: SelectOption[] = [
    { value: "none", label: "No merchant", description: "Type it in the note instead" },
    ...merchants.map((m) => ({
      value: m.id,
      label: m.name,
      icon: (
        <MerchantMark
          name={m.name}
          brand={m.brand_color}
          logo={m.logo_path ?? undefined}
          awaitingLogo={!m.logo_path}
          size={22}
        />
      ),
    })),
  ];

  const contactOptions: SelectOption[] = [
    { value: "none", label: "Nobody in particular", description: "Most everyday spending" },
    ...contacts.map((c) => ({
      value: c.id,
      label: c.name,
      description: relationship(c.relationship).label,
      secondaryLabel: c.phone ?? undefined,
    })),
  ];

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const amountPaisaPreview = Math.round((parseFloat(amount) || 0) * 100);
  const projected = selectedAccount
    ? Number(selectedAccount.balance_paisa) +
      (type === "income" ? amountPaisaPreview : -amountPaisaPreview)
    : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Log Transaction"
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={loading}>
            Save Transaction
          </Button>
        </>
      }
    >
      <div className="space-y-4">
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

        <RichSelect
          label="Account"
          value={accountId}
          onChange={setAccountId}
          options={accountOptions}
          placeholder={accounts.length === 0 ? "Loading accounts…" : "Choose an account"}
          emptyMessage="Add a bank or wallet account first"
          hint={
            selectedAccount && projected !== null && amountPaisaPreview > 0
              ? `${formatPKR(Number(selectedAccount.balance_paisa))} → ${formatPKR(projected)} after this`
              : selectedAccount
                ? `Holds ${formatPKR(Number(selectedAccount.balance_paisa))}`
                : "Cash spending belongs in Entries — this list is banks and wallets."
          }
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
            className="tnum"
          />

          <DatePicker
            label="Date"
            value={date}
            onChange={setDate}
            max={todayISO()}
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CategoryPicker
            value={categoryId}
            onChange={setCategoryId}
            categories={categories}
            kind={type}
            householdId={householdId}
            hiddenIds={hiddenCategoryIds}
          />

          <RichSelect
            label="Merchant (Optional)"
            value={merchantId}
            onChange={setMerchantId}
            options={merchantOptions}
          />
        </div>

        {/*
          WHO, as distinct from WHERE.

          A merchant is a shop you bought from; a contact is a person the money
          passed between. "Rs 5,000 to Aslam the plumber" is not a merchant
          transaction, and until now the only place to put his name was the free
          text note, where nothing could ever group by it. Hidden entirely when
          the household has no contacts yet, so an empty picker never sits on
          the form asking a question it cannot answer.
        */}
        {contacts.length > 0 && (
          <RichSelect
            label="Person (Optional)"
            value={contactId}
            onChange={setContactId}
            searchable={contacts.length >= 8}
            options={contactOptions}
            hint="Who the money passed between. Changes nothing about the amount — it just lets Contacts show what has gone back and forth."
          />
        )}

        <Input
          label="Note / Description"
          placeholder="e.g. Kiryana items, Fuel, Salary"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

      </div>
    </Modal>
  );
}
