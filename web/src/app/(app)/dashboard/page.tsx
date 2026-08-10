"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  ListChecks,
  Plus,
  Search,
} from "lucide-react";
import { useSession } from "@/components/session-provider";
import { NetWorthHero } from "@/components/net-worth-hero";
import { Panel, Rows } from "@/components/panels";
import { Reveal } from "@/components/reveal";
import { EmptyState } from "@/components/empty-state";
import { EntryRow } from "@/components/entry-row";
import { QuickAddModal } from "@/components/quick-add-modal";
import { QuickTaskModal } from "@/components/quick-task-modal";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { deleteQuickEntry } from "@/lib/ledger-actions";
import { monthBounds, netWorthSeries, rangePoints } from "@/lib/ledger";
import { formatHijri, formatPKR } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { EntryWithCategory } from "@/components/entry-row";
import type { QuickEntryDraft } from "@/components/quick-add-modal";
import type { TickerAsset } from "@/components/asset-ticker";
import type { RangeKey } from "@/lib/ledger";
import type { Tables } from "@/lib/supabase/types";

type AccountWithInstitution = Tables<"accounts"> & {
  institutions: Tables<"institutions"> | null;
};

export default function DashboardPage() {
  const session = useSession();
  const supabase = createClient();
  const router = useRouter();
  const { showToast } = useToast();

  const householdId = session.household?.id || "";
  const userId = session.user.id;
  const firstName = session.profile?.first_name || "there";

  const [addModalOpen, setAddModalOpen] = React.useState(false);
  const [addModalType, setAddModalType] = React.useState<"expense" | "income">("expense");
  const [editingEntry, setEditingEntry] = React.useState<QuickEntryDraft | null>(null);
  const [deletingEntry, setDeletingEntry] = React.useState<EntryWithCategory | null>(null);
  const [taskModalOpen, setTaskModalOpen] = React.useState(false);

  const [entries, setEntries] = React.useState<EntryWithCategory[]>([]);
  const [tasks, setTasks] = React.useState<Tables<"tasks">[]>([]);
  const [accounts, setAccounts] = React.useState<AccountWithInstitution[]>([]);
  const [transactions, setTransactions] = React.useState<
    Array<Pick<Tables<"transactions">, "id" | "date" | "amount_paisa" | "account_id">>
  >([]);

  const [range, setRange] = React.useState<RangeKey>("6M");
  const [query, setQuery] = React.useState("");
  const [refreshKey, setRefreshKey] = React.useState(0);
  const reload = () => setRefreshKey((k) => k + 1);

  React.useEffect(() => {
    if (!householdId) return;
    let active = true;

    async function load() {
      const [entriesRes, tasksRes, accountsRes, txRes] = await Promise.all([
        supabase
          .from("quick_entries")
          .select("*, categories(*)")
          .eq("household_id", householdId)
          .order("entry_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("tasks")
          .select("*")
          .eq("household_id", householdId)
          .order("is_done", { ascending: true })
          .order("due_date", { ascending: true })
          .limit(6),
        supabase
          .from("accounts")
          .select("*, institutions(*)")
          .eq("household_id", householdId)
          .eq("is_archived", false)
          .order("balance_paisa", { ascending: false }),
        supabase
          .from("transactions")
          .select("id, date, amount_paisa, account_id")
          .eq("household_id", householdId)
          .order("date", { ascending: false }),
      ]);

      if (!active) return;
      if (entriesRes.data) setEntries(entriesRes.data as unknown as EntryWithCategory[]);
      if (tasksRes.data) setTasks(tasksRes.data);
      if (accountsRes.data) {
        setAccounts(accountsRes.data as unknown as AccountWithInstitution[]);
      }
      if (txRes.data) setTransactions(txRes.data);
    }

    load();
    return () => {
      active = false;
    };
  }, [householdId, supabase, refreshKey]);

  /*
   * NET WORTH = SUM OF ACCOUNT BALANCES. Accounts only.
   *
   * Owner-confirmed: a linked entry is already counted once through its
   * transaction, and an unlinked entry is money that does not sit in a tracked
   * account — it shows in the quick-log figures and on /entries, never here. This
   * is what keeps the hero number reconcilable against a bank statement.
   *
   * It used to be summed from quick_entries, which is why every account balance
   * was invisible on this page and why "Net Saved" was identical to net worth.
   */
  const netWorthPaisa = React.useMemo(
    () => accounts.reduce((sum, a) => sum + Number(a.balance_paisa), 0),
    [accounts],
  );

  const { from: monthFrom, to: monthTo } = React.useMemo(() => monthBounds(), []);

  // Month figures come from transactions — real money movement in real accounts.
  const monthFlow = React.useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    for (const t of transactions) {
      if (t.date < monthFrom || t.date > monthTo) continue;
      const amt = Number(t.amount_paisa);
      if (amt >= 0) inflow += amt;
      else outflow += Math.abs(amt);
    }
    return { inflow, outflow, net: inflow - outflow };
  }, [transactions, monthFrom, monthTo]);

  /*
   * Quick-log figures come from quick_entries alone.
   *
   * `logged` is a NET figure (in minus out). Summing the raw unsigned amounts
   * added income and expense together — Rs 35,000 salary plus Rs 2,000 of spending
   * came out as "Rs 37,000 logged", which is not a quantity of anything.
   */
  const quickLog = React.useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    let unlinkedCount = 0;
    let count = 0;
    for (const e of entries) {
      if (e.entry_date < monthFrom || e.entry_date > monthTo) continue;
      const amt = Number(e.amount_paisa);
      if (e.type === "income") inflow += amt;
      else outflow += amt;
      count += 1;
      if (!e.linked_transaction_id) unlinkedCount += 1;
    }
    return { net: inflow - outflow, unlinkedCount, count };
  }, [entries, monthFrom, monthTo]);

  const series = React.useMemo(() => {
    const earliest = transactions.length
      ? transactions[transactions.length - 1].date
      : null;
    const points = rangePoints(range, earliest);
    if (points.length === 0) return [];
    return netWorthSeries(netWorthPaisa, transactions, points);
  }, [range, transactions, netWorthPaisa]);

  const assets: TickerAsset[] = React.useMemo(
    () =>
      accounts
        .filter((a) => Number(a.balance_paisa) !== 0)
        .map((a) => ({
          id: a.id,
          name: a.name,
          balancePaisa: Number(a.balance_paisa),
          logoPath: a.institutions?.logo_path ?? null,
          brandColor: a.institutions?.brand_color ?? null,
        })),
    [accounts],
  );

  const accountNames = React.useMemo(
    () => new Map(accounts.map((a) => [a.id, a.name])),
    [accounts],
  );
  const txAccount = React.useMemo(
    () => new Map(transactions.map((t) => [t.id, t.account_id])),
    [transactions],
  );

  const linkedAccountName = (entry: EntryWithCategory): string | null => {
    if (!entry.linked_transaction_id) return null;
    const accId = txAccount.get(entry.linked_transaction_id);
    return accId ? accountNames.get(accId) ?? "Linked" : "Linked";
  };

  const recentEntries = entries.slice(0, 8);

  const toggleTaskStatus = async (taskId: string, currentStatus: boolean) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, is_done: !currentStatus } : t)),
    );
    await supabase.from("tasks").update({ is_done: !currentStatus }).eq("id", taskId);
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/transactions?q=${encodeURIComponent(q)}` : "/transactions");
  };

  const handleDeleteEntry = async (cascade: boolean) => {
    if (!deletingEntry) return;
    try {
      await deleteQuickEntry(supabase, deletingEntry, cascade);
      showToast({
        type: "success",
        title: "Entry deleted",
        description:
          deletingEntry.linked_transaction_id && cascade
            ? "The linked transaction was deleted too."
            : deletingEntry.linked_transaction_id
              ? "The linked transaction was kept and unlinked."
              : undefined,
      });
      setDeletingEntry(null);
      reload();
    } catch (err) {
      showToast({
        type: "error",
        title: "Could not delete entry",
        description: err instanceof Error ? err.message : "Unknown error.",
      });
    }
  };

  const today = new Date();
  const isFiler = session.preferences?.is_filer ?? false;
  const openTasks = tasks.filter((t) => !t.is_done).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 pb-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-display truncate text-[19px] font-semibold tracking-[-0.02em] sm:text-[22px]">
            Assalam-o-Alaikum, {firstName}
          </h1>
          <p className="text-muted mt-0.5 text-[12.5px]">
            <span className="ltr">
              {today.toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <span className="text-faint">
              {" · "}
              <span className="ltr">{formatHijri(today)}</span>
            </span>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          {/*
           * This was a <span> — it looked like a search field and was never an
           * input. The placeholder also said "or ask", advertising natural-language
           * search that does not exist; it now says what it does.
           */}
          <form onSubmit={submitSearch} className="hidden xl:block">
            <label className="border-border bg-surface focus-within:border-navy-900 dark:focus-within:border-brass flex h-9 w-64 items-center gap-2 rounded-full border px-3.5 transition-colors">
              <Search size={14} className="text-faint shrink-0" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search transactions"
                aria-label="Search transactions"
                className="text-foreground placeholder:text-faint min-w-0 flex-1 bg-transparent text-[12.5px] outline-none"
              />
            </label>
          </form>

          <button
            onClick={() => {
              setAddModalType("expense");
              setEditingEntry(null);
              setAddModalOpen(true);
            }}
            className="bg-navy-900 text-on-navy dark:bg-brass dark:text-navy-900 flex h-9 items-center gap-1.5 rounded-full px-4 text-[12.5px] font-medium transition-transform active:scale-95"
          >
            <Plus size={15} />
            Add Entry
          </button>
        </div>
      </header>

      {/* Quick actions */}
      <div className="flex flex-wrap items-center gap-3">
        {(
          [
            { type: "expense" as const, label: "Add Expense", icon: ArrowDownRight, tone: "text-loss" },
            { type: "income" as const, label: "Add Income", icon: ArrowUpRight, tone: "text-gain" },
          ]
        ).map(({ type, label, icon: Icon, tone }) => (
          <button
            key={type}
            onClick={() => {
              setAddModalType(type);
              setEditingEntry(null);
              setAddModalOpen(true);
            }}
            className="border-border bg-surface hover:bg-surface-subtle shadow-xs flex items-center gap-2 rounded-control border px-3.5 py-2 text-xs font-medium transition-colors"
          >
            <Icon size={15} className={tone} />
            {label}
          </button>
        ))}
        <button
          onClick={() => setTaskModalOpen(true)}
          className="border-border bg-surface hover:bg-surface-subtle shadow-xs flex items-center gap-2 rounded-control border px-3.5 py-2 text-xs font-medium transition-colors"
        >
          <ListChecks size={15} className="text-brass-strong" />
          Add Task
        </button>
      </div>

      <Reveal index={0}>
        <NetWorthHero
          netWorthPaisa={netWorthPaisa}
          deltaPaisa={monthFlow.net}
          /*
           * Percentage change against the balance at the START of the month. Left
           * undefined when that baseline is zero — a workspace whose entire history
           * is this month has nothing to compare against, and "0.0%" beside
           * "+Rs 35,500 this month" reads as a contradiction.
           */
          deltaFraction={
            netWorthPaisa - monthFlow.net !== 0
              ? monthFlow.net / Math.abs(netWorthPaisa - monthFlow.net)
              : undefined
          }
          series={series}
          range={range}
          onRangeChange={setRange}
          assets={assets}
          seriesEmptyMessage={
            accounts.length === 0
              ? "Add an account to start charting your net worth."
              : "Not enough transaction history to chart this range yet."
          }
          kpis={[
            {
              label: "Money in",
              valuePaisa: monthFlow.inflow,
              footnote: "this month, across accounts",
            },
            {
              label: "Money out",
              valuePaisa: monthFlow.outflow,
              invertDelta: true,
              footnote: "this month, across accounts",
            },
            {
              // Month-scoped, NOT the net-worth variable. These were the same
              // number before, which cannot be true of "saved" and "net worth".
              label: "Saved this month",
              valuePaisa: monthFlow.net,
              footnote: "money in minus money out",
            },
            buildContextSlot({
              quickLog,
              openTasks,
              isFiler,
            }),
          ]}
        />
      </Reveal>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <Reveal index={1} className="lg:col-span-2">
          <Panel
            title="Recent entries"
            action="View all"
            actionHref="/entries"
            bodyClassName="px-0 pb-2"
          >
            {recentEntries.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="No entries yet"
                  description="Log your first income or expense. Entries stay independent unless you link them to an account."
                  action={
                    <button
                      onClick={() => {
                        setAddModalType("expense");
                        setEditingEntry(null);
                        setAddModalOpen(true);
                      }}
                      className="bg-navy-900 text-on-navy dark:bg-brass dark:text-navy-900 rounded-control px-4 py-2 text-xs font-semibold"
                    >
                      + Add first entry
                    </button>
                  }
                />
              </div>
            ) : (
              <Rows>
                {recentEntries.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    linkedAccountName={linkedAccountName(entry)}
                    onEdit={() => {
                      setEditingEntry({
                        id: entry.id,
                        type: entry.type,
                        amount_paisa: Number(entry.amount_paisa),
                        category: entry.category,
                        category_id: entry.category_id,
                        note: entry.note,
                        entry_date: entry.entry_date,
                        linked_transaction_id: entry.linked_transaction_id,
                      });
                      setAddModalOpen(true);
                    }}
                    onDelete={() => setDeletingEntry(entry)}
                  />
                ))}
              </Rows>
            )}
          </Panel>
        </Reveal>

        <Reveal index={2}>
          <Panel title="Needs You" action={`${openTasks} open`}>
            {tasks.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-muted text-xs">No pending financial tasks.</p>
                <button
                  onClick={() => setTaskModalOpen(true)}
                  className="text-brass-strong mt-2 text-xs font-semibold hover:underline"
                >
                  + Create a task
                </button>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {tasks.map((task) => (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => toggleTaskStatus(task.id, task.is_done)}
                      className={cn(
                        "bg-surface-subtle hover:bg-surface-3 flex w-full items-center justify-between gap-2 rounded-control p-3 text-left transition-colors",
                        task.is_done && "opacity-60",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={task.is_done}
                          readOnly
                          tabIndex={-1}
                          aria-hidden
                          className="accent-navy-900 dark:accent-brass size-4 rounded"
                        />
                        <span className="min-w-0">
                          <span
                            className={cn(
                              "block truncate text-xs font-medium",
                              task.is_done && "text-muted line-through",
                            )}
                          >
                            {task.title}
                          </span>
                          {task.due_date && (
                            <span className="text-faint block text-[10.5px]">
                              Due <span className="ltr">{task.due_date}</span>
                            </span>
                          )}
                        </span>
                      </span>
                      {task.linked_label && (
                        <span className="bg-surface text-muted border-border shrink-0 rounded border px-2 py-0.5 font-mono text-[10.5px]">
                          {task.linked_label}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </Reveal>
      </div>

      <QuickAddModal
        isOpen={addModalOpen}
        onClose={() => {
          setAddModalOpen(false);
          setEditingEntry(null);
        }}
        defaultType={addModalType}
        householdId={householdId}
        userId={userId}
        entry={editingEntry}
        onSuccess={reload}
      />

      <QuickTaskModal
        isOpen={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        householdId={householdId}
        userId={userId}
        onSuccess={reload}
      />

      <ConfirmDeleteModal
        isOpen={deletingEntry !== null}
        onClose={() => setDeletingEntry(null)}
        onConfirm={handleDeleteEntry}
        title="Delete this entry?"
        recordLabel={
          deletingEntry
            ? `${deletingEntry.note?.trim() || deletingEntry.categories?.name || deletingEntry.category} · ${formatPKR(deletingEntry.amount_paisa)}`
            : ""
        }
        recordMeta={
          deletingEntry
            ? `${deletingEntry.type === "income" ? "Income" : "Expense"} · ${deletingEntry.entry_date}`
            : undefined
        }
        linkedRefs={
          deletingEntry?.linked_transaction_id
            ? [
                {
                  kind: "Transaction",
                  label: `${linkedAccountName(deletingEntry) ?? "Account"} · ${formatPKR(deletingEntry.amount_paisa)}`,
                },
              ]
            : []
        }
        confirmLabel="Delete entry"
      />
    </div>
  );
}

/**
 * The fourth KPI slot.
 *
 * It used to hold "FBR Filer Status — Rs 100", a rupee amount rendered for a
 * boolean, which is meaningless. The rule list below is deliberately ONE array so
 * the priority order can be changed without touching JSX — the owner wants to set
 * the final ruleset later, and more conditions (upcoming bill, Zakat due,
 * committee turn, budget at risk) drop in here.
 */
function buildContextSlot({
  quickLog,
  openTasks,
  isFiler,
}: {
  quickLog: { net: number; unlinkedCount: number; count: number };
  openTasks: number;
  isFiler: boolean;
}) {
  const RULES = [
    {
      when: quickLog.count > 0,
      kpi: {
        label: "Quick log, net",
        valuePaisa: quickLog.net,
        footnote:
          quickLog.unlinkedCount > 0
            ? `${quickLog.count} entries · ${quickLog.unlinkedCount} not linked to an account`
            : `${quickLog.count} entries this month`,
        href: "/entries",
      },
    },
    {
      when: openTasks > 0,
      kpi: {
        label: "Needs you",
        valuePaisa: 0,
        body: (
          <p className="font-display text-[22px] font-semibold leading-none tracking-[-0.02em] sm:text-[26px]">
            {openTasks} {openTasks === 1 ? "task" : "tasks"}
          </p>
        ),
        footnote: "open financial tasks",
        href: "/tasks",
      },
    },
    {
      when: true,
      kpi: {
        label: "FBR status",
        valuePaisa: 0,
        // A state, rendered as a state. Never as an amount.
        body: (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold",
              isFiler ? "bg-gain-soft text-gain" : "bg-surface-subtle text-muted",
            )}
          >
            <BadgeCheck size={13} />
            {isFiler ? "Filer" : "Non-filer"}
          </span>
        ),
        footnote: isFiler ? "Active on the ATL" : "Higher withholding applies",
        href: "/tax",
      },
    },
  ];

  return RULES.find((r) => r.when)!.kpi;
}
