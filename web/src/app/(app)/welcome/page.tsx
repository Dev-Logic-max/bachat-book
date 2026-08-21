"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { ProfileFields } from "@/components/profile-fields";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { provinceForCity } from "@/lib/pk-geo";
import {
  hasErrors,
  toE164,
  validateProfile,
  type ProfileDraft,
  type ProfileErrors,
} from "@/lib/profile-fields";

export default function WelcomePage() {
  const session = useSession();
  const router = useRouter();
  const search = useSearchParams();
  const { showToast } = useToast();
  const supabase = createClient();

  /*
    Preview mode for the admin console.

    A super admin needs to see what a new user meets, and the only honest way to
    do that is to render the real screen. So it renders the REAL screen with
    every write path switched off — previewing must never overwrite the admin's
    own profile, which is exactly what would happen if this just reused the live
    form.
  */
  const isPreview = search.get("preview") === "1";

  const [draft, setDraft] = React.useState<ProfileDraft>(() => ({
    firstName: session.profile?.first_name ?? "",
    lastName: session.profile?.last_name ?? "",
    phone: session.profile?.phone ?? "",
    province:
      session.profile?.province ?? provinceForCity(session.profile?.city) ?? "",
    city: session.profile?.city ?? "",
    occupationCode: session.profile?.occupation_code ?? "",
    occupationOther: session.profile?.occupation_code === "other"
      ? (session.profile?.occupation ?? "")
      : "",
  }));

  const [isFiler, setIsFiler] = React.useState(session.preferences?.is_filer ?? false);
  const [errors, setErrors] = React.useState<ProfileErrors>({});
  const [loading, setLoading] = React.useState(false);

  const firstName = draft.firstName || "friend";

  const patch = (p: Partial<ProfileDraft>) => {
    setDraft((d) => ({ ...d, ...p }));
    // Clear only the fields being edited, so errors from a failed submit do not
    // all vanish the moment one character is typed somewhere else.
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(p)) delete next[k as keyof ProfileErrors];
      return next;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPreview) return;

    const found = validateProfile(draft);
    setErrors(found);
    if (hasErrors(found)) {
      showToast({
        type: "error",
        title: "Check the highlighted fields",
        description: "A few details still need fixing.",
      });
      return;
    }

    setLoading(true);

    const occupation =
      draft.occupationCode === "other"
        ? draft.occupationOther.trim()
        : draft.occupationCode
          ? null
          : null;

    const [{ error: profileErr }, { error: prefErr }] = await Promise.all([
      supabase
        .from("profiles")
        .update({
          first_name: draft.firstName.trim(),
          last_name: draft.lastName.trim() || null,
          phone: draft.phone.trim() ? toE164(draft.phone) : null,
          province: draft.province,
          city: draft.city,
          occupation_code: draft.occupationCode || null,
          occupation,
        })
        .eq("id", session.user.id),
      supabase.from("preferences").update({ is_filer: isFiler }).eq("user_id", session.user.id),
    ]);

    setLoading(false);

    if (profileErr || prefErr) {
      showToast({
        type: "error",
        title: "Could not save your details",
        description: profileErr?.message || prefErr?.message,
      });
      return;
    }

    showToast({
      type: "success",
      title: "Welcome to Bachat Book",
      description: "Your workspace is set up.",
    });
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-xl py-4">
      {isPreview && (
        <div className="border-brass/30 bg-brass-soft text-brass-strong mb-4 flex items-center gap-2.5 rounded-card border px-3.5 py-2.5">
          <Eye size={15} className="shrink-0" />
          <p className="text-[12px] leading-snug">
            Preview of what a new user sees. Every field is disabled and nothing
            here can be saved.
          </p>
        </div>
      )}

      <div className="bg-surface border-border rounded-panel border p-6 shadow-xl sm:p-8">
        <div className="flex flex-col items-center text-center">
          {/*
            The transparent WebP, not the 5.2 MB PNG this used to load for a
            128px box. `mix-blend-multiply` went with it: it was only ever there
            to knock the white background out of an opaque render, and applied
            to a real cut-out it muddies every mid-tone.
          */}
          <div className="relative mb-4 size-36">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/art/empty-shop.webp"
              alt=""
              className="size-full object-contain"
            />
          </div>

          <p className="text-brass-strong text-xs font-semibold uppercase tracking-widest">
            Welcome to Bachat Book
          </p>
          <h1 className="font-display mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Assalam-o-Alaikum, {firstName}
          </h1>
          <p className="text-muted mt-2 max-w-md text-xs leading-relaxed">
            A few details so the tax year, Zakat nisab and reminders line up with
            where you actually live.
          </p>
        </div>

        <form onSubmit={handleSave} className="mt-8 space-y-5">
          <ProfileFields
            draft={draft}
            errors={errors}
            onChange={patch}
            disabled={isPreview}
          />

          <div className="bg-surface-subtle border-border rounded-card border p-4">
            <Toggle
              checked={isFiler}
              onChange={setIsFiler}
              label="FBR Active Tax Filer"
              description="Turn on if you are on the FBR Active Taxpayer List. Non-filers pay higher withholding on almost everything."
            />
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              isLoading={loading}
              disabled={isPreview}
            >
              Get started
            </Button>

            {!isPreview && (
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="text-muted hover:text-foreground py-1 text-center text-xs font-medium"
              >
                Skip for now
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
