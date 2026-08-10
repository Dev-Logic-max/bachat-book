import { cn } from "@/lib/utils";

/**
 * Skeletons are shaped like the layout they replace, never spinners.
 *
 * A spinner tells the user "something is happening"; a layout-shaped skeleton
 * tells them what is about to arrive and holds the scroll position so nothing
 * jumps when data lands. The shimmer honours reduced motion via the global
 * rule in globals.css.
 */
export function Skeleton({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("bg-surface-3 shimmer rounded-md", className)}
      {...rest}
    />
  );
}

/** One transaction/bill row: mark, two text lines, right-aligned amount. */
export function RowSkeleton() {
  return (
    <li className="flex items-center gap-3 px-5 py-2.5">
      <Skeleton className="size-[34px] rounded-full" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3 w-[42%]" />
        <Skeleton className="h-2.5 w-[26%]" />
      </div>
      <Skeleton className="h-3 w-16" />
    </li>
  );
}

export function PanelSkeleton({
  rows = 5,
  title = true,
}: {
  rows?: number;
  title?: boolean;
}) {
  return (
    <section className="bg-surface border-border rounded-panel border shadow-sm">
      {title && (
        <header className="flex items-center justify-between px-5 pb-3 pt-4">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-16" />
        </header>
      )}
      <ul className="divide-border divide-y pb-2">
        {Array.from({ length: rows }, (_, i) => (
          <RowSkeleton key={i} />
        ))}
      </ul>
    </section>
  );
}

/** The hero band plus its overlapping KPI row, at their real dimensions. */
export function HeroSkeleton() {
  return (
    <section className="pb-[68px]">
      <div className="bg-navy-900 rounded-modal px-5 pb-56 pt-6 sm:px-8 sm:pb-44 sm:pt-7">
        <Skeleton className="h-2.5 w-32 bg-white/10" />
        <Skeleton className="mt-3 h-10 w-64 bg-white/10" />
        <Skeleton className="mt-4 h-4 w-48 bg-white/10" />
      </div>
      <div className="relative z-10 -mt-17 -mb-17 grid grid-cols-2 gap-3 px-4 sm:gap-4 sm:px-6 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="bg-surface rounded-card px-5 py-4 shadow-md">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="mt-2.5 h-6 w-28" />
            <Skeleton className="mt-2.5 h-2.5 w-24" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function ChartSkeleton({ height = 300 }: { height?: number }) {
  // Varied bar heights — a row of equal blocks reads as a broken chart.
  const heights = [62, 78, 45, 88, 56, 71, 40, 83, 52, 66, 74, 48];
  return (
    <div className="flex items-end gap-3" style={{ height }}>
      {heights.map((h, i) => (
        <Skeleton key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}
