# Assets — what is placed, where, and what is still missing

The one index for imagery. `ASSET-PROMPTS.md` is the *brief* (what to ask Gemini
for); this is the *ledger* (what actually exists and where it is wired).

Update this file whenever an asset lands. If the two disagree, this one is wrong
— check `web/public/` and fix it here.

---

## The rules that are load-bearing

**Transparent alpha, always.** `CategoryArt` composites each file onto a
tone-tinted plate so the same icon works on cream, on the navy band and in dark
mode. A flattened white square looks fine in a file browser and wrong everywhere
it renders.

**Kill the baked drop shadow.** Every Gemini render arrives on white with a soft
grey shadow beneath it. That shadow is invisible on cream and a glaring white
smudge on navy. The build script converts it to black-at-low-alpha, so it reads
as a real shadow on both. Do not skip this step — it is the difference between
"looks fine on the dashboard" and "looks broken in dark mode".

**A missing file is fine.** `art_path` is NULL until the render exists, and a
404 on one that does is caught by `onError`. Both land on the category's Lucide
glyph in the identical plate, so a half-populated set reads as intentional.
Never ship a grey placeholder box — that reads as a rendering fault.

**Never point `art_path` at a file that does not exist.** It works (the fallback
catches it) but it costs a request per render and makes this table lie. Two
categories currently sit at NULL for exactly this reason.

---

## Where things live

| Path | What | Used by |
|---|---|---|
| `web/public/categories/<kind>/<id>.webp` | 384×384, one per MAIN category, foldered by kind | `CategoryArt`, via `categories.art_path` |
| `web/public/art/<name>.webp` | 768×768 empty-state illustrations | `EmptyState imageSrc` |
| `web/public/logos/<slug>.png` | Institution and merchant marks | `MerchantMark` |
| `references/` | The untouched Gemini originals. **Source of truth — never delete.** | the build script |

Categories are foldered by **kind**, matching `categories.kind`:

```
web/public/categories/
  expense/   16 files   food.webp  bills.webp  transport.webp  …
  income/     6 files   salary.webp  business.webp  freelance.webp  …
  transfer/   2 files   cash_out.webp  cash_in.webp
```

The filename is **exactly** the `categories.id`, and the folder is exactly the
`categories.kind` — so `art_path` is derivable rather than remembered:

```sql
art_path = '/categories/' || kind || '/' || id || '.webp'
```

That is why there is no naming decision to make when a new category is added.

The originals keep their meaningless `Gemini_Generated_Image_*` names on
purpose: they are the negatives, and the mapping below is the index into them.
Renaming them in place would make it impossible to tell which have been used.

---

## Platform split

Category art is **shared**. The same object means the same thing on both
platforms, and two different sets would drift.

| Group | Web | Mobile | Note |
|---|---|---|---|
| The 26 category icons | ✅ | ✅ **both** | Identical files. 384×384 covers mobile at any density — a 44–64pt icon needs at most 3× |
| Empty-state room art | ✅ | ✅ **both** | Mobile shows them smaller; 512 is generous but keeps one file |
| Institution / merchant logos | ✅ | ✅ **both** | |
| `art/empty-shop.webp` (welcome hero) | ✅ | ✅ **both** | Replaced the 5.2 MB `store.png`, which was loading full size into a 128px box |

**Mobile is not wired yet, and I did not write into `app/`** — a separate
session owns it. When that session picks this up:

```
app/assets/categories/<id>.webp     <- copy from web/public/categories/
app/assets/art/<name>.webp          <- copy from web/public/art/
```

Expo bundles at build time, so mobile needs a static `require()` map rather than
a path string. `art_path` from the database is a **web URL path**; on mobile,
strip the directory and look the basename up in the map. Do not try to fetch
`/categories/food.webp` over the network from the app.

---

## Category art — 24 of 26 placed

Path = `<kind>/<id>.webp`. All cut from `references/`, background removed,
shadow converted, trimmed to the subject, 384×384.

