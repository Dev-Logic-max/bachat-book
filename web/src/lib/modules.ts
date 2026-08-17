/**
 * The one list of what this product contains.
 *
 * The rail, the bottom nav and the create-workspace modal all read from here.
 * They each used to carry their own hardcoded array, which is why "Activity" and
 * "Wealth" once appeared in the bottom nav and nowhere else in the product, and
 * why "how many modules does this workspace type give me" was not a question
 * anything could answer.
 */

export type ModuleGroup = "core" | "finance" | "vertical" | "system";

export type ModuleStatus = "live" | "soon";

export type WorkspacePreset =
  | "personal"
  | "family"
  | "shop"
  | "agriculture"
  | "freelance"
  | "factory"
  | "rental";

export type ModuleDef = {
  key: string;
  label: string;
  href: string;
  /** Lucide icon name; components map it, so this file stays JSX-free. */
  icon: string;
  group: ModuleGroup;
  status: ModuleStatus;
  /**
   * Core modules are always on and cannot be switched off — every workspace
   * needs somewhere to put money and something to see it in.
   */
  alwaysOn?: boolean;
  /**
   * Which presets enable this by default. Undefined means every preset.
   * A user can still turn it on later; this only decides the starting set.
   */
  presets?: WorkspacePreset[];
  description: string;
};

export const MODULES: ModuleDef[] = [
  // ---- Core: on everywhere, cannot be disabled -----------------------------
  { key: "dashboard", label: "Overview", href: "/dashboard", icon: "LayoutDashboard", group: "core", status: "live", alwaysOn: true, description: "Net worth, money in and out" },
  { key: "entries", label: "Entries", href: "/entries", icon: "NotebookPen", group: "core", status: "live", alwaysOn: true, description: "Log income and expenses" },
  { key: "accounts", label: "Accounts", href: "/accounts", icon: "Wallet", group: "core", status: "live", alwaysOn: true, description: "Where you hold money" },
  { key: "transactions", label: "Transactions", href: "/transactions", icon: "ArrowLeftRight", group: "core", status: "live", alwaysOn: true, description: "The full ledger and transfers" },
  { key: "tasks", label: "Tasks", href: "/tasks", icon: "ListChecks", group: "core", status: "live", alwaysOn: true, description: "Bills and to-dos that move money" },
  { key: "calendar", label: "Calendar", href: "/calendar", icon: "CalendarDays", group: "core", status: "live", alwaysOn: true, description: "Everything with a date on it" },

  // ---- Finance: on by default, can be switched off -------------------------
  { key: "budgets", label: "Budgets", href: "/budgets", icon: "CircleDollarSign", group: "finance", status: "live", description: "Caps per category, and event budgets" },
  { key: "investments", label: "Investments", href: "/wealth/investments", icon: "TrendingUp", group: "finance", status: "live", description: "NSS, prize bonds, gold, PSX" },
  { key: "committees", label: "Committee", href: "/wealth/committees", icon: "Users", group: "finance", status: "live", description: "BC circles and payout schedules" },
  { key: "zakat", label: "Zakat", href: "/wealth/zakat", icon: "HandHeart", group: "finance", status: "live", presets: ["personal", "family", "shop", "freelance", "factory", "rental"], description: "Nisab, hawl and payment log" },
  { key: "contacts", label: "Contacts", href: "/contacts", icon: "Contact", group: "finance", status: "live", description: "People, birthdays and who owes what" },
  { key: "reports", label: "Reports", href: "/reports", icon: "PieChart", group: "finance", status: "live", description: "Where the money actually went" },
  { key: "tax", label: "Tax & FBR", href: "/tax", icon: "Landmark", group: "finance", status: "live", description: "Slabs, filer status and withholding" },
  { key: "import", label: "Import Statement", href: "/transactions/import", icon: "FileSpreadsheet", group: "finance", status: "soon", description: "Read a bank statement into the ledger" },
  { key: "receipts", label: "Receipts", href: "/receipts", icon: "ScanLine", group: "finance", status: "soon", description: "Photograph a parchi, get the line items" },
  { key: "ai", label: "AI Copilot", href: "/ai-assistant", icon: "Bot", group: "finance", status: "soon", description: "Ask questions about your own numbers" },

  // ---- Vertical: preset-specific -------------------------------------------
  { key: "khata", label: "Customer Khata", href: "/shop/khata", icon: "BookUser", group: "vertical", status: "soon", presets: ["shop"], description: "Udhaar per customer, and what is owed" },
  { key: "suppliers", label: "Suppliers", href: "/shop/suppliers", icon: "Truck", group: "vertical", status: "soon", presets: ["shop", "factory"], description: "Who you buy from and what is due" },
  { key: "inventory", label: "Inventory", href: "/shop/inventory", icon: "Package", group: "vertical", status: "soon", presets: ["shop", "factory"], description: "Stock on hand and its cost" },
  { key: "daily_close", label: "Daily Close", href: "/shop/close", icon: "CalendarCheck", group: "vertical", status: "soon", presets: ["shop"], description: "Cash counted against sales, each night" },

  { key: "crops", label: "Crop Cycles", href: "/farm/crops", icon: "Sprout", group: "vertical", status: "soon", presets: ["agriculture"], description: "Kharif and rabi, sowing to harvest" },
  { key: "land", label: "Land & Parcels", href: "/farm/land", icon: "Map", group: "vertical", status: "soon", presets: ["agriculture"], description: "Acres, tenancy and per-acre yield" },
  { key: "inputs", label: "Farm Inputs", href: "/farm/inputs", icon: "Droplets", group: "vertical", status: "soon", presets: ["agriculture"], description: "Seed, fertiliser, diesel and tube-well" },
  { key: "mandi", label: "Mandi Sales", href: "/farm/mandi", icon: "Scale", group: "vertical", status: "soon", presets: ["agriculture"], description: "What the crop sold for, per maund" },
  { key: "ushr", label: "Ushr", href: "/farm/ushr", icon: "Wheat", group: "vertical", status: "soon", presets: ["agriculture"], description: "Due on produce, where Zakat is not" },

  { key: "clients", label: "Clients", href: "/work/clients", icon: "Handshake", group: "vertical", status: "soon", presets: ["freelance"], description: "Who you bill and on what terms" },
  { key: "invoices", label: "Invoices", href: "/work/invoices", icon: "FileText", group: "vertical", status: "soon", presets: ["freelance"], description: "Raised, sent, paid and overdue" },
  { key: "remittance", label: "Remittance & PRC", href: "/work/remittance", icon: "Globe", group: "vertical", status: "soon", presets: ["freelance"], description: "USD in, PKR out, and the PRC for FBR" },

  { key: "production", label: "Production", href: "/factory/production", icon: "Factory", group: "vertical", status: "soon", presets: ["factory"], description: "Batches, materials and output" },
  { key: "payroll", label: "Payroll", href: "/factory/payroll", icon: "UsersRound", group: "vertical", status: "soon", presets: ["factory"], description: "Wages, advances and attendance" },
  { key: "unit_cost", label: "Cost per Unit", href: "/factory/cost", icon: "Calculator", group: "vertical", status: "soon", presets: ["factory"], description: "Electricity and gas against output" },

  { key: "units", label: "Units", href: "/rental/units", icon: "Building", group: "vertical", status: "soon", presets: ["rental"], description: "Shops, flats and plots you let" },
  { key: "tenants", label: "Tenants", href: "/rental/tenants", icon: "KeyRound", group: "vertical", status: "soon", presets: ["rental"], description: "Who is in each unit, and their advance" },
  { key: "rent_roll", label: "Rent Roll", href: "/rental/rent", icon: "ReceiptText", group: "vertical", status: "soon", presets: ["rental"], description: "Rent due, collected and outstanding" },

  // ---- System: always present, never part of a preset count ----------------
  { key: "settings", label: "Settings", href: "/settings", icon: "Settings", group: "system", status: "live", alwaysOn: true, description: "Profile, workspaces, plan" },
];

