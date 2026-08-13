"use client";

import * as React from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  Landmark,
  NotebookPen,
  Plus,
  Wallet,
} from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Panel } from "@/components/panels";
import { Reveal } from "@/components/reveal";
import { EmptyState } from "@/components/empty-state";
import { EntryRow, EntryRowHeader } from "@/components/entry-row";
import { QuickAddModal } from "@/components/quick-add-modal";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { CategoryChip } from "@/components/category-icon";
import { AccountBreakdown, buildSlices } from "@/components/account-breakdown";
import { accountSelectOptions } from "@/components/account-options";
import { PageActions } from "@/components/page-actions";
import { FilterBar } from "@/components/filter-bar";
import { RichSelect } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { deleteMovement } from "@/lib/ledger-actions";
import { institutionLogo, todayISO } from "@/lib/ledger";
import { formatPKR } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { BreakdownSlice } from "@/components/account-breakdown";
import type { EntryAccountRef, EntryWithCategory } from "@/components/entry-row";
import type { QuickEntryDraft } from "@/components/quick-add-modal";
import type { SelectOption } from "@/components/ui/select";
import type { Tables } from "@/lib/supabase/types";

type AccountWithInstitution = Tables<"accounts"> & {
  institutions: Tables<"institutions"> | null;
};

type TypeFilter = "all" | "income" | "expense";

/**
 * The Entries module.
 *
 * Every income and expense, cash included, from the single ledger. It answers
 * "what came in, what went out, what's left" — and because every row names an
 * account, "what's left" now RECONCILES against the Accounts page instead of
 * being a parallel number.
 *
 * Excluded here: transfers (neither income nor expense; both legs would cancel)
 * and opening balances (the position an account started at, not money earned).
 * Both live on Transactions.
 */
