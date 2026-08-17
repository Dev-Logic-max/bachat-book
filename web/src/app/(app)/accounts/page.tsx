"use client";

import * as React from "react";
import Link from "next/link";
import {
  Landmark,
  Wallet,
  Banknote,
  Plus,
  ArrowUpRight,
  EyeOff,
  History,
  Lock,
  Power,
  PowerOff,
  ShieldCheck,
  Wallet2,
} from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { PageActions } from "@/components/page-actions";
import { AddAccountModal } from "@/components/add-account-modal";
import { EditAccountModal } from "@/components/edit-account-modal";
import { ConfirmActionModal } from "@/components/confirm-action-modal";
import { RowActions } from "@/components/ui/row-actions";
import { useToast } from "@/components/ui/toast";
import { MerchantMark } from "@/components/merchant-mark";
import { ACCOUNT_TYPE_LABEL, institutionLogo } from "@/lib/ledger";
import { countAccountMovements, setAccountActive } from "@/lib/ledger-actions";
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
  /*
   * Deactivation is reversible, but "reversible" is not the same as "obvious" —
   * nothing on the card says what switching an account off actually does to the
   * held total or to the pickers. The dialog says it before the click lands.
   */
  const [togglingAccount, setTogglingAccount] =
    React.useState<AccountWithInstitution | null>(null);
  const [togglingCount, setTogglingCount] = React.useState<number | null>(null);
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

  const openToggle = async (account: AccountWithInstitution) => {
    setTogglingAccount(account);
    setTogglingCount(null);
    setTogglingCount(await countAccountMovements(supabase, account.id));
  };

  const handleToggleActive = async () => {
    const account = togglingAccount;
    if (!account) return;
    try {
      await setAccountActive(supabase, account.id, account.is_archived);
      showToast({
        type: "success",
        title: account.is_archived ? "Account reactivated" : "Account deactivated",
        description: account.is_archived
          ? `"${account.name}" can be used again.`
          : `"${account.name}" is hidden from every picker. Its records are kept.`,
      });
      setTogglingAccount(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      showToast({
        type: "error",
        title: "Could not change the account",
        description: err instanceof Error ? err.message : "Unknown error.",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display truncate text-[19px] font-semibold tracking-[-0.02em] sm:text-[22px]">
            Accounts
          </h1>
          <p className="text-muted mt-0.5 text-[12.5px]">
            Every place you hold money — banks, mobile wallets and cash in hand.
          </p>
        </div>

        <PageActions
          title="Accounts"
          actions={[
            {
              label: "Add account",
              shortLabel: "Account",
              hint: "A bank or mobile wallet you hold money with",
              icon: Plus,
              tone: "primary",
              onClick: () => setAddModalOpen(true),
            },
          ]}
        />
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
                    onToggleActive={() => openToggle(account)}
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
                    onToggleActive={() => openToggle(account)}
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
                    onToggleActive={() => openToggle(account)}
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

      <ConfirmActionModal
        isOpen={togglingAccount !== null}
        onClose={() => setTogglingAccount(null)}
        onConfirm={handleToggleActive}
        title={
          togglingAccount?.is_archived ? "Reactivate this account?" : "Deactivate this account?"
        }
        subtitle={
          togglingAccount?.is_archived
            ? "It becomes usable again everywhere"
            : "Reversible — nothing is deleted"
        }
        icon={togglingAccount?.is_archived ? <Power size={16} /> : <PowerOff size={16} />}
        tone={togglingAccount?.is_archived ? "neutral" : "warn"}
        confirmLabel={togglingAccount?.is_archived ? "Reactivate" : "Deactivate"}
        headline={
          togglingAccount && (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-foreground truncate text-[13px] font-semibold">
                  {togglingAccount.name}
                </p>
                <p className="text-muted mt-0.5 text-[11px]">
                  {togglingAccount.institutions?.short_name ??
                    togglingAccount.institutions?.name ??
                    "Cash in hand"}
                  {" · "}
                  {togglingCount === null
                    ? "counting movements…"
                    : `${togglingCount} movement${togglingCount === 1 ? "" : "s"}`}
                </p>
              </div>
              <span className="tnum font-display shrink-0 text-[15px] font-semibold">
                {formatPKR(Number(togglingAccount.balance_paisa))}
              </span>
            </div>
          )
        }
        points={
          togglingAccount?.is_archived
            ? [
                {
                  icon: <Wallet2 size={14} />,
                  label: "Its balance counts toward your household total again.",
                  detail: "The figure at the top of this page goes back up by it.",
                },
                {
                  icon: <ShieldCheck size={14} />,
                  label: "It becomes selectable when logging entries and transfers.",
                  detail: "Any lock it had is unaffected — that is a separate switch.",
                },
              ]
            : [
                {
                  icon: <EyeOff size={14} />,
                  label: "It disappears from every account picker.",
                  detail:
                    "Shown greyed with a “Deactivated” tag rather than hidden, so you can still see why it is unavailable.",
                },
                {
                  icon: <Wallet2 size={14} />,
                  label: "Its balance stops counting toward your household total.",
                  detail:
                    togglingAccount && Number(togglingAccount.balance_paisa) !== 0
                      ? `The figure at the top of this page drops by ${formatPKR(Number(togglingAccount.balance_paisa))}.`
                      : "The account is empty, so the total does not move.",
                },
                {
                  icon: <History size={14} />,
                  label: "Every past entry and transaction stays exactly as it is.",
                  detail:
                    "Nothing is deleted and no total is rewritten. You can switch it back on at any time.",
                },
              ]
        }
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
}: {
  account: AccountWithInstitution;
  onEdit?: () => void;
  onToggleActive?: () => void;
}) {
  const inst = account.institutions;

  return (
    // `group` drives the hover reveal in RowActions. Card surfaces reveal on hover
    // and :focus-within; detail pages show the actions always.
    <div
      className={cn(
        "group lift bg-surface border-border rounded-panel border p-5 shadow-sm flex flex-col justify-between",
        // Deactivated reads as switched off rather than missing.
        account.is_archived && "opacity-60",
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            {/*
              MerchantMark, not a bare <img>: `logo_path` is a bare filename for
              most rows and needs institutionLogo() to resolve, and the eleven
              institutions whose file turned out to be another company's mark are
              null — those must render the visible "awaiting logo" placeholder
              rather than a monogram passing itself off as the brand.
            */}
            <MerchantMark
              name={inst?.short_name ?? account.name}
              brand={inst?.brand_color ?? "#16233a"}
              logo={institutionLogo(inst?.logo_path) ?? undefined}
              awaitingLogo={Boolean(inst && !inst.logo_path)}
              size={32}
            />
            <div>
              <h3 className="font-display text-sm font-semibold line-clamp-1">{account.name}</h3>
              <p className="text-muted text-[11px]">
                {inst?.short_name || account.type.toUpperCase()}{" "}
                {account.account_number_last4 && `•••${account.account_number_last4}`}
              </p>
            </div>
          </div>

          {/*
            Actions sit BEFORE the status chip, so the chip keeps the right edge.
            The other way round the badge slid left every time a card was hovered
            and the whole row of cards jittered as the pointer crossed them.

            Delete is deliberately NOT here. It is permanent and it lives one
            level deeper, on the account's own page, next to the ledger it would
            put a "Deleted account" tag on.
          */}
          <div className="flex shrink-0 items-center gap-1.5">
            <RowActions
              onEdit={onEdit}
              onToggleActive={onToggleActive}
              isActive={!account.is_archived}
              editLabel="Edit account"
            />
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
