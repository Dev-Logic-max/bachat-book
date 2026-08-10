"use client";

import * as React from "react";
import { useSession } from "@/components/session-provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AvatarUpload } from "@/components/avatar-upload";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { formatName } from "@/lib/format";

export default function ProfileSettingsPage() {
  const session = useSession();
  const { showToast } = useToast();
  const supabase = createClient();

  const [firstName, setFirstName] = React.useState(session.profile?.first_name || "");
  const [lastName, setLastName] = React.useState(session.profile?.last_name || "");
  const [phone, setPhone] = React.useState(session.profile?.phone || "");
  const [city, setCity] = React.useState(session.profile?.city || "");
  const [occupation, setOccupation] = React.useState(session.profile?.occupation || "");
  const [loading, setLoading] = React.useState(false);

  const fullName = formatName(firstName, lastName);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        phone: phone.trim() || null,
        city: city.trim() || null,
        occupation: occupation.trim() || null,
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
          <Input
            label="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>

        <Input
          label="Email address"
          value={session.user.email}
          disabled
          className="bg-surface-subtle opacity-75"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Phone Number"
            placeholder="e.g. +92 300 1234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Input
            label="City"
            placeholder="e.g. Lahore"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>

        <Input
          label="Occupation"
          placeholder="e.g. Financial Consultant"
          value={occupation}
          onChange={(e) => setOccupation(e.target.value)}
        />

        <div className="flex justify-end pt-4">
          <Button type="submit" variant="primary" isLoading={loading}>
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
