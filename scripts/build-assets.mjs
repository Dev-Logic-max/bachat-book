/**
 * references/ -> web/public/
 *
 *   node scripts/build-assets.mjs
 *
 * Re-runnable and idempotent.
 *
 * SOURCES ARE NAMED, NOT NUMBERED. The first version of this map used positions
 * in the sorted `references/` listing, which was fine until four new originals
 * were dropped in — every position after them shifted by one, and the map
 * silently pointed at the wrong pictures. A file's Gemini id never changes, so
 * that is what it is keyed on now. Only the distinctive middle chunk is needed;
 * the lookup matches on substring.
 */
import { copyFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { cutout } from "./cutout.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = path.join(ROOT, "references");
const PUB = path.join(ROOT, "web", "public");

const files = readdirSync(SRC).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort();

/** Resolve a reference key to its path, loudly if it is gone or ambiguous. */
const at = (key) => {
  const hits = files.filter((f) => f.includes(key));
  if (hits.length === 0) {
    throw new Error(`reference "${key}" not found in references/`);
  }
  if (hits.length > 1) {
    throw new Error(`reference "${key}" matches ${hits.length} files: ${hits.join(", ")}`);
  }
  return path.join(SRC, hits[0]);
};

/**
 * Reference number -> destination.
 *
 * Chosen by looking at all 70. Where the owner made several of the same idea,
 * the most PAKISTANI one wins: the karahi over the burger, the K-Electric bill
 * over the generic one, the motorbike over the sedan, the FBR building over the
 * generic tax office.
 */
const CATEGORY_ART = {
  // Foldered by KIND, so the folder answers "which of the three lists is this
  // in" before you open a single file, and replacing one is a matter of finding
  // `expense/food.webp` rather than scanning 24 names in a flat directory.
  expense: {
    food: "Gemini_Generated_Image_ejt7c9ejt7c9ejt7.jpg",      // karahi, naan, mango juice
    bills: "Gemini_Generated_Image_bnazvbnazvbnazvb.jpg",     // K-Electric + SSGC bills
    transport: "Gemini_Generated_Image_o3cuhmo3cuhmo3cu.png", // red motorbike
    shopping: "Gemini_Generated_Image_u4z5snu4z5snu4z5.jpg",  // basket, "خریداری" tag
    home: "Gemini_Generated_Image_qnpl4wqnpl4wqnpl.jpg",      // cottage with garden
    health: "Gemini_Generated_Image_bbuhembbuhembbuh.jpg",    // first-aid case
    education: "Gemini_Generated_Image_1be321be321be321.jpg", // college, books, pen
    family: "Gemini_Generated_Image_jtx3tyjtx3tyjtx3.jpg",    // family portrait diorama
    personal: "Gemini_Generated_Image_yyhcqwyyhcqwyyhc.jpg",  // soap, cream, brush
    leisure: "Gemini_Generated_Image_vz46hlvz46hlvz46.jpg",   // park, stream, gazebo
    travel: "Gemini_Generated_Image_so6astso6astso6a.jpg",    // suitcase, passport, globe
    events: "Gemini_Generated_Image_h7o0uch7o0uch7o0.jpg",    // place setting, invitations
    giving: "Gemini_Generated_Image_ho2qpoho2qpoho2q.jpg",    // mosque, "GIVING" in Urdu
    finance: "Gemini_Generated_Image_h2ir65h2ir65h2ir.jpg",   // BANK, cash and a coin
    tax: "Gemini_Generated_Image_yvnr1oyvnr1oyvnr.jpg",       // FBR building
    other: "Gemini_Generated_Image_f0l9t3f0l9t3f0l9.jpg",     // sphere, cube, pyramid
  },
  income: {
    salary: "Gemini_Generated_Image_n7k0hzn7k0hzn7k0.jpg",            // briefcase, SALARY
    business: "Gemini_Generated_Image_zp8inzp8inzp8inz.png",          // corner shop
    freelance: "Gemini_Generated_Image_ic8mylic8mylic8m.jpg",         // laptop dashboard
    rental_income: "Gemini_Generated_Image_yfy2rcyfy2rcyfy2.jpg",     // RENTAL block, keys
    investment_income: "Gemini_Generated_Image_c43pfc43pfc43pfc.jpg", // gold bars, ledger
    income: "Gemini_Generated_Image_uovnx7uovnx7uovn.jpg",            // envelope of notes
  },
  transfer: {
    cash_out: "Gemini_Generated_Image_eqkc4keqkc4keqkc.jpg", // ATM dispensing notes
    cash_in: "Gemini_Generated_Image_xedjkvxedjkvxedj.jpg",  // bank teller window
    /*
     * The last two gaps, both filled by originals the owner generated for them.
     * `to_savings` is the GREEN bank with the rising arrow, not the grey one —
     * that is already `finance`, and two near-identical banks in one picker
     * would be worse than no picture at all.
     */
    transfer: "Gemini_Generated_Image_xzwku1xzwku1xzwk.jpg",    // two cards, circular arrows
    to_savings: "Gemini_Generated_Image_nn3knann3knann3k.jpg",  // bank, coin, rising arrow
  },
};

/**
 * Empty-state art. These are the beige isometric cutaway rooms, which are a
 * different visual language from the category objects on purpose: a room says
 * "this space is empty", an object says "this is a category".
 */
const EMPTY_ART = {
  "empty-generic": "Gemini_Generated_Image_zp8inzp8inzp8inz (2).png",     // bare shelf, jar, plant
  "empty-entries": "Gemini_Generated_Image_zp8inzp8inzp8inz (4).png",     // desk, phone, receipts
  "empty-tasks": "Gemini_Generated_Image_zp8inzp8inzp8inz (7).png",       // desk, laptop, clock
  "empty-accounts": "Gemini_Generated_Image_zp8inzp8inzp8inz (3).png",    // reception with a safe
  "empty-investments": "Gemini_Generated_Image_zp8inzp8inzp8inz (5).png", // vault door, crates
  "empty-receipts": "Gemini_Generated_Image_ysftq7ysftq7ysft.png",        // receipts on a counter
  "empty-budgets": "Gemini_Generated_Image_q1tszcq1tszcq1ts.png",         // savings jar and books
  "empty-committee": "Gemini_Generated_Image_zp8inzp8inzp8inz (1).png",   // majlis seating
  "empty-zakat": "Gemini_Generated_Image_zp8inzp8inzp8inz (8).png",       // prayer mat, arch
  "empty-shop": "Store.png",                                              // the corner shop
  /*
   * Transactions and Contacts share the rooms rather than getting their own:
   * a bank reception IS the right picture for "no transactions", and there is
   * no contacts-specific render yet. Both are aliases of an existing file, not
   * new art, so nothing is duplicated on disk.
   */
};

/** Empty states that reuse another room. slug -> the file it copies. */
const EMPTY_ALIAS = {
  "empty-transactions": "empty-accounts",
  "empty-contacts": "empty-generic",
};

const report = [];

for (const [kind, slugs] of Object.entries(CATEGORY_ART)) {
  for (const [slug, idx] of Object.entries(slugs)) {
    const out = path.join(PUB, "categories", kind, `${slug}.webp`);
    const { coverage } = await cutout(at(idx), out, { size: 384, pad: 0.05 });
    report.push({ kind: "category", group: kind, slug, ref: idx, file: files[idx - 1], coverage });
    console.log(
      `categories/${kind}/${slug}.webp  <- #${idx}  (subject fills ${(coverage * 100).toFixed(0)}%)`,
    );
  }
}

for (const [slug, idx] of Object.entries(EMPTY_ART)) {
  const out = path.join(PUB, "art", `${slug}.webp`);
  /*
   * Bigger and cleaner than the category icons, because these are the opposite
   * problem: an empty state renders at 128-160px, so 512 at q82 was visibly
   * soft at 1x. 768 at q92 costs ~20 KB more each and there are only ten.
   */
  const { coverage } = await cutout(at(idx), out, { size: 768, pad: 0.03, quality: 92 });
  report.push({ kind: "art", slug, ref: idx, file: files[idx - 1], coverage });
  console.log(`art/${slug}.webp  <- #${idx}  (subject fills ${(coverage * 100).toFixed(0)}%)`);
}

// Aliases are copied rather than re-cut: same bytes, a name the screen can use.
for (const [slug, source] of Object.entries(EMPTY_ALIAS)) {
  copyFileSync(
    path.join(PUB, "art", `${source}.webp`),
    path.join(PUB, "art", `${slug}.webp`),
  );
  console.log(`art/${slug}.webp  <- alias of ${source}`);
}

console.log(
  `\n${report.length + Object.keys(EMPTY_ALIAS).length} files written. ` +
    "Every category now has art.",
);

if (process.argv[2]) {
  writeFileSync(path.join(process.argv[2], "asset-report.json"), JSON.stringify(report, null, 1));
}
