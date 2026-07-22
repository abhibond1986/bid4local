# Bid 4 Local — Security Architecture

## Identity & sessions
- Supabase Auth owns all credentials. The app stores no password hashes.
- Sessions are JWTs in httpOnly cookies, refreshed in `middleware.ts` via `getUser()` (which validates the token server-side, unlike `getSession()`).
- Email verification and password reset are handled by Supabase Auth flows (`/verify-email`, `/forgot-password`, `/reset-password`, `/auth/callback`).

## Authorization (defense in depth)
1. **Database RLS** — the real boundary. Every table has policies; see `RLS_POLICIES.md`.
2. **SECURITY DEFINER RPCs** — bid/auto-bid/close logic runs server-side with validation; direct table writes are blocked.
3. **Middleware** — redirects unauthenticated users from protected prefixes and blocks non-staff from `/admin`.
4. **Server-action role checks** — `requireRole()` helpers re-check on every privileged action. Hidden UI is never the boundary.

## Bidding integrity
- `place_bid()` locks the auction row (`FOR UPDATE`), so concurrent bids serialize — no double-winner race.
- Proxy maxima are private (owner-only RLS on `auto_bids`) and resolved inside the RPC.
- Anti-sniping extends `end_time` when a bid lands inside the configured window.
- All bids and role changes are written to `audit_logs`.

## Secrets
- `SUPABASE_SERVICE_ROLE_KEY` is server-only; `src/lib/supabase/admin.ts` uses `import 'server-only'` so the build fails if it leaks into a client bundle.
- `.env*` are gitignored; only `.env.example` (placeholders) is committed.
- No demo passwords ship in production; demo logins appear only when `NEXT_PUBLIC_ENABLE_DEMO_ACCOUNTS=true`.

## Input & transport
- All server boundaries validate with Zod.
- File uploads validate MIME type and size at the bucket level (`allowed_mime_types`, `file_size_limit`) and in app code.
- Payment webhooks verify provider signatures and dedupe via `payment_events.gateway_event_id` + `payments.idempotency_key`.
- Secure headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options) set in `next.config.ts` (App-integration phase).

## Privacy
- Public bid history exposes masked identities (`Bidder #xxxx`) via the `public_bid_history` view, never raw user IDs.
- KYC and inspection documents live in **private** buckets, served via short-lived signed URLs.

## Rate limiting
- Login, signup, bid, chat, and payment routes are rate-limited (per-IP + per-user) in middleware/route handlers (App-integration phase).

## Error handling
- API responses return sanitized messages; stack traces are never sent to clients. RPC errors use stable codes (`AUCTION_ENDED`, `BID_TOO_LOW:<min>`, `EMD_REQUIRED`, …) mapped to friendly copy in the UI.