export default function EntriesPage() {
  const session = useSession();
  const supabase = createClient();
  const { showToast } = useToast();

  const householdId = session.household?.id || "";
  const userId = session.user.id;

  const [entries, setEntries] = React.useState<EntryWithCategory[]>([]);
  const [accounts, setAccounts] = React.useState<AccountWithInstitution[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshKey, setRefreshKey] = React.useState(0);

  /*
   * THIS MONTH by default, not "all".
   *
   * "Logged in" across all of history is not a figure anyone budgets against —
   * it only ever grows, so the four tiles at the top became bigger every month
   * and stopped meaning anything. A month is the unit a household actually
   * thinks in, and it is one click to widen.
   */
  const [month, setMonth] = React.useState(() => todayISO().slice(0, 7));
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [accountFilter, setAccountFilter] = React.useState("all");

  const [addOpen, setAddOpen] = React.useState(false);
  const [addType, setAddType] = React.useState<"income" | "expense">("expense");
  const [editing, setEditing] = React.useState<QuickEntryDraft | null>(null);
  const [deleting, setDeleting] = React.useState<EntryWithCategory | null>(null);

  const reload = () => setRefreshKey((k) => k + 1);

  // How many filters are away from "everything". Drives the mobile badge.
  const activeFilterCount = [month, typeFilter, categoryFilter, accountFilter].filter(
    (v) => v !== "all",
  ).length;

  const clearFilters = () => {
    setMonth("all");
    setTypeFilter("all");
    setCategoryFilter("all");
    setAccountFilter("all");
  };

  React.useEffect(() => {
    if (!householdId) return;
    let active = true;

    async function load() {
      const [entryRes, accRes] = await Promise.all([
        supabase
          .from("transactions")
          .select("*, categories(*)")
          .eq("household_id", householdId)
          // Income and expense only. `neq("type", "transfer")` would still let a
          // future type through; naming the two we want will not.
          .in("type", ["income", "expense"])
          .eq("is_opening", false)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false }),
        /*
         * Deactivated accounts are LOADED, not filtered out. Past entries still
         * point at them, and a row whose account resolved to nothing rendered as
         * "Unknown" — the account did not vanish, it was switched off. What they
         * are excluded from is `heldPaisa` below, which is a different question.
         */
        supabase
          .from("accounts")
          .select("*, institutions(*)")
          .eq("household_id", householdId)
          .is("deleted_at", null)
          .order("created_at"),
      ]);

      if (!active) return;
      if (entryRes.data) setEntries(entryRes.data as unknown as EntryWithCategory[]);
      if (accRes.data) setAccounts(accRes.data as unknown as AccountWithInstitution[]);
      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [householdId, supabase, refreshKey]);

  const accountById = React.useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts],
  );

  // ---- Filters -------------------------------------------------------------

  const monthOptions: SelectOption[] = React.useMemo(() => {
    const label = (key: string) =>
      new Date(`${key}-01T00:00:00`).toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
      });

    const seen = new Map<string, string>();
    /*
     * The CURRENT month is always offered, even with nothing in it yet.
     *
     * The list is otherwise built from the entries themselves, so on the 1st of
     * a month — or in a brand-new workspace — the default selection pointed at
     * an option that did not exist and the control rendered its placeholder.
     */
    const current = todayISO().slice(0, 7);
    seen.set(current, label(current));

    for (const e of entries) {
      const key = e.date.slice(0, 7);
      if (!seen.has(key)) seen.set(key, label(key));
    }

    return [
      { value: "all", label: "All months" },
      // Newest first — you look at this month far more often than 2024.
      ...[...seen.entries()]
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .map(([value, text]) => ({
          value,
          label: text,
          description: value === current ? "This month" : undefined,
        })),
    ];
  }, [entries]);

  const categoryOptions: SelectOption[] = React.useMemo(() => {
    const seen = new Map<string, Tables<"categories">>();
    for (const e of entries) {
      if (e.categories && !seen.has(e.categories.id)) seen.set(e.categories.id, e.categories);
    }
    return [
      { value: "all", label: "All categories" },
      ...[...seen.values()]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => ({
          value: c.id,
          label: c.name,
          icon: <CategoryChip icon={c.icon} tone={c.tone} size={18} iconSize={11} />,
        })),
    ];
  }, [entries]);

  /*
   * A filter, so nothing is disabled and no direction is scored: a deactivated
   * or locked account still has history worth reading. "All accounts" carries a
   * bank glyph so the control reads as an account picker at a glance, the same
   * way every other row in the list is led by a mark.
   */
  const accountOptions: SelectOption[] = React.useMemo(
    () => [
      {
        value: "all",
        label: "All accounts",
        description: `${accounts.length} in this workspace`,
        icon: <Landmark size={16} strokeWidth={1.7} />,
      },
      ...accountSelectOptions(accounts, { disableBlocked: false }),
    ],
    [accounts],
  );

  /*
   * How many days the chosen range covers.
   *
   * "August 2026" does not tell you whether you are looking at 13 days of
   * spending or 31, which is exactly what you need before comparing the figure
   * to last month. The current month counts to TODAY, not to the 31st — a
   * month-to-date total measured against a full month is a false comparison.
   */
  const rangeDays = React.useMemo(() => {
    const today = todayISO();
    if (month === "all") {
      if (entries.length === 0) return null;
      // Entries are newest-first, so the last one is the earliest.
      const earliest = entries[entries.length - 1].date;
      return daysBetween(earliest, today) + 1;
    }
    const [y, m] = month.split("-").map(Number);
    if (!y || !m) return null;
    const isCurrent = month === today.slice(0, 7);
    const lastDay = isCurrent ? Number(today.slice(8, 10)) : new Date(y, m, 0).getDate();
    return lastDay;
  }, [month, entries]);

  const filtered = React.useMemo(
    () =>
      entries.filter((e) => {
        if (month !== "all" && !e.date.startsWith(month)) return false;
        if (typeFilter !== "all" && e.type !== typeFilter) return false;
        if (categoryFilter !== "all" && e.category_id !== categoryFilter) return false;
        if (accountFilter !== "all" && e.account_id !== accountFilter) return false;
        return true;
      }),
    [entries, month, typeFilter, categoryFilter, accountFilter],
  );

  // ---- Totals --------------------------------------------------------------

  const totals = React.useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const e of filtered) {
      // SIGNED column: income positive, expense negative, by constraint.
      const amt = Number(e.amount_paisa);
      if (amt >= 0) income += amt;
      else expense += Math.abs(amt);
    }
    return { income, expense, net: income - expense };
  }, [filtered]);

  /*
   * The same three totals, split by account.
   *
   * "Rs 35,000 logged in" is a number; "Rs 25,000 into JazzCash, Rs 10,000 into
   * cash" is an answer. Built from the FILTERED rows so the split always
   * describes the figure printed above it — a breakdown of the unfiltered set
   * sitting under a filtered total is two different numbers on one card.
   */
  const breakdowns = React.useMemo(() => {
    const income = new Map<string, number>();
    const expense = new Map<string, number>();
    const net = new Map<string, number>();

    for (const e of filtered) {
      const amt = Number(e.amount_paisa);
      const id = e.account_id;
      if (amt >= 0) income.set(id, (income.get(id) ?? 0) + amt);
      else expense.set(id, (expense.get(id) ?? 0) + Math.abs(amt));
      net.set(id, (net.get(id) ?? 0) + amt);
    }

    return {
      income: buildSlices(income, accounts),
      expense: buildSlices(expense, accounts),
      net: buildSlices(net, accounts),
    };
  }, [filtered, accounts]);

  /** Balances as they stand — live accounts only, matching the Accounts page. */
  const heldSlices: BreakdownSlice[] = React.useMemo(
    () =>
      buildSlices(
        new Map(
          accounts
            .filter((a) => !a.is_archived)
            .map((a) => [a.id, Number(a.balance_paisa)]),
        ),
        accounts,
      ),
    [accounts],
  );

  /** Account identity for a row, resolved once rather than per render. */
  const accountRefById = React.useMemo(() => {
    const map = new Map<string, EntryAccountRef>();
    for (const a of accounts) {
      map.set(a.id, {
        name: a.name,
        logo: institutionLogo(a.institutions?.logo_path),
        brand: a.institutions?.brand_color ?? "#16233a",
        awaitingLogo: Boolean(a.institutions && !a.institutions.logo_path),
        deleted: Boolean(a.deleted_at),
      });
    }
    return map;
  }, [accounts]);

  /*
   * What you actually hold, straight off the accounts.
   *
   * This replaces the old "Not linked, net" tile, which netted income against
   * expense across entries that belonged to no account — a figure describing
   * money that existed nowhere. Every entry now moves one of these balances, so
   * this tile is the same number the Accounts page shows and the two screens
   * finally agree.
   */
  const liveAccounts = React.useMemo(
    () => accounts.filter((a) => !a.is_archived),
    [accounts],
  );

  const heldPaisa = React.useMemo(
    () => liveAccounts.reduce((sum, a) => sum + Number(a.balance_paisa), 0),
    [liveAccounts],
  );

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteMovement(supabase, deleting.id);
      const accountName = accountById.get(deleting.account_id)?.name;
      showToast({
        type: "success",
        title: "Entry deleted",
        description: accountName ? `${accountName} has been re-settled.` : undefined,
      });
      setDeleting(null);
      reload();
    } catch (err) {
      showToast({
        type: "error",
        title: "Could not delete entry",
        description: err instanceof Error ? err.message : "Unknown error.",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Never stacks: the 3-dot button belongs on the TITLE's row, which is the
          whole reason the buttons collapse into it below lg. */}
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display truncate text-[19px] font-semibold tracking-[-0.02em] sm:text-[22px]">
            Entries
          </h1>
          <p className="text-muted mt-0.5 text-[12.5px]">
            Every rupee in and out, cash included. Each entry moves one of your
            accounts, so these figures reconcile with Accounts.
          </p>
        </div>

        <PageActions
          title="Entries"
          actions={[
            {
              label: "Add expense",
              hint: "Money out — defaults to cash",
              icon: ArrowDownRight,
              glyphClass: "text-loss",
              onClick: () => {
                setAddType("expense");
                setEditing(null);
                setAddOpen(true);
              },
            },
            {
              label: "Add income",
              hint: "Money in — pick the account it landed in",
              icon: Plus,
              tone: "primary",
              glyphClass: "text-gain",
              onClick: () => {
                setAddType("income");
                setEditing(null);
                setAddOpen(true);
              },
            },
          ]}
        />
      </header>

      <Reveal index={0}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Logged in"
            valuePaisa={totals.income}
            tone="gain"
            icon={<ArrowUpRight size={13} />}
            slices={breakdowns.income}
            preposition="into"
            footnote={`${filtered.filter((e) => Number(e.amount_paisa) >= 0).length} entries`}
          />
          <StatCard
            label="Logged out"
            valuePaisa={totals.expense}
            tone="loss"
            icon={<ArrowDownRight size={13} />}
            slices={breakdowns.expense}
            preposition="from"
            footnote={`${filtered.filter((e) => Number(e.amount_paisa) < 0).length} entries`}
          />
          <StatCard
            label="Net logged"
            valuePaisa={totals.net}
            tone={totals.net >= 0 ? "gain" : "loss"}
            icon={<ArrowLeftRight size={13} />}
            // Per account this is what each one actually GAINED or LOST over the
            // range — in minus out — not the inflow repeated a second time.
            slices={breakdowns.net}
            preposition="net in"
            footnote="in minus out"
          />
          <StatCard
            label="Held now"
            valuePaisa={heldPaisa}
            tone="neutral"
            icon={<Wallet size={13} />}
            slices={heldSlices}
            preposition="in"
            footnote={`across ${liveAccounts.length} account${liveAccounts.length === 1 ? "" : "s"}`}
          />
        </div>
      </Reveal>

      <Reveal index={1}>
        <FilterBar activeCount={activeFilterCount} onClear={clearFilters}>
          <RichSelect
            value={month}
            onChange={setMonth}
            options={monthOptions}
            trailing={
              rangeDays !== null ? (
                <span className="bg-surface-subtle text-muted tnum shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                  {rangeDays}d
                </span>
              ) : undefined
            }
          />
          <RichSelect
            value={typeFilter}
            onChange={(v) => setTypeFilter(v as TypeFilter)}
            options={[
              {
                value: "all",
                label: "Income and expense",
                // Both directions, both colours — the "no filter" state should
                // look like the two states it contains, not like a third one.
                icon: (
                  <span className="flex items-center -space-x-1">
                    <ArrowUpRight size={13} className="text-gain" />
                    <ArrowDownRight size={13} className="text-loss" />
                  </span>
                ),
              },
              {
                value: "income",
                label: "Income only",
                icon: <ArrowUpRight size={15} className="text-gain" />,
              },
              {
                value: "expense",
                label: "Expense only",
                icon: <ArrowDownRight size={15} className="text-loss" />,
              },
            ]}
          />
          <RichSelect
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={categoryOptions}
          />
          <RichSelect
            value={accountFilter}
            onChange={setAccountFilter}
            options={accountOptions}
          />
        </FilterBar>
      </Reveal>

      <Reveal index={2}>
        <Panel
          title="All entries"
          action={`${filtered.length} of ${entries.length}`}
          bodyClassName="px-0 pb-2"
        >
          {loading ? (
            <ul className="space-y-2 px-5 py-2">
              {[0, 1, 2, 3].map((i) => (
                <li key={i} className="shimmer h-12 rounded-control" />
              ))}
            </ul>
          ) : filtered.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title={entries.length === 0 ? "No entries yet" : "Nothing matches these filters"}
                description={
                  entries.length === 0
                    ? "Log your first income or expense. It defaults to cash, and moves that balance straight away."
                    : "Try a different month, type, category or account."
                }
                action={
                  entries.length === 0 ? (
                    <button
                      onClick={() => {
                        setAddType("expense");
                        setEditing(null);
                        setAddOpen(true);
                      }}
                      className="bg-navy-900 text-on-navy dark:bg-brass dark:text-navy-900 rounded-control px-4 py-2 text-xs font-semibold"
                    >
                      <NotebookPen size={14} className="mr-1.5 inline" />
                      Add first entry
                    </button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <ul className="divide-border divide-y">
              <EntryRowHeader />
              {filtered.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  account={accountRefById.get(entry.account_id) ?? null}
                  onEdit={() => {
                    const amt = Number(entry.amount_paisa);
                    setEditing({
                      id: entry.id,
                      type: amt >= 0 ? "income" : "expense",
                      amount_paisa: Math.abs(amt),
                      category_id: entry.category_id,
                      note: entry.note,
                      entry_date: entry.date,
                      account_id: entry.account_id,
                    });
                    setAddOpen(true);
                  }}
                  onDelete={() => setDeleting(entry)}
                />
              ))}
            </ul>
          )}
        </Panel>
      </Reveal>

      <QuickAddModal
        isOpen={addOpen}
        onClose={() => {
          setAddOpen(false);
          setEditing(null);
        }}
        defaultType={addType}
        householdId={householdId}
        userId={userId}
        entry={editing}
        onSuccess={reload}
      />

      {/*
        No cascade choice any more. There is one row, so deleting it deletes the
        movement and the balance trigger re-settles the account — there is no
        second copy that could survive and keep the money deducted.
      */}
      <ConfirmDeleteModal
        isOpen={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete this entry?"
        recordLabel={
          deleting
            ? `${deleting.note?.trim() || deleting.categories?.name || "Entry"} · ${formatPKR(Math.abs(Number(deleting.amount_paisa)))}`
            : ""
        }
        recordMeta={
          deleting
            ? `${Number(deleting.amount_paisa) >= 0 ? "Income" : "Expense"} · ${deleting.date} · ${accountById.get(deleting.account_id)?.name ?? "Account"}`
            : undefined
        }
        confirmLabel="Delete entry"
      />
    </div>
  );
}

