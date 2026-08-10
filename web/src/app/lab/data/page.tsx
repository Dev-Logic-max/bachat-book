import { dataset, summary, budgetsWithProgress, committeeStatus } from "@/mock";
import { formatPKR, formatPKRCompact, formatPercent, formatTola } from "@/lib/format";

/** Throwaway sanity check on the fixtures. Deleted once Wave A is approved. */
export default function DataProbe() {
  const gold = dataset.plans.find((p) => p.kind === "gold");
  const rows: Array<[string, string]> = [
    ["transactions", String(dataset.transactions.length)],
    ["date range", `${dataset.transactions.at(-1)?.date} → ${dataset.transactions[0]?.date}`],
    ["net worth", formatPKR(summary.netWorthPaisa)],
    ["net worth (compact)", formatPKRCompact(summary.netWorthPaisa)],
    ["nw delta", `${formatPKR(summary.netWorthDeltaPaisa)} (${formatPercent(summary.netWorthDeltaFraction)})`],
    ["month in", formatPKR(summary.monthInPaisa)],
    ["month out", formatPKR(summary.monthOutPaisa)],
    ["savings rate", formatPercent(summary.savingsRate)],
    ["spend vs last month", formatPercent(summary.spendDeltaFraction)],
    ["invested", formatPKRCompact(summary.investedPaisa)],
    ["portfolio", formatPKRCompact(summary.portfolioPaisa)],
    ["portfolio gain", `${formatPKRCompact(summary.portfolioGainPaisa)} (${formatPercent(summary.portfolioGainFraction)})`],
    ["zakatable", formatPKRCompact(summary.zakatablePaisa)],
    ["nisab", formatPKR(summary.nisabPaisa)],
    ["zakat due", formatPKR(summary.zakatDuePaisa)],
    ["gold", gold?.grams ? formatTola(gold.grams) : "—"],
    ["committee", `${committeeStatus().paid}/${committeeStatus().total} paid · pot ${formatPKRCompact(committeeStatus().potPaisa)}`],
    ["budgets", budgetsWithProgress().map((b) => `${b.category?.name} ${(b.fraction * 100).toFixed(0)}%`).join(" · ")],
  ];

  return (
    <div className="p-10 font-mono text-xs">
      <table className="border-separate border-spacing-x-6 border-spacing-y-1">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td className="text-muted">{k}</td>
              <td className="tnum">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
