import { Bell, Plus, Search } from "lucide-react";
import { AppRail } from "@/components/app-rail";
import { BottomNav } from "@/components/bottom-nav";
import { CashflowChart } from "@/components/cashflow-chart";
import { MerchantMark } from "@/components/merchant-mark";
import { NetWorthHero } from "@/components/net-worth-hero";
import { Panel, Rows } from "@/components/panels";
import { Reveal } from "@/components/reveal";
import { ThemeToggle } from "@/components/theme";
import {
  CATEGORY_BY_ID,
  MERCHANT_BY_ID,
  budgetsWithProgress,
  cashflowSeries,
  committee,
  committeeStatus,
  netWorthSeries,
  openTasks,
  recentTransactions,
  summary,
  upcomingBills,
  zakatBreakdown,
} from "@/mock";
import { formatHijri, formatPKR, formatPKRCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

const TODAY = new Date(`${summary.today}T00:00:00Z`);

function dayLabel(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  const diff = Math.round((TODAY.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function OverviewPage() {
  const txns = recentTransactions(11);
  const bills = upcomingBills().slice(0, 6);
  const budgets = budgetsWithProgress().slice(0, 4);
  const cmt = committeeStatus();
  const tasks = openTasks().slice(0, 3);

  return (
    <div className="flex min-h-screen">
      <AppRail />
      <BottomNav />

      <main className="min-w-0 flex-1">
        {/* Header */}
        <header className="flex items-center justify-between gap-4 px-4 pb-5 pt-6 sm:px-6">
          <div className="min-w-0">
            <h1 className="font-display truncate text-[19px] font-semibold tracking-[-0.02em] sm:text-[22px]">
              Assalam-o-Alaikum<span className="hidden sm:inline">, Bilal</span>
            </h1>
            <p className="text-muted mt-0.5 text-[12.5px]">
              <span className="ltr">
                {TODAY.toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <span className="text-faint">
                {" · "}
                <span className="ltr">{formatHijri(TODAY)}</span>
              </span>
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            <div className="border-border bg-surface text-faint hidden h-9 w-64 items-center gap-2 rounded-full border px-3.5 text-[12.5px] xl:flex">
              <Search size={14} />
              <span>Search or ask anything</span>
              <kbd className="bg-surface-subtle text-muted ms-auto rounded px-1.5 py-0.5 text-[10px] font-medium">
                ⌘K
              </kbd>
            </div>
            <button className="border-border bg-surface text-foreground-2 flex size-9 items-center justify-center rounded-full border">
              <Bell size={15} strokeWidth={1.75} />
            </button>
            <ThemeToggle />
            <button className="bg-navy-900 text-on-navy flex h-9 items-center gap-1.5 rounded-full px-4 text-[12.5px] font-medium">
              <Plus size={15} />
              Add
            </button>
          </div>
        </header>

        {/* pb-28 on mobile clears the floating nav island. */}
        <div className="px-4 pb-28 sm:px-6 lg:pb-8">
          <Reveal index={0}>
            <NetWorthHero
              netWorthPaisa={summary.netWorthPaisa}
              deltaPaisa={summary.netWorthDeltaPaisa}
              deltaFraction={summary.netWorthDeltaFraction}
              series={netWorthSeries()}
              kpis={[
                {
                  label: "Money in",
                  valuePaisa: summary.monthInPaisa,
                  footnote: "month to date",
                },
                {
                  label: "Money out",
                  valuePaisa: summary.monthOutPaisa,
                  deltaFraction: summary.spendDeltaFraction,
                  invertDelta: true,
                  footnote: "vs last month",
                },
                {
                  label: "Investments",
                  valuePaisa: summary.portfolioPaisa,
                  deltaFraction: summary.portfolioGainFraction,
                  footnote: "total return",
                },
                {
                  label: "Saved",
                  valuePaisa: summary.monthNetPaisa,
                  footnote: "month to date",
                },
              ]}
            />
          </Reveal>

          <div className="mt-6 grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
            {/* Cash flow */}
            <Reveal index={1} className="lg:col-span-2">
              <Panel title="Cash flow" action="Last 6 months">
                <div className="mb-3 flex items-center gap-5">
                  <Legend tone="var(--chart-3)" label="In" />
                  <Legend tone="var(--chart-1)" label="Out" />
                  <span className="text-faint ms-auto text-[11.5px]">
                    Saved{" "}
                    <span className="text-gain tnum font-semibold">
                      {(summary.savingsRateLastMonth * 100).toFixed(0)}%
                    </span>{" "}
                    in {summary.lastMonthLabel}
                  </span>
                </div>
                <CashflowChart data={cashflowSeries()} />
              </Panel>
            </Reveal>

            {/* Upcoming bills */}
            <Reveal index={2}>
              <Panel title="Upcoming" action="Calendar" bodyClassName="px-0 pb-2">
                <Rows>
                  {bills.map((b) => {
                    const merchant = b.merchantId ? MERCHANT_BY_ID[b.merchantId] : null;
                    return (
                      <li key={b.id} className="flex items-center gap-3 px-5 py-2.5">
                        <MerchantMark
                          name={merchant?.name ?? b.name}
                          brand={merchant?.brand ?? "#1b3563"}
                          logo={merchant?.logo}
                          size={32}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium">{b.name}</p>
                          <p className="text-faint text-[11.5px]">
                            <span className="ltr">{dayLabel(b.dueDate)}</span>
                          </p>
                        </div>
                        <span className="tnum font-mono text-[12.5px] font-medium">
                          {formatPKR(b.amountPaisa)}
                        </span>
                      </li>
                    );
                  })}
                </Rows>
              </Panel>
            </Reveal>
          </div>

          <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
            {/* Recent transactions */}
            <Reveal index={3} className="lg:col-span-2">
              <Panel
                title="Recent activity"
                action="View all"
                bodyClassName="px-0 pb-2"
              >
                <Rows>
                  {txns.map((t) => {
                    const merchant = t.merchantId ? MERCHANT_BY_ID[t.merchantId] : null;
                    const cat = CATEGORY_BY_ID[t.categoryId];
                    const income = t.amountPaisa > 0;
                    return (
                      <li key={t.id} className="flex items-center gap-3 px-5 py-2.5">
                        <MerchantMark
                          name={merchant?.name ?? cat?.name ?? "—"}
                          brand={merchant?.brand ?? "#6e6a62"}
                          logo={merchant?.logo}
                          size={34}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium">
                            {merchant?.name ?? t.note ?? cat?.name}
                          </p>
                          <p className="text-faint text-[11.5px]">
                            <span className="ltr">{dayLabel(t.date)}</span> ·{" "}
                            {cat?.name}
                          </p>
                        </div>
                        {t.originalCurrency && (
                          <span className="bg-surface-subtle text-muted ltr hidden rounded-full px-2 py-0.5 text-[10.5px] font-medium sm:inline">
                            ${t.originalAmount} @ {t.fxRate}
                          </span>
                        )}
                        <span
                          className={cn(
                            "tnum font-mono text-[13px] font-medium",
                            income ? "text-gain" : "text-foreground",
                          )}
                        >
                          {income ? "+" : "−"}
                          {formatPKR(Math.abs(t.amountPaisa))}
                        </span>
                      </li>
                    );
                  })}
                </Rows>
              </Panel>
            </Reveal>

            {/* Right column stack */}
            <Reveal index={4} className="flex flex-col gap-4">
              <Panel title="Budgets" action="August">
                <ul className="space-y-3">
                  {budgets.map((b) => {
                    const over = b.fraction > 1;
                    const pct = Math.min(1, b.fraction);
                    return (
                      <li key={b.id}>
                        <div className="flex items-baseline justify-between">
                          <span className="text-[12.5px] font-medium">
                            {b.category?.name}
                          </span>
                          <span className="tnum text-faint text-[11.5px]">
                            {formatPKRCompact(b.spentPaisa)}
                            <span className="text-faint/70">
                              {" "}
                              / {formatPKRCompact(b.limitPaisa)}
                            </span>
                          </span>
                        </div>
                        <div className="bg-surface-3 mt-1.5 h-1.5 overflow-hidden rounded-full">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              over ? "bg-loss" : "bg-brass",
                            )}
                            style={{ width: `${pct * 100}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Panel>

              {/* Committee */}
              <Panel title="Committee" action={committee.name}>
                <div className="flex items-center gap-4">
                  <CommitteeRing
                    members={committee.members}
                    current={committee.currentMonth}
                  />
                  <div className="min-w-0">
                    <p className="font-display tnum text-[20px] font-semibold leading-none">
                      {cmt.paid}
                      <span className="text-faint text-[14px]">/{cmt.total}</span>
                    </p>
                    <p className="text-muted mt-1 text-[11.5px]">paid this month</p>
                    <p className="text-faint mt-2 text-[11.5px]">
                      Pot{" "}
                      <span className="text-foreground tnum font-medium">
                        {formatPKRCompact(cmt.potPaisa)}
                      </span>
                      {" · "}
                      {cmt.collected ? "you collected" : `your turn: month ${cmt.myPayoutMonth}`}
                    </p>
                  </div>
                </div>
              </Panel>

              {/* Zakat */}
              <Panel title="Zakat" action="Silver nisab">
                <div className="flex items-baseline justify-between">
                  <span className="font-display tnum text-[20px] font-semibold leading-none">
                    {formatPKRCompact(summary.zakatDuePaisa)}
                  </span>
                  <span className="text-faint text-[11.5px]">payable at 2.5%</span>
                </div>

                <div className="mt-3 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
                  {zakatBreakdown.map((s) => (
                    <span
                      key={s.label}
                      style={{
                        width: `${(s.paisa / summary.zakatablePaisa) * 100}%`,
                        background: s.tone,
                      }}
                    />
                  ))}
                </div>

                <ul className="mt-2.5 space-y-1">
                  {zakatBreakdown.map((s) => (
                    <li
                      key={s.label}
                      className="flex items-center gap-1.5 text-[11.5px]"
                    >
                      <span
                        className="size-1.5 rounded-full"
                        style={{ background: s.tone }}
                      />
                      <span className="text-muted">{s.label}</span>
                      <span className="text-foreground tnum ms-auto font-medium">
                        {formatPKRCompact(s.paisa)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel title="Needs you" action={`${tasks.length}`} bodyClassName="px-0 pb-2">
                <Rows>
                  {tasks.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 px-5 py-2.5">
                      <span
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          t.priority === "high" ? "bg-loss" : "bg-brass",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-medium">{t.title}</p>
                        <p className="text-faint text-[11px]">
                          <span className="ltr">{dayLabel(t.dueDate)}</span>
                          {t.auto && " · auto"}
                        </p>
                      </div>
                      {t.linkedLabel && (
                        <span className="tnum text-muted font-mono text-[11.5px]">
                          {t.linkedLabel}
                        </span>
                      )}
                    </li>
                  ))}
                </Rows>
              </Panel>
            </Reveal>
          </div>
        </div>
      </main>
    </div>
  );
}

function Legend({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="text-muted flex items-center gap-1.5 text-[11.5px]">
      <span className="size-2 rounded-sm" style={{ background: tone }} />
      {label}
    </span>
  );
}

function CommitteeRing({
  members,
  current,
}: {
  members: Array<{ id: string; paidThisMonth: boolean; isSelf?: boolean }>;
  current: number;
}) {
  const total = members.length;
  const size = 68;
  const r = 27;
  const cx = size / 2;
  const cy = size / 2;
  const gap = 5;
  const step = 360 / total;

  const arc = (i: number) => {
    const a0 = ((i * step + gap / 2 - 90) * Math.PI) / 180;
    const a1 = (((i + 1) * step - gap / 2 - 90) * Math.PI) / 180;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`;
  };

  return (
    <svg width={size} height={size} className="shrink-0">
      {members.map((member, i) => (
        <path
          key={member.id}
          d={arc(i)}
          fill="none"
          strokeWidth={member.isSelf ? 5.5 : 4}
          strokeLinecap="round"
          stroke={
            member.isSelf
              ? "var(--brass)"
              : member.paidThisMonth
                ? "var(--chart-3)"
                : "var(--surface-3)"
          }
        />
      ))}
      <text
        x={cx}
        y={cy - 1}
        textAnchor="middle"
        className="fill-foreground font-display"
        style={{ fontSize: 14, fontWeight: 600 }}
      >
        {current}
      </text>
      <text
        x={cx}
        y={cy + 10}
        textAnchor="middle"
        className="fill-faint"
        style={{ fontSize: 7.5, letterSpacing: "0.08em" }}
      >
        MONTH
      </text>
    </svg>
  );
}
