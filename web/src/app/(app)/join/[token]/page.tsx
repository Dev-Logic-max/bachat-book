"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, Check, User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useSession } from "@/components/session-provider";
import { createClient } from "@/lib/supabase/client";

import type { HouseholdKind } from "@/lib/supabase/types";

type Preview = {
  found: boolean;
  household_name?: string;
  household_kind?: HouseholdKind;
  role?: string;
  invited_by?: string;
  expired?: boolean;
  used?: boolean;
  already_member?: boolean;
};

const KIND_ICON: Record<HouseholdKind, typeof User> = {
  personal: User,
  family: Users,
  business: Building2,
};

/**
 * Where an invite link lands.
 *
 * It sits inside the (app) group on purpose: that layout already redirects a
 * signed-out visitor to /sign-in, so following a link without an account takes
 * you to sign up first and back here after — rather than showing a stranger who
 * invited whom.
 *
 * The preview is read through an RPC, not a table query. An invitee is not a
 * member of the workspace yet, so RLS gives them nothing; the RPC is
 * SECURITY DEFINER and returns only the workspace name, the role and who sent
 * it — never anything inside.
 */
export default function JoinPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const router = useRouter();
  const session = useSession();
  const supabase = createClient();
  const { showToast } = useToast();

  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [joining, setJoining] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    supabase.rpc("invitation_preview", { _token: token }).then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setPreview({ found: false });
        return;
      }
      setPreview(data as Preview);
    });
    return () => {
      active = false;
    };
  }, [token, supabase]);

  const accept = async () => {
    setJoining(true);
    const { data, error } = await supabase.rpc("accept_invitation", { _token: token });
    setJoining(false);

    if (error) {
      showToast({ type: "error", title: "Could not join", description: error.message });
      return;
    }

    const res = data as { ok: boolean; reason: string; household_id?: string };
    if (!res.ok) {
      showToast({
        type: "error",
        title: "This invite cannot be used",
        description:
          res.reason === "expired"
            ? "It has expired. Ask for a new one."
            : res.reason === "used"
              ? "It has already been used."
              : res.reason === "revoked"
                ? "It was cancelled by the workspace owner."
                : "It could not be found.",
      });
      return;
    }

    // Switching the default workspace is what makes the app actually open in
    // the one you just joined; router.refresh re-runs the server layout.
    if (res.household_id) {
      await supabase
        .from("preferences")
        .update({ default_household_id: res.household_id })
        .eq("user_id", session.user.id);
    }

    showToast({
      type: "success",
      title: res.reason === "already_member" ? "You are already in" : "You have joined",
      description: preview?.household_name,
    });

    router.push("/dashboard");
    router.refresh();
  };

  if (!preview) {
    return (
      <div className="mx-auto max-w-md py-10">
        <div className="bg-surface border-border rounded-panel shimmer h-56 border" />
      </div>
    );
  }

  const invalid =
    !preview.found || preview.expired || (preview.used && !preview.already_member);

  const Icon = preview.household_kind ? KIND_ICON[preview.household_kind] : Users;

  return (
    <div className="mx-auto max-w-md py-10">
      <div className="bg-surface border-border rounded-panel border p-6 text-center shadow-xs sm:p-8">
        {invalid ? (
          <>
            <h1 className="font-display text-xl font-semibold">
              This invitation cannot be used
            </h1>
            <p className="text-muted mt-2 text-[13px] leading-relaxed">
              {!preview.found
                ? "The link is not valid. Check you copied all of it."
                : preview.expired
                  ? "It has expired. Ask whoever invited you to send a new one."
                  : "It has already been used."}
            </p>
            <Link
              href="/dashboard"
              className="text-brass-strong mt-5 inline-block text-[13px] font-semibold hover:underline"
            >
              Go to Overview
            </Link>
          </>
        ) : (
          <>
            <span className="bg-brass-soft text-brass-strong mx-auto mb-4 flex size-14 items-center justify-center rounded-full">
              <Icon size={24} strokeWidth={1.5} />
            </span>

            <p className="text-faint text-[11px] font-semibold uppercase tracking-[0.14em]">
              {preview.already_member ? "You are already in" : "You have been invited to"}
            </p>
            <h1 className="font-display mt-1.5 text-2xl font-semibold tracking-tight">
              {preview.household_name}
            </h1>

            <p className="text-muted mt-2.5 text-[13px] leading-relaxed">
              {preview.invited_by ? `${preview.invited_by} invited you ` : "You were invited "}
              as a <strong className="text-foreground-2 font-semibold">{preview.role}</strong>.
              {preview.role === "viewer"
                ? " You will be able to see everything in this workspace, but not change it."
                : " You will be able to add and edit entries, accounts and tasks."}
            </p>

            <Button
              variant="primary"
              size="lg"
              className="mt-6 w-full"
              isLoading={joining}
              onClick={accept}
            >
              <Check size={16} className="me-1.5" />
              {preview.already_member ? "Open this workspace" : "Join workspace"}
            </Button>

            <p className="text-faint mt-3 text-[11px]">
              Signed in as {session.user.email}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
