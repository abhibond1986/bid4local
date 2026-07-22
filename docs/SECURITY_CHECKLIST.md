# Bid 4 Local — Security Checklist

Use before every production release. `[ ]` = to verify each release.

## Secrets & config
- [ ] No `.env` files committed; `git log -p` shows no keys.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set only in server env (Vercel "Sensitive"), never `NEXT_PUBLIC_*`.
- [ ] `admin.ts` still guarded by `import 'server-only'`.
- [ ] `NEXT_PUBLIC_ENABLE_DEMO_ACCOUNTS=false` in production.
- [ ] `AUTH_URL` / `NEXT_PUBLIC_APP_URL` point to the production domain.

## Database
- [ ] RLS enabled on every table (`select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relrowsecurity=false and c.relkind='r';` returns nothing user-facing).
- [ ] No `USING (true)` write policies.
- [ ] `bids`/`auto_bids` have no client INSERT policy.
- [ ] Migrations apply cleanly on a fresh DB (`supabase db reset`).
- [ ] At least one active `super_admin`; last-super-admin guard tested.

## Auth
- [ ] Email confirmation required.
- [ ] Password reset flow works end-to-end.
- [ ] OAuth redirect URLs allow-listed in Supabase.
- [ ] Session refresh works after JWT expiry.

## App
- [ ] Middleware blocks unauthenticated access to `/admin`, `/profile`, `/sell`, etc.
- [ ] Every privileged server action re-checks role server-side.
- [ ] Zod validation on all mutations.
- [ ] Rate limiting active on login/signup/bid/payment.
- [ ] Secure headers present (check response headers).
- [ ] Uploads reject wrong MIME/oversize files.

## Payments
- [ ] Webhook signature verification enabled.
- [ ] Idempotency keys enforced; duplicate webhooks are no-ops.
- [ ] No client-side "payment success" trust path.

## Monitoring
- [ ] Supabase logs + alerts configured.
- [ ] Backups + PITR enabled.
- [ ] Audit log reviewed for anomalies.
