import { AppRail } from "@/components/app-rail";
import { BottomNav } from "@/components/bottom-nav";
import {
  ChartSkeleton,
  HeroSkeleton,
  PanelSkeleton,
  Skeleton,
} from "@/components/skeleton";

/**
 * Next renders this while the route's data resolves. It mirrors the real
 * layout exactly — same rail, same hero dimensions, same column split — so the
 * page does not reflow when content lands.
 */
export default function OverviewLoading() {
  return (
    <div className="flex min-h-screen">
      <AppRail />
      <BottomNav />

      <main className="min-w-0 flex-1">
        <header className="flex items-center justify-between gap-4 px-4 pb-5 pt-6 sm:px-6">
          <div className="space-y-2">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-3 w-72" />
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <Skeleton className="hidden h-9 w-64 rounded-full xl:block" />
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="h-9 w-20 rounded-full" />
          </div>
        </header>

        <div className="px-4 pb-28 sm:px-6 lg:pb-8">
          <HeroSkeleton />

          <div className="mt-6 grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
            <section className="bg-surface border-border rounded-panel border p-5 shadow-sm lg:col-span-2">
              <div className="flex items-center justify-between pb-4">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
              <ChartSkeleton />
            </section>
            <PanelSkeleton rows={6} />
          </div>

          <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <PanelSkeleton rows={9} />
            </div>
            <div className="flex flex-col gap-4">
              <PanelSkeleton rows={4} />
              <PanelSkeleton rows={2} />
              <PanelSkeleton rows={3} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
