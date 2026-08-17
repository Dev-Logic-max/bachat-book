# Bachat Book — 3D asset prompts

Paste these into Gemini as-is. Save results to `Bachat Book/web/public/art/`.

---

## The style, read off your reference

`references/Store.png` sets the direction, and it is a better one than a plain icon
object. What makes it work:

| Element | What it is |
|---|---|
| **Form** | Isometric **miniature diorama** — a small building or scene, open on two sides so the interior is visible |
| **Base** | Light grey stone slab with a bevelled edge, the scene floating on it |
| **Walls** | Warm cream, matte |
| **Trim** | Slim brushed brass / bronze frames on glass |
| **Wood** | Light natural wood shelving and counters |
| **Colour** | Neutral base carrying **small saturated accents** — a green awning, pastel boxes, plants, succulents |
| **Texture** | Real materials, not plastic: rough concrete roof, woven fabric, woven rug, glass |
| **Light** | Bright even studio light, soft contact shadow directly under the slab |
| **Camera** | 3/4 isometric, slightly above, mild perspective |
| **Background** | Pure white |

Two things that go wrong without being asked for explicitly: Gemini writes garbled
pseudo-text on signage and product labels, and it drifts to shiny plastic. Every prompt
below blocks both.

### The recipe, if you want to write your own

1. **Scene** — "Isometric 3D miniature diorama of a …, open on two sides"
2. **Contents** — name 4–6 specific objects, left to right
3. **Materials** — "warm cream matte walls, light natural wood, slim brushed brass frames, woven fabric"
4. **Colour accents** — name 2–3, e.g. "a deep green awning, terracotta pots, small pastel boxes"
5. **Base** — "resting on a light grey stone slab with a bevelled edge, floating"
6. **Light + camera** — "bright even studio lighting, soft contact shadow beneath the slab, 3/4 isometric view slightly from above, 35mm, subtle depth of field"
7. **Negatives** — "Pure white background, absolutely no text, no letters, no numbers, no logos, no signage, no currency symbols, no brand names"
8. **Close** — "Highly detailed, realistic materials, sharp, 8K."

---

## Priority — generate these three first

They unblock the most screens.

### B1 — Kiryana store *(transactions / spending)* · 1:1
> Isometric 3D miniature diorama of a small neighbourhood grocery shop, open on two sides so the interior is visible. Inside: wooden shelves stacked with small pastel-coloured boxes and jars, a wooden counter with a small weighing scale, a basket of colourful vegetables, and a potted monstera. Warm cream matte walls, light natural wood shelving, slim brushed brass window frames, woven jute floor mat. Colour accents: a deep green fabric awning, terracotta plant pots, small pastel product boxes. Resting on a light grey stone slab with a bevelled edge, floating. Bright even studio lighting, soft contact shadow beneath the slab, 3/4 isometric view slightly from above, 35mm, subtle depth of field. Pure white background, absolutely no text, no letters, no numbers, no logos, no signage, no currency symbols, no brand names. Highly detailed, realistic materials, sharp, 8K.

### B2 — Committee circle *(the flagship feature)* · 1:1
> Isometric 3D miniature diorama of a warm sitting room with no front wall, showing a circle of eight floor cushions arranged around a low round wooden table. On the table sits a small brass money box and a folded ledger book. A tall potted palm in one corner, a woven rug covering the floor, a ceiling fan above. Warm cream matte walls, light natural wood, slim brushed brass details, woven textile cushions. Colour accents: deep green and terracotta cushions, a patterned rug in muted jewel tones. Resting on a light grey stone slab with a bevelled edge, floating. Bright even studio lighting, soft contact shadow beneath the slab, 3/4 isometric view slightly from above, 35mm, subtle depth of field. Pure white background, absolutely no text, no letters, no numbers, no logos, no signage, no currency symbols, no people. Highly detailed, realistic materials, sharp, 8K.

### B3 — Empty wallet shelf *(empty states)* · 1:1
> Isometric 3D miniature diorama of a small open shelving unit with three levels, standing alone. On the top shelf an open empty leather wallet lying flat; on the middle shelf a clear empty glass jar with a brass lid; the bottom shelf bare. A single small potted succulent beside the unit. Warm cream matte back panel, light natural wood shelves, slim brushed brass edging. Colour accents: a tan leather wallet, a green succulent in a terracotta pot. Resting on a light grey stone slab with a bevelled edge, floating. Bright even studio lighting, soft contact shadow beneath the slab, 3/4 isometric view slightly from above, 35mm, subtle depth of field. Pure white background, absolutely no text, no letters, no numbers, no logos, no signage, no currency symbols. Highly detailed, realistic materials, sharp, 8K.

