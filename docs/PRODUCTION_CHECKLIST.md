# Bid 4 Local — Production Launch Checklist

## Backend (done / verifiable now)
- [x] Supabase migrations: schema, enums, constraints, indexes.
- [x] RLS enabled on every table; no `USING(true)` writes.
- [x] `place_bid` RPC: row-locked, validated, proxy-aware, anti-snipe.
- [x] `configure_auto_bid` / `disable_auto_bid` / `close_auction` RPCs.
- [x] Storage buckets + policies (auction-images public, docs private).
- [x] Profile-creation trigger; last-super-admin guard.
- [x] Seed data (categories + settings).

## App integration (requires working build env)
- [ ] Move root modules under `src/` to match `@/*` alias (audit A2).
- [ ] Migrate auth from Auth.js to Supabase Auth; build `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/callback`, `/verify-email`.
- [ ] Rewrite server actions to call `place_bid` / `configure_auto_bid`.
- [ ] Replace base64 image pipeline with direct-to-Storage upload + `auction_images`.
- [ ] Realtime subscriptions for current bid, count, history, status, extension, notifications.
- [ ] Zod validation on all boundaries; rate limiting; secure headers.
- [ ] `/api/health` endpoint.
- [ ] BootSplash once-per-tab; internal nav via `<Link>`.

## Quality gates (verification — Task #6)
- [ ] `npm ci` clean.
- [ ] `npm run lint` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` passes.
- [ ] `npm test` (Vitest) passes.
- [ ] `npm run test:e2e` (Playwright smoke) passes.
- [ ] `supabase db reset` succeeds from clean DB.

## External setup (manual)
- [ ] Hosted Supabase project created; migrations pushed.
- [ ] Auth Site URL + redirect URLs configured; Google/Microsoft OAuth enabled.
- [ ] Vercel env vars set (service key marked sensitive).
- [ ] First super_admin promoted via SQL.
- [ ] Backups + PITR enabled.
- [ ] Cron scheduled for `close_auction`.
- [ ] Payment gateway keys added (or `mock` documented).

## Acceptance criteria (from brief)
- [ ] Supabase Auth works · [ ] migrations from clean DB · [ ] RLS tested · [ ] Storage handles images · [ ] Realtime bids · [ ] concurrent bids safe · [ ] auto-bid transactional · [ ] admin server-side perms · [ ] INR everywhere · [ ] loader once/tab · [ ] smooth nav · [ ] no secrets committed · [ ] TS/lint/tests/build pass · [ ] health endpoint · [ ] docs complete.
