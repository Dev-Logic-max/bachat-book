# Category icons

26 transparent PNGs, one per MAIN category, named exactly as `categories.art_path`
in the database (`/categories/food.png` → `food.png`).

The full spec and the 26 prompts are in `docs/ASSET-PROMPTS.md` §"Category icons".

Two things that are load-bearing:

- **Transparent alpha, no baked background.** `CategoryArt` composites each file
  onto a tone-tinted plate so the same icon works on cream, on the navy band and
  in dark mode. A flattened white square looks fine in a file browser and wrong
  everywhere it actually renders.
- **A missing file is fine.** `CategoryArt` catches the 404 and falls back to the
  category's Lucide glyph in the identical plate, so a half-populated set reads
  as intentional. Ship them as they are ready; nothing needs a code change.
