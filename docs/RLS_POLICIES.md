# Bid 4 Local — Row Level Security

RLS is enabled on **every** user-facing table. Policies are defined in `supabase/migrations/20260722091000_functions_and_rls.sql`. Storage policies are in `20260722092000_storage.sql`.

## Principles
1. **No unconditional `true` write policies.** Every write policy is gated by ownership or role.
2. **Sensitive mutations go through `SECURITY DEFINER` RPCs**, not direct table writes. `bids` and `auto_bids` have no client INSERT policy — the RPCs are the only write path.
3. **Role checks use `SECURITY DEFINER` helpers** (`is_super_admin()`, `has_role()`) that read `profiles.role` without recursing through RLS.
4. **Service role bypasses RLS** and is used only in trusted server code (webhooks, admin scripts, cron).

## Policy summary

| Table | Read | Write |
|---|---|---|
| `profiles` | self + public display; admin all | self-update (role locked); super_admin all; last-super-admin protected |
| `auctions` | public sees live/ended; seller sees own drafts; staff all | seller inserts own; seller edits own `draft/scheduled`; super_admin deletes |
| `auction_images` | public | seller of parent auction (draft/scheduled) or super_admin |
| `bids` | public (masked identities via `public_bid_history`) | **RPC only** (`place_bid`); super_admin manage |
| `auto_bids` | **owner only** (keeps `max_amount` private) | **RPC only** (`configure_auto_bid`/`disable_auto_bid`) |
| `watchlists` | owner | owner |
| `notifications` | owner + admin | owner marks read; admin/service inserts |
| `payments`/`refunds` | owner + finance + admin | finance + admin |
| `payment_events` | finance + admin | service role (webhooks) |
| `documents` | owner + admin | owner + admin |
| `complaints` | parties + moderators | complainant creates; moderators update |
| `delivery_orders` | parties + coordinators | coordinators/managers |
| `reviews` | public | author |
| `audit_logs` | admin/manager/finance | RPC/service only |
| `platform_settings` | public read | super_admin |

## Verifying policies
Run the RLS test suite (see `docs/SECURITY.md` and `tests/rls/`). Manual verification:

```sql
-- As an anon user, an INSERT into bids must fail.
set role anon;
insert into bids (auction_id, bidder_id, amount) values (gen_random_uuid(), gen_random_uuid(), 100);  -- expect: RLS violation

-- max_amount of another user's auto_bid must not be visible.
set role authenticated;   -- with a JWT for user A
select max_amount from auto_bids where bidder_id = '<user B>';  -- expect: 0 rows
```

Because `place_bid` is `SECURITY DEFINER`, it inserts bids even though no INSERT policy exists — that is intentional and is the only sanctioned write path.
