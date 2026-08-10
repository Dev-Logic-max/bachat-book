# Bachat Book — React Native mobile app implementation plan

**Finalized 2026-08-10.** Revised same day after a second-pass audit that caught
six errors — two of which would have produced silently broken code.

This is `ROADMAP.md` **P5**. The mobile app introduces **no new tables** except
`receipt_line_items` (coordinated with web M8), and **must not** fork the schema.

---

## 0. Read before writing code

1. `CLAUDE.md` — product rules and the Traps list. Most apply here verbatim.
2. `docs/ROADMAP.md` §1 — module scope and acceptance tests.
3. `db/migrations/0004_m2_m6_baseline.sql` — the actual schema.
4. `db/migrations/0011_entry_transaction_link.sql` — the entry ↔ transaction bridge.
5. `design-brain/SPEC.md` §2, §4, §7 — mobile composition patterns, radii, density.

**The rules that will bite you fastest:**

- **Money is `bigint` paisa.** JavaScript numbers are safe to ~9×10¹⁵, so paisa
  is fine in JS, but never let a float into a write path. Format to rupees only
  at render.
- **Every tenant row carries `household_id`.** RLS enforces it server-side; the
  app must still scope every query, or you get an empty list and no error.
- **The layout never mirrors.** Urdu changes text direction inside text nodes
  only. Do **not** enable `I18nManager.forceRTL` — it flips the entire native
  layout tree and gives you a second UI to maintain. This is the single most
  expensive mistake available in this codebase.
- **Sign convention differs between tables.** `quick_entries.amount_paisa` is
  UNSIGNED + a `type` of `income`/`expense`. `transactions.amount_paisa` is
  SIGNED (positive = income, negative = expense). The sync triggers handle the
  conversion — do not duplicate it client-side.
- **Quick Entry is the primary add.** `quick_entries` is the fast daily log.
  The optional "Link to account" creates a matching `transactions` row via
  trigger. Default is unlinked (standalone entry).

---

## 0.5. Bugs in the previous draft — corrections applied

> [!CAUTION]
> Two of these would have produced silently broken code. The rest change scope.

### Would have crashed or corrupted

1. **`preferences.locale` does not exist.** The column is `profiles.locale`.
   Querying `preferences.locale` returns a Postgres error, not a fallback.
   Every locale read in this plan now targets `profiles.locale`.

2. **There are zero Storage buckets in the project.** The receipt plan said
   "store originals in a bucket `receipts`" — there is nothing to upload to.
   `profiles.avatar_url` has the same problem on web. The bucket must be created
   via migration or dashboard **before** any upload code runs.

### Change scope

3. **`notifications` table does not exist.** What exists is `push_subscriptions`,
   which is Web Push shaped (`endpoint` + `keys` jsonb). An Expo push token is
   one opaque string with no keys — the table cannot hold it as-is. Migration
   `0013_push_targets.sql` in the plan widens it.

4. **`receipts` has nowhere to put an extraction.** No `status`, no
   `extracted_data` jsonb, no `confidence`, no `receipt_line_items`. The table
   is a bare metadata row. Migration `0012` adds the extraction lifecycle.

5. **Web M8 is not "a bare uploader."** `receipts/page.tsx` has **no file input
   at all** and hardcodes `file_path: "/logos/imtiaz.png"` on every insert.
   W1/W2 web work is bigger than the old plan assumed.

6. **`committees` is a solo tracker** with one row. `committee_members` and
   `committee_payments` don't exist. The XIRR benchmark needs M5's `nss_rates`,
   which also doesn't exist. **Mobile committee is read-only in v1** — that is
   honestly all the schema supports today.

---

## 1. Decisions locked

| Decision | Answer |
|---|---|
| Platform | **Android-only** for v1 (iOS kept building but not targeted) |
| Offline | **Full offline-first** — TanStack Query read cache + **expo-sqlite write outbox** |
| Biometric | **Opt-in**, prompted once after **second** successful sign-in |
| AI Copilot | **Skip** for mobile v1 |
| Expo SDK | **54+** with config-plugin (prebuild) workflow |
| Styling | **StyleSheet.create** with shared token objects (`src/theme/tokens.ts`) |
| State/Cache | **TanStack Query** with AsyncStorage persister (read cache only) |
| Primary Add | **Quick Entry** with optional account link |
| Receipt capture | **Yes** — web backend (Edge Function + `receipt_line_items` table) first, then mobile capture |
| Notifications v1 | **Local scheduling only** — bill due, committee turn, Zakat hawl computed on-device. Token registered now for server push later. |

### Decisions made rather than block on (reversible — flagged in §1)

- **Biometrics after second sign-in**, not first — default-on adds friction at
  the exact moment an app gets abandoned.
- **Local notifications in v1.** Bill due, committee turn and Zakat hawl are all
  computable from data already on the phone; works offline and needs no server.
  The Expo token still gets registered now, so turning on server push later is a
  server change, not a new app release.
- **No AI Copilot on mobile.** It's in the web rail but in no roadmap module —
  mobile doesn't inherit unscoped surfaces.

---

