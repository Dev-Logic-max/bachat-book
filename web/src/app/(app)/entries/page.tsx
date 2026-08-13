"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, NotebookPen, Plus, Wallet } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Panel, Rows } from "@/components/panels";
import { Reveal } from "@/components/reveal";
import { EmptyState } from "@/components/empty-state";
import { EntryRow } from "@/components/entry-row";
import { QuickAddModal } from "@/components/quick-add-modal";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { CategoryChip } from "@/components/category-icon";
import { RichSelect } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { deleteMovement } from "@/lib/ledger-actions";
import { formatPKR } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { EntryWithCategory } from "@/components/entry-row";
import type { QuickEntryDraft } from "@/components/quick-add-modal";
import type { SelectOption } from "@/components/ui/select";
import type { Tables } from "@/lib/supabase/types";

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
  const [accounts, setAccounts] = React.useState<Tables<"accounts">[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const [month, setMonth] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [accountFilter, setAccountFilter] = React.useState("all");

  const [addOpen, setAddOpen] = React.useState(false);
  const [addType, setAddType] = React.useState<"income" | "expense">("expense");
  const [editing, setEditing] = React.useState<QuickEntryDraft | null>(null);
  const [deleting, setDeleting] = React.useState<EntryWithCategory | null>(null);

  const reload = () => setRefreshKey((k) => k + 1);

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
        supabase
          .from("accounts")
          .select("*")
          .eq("household_id", householdId)
          .eq("is_archived", false)
          .is("deleted_at", null)
          .order("created_at"),
      ]);

      if (!active) return;
      if (entryRes.data) setEntries(entryRes.data as unknown as EntryWithCategory[]);
      if (accRes.data) setAccounts(accRes.data);
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
    const seen = new Map<string, string>();
    for (const e of entries) {
      const key = e.date.slice(0, 7);
      if (!seen.has(key)) {
        seen.set(
          key,
          new Date(`${key}-01T00:00:00`).toLocaleDateString("en-GB", {
            month: "long",
            year: "numeric",
          }),
        );
      }
    }
    return [
      { value: "all", label: "All months" },
      ...[...seen.entries()].map(([value, label]) => ({ value, label })),
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

  const accountOptions: SelectOption[] = React.useMemo(
    () => [
      { value: "all", label: "All accounts" },
      ...accounts.map((a) => ({ value: a.id, label: a.name })),
    ],
    [accounts],
  );

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
   * What you actually hold, straight off the accounts.
   *
   * This replaces the old "Not linked, net" tile, which netted income against
   * expense across entries that belonged to no account — a figure describing
   * money that existed nowhere. Every entry now moves one of these balances, so
   * this tile is the same number the Accounts page shows and the two screens
   * finally agree.
   */
  const heldPaisa = React.useMemo(
    () => accounts.reduce((sum, a) => sum + Number(a.balance_paisa), 0),
    [accounts],
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
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display truncate text-[19px] font-semibold tracking-[-0.02em] sm:text-[22px]">
            Entries
          </h1>
          <p className="text-muted mt-0.5 text-[12.5px]">
            Every rupee in and out, cash included. Each entry moves one of your
            accounts, so these figures reconcile with Accounts.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          <button
            onClick={() => {
              setAddType("expense");
              setEditing(null);
              setAddOpen(true);
            }}
            className="border-border bg-surface hover:bg-surface-subtle shadow-xs flex items-center gap-2 rounded-control border px-3.5 py-2 text-xs font-medium transition-colors"
          >
            <ArrowDownRight size={15} className="text-loss" />
            Add expense
          </button>
          <button
            onClick={() => {
              setAddType("income");
              setEditing(null);
              setAddOpen(true);
            }}
            className="bg-navy-900 text-on-navy dark:bg-brass dark:text-navy-900 flex h-9 items-center gap-1.5 rounded-full px-4 text-[12.5px] font-medium transition-transform active:scale-95"
          >
            <Plus size={15} />
            Add income
          </button>
        </div>
      </header>

      <Reveal index={0}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Logged in"
            valuePaisa={totals.income}
            tone="gain"
            footnote={`${filtered.filter((e) => Number(e.amount_paisa) >= 0).length} entries`}
          />
          <StatCard
            label="Logged out"
            valuePaisa={totals.expense}
            tone="loss"
            footnote={`${filtered.filter((e) => Number(e.amount_paisa) < 0).length} entries`}
          />
          <StatCard
            label="Net logged"
            valuePaisa={totals.net}
            tone={totals.net >= 0 ? "gain" : "loss"}
            footnote="in minus out"
          />
          <StatCard
            label="Held now"
            valuePaisa={heldPaisa}
            tone="neutral"
            footnote={`across ${accounts.length} account${accounts.length === 1 ? "" : "s"}`}
            icon={<Wallet size={13} />}
          />
        </div>
      </Reveal>

      <Reveal index={1}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <RichSelect value={month} onChange={setMonth} options={monthOptions} />
          <RichSelect
            value={typeFilter}
            onChange={(v) => setTypeFilter(v as TypeFilter)}
            options={[
              { value: "all", label: "Income and expense" },
              { value: "income", label: "Income only", icon: <ArrowUpRight size={14} /> },
              { value: "expense", label: "Expense only", icon: <ArrowDownRight size={14} /> },
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
        </div>
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
            <Rows>
              {filtered.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  accountName={accountById.get(entry.account_id)?.name ?? null}
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
            </Rows>
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
}: {
  label: string;
  valuePaisa: number;
  tone: "gain" | "loss" | "neutral";
  footnote: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-surface border-border rounded-card border p-5 shadow-xs">
      <div className="text-muted flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider">
        {icon}
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
      <p className="text-faint mt-0.5 text-[11px]">{footnote}</p>
    </div>
  );
}
