"use client";

import * as React from "react";
import { useSession } from "@/components/session-provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AvatarUpload } from "@/components/avatar-upload";
import { ProfileFields } from "@/components/profile-fields";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { formatName } from "@/lib/format";
import { provinceForCity } from "@/lib/pk-geo";
import {
  hasErrors,
  toE164,
  validateProfile,
  type ProfileDraft,
  type ProfileErrors,
} from "@/lib/profile-fields";

export default function ProfileSettingsPage() {
  const session = useSession();
  const { showToast } = useToast();
  const supabase = createClient();

  const [draft, setDraft] = React.useState<ProfileDraft>(() => ({
    firstName: session.profile?.first_name ?? "",
    lastName: session.profile?.last_name ?? "",
    phone: session.profile?.phone ?? "",
    // Rows created before `province` existed carry only a city name, so the
    // province is inferred rather than shown blank on a profile already filled.
    province: session.profile?.province ?? provinceForCity(session.profile?.city) ?? "",
    city: session.profile?.city ?? "",
    occupationCode: session.profile?.occupation_code ?? "",
    occupationOther:
      session.profile?.occupation_code === "other"
        ? (session.profile?.occupation ?? "")
        : "",
  }));

  const [errors, setErrors] = React.useState<ProfileErrors>({});
  const [loading, setLoading] = React.useState(false);

  const fullName = formatName(draft.firstName, draft.lastName);

  const patch = (p: Partial<ProfileDraft>) => {
    setDraft((d) => ({ ...d, ...p }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(p)) delete next[k as keyof ProfileErrors];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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

    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: draft.firstName.trim(),
        last_name: draft.lastName.trim() || null,
        phone: draft.phone.trim() ? toE164(draft.phone) : null,
        province: draft.province,
        city: draft.city,
        occupation_code: draft.occupationCode || null,
        occupation:
          draft.occupationCode === "other" ? draft.occupationOther.trim() : null,
      })
      .eq("id", session.user.id);

    setLoading(false);

    if (error) {
      showToast({ type: "error", title: "Could not update profile", description: error.message });
      return;
    }
    showToast({ type: "success", title: "Profile updated", description: "Your details have been saved." });
  };

  return (
    <div className="bg-surface border-border rounded-panel border p-5 shadow-sm">
      <div className="border-border space-y-5 border-b pb-6">
        <div>
          <h2 className="font-display text-lg font-semibold">{fullName}</h2>
          <p className="text-muted text-xs">{session.user.email}</p>
        </div>
        <AvatarUpload
          userId={session.user.id}
          name={fullName}
          avatarUrl={session.profile?.avatar_url ?? null}
        />
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <ProfileFields draft={draft} errors={errors} onChange={patch} />

        {/* Email is managed by the auth provider, not here. */}
        <Input
          label="Email address"
          value={session.user.email}
          disabled
          className="bg-surface-subtle opacity-75"
          hint="Change this from your sign-in provider."
        />

        <div className="flex justify-end pt-4">
          <Button type="submit" variant="primary" isLoading={loading}>
            Save changes
          </Button>
        </div>
      </form>
    </div>
  );
}
