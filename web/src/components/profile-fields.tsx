"use client";

import * as React from "react";
import {
  Armchair,
  BookOpen,
  Briefcase,
  Building2,
  Car,
  Code,
  GraduationCap,
  HardHat,
  Home,
  Landmark,
  Laptop,
  PenLine,
  Plane,
  Scale,
  Stethoscope,
  Store,
  Wheat,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { RichSelect } from "@/components/ui/select";
import { CITIES, PROVINCES, citiesInProvince } from "@/lib/pk-geo";
import { OCCUPATIONS, type ProfileDraft, type ProfileErrors } from "@/lib/profile-fields";

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  Briefcase, Building2, Store, Laptop, Code, Wheat, Stethoscope, GraduationCap,
  HardHat, Scale, Landmark, Car, BookOpen, Home, Armchair, Plane, PenLine,
};

/**
 * The profile fields, shared by onboarding and Settings → Profile.
 *
 * One component because both screens ask for exactly the same things. Written
 * twice they drift, and the version people meet first — onboarding — is the one
 * that ends up with the weaker validation.
 *
 * City is a CASCADE off province. A flat list of 220 places is not something
 * anyone scrolls; narrowing to one province leaves 10–90, which is choosable.
 */
export function ProfileFields({
  draft,
  errors,
  onChange,
  disabled = false,
  showNames = true,
}: {
  draft: ProfileDraft;
  errors: ProfileErrors;
  onChange: (patch: Partial<ProfileDraft>) => void;
  /** Preview mode: everything renders, nothing can be typed or saved. */
  disabled?: boolean;
  showNames?: boolean;
}) {
  const cities = React.useMemo(
    () => (draft.province ? citiesInProvince(draft.province) : []),
    [draft.province],
  );

  const provinceOptions = PROVINCES.map((p) => ({
    value: p.code,
    label: p.name,
    description: p.isTerritory ? "Territory" : "Province",
  }));

  const cityOptions = cities.map((city) => ({
    value: city.name,
    label: city.name,
    // The Urdu name is the description rather than the label so the value
    // stored stays the Latin spelling, whatever locale the form is read in.
    description: city.nameUr,
  }));

  const occupationOptions = OCCUPATIONS.map((o) => {
    const Icon = ICONS[o.icon] ?? PenLine;
    return {
      value: o.value,
      label: o.label,
      description: o.description,
      icon: <Icon size={15} />,
    };
  });

  return (
    <div className="space-y-4">
      {showNames && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="First name"
            value={draft.firstName}
            onChange={(e) => onChange({ firstName: e.target.value })}
            error={errors.firstName}
            disabled={disabled}
            required
          />
          <Input
            label="Last name"
            value={draft.lastName}
            onChange={(e) => onChange({ lastName: e.target.value })}
            error={errors.lastName}
            disabled={disabled}
          />
        </div>
      )}

      <Input
        label="Phone number"
        type="tel"
        inputMode="tel"
        placeholder="0300 1234567"
        value={draft.phone}
        onChange={(e) => onChange({ phone: e.target.value })}
        error={errors.phone}
        hint="Pakistani mobile or landline. Used for reminders later."
        disabled={disabled}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <RichSelect
          label="Province"
          value={draft.province}
          // Changing province clears the city: keeping Lahore selected while
          // the province says Sindh is a contradiction the form should not
          // allow someone to save.
          onChange={(v) => onChange({ province: v, city: "" })}
          options={provinceOptions}
          placeholder="Choose a province"
          error={errors.province}
          disabled={disabled}
        />

        <RichSelect
          label="City"
          value={draft.city}
          onChange={(v) => onChange({ city: v })}
          options={cityOptions}
          placeholder={draft.province ? "Choose a city" : "Pick a province first"}
          error={errors.city}
          disabled={disabled || !draft.province}
          emptyMessage="No cities listed for this province"
          hint={
            draft.province
              ? `${cities.length} places listed. Not here? Choose the nearest.`
              : undefined
          }
        />
      </div>

      <RichSelect
        label="What do you do"
        value={draft.occupationCode}
        onChange={(v) => onChange({ occupationCode: v })}
        options={occupationOptions}
        placeholder="Choose an occupation"
        disabled={disabled}
        hint="Shapes the tax and Zakat guidance you see."
      />

      {/*
        Only appears for "Other". Rendering it always would suggest the picked
        options are just labels for a free-text field, which they are not — the
        code is what the tax surfaces read.
      */}
      {draft.occupationCode === "other" && (
        <Input
          label="Tell us what you do"
          placeholder="e.g. Poultry farm supervisor"
          value={draft.occupationOther}
          onChange={(e) => onChange({ occupationOther: e.target.value })}
          error={errors.occupationOther}
          disabled={disabled}
          autoFocus
        />
      )}
    </div>
  );
}

/** Total place count, used in copy so the number cannot go stale. */
export const CITY_COUNT = CITIES.length;