## 2. Tech stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Expo SDK 54+ (prebuild) | OTA updates, EAS Build, dev builds for native modules |
| Navigation | expo-router v4 (file-based) | Mirrors Next.js App Router mental model, typed routes |
| State/Cache | TanStack Query 5 + AsyncStorage persister | Handles **read cache** + offline elegantly |
| Data | @supabase/supabase-js | Same client as web, no REST wrapper needed |
| Offline outbox | **expo-sqlite** + NetInfo | A queue with ordering, retry counts and status is a table — rewriting a JSON blob on every mutation is how offline queues lose writes |
| Styling | StyleSheet.create + tokens.ts | Native performance, tokens ported from web globals.css |
| Forms | React Hook Form + Zod | Same validation schemas as web |
| Camera/OCR | expo-camera → Edge Function | Reuse server-side OCR; Anthropic key stays on server |
| Biometrics | expo-local-authentication | Fingerprint + Face ID |
| Push | expo-notifications (local in v1) | Budget alerts, committee reminders — local scheduling |
| i18n | i18n-js + expo-localization | English default, Urdu strings; layout stays LTR |
| Charts | victory-native (Reanimated 3) | Animated, touch-friendly charts |
| Bottom sheet | @gorhom/bottom-sheet 5 | Quick-add, date entries, filters |
| Gestures | react-native-gesture-handler + Reanimated | Swipe actions, pull-to-refresh |

---

## 2.4. Offline idempotency — the line that matters most

Full offline means retries, and retries move money twice. The mechanism is
**client-generated UUIDs** — the device makes the row's uuid and sends it, so a
retry is a primary-key conflict rather than a second salary:

```typescript
// Every INSERT from the app uses upsert with the client-generated UUID
supabase
  .from('quick_entries')
  .upsert(row, { onConflict: 'id', ignoreDuplicates: true })
```

This needs **no new columns** — every table already has a uuid PK. It **does**
need someone to verify the balance trigger fires exactly once under `upsert`,
which is a check, not a migration.

> [!IMPORTANT]
> Before any offline write code ships, run this test **through the REST API**,
> signed in as a real user, not as `postgres`:
> `INSERT` a row into `quick_entries` with a known UUID, then `upsert` the same
> UUID with `ignoreDuplicates: true`. Confirm the account balance moved exactly
> once and only one row exists.

**Why this works, so nobody "fixes" it later.** `ignoreDuplicates: true` sends
`Prefer: resolution=ignore-duplicates`, which PostgREST turns into
`ON CONFLICT DO NOTHING`. No row is inserted on the replay, so `AFTER INSERT`
triggers — including `sync_account_balance` — never run. **This is not a
`pg_trigger_depth()` problem.** That guard exists to stop the two `0011` sync
triggers recursing into each other; it has nothing to do with duplicate inserts,
and adding it to the balance trigger would break the case where an entry-side
edit must re-settle the balance (`0011` §6 says so explicitly). If the test
fails, the cause is somewhere else — find it, do not reach for the depth guard.

---

## 3. Project structure

```
app/                          # Expo app, sibling to web/
├── app/                      # expo-router routes
│   ├── _layout.tsx           # Root layout — auth gate + providers
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── sign-in.tsx
│   │   ├── sign-up.tsx
│   │   └── forgot-password.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx       # Bottom tab navigator (floating island)
│   │   ├── index.tsx         # Overview / Dashboard
│   │   ├── transactions.tsx  # Entry list + FAB
│   │   ├── accounts.tsx      # Account cards
│   │   ├── calendar.tsx      # Calendar heat-map
│   │   └── committees.tsx    # Committee list (READ-ONLY v1)
│   ├── entry/
│   │   ├── [id].tsx          # Entry detail / edit
│   │   └── new.tsx           # Quick-add (full screen)
│   ├── account/
│   │   └── [id].tsx          # Account ledger
│   ├── receipt/
│   │   ├── capture.tsx       # Camera capture
│   │   └── review.tsx        # Extraction review
│   ├── committee/
│   │   └── [id].tsx          # Committee detail (READ-ONLY v1)
│   └── settings/
│       └── index.tsx         # Profile, workspace, theme, biometric
├── src/
│   ├── components/
│   │   ├── ui/               # Button, Card, Input, Badge, Avatar, Switch
│   │   ├── BottomNav.tsx     # Floating island nav (SPEC §2.4)
│   │   ├── EntryCard.tsx
│   │   ├── AccountCard.tsx
│   │   ├── QuickAddSheet.tsx # Bottom sheet quick-add
│   │   ├── StatCard.tsx
│   │   ├── CategoryIcon.tsx  # Renders category images (see §7.1 asset pipeline)
│   │   ├── MerchantMark.tsx  # Brand mark with monogram fallback
│   │   ├── SwipeActions.tsx  # Swipe-to-edit / delete
│   │   ├── DeleteConfirm.tsx # Named-record delete modal
│   │   └── T.tsx             # Urdu text wrapper (writingDirection: 'auto')
│   ├── hooks/
│   │   ├── use-entries.ts    # TanStack Query + Supabase for quick_entries
│   │   ├── use-accounts.ts   # TanStack Query + Supabase for accounts
│   │   ├── use-transactions.ts
│   │   ├── use-categories.ts
│   │   ├── use-committees.ts
│   │   ├── use-session.ts    # Auth state + household resolution
│   │   └── use-offline-queue.ts
│   ├── lib/
│   │   ├── supabase.ts       # Client with AsyncStorage, detectSessionInUrl: false
│   │   ├── outbox.ts         # expo-sqlite write queue manager
│   │   ├── format.ts         # Port from web/src/lib/format.ts
│   │   ├── constants.ts
│   │   └── query-client.ts   # TanStack Query + AsyncStorage persister (reads only)
│   ├── providers/
│   │   ├── auth-provider.tsx
│   │   ├── query-provider.tsx
│   │   └── theme-provider.tsx
│   ├── theme/
│   │   ├── tokens.ts         # Colors, spacing, radii, typography
│   │   ├── shadows.ts        # Platform-specific shadows
│   │   └── styles.ts         # Shared StyleSheet.create patterns
│   └── i18n/
│       ├── en.json           # English strings
│       └── ur.json           # Urdu strings
├── assets/
│   ├── categories/           # Processed: bg-removed, square-cropped, 256px WebP
│   ├── 3d/                   # Isometric dioramas for empty states + headers
│   ├── logos/                # 67 Pakistani brand marks (from web/public/logos)
│   ├── fonts/                # Fraunces, Inter, JetBrains Mono, Noto Nastaliq
│   └── images/               # Splash, icon, adaptive-icon
├── types/
│   └── database.ts           # Copied from web/src/lib/supabase/types.ts
├── app.config.ts
├── eas.json
├── metro.config.js
├── tsconfig.json
└── package.json
```

