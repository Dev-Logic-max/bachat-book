import * as React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { SessionProvider } from "@/components/session-provider";
import { ToastProvider } from "@/components/ui/toast";
import { AppRail } from "@/components/app-rail";
import { AppTopBar } from "@/components/app-top-bar";
import { BottomNav } from "@/components/bottom-nav";
import { WorkspaceReadOnlyBanner } from "@/components/workspace-read-only-banner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  return (
    <SessionProvider session={session}>
      <ToastProvider>
        {/*
         * `items-start` keeps the sticky rail from being stretched by a tall
         * <main>: a stretched flex item cannot stick.
         */}
        <div className="flex min-h-screen items-start">
          <AppRail session={session} />
          <BottomNav />

          {/*
            The content column: a full-bleed header band, then the padded page.

            The top bar used to sit INSIDE <main>, which meant <main>'s own
            `p-4 sm:p-6 lg:p-8` pushed it down by a different amount at every
            breakpoint and its rule stopped short of both edges. A header that
            is inset from the page it heads does not read as chrome. It is its
            own band now, flush to the top and full width, and <main> keeps
            ownership of page padding below it.
          */}
          <div className="flex min-h-screen min-w-0 flex-1 flex-col">
            {/*
              Above every page, at every width. The rail collapses on desktop
              and is absent below lg, so this is the only fixed home for the
              account control and the active workspace.
            */}
            <AppTopBar />

            {/*
             * SINGLE owner of page padding. Pages must not add their own outer
             * px/py — the dashboard did, which put its header and its body on
             * two different left edges.
             *
             * `pt-5` is constant while the sides stay responsive: the header
             * band already supplies the weight above its rule, so matching it
             * with 32px below would float the page off its own chrome.
             *
             * `pb-28 lg:pb-8` is bottom-nav clearance, not padding debt: below
             * lg the floating nav island sits over the last ~7rem of the page.
             */}
            <main className="mx-auto w-full min-w-0 max-w-[1600px] flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-8">
              {/*
                Only renders when the active workspace is past the plan's
                allowance. Above the page rather than inside it, because every
                module's write controls are affected, not one screen's.
              */}
              <WorkspaceReadOnlyBanner />
              {children}
            </main>
          </div>
        </div>
      </ToastProvider>
    </SessionProvider>
  );
}
