import type { Category, Institution, Merchant } from "./types";

/**
 * Real Pakistani institutions and brands. This catalog is the difference
 * between a screen that reads as ours and one that reads as a translated US
 * budgeting app.
 *
 * `brand` doubles as card art and as the monogram tile until the real logo
 * lands in /public/logos/.
 */

const inst = (
  id: string,
  name: string,
  short: string,
  kind: Institution["kind"],
  brand: string,
  onBrand = "#ffffff",
): Institution => ({ id, name, short, kind, brand, onBrand });

export const INSTITUTIONS: Institution[] = [
  // Banks
  inst("hbl", "Habib Bank Limited", "HBL", "bank", "#009639"),
  inst("ubl", "United Bank Limited", "UBL", "bank", "#0d47a1"),
  inst("mcb", "MCB Bank", "MCB", "bank", "#00693e"),
  inst("meezan", "Meezan Bank", "Meezan", "bank", "#00563f"),
  inst("alfalah", "Bank Alfalah", "Alfalah", "bank", "#c8102e"),
  inst("allied", "Allied Bank", "ABL", "bank", "#003c71"),
  inst("faysal", "Faysal Bank", "Faysal", "bank", "#00539b"),
  inst("askari", "Askari Bank", "Askari", "bank", "#b3162b"),
  inst("scb", "Standard Chartered", "SCB", "bank", "#0473ea"),

  // Wallets / EMIs
  inst("jazzcash", "JazzCash", "JazzCash", "wallet", "#c8102e"),
  inst("easypaisa", "Easypaisa", "Easypaisa", "wallet", "#4a9c2d"),
  inst("sadapay", "SadaPay", "SadaPay", "wallet", "#111111"),
  inst("nayapay", "NayaPay", "NayaPay", "wallet", "#00a98f"),

  // Utilities
  inst("kelectric", "K-Electric", "K-Electric", "utility", "#d92b1f"),
  inst("lesco", "LESCO", "LESCO", "utility", "#0066b3"),
  inst("sngpl", "Sui Northern Gas", "SNGPL", "utility", "#d97b17"),
  inst("ssgc", "Sui Southern Gas", "SSGC", "utility", "#1a7a4c"),
  inst("kwsb", "Karachi Water Board", "KWSB", "utility", "#1f6fb2"),
  inst("stormfiber", "StormFiber", "StormFiber", "utility", "#e05a1c"),
  inst("ptcl", "PTCL", "PTCL", "utility", "#0090cf"),
  inst("jazz", "Jazz", "Jazz", "utility", "#c8102e"),
  inst("zong", "Zong", "Zong", "utility", "#00a5d2"),

  // Government / savings
  inst("cdns", "Central Directorate of National Savings", "National Savings", "gov", "#0b5c3f"),
  inst("psx", "Pakistan Stock Exchange", "PSX", "gov", "#123a63"),
  inst("fbr", "Federal Board of Revenue", "FBR", "gov", "#1b4d2e"),
];

const cat = (
  id: string,
  name: string,
  icon: string,
  tone: Category["tone"],
  parentId: string | null = null,
  kind: Category["kind"] = "expense",
): Category => ({ id, name, icon, tone, parentId, kind });