| Category | File | Source | What it shows |
|---|---|---|---|
| Food · کھانا | `expense/food.webp` | #18 | Chicken karahi, naan, mango juice |
| Bills · بل | `expense/bills.webp` | #13 | K-Electric and SSGC bills, calculator, coins |
| Transport · آمد و رفت | `expense/transport.webp` | #38 | Red motorbike |
| Shopping · خریداری | `expense/shopping.webp` | #47 | Basket with a "SHOPPING خریداری" tag |
| Home · گھر | `expense/home.webp` | #43 | Cottage with a garden |
| Health · صحت | `expense/health.webp` | #12 | First-aid case, stethoscope, medicines |
| Education · تعلیم | `expense/education.webp` | #1 | College building, books, fountain pen |
| Family · اہلِ خانہ | `expense/family.webp` | #31 | Pakistani family portrait diorama |
| Personal · ذاتی نگہداشت | `expense/personal.webp` | #61 | Soap, cream and brush on a tray |
| Leisure · تفریح | `expense/leisure.webp` | #54 | Park with a stream and gazebo |
| Travel · سیر و سفر | `expense/travel.webp` | #44 | Suitcase, Pakistani passport, globe, camera |
| Events · تقریبات | `expense/events.webp` | #25 | Place setting, invitation cards |
| Giving · خیرات و زکوٰۃ | `expense/giving.webp` | #27 | Mosque, hand placing notes, "GIVING" in Urdu |
| Finance · مالی امور | `expense/finance.webp` | #24 | BANK building with cash and a coin |
| Tax · ٹیکس | `expense/tax.webp` | #60 | FBR building with tax papers |
| Other · متفرق | `expense/other.webp` | #22 | Sphere, cube, pyramid — deliberately abstract |
| Salary · تنخواہ | `income/salary.webp` | #37 | Briefcase of PKR notes marked SALARY |
| Business · کاروبار | `income/business.webp` | #69 | Corner shop with a green awning |
| Freelance · فری لانس | `income/freelance.webp` | #28 | Laptop with a freelance dashboard |
| Rental · کرایہ | `income/rental_income.webp` | #58 | Apartment block, RENTAL board, keys |
| Investments · سرمایہ کاری | `income/investment_income.webp` | #15 | Gold bars, ledger, coins |
| Other Income · دیگر آمدنی | `income/income.webp` | #51 | Envelope of PKR notes |
| Cash Out · رقم نکلوانا | `transfer/cash_out.webp` | #20 | ATM dispensing notes |
| Cash In · رقم جمع | `transfer/cash_in.webp` | #57 | Bank teller window |

Where several renders covered the same idea, the most **Pakistani** one won: the
karahi over the burger, the K-Electric bill over the generic one, the motorbike
over the sedan, the FBR building over the generic tax office.

### Still missing — 2

