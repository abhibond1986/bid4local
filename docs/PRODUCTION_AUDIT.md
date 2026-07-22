# Bid 4 Local — Production Audit

**Date:** 2026-07-22
**Auditor role:** Senior PM / UX / Solution Architect / Supabase Architect / Security Engineer / Full-Stack Next.js
**Scope:** Existing repository at `github.com/abhibond1986/bid4local`, working copy inspected on disk.
**Method:** Static inspection of the checked-out source. See "Environment limitation" below — the build/test toolchain was unavailable during this pass, so findings are from code review, not from executed builds.

---

## 0. Environment limitation (read this first)

The isolated Linux VM that provides `git`, `npm`, the Supabase CLI, and the ability to run `next build` / `tsc` / tests **failed to start** during this session:

```
failed to set VHDX path: VHDX file not found: ...\claudevm.bundle\rootfs.vhdx
```

Consequences and how they are handled:

- All findings below come from **reading source files**, not from compiler/linter/test output. Anything that requires execution to confirm (e.g. "the build passes") is explicitly marked **UNVERIFIED — pending build**.
- All fixes in this effort are delivered as **hand-authored files** (migrations, RLS, RPCs, Supabase clients, docs, CI). They are written to be correct on review, but must be validated with `next build`, `tsc --noEmit`, `npm run lint`, and `supabase db reset` once the VM is restored. Task #6 in the tracker is the verification gate.
- Restarting the Claude desktop app normally rebuilds the VM and restores the toolchain.

---

## 1. Repository state as inspected

The working copy contains a **partial scaffold**, not the full application described in the brief:

| Present | Missing from working copy |
|---|---|
| `db/schema.ts` (Drizzle) | Root `app/layout.tsx`, `app/page.tsx` |
| `db/index.ts`, `db/seed.ts` | `/login`, `/signup`, `/items`, `/items/[id]`, `/watchlist`, `/profile`, `/my-bids`, `/my-auctions`, `/notifications` route files |
| `auth.ts` (Auth.js v5 credentials) | Any `middleware.ts` |
| `app/actions.ts` (server actions) | Any `supabase/` directory |
| `app/admin/**` (8 admin pages + client components) | Any tests, any populated CI |
| `components/` (BootSplash, brand-logo, layout, multi-image-picker) | `docs/` |
| `.env.example`, `.github/workflows/main.yml` (empty), `next.config.ts`, `drizzle.config.json` | |

**Finding A1 (blocker for "preserve working functionality"):** `app/actions.ts` calls `revalidatePath('/items')`, `/watchlist`, `/my-bids`, `/profile`, and redirects to `/login`, but none of those route files exist in the working copy. Either they live on a branch not checked out here, or the app currently only renders the admin section. This must be reconciled against the GitHub `main` branch before claiming feature preservation. **UNVERIFIED — pending re-clone.**

**Finding A2 (path-alias mismatch, confirmed):** `tsconfig.json` maps `@/*` → `./src/*` only, but `auth.ts`, `app/actions.ts`, and others import `@/db`, `@/auth`, `@/lib/format` from the **repository root** (there is no `src/db`, `src/auth`, `src/lib`). These imports cannot resolve under the current config — either the real repo keeps these under `src/`, or the tsconfig differs on `main`. New Supabase code in this effort is placed under `src/` to match the alias. Root-level modules must be moved under `src/` (or the alias broadened) during the App-integration phase. **UNVERIFIED — pending re-clone.**

---

## 2. Security findings

### S1 — Base64 images stored in PostgreSQL (High)
`app/actions.ts` `readProductImages()` encodes every uploaded photo as a `data:...;base64,...` string and stores it in `items.images` / `items.imageUrl` (text columns). At up to 8 images × ~2 MB each, rows balloon to ~16 MB, every product query drags image bytes over the wire, and Postgres TOAST/backup costs explode. **Fix:** Supabase Storage (`auction-images` bucket) + `auction_images` metadata table holding only paths/URLs.

