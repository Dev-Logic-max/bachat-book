"use client";

import * as React from "react";
import { Copy, Link2, Mail, Trash2, UserPlus } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { RichSelect } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { useSession } from "@/components/session-provider";
import { createClient } from "@/lib/supabase/client";
import { formatName } from "@/lib/format";
import { formatLimit, isUnlimited } from "@/lib/plan";
import { cn } from "@/lib/utils";

import type { HouseholdRole, Tables } from "@/lib/supabase/types";

type MemberRow = {
  id: string;
  user_id: string;
  role: HouseholdRole;
  profile: Tables<"profiles"> | null;
};

const ROLE_OPTIONS = [
  {
    value: "member",
    label: "Member",
    description: "Can add and edit entries, accounts and tasks",
  },
  {
    value: "viewer",
    label: "Viewer",
    description: "Can see everything, cannot change anything",
  },
];

/**
 * Who is in this workspace, and how to add someone.
 *
 * Two routes in, because both happen: a shareable link for someone without an
 * account (sent over WhatsApp), and adding an existing account by email. The
 * seat limit is enforced by a database trigger — this panel only makes the
 * ceiling visible before someone hits it.
 */
export function WorkspaceMembers({
  householdId,
  isOwner,
  memberLimit,
  isActive,
  onChanged,
}: {
  householdId: string;
  isOwner: boolean;
  memberLimit: number;
  isActive: boolean;
  onChanged: () => void;
}) {
  const session = useSession();
  const supabase = createClient();
  const { showToast } = useToast();

  const [members, setMembers] = React.useState<MemberRow[] | null>(null);
  const [invites, setInvites] = React.useState<Tables<"household_invitations">[]>([]);
  const [reload, setReload] = React.useState(0);

  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<HouseholdRole>("member");
  const [busy, setBusy] = React.useState(false);
  const [linkJustMade, setLinkJustMade] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;

    async function load() {
      const [m, i] = await Promise.all([
        supabase
          .from("household_members")
          .select("id, user_id, role, profiles(*)")
          .eq("household_id", householdId),
        supabase
          .from("household_invitations")
          .select("*")
          .eq("household_id", householdId)
          .is("accepted_at", null)
          .is("revoked_at", null),
      ]);

      if (!active) return;

      if (m.error) {
        showToast({
          type: "error",
          title: "Could not load members",
          description: m.error.message,
        });
        setMembers([]);
      } else {
        setMembers(
          (m.data ?? []).map((row) => {
            const r = row as unknown as {
              id: string;
              user_id: string;
              role: HouseholdRole;
              profiles: Tables<"profiles"> | null;
            };
            return { id: r.id, user_id: r.user_id, role: r.role, profile: r.profiles };
          }),
        );
      }

      setInvites(i.data ?? []);
    }

    load();
    return () => {
      active = false;
    };
  }, [householdId, supabase, reload, showToast]);

  const refresh = () => {
    setReload((n) => n + 1);
    onChanged();
  };

  const used = (members?.length ?? 0) + invites.length;
  const full = !isUnlimited(memberLimit) && used >= memberLimit;

  const copy = async (token: string) => {
    const url = `${window.location.origin}/join/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast({ type: "success", title: "Invite link copied", description: url });
    } catch {
      // Clipboard is blocked without a user gesture in some browsers, and an
      // invite the owner cannot retrieve is worse than an ugly toast.
      showToast({ type: "info", title: "Copy this link", description: url });
    }
  };

  const createLink = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("create_invitation", {
      _household_id: householdId,
      _role: role,
    });
    setBusy(false);

    if (error) {
      showToast({ type: "error", title: "Could not create invite", description: error.message });
      return;
    }
    setLinkJustMade(data as string);
    refresh();
  };

  const addByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setBusy(true);
    const { data, error } = await supabase.rpc("add_member_by_email", {
      _household_id: householdId,
      _email: email.trim(),
      _role: role,
    });
    setBusy(false);

    if (error) {
      showToast({ type: "error", title: "Could not add member", description: error.message });
      return;
    }

    const res = data as { ok: boolean; result: string; token?: string };
    if (res.result === "added") {
      showToast({ type: "success", title: "Member added", description: `${email} now has access.` });
      setEmail("");
      setInviteOpen(false);
      refresh();
    } else if (res.result === "already_member") {
      showToast({ type: "info", title: "Already a member", description: `${email} is already here.` });
    } else if (res.result === "invite_link" && res.token) {
      // No account on that address yet — hand back a link rather than failing.
      setLinkJustMade(res.token);
      refresh();
    }
  };

  const removeMember = async (row: MemberRow) => {
    const { error } = await supabase.from("household_members").delete().eq("id", row.id);
    if (error) {
      showToast({ type: "error", title: "Could not remove member", description: error.message });
      return;
    }
    showToast({ type: "success", title: "Member removed" });
    refresh();
  };

  const revokeInvite = async (id: string) => {
    const { error } = await supabase
      .from("household_invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      showToast({ type: "error", title: "Could not revoke invite", description: error.message });
      return;
    }
    refresh();
  };

  return (
    <div className="bg-surface border-border rounded-panel border p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold">People</h3>
          <p className="text-muted text-xs">
            {used} of {formatLimit(memberLimit)} seats used
            {full && " · all taken"}
          </p>
        </div>

        {isOwner && (
          <Button
            variant="secondary"
            size="sm"
            disabled={!isActive || full}
            title={
              !isActive
                ? "This workspace is view-only"
                : full
                  ? "Every seat on this plan is taken"
                  : undefined
            }
            onClick={() => {
              setLinkJustMade(null);
              setInviteOpen(true);
            }}
          >
            <UserPlus size={14} className="me-1.5" />
            Invite
          </Button>
        )}
      </div>

      <ul className="mt-4 space-y-1.5">
        {members === null ? (
          <li className="text-muted text-xs">Loading…</li>
        ) : (
          members.map((m) => {
            const name = m.profile
              ? formatName(m.profile.first_name, m.profile.last_name)
              : "Unknown";
            const isMe = m.user_id === session.user.id;
            return (
              <li
                key={m.id}
                className="border-border flex items-center gap-3 rounded-card border p-2.5"
              >
                <Avatar name={name} src={m.profile?.avatar_url ?? undefined} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="text-foreground block truncate text-[12.5px] font-medium">
                    {name}
                    {isMe && <span className="text-faint font-normal"> · you</span>}
                  </span>
                  <span className="text-faint block truncate text-[11px]">
                    {m.profile?.email}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                    m.role === "owner"
                      ? "bg-brass-soft text-brass-strong"
                      : "bg-surface-subtle text-muted",
                  )}
                >
                  {m.role}
                </span>
                {isOwner && m.role !== "owner" && isActive && (
                  <button
                    type="button"
                    onClick={() => removeMember(m)}
                    aria-label={`Remove ${name}`}
                    className="text-faint hover:text-loss shrink-0 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            );
          })
        )}

        {invites.map((inv) => (
          <li
            key={inv.id}
            className="border-border border-dashed flex items-center gap-3 rounded-card border p-2.5"
          >
            <span className="bg-surface-subtle text-faint flex size-7 shrink-0 items-center justify-center rounded-full">
              <Link2 size={13} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-foreground-2 block truncate text-[12.5px]">
                {inv.email || "Invite link"}
              </span>
              <span className="text-faint block text-[11px]">
                Pending · {inv.role} · expires{" "}
                {new Date(inv.expires_at).toLocaleDateString("en-GB")}
              </span>
            </span>
            {isOwner && (
              <>
                <button
                  type="button"
                  onClick={() => copy(inv.token)}
                  aria-label="Copy invite link"
                  className="text-faint hover:text-brass-strong shrink-0 transition-colors"
                >
                  <Copy size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => revokeInvite(inv.id)}
                  aria-label="Revoke invite"
                  className="text-faint hover:text-loss shrink-0 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      <Modal
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite someone"
        subtitle="Send a link, or add an account by email"
        onSubmit={addByEmail}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setInviteOpen(false)}>
              Close
            </Button>
            <Button type="submit" variant="primary" isLoading={busy}>
              <Mail size={14} className="me-1.5" />
              Add by email
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <RichSelect
            label="Their role"
            value={role}
            onChange={(v) => setRole(v as HouseholdRole)}
            options={ROLE_OPTIONS}
            hint="A viewer can read everything but cannot change anything."
          />

          <Input
            label="Email address"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <div className="border-border bg-surface-subtle rounded-card border p-3">
            <p className="text-foreground text-[12.5px] font-medium">Or send a link</p>
            <p className="text-faint mt-0.5 text-[11px] leading-snug">
              Works for someone without an account yet. Single use, expires in 7 days.
            </p>

            {linkJustMade ? (
              <div className="mt-2.5 flex items-center gap-2">
                <code className="bg-surface border-border text-foreground-2 min-w-0 flex-1 truncate rounded-control border px-2 py-1.5 text-[11px]">
                  {`${typeof window !== "undefined" ? window.location.origin : ""}/join/${linkJustMade}`}
                </code>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => copy(linkJustMade)}
                >
                  <Copy size={13} className="me-1" />
                  Copy
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-2.5"
                isLoading={busy}
                onClick={createLink}
              >
                <Link2 size={13} className="me-1.5" />
                Create invite link
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
