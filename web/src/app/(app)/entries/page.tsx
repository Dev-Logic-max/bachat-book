"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Link2Off, NotebookPen, Plus } from "lucide-react";
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
import { deleteQuickEntry } from "@/lib/ledger-actions";
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
 * Every figure on this page comes from `quick_entries` ALONE — no account
 * balances, no transaction rows. That is the point of the module: it is the one
 * screen where the daily log stands on its own. Combining the two tables happens
 * on the dashboard and nowhere else.
 */
export default function EntriesPage() {
  const session = useSession();
  const supabase = createClient();
  const { showToast } = useToast();

  const householdId = session.household?.id || "";
  const userId = session.user.id;

  const [entries, setEntries] = React.useState<EntryWithCategory[]>([]);
  const [accountNames, setAccountNames] = React.useState<Map<string, string>>(new Map());
  const [loading, setLoading] = React.useState(true);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const [month, setMonth] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all");
  const [categoryFilter, setCategoryFilter] = React.useState("all");

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
          .from("quick_entries")
          .select("*, categories(*)")
          .eq("household_id", householdId)
          .order("entry_date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("accounts")
          .select("id, name")
          .eq("household_id", householdId),
      ]);

      if (!active) return;

      if (entryRes.data) {
        setEntries(entryRes.data as unknown as EntryWithCategory[]);
      }
      if (accRes.data) {
        setAccountNames(new Map(accRes.data.map((a) => [a.id, a.name])));
      }
      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [householdId, supabase, refreshKey]);

  // Which account each linked entry points at, for the row badge. One extra
  // query rather than a join, because the FK direction is entry -> transaction
  // and PostgREST cannot follow it to accounts in a single select.
  const [txAccount, setTxAccount] = React.useState<Map<string, string>>(new Map());
  const linkedIds = React.useMemo(
    () => entries.map((e) => e.linked_transaction_id).filter(Boolean) as string[],
    [entries],
  );
  const linkedKey = linkedIds.join(",");

  React.useEffect(() => {
    if (linkedIds.length === 0) return;
    let active = true;

    supabase
      .from("transactions")
      .select("id, account_id")
      .in("id", linkedIds)
      .then(({ data }) => {
        if (active && data) {
          setTxAccount(new Map(data.map((t) => [t.id, t.account_id])));
        }
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedKey, supabase]);

  const linkedAccountName = (entry: EntryWithCategory): string | null => {
    if (!entry.linked_transaction_id) return null;
    const accId = txAccount.get(entry.linked_transaction_id);
    return accId ? accountNames.get(accId) ?? "Linked" : "Linked";
  };

  // ---- Filters -------------------------------------------------------------

  const monthOptions: SelectOption[] = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of entries) {
      const key = e.entry_date.slice(0, 7);
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

  const filtered = React.useMemo(
    () =>
      entries.filter((e) => {
        if (month !== "all" && !e.entry_date.startsWith(month)) return false;
        if (typeFilter !== "all" && e.type !== typeFilter) return false;
        if (categoryFilter !== "all" && (e.category_id ?? e.category) !== categoryFilter)
          return false;
        return true;
      }),
    [entries, month, typeFilter, categoryFilter],
  );

  // ---- Totals, from entries only ------------------------------------------

  const totals = React.useMemo(() => {
    let income = 0;
    let expense = 0;
    // NET, not a sum of unsigned amounts: adding Rs 35,000 of salary to Rs 1,000
    // of groceries produces a number that measures nothing.
    let unlinkedIn = 0;
    let unlinkedOut = 0;
    for (const e of filtered) {
      const amt = Number(e.amount_paisa);
      if (e.type === "income") income += amt;
      else expense += amt;
      if (!e.linked_transaction_id) {
        if (e.type === "income") unlinkedIn += amt;
        else unlinkedOut += amt;
      }
    }
    return {
      income,
      expense,
      unlinked: unlinkedIn - unlinkedOut,
      net: income - expense,
    };
  }, [filtered]);

  const unlinkedCount = filtered.filter((e) => !e.linked_transaction_id).length;

  const handleDelete = async (cascade: boolean) => {
    if (!deleting) return;
    try {
      await deleteQuickEntry(supabase, deleting, cascade);
      showToast({
        type: "success",
        title: "Entry deleted",
        description:
          deleting.linked_transaction_id && cascade
            ? "The linked transaction was deleted too."
            : deleting.linked_transaction_id
              ? "The linked transaction was kept and unlinked."
              : undefined,
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

  const deletingAccountName = deleting ? linkedAccountName(deleting) : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display truncate text-[19px] font-semibold tracking-[-0.02em] sm:text-[22px]">
            Entries
          </h1>
          <p className="text-muted mt-0.5 text-[12.5px]">
            Your daily income and expense log. Figures here come from entries only —
            account balances live in Accounts.
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

      {/* Blocks — entry data only */}
      <Reveal index={0}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Logged in"
            valuePaisa={totals.income}
            tone="gain"
            footnote={`${filtered.filter((e) => e.type === "income").length} entries`}
          />
          <StatCard
            label="Logged out"
            valuePaisa={totals.expense}
            tone="loss"
            footnote={`${filtered.filter((e) => e.type === "expense").length} entries`}
          />
          <StatCard
            label="Net logged"
            valuePaisa={totals.net}
            tone={totals.net >= 0 ? "gain" : "loss"}
            footnote="in minus out"
          />
          <StatCard
            label="Not linked, net"
            valuePaisa={totals.unlinked}
            tone="neutral"
            footnote={
              unlinkedCount === 0
                ? "every entry is linked to an account"
                : `${unlinkedCount} standalone · not in net worth`
            }
            icon={<Link2Off size={13} />}
          />
        </div>
      </Reveal>

      {/* Filters */}
      <Reveal index={1}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
        </div>
      </Reveal>

      {/* The log */}
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
                    ? "Log your first income or expense. Entries stay independent unless you link them to an account."
                    : "Try a different month, type or category."
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
                  linkedAccountName={linkedAccountName(entry)}
                  onEdit={() => {
                    setEditing({
                      id: entry.id,
                      type: entry.type,
                      amount_paisa: Number(entry.amount_paisa),
                      category: entry.category,
                      category_id: entry.category_id,
                      note: entry.note,
                      entry_date: entry.entry_date,
                      linked_transaction_id: entry.linked_transaction_id,
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

      <ConfirmDeleteModal
        isOpen={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete this entry?"
        recordLabel={
          deleting
            ? `${deleting.note?.trim() || deleting.categories?.name || deleting.category} · ${formatPKR(deleting.amount_paisa)}`
            : ""
        }
        recordMeta={
          deleting
            ? `${deleting.type === "income" ? "Income" : "Expense"} · ${deleting.entry_date}`
            : undefined
        }
        linkedRefs={
          deleting?.linked_transaction_id
            ? [
                {
                  kind: "Transaction",
                  label: `${deletingAccountName ?? "Account"} · ${formatPKR(deleting.amount_paisa)}`,
                },
              ]
            : []
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
