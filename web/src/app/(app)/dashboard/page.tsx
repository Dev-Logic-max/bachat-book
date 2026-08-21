"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  ListChecks,
  Plus,
  Receipt,
  Repeat,
  RotateCcw,
  Search,
} from "lucide-react";
import { useSession } from "@/components/session-provider";
import { NetWorthHero } from "@/components/net-worth-hero";
import { Panel, Rows } from "@/components/panels";
import { Reveal } from "@/components/reveal";
import { EmptyState } from "@/components/empty-state";
import { EntryRow } from "@/components/entry-row";
import { QuickAddModal } from "@/components/quick-add-modal";
// The full task form, not a cut-down one. A "quick" add that omitted subtasks,
// payment and repeat taught you those fields did not exist.
import { TaskFormModal } from "@/components/task-form-modal";
import { CompleteTaskModal } from "@/components/complete-task-modal";
import { ConfirmActionModal } from "@/components/confirm-action-modal";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { deleteMovement } from "@/lib/ledger-actions";
import { completeTask, uncompleteTask, type SettleInput } from "@/lib/task-actions";
import { deriveStatus, dueLabel, dueTone, type TaskWithChecklist } from "@/lib/tasks";
import { institutionLogo, monthBounds, netWorthSeries, rangePoints } from "@/lib/ledger";
import { withPayments, type DebtWithPayments } from "@/lib/debts";
import { netWorthBreakdown, netWorthLines } from "@/lib/net-worth";
import { formatHijri, formatPKR } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { Investment } from "@/lib/investments";
import type { EntryAccountRef, EntryWithCategory } from "@/components/entry-row";
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
  const [tasks, setTasks] = React.useState<TaskWithChecklist[]>([]);
  const [accounts, setAccounts] = React.useState<AccountWithInstitution[]>([]);
  // Needed by the settle modal, which offers a category for the entry it writes.
  const [categories, setCategories] = React.useState<Tables<"categories">[]>([]);
  const [completingTask, setCompletingTask] = React.useState<TaskWithChecklist | null>(null);
  const [reopeningTask, setReopeningTask] = React.useState<TaskWithChecklist | null>(null);
  const [taskBusy, setTaskBusy] = React.useState(false);
  const [transactions, setTransactions] = React.useState<
    Array<
      Pick<
        Tables<"transactions">,
        "id" | "date" | "amount_paisa" | "account_id" | "type" | "is_opening"
      >
    >
  >([]);
  /*
   * What the household owns and owes beyond its accounts.
   *
   * Loaded here because NET WORTH is not the same question as "what is in my
   * accounts", and this page used to answer only the second one while labelling
   * it as the first. A holding you own and money you are owed are both yours; a
   * qarz you have taken is not.
   */
  const [holdings, setHoldings] = React.useState<Investment[]>([]);
  const [debts, setDebts] = React.useState<DebtWithPayments[]>([]);

  const [range, setRange] = React.useState<RangeKey>("6M");
  const [query, setQuery] = React.useState("");
  const [refreshKey, setRefreshKey] = React.useState(0);
  const reload = () => setRefreshKey((k) => k + 1);

  React.useEffect(() => {
    if (!householdId) return;
    let active = true;

    async function load() {
      const [
        entriesRes,
        tasksRes,
        accountsRes,
        txRes,
        categoriesRes,
        holdingsRes,
        debtsRes,
        paymentsRes,
      ] = await Promise.all([
        // Entries = income and expense from the single ledger. Transfers and
        // opening balances are excluded: neither is money earned or spent.
        supabase
          .from("transactions")
          .select("*, categories(*)")
          .eq("household_id", householdId)
          .in("type", ["income", "expense"])
          .eq("is_opening", false)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("tasks")
          .select("*, task_checklist_items(*)")
          .eq("household_id", householdId)
          .order("is_done", { ascending: true })
          .order("due_date", { ascending: true })
          .limit(6),
        /*
         * Deactivated accounts are loaded so their past entries can still name
         * them; `liveAccounts` below is what net worth and the ticker use. Filtered
         * out here, every row pointing at a switched-off account read "Unknown".
         */
        supabase
          .from("accounts")
          .select("*, institutions(*)")
          .eq("household_id", householdId)
          .is("deleted_at", null)
          .order("balance_paisa", { ascending: false }),
        supabase
          .from("transactions")
          .select("id, date, amount_paisa, account_id, type, is_opening")
          .eq("household_id", householdId)
          .order("date", { ascending: false }),
        supabase.from("categories").select("*").order("sort_order").order("name"),
        // The two halves of net worth that are not account balances.
        supabase.from("investments").select("*").eq("household_id", householdId),
        supabase.from("debts").select("*").eq("household_id", householdId).eq("status", "open"),
        supabase.from("debt_payments").select("*").eq("household_id", householdId),
      ]);

      if (!active) return;
      if (entriesRes.data) setEntries(entriesRes.data as unknown as EntryWithCategory[]);
      if (tasksRes.data) setTasks(tasksRes.data as unknown as TaskWithChecklist[]);
      if (categoriesRes.data) setCategories(categoriesRes.data);
      if (accountsRes.data) {
        setAccounts(accountsRes.data as unknown as AccountWithInstitution[]);
      }
      if (txRes.data) setTransactions(txRes.data);
      if (holdingsRes.data) setHoldings(holdingsRes.data);
      // Payments attached here rather than in the reducer: what is still owed is
      // DERIVED from principal minus payments, never stored, so the debts are
      // useless on their own.
      setDebts(withPayments(debtsRes.data ?? [], paymentsRes.data ?? []));
    }

    load();
    return () => {
      active = false;
    };
  }, [householdId, supabase, refreshKey]);

  const liveAccounts = React.useMemo(
    () => accounts.filter((a) => !a.is_archived),
    [accounts],
  );

  /*
   * NET WORTH AND CASH IN HAND ARE DIFFERENT NUMBERS.
   *
   * Net worth used to be "the sum of account balances", which made the hero
   * figure and a KPI card two names for one quantity — and left the household's
   * gold, its plot and the Rs 5,000 owed by a cousin out of a figure called
   * "total net worth" entirely.
   *
   *   cash in hand  = live account balances. Reconcilable against a statement.
   *   net worth     = cash + holdings at today's value + owed to you − you owe.
   *
   * Lending does not change net worth: the account went down and the receivable
   * went up. Borrowing does not either: the cash arrived and the liability came
   * with it. Writing a debt off DOES lower it, which is the honest answer — the
   * money left when you lent it and it is not coming back.
   *
   * `lib/net-worth.ts` holds the rules so the dashboard, Reports and Zakat can
   * never disagree about them.
   */
  const worth = React.useMemo(
    () => netWorthBreakdown({ accounts, holdings, debts }),
    [accounts, holdings, debts],
  );
  const netWorthPaisa = worth.netWorthPaisa;

  const { from: monthFrom, to: monthTo } = React.useMemo(() => monthBounds(), []);

  // Month figures come from transactions — real money movement in real accounts.
  const monthFlow = React.useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    for (const t of transactions) {
      if (t.date < monthFrom || t.date > monthTo) continue;
      /*
       * Transfers and opening balances are NOT flow.
       *
       * A transfer is two legs that cancel, so summing both added the same
       * rupees to inflow AND outflow — an ATM withdrawal of Rs 20,000 read as
       * "Rs 20,000 in, Rs 20,000 out" for money that never left the household.
       * An opening balance is the position an account started at, so counting
       * it made the Rs 36,500 already sitting in the accounts look like income.
       */
      if (t.type === "transfer" || t.is_opening) continue;
      const amt = Number(t.amount_paisa);
      if (amt >= 0) inflow += amt;
      else outflow += Math.abs(amt);
    }
    return { inflow, outflow, net: inflow - outflow };
  }, [transactions, monthFrom, monthTo]);

  /*
   * Entry figures — income and expense only, from the same ledger.
   *
   * A NET figure (in minus out). Summing the raw magnitudes added income and
   * expense together: Rs 35,000 salary plus Rs 2,000 of spending came out as
   * "Rs 37,000 logged", which is not a quantity of anything.
   */
  const quickLog = React.useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    let count = 0;
    for (const e of entries) {
      if (e.date < monthFrom || e.date > monthTo) continue;
      // SIGNED column: income positive, expense negative, by constraint.
      const amt = Number(e.amount_paisa);
      if (amt >= 0) inflow += amt;
      else outflow += Math.abs(amt);
      count += 1;
    }
    return { net: inflow - outflow, count };
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
      liveAccounts
        .filter((a) => Number(a.balance_paisa) !== 0)
        .map((a) => ({
          id: a.id,
          name: a.name,
          balancePaisa: Number(a.balance_paisa),
          logoPath: a.institutions?.logo_path ?? null,
          brandColor: a.institutions?.brand_color ?? null,
        })),
    [liveAccounts],
  );

  /*
   * Account identity per row — mark, brand and name. The row used to take a bare
   * name and render it behind a chain icon, which said "linked": a fact that is
   * true of every row now and therefore tells you nothing. The bank's own mark
   * identifies where the money moved instead.
   */
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

  const entryAccountName = (entry: EntryWithCategory): string | null =>
    accountRefById.get(entry.account_id)?.name ?? null;

  const recentEntries = entries.slice(0, 8);

  /*
   * COMPLETING A TASK HERE MUST DO WHAT IT DOES ON THE TASKS PAGE.
   *
   * This used to be a bare `update({ is_done })`. For a task that moves money
   * that is a silent data loss: ticking "Electricity Bill (MEPCO)" marked it
   * paid and wrote NO ledger entry, so the bill was done and the Rs 4,200 never
   * left any account. The same tick on /tasks opened the settle modal and wrote
   * the payment. One of the two was lying, and it was this one.
   *
   * Both directions now go through the same helpers the Tasks page uses:
   * completing opens the settle modal, and un-completing deletes the movement
   * it wrote — because un-ticking silently must not leave the money spent.
   */
  const requestToggleTask = (task: TaskWithChecklist) => {
    if (deriveStatus(task) === "done") {
      setReopeningTask(task);
      return;
    }
    setCompletingTask(task);
  };

  const handleCompleteTask = async (settle: SettleInput | null) => {
    if (!completingTask) return;
    setTaskBusy(true);
    try {
      const { transactionId, spawnedId } = await completeTask(
        supabase,
        completingTask,
        settle,
        userId,
      );
      showToast({
        type: "success",
        title: "Task completed",
        description:
          [
            transactionId && settle
              ? `${formatPKR(settle.amountPaisa)} recorded in your ledger.`
              : null,
            spawnedId ? "The next one is on the board." : null,
          ]
            .filter(Boolean)
            .join(" ") || undefined,
      });
      setCompletingTask(null);
      reload();
    } catch (err) {
      showToast({
        type: "error",
        title: "Could not complete the task",
        description: err instanceof Error ? err.message : "Unknown error.",
      });
    } finally {
      setTaskBusy(false);
    }
  };

  const handleReopenTask = async () => {
    if (!reopeningTask) return;
    setTaskBusy(true);
    try {
      await uncompleteTask(
        supabase,
        reopeningTask,
        Boolean(reopeningTask.settled_transaction_id),
      );
      showToast({
        type: "success",
        title: "Back on the board",
        description: reopeningTask.settled_transaction_id
          ? "The entry it wrote has been removed and the account re-settled."
          : undefined,
      });
      setReopeningTask(null);
      reload();
    } catch (err) {
      showToast({
        type: "error",
        title: "Could not reopen it",
        description: err instanceof Error ? err.message : "Unknown error.",
      });
    } finally {
      setTaskBusy(false);
    }
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/transactions?q=${encodeURIComponent(q)}` : "/transactions");
  };

  const handleDeleteEntry = async () => {
    if (!deletingEntry) return;
    try {
      await deleteMovement(supabase, deletingEntry.id);
      showToast({
        type: "success",
        title: "Entry deleted",
        description: `${entryAccountName(deletingEntry) ?? "The account"} has been re-settled.`,
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
          composition={netWorthLines(worth).map((line) => ({
            label: line.label,
            valuePaisa: line.valuePaisa,
            sign: line.sign,
          }))}
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
              /*
               * The figure this page never showed: what the household is
               * actually holding, right now, across every live account.
               *
               * This slot used to be "Saved this month", which is `money in −
               * money out` — the same quantity the two cards beside it already
               * spelled out, and a number that says nothing about whether there
               * is anything left. Net worth above it includes gold, plots and
               * money owed to you; this is the part you can spend today.
               */
              label: "Cash in hand",
              valuePaisa: worth.cashPaisa,
              footnote:
                liveAccounts.length === 1
                  ? "in your account right now"
                  : `across ${liveAccounts.length} accounts right now`,
              href: "/accounts",
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
                    /* This panel is two thirds of a three-column grid, not the
                       full content width the Entries page gets. */
                    dense
                    account={accountRefById.get(entry.account_id) ?? null}
                    onEdit={() => {
                      const amt = Number(entry.amount_paisa);
                      setEditingEntry({
                        id: entry.id,
                        type: amt >= 0 ? "income" : "expense",
                        amount_paisa: Math.abs(amt),
                        category_id: entry.category_id,
                        note: entry.note,
                        entry_date: entry.date,
                        account_id: entry.account_id,
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
              /* Was a bare line of grey text beside an illustrated empty state
                 in the panel next to it — the two read as different products. */
              <div className="flex flex-col items-center py-2 text-center">
                <img
                  src="/art/empty-tasks.webp"
                  alt=""
                  className="mb-2 size-28 object-contain"
                />
                <p className="text-foreground text-[13px] font-semibold">
                  Nothing needs you
                </p>
                <p className="text-muted mt-1 max-w-52 text-[11.5px] leading-relaxed">
                  Bills, fees and chores land here. Mark one as moving money and
                  completing it logs the payment for you.
                </p>
                <button
                  onClick={() => setTaskModalOpen(true)}
                  className="text-brass-strong mt-2.5 text-xs font-semibold hover:underline"
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
                      onClick={() => requestToggleTask(task)}
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
                          className="accent-navy-900 dark:accent-brass size-4 shrink-0 rounded"
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

                          {/*
                            The SAME facts the task card carries, in the same
                            order: when it is due (coloured by urgency, not
                            always grey), whether it moves money, and how
                            often it repeats. Subtasks are deliberately left
                            out — this panel answers "what needs me", and the
                            checklist belongs on the board.
                          */}
                          <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                            {task.due_date && (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 text-[10.5px] font-medium",
                                  task.is_done
                                    ? "text-faint"
                                    : dueTone(task.due_date, task.priority) === "overdue"
                                      ? "text-loss"
                                      : dueTone(task.due_date, task.priority) === "soon"
                                        ? "text-brass-strong"
                                        : "text-muted",
                                )}
                              >
                                <CalendarDays size={10} />
                                {dueLabel(task.due_date)}
                              </span>
                            )}

                            {task.is_paid && task.amount_paisa ? (
                              <span className="border-border bg-surface text-foreground-2 tnum inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium">
                                {formatPKR(Number(task.amount_paisa))}
                              </span>
                            ) : null}

                            {task.repeat_rule !== "none" && (
                              <span className="text-faint inline-flex items-center gap-0.5 text-[10px]">
                                <Repeat size={9} />
                                {task.repeat_rule}
                              </span>
                            )}
                          </span>
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

      <TaskFormModal
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
            ? `${deletingEntry.note?.trim() || deletingEntry.categories?.name || "Entry"} · ${formatPKR(Math.abs(Number(deletingEntry.amount_paisa)))}`
            : ""
        }
        recordMeta={
          deletingEntry
            ? `${Number(deletingEntry.amount_paisa) >= 0 ? "Income" : "Expense"} · ${deletingEntry.date} · ${entryAccountName(deletingEntry) ?? "Account"}`
            : undefined
        }
        confirmLabel="Delete entry"
      />

      {/* The SAME two dialogs the Tasks page uses, so a tick means the same
          thing on both screens. */}
      <CompleteTaskModal
        isOpen={completingTask !== null}
        onClose={() => setCompletingTask(null)}
        onConfirm={handleCompleteTask}
        task={completingTask}
        accounts={accounts}
        categories={categories}
        busy={taskBusy}
      />

      <ConfirmActionModal
        isOpen={reopeningTask !== null}
        onClose={() => setReopeningTask(null)}
        onConfirm={handleReopenTask}
        title="Put this back on the board?"
        icon={<RotateCcw size={16} />}
        headline={reopeningTask?.title}
        points={
          reopeningTask?.settled_transaction_id
            ? [
                {
                  icon: <Receipt size={13} />,
                  label: "The entry it wrote is deleted",
                  detail:
                    "The account is re-settled, so the balance goes back to what it was before you completed this.",
                },
                {
                  icon: <AlertTriangle size={13} />,
                  label: "Only do this if the payment did not happen",
                  detail:
                    "If it did and the figure is wrong, edit the task instead — the entry follows it, and no money is invented.",
                },
              ]
            : [
                {
                  icon: <RotateCcw size={13} />,
                  label: "It just goes back onto the board",
                  detail:
                    "This task does not move money, so nothing in your ledger changes.",
                },
              ]
        }
        confirmLabel="Reopen task"
        busy={taskBusy}
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
  quickLog: { net: number; count: number };
  openTasks: number;
  isFiler: boolean;
}) {
  const RULES = [
    {
      when: quickLog.count > 0,
      kpi: {
        label: "Quick log, net",
        valuePaisa: quickLog.net,
        footnote: `${quickLog.count} entries this month`,
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
