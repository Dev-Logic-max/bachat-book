/**
 * Turn an opaque white-background render into a trimmed transparent PNG.
 *
 * A GLOBAL white threshold is wrong here and would be the obvious mistake: the
 * set contains a white Land Cruiser, a white first-aid case and white paper
 * bills, and thresholding on brightness punches holes straight through them.
 * This flood-fills from the BORDER instead, so only white that is connected to
 * the outside is removed and any white inside the subject survives.
 */
import { createRequire } from "node:module";
import { mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * `sharp` comes from `web/`, where it is a TRANSITIVE dependency of Next rather
 * than a declared one — so a bare `require("sharp")` may not resolve. Try that
 * first and fall back to locating it in the pnpm store, whose directory name
 * carries the version and therefore changes on every upgrade. Hardcoding that
 * path is what makes a build script rot.
 */
export const sharp = (() => {
  const webRequire = createRequire(new URL("../web/index.js", import.meta.url));
  try {
    return webRequire("sharp");
  } catch {
    const store = new URL("../web/node_modules/.pnpm/", import.meta.url);
    const dir = readdirSync(store).find((d) => /^sharp@/.test(d));
    if (!dir) {
      throw new Error(
        "sharp not found. Run `pnpm install` in web/ before building assets.",
      );
    }
    return webRequire(`./node_modules/.pnpm/${dir}/node_modules/sharp`);
  }
})();

const WORK = 1100; // flood-fill resolution — detail without a huge queue

/** Near-white AND near-neutral. A cream wall in a diorama must not qualify. */
function isBackground(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return min >= 228 && max - min <= 18;
}

/**
 * WEBP, NOT PNG.
 *
 * These are photographic 3D renders, which is the worst case for PNG: the same
 * icon is 371 KB as a 512px PNG and 32 KB as a 384px WebP, with no visible
 * difference at the 33–64px they actually render at. The category picker paints
 * two dozen of them at once, so the PNG set was a 7.9 MB page.
 *
 * Palette PNG gets the size down but bands badly on this kind of gradient-heavy
 * artwork, and it is the one artefact that shows up worse when scaled down.
 */
export async function cutout(srcPath, outPath, { size = 384, pad = 0.05, quality = 82 } = {}) {
  const base = sharp(srcPath).resize(WORK, WORK, {
    fit: "inside",
    withoutEnlargement: false,
  });

  const { data, info } = await base
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: w, height: h, channels: ch } = info;
  const alpha = new Uint8Array(w * h).fill(255);
  const seen = new Uint8Array(w * h);

  // BFS from every border pixel. An explicit array queue rather than recursion:
  // a 1100x1100 fill would blow the call stack.
  const queue = [];
  const pushIf = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (seen[i]) return;
    const o = i * ch;
    if (!isBackground(data[o], data[o + 1], data[o + 2])) return;
    seen[i] = 1;
    alpha[i] = 0;
    queue.push(i);
  };

  for (let x = 0; x < w; x += 1) {
    pushIf(x, 0);
    pushIf(x, h - 1);
  }
  for (let y = 0; y < h; y += 1) {
    pushIf(0, y);
    pushIf(w - 1, y);
  }

  while (queue.length) {
    const i = queue.pop();
    const x = i % w;
    const y = (i - x) / w;
    pushIf(x + 1, y);
    pushIf(x - 1, y);
    pushIf(x, y + 1);
    pushIf(x, y - 1);
  }

  /*
   * ENCLOSED BACKGROUND — white that the border fill cannot reach.
   *
   * The transfer icon is two arrows forming a ring, and the hole in the middle
   * is background that happens to be surrounded by subject. A flood from the
   * edges never gets there, so it stayed opaque white: nearly invisible on
   * cream and a bright blob on navy.
   *
   * It cannot simply be "clear all remaining white", because several subjects
   * are legitimately white — the ATM's label, the paper notes, the first-aid
   * case. So a region only qualifies if it is BIG (a real hole, not a
   * highlight) and almost pure white (a printed white object is never a flat
   * 250+ across hundreds of pixels).
   */
  const MIN_HOLE = Math.round(w * h * 0.004);
  const holeSeen = new Uint8Array(w * h);
  for (let start = 0; start < w * h; start += 1) {
    if (holeSeen[start] || alpha[start] === 0) continue;
    const o0 = start * ch;
    if (Math.min(data[o0], data[o0 + 1], data[o0 + 2]) < 244) continue;

    // Collect this connected near-white region, then decide about it as a whole.
    const region = [];
    const stack = [start];
    holeSeen[start] = 1;
    let touchesBorder = false;

    while (stack.length) {
      const i = stack.pop();
      region.push(i);
      const x = i % w;
      const y = (i - x) / w;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touchesBorder = true;

      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (holeSeen[ni] || alpha[ni] === 0) continue;
        const o = ni * ch;
        const min = Math.min(data[o], data[o + 1], data[o + 2]);
        const max = Math.max(data[o], data[o + 1], data[o + 2]);
        if (min < 244 || max - min > 10) continue;
        holeSeen[ni] = 1;
        stack.push(ni);
      }
    }

    if (!touchesBorder && region.length >= MIN_HOLE) {
      for (const i of region) alpha[i] = 0;
    }
  }

  /*
   * THE BAKED DROP SHADOW.
   *
   * Every render sits on a soft grey shadow that is too dark to be caught by the
   * fill above. Left alone it becomes an opaque light-grey blob: invisible on
   * cream, and a glaring white smudge on the navy band and in dark mode — which
   * is exactly where these icons also have to work.
   *
   * It cannot simply be flooded away with a looser threshold, because several
   * subjects ARE light neutral grey (the ATM, the first-aid case, the concrete
   * plinths) and a loose fill eats straight into them.
   *
   * So the shadow is CONVERTED rather than removed: within a short distance of
   * the true background, near-white neutral pixels become black at an alpha
   * derived from how dark they are. Pure white goes to nothing, a light shadow
   * to a faint dark wash. It then reads as a real shadow on cream AND on navy,
   * instead of as a white halo on one of them.
   */
  const SHADOW_REACH = 22; // px at WORK resolution
  const shadow = new Float32Array(w * h);
  let ring = [];
  for (let i = 0; i < w * h; i += 1) if (alpha[i] === 0) ring.push(i);

  for (let step = 0; step < SHADOW_REACH && ring.length; step += 1) {
    const next = [];
    for (const i of ring) {
      const x = i % w;
      const y = (i - x) / w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (seen[ni] || alpha[ni] === 0) continue;
        const o = ni * ch;
        const r = data[o];
        const g = data[o + 1];
        const b = data[o + 2];
        const min = Math.min(r, g, b);
        const max = Math.max(r, g, b);
        // Light and neutral only. A coloured or mid-dark pixel is the subject.
        if (min < 198 || max - min > 16) continue;
        seen[ni] = 1;
        shadow[ni] = 255 - (r + g + b) / 3;
        next.push(ni);
      }
    }
    ring = next;
  }

  // Bounding box of what survived, so the subject fills its frame instead of
  // inheriting whatever whitespace the render happened to have.
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (alpha[y * w + x] !== 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error(`nothing left after cutout: ${srcPath}`);

  // Feather: a sub-pixel blur on the ALPHA ONLY. Without it the cut edge is a
  // hard staircase, which on a 44px plate reads as a rendering artefact.
  // Kept raw in and raw out — a bare `toBuffer()` on a raw input has no format
  // to encode into and throws "unsupported image format".
  const softAlpha = await sharp(Buffer.from(alpha), {
      raw: { width: w, height: h, channels: 1 },
    })
    .blur(0.7)
    .raw()
    .toBuffer();

  /*
   * SHARP RETURNS THREE CHANNELS FOR A ONE-CHANNEL RAW INPUT.
   *
   * It promotes greyscale to RGB on the way out, so `softAlpha` is w*h*3 bytes,
   * not w*h. Indexing it as if it were single-channel reads pixel i's byte from
   * a stride-3 buffer — every alpha value comes from the wrong place, and the
   * result was a set of ghost images with no fully opaque pixel anywhere.
   * Derive the stride instead of assuming it.
   */
  const aStride = softAlpha.length / (w * h);

  // Rebuild RGBA by hand rather than round-tripping through joinChannel, so
  // there is exactly one encode at the end.
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i += 1) {
    const o = i * ch;

    if (shadow[i] > 0) {
      // Black at a low alpha: a shadow, not a grey object.
      rgba[i * 4] = 0;
      rgba[i * 4 + 1] = 0;
      rgba[i * 4 + 2] = 0;
      rgba[i * 4 + 3] = Math.min(255, Math.round(shadow[i] * 0.85));
      continue;
    }

    rgba[i * 4] = data[o];
    rgba[i * 4 + 1] = data[o + 1];
    rgba[i * 4 + 2] = data[o + 2];
    rgba[i * 4 + 3] = softAlpha[i * aStride];
  }

  const cut = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .extract({
      left: minX,
      top: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    })
    .png()
    .toBuffer();

  const inner = Math.round(size * (1 - pad * 2));
  mkdirSync(path.dirname(outPath), { recursive: true });

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: await sharp(cut)
          .resize(inner, inner, {
            fit: "inside",
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .toBuffer(),
        gravity: "centre",
      },
    ])
    // `alphaQuality: 100` deliberately: the whole point of this pipeline is a
    // clean cut edge, and lossy alpha fringes it — which is exactly the defect
    // that would be invisible on cream and obvious on navy.
    .webp({ quality, alphaQuality: 100, effort: 6 })
    .toFile(outPath);

  const coverage = ((maxX - minX + 1) * (maxY - minY + 1)) / (w * h);
  return { coverage };
}
