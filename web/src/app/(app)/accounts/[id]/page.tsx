"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowDownRight,
  ArrowUpRight,
  Landmark,
  Lock,
  PowerOff,
  Search,
  Trash2,
} from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RowActions, LinkBadge } from "@/components/ui/row-actions";
import { TransactionDrawer } from "@/components/transaction-drawer";
import { EditAccountModal } from "@/components/edit-account-modal";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { deleteMovement, deleteTransfer } from "@/lib/ledger-actions";
import { ACCOUNT_TYPE_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/ledger";
import { formatPKR } from "@/lib/format";
import type { Tables } from "@/lib/supabase/types";

type TransactionWithRelations = Tables<"transactions"> & {
  categories?: Tables<"categories"> | null;
  merchants?: Tables<"merchants"> | null;
  accounts?: Tables<"accounts"> | null;
};

type AccountDetail = Tables<"accounts"> & {
  institutions?: Tables<"institutions"> | null;
};

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const session = useSession();
  const supabase = createClient();

  const accountId = (params?.id as string) || "";
  const householdId = session.household?.id || "";

  const { showToast } = useToast();

  const [account, setAccount] = React.useState<AccountDetail | null>(null);
  const [transactions, setTransactions] = React.useState<TransactionWithRelations[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [refreshKey, setRefreshKey] = React.useState(0);

  const [activeTx, setActiveTx] = React.useState<TransactionWithRelations | null>(null);
  const [editAccountOpen, setEditAccountOpen] = React.useState(false);
  const [deletingTx, setDeletingTx] = React.useState<TransactionWithRelations | null>(
    null,
  );

  const reload = () => setRefreshKey((k) => k + 1);

  React.useEffect(() => {
    let active = true;
    if (!accountId || !householdId) return;

    async function loadData() {
      const [accRes, txRes] = await Promise.all([
        supabase
          .from("accounts")
          .select("*, institutions(*)")
          .eq("id", accountId)
          .eq("household_id", householdId)
          .single(),
        supabase
          .from("transactions")
          .select("*, categories(*), merchants(*)")
          .eq("account_id", accountId)
          .eq("household_id", householdId)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);

      if (active) {
        if (accRes.data) setAccount(accRes.data as unknown as AccountDetail);
        if (txRes.data) setTransactions(txRes.data as unknown as TransactionWithRelations[]);
        setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [accountId, householdId, supabase, refreshKey]);

  // No lookup needed any more — the row carries everything the dialog names.
  const openDelete = (tx: TransactionWithRelations) => setDeletingTx(tx);

  const handleDeleteTx = async () => {
    if (!deletingTx) return;
    try {
      // A transfer is two rows and must go as a pair; anything else is one row.
      if (deletingTx.type === "transfer") {
        await deleteTransfer(
          supabase,
          deletingTx.id,
          deletingTx.linked_transaction_id,
        );
      } else {
        await deleteMovement(supabase, deletingTx.id);
      }
      showToast({
        type: "success",
        title: deletingTx.type === "transfer" ? "Transfer deleted" : "Transaction deleted",
        description:
          deletingTx.type === "transfer"
            ? "Both sides were removed and the balances re-settled."
            : "Account balance recalculated.",
      });
      setDeletingTx(null);
      reload();
    } catch (err) {
      showToast({
        type: "error",
        title: "Delete failed",
        description: err instanceof Error ? err.message : "Unknown error.",
      });
    }
  };

  /*
   * Running balance. A bank ledger without one is not a ledger.
   *
   * `transactions` is newest-first and the account's stored balance is "now", so
   * the newest row's running balance IS that balance and each older row is the one
   * above it minus its own signed amount. Computed over the UNFILTERED list —
   * a running balance derived from a search result would be arithmetic nonsense.
   */
  const runningBalances = React.useMemo(() => {
    const map = new Map<string, number>();
    let balance = Number(account?.balance_paisa ?? 0);
    for (const t of transactions) {
      map.set(t.id, balance);
      balance -= Number(t.amount_paisa);
    }
    return map;
  }, [transactions, account?.balance_paisa]);

  const filteredTransactions = transactions.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (t.note && t.note.toLowerCase().includes(q)) ||
      (t.categories?.name && t.categories.name.toLowerCase().includes(q)) ||
      (t.merchants?.name && t.merchants.name.toLowerCase().includes(q)) ||
      (t.reference_no && t.reference_no.toLowerCase().includes(q))
    );
  });

  if (loading) {
    return (
      <div className="bg-surface border-border rounded-panel border p-8 text-center text-muted text-xs">
        Loading account ledger...
      </div>
    );
  }

  if (!account) {
    return (
      <div className="bg-surface border-border rounded-panel border p-8 text-center space-y-4">
        <h3 className="font-display text-base font-semibold">Account Not Found</h3>
        <p className="text-muted text-xs">This account does not exist or you do not have permission to view it.</p>
        <Button variant="secondary" onClick={() => router.push("/accounts")}>
          Back to Accounts
        </Button>
      </div>
    );
  }

  const inst = account.institutions;
  const logoPath = inst?.logo_path;
  const brandColor = inst?.brand_color || "#0B1A33";

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <div>
        <Link
          href="/accounts"
          className="text-muted hover:text-foreground text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to Accounts</span>
        </Link>
      </div>

      {/* Account Hero Card */}
      <div className="bg-surface border-border rounded-panel border p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="flex items-center gap-4">
          {logoPath ? (
            <img
              src={logoPath}
              alt={inst?.name || account.name}
              className="w-12 h-12 rounded-full object-contain bg-surface border border-border p-1.5 shadow-sm"
            />
          ) : (
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm"
              style={{ backgroundColor: brandColor }}
            >
              {account.name.slice(0, 2).toUpperCase()}
            </div>
          )}

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl font-bold">{account.name}</h1>
              <span className="bg-surface-subtle text-foreground border-border rounded-full border px-2 py-0.5 text-[10px] font-medium">
                {ACCOUNT_TYPE_LABEL[account.type] ?? account.type}
              </span>
              {/*
                State is stated, never inferred from an empty screen. A deleted
                account still has its whole ledger below; without a tag the page
                looks like an ordinary account you can go on using.
              */}
              {account.deleted_at ? (
                <span className="bg-loss-soft text-loss inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium">
                  <Trash2 size={10} />
                  Deleted
                </span>
              ) : account.is_archived ? (
                <span className="bg-surface-subtle text-muted border-border inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium">
                  <PowerOff size={10} />
                  Deactivated
                </span>
              ) : account.is_locked ? (
                <span className="bg-brass-soft text-brass-strong inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium">
                  <Lock size={10} />
                  Locked — savings only
                </span>
              ) : null}
            </div>
            <p className="text-muted text-xs mt-0.5">
              {inst?.name || "Cash / Direct Holding"}{" "}
              {account.account_number_last4 && (
                <span className="ltr">•••{account.account_number_last4}</span>
              )}
            </p>
          </div>
        </div>

        <div className="border-border flex items-center gap-5 border-t pt-4 md:border-t-0 md:pt-0">
          <div className="md:text-right">
            <span className="text-muted block text-[11px] uppercase tracking-wider">
              Current Ledger Balance
            </span>
            <div className="font-display tnum mt-0.5 text-2xl font-bold text-foreground">
              {formatPKR(Number(account.balance_paisa))}
            </div>
          </div>
          {/* Detail pages show actions always, never on hover. */}
          <RowActions
            reveal="always"
            onEdit={() => setEditAccountOpen(true)}
            editLabel="Edit account"
          />
        </div>
      </div>

      {/* Search & Ledger Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="font-display text-base font-semibold">Account Ledger</h2>
          <div className="relative max-w-xs w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              placeholder="Search ledger entries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-xs py-1.5"
            />
          </div>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="bg-surface border-border rounded-panel border p-8 text-center text-muted text-xs">
            {search ? "No ledger entries match your search." : "No transactions recorded for this account yet."}
          </div>
        ) : (
          <div className="bg-surface border-border rounded-panel border overflow-hidden shadow-sm">
            <div className="divide-y divide-border">
              {filteredTransactions.map((tx) => {
                const isIncome = tx.amount_paisa > 0;
                const isTransfer = tx.type === "transfer";

                // Badge carries the KIND of movement, never the category — a
                // category badge on an opening balance read as "Monthly Salary".
                const kindLabel = isTransfer
                  ? isIncome
                    ? "Transfer in"
                    : "Transfer out"
                  : isIncome
                    ? "Credited"
                    : "Debited";

                return (
                  <div
                    key={tx.id}
                    className="p-4 hover:bg-surface-subtle transition-colors flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                          isIncome
                            ? "bg-gain-subtle text-gain"
                            : isTransfer
                              ? "bg-navy-900/10 text-navy-900 dark:bg-brass/20 dark:text-brass"
                              : "bg-loss-subtle text-loss"
                        }`}
                      >
                        {isTransfer ? (
                          <Landmark size={18} />
                        ) : isIncome ? (
                          <ArrowUpRight size={18} />
                        ) : (
                          <ArrowDownRight size={18} />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                          <span className="truncate">
                            {tx.merchants?.name || tx.note || tx.categories?.name || "Transaction"}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              isTransfer
                                ? "bg-surface-subtle text-muted"
                                : isIncome
                                  ? "bg-gain-soft text-gain"
                                  : "bg-loss-soft text-loss"
                            }`}
                          >
                            {kindLabel}
                          </span>
                          {tx.type === "transfer" ? (
                            <LinkBadge label="Transfer" />
                          ) : tx.is_opening ? (
                            <LinkBadge label="Opening" />
                          ) : (
                            <LinkBadge label="Entry" href="/entries" />
                          )}
                        </div>
                        <span className="text-muted mt-0.5 block text-[11px]">
                          <span className="ltr">{tx.date}</span>
                          {tx.categories && ` · ${tx.categories.name}`}
                          {tx.note && tx.merchants && ` · ${tx.note}`}
                          {tx.payment_method &&
                            ` · ${PAYMENT_METHOD_LABEL[tx.payment_method] ?? tx.payment_method}`}
                          {tx.reference_no && (
                            <>
                              {" · "}
                              <span className="ltr font-mono text-[10.5px]">
                                {tx.reference_no}
                              </span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <div className="text-right">
                        <span
                          className={`tnum font-mono text-sm font-bold ${
                            isIncome ? "text-gain" : isTransfer ? "text-foreground" : "text-loss"
                          }`}
                        >
                          {isIncome ? "+" : "−"}
                          {formatPKR(Math.abs(tx.amount_paisa))}
                        </span>
                        {/* Running balance after this row — what makes this a ledger. */}
                        <span className="text-muted tnum mt-0.5 block font-mono text-[10.5px]">
                          {formatPKR(runningBalances.get(tx.id) ?? 0)}
                        </span>
                      </div>
                      <RowActions
                        reveal="always"
                        onEdit={() => setActiveTx(tx)}
                        onDelete={() => openDelete(tx)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <TransactionDrawer
        transaction={
          activeTx ? { ...activeTx, accounts: account as Tables<"accounts"> } : null
        }
        onClose={() => setActiveTx(null)}
        onUpdate={reload}
      />

      <EditAccountModal
        isOpen={editAccountOpen}
        onClose={() => setEditAccountOpen(false)}
        account={account}
        onSuccess={reload}
      />

      <ConfirmDeleteModal
        isOpen={deletingTx !== null}
        onClose={() => setDeletingTx(null)}
        onConfirm={handleDeleteTx}
        title="Delete this ledger entry?"
        recordLabel={
          deletingTx
            ? `${deletingTx.merchants?.name || deletingTx.note || deletingTx.categories?.name || "Transaction"} · ${formatPKR(Math.abs(deletingTx.amount_paisa))}`
            : ""
        }
        recordMeta={
          deletingTx
            ? `${deletingTx.amount_paisa > 0 ? "Credited" : "Debited"} · ${deletingTx.date}`
            : undefined
        }
        linkedRefs={
          deletingTx?.type === "transfer"
            ? [
                {
                  kind: "Other side of the transfer",
                  label: "Deleted together — one leg alone would create money",
                },
              ]
            : []
        }
        balanceImpact={
          deletingTx && account
            ? {
                accountName: account.name,
                fromPaisa: Number(account.balance_paisa),
                toPaisa: Number(account.balance_paisa) - Number(deletingTx.amount_paisa),
              }
            : undefined
        }
        confirmLabel="Delete entry"
      />
    </div>
  );
}