---

## 4. Navigation map

```
Root _layout (auth gate)
├── (auth)/
│   ├── sign-in
│   ├── sign-up
│   └── forgot-password
└── (tabs)/
    ├── Overview          ← default tab
    ├── Transactions
    │   └── → entry/new   (push)
    │   └── → entry/[id]  (push)
    ├── [FAB center]      → entry/new (push)
    ├── Accounts
    │   └── → account/[id] (push)
    └── Calendar

    Committees (5th tab or from Overview — READ-ONLY v1)
    └── → committee/[id]  (push, view only)

    Settings (gear icon in header, not a tab)
    Receipt capture (from entry/new camera button)
    └── → receipt/capture → receipt/review
```

---

## 5. Screen order — ship in this sequence

Do **not** start with the dashboard. **M3 (offline layer) before any screen that
writes is non-negotiable.** Retrofitting an outbox under screens that already
call Supabase directly means rewriting all of them.

| # | Screen | Why here |
|---|---|---|
| 1 | Scaffold + theme + Supabase client | Nothing compiles without it |
| 2 | Auth (sign in / sign up / reset) + biometric prompt | Nothing works without a session |
| 3 | **Offline layer (expo-sqlite outbox + TanStack cache)** | **Must exist before any screen writes data** |
| 4 | Overview + floating bottom nav | Proves session, household scoping, money formatting |
| 5 | Entries (list + add + edit + delete) | The primary capture loop; most-used screen |
| 6 | Accounts + ledger | Second most used |
| 7 | Receipt capture | **The reason the mobile app exists** |
| 8 | Calendar | Bills and committee dates |
| 9 | Committee (read-only) + Settings + push | Polish + remaining screens |
| 10 | EAS Build, Play Store internal track | Release |

Everything else — budgets, Zakat, tax, reports, admin, AI — stays web-only for v1.
A phone is for *capture and glance*, not for filing your taxes.

---

## 6. Foundation

### 6.1 Supabase client and session storage

```typescript
// src/lib/supabase.ts
import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import { AppState } from 'react-native'
import type { Database } from '../../types/database'

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL!
const KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

export const supabase = createClient<Database>(URL, KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,   // REQUIRED — without this sign-in hangs on native
  },
})

// Refresh only while foregrounded — saves battery
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh()
  else supabase.auth.stopAutoRefresh()
})
```

**⚠️ `detectSessionInUrl: false` is not optional.** Leaving it true makes sign-in
hang on native because there is no URL to read.

**⚠️ Never put the `service_role` key in the app.** The publishable key plus RLS
is the whole security model — same as web.

### 6.2 Deep links

`app.config.ts` sets `scheme: "bachatbook"`. Register in Supabase →
Authentication → URL Configuration:

```
bachatbook://auth/callback
```

Password reset and (later) Google OAuth both land here.

> [!NOTE]
> `bachatbook://join` is **dropped from v1**. There is no `household_invites`
> table (`IMPLEMENTATION-PLAN.md §4 M1`), so the link would resolve to nothing.
> Add it the day M1 invites land, not before.

### 6.3 TanStack Query + offline read cache

```typescript
// src/lib/query-client.ts
import { QueryClient } from '@tanstack/react-query'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,    // 5 min
      gcTime: 24 * 60 * 60 * 1000, // 24 hr cache
      retry: 2,
    },
  },
})

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'BACHAT_QUERY_CACHE',
})
```

Pakistani mobile data is intermittent; a finance app that shows a spinner on the
bus is a deleted app. Cached reads render instantly, then revalidate.

