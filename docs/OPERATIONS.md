# Bid 4 Local — Operations

## Auction lifecycle automation
Auctions end by wall-clock time, so a scheduler must settle them:
- A cron job (Supabase Scheduled Function / pg_cron / external cron hitting a protected route) calls `close_auction(id)` for each `active` auction whose `end_time <= now()`.
- Recommended cadence: every 30–60s. `close_auction` is idempotent (it no-ops unless the auction is still `active` and past end).

Example pg_cron (run in the Supabase SQL editor if `pg_cron` is enabled):
```sql
select cron.schedule('close-ended-auctions', '* * * * *', $$
  select close_auction(id) from auctions
  where status = 'active' and end_time <= now();
$$);
```

## Monitoring
- **Database:** Supabase Dashboard → Reports (connections, slow queries, cache hit rate). Alert on connection saturation and error rate.
- **Auth:** monitor signup/login failure spikes (credential stuffing).
- **Storage:** watch bucket size growth; enforce the image size limits.
- **Realtime:** monitor concurrent connections; ensure client subscriptions are cleaned up on unmount.
- **App:** `/api/health` uptime check; Vercel analytics + error logs.

## Backups
- Enable daily backups and **PITR** in the Supabase project (paid tier).
- Periodically test a restore into a staging project.

## Capacity notes
- Use the **pooled** `DATABASE_URL` (PgBouncer, transaction mode) for the app; direct connections only for migrations.
- The "active board" partial index keeps the live-auctions query fast as the table grows.
- Paginate all admin lists server-side.

## Routine tasks
- Review `audit_logs` weekly for privileged actions.
- Rotate service-role key on staff offboarding.
- Reconcile `payment_events` against gateway statements monthly.
