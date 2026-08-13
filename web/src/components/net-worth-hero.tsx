"use client";

import Link from "next/link";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { CountUp } from "./count-up";
import { AssetTicker } from "@/components/asset-ticker";
import { formatPKRCompact, formatPercent, moneyParts } from "@/lib/format";
import { RANGE_LABEL } from "@/lib/ledger";
import { cn } from "@/lib/utils";

import type { TickerAsset } from "@/components/asset-ticker";
import type { RangeKey } from "@/lib/ledger";

type Point = { date: string; value: number; label: string };

type Kpi = {
  label: string;
  valuePaisa: number;
  deltaFraction?: number;
  /** Spending going up is bad; income going up is good. */
  invertDelta?: boolean;
  footnote?: string;
  /**
   * Non-money content for the contextual slot. When set, the money figure is not
   * rendered at all — the previous FBR card put a rupee amount on a status, which
   * is what made it meaningless.
   */
  body?: React.ReactNode;
  href?: string;
};

/**
 * SPEC §1.1 — the most repeated device in the reference set: a full-bleed dark
 * band with a card row overlapping its bottom edge by 40-60% of the card's own
 * height. A card row sitting neatly BELOW the band does not read as designed.
 */
export function NetWorthHero({
  netWorthPaisa,
  deltaPaisa,
  deltaFraction,
  series,
  kpis,
  range,
  onRangeChange,
  assets = [],
  seriesEmptyMessage,
}: {
  netWorthPaisa: number;
  deltaPaisa: number;
  /**
   * Omit when there is no prior baseline to compare against. A brand-new workspace
   * where everything happened this month has no meaningful percentage, and showing
   * "0.0%" beside "+Rs 35,500 this month" reads as a contradiction.
   */
  deltaFraction?: number;
  series: Point[];
  kpis: Kpi[];
  range?: RangeKey;
  onRangeChange?: (r: RangeKey) => void;
  assets?: TickerAsset[];
  /** Shown instead of the chart when there is no history to cover `range`. */
  seriesEmptyMessage?: string;
}) {
  const up = deltaPaisa >= 0;

  // A single point cannot draw a trend, and a flat line reads as "you had exactly
  // this much all year" — which is the lie the old hardcoded series told.
  const hasSeries = series.length >= 2;

  // Headroom below the line so the fill has mass and the curve sits clear of
  // the headline. Without a forced domain recharts pins the line to the top of
  // its box, straight through the delta text.
  const values = series.map((p) => p.value);
  const min = hasSeries ? Math.min(...values) : 0;
  const max = hasSeries ? Math.max(...values) : 1;
  const spread = Math.max(1, max - min);
  const domain: [number, number] = [min - spread * 1.9, max + spread * 0.22];

  return (
    <section className="pb-17">
      <div className="bg-navy-900 relative overflow-hidden rounded-modal">
        {/* The chart bleeds to the band's own edges — it is the imagery. */}
        {hasSeries ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[56%]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="nwFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c6a15b" stopOpacity={0.5} />
                    <stop offset="55%" stopColor="#c6a15b" stopOpacity={0.16} />
                    <stop offset="100%" stopColor="#c6a15b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <YAxis hide domain={domain} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#c6a15b"
                  strokeWidth={2.25}
                  fill="url(#nwFill)"
                  dot={false}
                  animationDuration={800}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : null}

        {/* pb-44 gives the chart a real region between the headline and the
            overlapping cards. At pb-32 the curve was a sliver behind the cards.
            Mobile stacks the KPIs 2x2, so it needs a deeper skirt still.

            With no chart the skirt collapses — reserving chart height for a chart
            that is not there left ~600px of empty navy on mobile. */}
        <div
          className={cn(
            "relative flex items-start justify-between gap-6 px-5 pt-6 sm:px-8 sm:pt-7",
            hasSeries ? "pb-56 sm:pb-44" : "pb-28 sm:pb-24",
          )}
        >
          <div>
            <p className="text-brass text-[11px] font-semibold uppercase tracking-[0.18em]">
              Total net worth
            </p>
            <div className="mt-2.5 flex items-baseline gap-3">
              <CountUp
                value={netWorthPaisa}
                format={(n) => {
                  const p = moneyParts(n, { compact: true });
                  return `${p.symbol} ${p.whole}`;
                }}
                className="text-on-navy font-display tnum text-[36px] font-semibold leading-none tracking-tight sm:text-[46px]"
              />
              {/* SPEC §3 — the unit drops to ~40% of the figure and goes muted. */}
              <span className="text-on-navy-muted font-display text-[19px] font-medium">
                {moneyParts(netWorthPaisa, { compact: true }).suffix}
              </span>
            </div>

            <div className="mt-3.5 flex items-center gap-2.5">
              {deltaFraction !== undefined && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.75 text-[11.5px] font-semibold",
                    up ? "bg-gain/15 text-gain" : "bg-loss/15 text-loss",
                  )}
                >
                  {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  <span className="tnum">{formatPercent(deltaFraction)}</span>
                </span>
              )}
              {/* The figure is isolated LTR; the trailing words are not, or
                  they would be forced left-to-right in Urdu too. */}
              <span className="text-on-navy-muted text-[12.5px]">
                <span className="tnum">
                  {up ? "+" : ""}
                  {formatPKRCompact(deltaPaisa)}
                </span>{" "}
                this month
              </span>
            </div>

            {/* Per-account breakdown of the figure above it. */}
            <AssetTicker assets={assets} />

            {/*
             * In the content flow, not absolutely positioned over the chart
             * region: the KPI row deliberately overlaps the band's bottom edge, so
             * anything pinned down there is hidden behind a card.
             */}
            {!hasSeries && (
              <p className="text-on-navy-muted/70 mt-4 max-w-xs text-[11.5px] leading-snug">
                {seriesEmptyMessage ?? "Not enough history yet to chart this range."}
              </p>
            )}
          </div>

          {/*
           * These were painted <span>s with no state behind them — there was not
           * even a `range` variable in the app. Now real buttons driving the
           * series the caller passes down.
           */}
          <div className="hidden items-center gap-1 rounded-full bg-white/6 p-1 sm:flex">
            {(Object.keys(RANGE_LABEL) as RangeKey[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onRangeChange?.(r)}
                disabled={!onRangeChange}
                aria-pressed={range === r}
                className={cn(
                  "rounded-full px-3 py-1 text-[11.5px] font-medium transition-colors",
                  range === r
                    ? "bg-brass text-navy-900"
                    : "text-on-navy-muted hover:text-on-navy",
                )}
              >
                {RANGE_LABEL[r]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* The overlap. -68px lifts the row over the band by ~55% of its height. */}
      <div className="relative z-10 -mt-17 -mb-17 grid grid-cols-2 gap-3 px-4 sm:gap-4 sm:px-6 lg:grid-cols-4">
        {kpis.map((k) => {
          const good = k.invertDelta
            ? (k.deltaFraction ?? 0) < 0
            : (k.deltaFraction ?? 0) >= 0;
          const parts = moneyParts(k.valuePaisa, { compact: true });

          const inner = (
            <>
              <p className="text-muted text-[11.5px] font-medium">{k.label}</p>

              {k.body ? (
                <div className="mt-1.5">{k.body}</div>
              ) : (
                /* nowrap: at 390px "Rs 1.38 crore" broke across three lines and
                   left the four cards at different heights. */
                <p className="mt-1.5 flex items-baseline gap-1.5 whitespace-nowrap">
                  <span className="font-display tnum text-[22px] font-semibold leading-none tracking-[-0.02em] sm:text-[26px]">
                    {parts.symbol} {parts.whole}
                  </span>
                  {parts.suffix && (
                    <span className="text-muted text-[12px] font-medium">
                      {parts.suffix}
                    </span>
                  )}
                </p>
              )}

              <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-[11.5px]">
                {k.deltaFraction !== undefined && !k.body && (
                  <span
                    className={cn(
                      "tnum font-semibold",
                      good ? "text-gain" : "text-loss",
                    )}
                  >
                    {formatPercent(k.deltaFraction)}
                  </span>
                )}
                <span className="text-faint">{k.footnote}</span>
              </p>
            </>
          );

          /*
            A hairline border is added here even though these cards float on
            shadow alone: `lift` warms it to brass on hover, and a card with no
            border to warm would have nothing to say on hover but a shadow
            change, which is invisible against the navy band behind it.
          */
          const cardClass =
            "lift bg-surface border-border rounded-card border px-5 py-4 shadow-md flex flex-col justify-between";

          return k.href ? (
            <Link key={k.label} href={k.href} className={cardClass}>
              {inner}
            </Link>
          ) : (
            <div key={k.label} className={cardClass}>
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}
