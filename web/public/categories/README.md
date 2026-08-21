# Category icons

512×512 transparent PNGs, one per MAIN category, named exactly as the category's
**id** — which is also what `categories.art_path` points at
(`/categories/food.png` → `food.png`).

**Do not hand-edit these files.** They are generated:

```
node scripts/build-assets.mjs          # references/ -> here
```

The originals live in `references/`, and the full index — which reference each
icon came from, what is still missing, and what mobile should do — is in
`docs/ASSETS.md`. That doc is the ledger; this folder is its output.

Three things that are load-bearing:

- **Transparent alpha, no baked background.** `CategoryArt` composites each file
  onto a tone-tinted plate so the same icon works on cream, on the navy band and
  in dark mode. A flattened white square looks fine in a file browser and wrong
  everywhere it actually renders.
- **No white drop shadow.** The Gemini originals sit on a soft grey shadow that
  is invisible on cream and a glaring smudge on navy. The build script converts
  it to black-at-low-alpha so it reads as a real shadow on both. Always check a
  new icon on the navy band, not just the dashboard.
- **A missing file is fine.** `CategoryArt` catches the 404 and falls back to the
  category's Lucide glyph in the identical plate, so a half-populated set reads
  as intentional. But prefer leaving `art_path` NULL over pointing it at a file
  that does not exist — the fallback is for accidents, not for planning.

Currently 24 of 26. `transfer` and `to_savings` have no suitable render yet and
sit at `art_path = NULL`; see `docs/ASSETS.md` for what they need.
