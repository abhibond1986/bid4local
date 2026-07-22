# Architecture Decision Records — Bid 4 Local

## ADR-001: Hybrid frontend strategy (Next.js now, Flutter-ready backend)
**Status:** Accepted · 2026-07-22

**Context.** Two conflicting directives were received: (1) incrementally productionize the existing Next.js web app on Supabase, preserving working features; (2) rebuild the frontend in Flutter for Android/iOS/Web/Desktop.

**Decision.** Productionize the Next.js web app on Supabase now, and build the Supabase backend (schema, RLS, RPCs, storage) in a framework-agnostic way so a Flutter client can consume the identical backend later.

**Rationale.** Brief #1's binding constraint is "do not rebuild from scratch." A working Next.js codebase exists. The backend (Postgres schema, RLS, bidding RPCs, storage policies) is identical regardless of client, so it is the highest-value, lowest-risk work and unblocks either client. A Flutter app can authenticate via Supabase Auth and call the same `place_bid` RPC and Realtime channels.

**Consequences.** Web ships first as Next.js + PWA. Mobile is a follow-on Flutter project against the same Supabase project. No business logic lives in the web tier that a mobile client would need to duplicate — it lives in Postgres RPCs.

---

## ADR-002: Money stored as `bigint` paise
**Status:** Accepted

All monetary columns are `bigint` representing paise (INR minor unit), never floating point. Avoids rounding errors in bid math and payment reconciliation. The UI divides by 100 for display and formats as INR.

---

## ADR-003: All bid mutations go through `place_bid()` RPC
**Status:** Accepted

The `bids` table has **no INSERT RLS policy**. Bids can only be created through the `SECURITY DEFINER` `place_bid()` function, which holds a row lock (`SELECT ... FOR UPDATE`) on the auction for the duration of the transaction. This makes concurrent bids serialize on the auction row, eliminating the read-then-write race in the original `placeBid` server action, and centralizes validation, proxy resolution, anti-sniping, notifications, and audit in one atomic unit.

---

## ADR-004: Supabase Auth owns credentials
**Status:** Accepted

Passwords live only in `auth.users`. The public `profiles` table (1:1 via `profiles.id = auth.users.id`) holds no password material and is populated by the `handle_new_user()` trigger on `auth.users` insert. This removes app-managed bcrypt hashing and gives email verification, password reset, session refresh, and OAuth for free.

---

## ADR-005: Roles as a Postgres enum + RLS + server checks
**Status:** Accepted

`user_role` is a Postgres enum. Authorization is enforced in three layers: RLS policies (database backstop), `SECURITY DEFINER` helper functions (`is_super_admin()`, `has_role()`), and Next.js middleware/server checks (UX + defense in depth). Hidden nav links are never the security boundary.
