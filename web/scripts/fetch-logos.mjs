/**
 * Pulls brand marks for the Pakistani merchants and institutions in the
 * catalog into /public/logos.
 *
 * `simple-icons` carries almost no Pakistani brands — no Imtiaz, no K-Electric,
 * no Khaadi, no Meezan — so the marks come from each brand's own domain via
 * Google's favicon service. Public brand assets, used as identifiers in a
 * finance app, at the size a transaction row renders them.
 *
 *   node scripts/fetch-logos.mjs
 */
import { mkdir, writeFile, readdir } from "node:fs/promises";
import path from "node:path";

const OUT = path.resolve("public/logos");

/** slug -> the domain that owns the mark */
const DOMAINS = {
  // Grocery & daily
  imtiaz: "imtiaz.com.pk",
  alfatah: "alfatah.pk",
  naheed: "naheed.pk",
  chaseup: "chaseup.pk",
  carrefour: "carrefour.pk",

  // Food
  foodpanda: "foodpanda.pk",
  kfc: "kfcpakistan.com",
  mcdonalds: "mcdonalds.com.pk",
  cheezious: "cheezious.com",
  broadway: "broadwaypizza.com.pk",
  johnnyjugnu: "johnnyandjugnu.com",
  kababjees: "kababjees.pk",
  studentbiryani: "studentbiryani.com",
  gloria: "gloriajeanscoffees.com",

  // Transport
  pso: "psopk.com",
  shell: "shell.com.pk",
  totalparco: "totalparco.com.pk",
  careem: "careem.com",
  bykea: "bykea.com",
  indrive: "indrive.com",
  toyota: "toyota-indus.com",

  // Utilities
  kelectric: "ke.com.pk",
  sngplbill: "sngpl.com.pk",
  kwsbbill: "kwsc.gos.pk",
  stormfiberbill: "stormfiber.com",
  jazzbill: "jazz.com.pk",

  // Shopping
  khaadi: "khaadi.com",
  gulahmed: "gulahmedshop.com",
  sapphire: "sapphireonline.pk",
  junaidjamshed: "junaidjamshed.com",
  outfitters: "outfitters.com.pk",
  bata: "bata.com.pk",
  servis: "servis.pk",
  daraz: "daraz.pk",

  // Health
  dvago: "dvago.pk",
  chughtai: "chughtailab.com",
  shaukatkhanum: "shaukatkhanum.org.pk",

  // Subscriptions
  netflix: "netflix.com",
  spotify: "spotify.com",
  youtube: "youtube.com",

  // Education & income
  beaconhouse: "beaconhouse.net",
  employer: "systemsltd.com",
  payoneer: "payoneer.com",
  cdnsprofit: "savings.gov.pk",

  // Institutions
  hbl: "hbl.com",
  ubl: "ubldigital.com",
  mcb: "mcb.com.pk",
  meezan: "meezanbank.com",
  alfalah: "bankalfalah.com",
  allied: "abl.com",
  faysal: "faysalbank.com",
  askari: "askaribank.com",
  scb: "sc.com",
  jazzcash: "jazzcash.com.pk",
  easypaisa: "easypaisa.com.pk",
  sadapay: "sadapay.pk",
  nayapay: "nayapay.com",
  lesco: "lesco.gov.pk",
  ssgc: "ssgc.com.pk",
  ptcl: "ptcl.com.pk",
  zong: "zong.com.pk",
  jazz: "jazz.com.pk",
  psx: "psx.com.pk",
  fbr: "fbr.gov.pk",
  cdns: "savings.gov.pk",
  kwsb: "kwsc.gos.pk",
  sngpl: "sngpl.com.pk",
  stormfiber: "stormfiber.com",
};

const url = (domain) =>
  `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

await mkdir(OUT, { recursive: true });

const results = { ok: [], failed: [] };

await Promise.all(
  Object.entries(DOMAINS).map(async ([slug, domain]) => {
    try {
      const res = await fetch(url(domain), { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      // The service returns a 16px generic globe when it has nothing real.
      if (buf.byteLength < 500) throw new Error(`placeholder (${buf.byteLength}b)`);
      await writeFile(path.join(OUT, `${slug}.png`), buf);
      results.ok.push(`${slug} (${(buf.byteLength / 1024).toFixed(1)}kb)`);
    } catch (err) {
      results.failed.push(`${slug} <- ${domain}: ${err.message}`);
    }
  }),
);

console.log(`\nDownloaded ${results.ok.length}/${Object.keys(DOMAINS).length}`);
if (results.failed.length) {
  console.log("\nFailed — these keep the monogram fallback:");
  for (const f of results.failed) console.log(`  ${f}`);
}
console.log(`\nFiles in ${OUT}: ${(await readdir(OUT)).length}`);