---

## The rest

### B4 — Bank branch *(accounts)* · 1:1
> Isometric 3D miniature diorama of a small bank branch, open on two sides. Inside: a wooden teller counter with a brass grille, two waiting chairs, a rounded safe with a brushed brass dial against the back wall, and a tall potted plant. Warm cream matte walls, light natural wood, slim brushed brass frames, polished stone floor. Colour accents: deep navy upholstered chairs, a green plant, a small brass desk lamp. Resting on a light grey stone slab with a bevelled edge, floating. Bright even studio lighting, soft contact shadow beneath the slab, 3/4 isometric view slightly from above, 35mm, subtle depth of field. Pure white background, absolutely no text, no letters, no numbers, no logos, no signage, no currency symbols. Highly detailed, realistic materials, sharp, 8K.

### B5 — Receipt scanning desk *(receipts / OCR)* · 1:1
> Isometric 3D miniature diorama of a small wooden desk scene. On the desk: a smartphone standing upright in a small brass stand angled downward, a long curled paper receipt lying flat below it, a shallow tray holding a few folded paper slips, and a cup of tea. A small potted plant at one corner. Warm cream matte back panel, light natural wood desk, slim brushed brass stand, soft paper textures. Colour accents: a terracotta tea cup, a green plant, a muted teal desk mat. Resting on a light grey stone slab with a bevelled edge, floating. Bright even studio lighting, soft contact shadow beneath the slab, 3/4 isometric view slightly from above, 35mm, subtle depth of field. Pure white background, absolutely no text, no letters, no numbers, no logos, no signage, no currency symbols. Highly detailed, realistic materials, sharp, 8K.

### B6 — Vault room *(investments)* · 1:1
> Isometric 3D miniature diorama of a small vault room, open on two sides. Inside: a heavy rounded safe door with a brushed brass wheel set into the back wall, a wooden plinth holding a neat stack of round coins and one small gold bar, and a low shelf with three sealed document tubes. Warm cream matte walls, light natural wood, brushed brass fittings, polished stone floor. Colour accents: warm gold coins, a deep green rug, a small brass lamp. Resting on a light grey stone slab with a bevelled edge, floating. Bright even studio lighting, soft contact shadow beneath the slab, 3/4 isometric view slightly from above, 35mm, subtle depth of field. Pure white background, absolutely no text, no letters, no numbers, no logos, no signage, no currency symbols. Highly detailed, realistic materials, sharp, 8K.

### B7 — Study desk with wall calendar *(calendar / tasks)* · 1:1
> Isometric 3D miniature diorama of a small study nook, open on two sides. On the back wall a blank grid wall calendar and a round clock; below it a wooden desk with a closed laptop, a pen cup, a stack of three notebooks, and a small desk lamp. A potted plant on the floor beside the desk, a woven rug underneath. Warm cream matte walls, light natural wood, slim brushed brass lamp, woven textile. Colour accents: a mustard notebook, a deep green plant, a muted blue rug. Resting on a light grey stone slab with a bevelled edge, floating. Bright even studio lighting, soft contact shadow beneath the slab, 3/4 isometric view slightly from above, 35mm, subtle depth of field. Pure white background, absolutely no text, no letters, no numbers, no logos, no signage, no calendar dates, no clock numerals. Highly detailed, realistic materials, sharp, 8K.

### B8 — Giving scene *(Zakat / charity)* · 1:1
> Isometric 3D miniature diorama of a small alcove with an arched opening, open at the front. Inside: a wooden plinth holding a shallow brass bowl filled with round coins, a folded prayer mat rolled at one side, and a hanging brass lantern above. A geometric eight-pointed star pattern tiled flat into the floor. Warm cream matte walls, light natural wood, brushed brass bowl and lantern, woven textile. Colour accents: a deep green prayer mat, warm gold coins, muted teal floor tiles. Resting on a light grey stone slab with a bevelled edge, floating. Bright even studio lighting, soft contact shadow beneath the slab, 3/4 isometric view slightly from above, 35mm, subtle depth of field. Pure white background, absolutely no text, no letters, no numbers, no logos, no signage, no calligraphy, no currency symbols. Highly detailed, realistic materials, sharp, 8K.

