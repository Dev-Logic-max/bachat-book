/**
 * Second pass for the slugs whose primary domain returned a 404 or the generic
 * globe placeholder. Each entry is a list tried in order until one yields a
 * real icon.
 */
import { mkdir, writeFile, readdir } from "node:fs/promises";
import path from "node:path";

const OUT = path.resolve("public/logos");
await mkdir(OUT, { recursive: true });

const ALTERNATES = {
  kfc: ["kfc.com.pk", "kfc.com"],
  junaidjamshed: ["jj.com.pk", "junaidjamshed.pk"],
  easypaisa: ["easypaisa.com", "telenorbank.pk", "easypaisa.pk"],
  ssgc: ["ssgc.com", "ssgcl.com.pk"],
  kababjees: ["kababjees.com", "kababjeesrestaurant.com"],
  hbl: ["hbl.com.pk", "hblpeople.com"],
  chaseup: ["chaseup.com.pk", "chaseupstores.com"],
  gulahmed: ["gulahmed.com", "gulahmed.com.pk"],
  mcdonalds: ["mcdonalds.com", "mcdonalds.pk"],
  alfalah: ["bankalfalah.com.pk", "alfalah.com", "bankalfalah.pk"],
  employer: ["systemsltd.com.pk", "systems.com.pk"],
  kelectric: ["kelectric.com", "ke.com", "kesc.com.pk"],
  ubl: ["ubl.com.pk", "ubldirect.com", "ubldigital.com.pk"],
  lesco: ["lesco.com.pk", "lesco.gov.pk"],
};

const url = (d) => `https://www.google.com/s2/favicons?domain=${d}&sz=128`;

const recovered = [];
const stillMissing = [];

for (const [slug, domains] of Object.entries(ALTERNATES)) {
  let done = false;
  for (const domain of domains) {
    try {
      const res = await fetch(url(domain), { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength < 500) continue;
      await writeFile(path.join(OUT, `${slug}.png`), buf);
      recovered.push(`${slug} <- ${domain} (${(buf.byteLength / 1024).toFixed(1)}kb)`);
      done = true;
      break;
    } catch {
      /* try the next domain */
    }
  }
  if (!done) stillMissing.push(slug);
}

console.log(`\nRecovered ${recovered.length}:`);
for (const r of recovered) console.log(`  ${r}`);
if (stillMissing.length) {
  console.log(`\nStill on monogram fallback: ${stillMissing.join(", ")}`);
}
console.log(`\nTotal logos: ${(await readdir(OUT)).length}`);
