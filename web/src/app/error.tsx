"use client";

import * as React from "react";
import { LayoutDashboard, RotateCcw, TriangleAlert } from "lucide-react";
import { StatusButton, StatusLink, StatusPage } from "@/components/status-page";

/**
 * Route-level crash boundary.
 *
 * The one thing this page must do is stop the user wondering whether their money
 * is safe. A render error is a display fault — nothing was written — and the copy
 * says so before it offers a retry.
 *
 * `digest` is Next's hash of the server-side error. It is the only string worth
 * showing: it is what a log search matches on, and it leaks nothing.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Until a reporter is wired up, the console is the record.
    console.error("Route error:", error);
  }, [error]);

  return (
    <StatusPage
      code="Something broke"
      icon={TriangleAlert}
      tone="loss"
      title="This screen could not be shown"
      description="Your accounts and entries are untouched — this is a display fault, not a lost record. Trying again usually works."
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
