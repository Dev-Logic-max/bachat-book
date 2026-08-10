"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/session-provider";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";

const PAKISTAN_CITIES = [
  { value: "Karachi", label: "Karachi" },
  { value: "Lahore", label: "Lahore" },
  { value: "Islamabad", label: "Islamabad" },
  { value: "Rawalpindi", label: "Rawalpindi" },
  { value: "Faisalabad", label: "Faisalabad" },
  { value: "Peshawar", label: "Peshawar" },
  { value: "Quetta", label: "Quetta" },
  { value: "Multan", label: "Multan" },
  { value: "Sialkot", label: "Sialkot" },
  { value: "Hyderabad", label: "Hyderabad" },
  { value: "Other", label: "Other City" },
];

export default function WelcomePage() {
  const session = useSession();
  const router = useRouter();
  const { showToast } = useToast();
  const supabase = createClient();

  const [city, setCity] = React.useState(session.profile?.city || "Karachi");
  const [occupation, setOccupation] = React.useState(session.profile?.occupation || "");
  const [isFiler, setIsFiler] = React.useState(session.preferences?.is_filer ?? true);
  const [loading, setLoading] = React.useState(false);

  const firstName = session.profile?.first_name || "Friend";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Update profile
    const { error: profileErr } = await supabase
      .from("profiles")
      .update({ city, occupation: occupation.trim() || null })
      .eq("id", session.user.id);

    // Update preferences
    const { error: prefErr } = await supabase
      .from("preferences")
      .update({ is_filer: isFiler })
      .eq("user_id", session.user.id);

    setLoading(false);

    if (profileErr || prefErr) {
      showToast({
        type: "error",
        title: "Could not save details",
        description: profileErr?.message || prefErr?.message,
      });
      return;
    }

    showToast({
      type: "success",
      title: "Welcome to Bachat Book!",
      description: "Your financial profile has been set up.",
    });

    router.push("/dashboard");
  };

  return (
    /* No px/py — (app)/layout.tsx owns page padding. max-w-xl is a measure. */
    <div className="mx-auto max-w-xl py-4">
      <div className="bg-surface border-border rounded-panel border p-6 shadow-xl sm:p-8">
        {/* Header Art & Greeting */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-4 size-32 overflow-hidden rounded-card">
            <img
              src="/art/store.png"
              alt="Pakistani Store Diorama"
              className="size-full object-cover rounded-card mix-blend-multiply dark:mix-blend-normal"
            />
          </div>

          <p className="text-brass-strong text-xs font-semibold uppercase tracking-widest">
            Welcome to Bachat Book
          </p>
          <h1 className="font-display mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Assalam-o-Alaikum, {firstName}! 👋
          </h1>
          <p className="text-muted mt-2 text-xs leading-relaxed max-w-md">
            Let&apos;s personalize your financial workspace for tax calculation, nisab, and local currency conventions.
          </p>
        </div>

        <form onSubmit={handleSave} className="mt-8 space-y-5">
          <Select
            label="City in Pakistan"
            options={PAKISTAN_CITIES}
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />

          <Input
            label="Occupation or Business (Optional)"
            placeholder="e.g. Software Engineer / Retail Store Owner"
            value={occupation}
            onChange={(e) => setOccupation(e.target.value)}
          />

          <div className="bg-surface-subtle border-border rounded-card border p-4">
            <Toggle
              checked={isFiler}
              onChange={setIsFiler}
              label="FBR Active Tax Filer"
              description="Toggle on if you are registered as an Active Tax Filer on the FBR portal."
            />
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={loading}>
              Get Started
            </Button>

            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="text-muted hover:text-foreground text-center text-xs font-medium py-1"
            >
              Skip for now
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
