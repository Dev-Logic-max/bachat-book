"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";

type Row = { label: string; inRs: number; outRs: number };

const lakh = (n: number) => `${(n / 1e5).toFixed(1)}L`;

export function CashflowChart({ data }: { data: Row[] }) {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barGap={6}>
          {/* Horizontal rules only — vertical gridlines are clutter here. */}
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--faint)", fontSize: 11 }}
            dy={6}
          />
          {/* width 46 clipped "12.0L" down to "2.0L" — the axis read as unsorted. */}
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--faint)", fontSize: 10.5 }}
            tickFormatter={lakh}
            width={40}
          />
          <Bar
            dataKey="inRs"
            fill="var(--chart-3)"
            radius={[3, 3, 0, 0]}
            barSize={20}
            animationDuration={700}
          />
          <Bar
            dataKey="outRs"
            fill="var(--chart-1)"
            radius={[3, 3, 0, 0]}
            barSize={20}
            animationDuration={700}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