### B9 — Pakistani home exterior *(onboarding hero)* · 16:9
> Isometric 3D miniature diorama of a modern two-storey Pakistani town house with a small front garden and a low boundary wall with a brass gate. A parked scooter beside the gate, two potted plants either side of the front door, a rooftop water tank, and a small satellite dish. Warm cream matte plaster walls, light natural wood door, slim brushed brass gate and window grilles, textured concrete roof. Colour accents: a deep green front door, terracotta pots, a small patch of grass. Resting on a light grey stone slab with a bevelled edge, floating. Bright even studio lighting, soft contact shadow beneath the slab, 3/4 isometric view slightly from above, 35mm, subtle depth of field. Pure white background, absolutely no text, no letters, no numbers, no logos, no signage, no house numbers. Highly detailed, realistic materials, sharp, 8K.

### B10 — Tipped shop sign *(404 / error)* · 1:1
> Isometric 3D miniature diorama of a small blank wooden signboard on two posts, tipped over and leaning at an angle, with one post lifted off the ground. A single terracotta pot rolled onto its side beside it, a few loose leaves scattered. Warm cream matte board face, light natural wood posts, slim brushed brass corner brackets. Colour accents: a terracotta pot, a few green leaves. Resting on a light grey stone slab with a bevelled edge, floating. Bright even studio lighting, soft contact shadow beneath the slab, 3/4 isometric view slightly from above, 35mm, subtle depth of field. Pure white background, absolutely no text, no letters, no numbers, no logos, no signage. Highly detailed, realistic materials, sharp, 8K.

---

## Category icons — 26 renders, and a DIFFERENT style to the dioramas

> [!IMPORTANT]
> These are **not** dioramas. A diorama is a scene that needs 400px to read; a
> category icon renders at **42px** in a settings tile and 22–30px in a picker
> row. At that size a room full of furniture is a smudge. This set is **one
> object, centred, on transparent**.
>
> The dioramas above stay as they are — they are page-level art (empty states,
> onboarding heroes). Do not mix the two.

The 26 main categories each carry an `art_path` in the database. The file is
looked up by that path, so **the filename must match exactly**; anything missing
falls back to a tinted Lucide glyph, which is a designed state rather than a
hole, so a partial set ships fine.

### The spec

| | |
|---|---|
| **Form** | ONE object (or one tight cluster of 2–3), centred, filling ~85% of the frame |
| **Background** | **Transparent PNG with alpha.** Not white, not grey |
| **Size** | 512×512, square |
| **Light** | Bright even studio light, soft contact shadow directly beneath the object |
| **Camera** | Slight 3/4 view, a little above eye level, mild perspective |
| **Materials** | Matte realistic — ceramic, wood, fabric, brushed metal. **Never shiny plastic** |
| **Colour** | Each object in its own natural colours, moderately saturated |
| **Text** | None. Ever |

**Transparent is load-bearing, not a preference.** `CategoryArt` composites each
icon onto a tone-tinted plate using `color-mix(… 14%, transparent)`, which is
what lets the same file sit on cream, on `surface-subtle`, on the navy band and
in dark mode. A baked-in light-grey square glows in dark mode and clashes on
navy — that is exactly the bug that put eleven wrong institution logos on screen.

### The prompt

Paste this, replacing `<SUBJECT>`:

> A single 3D rendered icon of **`<SUBJECT>`**, centred and filling most of the frame.
> Soft matte realistic materials, natural moderately-saturated colours, bright even
> studio lighting with a soft contact shadow directly beneath the object. Slight
> three-quarter view from just above, mild perspective, 35mm.
> **Transparent background with alpha, absolutely no background, no ground plane, no
> text, no letters, no numbers, no logos, no signage, no currency symbols, no brand
> names.** Highly detailed, sharp, clean edges, 512×512, 8K quality.

### The 26 subjects

Save to `web/public/categories/`. Filename is exact.

**Expense — 16**, in the order they appear in the app:

