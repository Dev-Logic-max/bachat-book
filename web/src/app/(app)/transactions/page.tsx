"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Search, Plus, ArrowLeftRight, ArrowDownRight, ArrowUpRight, Landmark } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { AddTransactionModal } from "@/components/add-transaction-modal";
import { TransferModal } from "@/components/transfer-modal";
import { TransactionDrawer } from "@/components/transaction-drawer";
import { createClient } from "@/lib/supabase/client";
import { formatPKR } from "@/lib/format";
import type { Tables } from "@/lib/supabase/types";

type TransactionFull = Tables<"transactions"> & {
  accounts?: Tables<"accounts"> | null;
  categories?: Tables<"categories"> | null;
  merchants?: Tables<"merchants"> | null;
};

/*
 * useSearchParams must sit under a Suspense boundary, otherwise Next bails out of
 * prerendering the whole route. The wrapper keeps that contained to the part that
 * actually reads the URL.
 */
export default function TransactionsPage() {
  return (
    <React.Suspense fallback={<div className="shimmer h-64 rounded-panel" />}>
      <TransactionsPageInner />
    </React.Suspense>
  );
}

function TransactionsPageInner() {
  const session = useSession();
  const supabase = createClient();
  const searchParams = useSearchParams();

  const householdId = session.household?.id || "";

  const [transactions, setTransactions] = React.useState<TransactionFull[]>([]);
  const [accounts, setAccounts] = React.useState<Tables<"accounts">[]>([]);
  const [categories, setCategories] = React.useState<Tables<"categories">[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshKey, setRefreshKey] = React.useState(0);

  // Filters. `?q=` is seeded from the URL so the dashboard search bar actually
  // lands on a filtered list rather than the unfiltered ledger.
  const [search, setSearch] = React.useState(() => searchParams.get("q") ?? "");
  const [selectedAccountId, setSelectedAccountId] = React.useState("all");
  const [selectedType, setSelectedType] = React.useState<"all" | "income" | "expense" | "transfer">("all");
  const [selectedCategoryId, setSelectedCategoryId] = React.useState("all");

  // Modals & Drawers
  const [addTxOpen, setAddTxOpen] = React.useState(false);
  const [transferOpen, setTransferOpen] = React.useState(false);
  const [activeTx, setActiveTx] = React.useState<TransactionFull | null>(null);

  React.useEffect(() => {
    let active = true;
    if (!householdId) return;

    async function loadData() {
      const [txRes, accRes, catRes] = await Promise.all([
        supabase
          .from("transactions")
          .select("*, accounts(*), categories(*), merchants(*)")
          .eq("household_id", householdId)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase.from("accounts").select("*").eq("household_id", householdId).eq("is_archived", false),
        supabase.from("categories").select("*").order("name", { ascending: true }),
      ]);

      if (active) {
        if (txRes.data) setTransactions(txRes.data as unknown as TransactionFull[]);
        if (accRes.data) setAccounts(accRes.data);
        if (catRes.data) setCategories(catRes.data);
        setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [householdId, refreshKey, supabase]);

  const filteredTransactions = transactions.filter((tx) => {
    if (selectedAccountId !== "all" && tx.account_id !== selectedAccountId) return false;
    if (selectedType !== "all" && tx.type !== selectedType) return false;
    if (selectedCategoryId !== "all" && tx.category_id !== selectedCategoryId) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchNote = tx.note?.toLowerCase().includes(q);
      const matchMerchant = tx.merchants?.name.toLowerCase().includes(q);
      const matchCategory = tx.categories?.name.toLowerCase().includes(q);
      const matchAccount = tx.accounts?.name.toLowerCase().includes(q);
      if (!matchNote && !matchMerchant && !matchCategory && !matchAccount) return false;
    }

    return true;
  });

  const accountOptions = [
    { value: "all", label: "All Accounts" },
    ...accounts.map((a) => ({ value: a.id, label: a.name })),
  ];

  const typeOptions = [
    { value: "all", label: "All Transaction Types" },
    { value: "expense", label: "Expenses Only" },
    { value: "income", label: "Income Only" },
    { value: "transfer", label: "Transfers Only" },
  ];

  const categoryOptions = [
    { value: "all", label: "All Categories" },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  const reloadData = () => setRefreshKey((k) => k + 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Transactions Ledger</h1>
          <p className="text-muted text-xs">
            Double-entry financial ledger with automatic balance synchronization and category splits.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button variant="secondary" onClick={() => setTransferOpen(true)} className="flex items-center gap-1.5">
            <ArrowLeftRight size={15} />
            <span>Transfer</span>
          </Button>

          <Button variant="primary" onClick={() => setAddTxOpen(true)} className="flex items-center gap-1.5">
            <Plus size={16} />
            <span>Add Transaction</span>
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-surface border-border rounded-panel border p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="relative col-span-1 sm:col-span-2 md:col-span-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              placeholder="Search merchant, note, category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-xs"
            />
          </div>

          <Select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            options={accountOptions}
          />

          <Select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as "all" | "income" | "expense" | "transfer")}
            options={typeOptions}
          />

          <Select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            options={categoryOptions}
          />
        </div>
      </div>

      {/* Transactions List */}
      {loading ? (
        <div className="bg-surface border-border rounded-panel border p-8 text-center text-muted text-xs">
          Loading ledger entries...
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="bg-surface border-border rounded-panel border p-12 text-center">
          <Landmark size={40} className="text-muted mx-auto mb-3" />
          <h3 className="font-display text-base font-semibold">No Transactions Found</h3>
          <p className="text-muted text-xs mt-1 max-w-sm mx-auto">
            {search || selectedAccountId !== "all" || selectedType !== "all"
              ? "Try resetting your filter parameters."
              : "Start by logging your first income, expense, or account transfer."}
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <Button variant="primary" onClick={() => setAddTxOpen(true)}>
              + Add Transaction
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-surface border-border rounded-panel border overflow-hidden shadow-sm">
          <div className="divide-y divide-border">
            {filteredTransactions.map((tx) => {
              const isIncome = tx.amount_paisa > 0;
              const isTransfer = tx.type === "transfer";
              const logoPath = tx.merchants?.logo_path;

              return (
                <div
                  key={tx.id}
                  onClick={() => setActiveTx(tx)}
                  className="p-4 hover:bg-surface-subtle cursor-pointer transition-colors flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    {logoPath ? (
                      <img
                        src={logoPath}
                        alt={tx.merchants?.name || "Merchant"}
                        className="w-10 h-10 rounded-full object-contain bg-surface border border-border p-1 shrink-0"
                      />
                    ) : (
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                          isIncome
                            ? "bg-gain-subtle text-gain"
                            : isTransfer
                              ? "bg-navy-900/10 text-navy-900 dark:bg-brass/20 dark:text-brass"
                              : "bg-loss-subtle text-loss"
                        }`}
                      >
                        {isIncome ? (
                          <ArrowDownRight size={20} />
                        ) : isTransfer ? (
                          <ArrowLeftRight size={18} />
                        ) : (
                          <ArrowUpRight size={20} />
                        )}
                      </div>
                    )}

                    <div>
                      <div className="font-semibold text-xs flex items-center gap-2">
                        <span className="text-foreground">
                          {tx.merchants?.name || tx.note || tx.categories?.name || "Transaction"}
                        </span>
                        {tx.categories && (
                          <span className="text-[10px] bg-surface-subtle border border-border text-muted px-2 py-0.5 rounded-full font-medium">
                            {tx.categories.name}
                          </span>
                        )}
                      </div>

                      <div className="text-muted text-[11px] flex items-center gap-2 mt-0.5">
                        <span>{tx.date}</span>
                        <span>•</span>
                        <span className="font-medium text-foreground/80">
                          {tx.accounts?.name || "Account"}
                        </span>
                        {tx.note && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[200px]">{tx.note}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`font-mono text-sm font-bold block ${
                        isIncome ? "text-gain" : isTransfer ? "text-foreground" : "text-loss"
                      }`}
                    >
                      {isIncome ? "+" : ""}
                      {formatPKR(Math.abs(tx.amount_paisa))}
                    </span>
                    <span className="text-muted text-[10px] uppercase font-mono">PKR</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modals & Drawers */}
      <AddTransactionModal
        isOpen={addTxOpen}
        onClose={() => setAddTxOpen(false)}
        householdId={householdId}
        onSuccess={reloadData}
      />

      <TransferModal
        isOpen={transferOpen}
        onClose={() => setTransferOpen(false)}
        householdId={householdId}
        onSuccess={reloadData}
      />

      <TransactionDrawer
        transaction={activeTx}
        onClose={() => setActiveTx(null)}
        onUpdate={reloadData}
      />
    </div>
  );
}