export const CATEGORIES: Category[] = [
  // Home & bills
  cat("home", "Home & bills", "House", 2),
  cat("rent", "Rent", "KeyRound", 2, "home"),
  cat("electricity", "Electricity", "Zap", 6, "home"),
  cat("gas", "Sui gas", "Flame", 6, "home"),
  cat("water", "Water", "Droplets", 3, "home"),
  cat("internet", "Internet", "Wifi", 2, "home"),
  cat("mobile", "Mobile packages", "Smartphone", 2, "home"),
  cat("generator", "Generator fuel", "Fuel", 6, "home"),
  cat("society", "Society charges", "Building2", 2, "home"),

  // Household staff — near-universal here, absent from every foreign app
  cat("staff", "Household staff", "Users", 5),
  cat("maid", "Maid", "Sparkles", 5, "staff"),
  cat("driver", "Driver", "CarFront", 5, "staff"),
  cat("chowkidar", "Chowkidar", "ShieldCheck", 5, "staff"),

  // Food
  cat("food", "Food", "UtensilsCrossed", 1),
  cat("kiryana", "Kiryana / grocery", "ShoppingBasket", 1, "food"),
  cat("doodh", "Doodh wala", "Milk", 1, "food"),
  cat("sabzi", "Sabzi & fruit", "Carrot", 5, "food"),
  cat("meat", "Meat", "Beef", 6, "food"),
  cat("restaurant", "Restaurants", "UtensilsCrossed", 1, "food"),
  cat("delivery", "Food delivery", "Bike", 4, "food"),
  cat("chai", "Chai & coffee", "Coffee", 6, "food"),

  // Transport
  cat("transport", "Transport", "Car", 3),
  cat("petrol", "Petrol", "Fuel", 3, "transport"),
  cat("ridehail", "Careem / Bykea", "Bike", 3, "transport"),
  cat("carmaint", "Car maintenance", "Wrench", 3, "transport"),
  cat("token", "Token tax", "ReceiptText", 3, "transport"),

  // Education
  cat("education", "Education", "GraduationCap", 4),
  cat("schoolfee", "School fees", "School", 4, "education"),
  cat("tuition", "Tuition centre", "BookOpen", 4, "education"),

  // Health
  cat("health", "Health", "HeartPulse", 4),
  cat("doctor", "Doctor", "Stethoscope", 4, "health"),
  cat("pharmacy", "Pharmacy", "Pill", 4, "health"),
  cat("lab", "Lab tests", "TestTube", 4, "health"),

  // Family & social
  cat("family", "Family & social", "HeartHandshake", 4),
  cat("familysupport", "Family support", "HeartHandshake", 4, "family"),
  cat("eidi", "Eidi", "Gift", 1, "family"),
  cat("shaadi", "Shaadi & events", "PartyPopper", 4, "family"),

  // Charity — Zakat is an obligation, tracked apart from ordinary giving
  cat("charity", "Charity", "HandHeart", 3),
  cat("zakat", "Zakat", "HandHeart", 1, "charity"),
  cat("sadaqah", "Sadaqah", "HandCoins", 3, "charity"),
  cat("qurbani", "Qurbani", "Beef", 6, "charity"),

  // Shopping
  cat("shopping", "Shopping", "ShoppingBag", 1),
  cat("clothing", "Clothing", "Shirt", 1, "shopping"),
  cat("footwear", "Footwear", "Footprints", 6, "shopping"),
  cat("electronics", "Electronics", "Laptop", 2, "shopping"),

  // Personal
  cat("personal", "Personal", "User", 5),
  cat("subscriptions", "Subscriptions", "Repeat", 4, "personal"),
  cat("salon", "Salon", "Scissors", 5, "personal"),
  cat("gym", "Gym", "Dumbbell", 5, "personal"),

  // Financial
  cat("financial", "Financial", "Landmark", 2),
  cat("bankcharges", "Bank charges", "Landmark", 2, "financial"),
  cat("withholding", "Withholding tax", "Receipt", 6, "financial"),
  cat("emi", "Loan EMI", "CreditCard", 6, "financial"),
  cat("committee", "Committee", "Users", 1, "financial"),
  cat("insurance", "Insurance", "ShieldCheck", 2, "financial"),
  cat("investment", "Investment", "TrendingUp", 1, "financial"),

  // Income
  cat("income", "Income", "TrendingUp", 3, null, "income"),
  cat("salary", "Salary", "Wallet", 3, "income", "income"),
  cat("freelance", "Freelance (USD)", "Globe", 3, "income", "income"),
  cat("remittance", "Remittance", "Send", 3, "income", "income"),
  cat("rental", "Rental income", "Building2", 3, "income", "income"),
  cat("profit", "Profit on savings", "PiggyBank", 3, "income", "income"),
  cat("committeepayout", "Committee payout", "Users", 3, "income", "income"),
];

const m = (
  id: string,
  name: string,
  categoryId: string,
  brand: string,
  institutionId?: string,
): Merchant => ({ id, name, categoryId, brand, institutionId });

