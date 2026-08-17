/**
 * Shared shape and validation for the profile fields.
 *
 * Onboarding and Settings → Profile ask for the same things, so the rules live
 * here rather than being written twice and drifting.
 */

export type OccupationOption = {
  value: string;
  label: string;
  /** Lucide icon name, resolved by the form so this file stays free of JSX. */
  icon: string;
  description: string;
};

/**
 * Occupations that mean something in Pakistan, not a generic Western list.
 *
 * The tax and Zakat surfaces care about the difference between a salaried
 * filer, a trader on turnover tax, an exporter of IT services on the 0.25%
 * regime and a farmer whose produce is Ushr rather than Zakat. That is why the
 * list is picked rather than free text — but "Other" always unlocks typing,
 * because a list that cannot describe you is worse than no list.
 */
export const OCCUPATIONS: OccupationOption[] = [
  { value: "salaried", label: "Salaried employee", icon: "Briefcase", description: "Monthly pay from an employer" },
  { value: "business_owner", label: "Business owner", icon: "Building2", description: "You run a registered business" },
  { value: "shopkeeper", label: "Shopkeeper or trader", icon: "Store", description: "Retail, wholesale or a stall" },
  { value: "freelancer", label: "Freelancer", icon: "Laptop", description: "Client work, often paid from abroad" },
  { value: "it_professional", label: "IT professional", icon: "Code", description: "Software, data or IT services" },
  { value: "farmer", label: "Farmer or landowner", icon: "Wheat", description: "Agricultural income and land" },
  { value: "doctor", label: "Doctor or healthcare", icon: "Stethoscope", description: "Clinical or hospital practice" },
  { value: "teacher", label: "Teacher or academic", icon: "GraduationCap", description: "School, college or university" },
  { value: "engineer", label: "Engineer", icon: "HardHat", description: "Civil, mechanical, electrical" },
  { value: "lawyer", label: "Lawyer or consultant", icon: "Scale", description: "Legal or professional advisory" },
  { value: "govt", label: "Government employee", icon: "Landmark", description: "Federal, provincial or armed forces" },
  { value: "driver", label: "Driver or transport", icon: "Car", description: "Ride-hailing, haulage, own vehicle" },
  { value: "student", label: "Student", icon: "BookOpen", description: "Studying, with little or no income" },
  { value: "homemaker", label: "Homemaker", icon: "Home", description: "Running the household" },
  { value: "retired", label: "Retired", icon: "Armchair", description: "Pension or savings income" },
  { value: "overseas", label: "Overseas Pakistani", icon: "Plane", description: "Working abroad, sending remittances" },
  { value: "other", label: "Other", icon: "PenLine", description: "Type your own" },
];

export function occupationLabel(code: string | null | undefined): string | undefined {
  return OCCUPATIONS.find((o) => o.value === code)?.label;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type ProfileDraft = {
  firstName: string;
  lastName: string;
  phone: string;
  province: string;
  city: string;
  occupationCode: string;
  occupationOther: string;
};

export type ProfileErrors = Partial<Record<keyof ProfileDraft, string>>;

/**
 * Pakistani mobile numbers.
 *
 * Accepts the three shapes people actually type — `03001234567`,
 * `+923001234567` and `00923001234567` — plus spaces and dashes, which are
 * stripped before checking. Landlines are allowed too, since a shopkeeper may
 * only have one.
 */
export function normalisePhone(raw: string): string {
  return raw.replace(/[\s()-]/g, "");
}

export function isValidPakistaniPhone(raw: string): boolean {
  const v = normalisePhone(raw);
  if (!v) return false;
  // Mobile: 03xx xxxxxxx / +923xx xxxxxxx / 00923xx xxxxxxx
  if (/^(?:\+92|0092|0)3\d{9}$/.test(v)) return true;
  // Landline with area code: 0xx xxxxxxx (9–11 digits total)
  if (/^(?:\+92|0092|0)\d{9,10}$/.test(v)) return true;
  return false;
}

/** Stores one canonical shape so two records of the same number match. */
export function toE164(raw: string): string {
  const v = normalisePhone(raw);
  if (v.startsWith("+92")) return v;
  if (v.startsWith("0092")) return `+92${v.slice(4)}`;
  if (v.startsWith("0")) return `+92${v.slice(1)}`;
  return v;
}

const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}'.\- ]{0,48}$/u;

export function validateProfile(
  draft: ProfileDraft,
  opts: { requireContact?: boolean } = {},
): ProfileErrors {
  const errors: ProfileErrors = {};

  if (!draft.firstName.trim()) {
    errors.firstName = "Enter your first name.";
  } else if (!NAME_RE.test(draft.firstName.trim())) {
    // Unicode-aware so Urdu and accented spellings pass; digits and symbols do not.
    errors.firstName = "Use letters only.";
  }

  if (draft.lastName.trim() && !NAME_RE.test(draft.lastName.trim())) {
    errors.lastName = "Use letters only.";
  }

  if (draft.phone.trim()) {
    if (!isValidPakistaniPhone(draft.phone)) {
      errors.phone = "Use a Pakistani number, like 0300 1234567.";
    }
  } else if (opts.requireContact) {
    errors.phone = "Enter a phone number.";
  }

  if (!draft.province) errors.province = "Choose your province.";
  if (!draft.city) errors.city = "Choose your city.";

  if (draft.occupationCode === "other" && !draft.occupationOther.trim()) {
    errors.occupationOther = "Tell us what you do.";
  }

  return errors;
}

export function hasErrors(errors: ProfileErrors): boolean {
  return Object.keys(errors).length > 0;
}
