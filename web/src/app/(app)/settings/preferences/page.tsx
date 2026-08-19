"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/session-provider";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { isFilerCardHidden, restoreFilerCard } from "@/components/app-rail";
import { APP_VERSION_LABEL } from "@/lib/version";
import {
  NO_INTEGRATIONS,
  loadIntegrations,
  setIntegration,
} from "@/lib/investment-actions";

export default function PreferencesSettingsPage() {
  const session = useSession();
  const router = useRouter();
  const { showToast } = useToast();
  const supabase = createClient();

  const [locale, setLocale] = React.useState<"en" | "ur">(() => {
    if (typeof document !== "undefined") {
      const cookies = document.cookie.split("; ");
      const locCookie = cookies.find((c) => c.startsWith("bb-locale="));
      if (locCookie) {
        const val = locCookie.split("=")[1];
        if (val === "ur" || val === "en") return val;
      }
    }
    return "en";
  });
  const [numberFormat, setNumberFormat] = React.useState<"lakh" | "western">(
    session.preferences?.number_format || "lakh",
  );
  const [nisabStandard, setNisabStandard] = React.useState(
    session.preferences?.nisab_standard || "silver",
  );
  // Non-filer until the ATL says otherwise — defaulting to Filer asserted a tax
  // status the user never claimed.
  const [isFiler, setIsFiler] = React.useState(
    session.preferences?.is_filer ?? false,
  );
  const [loading, setLoading] = React.useState(false);

  const handleLanguageChange = (newLocale: "en" | "ur") => {
    setLocale(newLocale);
    document.cookie = `bb-locale=${newLocale}; path=/; max-age=31536000`;
    router.refresh();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase
      .from("preferences")
      .update({
        number_format: numberFormat,
        nisab_standard: nisabStandard,
        is_filer: isFiler,
      })
      .eq("user_id", session.user.id);

    setLoading(false);

    if (error) {
      showToast({ type: "error", title: "Could not save preferences", description: error.message });
      return;
    }

    showToast({ type: "success", title: "Preferences updated", description: "Your settings have been saved." });
    router.refresh();
  };

  return (
    <div className="bg-surface border-border rounded-panel border p-5 shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <h3 className="font-display text-base font-semibold">Language & Region</h3>
          <p className="text-muted text-xs mt-0.5">
            The document structure remains LTR while text copy adapts.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 max-w-xs">
            <button
              type="button"
              onClick={() => handleLanguageChange("en")}
              className={`rounded-control py-2 text-xs font-semibold border transition-colors ${
                locale === "en"
                  ? "bg-navy-900 text-on-navy border-navy-900 dark:bg-brass dark:text-navy-900 dark:border-brass"
                  : "border-border bg-surface text-foreground hover:bg-surface-subtle"
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => handleLanguageChange("ur")}
              className={`rounded-control py-2 text-xs font-semibold border transition-colors ${
                locale === "ur"
                  ? "bg-navy-900 text-on-navy border-navy-900 dark:bg-brass dark:text-navy-900 dark:border-brass"
                  : "border-border bg-surface text-foreground hover:bg-surface-subtle"
              }`}
            >
              اردو (Urdu)
            </button>
          </div>
        </div>

        {/*
         * A theme control here as well as the rail: the rail is hidden below `lg`,
         * so on a phone this is the only way to switch mode.
         */}
        <div className="border-t border-border pt-5">
          <h3 className="font-display text-base font-semibold">Appearance</h3>
          <p className="text-muted text-xs mt-0.5">
            Light or dark surfaces. Brass stays the accent in both.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <ThemeToggle />
            <span className="text-muted text-xs">Switch between light and dark</span>
          </div>
        </div>

        <div className="border-t border-border pt-5">
          <Select
            label="Number Formatting Style"
            value={numberFormat}
            onChange={(e) => setNumberFormat(e.target.value as "lakh" | "western")}
            options={[
              { value: "lakh", label: "Pakistani / South Asian (1,25,000)" },
              { value: "western", label: "Western Standard (125,000)" },
            ]}
          />
        </div>

        <div className="border-t border-border pt-5">
          <Select
            label="Zakat Nisab Threshold Benchmark"
            value={nisabStandard}
            onChange={(e) => setNisabStandard(e.target.value)}
            options={[
              { value: "silver", label: "Silver Nisab (52.5 tola / 612.36g) — Recommended" },
              { value: "gold", label: "Gold Nisab (7.5 tola / 87.48g)" },
            ]}
          />
        </div>

        <div className="border-t border-border pt-5">
          <Toggle
            checked={isFiler}
            onChange={setIsFiler}
            label="FBR Active Tax Filer Status"
            description="Used to calculate withholding taxes on savings accounts, profits, and prize bonds."
          />
        </div>

        {/*
          The sidebar card's dismissal, put back where it can be undone.
          A control you can only turn off is a control you turn off once and then
          quietly resent — the X in the rail names this screen, and this is it.
          Not part of the form: it is a device preference in localStorage, so it
          takes effect on click rather than on Save, and saying so avoids the
          "I pressed Save and it did nothing" report.
        */}
        <div className="border-t border-border pt-5">
          <FilerCardPreference />
        </div>

        {/*
          The Wealth bridges. A household setting rather than a personal one —
          whether an investment debits the family's bank account is a fact about
          the workspace, not a display preference — so it saves on click and is
          deliberately OUTSIDE the form's Save button.
        */}
        <div className="border-t border-border pt-5">
          <WealthSyncPreferences />
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-border pt-5">
          <p className="text-faint ltr text-[11px]">Bachat Book {APP_VERSION_LABEL}</p>
          <Button type="submit" variant="primary" isLoading={loading}>
            Save Preferences
          </Button>
        </div>
      </form>
    </div>
  );
}

/**
 * Whether the Wealth modules write into the ledger.
 *
 * OFF is the default and the honest one. With a bridge shut, Investments,
 * Committee and Zakat keep their own records and touch no balance — which is
 * what you want on day one, when you are entering the gold you have owned for
 * ten years and the plot your father left you. Turning a bridge ON changes only
 * what happens NEXT: nothing is backfilled, because flipping one switch should
 * never swing a bank balance by lakhs with no screen able to say why.
 */
function WealthSyncPreferences() {
  const session = useSession();
  const supabase = createClient();
  const { showToast } = useToast();

  const householdId = session.household?.id || "";
  const readOnly = session.workspace ? !session.workspace.is_active : false;

  const [flags, setFlags] = React.useState(NO_INTEGRATIONS);
  const [loaded, setLoaded] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    if (!householdId) return;

    loadIntegrations(supabase, householdId)
      .then((next) => {
        if (!active) return;
        setFlags(next);
        setLoaded(true);
      })
      .catch(() => {
        // No row yet is the normal state, and any other failure must still let
        // the rest of this page render. All-false is the correct fallback.
        if (active) setLoaded(true);
      });

    return () => {
      active = false;
    };
  }, [householdId, supabase]);

  const toggle = async (key: keyof typeof NO_INTEGRATIONS, next: boolean) => {
    setBusy(key);
    const previous = flags;
    setFlags({ ...flags, [key]: next });

    try {
      await setIntegration(supabase, householdId, { [key]: next });
      showToast({
        type: "success",
        title: next ? "Syncing on" : "Syncing off",
        description: next
          ? "New records from here on will name an account and move real money. Nothing already recorded has changed."
          : "Records from here on stay inside their own module. Anything already linked stays linked.",
      });
    } catch (err) {
      setFlags(previous);
      showToast({
        type: "error",
        title: "Could not change it",
        description: err instanceof Error ? err.message : "Something went wrong.",
      });
    } finally {
      setBusy(null);
    }
  };

  const ROWS: {
    key: keyof typeof NO_INTEGRATIONS;
    label: string;
    description: string;
  }[] = [
    {
      key: "sync_investments",
      label: "Investments",
      description:
        "Buying a holding comes out of the account you name, and profit received lands in it. Recorded as savings moving, never as spending.",
    },
    {
      key: "sync_committees",
      label: "Committee (BC)",
      description:
        "Each monthly instalment leaves your account and your payout arrives in it. Neither counts as income or expense — a committee always returns your own money.",
    },
    {
      key: "sync_zakat",
      label: "Zakat payments",
      description:
        "Logging a payment to Edhi or a madrassa also writes a real expense entry, so the money leaving your account is accounted for.",
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-base font-semibold">
          Sync Wealth to my ledger
        </h3>
        <p className="text-muted mt-0.5 text-xs leading-relaxed">
          Off by default. Your Wealth modules keep their own records and change
          no bank balance until you turn one of these on — and turning one on
          only affects what you record afterwards.
        </p>
      </div>

      {ROWS.map((row) => (
        <Toggle
          key={row.key}
          checked={flags[row.key]}
          onChange={(next) => {
            if (!readOnly && loaded && busy === null) void toggle(row.key, next);
          }}
          label={row.label}
          description={row.description}
        />
      ))}

      {readOnly && (
        <p className="text-faint text-[11px]">
          This workspace is read-only on your current plan, so these cannot be
          changed here.
        </p>
      )}
    </div>
  );
}

/** Show-again control for the rail's FBR card. Applies immediately. */
function FilerCardPreference() {
  /*
   * `useSyncExternalStore` with a `false` server snapshot — reading
   * localStorage during render would mismatch the server, and React Compiler
   * rejects the setState-in-useEffect version of this.
   */
  const hidden = React.useSyncExternalStore(
    (onChange) => {
      window.addEventListener("bb-filer-card-change", onChange);
      window.addEventListener("storage", onChange);
      return () => {
        window.removeEventListener("bb-filer-card-change", onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    () => isFilerCardHidden(),
    () => false,
  );

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-foreground text-[13px] font-medium">
          FBR status card in the sidebar
        </p>
        <p className="text-muted mt-0.5 text-[11.5px] leading-snug">
          {hidden
            ? "Hidden on this device. It shows whether you are on the Active Taxpayer List and what that costs you."
            : "Shown at the bottom of the sidebar. You can hide it from the card itself."}
        </p>
      </div>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => (hidden ? restoreFilerCard() : undefined)}
        disabled={!hidden}
        className="shrink-0"
      >
        {hidden ? "Show it again" : "Showing"}
      </Button>
    </div>
  );
}
