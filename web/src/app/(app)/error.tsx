"use client";

import * as React from "react";
import { LayoutDashboard, RotateCcw, TriangleAlert } from "lucide-react";
import { StatusButton, StatusLink, StatusPage } from "@/components/status-page";

/**
 * Crash boundary INSIDE the app shell.
 *
 * Separate from `app/error.tsx` on purpose: this one renders within
 * `(app)/layout.tsx`, so the rail and bottom nav survive and the user is still
 * somewhere rather than nowhere. Losing the whole chrome is what turns a broken
 * panel into a broken product.
 */
export default function AppSectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("App route error:", error);
  }, [error]);

  return (
    <StatusPage
      code="Something broke"
      icon={TriangleAlert}
      tone="loss"
      title="This screen could not be shown"
      description="Your accounts and entries are untouched — nothing was written. The rest of the app still works, so you can carry on from anywhere in the sidebar."
      detail={error.digest ? `Reference ${error.digest}` : error.message || undefined}
      actions={
        <>
          <StatusButton onClick={reset}>
            <RotateCcw size={15} />
            Try again
          </StatusButton>
          <StatusLink href="/dashboard">
            <LayoutDashboard size={15} />
            Go to Overview
          </StatusLink>
        </>
      }
    />
  );
}
