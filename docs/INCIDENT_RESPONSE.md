# Bid 4 Local — Incident Response

## Severity levels
- **SEV1** — data breach, auth bypass, funds at risk, full outage.
- **SEV2** — partial outage, bidding integrity bug, degraded payments.
- **SEV3** — minor bug, single-user impact.

## First 15 minutes (SEV1/2)
1. **Declare** the incident; assign an incident lead.
2. **Contain.** If credentials leaked: rotate `SUPABASE_SERVICE_ROLE_KEY` and anon key in the Supabase dashboard, redeploy. If an auth bypass: disable signups (`config.toml auth.enable_signup=false`) and/or take the affected route offline.
3. **Assess blast radius** via `audit_logs`, Supabase auth logs, and payment/webhook logs.

## Playbooks
**Leaked service-role key** → rotate keys → invalidate sessions → audit `audit_logs` for service-role actions during exposure window → notify affected users if data accessed.

**Bidding integrity bug (e.g. double winner)** → pause new bids on affected auctions (`update auctions set status='cancelled'` or a maintenance flag) → reconstruct correct winner from `bids` ordered by `(amount desc, created_at asc)` → correct `winner_id` → notify bidders.

**Payment discrepancy** → freeze refunds → reconcile `payment_events` against the gateway dashboard → use `idempotency_key` to detect double-charges → issue corrections through the finance role.

**Database corruption / bad migration** → see `ROLLBACK.md`: restore from PITR to just before the incident; re-apply known-good migrations.

## Communication
- Internal: incident channel with a running timeline.
- External: status page + email for SEV1/2 affecting users.
- Regulatory: if personal data is breached, follow applicable Indian data-protection notification timelines.

## Post-incident
- Blameless postmortem within 72h: timeline, root cause, contributing factors, action items with owners and dates.
- Add a regression test and, where possible, a monitoring alert for the failure mode.
