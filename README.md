# Bachat Book

Personal-finance app for **Pakistan**, with a calendar and task manager built into
the same spine. Web app plus an Android client, sharing one Supabase database.

*Bachat* (بچت) means savings.

---

## Why it is not a translated budgeting app

The model is Pakistani, not the copy. A US budgeting app translated into Urdu
fails here because the things people actually track are different:

- **Committee / BC** — rotating savings circles. The interesting number is not
  who paid; it is the implied XIRR of your position against a Behbood or DSC
  benchmark, so you learn whether your committee is an interest-free loan or a
  zero-return savings plan.
- **Zakat** on the silver nisab, with a lunar hawl and the CZ-50 exemption.
- **FBR** July–June tax year, and a filer / non-filer cost meter in rupees.
- **National Savings** certificates, prize bonds, gold in **tola**, plot files.
- **Event budgets** for Ramadan, Eid, Qurbani, shaadi and school admission —
  the shocks that actually break a household budget here.
- **Qarz** — interest-free family loans, which no competing app tracks.

Money is stored as **`bigint` paisa** everywhere. Never a float, never `numeric`.
Rupees exist only at formatting time, with South Asian grouping (`1,25,000`).

---

## Layout

```
Bachat Book/
  web/     Next.js 16 · React 19 · Tailwind v4 — the product
  app/     Expo SDK 57 · expo-router — Android client (v1)
  db/      migrations + the RLS isolation proof
  docs/    roadmap, implementation plan, mobile plan
```

One repo on purpose: both clients hit the same Supabase project, the same
migrations and the same design tokens.

---

## Running

Requires **pnpm** and a Supabase project.

```bash
# web — http://localhost:3100
cd web
cp .env.example .env.local     # fill in your Supabase URL + publishable key
pnpm install
pnpm dev

# mobile
cd app
cp .env.example .env           # same two values
npm install
npx expo start
```

`EXPO_PUBLIC_*` and `NEXT_PUBLIC_*` values are inlined into their bundles and are
readable by anyone. That is fine for the publishable key — it grants nothing on
its own, and **RLS is the security model**. The `service_role` key must never
appear in either app; server-only secrets belong in Supabase Edge Function
secrets.

---

## Database

Migrations live in `db/migrations/` and replay in order:
`0004` (M2–M6 baseline) → `0010` (security hardening) → `0011` (entry ↔
transaction link).

Every tenant table has RLS enabled with explicit policies. Two rules that are
easy to get wrong and expensive to discover:

- **Platform roles** (`super_admin`/`admin`/`user`, in `user_roles`) and
  **household roles** (`owner`/`member`/`viewer`, in `household_members`) are
  separate tables. Collapsing them is the classic RLS bug.
- RLS helpers are `SECURITY DEFINER`, or a policy on `household_members` that
  queries `household_members` recurses forever.

After any migration, run `notify pgrst, 'reload schema';` or every REST endpoint
returns a bodyless 404 while the schema, grants and policies are all fine.

Prove isolation with the stranger-vs-owner query in `db/README.md` before
calling a module done — a policy that exists is not a policy that works.

---

## Design

Cream `#F8F6F1` canvas, navy `#0B1A33` dark mass, brass `#C6A15B` accent. Tokens
live in `web/src/app/globals.css` and are mirrored into `app/src/theme/tokens.ts`.

**The layout never mirrors.** `<html dir="ltr">` in every locale; Urdu changes
text direction inside text nodes only. Mirroring the document produces a second,
reversed UI to maintain for no gain.

---

## Status

Web: 37 routes building. Mobile: auth, offline outbox, entries, accounts,
calendar and a read-only committee view. Receipt OCR, investments and the
committee XIRR benchmark are the significant work remaining — see
`docs/IMPLEMENTATION-PLAN.md`.

Tax and Zakat surfaces carry a visible "verify with your own advisor" line. The
app computes; it does not advise.

---

## Licence

No licence granted. All rights reserved.
