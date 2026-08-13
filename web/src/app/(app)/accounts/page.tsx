"use client";

import * as React from "react";
import Link from "next/link";
import { Landmark, Wallet, Banknote, Plus, ArrowUpRight, Lock, PowerOff } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { AddAccountModal } from "@/components/add-account-modal";
import { EditAccountModal } from "@/components/edit-account-modal";
import { DeleteAccountModal } from "@/components/delete-account-modal";
import { RowActions } from "@/components/ui/row-actions";
import { useToast } from "@/components/ui/toast";
import { ACCOUNT_TYPE_LABEL } from "@/lib/ledger";
import {
  countAccountMovements,
  deleteAccount,
  setAccountActive,
} from "@/lib/ledger-actions";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { formatPKR, formatPKRCompact } from "@/lib/format";
import type { Tables } from "@/lib/supabase/types";

type AccountWithInstitution = Tables<"accounts"> & {
  institutions?: Tables<"institutions"> | null;
};

export default function AccountsPage() {
  const session = useSession();
  const supabase = createClient();

  const [accounts, setAccounts] = React.useState<AccountWithInstitution[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [addModalOpen, setAddModalOpen] = React.useState(false);
  const [editingAccount, setEditingAccount] = React.useState<AccountWithInstitution | null>(null);
  const [deletingAccount, setDeletingAccount] =
    React.useState<AccountWithInstitution | null>(null);
  const [deletingCount, setDeletingCount] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const { showToast } = useToast();

  const householdId = session.household?.id || "";

  React.useEffect(() => {
    let active = true;
    if (!householdId) return;

    async function loadAccounts() {
      /*
       * Deactivated accounts are still LISTED, greyed and tagged — an account
       * that vanishes on deactivation reads as data loss, and you need a way
       * back to reactivate it. Deleted ones are gone from this page for good;
       * only their past transactions remain, tagged.
       */
      const { data } = await supabase
        .from("accounts")
        .select("*, institutions(*)")
        .eq("household_id", householdId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      if (active && data) {
        setAccounts(data as unknown as AccountWithInstitution[]);
        setLoading(false);
      }
    }
    loadAccounts();
    return () => {
      active = false;
    };
  }, [householdId, refreshKey, supabase]);

  // Deactivated accounts do not count toward what you hold — the money is
  // parked, not spendable — but they still render below so you can bring one back.
  const liveAccounts = accounts.filter((a) => !a.is_archived);
  const totalBalancePaisa = liveAccounts.reduce(
    (acc, a) => acc + Number(a.balance_paisa),
    0,
  );
  const bankAccounts = accounts.filter((a) => a.type === "checking" || a.type === "savings");
  const walletAccounts = accounts.filter((a) => a.type === "wallet");
  // credit/investment can no longer be created but legacy rows must still appear.
  const cashAndOtherAccounts = accounts.filter(
    (a) => a.type === "cash" || a.type === "credit" || a.type === "investment"
  );

  const handleToggleActive = async (account: AccountWithInstitution) => {
    try {
      await setAccountActive(supabase, account.id, account.is_archived);
      showToast({
        type: "success",
        title: account.is_archived ? "Account reactivated" : "Account deactivated",
        description: account.is_archived
          ? `"${account.name}" can be used again.`
          : `"${account.name}" is hidden from every picker. Its records are kept.`,
      });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      showToast({
        type: "error",
        title: "Could not change the account",
        description: err instanceof Error ? err.message : "Unknown error.",
      });
    }
  };

  const openDelete = async (account: AccountWithInstitution) => {
    setDeletingAccount(account);
    setDeletingCount(null);
    setDeletingCount(await countAccountMovements(supabase, account.id));
  };

  const handleDelete = async () => {
    if (!deletingAccount) return;
    setBusy(true);
    try {
      await deleteAccount(supabase, deletingAccount.id);
      showToast({
        type: "success",
        title: "Account deleted",
        description: `Its past records are kept and now show a "Deleted account" tag.`,
      });
      setDeletingAccount(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      showToast({
        type: "error",
        title: "Could not delete the account",
        description: err instanceof Error ? err.message : "Unknown error.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Financial Accounts Wall</h1>
          <p className="text-muted text-xs">
            Manage your bank accounts, mobile wallets, and cash reserves in PKR.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setAddModalOpen(true)}
          className="flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus size={16} />
          <span>Add Account</span>
        </Button>
      </div>

      {/* Net Balance Overview Card */}
      <div className="bg-navy-900 text-on-navy rounded-panel p-6 shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <span className="text-brass text-xs font-semibold uppercase tracking-wider">
              Total Household Liquidity
            </span>
            <div className="font-display text-3xl font-bold mt-1 text-cream">
              {formatPKR(totalBalancePaisa)}
            </div>
            <p className="text-cream-subtle text-xs mt-1">
              Combined balance across {accounts.length} active account{accounts.length === 1 ? "" : "s"}.
            </p>
          </div>

          <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-navy-700 pt-4 md:pt-0 md:pl-6">
            <div>
              <span className="text-muted-foreground text-[11px] block">Bank Balances</span>
              <span className="font-display text-lg font-semibold text-cream">
                {formatPKRCompact(bankAccounts.reduce((acc, a) => acc + Number(a.balance_paisa), 0))}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground text-[11px] block">Mobile Wallets</span>
              <span className="font-display text-lg font-semibold text-cream">
                {formatPKRCompact(walletAccounts.reduce((acc, a) => acc + Number(a.balance_paisa), 0))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Account Groups */}
      {loading ? (
        <div className="bg-surface border-border rounded-panel border p-8 text-center text-muted text-xs">
          Loading accounts...
        </div>
      ) : accounts.length === 0 ? (
        <div className="bg-surface border-border rounded-panel border p-12 text-center">
          <Landmark size={40} className="text-muted mx-auto mb-3" />
          <h3 className="font-display text-base font-semibold">No Accounts Configured</h3>
          <p className="text-muted text-xs mt-1 max-w-sm mx-auto">
            Get started by adding your Meezan, HBL, Easypaisa, SadaPay or Cash wallet.
          </p>
          <Button variant="primary" onClick={() => setAddModalOpen(true)} className="mt-4">
            + Add First Account
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Banks Section */}
          {bankAccounts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Landmark size={18} className="text-brass" />
                <h2 className="font-display text-base font-semibold">Bank Accounts</h2>
                <span className="bg-surface-subtle text-muted rounded-full px-2 py-0.5 text-[10px] font-mono">
                  {bankAccounts.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {bankAccounts.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    onEdit={() => setEditingAccount(account)}
                    onToggleActive={() => handleToggleActive(account)}
                    onDelete={() => openDelete(account)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Mobile Wallets Section */}
          {walletAccounts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Wallet size={18} className="text-brass" />
                <h2 className="font-display text-base font-semibold">Mobile Wallets (EMIs)</h2>
                <span className="bg-surface-subtle text-muted rounded-full px-2 py-0.5 text-[10px] font-mono">
                  {walletAccounts.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {walletAccounts.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    onEdit={() => setEditingAccount(account)}
                    onToggleActive={() => handleToggleActive(account)}
                    onDelete={() => openDelete(account)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Cash & Other Accounts */}
          {cashAndOtherAccounts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Banknote size={18} className="text-brass" />
                <h2 className="font-display text-base font-semibold">Cash & Other Holdings</h2>
                <span className="bg-surface-subtle text-muted rounded-full px-2 py-0.5 text-[10px] font-mono">
                  {cashAndOtherAccounts.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {cashAndOtherAccounts.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    onEdit={() => setEditingAccount(account)}
                    onToggleActive={() => handleToggleActive(account)}
                    onDelete={() => openDelete(account)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Account Modal */}
      <AddAccountModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        householdId={householdId}
        onSuccess={() => setRefreshKey((k) => k + 1)}
      />

      <DeleteAccountModal
        isOpen={deletingAccount !== null}
        onClose={() => setDeletingAccount(null)}
        onConfirm={handleDelete}
        account={deletingAccount}
        movementCount={deletingCount}
        busy={busy}
      />

      <EditAccountModal
        isOpen={editingAccount !== null}
        onClose={() => setEditingAccount(null)}
        account={editingAccount}
        onSuccess={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}

function AccountCard({
  account,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  account: AccountWithInstitution;
  onEdit?: () => void;
  onToggleActive?: () => void;
  onDelete?: () => void;
}) {
  const inst = account.institutions;
  const logoPath = inst?.logo_path;
  const brandColor = inst?.brand_color || "#0B1A33";

  return (
    // `group` drives the hover reveal in RowActions. Card surfaces reveal on hover
    // and :focus-within; detail pages show the actions always.
    <div
      className={cn(
        "group bg-surface border-border rounded-panel border p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between",
        // Deactivated reads as switched off rather than missing.
        account.is_archived && "opacity-60",
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            {logoPath ? (
              <img
                src={logoPath}
                alt={inst?.name || account.name}
                className="w-8 h-8 rounded-full object-contain bg-surface border border-border p-1"
              />
            ) : (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: brandColor }}
              >
                {account.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h3 className="font-display text-sm font-semibold line-clamp-1">{account.name}</h3>
              <p className="text-muted text-[11px]">
                {inst?.short_name || account.type.toUpperCase()}{" "}
                {account.account_number_last4 && `•••${account.account_number_last4}`}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {account.is_archived ? (
              <span className="bg-surface-subtle text-muted border-border inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium">
                <PowerOff size={10} />
                Deactivated
              </span>
            ) : account.is_locked ? (
              <span className="bg-brass-soft text-brass-strong inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium">
                <Lock size={10} />
                Locked
              </span>
            ) : (
              <span className="bg-surface-subtle text-foreground border-border rounded-full border px-2 py-0.5 text-[10px] font-medium">
                {ACCOUNT_TYPE_LABEL[account.type] ?? account.type}
              </span>
            )}
            <RowActions
              onEdit={onEdit}
              onToggleActive={onToggleActive}
              isActive={!account.is_archived}
              onDelete={onDelete}
              editLabel="Edit account"
              deleteLabel="Delete account"
            />
          </div>
        </div>

        <div className="mt-4">
          <span className="text-muted text-[10px] uppercase tracking-wider block">
            {account.is_locked ? "Locked Balance" : "Available Balance"}
          </span>
          <div className="font-display text-xl font-bold mt-0.5">
            {formatPKR(Number(account.balance_paisa))}
          </div>
        </div>
      </div>

      <div className="mt-5 pt-3 border-t border-border flex items-center justify-between">
        <Link
          href={`/accounts/${account.id}`}
          className="text-brass hover:text-brass-strong text-xs font-semibold flex items-center gap-1 transition-colors"
        >
          <span>View Ledger</span>
          <ArrowUpRight size={14} />
        </Link>
        <span className="text-muted text-[11px] font-mono">PKR</span>
      </div>
    </div>
  );
}