| Category | Expected file | Why nothing fits |
|---|---|---|
| **Transfer · منتقلی** | `transfer.webp` | Nothing in the set shows money moving A → B. Needs: two curved arrows forming a circle between two cards or two small wallets. |
| **To Savings · بچت میں** | `savings.webp` | No piggy bank or savings jar as a standalone object. The closest (#42, #46, #66) are isometric *rooms*, which belong to the empty-state language, not the icon language. Needs: a ceramic piggy bank with one coin above the slot. |

Both currently render their Lucide glyph, which is correct and looks deliberate.

---

## Empty-state art — 10 placed

A different visual language on purpose: these are beige isometric **cutaway
rooms**. A room says "this space is empty"; an object says "this is a category".
Never use one where the other belongs.

| File | Source | Shows | Wired to |
|---|---|---|---|
| `empty-generic.webp` | #63 | Bare shelf, a jar, a plant | Contacts (stand-in) ✅ |
| `empty-entries.webp` | #65 | Desk with a phone and receipts | *not wired yet* |
| `empty-tasks.webp` | #67 | Office desk, laptop, wall clock | Dashboard “Needs You” ✅ |
| `empty-accounts.webp` | #64 | Bank reception with a safe | *not wired yet* |
| `empty-investments.webp` | #66 | Vault door and crates | Investments ✅ |
| `empty-receipts.webp` | #59 | Receipts on a counter | *not wired yet* |
| `empty-budgets.webp` | #42 | Savings jar and books | Budgets ✅ |
| `empty-committee.webp` | #62 | Majlis seating around a low table | *not wired yet* |
| `empty-zakat.webp` | #68 | Prayer mat, arch, lantern | *not wired yet* |
| `empty-shop.webp` | #70 | Corner shop with a green awning | `EmptyState` default, Welcome ✅ |

### Still missing — 1

**`empty-contacts.webp`** — nothing in the set is right. Contacts currently falls
back to `empty-generic.webp`. Needs: an empty isometric room in the same beige
cutaway style with a small telephone table, a notebook and an empty chair.

---

## Not used, and why

**Cannot ship — 3.** #33 Coca-Cola, #39 Sprite, #53 Rani. Real trademarks on
real bottles. Do not put another company's branded product in the product.

**Style clash — 7.** #2 ice cream, #4 lightbulb, #8 burger, #14 pizza, #23 white
building, #30 coffee cup, #45 orange juice. These are photo-real objects on a
pale **grey box**, not the isometric diorama on white that everything else uses.
They cut out badly (the grey is not white enough to flood-fill cleanly) and they
sit at a different eye level from the rest. If you want a food subcategory set
later, they should be re-rendered in the diorama style.

**Good spares — 27.** Kept for subcategory art and future modules: #3 #5 #6 #7
#9 #10 #11 #16 #17 #19 #21 #26 #29 #32 #34 #35 #36 #40 #41 #46 #48 #49 #50 #52
#55 #56 #70. Notable ones worth using soon:

- **#50** petrol station → the Petrol & Fuel subcategory
- **#41** grocery basket → the Kiryana & Grocery subcategory
- **#55** Gas/Water/Electricity bills → a Utilities subcategory
- **#16** government tax office → an alternate for Tax if the FBR mark is a concern
- **#49 / #36** Land Cruiser / sedan → a Car subcategory, distinct from the bike
- **#5 / #11** rental blocks → alternates for Rental
- **#35** analytics laptop → the Reports module hero

---

## WHERE the art actually renders — the 56px rule

`CategoryArt` picks the representation from its **size**, not from the call site:

```
size <  56   ->  the Lucide glyph, on a tone-tinted plate. art_path is not even fetched.
size >= 56   ->  the render, no plate, filling its box.
```

This is not a preference, it is resolution. `food.webp` is a karahi, naan, a
glass, a spoon and a fork; in the 22px box of a category picker it has ~480
pixels to say all of that and resolves to a brown smudge. The glyph is designed
for that size — one weight, one colour, and it takes the category's tone. A
simpler render would not fix it; it would just be a worse glyph.

So the art appears **only** where it is big enough to earn its place:

| Surface | Size | Shows |
|---|---|---|
| Settings → Categories cards | 64px | the render |
| Empty states | 128–160px | the room illustrations |
| Entry rows, pickers, tags, chips, admin | 10–42px | the glyph |

To put the art somewhere new, the box has to be ≥56px. Below that it silently
falls back to the glyph — which is the correct outcome, but it means "I added
the art and nothing changed" is almost always a size problem.

The plate follows the same rule: on for the glyph, which needs a ground to sit
on; off for the render, which is a finished object with its own shadow. Pass
`plate` explicitly to override either way.

---

## Replacing one picture

Three steps, and none of them touch the database or any code:

1. Put the new render in `references/` — **do not delete the old one.**
2. Open `scripts/build-assets.mjs` and point the slug at the new reference
   number:
   ```js
   expense: {
     food: 18,   // <- change this number
   ```
3. `node scripts/build-assets.mjs`

The filename never changes, so `categories.art_path` already points at it and
nothing else needs updating.

**Two things that will catch you out:**

- **The browser caches it.** Same filename, same URL — so a hard refresh
  (Ctrl+Shift+R) is needed to see the change. This is the one situation where
  renaming the file is justified, and then `art_path` must be updated to match
  in the same change.
- **Check it on navy, not just the dashboard.** Every shadow defect in this set
  was invisible on cream and obvious on the dark band.

To find which reference a slug currently uses, the number is in the table above
and in the comment beside it in the script.

---

## Regenerating

The build is a script, not a manual crop, so it can be re-run when a render is
replaced:

```
node scripts/build-assets.mjs             # references/ -> web/public/
```

It reads a `#reference-number -> slug` map at the top. To swap an icon, change
the number and re-run; to add one, add the line. Nothing else changes — the
filename is the contract, and the database already points at it.

The reference numbers are positions in the **alphabetically sorted**
`references/` listing. Dropping a new original into that folder renumbers
everything after it, so if you add originals rather than replace them, re-check
the map against the table above.

### When you replace an image

1. Drop the new render into `references/` (do not delete the old one).
2. Point the slug at the new reference number and re-run.
3. Hard-refresh. **The filename does not change, so browsers and the Next.js
   image cache will serve the old one** until the cache clears. If a replacement
   has to go live immediately, that is the only case for renaming the file —
   and then `categories.art_path` has to be updated to match in the same change.
4. Check it on **navy as well as cream**. Every shadow bug this set had was
   invisible on cream.
