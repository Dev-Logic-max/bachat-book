import * as React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { SessionProvider } from "@/components/session-provider";
import { ToastProvider } from "@/components/ui/toast";
import { AppRail } from "@/components/app-rail";
import { BottomNav } from "@/components/bottom-nav";

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
           * This element is the SINGLE owner of page padding. Pages must not add
           * their own outer px/py — the dashboard did, which put its header and
           * its body on two different left edges.
           *
           * `pb-28 lg:pb-8` is bottom-nav clearance, not padding debt: below lg
           * the floating nav island sits over the last ~7rem of the page.
           */}
          <main className="mx-auto min-w-0 max-w-[1600px] flex-1 p-4 pb-28 sm:p-6 sm:pb-28 lg:p-8 lg:pb-8 w-full">
            {children}
          </main>
        </div>
      </ToastProvider>
    </SessionProvider>
  );
}
