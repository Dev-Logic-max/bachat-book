"use client";

import * as React from "react";
import { X, Trash2, Split, ArrowUpRight, ArrowDownRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, RichSelect } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { CategoryIcon } from "@/components/category-icon";
import { LinkBadge } from "@/components/ui/row-actions";
import { createClient } from "@/lib/supabase/client";
import { deleteTransaction, findLinkedEntry } from "@/lib/ledger-actions";
import {
  PAYMENT_METHOD_LABEL,
  entryToSignedPaisa,
  groupCategories,
  todayISO,
} from "@/lib/ledger";
import { formatPKR } from "@/lib/format";
import type { PaymentMethod, Tables } from "@/lib/supabase/types";

type FullTransaction = Tables<"transactions"> & {
  accounts?: Tables<"accounts"> | null;
  categories?: Tables<"categories"> | null;
  merchants?: Tables<"merchants"> | null;
};

interface TransactionDrawerProps {
  transaction: FullTransaction | null;
  onClose: () => void;
  onUpdate?: () => void;
}

export function TransactionDrawer({
  transaction,
  onClose,
  onUpdate,
}: TransactionDrawerProps) {
  const supabase = createClient();
  const { showToast } = useToast();

  const [categories, setCategories] = React.useState<Tables<"categories">[]>([]);
  const [merchants, setMerchants] = React.useState<Tables<"merchants">[]>([]);

  const [prevTxId, setPrevTxId] = React.useState<string | null>(transaction?.id || null);
  const [categoryId, setCategoryId] = React.useState(transaction?.category_id || "");
  const [merchantId, setMerchantId] = React.useState(transaction?.merchant_id || "none");
  const [note, setNote] = React.useState(transaction?.note || "");
  const [amount, setAmount] = React.useState(
    transaction ? (Math.abs(transaction.amount_paisa) / 100).toString() : "",
  );
  const [date, setDate] = React.useState(transaction?.date || todayISO());
  const [referenceNo, setReferenceNo] = React.useState(transaction?.reference_no || "");
  const [paymentMethod, setPaymentMethod] = React.useState(
    transaction?.payment_method || "none",
  );
  const [isSplitting, setIsSplitting] = React.useState(false);
  const [splitLines, setSplitLines] = React.useState<{ category_id: string; amount: string; note: string }[]>([]);
  const [loading, setLoading] = React.useState(false);

  // The quick entry synced to this transaction, if any. The FK lives on
  // quick_entries, so a transaction cannot name its partner without a lookup.
  const [linkedEntry, setLinkedEntry] = React.useState<{
    id: string;
    amount_paisa: number;
    note: string | null;
  } | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  // Sync state when transaction prop changes
  if (transaction && transaction.id !== prevTxId) {
    setPrevTxId(transaction.id);
    setCategoryId(transaction.category_id || "");
    setMerchantId(transaction.merchant_id || "none");
    setNote(transaction.note || "");
    setAmount((Math.abs(transaction.amount_paisa) / 100).toString());
    setDate(transaction.date);
    setReferenceNo(transaction.reference_no || "");
    setPaymentMethod(transaction.payment_method || "none");
    setLinkedEntry(null);
  }

  React.useEffect(() => {
    let active = true;
    if (!transaction) return;
    const txId = transaction.id;

    async function loadData() {
      const [catRes, merRes, splitRes] = await Promise.all([
        supabase.from("categories").select("*").order("name", { ascending: true }),
        supabase.from("merchants").select("*").order("name", { ascending: true }),
        supabase.from("transaction_splits").select("*").eq("transaction_id", txId),
      ]);

      const linked = await findLinkedEntry(supabase, txId);

      if (active) {
        if (catRes.data) setCategories(catRes.data);
        if (merRes.data) setMerchants(merRes.data);
        setLinkedEntry(linked);
        if (splitRes.data && splitRes.data.length > 0) {
          setIsSplitting(true);
          setSplitLines(
            splitRes.data.map((s) => ({
              category_id: s.category_id,
              amount: (Math.abs(s.amount_paisa) / 100).toString(),
              note: s.note || "",
            }))
          );
        }
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [transaction, supabase]);

  if (!transaction) return null;

  const totalAmountPaisa = Math.abs(transaction.amount_paisa);
  const totalAmountPKR = totalAmountPaisa / 100;
  const isIncome = transaction.amount_paisa > 0;

  const handleAddSplitLine = () => {
    setSplitLines([...splitLines, { category_id: categories[0]?.id || "", amount: "", note: "" }]);
  };

  const handleRemoveSplitLine = (index: number) => {
    setSplitLines(splitLines.filter((_, i) => i !== index));
  };

  const handleSplitChange = (index: number, field: string, value: string) => {
    const next = [...splitLines];
    next[index] = { ...next[index], [field]: value };
    setSplitLines(next);
  };

  const splitSumPKR = splitLines.reduce((acc, l) => acc + (parseFloat(l.amount) || 0), 0);
  const splitRemainingPKR = totalAmountPKR - splitSumPKR;

  const handleSave = async () => {
    setLoading(true);

    // Validate splits if active
    if (isSplitting && splitLines.length > 0) {
      if (Math.abs(splitRemainingPKR) > 0.01) {
        setLoading(false);
        showToast({
          type: "error",
          title: "Split Amount Mismatch",
          description: `The split lines must sum up to Rs ${totalAmountPKR.toLocaleString()} exactly (Remaining: Rs ${splitRemainingPKR.toFixed(2)}).`,
        });
        return;
      }
    }

    const newAmount = parseFloat(amount);
    if (!newAmount || isNaN(newAmount) || newAmount <= 0) {
      setLoading(false);
      showToast({
        type: "error",
        title: "Invalid amount",
        description: "Enter a rupee amount greater than zero.",
      });
      return;
    }

    /*
     * 1. Update the transaction.
     *
     * amount_paisa is SIGNED here — the balance trigger adds it directly, so the
     * original direction has to be preserved rather than the raw input written.
     * If this row is linked to a quick entry, the 0011 trigger propagates amount,
     * date, category and note across; no second write is needed for those.
     */
    const { error: txErr } = await supabase
      .from("transactions")
      .update({
        category_id: categoryId || null,
        merchant_id: merchantId === "none" ? null : merchantId,
        note: note.trim() || null,
        amount_paisa: entryToSignedPaisa(
          isIncome ? "income" : "expense",
          Math.round(newAmount * 100),
        ),
        date,
        reference_no: referenceNo.trim() || null,
        payment_method:
          paymentMethod === "none" ? null : (paymentMethod as PaymentMethod),
      })
      .eq("id", transaction.id);

    if (txErr) {
      setLoading(false);
      showToast({ type: "error", title: "Update Failed", description: txErr.message });
      return;
    }

    // 2. Clear & Save Splits
    await supabase.from("transaction_splits").delete().eq("transaction_id", transaction.id);

    if (isSplitting && splitLines.length > 0) {
      const splitPayload = splitLines.map((line) => ({
        transaction_id: transaction.id,
        category_id: line.category_id,
        amount_paisa: Math.round(parseFloat(line.amount) * 100),
        note: line.note.trim() || null,
      }));
      await supabase.from("transaction_splits").insert(splitPayload);
    }

    setLoading(false);
    showToast({ type: "success", title: "Transaction Updated", description: "Ledger entry updated successfully." });
    onClose();
    if (onUpdate) onUpdate();
  };

  /*
   * Delete goes through the shared ConfirmDeleteModal, never window.confirm: a
   * native dialog cannot name the linked records or state the balance change, and
   * this row may be half of a synced pair.
   */
  const handleDelete = async (cascade: boolean) => {
    try {
      await deleteTransaction(
        supabase,
        transaction.id,
        linkedEntry?.id ?? null,
        cascade,
      );
      showToast({
        type: "success",
        title: "Transaction deleted",
        description: linkedEntry
          ? cascade
            ? "The linked entry was deleted too."
            : "The linked entry was kept and unlinked."
          : "Account balance recalculated.",
      });
      setConfirmOpen(false);
      onClose();
      if (onUpdate) onUpdate();
    } catch (err) {
      showToast({
        type: "error",
        title: "Delete failed",
        description: err instanceof Error ? err.message : "Unknown error.",
      });
    }
  };

  // Category options grouped parent -> child with the category's own icon, rather
  // than a flat alphabetical list of 37 where children and parents interleave.
  const categoryOptions = groupCategories(
    categories,
    transaction.type === "transfer" ? undefined : transaction.type,
  ).map(({ category, groupLabel }) => ({
    value: category.id,
    label: category.name,
    group: groupLabel,
    icon: <CategoryIcon icon={category.icon} size={15} />,
  }));

  const splitCategoryOptions = categories.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  const merchantOptions = [
    { value: "none", label: "None" },
    ...merchants.map((m) => ({ value: m.id, label: m.name })),
  ];

  const paymentMethodOptions = [
    { value: "none", label: "Not recorded" },
    ...Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => ({
      value,
      label,
    })),
  ];

  const currentBalance = Number(transaction.accounts?.balance_paisa ?? 0);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-navy-950/60 backdrop-blur-xs flex justify-end">
      <div className="bg-surface border-l border-border w-full max-w-md h-full overflow-y-auto p-6 shadow-2xl flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div className="flex items-center gap-2">
              {/* Direction derives from the sign. These were the wrong way round:
                  income drew a down-arrow next to a green +. */}
              <span className={`p-1.5 rounded-full ${isIncome ? "bg-gain-subtle text-gain" : "bg-loss-subtle text-loss"}`}>
                {isIncome ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
              </span>
              <h2 className="font-display text-lg font-bold">Transaction Details</h2>
            </div>
            <button onClick={onClose} className="p-1 text-muted hover:text-foreground rounded-full">
              <X size={20} />
            </button>
          </div>

          {/* Amount Hero */}
          <div className="my-6 text-center bg-surface-subtle border border-border rounded-panel p-6">
            <span className="text-muted text-[11px] uppercase tracking-wider block">Transaction Amount</span>
            <div className={`font-display text-3xl font-bold mt-1 ${isIncome ? "text-gain" : "text-loss"}`}>
              {isIncome ? "+" : "-"}
              {formatPKR(totalAmountPaisa)}
            </div>
            <span className="text-muted text-xs block mt-1">
              {transaction.accounts?.name || "Unassigned"} ·{" "}
              <span className="ltr">{transaction.date}</span>
            </span>
            {linkedEntry && (
              <div className="mt-2.5 flex justify-center">
                <LinkBadge label="Synced with an entry" />
              </div>
            )}
          </div>

          {/* Form Controls */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Amount (PKR)"
                type="number"
                step="any"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <Input
                label="Date"
                type="date"
                value={date}
                max={todayISO()}
                onChange={(e) => setDate(e.target.value)}
                className="ltr"
              />
            </div>

            <RichSelect
              label="Primary Category"
              value={categoryId}
              onChange={setCategoryId}
              options={categoryOptions}
              placeholder="Choose a category"
            />

            <RichSelect
              label="Merchant Brand"
              value={merchantId}
              onChange={setMerchantId}
              options={merchantOptions}
            />

            <Input
              label="Purpose / Note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Kiryana, Petrol bill"
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Reference no."
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="e.g. IBFT-882134"
                className="ltr"
              />
              <RichSelect
                label="Payment method"
                value={paymentMethod}
                onChange={setPaymentMethod}
                options={paymentMethodOptions}
              />
            </div>

            {linkedEntry && (
              <p className="text-muted bg-surface-subtle rounded-control px-3 py-2 text-[11.5px] leading-snug">
                This transaction is linked to a quick entry. Saving updates the
                amount, date, category and note on both.
              </p>
            )}

            {/* Split Section Toggle */}
            <div className="pt-3 border-t border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="font-display text-xs font-semibold flex items-center gap-1.5">
                  <Split size={14} className="text-brass" />
                  <span>Category Split Editor</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsSplitting(!isSplitting)}
                  className="text-xs text-brass hover:underline font-medium"
                >
                  {isSplitting ? "Disable Split" : "Split Category"}
                </button>
              </div>

              {isSplitting && (
                <div className="space-y-3 bg-surface-subtle p-3 rounded-panel border border-border">
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>Target Total: Rs {totalAmountPKR.toLocaleString()}</span>
                    <span className={Math.abs(splitRemainingPKR) < 0.01 ? "text-gain font-semibold" : "text-loss font-semibold"}>
                      Remaining: Rs {splitRemainingPKR.toFixed(2)}
                    </span>
                  </div>

                  {splitLines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <Select
                          value={line.category_id}
                          onChange={(e) => handleSplitChange(idx, "category_id", e.target.value)}
                          options={splitCategoryOptions}
                        />
                      </div>
                      <div className="col-span-4">
                        <Input
                          placeholder="PKR"
                          type="number"
                          value={line.amount}
                          onChange={(e) => handleSplitChange(idx, "amount", e.target.value)}
                        />
                      </div>
                      <div className="col-span-3 flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleRemoveSplitLine(idx)}
                          className="p-1 text-loss hover:bg-loss-subtle rounded-full"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleAddSplitLine}
                    className="w-full text-xs flex items-center justify-center gap-1 mt-2"
                  >
                    <Plus size={14} />
                    <span>Add Split Line</span>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-6 border-t border-border flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setConfirmOpen(true)}
            className="text-loss hover:bg-loss-subtle"
          >
            <Trash2 size={16} />
            <span>Delete</span>
          </Button>

          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" variant="primary" onClick={handleSave} isLoading={loading}>
              Save Changes
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDeleteModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete this transaction?"
        recordLabel={`${transaction.merchants?.name || note || transaction.categories?.name || "Transaction"} · ${formatPKR(totalAmountPaisa)}`}
        recordMeta={`${isIncome ? "Credited" : "Debited"} · ${transaction.accounts?.name ?? "Account"} · ${transaction.date}`}
        linkedRefs={
          linkedEntry
            ? [
                {
                  kind: "Quick entry",
                  label: `${linkedEntry.note || "Entry"} · ${formatPKR(linkedEntry.amount_paisa)}`,
                },
              ]
            : []
        }
        balanceImpact={
          transaction.accounts
            ? {
                accountName: transaction.accounts.name,
                fromPaisa: currentBalance,
                // Removing a transaction unwinds its signed amount from the
                // balance, which the trigger does on DELETE.
                toPaisa: currentBalance - transaction.amount_paisa,
              }
            : undefined
        }
        confirmLabel="Delete transaction"
      />
    </div>
  );
}