export type PresetDef = {
  key: WorkspacePreset;
  label: string;
  labelUr?: string;
  icon: string;
  /** Maps to the three behavioural household kinds. */
  kind: "personal" | "family" | "business";
  description: string;
};

export const PRESETS: PresetDef[] = [
  { key: "personal", label: "Personal", icon: "User", kind: "personal", description: "Just your own money, kept separate" },
  { key: "family", label: "Family household", labelUr: "گھر", icon: "Users", kind: "family", description: "Shared bills, groceries and school fees" },
  { key: "shop", label: "Shop or trading", labelUr: "دکان", icon: "Store", kind: "business", description: "Retail or wholesale, with customer udhaar" },
  { key: "agriculture", label: "Farming", labelUr: "زراعت", icon: "Wheat", kind: "business", description: "Land, crops and mandi sales, with Ushr" },
  { key: "freelance", label: "Freelance or IT", icon: "Laptop", kind: "business", description: "Clients abroad, invoices and remittances" },
  { key: "factory", label: "Manufacturing", icon: "Factory", kind: "business", description: "Production batches, payroll and unit costs" },
  { key: "rental", label: "Rental property", icon: "Building", kind: "business", description: "Units, tenants and the rent roll" },
];

/** Whether a preset turns a module on by default. */
export function isModuleInPreset(mod: ModuleDef, preset: WorkspacePreset): boolean {
  if (mod.group === "system") return true;
  if (mod.alwaysOn) return true;
  if (!mod.presets) return true;
  return mod.presets.includes(preset);
}

/** Default module set for a preset, in registry order. */
export function modulesForPreset(preset: WorkspacePreset): ModuleDef[] {
  return MODULES.filter((m) => isModuleInPreset(m, preset));
}

/**
 * What the create-workspace picker shows on the right of each type.
 *
 * Counts what you actually get to open, so "coming soon" verticals are counted
 * separately rather than inflating the headline number — a card promising 22
 * modules where six are not built yet is a card that lies.
 */
export function presetModuleCounts(preset: WorkspacePreset): {
  live: number;
  soon: number;
  total: number;
} {
  const mods = modulesForPreset(preset).filter((m) => m.group !== "system");
  const live = mods.filter((m) => m.status === "live").length;
  const soon = mods.filter((m) => m.status === "soon").length;
  return { live, soon, total: mods.length };
}

/**
 * Resolve the modules a workspace actually shows: the preset's defaults, with
 * any explicit per-workspace override applied on top.
 */
export function resolveModules(
  preset: WorkspacePreset,
  overrides: Record<string, boolean> = {},
): ModuleDef[] {
  return MODULES.filter((m) => {
    if (m.alwaysOn || m.group === "system") return true;
    const override = overrides[m.key];
    if (override !== undefined) return override;
    return isModuleInPreset(m, preset);
  });
}

export function presetByKey(key: string | null | undefined): PresetDef {
  return PRESETS.find((p) => p.key === key) ?? PRESETS[0];
}