### S2 — Race condition in `placeBid` (High)
`placeBid` does read-then-write with no row lock or transaction:
1. `SELECT` item → 2. check `amount > currentBid` → 3. `INSERT` bid → 4. `UPDATE` item.
Two concurrent bidders can both pass step 2 against the same `currentBid`, both insert, and the last write wins — producing two "winning" bids and a corrupted `bidCount` (it's incremented from a stale in-memory value, and the auto-bid path adds `+2` to an already-stale count). **Fix:** atomic `place_bid()` RPC using `SELECT ... FOR UPDATE` inside a transaction.

### S3 — Passwords owned by the app, not an auth provider (High)
`users.password` stores bcrypt hashes; `registerUser` and `updateProfile` hash with a hardcoded cost of 10. There is no email verification, no password reset, no rate limiting, no lockout. **Fix:** migrate to Supabase Auth; `auth.users` owns credentials; app `profiles` table holds no password material.

### S4 — Auto-bid logic is exploitable and buggy (High)
In `placeBid`, the auto-bid loop:
- Reads `autoBids.maxAmount` in application code (max is not private — any code path returning the row leaks it). RLS/`SECURITY DEFINER` should keep it server-only.
- Uses `onConflictDoNothing()` in `setAutoBid` but there is **no unique constraint** on `(itemId, userId)`, so the conflict target does nothing and users can stack unlimited auto-bids.
- `break`s after the first auto-bid, so it never resolves duelling auto-bidders to the correct winner and never applies increments beyond one step.
- Notifies the wrong user in places (notifies `session.user.id` as "outbid by auto-bid" even when they are not the human bidder).
**Fix:** transactional proxy-bid resolution inside `place_bid()`, private max via `SECURITY DEFINER`, unique `(auction_item_id, bidder_id)` partial index.

### S5 — No anti-sniping (Medium)
Brief requires end-time extension on late bids; current code has none. **Fix:** configurable anti-snipe window/extension inside `place_bid()`.

### S6 — Authorization relies on string role checks scattered in actions (Medium)
Roles are compared as free-text strings (`'superadmin'`, `'manager'`, `'finance'`) with no enum, and the schema default role is `'bidder'` while checks elsewhere expect `'superadmin'`. `db/schema.ts` has `role: text('role').default('bidder')` — no constraint prevents arbitrary values. There are **no RLS policies at all** (plain Postgres + Drizzle), so any DB credential can read/write everything. **Fix:** Postgres enum `user_role`, RLS on every table, server-side `requireRole()` helper, `SECURITY DEFINER` RPCs.

### S7 — `AUTH_SECRET` placeholder + secrets hygiene (Medium)
`.env.example` ships `AUTH_SECRET=please-change-to-a-long-random-string`. Acceptable as a placeholder, but there is no `.env` in `.gitignore` verification step and no separation of pooled vs direct DB URLs. **Fix:** rewrite `.env.example` for Supabase; confirm `.gitignore` covers `.env*`.

### S8 — No input validation layer (Medium)
Server actions parse `formData.get(...) as string` and `parseInt(...)` with minimal checks; no schema validation. **Fix:** Zod schemas at every server boundary.

### S9 — No rate limiting (Medium)
Login, signup, bid, and (future) payment endpoints have no throttling. **Fix:** rate-limit middleware / RPC-level guardrails.

### S10 — Bidder identity privacy (Low/Medium)
Bid history exposes raw `userId`. Public bid history should show masked identities (e.g. "Bidder #4f2a"). **Fix:** privacy-safe view / RLS-projected column.

---

## 3. Data model findings

- **D1:** Integer `serial` PKs on `items`, `bids`, etc. Brief mandates UUIDs. Sequential IDs also leak volume/enumeration. **Fix:** UUID PKs.
- **D2:** No `updated_at` on several tables (`bids`, `notifications`, `payments`, `watchlist`, `categories`); no soft-delete (`deleted_at`) anywhere; no `created_by`/`modified_by` audit columns. **Fix:** standard columns + triggers.
- **D3:** Missing indexes for every hot query: item `status`, `end_time`, `category_id`, `seller_id`, `featured`, bids `(item_id, amount desc)`, notifications `(user_id, read)`, payments `(user_id, status)`. **Fix:** add indexes in migration.
- **D4:** No check constraints (`starting_bid > 0`, `current_bid >= starting_bid`, `end_time > start_time`, non-negative amounts). **Fix:** add CHECKs.
- **D5:** `winnerId` is a bare text column with no FK. `images` is a JSON-in-text blob. `featured` is an integer flag instead of boolean. **Fix:** normalize.
- **D6:** No organizations / organization_members, inspection_reports, complaints, delivery_orders, refunds, payment_events, documents, platform_settings tables that the brief and admin panel imply. **Fix:** add in migration.

---

## 4. Realtime / performance findings

- **R1:** "Live" bidding is described as polling; there is no Supabase Realtime. **Fix:** Realtime subscriptions on `bids`/`auction_items`, reconciled with authoritative RPC responses.
- **R2:** `placeBid` issues 5–8 sequential round-trips per bid. Collapsing into one RPC cuts latency and removes the race. **Fix:** single `place_bid()` call.
- **P1:** No pagination on admin list pages (need to confirm per page). **Fix:** server-side pagination.

---

## 5. Infra / DX findings

- **I1:** `.github/workflows/main.yml` is **empty** — CI does nothing. **Fix:** lint + typecheck + build + test + Docker pipeline.
- **I2:** No `supabase/` project (no `config.toml`, migrations, seed, storage policies). **Fix:** full local Supabase project.
- **I3:** No generated DB types (`src/types/database.ts`). **Fix:** `supabase gen types typescript`.
- **I4:** DB pool uses a single `DATABASE_URL`; no pooled/direct split for migrations. **Fix:** `DATABASE_URL` (pooled) + `DIRECT_URL` (direct).
- **I5:** No tests at all. **Fix:** Vitest unit + RLS/RPC SQL tests + Playwright smoke.

---

## 6. UI/UX findings (from components inspected)

- **U1:** `BootSplash` 0–100% loader must show **once per tab**, not on every navigation. Needs a session flag (`sessionStorage`) guard and Next `<Link>` transitions for internal nav.
- **U2:** `multi-image-picker.tsx` currently feeds the base64 pipeline; must be reworked for direct-to-Storage uploads with progress/preview/retry.
- **U3:** No documented loading/empty/error/permission-denied states, no reduced-motion handling, accessibility unverified. Tracked for the UI phase.

---

## 7. Prioritized remediation plan

**Phase 1 — Backend foundation (this effort, highest value):**
Supabase migrations (schema, enums, constraints, indexes) → RLS on every table → `place_bid` / `configure_auto_bid` RPCs with anti-sniping → storage buckets + policies → seed → generated types.

**Phase 2 — App integration (requires working VM):**
Supabase clients (`client/server/admin/middleware`) → migrate auth to Supabase Auth → rework server actions to call RPCs → replace image pipeline → Realtime subscriptions → auth pages.

**Phase 3 — Hardening:** Zod validation, rate limiting, secure headers, admin permission enforcement, CSV export, empty/error states.

**Phase 4 — Quality gates:** Vitest + Playwright + RLS tests, CI pipeline, health endpoint, docs.

**Verification gate (Task #6):** `npm ci && npm run lint && npm run typecheck && npm run build && npm test && supabase db reset` must all pass before any "works" claim.

---

## 8. Architecture decision (stack conflict resolution)

Two briefs were received: (1) incrementally productionize the existing **Next.js** app on Supabase; (2) rebuild the frontend in **Flutter** for mobile. These are mutually exclusive for one frontend. Decision: **Hybrid** — productionize the Next.js web app on Supabase now, and build the Supabase backend (schema, RLS, RPCs, storage) framework-agnostically so a Flutter client can later use the **same** backend. Rationale: brief #1's binding rule is "do not rebuild from scratch; preserve working functionality," and the backend work is identical for either client, making it the highest-value, lowest-risk starting point. Recorded in `docs/ARCHITECTURE_DECISIONS.md`.