| # | Category | Urdu | File | `<SUBJECT>` |
|---|---|---|---|---|
| 1 | Food | کھانا | `food.png` | a steaming bowl of curry beside two stacked rotis |
| 2 | Bills | بل | `bills.png` | an electricity meter with a small paper bill tucked under it |
| 3 | Transport | آمد و رفت | `transport.png` | a small white hatchback car, three-quarter front view |
| 4 | Shopping | خریداری | `shopping.png` | two paper shopping bags, one tipped slightly, with folded fabric showing |
| 5 | Home | گھر | `home.png` | a small two-storey house with a flat roof and a boundary wall |
| 6 | Health | صحت | `health.png` | a stethoscope coiled beside a small bottle of tablets |
| 7 | Education | تعلیم | `education.png` | a graduation cap resting on two stacked books |
| 8 | Family | اہلِ خانہ | `family.png` | three simple rounded figures of different heights standing together |
| 9 | Personal | ذاتی نگہداشت | `personal.png` | a pair of scissors, a comb and a small soap bar grouped together |
| 10 | Leisure | تفریح | `leisure.png` | a game controller resting against a small television |
| 11 | Travel | سیر و سفر | `travel.png` | a rolling suitcase with a small aeroplane banking above it |
| 12 | Events | تقریبات | `events.png` | a tiered decorated cake with a small floral garland |
| 13 | Giving | خیرات و زکوٰۃ | `giving.png` | two open cupped hands holding a small brass bowl |
| 14 | Finance | مالی امور | `finance.png` | a classical bank building with four columns |
| 15 | Tax | ٹیکس | `tax.png` | a long paper receipt curling out of a small government-style stamp |
| 16 | Other | متفرق | `other.png` | a plain rounded label tag with a small ring |

**Income — 6:**

| # | Category | Urdu | File | `<SUBJECT>` |
|---|---|---|---|---|
| 17 | Salary | تنخواہ | `salary.png` | a leather briefcase with a small fan of banknotes beside it |
| 18 | Business | کاروبار | `business.png` | a small shop front with a striped awning and a closed shutter |
| 19 | Freelance | فری لانس | `freelance.png` | an open laptop with a small globe beside it |
| 20 | Rental | کرایہ | `rental.png` | a small apartment block with a key resting against it |
| 21 | Investments | سرمایہ کاری | `investments.png` | three stacked gold coins with a small rising arrow behind them |
| 22 | Other Income | دیگر آمدنی | `other-income.png` | an open envelope with folded banknotes emerging |

**Transfer — 4:**

| # | Category | Urdu | File | `<SUBJECT>` |
|---|---|---|---|---|
| 23 | Transfer | منتقلی | `transfer.png` | two curved arrows forming a circle between two small cards |
| 24 | Cash Out | رقم نکلوانا | `cash-out.png` | an ATM machine dispensing a single banknote |
| 25 | Cash In | رقم جمع | `cash-in.png` | a small bank counter window with a stack of notes on the ledge |
| 26 | To Savings | بچت میں | `savings.png` | a ceramic piggy bank with one coin above its slot |

**Reinforce the negatives on every one.** The diorama set shows why: several came
back with legible signage and one with the sign mirrored. Baked-in English also
blocks Urdu later, because the text is part of the pixels.

---

## After generating

1. **Look at each one at full size before it goes in.** Text artefacts on signage or labels, shiny plastic instead of matte, or a camera angle inconsistent with the rest of the set all mean regenerate — do not build on a weak asset.
2. Save originals to `Bachat Book/web/public/art/` as `b1-kiryana.png`, `b2-committee.png`, and so on. **Category icons go to `web/public/categories/` instead**, under the exact filenames in the table above.
3. **Check the category icons at 42px, not at 512.** That is the size they actually render at in the settings tile, and it is where an over-detailed object turns to mush. Anything unreadable small needs a simpler subject, not a sharper render.
4. **Confirm the alpha channel survived.** A PNG saved with a flattened white background looks identical in a file browser and wrong on the navy band and in dark mode. Open one on a dark surface before generating the other 25.
3. Gemini output usually arrives on **off-white with a slight vignette**, not pure white — it shows as a grey rectangle on the cream canvas. Either knock the background out once and save WebP, or render with the `.render-blend` class already in `globals.css` (`mix-blend-mode: multiply`).
4. Convert to WebP at roughly 2× the rendered size. These are large PNGs; unconverted they will dominate page weight.
