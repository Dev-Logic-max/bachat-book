"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  Search,
  Plus,
  ArrowLeftRight,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Eye,
  Landmark,
  Tags,
} from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { RichSelect } from "@/components/ui/select";
import { CategoryChip, CategoryIcon, toneColor } from "@/components/category-icon";
import { MerchantMark } from "@/components/merchant-mark";
import { accountSelectOptions } from "@/components/account-options";
import type { AccountWithInstitution } from "@/components/account-options";
import type { SelectOption } from "@/components/ui/select";
import { AddTransactionModal } from "@/components/add-transaction-modal";
import { TransferModal } from "@/components/transfer-modal";
import { TransactionDrawer } from "@/components/transaction-drawer";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { PageActions } from "@/components/page-actions";
import { FilterBar } from "@/components/filter-bar";
import { RowActions } from "@/components/ui/row-actions";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { deleteMovement, deleteTransfer } from "@/lib/ledger-actions";
import {
  PAYMENT_METHOD_LABEL,
  institutionLogo,
  isBankingMovement,
  todayISO,
} from "@/lib/ledger";
import { formatPKR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Tables } from "@/lib/supabase/types";

/*
 * Shared column template — header and rows must never drift apart.
 *
 * COLUMNS ONLY, no `grid`: the header is `hidden lg:grid` and Tailwind emits
 * display utilities in its own order, so a template carrying `grid` would beat
 * or lose to `hidden` on stylesheet order rather than on intent.
 */
const TX_COLS =
  "items-center gap-x-3 grid-cols-[34px_minmax(0,1fr)_auto_auto] " +
  "lg:grid-cols-[34px_minmax(0,1fr)_148px_96px_160px_118px_72px]";

/*
 * Tinted, not just smaller. A heading row sharing the card's own white is only
 * grey text; one step of surface separation is what makes the block read as a
 * table. No border-b — the list's `divide-y` already rules under this row.
 */
const TX_HEAD =
  "bg-surface-subtle text-muted hidden px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] lg:grid";

type AccountEmbed = Tables<"accounts"> & {
  institutions?: Tables<"institutions"> | null;
};

