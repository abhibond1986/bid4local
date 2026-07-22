# Bid 4 Local — Rollback

## Application (Vercel)
- **Instant:** Vercel → Deployments → pick the last known-good deploy → **Promote to Production**. No rebuild needed.
- **Via git:** revert the offending commit(s) and push; CI redeploys.

## Database
Database rollbacks are riskier than app rollbacks — prefer forward fixes. Options in order of preference:

1. **Forward migration.** Write a new migration that undoes the change (drop the bad column/policy, restore the prior definition). Safest; keeps history linear.
2. **Point-in-time recovery (PITR).** For data corruption: Supabase Dashboard → Database → Backups → restore to a timestamp before the incident. Coordinate with the app rollback so schema and code match.
3. **Snapshot restore.** Restore the most recent daily backup if PITR is unavailable (data since the snapshot is lost).

## Coupled schema + code changes
When a release includes both a migration and code that depends on it:
- Roll back **code first**, then the schema, to avoid the app hitting a schema it doesn't expect.
- Design migrations to be **backward compatible** for one release (add columns nullable, deploy code, backfill, then tighten in a later migration) so a code-only rollback is always safe.

## Verify after rollback
- `/api/health` is `200`.
- Auth login works.
- A test bid via `place_bid` succeeds.
- Check `audit_logs` for gaps or anomalies during the incident window.
