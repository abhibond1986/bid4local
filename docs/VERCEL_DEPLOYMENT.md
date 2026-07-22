# Bid 4 Local — Vercel Deployment

## Prerequisites
- A hosted Supabase project with migrations pushed (`docs/SUPABASE_SETUP.md`).
- The repo connected to Vercel.

## Environment variables (Vercel → Settings → Environment Variables)
Set for Production (and Preview where useful):

| Variable | Scope | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Sensitive** | Server only |
| `DATABASE_URL` | Sensitive | Pooled (6543, `?pgbouncer=true`) |
| `DIRECT_URL` | Sensitive | Direct (5432), for migrations |
| `NEXT_PUBLIC_APP_URL` | Public | `https://your-domain` |
| `NEXT_PUBLIC_ENABLE_DEMO_ACCOUNTS` | Public | `false` in prod |
| `PAYMENT_PROVIDER` + gateway keys | Sensitive | `mock` until live keys ready |

## Deploy
1. Push to `main` (or open a PR for a preview deploy).
2. Vercel runs `npm ci && npm run build`.
3. After first deploy, set the Supabase **Site URL** and **Redirect URLs** to the Vercel domain (and custom domain).
4. Verify `/api/health` returns `200`.

## Build settings
- Framework preset: Next.js (auto-detected).
- Node version: 20.x.
- Do **not** run migrations in the Vercel build. Migrations are applied via `supabase db push` from CI or manually (see the manual production schema workflow in `.github/workflows/`).

## Post-deploy smoke test
- Sign up → receive confirmation email → confirm → log in.
- Create an auction (seller) → upload images → publish.
- Place a bid (second account) → observe realtime update → outbid notification.
- Admin panel loads for a super_admin, 403/redirect for a bidder.
