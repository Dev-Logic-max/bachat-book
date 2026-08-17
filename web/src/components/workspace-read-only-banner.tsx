"use client";

import Link from "next/link";
import { EyeOff } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { formatLimit } from "@/lib/plan";

/**
 * Says out loud that this workspace cannot be written to.
 *
 * Without it the page looks entirely normal — Add Entry, Add Task and every
 * edit control are still there — and the first thing the user learns is a raw
 * "row violates row-level security policy" when they try to save. The rule is
 * enforced in the database on purpose, so the interface has to explain it
 * before someone hits it rather than after.
 *
 * It also has to say the data is safe. A workspace that stops accepting edits
 * reads as a workspace that lost its records, and that is the wrong thing to
 * believe about your own ledger.
 */
export function WorkspaceReadOnlyBanner() {
  const session = useSession();
  const ws = session?.workspace;

  if (!ws || ws.is_active) return null;

  const isOwner = ws.owner_id === session.user.id;

  return (
    <div
      role="status"
      className="border-loss/25 bg-loss-soft mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-card border px-3.5 py-2.5"
    >
      <span className="text-loss flex shrink-0 items-center gap-1.5 text-[12px] font-semibold">
        <EyeOff size={14} />
        View only
      </span>

      <p className="text-foreground-2 min-w-0 flex-1 text-[12px] leading-snug">
        {isOwner ? (
          <>
            Your plan covers {formatLimit(ws.workspace_limit)} workspaces, and this
            one is beyond that. Everything in it is safe and still readable — it
            just cannot be edited until you upgrade.
          </>
        ) : (
          <>
            This workspace is beyond its owner&apos;s plan, so it is readable but
            cannot be edited. Nothing in it has been lost.
          </>
        )}
      </p>

      {isOwner && (
        <Link
          href="/settings/plan"
          className="bg-navy-900 text-on-navy shrink-0 rounded-control px-3 py-1.5 text-[11.5px] font-semibold transition-opacity hover:opacity-90"
        >
          Upgrade
        </Link>
      )}
    </div>
  );
}