function StatCard({
  label,
  valuePaisa,
  tone,
  footnote,
  icon,
  slices = [],
  preposition = "in",
}: {
  label: string;
  valuePaisa: number;
  tone: "gain" | "loss" | "neutral";
  footnote: string;
  icon?: React.ReactNode;
  /** The figure split across the accounts that produced it. */
  slices?: BreakdownSlice[];
  preposition?: string;
}) {
  return (
    // `lift` is the shared hover: a brass hairline and a deeper shadow. Brass
    // never touches the shadow itself — a tinted shadow on cream reads as haze.
    <div className="lift bg-surface border-border rounded-card border p-5 shadow-xs">
      <div className="text-muted flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider">
        <span
          className={cn(
            "flex items-center",
            tone === "gain" && "text-gain",
            tone === "loss" && "text-loss",
            tone === "neutral" && "text-brass-strong",
          )}
        >
          {icon}
        </span>
        {label}
      </div>
      <p
        className={cn(
          "tnum font-display mt-1.5 text-[22px] font-semibold",
          tone === "gain" && "text-gain",
          tone === "loss" && "text-loss",
          tone === "neutral" && "text-foreground",
        )}
      >
        {formatPKR(valuePaisa)}
      </p>

      {slices.length > 0 ? (
        <AccountBreakdown slices={slices} preposition={preposition} />
      ) : (
        // A fixed-height placeholder, so a card with no split does not sit
        // shorter than the three beside it.
        <div className="mt-2 h-4.5" />
      )}

      <p className="text-faint mt-1.5 text-[11px]">{footnote}</p>
    </div>
  );
}

/** Whole days from one local ISO date to another. */
function daysBetween(fromISO: string, toISO: string): number {
  const [fy, fm, fd] = fromISO.split("-").map(Number);
  const [ty, tm, td] = toISO.split("-").map(Number);
  const from = new Date(fy, fm - 1, fd);
  const to = new Date(ty, tm - 1, td);
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000));
}
