"use client";

import * as React from "react";
import {
  BarChart3,
  Download,
  LayoutList,
  PieChart as PieIcon,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CategoryArt, toneColor } from "@/components/category-icon";
import { EmptyState } from "@/components/empty-state";
import { Reveal } from "@/components/reveal";
import {
  ReportExportModal,
  ReportPrintable,
  type ExportSection,
  type ReportData,
} from "@/components/report-export-modal";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { RichSelect } from "@/components/ui/select";
import { formatPKR, formatPKRCompact } from "@/lib/format";
import {
  RANGE_PRESETS,
  cashPositionSeries,
  expenseByCategory,
  monthRange,
  monthlySeries,
  reportTotals,
  type Category,
  type DateRange,
  type ReportMovement,
} from "@/lib/reports";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/types";

type ViewKey = "overview" | "categories" | "trend" | "list";

const VIEWS: { key: ViewKey; label: string; icon: typeof PieIcon }[] = [
  { key: "overview", label: "Overview", icon: PieIcon },
  { key: "categories", label: "Categories", icon: LayoutList },
  { key: "trend", label: "Trend", icon: BarChart3 },
  { key: "list", label: "Transactions", icon: Wallet },
];

export default function ReportsPage() {
  const session = useSession();
  const supabase = createClient();
  const householdId = session.household?.id || "";

  const [movements, setMovements] = React.useState<ReportMovement[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [accounts, setAccounts] = React.useState<Tables<"accounts">[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [view, setView] = React.useState<ViewKey>("overview");
  const [presetKey, setPresetKey] = React.useState<string>("this_month");
  const [customFrom, setCustomFrom] = React.useState("");
  const [customTo, setCustomTo] = React.useState("");
  const [exportOpen, setExportOpen] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    if (!householdId) return;

    async function load() {
      const [txRes, catRes, accRes] = await Promise.all([
        supabase
          .from("transactions")
          .select("id, date, amount_paisa, type, is_opening, category_id, account_id, note")
          .eq("household_id", householdId)
          .order("date", { ascending: false }),
        supabase.from("categories").select("*"),
        supabase.from("accounts").select("*").eq("household_id", householdId),
      ]);

      if (!active) return;

      // Surface `error` separately from "no rows" — the old page checked only
      // `data`, so a failed query left it on "Loading…" with nothing said.
      const firstError = txRes.error || catRes.error || accRes.error;
      if (firstError) {
        setLoadError(firstError.message);
        setLoading(false);
        return;
      }

      setMovements((txRes.data ?? []) as ReportMovement[]);
      setCategories(catRes.data ?? []);
      setAccounts(accRes.data ?? []);
      setLoadError(null);
      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [householdId, supabase]);

  const range: DateRange = React.useMemo(() => {
    if (presetKey === "custom") {
      const from = customFrom || monthRange().from;
      const to = customTo || monthRange().to;
      return { from, to, label: "Custom range" };
    }
    const preset = RANGE_PRESETS.find((p) => p.key === presetKey);
    return preset ? preset.build() : monthRange();
  }, [presetKey, customFrom, customTo]);

  const totals = React.useMemo(() => reportTotals(movements, range), [movements, range]);
  const slices = React.useMemo(
    () => expenseByCategory(movements, categories, range),
    [movements, categories, range],
  );
  const series = React.useMemo(() => monthlySeries(movements, range), [movements, range]);

  /*
   * What was actually held, day by day.
   *
   * Walked BACKWARDS from today's balance, so it needs the current figure —
   * which is `sync_account_balance_trigger`'s running total across live accounts
   * and the one number that is certainly right. Archived and deleted accounts
   * are excluded here for the same reason they are excluded from "what you
   * hold" everywhere else.
   */
  const currentCashPaisa = React.useMemo(
    () =>
      accounts
        .filter((a) => !a.is_archived && !a.deleted_at)
        .reduce((sum, a) => sum + Number(a.balance_paisa), 0),
    [accounts],
  );
  const cash = React.useMemo(
    () => cashPositionSeries(movements, range, currentCashPaisa),
    [movements, range, currentCashPaisa],
  );

  const categoryNameById = React.useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );
  const accountNameById = React.useMemo(
    () => new Map(accounts.map((a) => [a.id, a.name])),
    [accounts],
  );

  const reportData: ReportData = {
    range,
    totals,
    categories: slices,
    monthly: series,
    cash,
    movements,
    categoryNameById,
    accountNameById,
    householdName: session.household?.name ?? "My Finances",
  };

  const categoryById = React.useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const nothing = totals.incomeCount === 0 && totals.expenseCount === 0;

  return (
    <div className="space-y-6">
      {/* Screen chrome — hidden when printing. */}
      <div className="print:hidden space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display truncate text-[19px] font-semibold tracking-[-0.02em] sm:text-[22px]">
              Reports
            </h1>
            <p className="text-muted mt-0.5 text-[12.5px]">
              Where the money actually went — and what you kept.
            </p>
          </div>

          <Button variant="primary" onClick={() => setExportOpen(true)} disabled={nothing}>
            <Download size={14} />
            Export
          </Button>
        </div>

        {loadError && (
          <div className="border-loss/25 bg-loss/8 text-loss rounded-panel border px-4 py-3 text-[12.5px]">
            Could not load your reports: {loadError}
          </div>
        )}

        {/* ---- Range -------------------------------------------------------- */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[220px_1fr]">
          <RichSelect
            value={presetKey}
            onChange={setPresetKey}
            options={[
              ...RANGE_PRESETS.map((p) => ({ value: p.key, label: p.label })),
              { value: "custom", label: "Custom range", description: "Pick your own dates" },
            ]}
          />
          {presetKey === "custom" ? (
            <div className="grid grid-cols-2 gap-2">
              <DatePicker value={customFrom} onChange={setCustomFrom} />
              <DatePicker value={customTo} onChange={setCustomTo} />
            </div>
          ) : (
            <div className="border-border bg-surface-subtle text-muted rounded-control flex items-center px-3 text-[11.5px]">
              <span className="ltr">
                {range.from} → {range.to}
              </span>
            </div>
          )}
        </div>

        {/* ---- The three figures -------------------------------------------- */}
        <Reveal>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Kpi
              label="Money in"
              value={formatPKR(totals.incomePaisa)}
              sub={`${totals.incomeCount} entries`}
              icon={<TrendingUp size={18} />}
              tone="gain"
            />
            <Kpi
              label="Money out"
              value={formatPKR(totals.expensePaisa)}
              sub={`${totals.expenseCount} entries`}
              icon={<TrendingDown size={18} />}
              tone="loss"
            />
            <div className="bg-navy-900 rounded-panel flex flex-col justify-center p-5">
              <p className="text-on-navy-muted text-[10px] font-semibold uppercase tracking-widest">
                What you kept
              </p>
              <p className="tnum text-on-navy mt-1 text-[22px] font-semibold">
                {totals.netPaisa < 0 && "−"}
                {formatPKR(Math.abs(totals.netPaisa))}
              </p>
              <p className="text-on-navy-muted mt-1 text-[11px]">
                {totals.savingsRate === null
                  ? "Nothing came in this period"
                  : totals.netPaisa < 0
                    ? "You spent more than came in"
                    : `${(totals.savingsRate * 100).toFixed(0)}% of what came in`}
              </p>
            </div>
          </div>
        </Reveal>

        {/*
          Transfers, lending and opening balances are excluded from all of the
          above. Said on the page, because a user who adds up their own
          Transactions list will get a different number and needs to know why.
        */}
        <p className="border-border bg-surface-subtle text-foreground-2 rounded-panel border px-4 py-2.5 text-[11.5px] leading-snug">
          Transfers between your own accounts, money you lent, and opening
          balances are left out — none of them is income or spending.
        </p>

        {/* ---- Views --------------------------------------------------------- */}
        <div className="border-border bg-surface-subtle rounded-control inline-flex items-center gap-1 border p-1">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              aria-pressed={view === v.key}
              className={`rounded-control flex items-center gap-1.5 px-2.5 py-1.5 text-[11.5px] font-medium transition-colors ${
                view === v.key
                  ? "bg-navy-900 text-on-navy dark:bg-brass dark:text-navy-900"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <v.icon size={13} />
              {v.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="bg-surface border-border rounded-panel shimmer h-72 border" />
        ) : nothing ? (
          <EmptyState
            title="Nothing to report yet"
            imageSrc="/art/empty-generic.webp"
            description="Log a few entries and this fills with where your money went, month by month, with a breakdown you can print or send to your accountant."
          />
        ) : (
          <>
            {view === "overview" && <Overview slices={slices} categoryById={categoryById} />}
            {view === "categories" && (
              <CategoryList slices={slices} categoryById={categoryById} />
            )}
            {view === "trend" && <Trend series={series} />}
            {view === "list" && (
              <TransactionList
                movements={movements}
                range={range}
                categoryNameById={categoryNameById}
                accountNameById={accountNameById}
              />
            )}
          </>
        )}
      </div>

      {/*
        The printable document, always mounted but visually hidden on screen.

        It has to be in the DOM when `window.print()` fires — printing a node
        that is mounted only inside an open modal was the obvious approach and
        it fails, because the modal is a portal that the print stylesheet then
        has to fight. This sits in the page, hidden on screen, shown on paper.
      */}
      <div className="hidden print:block">
        <ReportPrintable
          data={reportData}
          sections={new Set<ExportSection>(["summary", "categories", "monthly"])}
        />
      </div>

      <ReportExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        data={reportData}
      />
    </div>
  );
}

/* ========================================================================== */

function Kpi({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  tone: "gain" | "loss";
}) {
  return (
    <div className="bg-surface border-border rounded-panel border p-5 shadow-xs">
      <p className="text-muted flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest">
        <span className={tone === "gain" ? "text-gain" : "text-loss"}>{icon}</span>
        {label}
      </p>
      <p className="tnum text-foreground mt-1 text-[22px] font-semibold">{value}</p>
      <p className="text-faint mt-0.5 text-[11px]">{sub}</p>
    </div>
  );
}

/** Donut plus the top slices beside it. */
function Overview({
  slices,
  categoryById,
}: {
  slices: ReturnType<typeof expenseByCategory>;
  categoryById: Map<string, Category>;
}) {
  const top = slices.slice(0, 8);
  const rest = slices.slice(8);
  const data = [
    ...top.map((s) => ({
      name: s.name,
      value: s.amountPaisa,
      fill: toneColor(s.categoryId ? categoryById.get(s.categoryId)?.tone : null),
    })),
    ...(rest.length > 0
      ? [
          {
            name: `${rest.length} more`,
            value: rest.reduce((sum, s) => sum + s.amountPaisa, 0),
            fill: "var(--color-muted)",
          },
        ]
      : []),
  ];

  return (
    <div className="bg-surface border-border rounded-panel grid grid-cols-1 gap-6 border p-5 shadow-xs lg:grid-cols-[280px_1fr]">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="58%"
              outerRadius="88%"
              paddingAngle={2}
              stroke="none"
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [formatPKR(Number(value ?? 0)), String(name ?? "")]}
              contentStyle={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 10,
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="space-y-2 self-center">
        {top.map((slice) => (
          <li key={slice.categoryId ?? "none"} className="flex items-center gap-3">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{
                background: toneColor(
                  slice.categoryId ? categoryById.get(slice.categoryId)?.tone : null,
                ),
              }}
            />
            <span className="text-foreground min-w-0 flex-1 truncate text-[12.5px]">
              {slice.name}
            </span>
            <span className="tnum text-foreground-2 shrink-0 text-[12px] font-semibold">
              {formatPKRCompact(slice.amountPaisa)}
            </span>
            <span className="tnum text-faint w-10 shrink-0 text-end text-[11px]">
              {(slice.share * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Cards with the real category art — one of the few places big enough for it. */
function CategoryList({
  slices,
  categoryById,
}: {
  slices: ReturnType<typeof expenseByCategory>;
  categoryById: Map<string, Category>;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {slices.map((slice, i) => {
        const category = slice.categoryId ? categoryById.get(slice.categoryId) : null;
        return (
          <Reveal key={slice.categoryId ?? "none"} index={i}>
            <div className="bg-surface border-border rounded-panel flex h-full items-center gap-3 border p-4 shadow-xs">
              {/* 56px is CategoryArt's threshold — at or above it the real
                  render shows instead of the glyph. */}
              <CategoryArt category={category} size={56} rounded="rounded-card" />
              <div className="min-w-0 flex-1">
                <p className="text-foreground truncate text-[13px] font-semibold">{slice.name}</p>
                <p className="tnum text-foreground-2 text-[14px] font-semibold">
                  {formatPKR(slice.amountPaisa)}
                </p>
                <div className="bg-surface-3 mt-1.5 h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round(slice.share * 100)}%`,
                      background: toneColor(category?.tone),
                    }}
                  />
                </div>
                <p className="text-faint mt-1 text-[10.5px]">
                  {(slice.share * 100).toFixed(1)}% · <span className="tnum">{slice.count}</span>{" "}
                  {slice.count === 1 ? "entry" : "entries"}
                </p>
              </div>
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}

function Trend({ series }: { series: ReturnType<typeof monthlySeries> }) {
  const data = series.map((p) => ({
    label: p.label,
    In: p.incomePaisa / 100,
    Out: p.expensePaisa / 100,
  }));

  return (
    <div className="bg-surface border-border rounded-panel border p-5 shadow-xs">
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "var(--color-muted)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--color-muted)" }}
              axisLine={false}
              tickLine={false}
              width={54}
              tickFormatter={(v: number) => formatPKRCompact(v * 100)}
            />
            <Tooltip
              formatter={(value, name) => [formatPKR(Number(value ?? 0) * 100), String(name ?? "")]}
              contentStyle={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 10,
                fontSize: 12,
              }}
              cursor={{ fill: "var(--color-surface-subtle)" }}
            />
            <Bar dataKey="In" fill="var(--color-gain)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Out" fill="var(--color-loss)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TransactionList({
  movements,
  range,
  categoryNameById,
  accountNameById,
}: {
  movements: ReportMovement[];
  range: DateRange;
  categoryNameById: Map<string, string>;
  accountNameById: Map<string, string>;
}) {
  const rows = movements.filter(
    (m) => !m.is_opening && m.type !== "transfer" && m.date >= range.from && m.date <= range.to,
  );

  return (
    <div className="bg-surface border-border rounded-panel overflow-hidden border shadow-xs">
      <div className="bg-linear-to-b from-surface-3 to-surface-subtle text-muted border-border hidden border-b px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest sm:grid sm:grid-cols-[90px_1fr_140px_120px]">
        <span>Date</span>
        <span>Detail</span>
        <span>Category</span>
        <span className="text-end">Amount</span>
      </div>
      <ul className="divide-border divide-y">
        {rows.slice(0, 200).map((m) => {
          const amount = Number(m.amount_paisa);
          return (
            <li
              key={m.id}
              className="hover:bg-surface-subtle grid grid-cols-1 gap-1 px-4 py-2.5 text-[12px] transition-colors sm:grid-cols-[90px_1fr_140px_120px] sm:items-center sm:gap-3"
            >
              <span className="ltr text-muted text-[11px]">{m.date}</span>
              <span className="text-foreground truncate">{m.note ?? "—"}</span>
              <span className="text-muted truncate text-[11px]">
                {m.category_id ? (categoryNameById.get(m.category_id) ?? "—") : "Uncategorised"}
              </span>
              <span
                className={`tnum font-semibold sm:text-end ${amount < 0 ? "text-loss" : "text-gain"}`}
              >
                {amount < 0 ? "−" : "+"}
                {formatPKR(Math.abs(amount))}
              </span>
              <span className="text-faint text-[10.5px] sm:hidden">
                {accountNameById.get(m.account_id) ?? ""}
              </span>
            </li>
          );
        })}
      </ul>
      {rows.length > 200 && (
        <p className="text-faint border-border border-t px-4 py-2 text-[11px]">
          Showing the first 200 of <span className="tnum">{rows.length}</span>. Export to
          get all of them.
        </p>
      )}
    </div>
  );
}