type TransactionFull = Tables<"transactions"> & {
  accounts?: AccountEmbed | null;
  /** The OTHER side of a transfer, embedded through transfer_account_id. */
  transfer_account?: Tables<"accounts"> | null;
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
  const { showToast } = useToast();

  const householdId = session.household?.id || "";
  const userId = session.user.id;

  const [transactions, setTransactions] = React.useState<TransactionFull[]>([]);
  const [accounts, setAccounts] = React.useState<AccountWithInstitution[]>([]);
  const [categories, setCategories] = React.useState<Tables<"categories">[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  // Filters. `?q=` is seeded from the URL so the dashboard search bar actually
  // lands on a filtered list rather than the unfiltered ledger.
  const [search, setSearch] = React.useState(() => searchParams.get("q") ?? "");
  /*
   * THIS MONTH by default — the same unit Entries opens on.
   *
   * The ledger had no month filter at all, so it grew forever and the two
   * screens described different spans of time while claiming to describe the
   * same money.
   */
  const [month, setMonth] = React.useState(() => todayISO().slice(0, 7));
  const [selectedAccountId, setSelectedAccountId] = React.useState("all");
  const [selectedType, setSelectedType] = React.useState<"all" | "income" | "expense" | "transfer">("all");
  const [selectedCategoryId, setSelectedCategoryId] = React.useState("all");

  // Modals & Drawers
  const [addTxOpen, setAddTxOpen] = React.useState(false);
  const [transferOpen, setTransferOpen] = React.useState(false);
  const [activeTx, setActiveTx] = React.useState<TransactionFull | null>(null);
  const [deletingTx, setDeletingTx] = React.useState<TransactionFull | null>(null);

  React.useEffect(() => {
    let active = true;
    if (!householdId) return;

    async function loadData() {
      const [txRes, accRes, catRes] = await Promise.all([
        /*
         * THE EMBED MUST NAME ITS FOREIGN KEY.
         *
         * `transactions` reaches `accounts` through TWO keys — `account_id` and
         * `transfer_account_id` — so a bare `accounts(*)` is ambiguous and
         * PostgREST refuses the whole request with 300 / PGRST201. This screen
         * rendered its "No Transactions Found" empty state for every household
         * because of it: the error was real, `data` came back null, and nothing
         * ever looked at `error`.
         *
         * Naming the constraint fixes it, and embedding the second key as
         * `transfer_account` gives a transfer both of its ends.
         */
        supabase
          .from("transactions")
          .select(
            "*, accounts!transactions_account_id_fkey(*, institutions(*)), " +
              "transfer_account:accounts!transactions_transfer_account_id_fkey(*), " +
              "categories(*), merchants(*)",
          )
          .eq("household_id", householdId)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false }),
        // Deactivated accounts stay in the FILTER list — their history is still
        // worth reading — so only tombstoned ones are excluded.
        supabase
          .from("accounts")
          .select("*, institutions(*)")
          .eq("household_id", householdId)
          .is("deleted_at", null),
        supabase
          .from("categories")
          .select("*")
          .order("sort_order")
          .order("name"),
      ]);

      if (!active) return;

      // Say so when the ledger could not be read. An empty state in place of an
      // error is the exact failure this screen just spent a release in.
      if (txRes.error) setLoadError(txRes.error.message);
      else setLoadError(null);

      if (txRes.data) setTransactions(txRes.data as unknown as TransactionFull[]);
      if (accRes.data) setAccounts(accRes.data as unknown as AccountWithInstitution[]);
      if (catRes.data) setCategories(catRes.data);
      setLoading(false);
    }

    loadData();
    return () => {
      active = false;
    };
  }, [householdId, refreshKey, supabase]);

  /*
   * Everything except the category filter.
   *
   * Split out so the category dropdown can be built from what is actually on
   * screen — a category list that offers options producing zero rows is worse
   * than no list at all.
   */
  const bankingTransactions = React.useMemo(
    () =>
      transactions.filter((tx) => {
        /*
         * THIS SCREEN IS A VIEW, NOT A SEPARATE LEDGER.
         *
         * It shows money that touched a bank or wallet, plus transfers between
         * accounts. Cash spending is deliberately absent — it is already on
         * Entries, and repeating it here made the same rupees look like two
         * events.
         *
         * Transfers always show regardless of account: both legs must appear or
         * a pair reads as money vanishing from one side.
         */
        if (!isBankingMovement(tx, tx.accounts?.type)) return false;

        if (month !== "all" && !tx.date.startsWith(month)) return false;
        if (selectedAccountId !== "all" && tx.account_id !== selectedAccountId) {
          return false;
        }
        if (selectedType !== "all" && tx.type !== selectedType) return false;

        if (search.trim()) {
          const q = search.toLowerCase();
          const matchNote = tx.note?.toLowerCase().includes(q);
          const matchMerchant = tx.merchants?.name.toLowerCase().includes(q);
          const matchCategory = tx.categories?.name.toLowerCase().includes(q);
          const matchAccount = tx.accounts?.name.toLowerCase().includes(q);
          if (!matchNote && !matchMerchant && !matchCategory && !matchAccount) {
            return false;
          }
        }

        return true;
      }),
    [transactions, month, selectedAccountId, selectedType, search],
  );

  const monthOptions: SelectOption[] = React.useMemo(() => {
    const label = (key: string) =>
      new Date(`${key}-01T00:00:00`).toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
      });

    const seen = new Map<string, string>();
    // Always offer the current month, even before anything lands in it.
    const current = todayISO().slice(0, 7);
    seen.set(current, label(current));
    for (const t of transactions) {
      const key = t.date.slice(0, 7);
      if (!seen.has(key)) seen.set(key, label(key));
    }

    return [
      { value: "all", label: "All months" },
      ...[...seen.entries()]
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .map(([value, text]) => ({
          value,
          label: text,
          description: value === current ? "This month" : undefined,
        })),
    ];
  }, [transactions]);

  const filteredTransactions = React.useMemo(
    () =>
      selectedCategoryId === "all"
        ? bankingTransactions
        : bankingTransactions.filter((tx) => tx.category_id === selectedCategoryId),
    [bankingTransactions, selectedCategoryId],
  );

  /*
   * Filters, not entry forms: nothing is disabled here. A deactivated account
   * still has history worth looking at, so its rows must stay reachable — hence
   * `disableBlocked: false` and no direction to score a lock against.
   */
  const accountOptions: SelectOption[] = [
    {
      value: "all",
      label: "All accounts",
      description: `${accounts.length} in this workspace`,
      icon: <Landmark size={16} strokeWidth={1.7} />,
    },
    ...accountSelectOptions(accounts, { disableBlocked: false }),
  ];

  const typeOptions: SelectOption[] = [
    {
      value: "all",
      label: "Income, expense and transfers",
      icon: (
        <span className="flex items-center -space-x-1">
          <ArrowUpRight size={13} className="text-gain" />
          <ArrowDownRight size={13} className="text-loss" />
        </span>
      ),
    },
    {
      value: "expense",
      label: "Expenses only",
      icon: <ArrowDownRight size={15} className="text-loss" />,
    },
    {
      value: "income",
      label: "Income only",
      icon: <ArrowUpRight size={15} className="text-gain" />,
    },
    {
      value: "transfer",
      label: "Transfers only",
      icon: <ArrowLeftRight size={15} className="text-brass-strong" />,
    },
  ];

  /*
   * Only the categories that appear in what this screen SHOWS.
   *
   * The full catalogue is 37 rows, most of which can never match here — picking
   * one and getting an empty list back is the dropdown telling you nothing was
   * found when in truth nothing could ever be found. Built off the account/type
   * filters too, so it narrows as you narrow.
   */
  const categoryOptions: SelectOption[] = React.useMemo(() => {
    const present = new Map<string, Tables<"categories">>();
    for (const tx of bankingTransactions) {
      if (tx.categories && !present.has(tx.categories.id)) {
        present.set(tx.categories.id, tx.categories);
      }
    }
    // Keep whatever is selected reachable, even if the other filters have just
    // emptied it out — otherwise the control shows a blank trigger.
    if (selectedCategoryId !== "all" && !present.has(selectedCategoryId)) {
      const chosen = categories.find((c) => c.id === selectedCategoryId);
      if (chosen) present.set(chosen.id, chosen);
    }

    return [
      {
        value: "all",
        label: "All categories",
        description: `${present.size} used here`,
        icon: <Tags size={15} />,
      },
      ...[...present.values()]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => ({
          value: c.id,
          label: c.name,
          icon: <CategoryChip icon={c.icon} tone={c.tone} size={18} iconSize={11} />,
        })),
    ];
  }, [bankingTransactions, categories, selectedCategoryId]);

  const reloadData = () => setRefreshKey((k) => k + 1);

  // Search is not counted — it is visible at every width, so it can never be a
  // filter you forgot you set, which is the only thing this badge is for.
  const activeFilterCount = [
    month,
    selectedAccountId,
    selectedType,
    selectedCategoryId,
  ].filter((v) => v !== "all").length;

  // "Clear" widens to everything, including the month — the month is a filter
  // like any other, just one that starts switched on.
  const clearFilters = () => {
    setMonth("all");
    setSelectedAccountId("all");
    setSelectedType("all");
    setSelectedCategoryId("all");
  };

  const handleDeleteTx = async () => {
    if (!deletingTx) return;
    try {
      // A transfer is two rows and must go as a pair — deleting one leg leaves
      // the other account credited by money nobody gave up.
      if (deletingTx.type === "transfer") {
        await deleteTransfer(supabase, deletingTx.id, deletingTx.linked_transaction_id);
      } else {
        await deleteMovement(supabase, deletingTx.id);
      }
      showToast({
        type: "success",
        title: deletingTx.type === "transfer" ? "Transfer deleted" : "Transaction deleted",
        description:
          deletingTx.type === "transfer"
            ? "Both sides were removed and the balances re-settled."
            : `${deletingTx.accounts?.name ?? "The account"} has been re-settled.`,
      });
      setDeletingTx(null);
      reloadData();
    } catch (err) {
      showToast({
        type: "error",
        title: "Could not delete",
        description: err instanceof Error ? err.message : "Unknown error.",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display truncate text-[19px] font-semibold tracking-[-0.02em] sm:text-[22px]">
            Transactions
          </h1>
          <p className="text-muted mt-0.5 text-[12.5px]">
            Money that touched a bank or wallet, plus transfers between your
            accounts. Cash-only spending lives on Entries.
          </p>
        </div>

        <PageActions
          title="Transactions"
          actions={[
            {
              label: "Transfer",
              hint: "Move money between two of your own accounts",
              icon: ArrowLeftRight,
              glyphClass: "text-brass-strong",
              onClick: () => setTransferOpen(true),
            },
            {
              label: "Add transaction",
              shortLabel: "Add",
              hint: "Log money in or out of a bank or wallet",
              icon: Plus,
              tone: "primary",
              onClick: () => setAddTxOpen(true),
            },
          ]}
        />
      </div>

      {/*
        Search stays OUT of the sheet and on screen at every width. It is the
        one control you reach for knowing what you want, and burying it behind
        a Filters button would cost a tap on the most-used action here.
      */}
      <div className="space-y-3">
        <div className="relative">
          <Search
            size={14}
            className="text-muted pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
          />
          <Input
            placeholder="Search merchant, note, category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 text-xs"
          />
        </div>

        <FilterBar activeCount={activeFilterCount} onClear={clearFilters}>
          <RichSelect value={month} onChange={setMonth} options={monthOptions} />

          <RichSelect
            value={selectedAccountId}
            onChange={setSelectedAccountId}
            options={accountOptions}
          />

          <RichSelect
            value={selectedType}
            onChange={(v) =>
              setSelectedType(v as "all" | "income" | "expense" | "transfer")
            }
            options={typeOptions}
          />

          <RichSelect
            value={selectedCategoryId}
            onChange={setSelectedCategoryId}
            options={categoryOptions}
          />
        </FilterBar>
      </div>

      {/* Transactions List */}
      {loadError ? (
        <div className="border-loss/30 bg-loss-soft rounded-panel border p-6 text-center">
          <h3 className="text-loss font-display text-base font-semibold">
            The ledger could not be loaded
          </h3>
          <p className="text-foreground-2 mx-auto mt-1 max-w-md text-xs">
            This is a real failure, not an empty account — nothing has been lost.
          </p>
          <p className="text-faint mt-2 font-mono text-[11px]">{loadError}</p>
          <Button variant="secondary" onClick={reloadData} className="mt-4">
            Try again
          </Button>
        </div>
      ) : loading ? (
        <div className="bg-surface border-border rounded-panel border p-8 text-center text-muted text-xs">
          Loading ledger entries...
        </div>
      ) : filteredTransactions.length === 0 ? (
        <EmptyState
          title={
            search || selectedAccountId !== "all" || selectedType !== "all"
              ? "Nothing matches those filters"
              : "No transactions yet"
          }
          imageSrc="/art/empty-transactions.webp"
          description={
            search || selectedAccountId !== "all" || selectedType !== "all"
              ? "Your ledger is not empty — these filters just do not match anything in it. Clear one and try again."
              : "This is every movement that touched a bank or wallet, plus transfers between your own accounts. Cash-only spending lives in Entries."
          }
          action={
            <Button variant="primary" onClick={() => setAddTxOpen(true)}>
              Add a transaction
            </Button>
          }
        />
      ) : (
        <div className="lift bg-surface border-border rounded-panel border overflow-hidden shadow-sm">
          {/*
            One grid template for the header and every row, so the columns hold
            their line down the whole list. Only the description track flexes;
            everything else is fixed, and a long merchant name truncates rather
            than shunting the amount out of alignment.
          */}
          <ul className="divide-border divide-y">
            <li className={cn(TX_COLS, TX_HEAD)}>
              <span />
              <span>Description</span>
              <span>Category</span>
              <span>Date</span>
              <span>Account</span>
              <span className="text-right">Amount</span>
              <span className="text-right">Actions</span>
            </li>

            {filteredTransactions.map((tx) => {
              const amount = Number(tx.amount_paisa);
              // Read the SIGN, never `type`. A constraint ties them together and
              // the sign is what the balance trigger actually used.
              const isIncome = amount >= 0;
              const isTransfer = tx.type === "transfer";
              const inst = tx.accounts?.institutions ?? null;
              const title =
                tx.merchants?.name || tx.note || tx.categories?.name || "Transaction";

              return (
                /*
                 * A ROW, not a button.
                 *
                 * The whole row used to open the drawer, so scanning the ledger
                 * with the pointer kept throwing a panel over the list. Details,
                 * edit and delete are now explicit targets in the Actions column
                 * — same as Entries, so one gesture means one thing everywhere.
                 */
                <li key={tx.id}>
                  <div
                    className={cn(
                      TX_COLS,
                      "hover:bg-surface-subtle/70 grid w-full px-4 py-2.5 text-left transition-colors",
                    )}
                  >
                    {tx.merchants?.logo_path ? (
                      <MerchantMark
                        name={tx.merchants.name}
                        brand={tx.merchants.brand_color ?? "#16233a"}
                        logo={institutionLogo(tx.merchants.logo_path) ?? undefined}
                        size={34}
                      />
                    ) : (
                      <span
                        className={cn(
                          "flex size-8.5 shrink-0 items-center justify-center rounded-full",
                          isTransfer
                            ? "bg-brass-soft text-brass-strong"
                            : isIncome
                              ? "bg-gain-soft text-gain"
                              : "bg-loss-soft text-loss",
                        )}
                      >
                        {isTransfer ? (
                          <ArrowLeftRight size={15} />
                        ) : isIncome ? (
                          <ArrowUpRight size={15} />
                        ) : (
                          <ArrowDownRight size={15} />
                        )}
                      </span>
                    )}

                    <span className="min-w-0">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="text-foreground min-w-0 truncate text-[12.5px] font-medium">
                          {/* The seeded note already reads "Transfer out: …",
                              which said the direction twice once the tag beside
                              it says it properly. */}
                          {isTransfer ? stripTransferPrefix(title) : title}
                        </span>
                        {isTransfer && (
                          <span className="bg-brass-soft text-brass-strong inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                            {isIncome ? (
                              <ArrowDownLeft size={9} />
                            ) : (
                              <ArrowUpRight size={9} />
                            )}
                            {isIncome ? "Transfer in" : "Transfer out"}
                          </span>
                        )}
                      </span>

                      {/* Wide screens: the columns to the right already carry
                          category, date and account, so this line is free for
                          the payment method or note. */}
                      <span className="text-faint mt-0.5 hidden truncate text-[11px] lg:block">
                        {isTransfer ? (
                          <span className="text-foreground-2">
                            {isIncome
                              ? `From ${tx.transfer_account?.name ?? "another account"}`
                              : `To ${tx.transfer_account?.name ?? "another account"}`}
                          </span>
                        ) : tx.note && tx.merchants ? (
                          tx.note
                        ) : (
                          PAYMENT_LABEL(tx)
                        )}
                      </span>

                      {/* Narrow screens get the same three facts as the table,
                          wrapped rather than columned. */}
                      <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 lg:hidden">
                        {tx.categories ? (
                          <span
                            className="inline-flex min-w-0 max-w-38 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-medium"
                            style={{
                              background: `color-mix(in oklab, ${toneColor(tx.categories.tone)} 12%, transparent)`,
                              color: toneColor(tx.categories.tone),
                            }}
                          >
                            <CategoryIcon icon={tx.categories.icon} size={10} />
                            <span className="truncate">{tx.categories.name}</span>
                          </span>
                        ) : isTransfer && tx.transfer_account ? (
                          <span className="text-foreground-2 inline-flex min-w-0 max-w-38 items-center gap-1 text-[10.5px]">
                            <ArrowLeftRight size={10} className="text-faint shrink-0" />
                            <span className="truncate">
                              {isIncome ? "from" : "to"} {tx.transfer_account.name}
                            </span>
                          </span>
                        ) : null}

                        <span className="bg-surface-subtle inline-flex min-w-0 max-w-38 items-center gap-1 rounded-full py-0.5 pe-1.5 ps-0.5">
                          <MerchantMark
                            name={inst?.short_name ?? tx.accounts?.name ?? "Account"}
                            brand={inst?.brand_color ?? "#16233a"}
                            logo={institutionLogo(inst?.logo_path) ?? undefined}
                            awaitingLogo={Boolean(inst && !inst.logo_path)}
                            size={14}
                          />
                          <span
                            className={cn(
                              "text-foreground-2 min-w-0 truncate text-[10.5px]",
                              tx.accounts?.deleted_at && "text-faint line-through",
                            )}
                          >
                            {tx.accounts?.name ?? "Account"}
                          </span>
                        </span>

                        <span className="text-foreground-2 inline-flex shrink-0 items-center gap-1 text-[10.5px] font-medium">
                          <CalendarDays size={10} className="text-faint" />
                          <span className="ltr">{shortDate(tx.date)}</span>
                        </span>
                      </span>
                    </span>

                    <span className="hidden min-w-0 lg:block">
                      {tx.categories ? (
                        <span
                          className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium"
                          style={{
                            background: `color-mix(in oklab, ${toneColor(tx.categories.tone)} 12%, transparent)`,
                            color: toneColor(tx.categories.tone),
                          }}
                        >
                          <CategoryIcon icon={tx.categories.icon} size={11} />
                          <span className="truncate">{tx.categories.name}</span>
                        </span>
                      ) : (
                        <span className="text-faint text-[11px] italic">
                          {isTransfer ? "Transfer" : "Uncategorised"}
                        </span>
                      )}
                    </span>

                    <span className="text-foreground-2 ltr hidden text-[11.5px] font-medium lg:block">
                      {shortDate(tx.date)}
                    </span>

                    <span className="hidden min-w-0 items-center gap-1.5 lg:flex">
                      <MerchantMark
                        name={inst?.short_name ?? tx.accounts?.name ?? "Account"}
                        brand={inst?.brand_color ?? "#16233a"}
                        logo={institutionLogo(inst?.logo_path) ?? undefined}
                        awaitingLogo={Boolean(inst && !inst.logo_path)}
                        size={18}
                      />
                      <span className="min-w-0">
                        <span
                          className={cn(
                            "text-foreground-2 block truncate text-[11.5px]",
                            tx.accounts?.deleted_at && "text-faint line-through",
                          )}
                        >
                          {tx.accounts?.name ?? "Account"}
                        </span>
                        {/*
                          The account was deleted, but this row survived on
                          purpose so past months still add up. Say so, rather than
                          showing a name that no longer resolves anywhere.
                        */}
                        {tx.accounts?.deleted_at && (
                          <span className="text-faint block text-[9.5px] italic">
                            deleted account
                          </span>
                        )}
                      </span>
                    </span>

                    <span
                      className={cn(
                        "tnum text-right font-mono text-[12.5px] font-semibold",
                        isTransfer
                          ? "text-foreground-2"
                          : isIncome
                            ? "text-gain"
                            : "text-loss",
                      )}
                    >
                      {isIncome ? "+" : "−"}
                      {formatPKR(Math.abs(amount))}
                    </span>

                    <span className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setActiveTx(tx)}
                        title="View details"
                        aria-label={`View details for ${title}`}
                        className="text-foreground-2 hover:text-brass-strong hover:bg-brass-soft focus-visible:ring-brass/40 flex size-7 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2"
                      >
                        <Eye size={15} strokeWidth={1.75} />
                      </button>
                      <RowActions
                        reveal="always"
                        colored
                        onDelete={() => setDeletingTx(tx)}
                        deleteLabel={
                          isTransfer ? "Delete both transfer legs" : "Delete transaction"
                        }
                      />
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Modals & Drawers */}
      <AddTransactionModal
        isOpen={addTxOpen}
        onClose={() => setAddTxOpen(false)}
        householdId={householdId}
        userId={userId}
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

      <ConfirmDeleteModal
        isOpen={deletingTx !== null}
        onClose={() => setDeletingTx(null)}
        onConfirm={handleDeleteTx}
        title={
          deletingTx?.type === "transfer"
            ? "Delete this transfer?"
            : "Delete this transaction?"
        }
        recordLabel={
          deletingTx
            ? `${deletingTx.merchants?.name || deletingTx.note || deletingTx.categories?.name || "Transaction"} · ${formatPKR(Math.abs(Number(deletingTx.amount_paisa)))}`
            : ""
        }
        recordMeta={
          deletingTx
            ? `${Number(deletingTx.amount_paisa) >= 0 ? "Credited" : "Debited"} · ${deletingTx.date} · ${deletingTx.accounts?.name ?? "Account"}`
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
          deletingTx?.accounts
            ? {
                accountName: deletingTx.accounts.name,
                fromPaisa: Number(deletingTx.accounts.balance_paisa),
                toPaisa:
                  Number(deletingTx.accounts.balance_paisa) -
                  Number(deletingTx.amount_paisa),
              }
            : undefined
        }
        confirmLabel="Delete"
      />
    </div>
  );
}

/**
 * "Transfer out: Rent money" -> "Rent money".
 *
 * Transfer legs are seeded with the direction baked into the note. Now that a
 * tag beside the title carries it, keeping the prefix said the same thing twice
 * and pushed the actual description off the end of a phone row.
 */
function stripTransferPrefix(title: string): string {
  const cleaned = title.replace(/^\s*transfer\s+(in|out)\s*[:\-–]\s*/i, "").trim();
  return cleaned || title;
}

/** "12 Aug" — the year is noise in a list you are already scanning by month. */
function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

/** The secondary line when there is no note worth showing. */
function PAYMENT_LABEL(tx: TransactionFull): string {
  if (tx.payment_method) {
    return PAYMENT_METHOD_LABEL[tx.payment_method] ?? tx.payment_method;
  }
  return tx.note ?? tx.categories?.name ?? "—";
}