export const MERCHANTS: Merchant[] = [
  // Grocery & daily
  m("imtiaz", "Imtiaz Super Market", "kiryana", "#c8102e"),
  m("alfatah", "Al-Fatah", "kiryana", "#005daa"),
  m("naheed", "Naheed Super Store", "kiryana", "#d92b1f"),
  m("chaseup", "Chase Up", "kiryana", "#d97b17"),
  m("carrefour", "Carrefour", "kiryana", "#0b57a4"),
  m("greenvalley", "Green Valley", "kiryana", "#1a7a4c"),
  m("doodhwala", "Doodh wala", "doodh", "#5b7fa6"),
  m("sabzimandi", "Sabzi Mandi", "sabzi", "#6f8f4a"),
  m("alrahim", "Al-Rahim Meat", "meat", "#8b2f2f"),

  // Food out & delivery
  m("foodpanda", "foodpanda", "delivery", "#d70f64"),
  m("kfc", "KFC", "restaurant", "#c8102e"),
  m("mcdonalds", "McDonald's", "restaurant", "#d9a300"),
  m("cheezious", "Cheezious", "restaurant", "#e07b1c"),
  m("broadway", "Broadway Pizza", "restaurant", "#c8102e"),
  m("johnnyjugnu", "Johnny & Jugnu", "restaurant", "#c9a227"),
  m("kababjees", "Kababjees", "restaurant", "#7d1414"),
  m("studentbiryani", "Student Biryani", "restaurant", "#b5651d"),
  m("gloria", "Gloria Jean's", "chai", "#6f4e37"),
  m("chaiwala", "Chai Wala", "chai", "#8a6642"),

  // Transport
  m("pso", "PSO", "petrol", "#009639"),
  m("shell", "Shell", "petrol", "#d9a300"),
  m("totalparco", "Total Parco", "petrol", "#c8102e"),
  m("careem", "Careem", "ridehail", "#3eb449"),
  m("bykea", "Bykea", "ridehail", "#00a651"),
  m("indrive", "inDrive", "ridehail", "#8fae12"),
  m("toyota", "Toyota Service", "carmaint", "#c8102e"),

  // Utilities — billers, linked to their institution
  m("kelectric", "K-Electric", "electricity", "#d92b1f", "kelectric"),
  m("sngplbill", "SNGPL", "gas", "#d97b17", "sngpl"),
  m("kwsbbill", "KWSB", "water", "#1f6fb2", "kwsb"),
  m("stormfiberbill", "StormFiber", "internet", "#e05a1c", "stormfiber"),
  m("jazzbill", "Jazz", "mobile", "#c8102e", "jazz"),

  // Shopping
  m("khaadi", "Khaadi", "clothing", "#1c1c1c"),
  m("gulahmed", "Gul Ahmed", "clothing", "#8b1538"),
  m("sapphire", "Sapphire", "clothing", "#b39264"),
  m("junaidjamshed", "J.", "clothing", "#003057"),
  m("outfitters", "Outfitters", "clothing", "#2b2b2b"),
  m("bata", "Bata", "footwear", "#c8102e"),
  m("servis", "Servis", "footwear", "#005eb8"),
  m("daraz", "Daraz", "electronics", "#e05606"),

  // Health
  m("dvago", "Dvago", "pharmacy", "#00a396"),
  m("chughtai", "Chughtai Lab", "lab", "#d92b1f"),
  m("shaukatkhanum", "Shaukat Khanum", "doctor", "#00563f"),

  // Personal & subscriptions
  m("netflix", "Netflix", "subscriptions", "#c8102e"),
  m("spotify", "Spotify", "subscriptions", "#1a9e4b"),
  m("youtube", "YouTube Premium", "subscriptions", "#c8102e"),

  // Education
  m("beaconhouse", "Beaconhouse", "schoolfee", "#123a63"),

  // Income sources
  m("employer", "Systems Limited", "salary", "#123a63"),
  m("payoneer", "Payoneer", "freelance", "#ff4800"),
  m("cdnsprofit", "National Savings", "profit", "#0b5c3f", "cdns"),
];

/**
 * Slugs with a real mark in /public/logos, downloaded by scripts/fetch-logos.
 * Anything not listed falls back to the brand-coloured monogram, so a missing
 * file degrades quietly instead of rendering a broken image.
 */
const HAS_LOGO = new Set([
  "alfatah", "allied", "alfalah", "askari", "bata", "beaconhouse", "broadway",
  "bykea", "careem", "carrefour", "cdns", "cdnsprofit", "chaseup", "cheezious",
  "chughtai", "daraz", "dvago", "easypaisa", "employer", "faysal", "fbr",
  "foodpanda", "gloria", "gulahmed", "hbl", "imtiaz", "indrive", "jazz",
  "jazzbill", "jazzcash", "johnnyjugnu", "junaidjamshed", "kababjees", "kelectric",
  "kfc", "khaadi", "kwsb", "kwsbbill", "lesco", "mcb", "mcdonalds", "meezan",
  "naheed", "nayapay", "netflix", "outfitters", "payoneer", "psx", "pso", "ptcl",
  "sadapay", "sapphire", "scb", "servis", "shaukatkhanum", "shell", "sngpl",
  "sngplbill", "spotify", "ssgc", "stormfiber", "stormfiberbill", "studentbiryani",
  "toyota", "totalparco", "youtube", "zong",
]);

const withLogo = <T extends { id: string; logo?: string }>(rows: T[]): T[] =>
  rows.map((r) => (HAS_LOGO.has(r.id) ? { ...r, logo: `/logos/${r.id}.png` } : r));

export const INSTITUTIONS_WITH_LOGOS = withLogo(INSTITUTIONS);
export const MERCHANTS_WITH_LOGOS = withLogo(MERCHANTS);

export const byId = <T extends { id: string }>(rows: T[]) =>
  Object.fromEntries(rows.map((r) => [r.id, r])) as Record<string, T>;

export const INSTITUTION_BY_ID = byId(INSTITUTIONS_WITH_LOGOS);
export const CATEGORY_BY_ID = byId(CATEGORIES);
export const MERCHANT_BY_ID = byId(MERCHANTS_WITH_LOGOS);