> [!IMPORTANT]
> AsyncStorage is for the **read cache only** (TanStack Query persister).
> The **write outbox** uses expo-sqlite — see §6.4.

### 6.4 Offline write outbox (expo-sqlite)

The outbox is an SQLite table, not a JSON blob in AsyncStorage. A queue with
ordering, retry counts and status is a relational table; rewriting a JSON blob
on every mutation is how offline queues lose writes under concurrent access.

```typescript
// src/lib/outbox.ts
import * as SQLite from 'expo-sqlite'

const db = SQLite.openDatabaseSync('bachat_outbox.db')

// Initialize on app start
db.execSync(`
  CREATE TABLE IF NOT EXISTS outbox (
    id TEXT PRIMARY KEY,           -- client-generated UUID (same as the row's PK)
    table_name TEXT NOT NULL,
    action TEXT NOT NULL,          -- 'INSERT' | 'UPDATE' | 'DELETE'
    payload TEXT NOT NULL,         -- JSON
    household_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    retries INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'inflight' | 'failed'
    error TEXT
  )
`)

// On user action:
//   Online  → Supabase write (client UUID) → update TanStack cache
//   Offline → INSERT into outbox → optimistic TanStack update
//           → show pending indicator on the row
//
// On reconnect (NetInfo listener):
//   SELECT * FROM outbox WHERE status = 'pending' ORDER BY created_at ASC
//   Replay in FIFO order — SEE THE REPLAY TABLE BELOW, the verb differs per action
//   Max retries: 3 for transient failures only, then status = 'failed'
//   DELETE FROM outbox WHERE id = ? on 2xx
```

**The replay verb differs per action. Using `upsert` for all three is a bug.**

| Action | Verb | Why not upsert |
|---|---|---|
| `INSERT` | `.upsert(row, { onConflict: 'id', ignoreDuplicates: true })` | This is the idempotency mechanism. A replayed insert hits the PK conflict, `ON CONFLICT DO NOTHING` fires, **no row is written and no AFTER INSERT trigger runs**. |
| `UPDATE` | `.update(patch).eq('id', id)` | `ignoreDuplicates: true` on an existing row is a **silent no-op** — the edit is dropped and the outbox reports success. This is the failure mode that loses a user's correction without an error anywhere. |
| `DELETE` | `.delete().eq('id', id)` | Naturally idempotent. A second delete affects 0 rows and returns 2xx. |

> [!CAUTION]
> `ignoreDuplicates: true` is **first-write-wins**, not last-write-wins. The
> conflict rule for this app is last-write-wins, and it is delivered by the
> `UPDATE` path above, not by upsert. Do not describe upsert as last-write-wins.

**Distinguish transient from permanent failures.** Retrying all failures 3× just
delays a permanent error by 30 seconds:

- **Transient** (network error, 5xx, timeout) → back off and retry, max 3.
- **Permanent** (4xx: RLS rejection, check-constraint violation, and especially
  `assert_entry_link_valid` raising on an account with
  `allow_entry_link = false`) → mark `failed` **immediately** and surface the
  server's message verbatim. It will never succeed.

Failed rows appear in a **"Not synced (2)"** banner the user can tap to inspect,
retry or discard. Never silently drop a write; never retry one forever.

**Ordering with dependencies.** FIFO by `created_at` is correct as long as a row
whose payload references an id still `pending` is held back — an entry linked to
an account created offline must flush *after* that account.

**Generating the UUID.** Hermes has no `crypto.randomUUID`. Use `expo-crypto`:

```typescript
import { randomUUID } from 'expo-crypto'
const id = randomUUID()      // becomes both the outbox key and the row's PK
```

**Optimistic rows are not editable until they land.** Editing an unflushed insert
means reconciling two payloads; forbid it in v1 and grey the edit affordance.

**Local optimistic view must apply the same sign conversion the server trigger
does** — `quick_entries` is unsigned + `type`, `transactions` is signed. Get this
wrong and the screen shows one number while the server stores another.

### 6.5 Photo queue (expo-sqlite + expo-file-system)

Owner chose full offline **including receipt capture**. A photo is not a JSON
payload — it needs its own table, a disk budget and a cleanup pass.

```typescript
db.execSync(`
  CREATE TABLE IF NOT EXISTS photo_queue (
    id           TEXT PRIMARY KEY,    -- same UUID as the receipts row
    local_uri    TEXT NOT NULL,       -- documentDirectory + 'outbox/<id>.jpg'
    household_id TEXT NOT NULL,
    bytes        INTEGER NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    retries      INTEGER NOT NULL DEFAULT 0,
    status       TEXT NOT NULL DEFAULT 'pending'
  )
`)
```

- Capture writes the **already-downscaled** JPEG to
  `FileSystem.documentDirectory + 'outbox/'` and queues the `receipts` row in the
  write outbox with the same UUID — so the storage path
  `receipts/<household_id>/<id>.jpg` is known before the upload happens.
- **Upload on unmetered connection by default**, with an "Upload on mobile data"
  toggle in Settings. Twenty 300KB receipts on a metered Pakistani connection is
  a real cost and will be noticed.
- **Delete the local file on confirmed upload.** On every cold start, delete
  orphans in `outbox/` that have no matching `photo_queue` row.
- **Hard caps: 200MB total or 30 days.** On exceeding, refuse new captures with a
  message naming the queue depth. Never silently evict a receipt the user
  believes is saved.
- Settings → Storage shows queue depth and total size, with "Upload now" and a
  "Discard queue" that names what it will destroy.

---

## 7. Design system — port, do not reinvent

The web tokens in `web/src/app/globals.css` are the source. Mirror them into
`src/theme/tokens.ts` as plain objects. Same names, same values.

| Web | Native |
|---|---|
| `bg-canvas` `#F8F6F1` | `colors.canvas.light` |
| `bg-navy-900` `#0B1A33` | `colors.navy900.light` |
| `bg-brass` `#C6A15B` | `colors.brass.light` |
| `rounded-card` 14px web | `radius.card` **24px mobile** |

**Radii differ from web on purpose.** `SPEC.md §4` puts mobile in a **20–28px**
band; the web app's 10/14/18/22 is app-density for a desktop screen. Use the
larger band here.

Other carry-overs:

- **Dark mode inverts the band relationship.** In light, navy is the dark mass
  on cream. In dark it must be *lighter* than the canvas or it disappears.
- **Tabular numerals** on every money figure. On native set
  `fontVariant: ['tabular-nums']`. The `.tnum` class also forces LTR
  isolation — on native use `writingDirection: 'ltr'` on the money `<Text>`.
  **Required**, or Urdu renders `-Rs 899` as `Rs 899-`.
- **Floating bottom nav, not a flat bar** (`SPEC §2.4`) — inset from the edges,
  lifted off the bottom, real shadow, active item in a filled brass circle.
- Fonts: Fraunces (display), Inter (UI), JetBrains Mono (money), Noto Nastaliq
  Urdu. Load with `expo-font`; Nastaliq needs roughly double the line height of
  Latin or the strokes collide.

### 7.1 Asset pipeline — what goes in the bundle

> [!WARNING]
> The raw design-brain images are 2816×1536 PNGs. Bundling 37 raw adds ~100MB
> to the APK — larger than the rest of the app.

| Folder | What it is | Mobile action |
|---|---|---|
| `design-brain/Images/` (49) | UI reference screenshots | **Do not bundle.** Screenshot loop only. |
| `design-brain/3D Images/` (17) | Isometric dioramas | Bundle for empty states + screen headers. One per screen. Resize to ~512px WebP. |
| `design-brain/Categories Images/` (28) | Single objects on pure white | **Need processing**: bg removal + square crop + 256px WebP. Raw white ground on `#F8F6F1` canvas shows a visible square. |
| `design-brain/Items/` (16) | Contact sheets — numbered 5-across grids of Pakistani SKUs (Dawn Bread, Bake Parlor, Olper's, K&N's) | **v2 only.** ~300 individual images once sliced. These are for receipt line items, not categories. Its own session. |

**Convention over migration for category icons:** `categories/<category.id>.webp`,
falling back to the Lucide icon + tone color that already exist in the schema.
Zero schema change; same filename works in `web/public/` and the Expo bundle.

---

## 8. Urdu on native

- Translate with `i18n-js`, sourcing the **same** string catalogue the web app
  uses. Do not fork the string catalogue.
- Locale comes from **`profiles.locale`** on the server, falling back to
  `expo-localization`. Persist the user's choice back to the DB so web and
  mobile agree.
- Wrap translated copy in a `<T>` equivalent that sets
  `writingDirection: 'auto'`. Numbers, dates and brand names do not go through it.
- **Again: never `I18nManager.forceRTL(true)`.** It requires an app restart to
  take effect, mirrors every screen, and breaks the bottom nav ordering.

> [!CAUTION]
> The old plan had `preferences.locale`. That column does not exist. The correct
> column is **`profiles.locale`**. Querying the wrong column returns a Postgres
> error, not a fallback.

---

## 9. Receipt capture — the module that justifies the app

This is #7 in the ship order but it is the reason to build mobile at all.

**Flow:** camera → crop/deskew → upload to Storage → Edge Function extraction →
**review screen** → write entry + line items.

- `expo-camera` for capture, `expo-image-manipulator` to downscale before
  upload. Full-resolution phone photos are 4–8 MB; resize the long edge to
  ~1600px first or upload will fail on a weak connection.
- Store originals in a Supabase Storage bucket `receipts`, path-prefixed by
  `household_id`, with an RLS policy matching `is_household_member`.
- **Extraction runs server-side**, in a Supabase Edge Function. Never put an
  Anthropic API key in the app bundle. The function takes a storage path,
  returns a Zod-validated object.
- The **review screen is mandatory.** The real input is faded thermal paper,
  mixed Urdu/English and handwritten kiryana *parchi* — extraction will be
  wrong often enough that silent auto-commit would poison the ledger. Show
  extracted fields side by side with the image, every field editable.
- FBR POS invoices carry a printed QR — read it directly and skip the model.
  Cheaper, instant and exact.
- Enforce `plans.limits.receipts_per_month` (10 on free, unlimited on Pro).
  **Read the limit from the DB.** Never hardcode it.
- Support **multi-receipt capture** — queue multiple photos before processing.
  Photos queue in the expo-sqlite outbox when offline.

> [!IMPORTANT]
> **Prerequisite:** The Storage bucket `receipts` must exist before this screen
> ships. There are currently **zero buckets in the project**. The `receipts`
> table also has no extraction columns — migration `0012` adds them.

---

## 10. Edit and delete — one shared pattern

Edit/delete pattern matches the web (UI-POLISH-PLAN §3):

### Icon treatment

- 15–16px glyph, `strokeWidth: 1.75`, inside a **28px rounded-full** hit area.
- Edit: `text-foreground-2`, press `text-brass-strong` on `bg-brass-soft`.
- Delete: `text-muted`, press `text-loss` on `bg-loss-soft`.

### Where they appear

- **List rows** — via swipe gesture (left = edit, right = delete). Below `lg`
  (all mobile): actions always visible as small icons on the right.
- **Detail pages** — always visible in the page header.

### The delete confirmation

Applies to **every** delete:

1. A modal always appears. Nothing deletes on a single tap.
2. Names the record: title, amount, date.
3. If linked (entry ↔ transaction), lists every linked record by name.
4. Checkbox "also delete the linked records" — **checked by default**.
5. Checked → delete whole linked set.
6. Unchecked → unlink first, then delete. Order matters.
7. States the balance consequence: `UBL Current: Rs 89,000 → Rs 4,000`.
8. Delete runs through the **balance trigger**. Never write a corrected balance
   by hand.

---

## 11. Native-only features

| Feature | Package | Note |
|---|---|---|
| Biometric unlock | `expo-local-authentication` | Opt-in, prompted after **second** sign-in. Gate app open. |
| Local notifications | `expo-notifications` | Bill due, committee turn, Zakat hawl — **all computed on-device from local data.** Works offline. Server push is v2. |
| Push token registration | `expo-notifications` | Token registered to `push_subscriptions` now (after `0013` widens the table). Server push enabled later without a new app release. |
| Share to WhatsApp | `expo-sharing` | Receipt images and invite links. Share-links only. |
| Widget / quick add | v2 | Home-screen "add expense" shortcut — highest-value v2 feature. |

---

## 12. Testing and acceptance

Per screen, before it is called done:

1. Works signed out → signed in → session expired → refreshed.
2. Works with **no data** (fresh signup) and with 18 months of data.
3. Works in Urdu, and money still renders `-Rs 899` not `Rs 899-`.
4. Works in dark mode, with navy lighter than the canvas.
5. Works offline: cached read renders, write queues via outbox, flush succeeds
   on reconnect, **duplicate upsert does not double-fire triggers**.
6. Small screen (360×640) and large (tablet) both usable.

**Module acceptance:** a receipt photographed on a real phone, of a real
Pakistani kiryana bill, produces a correctly-categorised entry that appears in
the web app's ledger with the right paisa amount.

---

## 13. Session plan

**Web prerequisites (W1, W2) must complete before mobile session M7.**

| Session | Scope | Blocks |
|---|---|---|
| W1 | `0012_receipt_line_items.sql` + Storage bucket `receipts` + extraction Edge Function | M7 |
| W2 | Web multi-file upload + extraction review on `/receipts` + `0013_push_targets.sql` | M7, M9 |
| M1 | Expo scaffold, expo-router, theme tokens, fonts, Supabase client + session persistence | — |
| M2 | Auth screens + deep links + auth gate + biometric prompt (after 2nd sign-in) | — |
| M3 | **Offline layer: expo-sqlite outbox + TanStack Query read cache + NetInfo replay** | **All writing screens** |
| M4 | Overview + floating bottom nav | — |
| M5 | Entries list, filters, quick-add, entry detail (view + edit + delete) | — |
| M6 | Account list + add/edit/delete + ledger + running balance | — |
| M7 | Receipt capture + review screen (requires W1, W2 done) | — |
| M8 | Calendar heat-map | — |
| M9 | Committee (read-only) + Settings + local notifications + push token registration | — |
| M10 | EAS Build, Play Store internal track, final polish | — |

> [!IMPORTANT]
> **M3 before any writing screen is non-negotiable.** Retrofitting an outbox
> under screens that already call Supabase directly means rewriting all of them.

---

## 14. Open items (none blocking M1–M6)

| Item | Status | Impact |
|---|---|---|
| Privacy policy page | Does not exist | Play Store data-safety declaration requires it |
| Crash reporting | Not chosen | Sentry vs Bugsnag vs Firebase Crashlytics — pick before M10 |
| `pnpm` vs Expo prebuild | Untested | Expo's prebuild expects `npm` or `yarn`; `pnpm` may need `node-linker=hoisted` in `.npmrc` |
| Seed credentials | Scrubbed from the repo, **still live in Supabase** | `admin@bachatbook.com` is a real `super_admin`. Its password is no longer in any file or commit, but the account still works. Rotate or delete it — the web app is publicly deployed, so this is overdue, not pending. |

---

## 15. Dependencies

> [!CAUTION]
> **Do not hand-pin any Expo or React Native module version.** An earlier draft
> of this list carried `expo: ~54.0.0` alongside `expo-router ~4.0.0`,
> `expo-camera ~16.0.0`, `expo-sqlite ~15.0.0`, `react-native-reanimated ~3.16.0`
> and `react-native-screens ~4.0.0` — that set is the **SDK 52** lineup, not 54.
> Installing it against SDK 54 produces either a resolution failure or, worse, a
> build that compiles and crashes on a native call.
>
> Install every native module with **`npx expo install <pkg>`**, which resolves
> the version from the installed SDK's `bundledNativeModules.json`. Then run
> **`npx expo-doctor`** and fix everything it reports before writing a screen.
> Pin only the pure-JS packages below.

**Install with `npx expo install`** (versions come from the SDK):

```
expo-router  expo-font  expo-camera  expo-image  expo-image-manipulator
expo-image-picker  expo-local-authentication  expo-notifications
expo-secure-store  expo-sharing  expo-localization  expo-sqlite
expo-file-system  expo-crypto  expo-haptics
react-native-reanimated  react-native-gesture-handler
react-native-safe-area-context  react-native-screens  react-native-svg
@react-native-async-storage/async-storage  @react-native-community/netinfo
@shopify/react-native-skia
```

Four of these were missing from the earlier list and each is load-bearing:

| Package | Why it is not optional |
|---|---|
| **`expo-crypto`** | `randomUUID()`. Hermes has no `crypto.randomUUID`, and the client-generated UUID is the entire idempotency mechanism (§2.4). Without it there is nothing to upsert on. |
| **`expo-file-system`** | The photo queue's local files (§6.5). |
| **`expo-image-picker`** | Gallery multi-select for receipts, feeding the same queue as the camera. |
| **`@shopify/react-native-skia`** | **`victory-native@41` is Victory Native XL and will not run without it** — it is a peer dependency, not a transitive one. Skia also adds real APK weight; if the Overview chart is the only consumer, `react-native-svg` + Reanimated is the lighter call. Decide at M4, not at M10. |

`expo-haptics` is cheap and is the only feedback that a queued write landed while
the phone was in a pocket.

**Pure JS — pin these normally:**

```json
{
  "@supabase/supabase-js": "^2.49.0",
  "@tanstack/react-query": "^5.60.0",
  "@tanstack/query-async-storage-persister": "^5.60.0",
  "@tanstack/react-query-persist-client": "^5.60.0",
  "@gorhom/bottom-sheet": "^5.0.0",
  "victory-native": "^41.0.0",
  "zod": "^3.25.0",
  "react-hook-form": "^7.54.0",
  "@hookform/resolvers": "^3.9.0",
  "date-fns": "^4.1.0",
  "i18n-js": "^4.4.0",
  "lucide-react-native": "^0.511.0",
  "react-native-url-polyfill": "^2.0.0"
}
```

`react` and `react-native` are **not listed on purpose** — `create-expo-app`
picks the pair the SDK requires. Overriding them is how a New Architecture build
breaks.

---

## 15.5 Environment and Supabase setup — exact steps

Everything below is done **once**, by hand, before the implementing agent starts.
Project is `brunpltiektawjtcivwa` (`ap-south-1`), dashboard at
`https://supabase.com/dashboard/project/brunpltiektawjtcivwa`.

### 15.5.1 The env file — `app/.env`

Only two variables are needed to start. **Both already exist in
`web/.env.local`** — copy the values across rather than re-fetching them, so the
two clients can never point at different projects.

```bash
# app/.env   — gitignored, same as web/.env.local
EXPO_PUBLIC_SUPABASE_URL=https://brunpltiektawjtcivwa.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<same value as NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY>
```

The mapping is exact:

| `web/.env.local` | `app/.env` |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `EXPO_PUBLIC_SUPABASE_URL` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| `NEXT_PUBLIC_SITE_URL` | *(not used — native has no origin; the deep-link scheme replaces it)* |

If you need to read them from the dashboard instead:
**Project Settings → API Keys** → `Project URL` and the **publishable /
`anon`** key.

> [!CAUTION]
> The same page shows a **`service_role`** key. It bypasses every RLS policy in
> the database. It must **never** appear in `app/.env`, in `app.config.ts`, in a
> commit, or anywhere the APK can reach. Publishable key + RLS is the entire
> security model. The only place a secret key legitimately lives is Edge
> Function secrets (15.5.4), which run on Supabase's servers.

`EXPO_PUBLIC_`-prefixed variables are **inlined into the JS bundle** at build
time and are readable by anyone who unzips the APK. That is correct for these
two and wrong for anything else. Never add a variable with that prefix that you
would not publish.

### 15.5.2 Create the Storage buckets

There are currently **zero buckets in this project** — this step is a hard
prerequisite for receipt capture (M7) and avatar upload (M9).

**Where to click:** dashboard → left sidebar **Storage** → **New bucket**.

| Field | `receipts` | `avatars` |
|---|---|---|
| Name | `receipts` | `avatars` |
| Public bucket | **OFF** — a receipt is a financial document | **ON** — avatars are shown in the app shell |
| File size limit | `10 MB` | `2 MB` |
| Allowed MIME types | `image/jpeg, image/png, image/webp, application/pdf` | `image/jpeg, image/png, image/webp` |

Then **Storage → Policies → New policy → For full customization** on each. Both
need policies keyed off the **first path segment**, which is why the path
conventions are fixed:

```
receipts/<household_id>/<receipt_id>.jpg     → policy checks household membership
avatars/<user_id>/avatar.jpg                 → policy checks auth.uid()
```

> [!CAUTION]
> If the avatar policy does not pin the first segment to `auth.uid()`, **any
> signed-in user can overwrite any other user's avatar**. `UI-POLISH-PLAN.md
> §9.1` calls this out for the web side; it is the same bucket and the same bug.

Write both buckets and both policy sets **as migration `0012`**, not by clicking,
so `db/migrations/` stays replayable (`IMPLEMENTATION-PLAN.md §2.1`). The
dashboard is for *verifying* what the migration did, not for creating it.

### 15.5.3 Register the deep link

**Authentication → URL Configuration → Redirect URLs → Add URL:**

```
bachatbook://auth/callback
```

Leave the existing `http://localhost:3100/**` entries in place — the web app
still needs them. Without this, password reset from the phone opens the browser
and dead-ends.

### 15.5.4 Anthropic key for receipt extraction (W1 only)

The key lives in **Edge Function secrets**, never in the app or the web bundle.

1. Get the key from `console.anthropic.com` → **API Keys** → **Create Key**.
2. Set it with the CLI — there is no dashboard field for this:

```powershell
supabase login
supabase link --project-ref brunpltiektawjtcivwa
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

3. Verify with `supabase secrets list` (it prints names and digests, not values).

The function reads it as `Deno.env.get('ANTHROPIC_API_KEY')`.

### 15.5.5 Two settings to flip before any APK leaves your machine

Both are already open items in `IMPLEMENTATION-PLAN.md §2`:

- **Authentication → Attack Protection → Leaked password protection: ON.**
  Currently off, and still flagged by Supabase's linter.
- **Authentication → Sign In / Providers → Email → Confirm email.** Currently
  **off** so signup could be tested. Mobile sign-up must handle both states
  (§ M2), and this gets turned on before launch.

### 15.5.6 EAS, when you reach M10

`eas login` uses an Expo account from `expo.dev` — free, and no Google Play
account is needed until you actually upload. The Play Console developer
registration is a **one-time US$25** fee and can wait until M10.

---

## 16. Pre-implementation checklist

Before the implementing agent starts **M1**:

- [ ] `app/.env` created with the two `EXPO_PUBLIC_` vars, copied from
      `web/.env.local` (§15.5.1). `.env` is gitignored.
- [ ] `bachatbook://auth/callback` registered in Supabase → Authentication →
      URL Configuration (§15.5.3)
- [ ] `web/src/lib/supabase/types.ts` copied to `app/types/database.ts`
- [ ] `npx expo-doctor` clean; **no Expo module version hand-pinned** (§15)
- [ ] Font files downloaded to `app/assets/fonts/`. **Noto Nastaliq Urdu is
      lazy-loaded** for `profiles.locale === 'ur'` only — it is ~2MB and most
      users never see it.
- [ ] 3D dioramas resized to ~512px WebP → `app/assets/3d/`. Audit first —
      `IMPLEMENTATION-PLAN.md §3.3` flags the ice-cream, lightbulb and
      petrol-pump renders as off-palette strays. Do not bundle all 17 blindly.
- [ ] Category images processed (bg removal + square crop + 256px WebP) →
      `app/assets/categories/`
- [ ] **Category → filename mapping done by eye.** There are 28 renders with
      hash filenames and **37 category rows**. Someone must decide which render
      is `groceries.webp`. Categories with no match fall back to the Lucide
      `icon` + `tone` already in the schema — that fallback is the expected
      state for most rows on day one, not a bug.
- [ ] Brand logos copied from `web/public/logos/` → `app/assets/logos/`
- [ ] EAS account configured (`eas login`) — free, no Play account needed yet

Before **M7** (receipt capture):

- [ ] Supabase Storage bucket `receipts` exists (private) with RLS keyed off the
      first path segment (§15.5.2) — created **by migration**, verified in the
      dashboard
- [ ] Bucket `avatars` exists (public read) with its write policy pinned to
      `auth.uid()` — needed for M9, same migration
- [ ] Anthropic API key stored in Supabase Edge Function secrets via
      `supabase secrets set` (§15.5.4) — **not** in any `.env` file
- [ ] Migration `0012_receipt_line_items.sql` applied and `types.ts` regenerated (W1)
- [ ] Web extraction review screen functional (W2)
- [ ] Migration `0013_push_targets.sql` applied — `push_subscriptions` can hold Expo tokens (W2)
- [ ] **Seed credentials rotated or deleted** (before any APK distribution)

Before **M10** (release):

- [ ] Privacy policy page exists and is linked in `app.config.ts`
- [ ] Crash reporting SDK integrated
- [ ] Play Store data-safety declaration completed
- [ ] §2.4 idempotency test passed (upsert doesn't double-fire balance trigger)
