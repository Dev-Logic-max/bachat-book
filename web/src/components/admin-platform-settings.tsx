"use client";

import * as React from "react";
import { AlertTriangle, Check, KeyRound, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { RichSelect } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";

import type { Json } from "@/lib/supabase/types";

type EmailSettings = {
  provider: string;
  from_name: string;
  from_email: string;
  reply_to: string;
  enabled: boolean;
};

type BillingSettings = {
  gateway: string;
  gateway_live: boolean;
  support_phone: string;
  support_email: string;
};

const PROVIDERS = [
  { value: "resend", label: "Resend", description: "Simple API, good deliverability, generous free tier" },
  { value: "postmark", label: "Postmark", description: "Strong transactional reputation" },
  { value: "ses", label: "Amazon SES", description: "Cheapest at volume, more setup" },
];

const GATEWAYS = [
  { value: "none", label: "Not connected", description: "Upgrades are granted by hand from the People tab" },
  { value: "jazzcash", label: "JazzCash", description: "Mobile wallet and card payments" },
  { value: "easypaisa", label: "Easypaisa", description: "Mobile wallet payments" },
  { value: "stripe", label: "Stripe", description: "Cards, for overseas customers" },
];

/**
 * Platform configuration, editable without a deploy.
 *
 * SECRETS ARE NOT HERE, deliberately. The provider API key lives in an
 * environment variable: this table is readable by any super_admin session, and
 * a stolen admin session should not also grant the ability to send mail as the
 * product. This screen reports whether the key is present and never displays it.
 */
export function AdminPlatformSettings({ emailKeyPresent }: { emailKeyPresent: boolean }) {
  const supabase = createClient();
  const { showToast } = useToast();

  const [email, setEmail] = React.useState<EmailSettings | null>(null);
  const [billing, setBilling] = React.useState<BillingSettings | null>(null);
  const [saving, setSaving] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    supabase
      .from("platform_settings")
      .select("*")
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          showToast({ type: "error", title: "Could not load settings", description: error.message });
          return;
        }
        for (const row of data ?? []) {
          if (row.key === "email") setEmail(row.value as unknown as EmailSettings);
          if (row.key === "billing") setBilling(row.value as unknown as BillingSettings);
        }
      });
    return () => {
      active = false;
    };
  }, [supabase, showToast]);

  const save = async (key: string, value: Json) => {
    setSaving(key);
    const { error } = await supabase
      .from("platform_settings")
      .update({ value })
      .eq("key", key);
    setSaving(null);

    if (error) {
      showToast({ type: "error", title: "Could not save", description: error.message });
      return;
    }
    showToast({ type: "success", title: "Saved" });
  };

  if (!email || !billing) {
    return <div className="bg-surface border-border shimmer rounded-panel h-64 border" />;
  }

  return (
    <div className="space-y-4">
      <div className="bg-surface border-border rounded-panel border p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold">Email</h3>
            <p className="text-muted text-xs">
              Used for reminders and subscription notices.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            disabled={saving === "email"}
            onClick={() => save("email", email as unknown as Json)}
          >
            {saving === "email" ? (
              <Loader2 size={14} className="me-1.5 animate-spin" />
            ) : (
              <Check size={14} className="me-1.5" />
            )}
            Save
          </Button>
        </div>

        {/*
          The one thing this screen cannot do is set the key. Say where it goes
          rather than leaving an operator hunting for a field that is missing on
          purpose.
        */}
        <div
          className={cnBox(emailKeyPresent)}
        >
          <span className="shrink-0">
            {emailKeyPresent ? <KeyRound size={15} /> : <AlertTriangle size={15} />}
          </span>
          <p className="text-[12px] leading-snug">
            {emailKeyPresent ? (
              <>
                API key detected. Keys are read from the{" "}
                <code className="text-[11px]">EMAIL_API_KEY</code> environment
                variable and never stored here.
              </>
            ) : (
              <>
                No API key set. Add <code className="text-[11px]">EMAIL_API_KEY</code>{" "}
                to the environment (Vercel → Settings → Environment Variables) and
                redeploy. Nothing will send until then.
              </>
            )}
          </p>
        </div>

        <div className="mt-4 space-y-4">
          <RichSelect
            label="Provider"
            value={email.provider}
            onChange={(v) => setEmail({ ...email, provider: v })}
            options={PROVIDERS}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="From name"
              value={email.from_name}
              onChange={(e) => setEmail({ ...email, from_name: e.target.value })}
              placeholder="Bachat Book"
            />
            <Input
              label="From address"
              type="email"
              value={email.from_email}
              onChange={(e) => setEmail({ ...email, from_email: e.target.value })}
              placeholder="noreply@yourdomain.pk"
            />
          </div>

          <Input
            label="Reply-to (optional)"
            type="email"
            value={email.reply_to}
            onChange={(e) => setEmail({ ...email, reply_to: e.target.value })}
            placeholder="support@yourdomain.pk"
          />

          <div className="border-border bg-surface-subtle rounded-card border p-3.5">
            <Toggle
              checked={email.enabled}
              onChange={(v) => setEmail({ ...email, enabled: v })}
              label="Send emails"
              description="Off until the domain is verified with SPF and DKIM. With this off, reminders are still computed and shown in the app — they just do not leave the browser."
            />
          </div>
        </div>
      </div>

      <div className="bg-surface border-border rounded-panel border p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold">Billing</h3>
            <p className="text-muted text-xs">
              While no gateway is connected, upgrades are granted by hand.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            disabled={saving === "billing"}
            onClick={() => save("billing", billing as unknown as Json)}
          >
            {saving === "billing" ? (
              <Loader2 size={14} className="me-1.5 animate-spin" />
            ) : (
              <Check size={14} className="me-1.5" />
            )}
            Save
          </Button>
        </div>

        <div className="mt-4 space-y-4">
          <RichSelect
            label="Payment gateway"
            value={billing.gateway}
            onChange={(v) => setBilling({ ...billing, gateway: v })}
            options={GATEWAYS}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Support phone"
              value={billing.support_phone}
              onChange={(e) => setBilling({ ...billing, support_phone: e.target.value })}
              placeholder="+92 300 1234567"
            />
            <Input
              label="Support email"
              type="email"
              value={billing.support_email}
              onChange={(e) => setBilling({ ...billing, support_email: e.target.value })}
              placeholder="billing@yourdomain.pk"
            />
          </div>

          <div className="border-border bg-surface-subtle rounded-card border p-3.5">
            <Toggle
              checked={billing.gateway_live}
              onChange={(v) => setBilling({ ...billing, gateway_live: v })}
              label="Gateway is live"
              description="Leave off until real credentials are in place. The checkout screen stays visible either way, and says plainly that it is not taking payments yet."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function cnBox(ok: boolean) {
  return [
    "mt-4 flex items-start gap-2.5 rounded-card border p-3",
    ok
      ? "border-gain/25 bg-gain-soft text-gain"
      : "border-brass/30 bg-brass-soft text-brass-strong",
  ].join(" ");
}
