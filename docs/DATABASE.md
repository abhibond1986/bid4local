# Bid 4 Local — Database Reference

All schema is defined in version-controlled migrations under `supabase/migrations/`. Apply with `supabase db reset` (local) or `supabase db push` (remote).

## Conventions
- **Primary keys:** UUID (`gen_random_uuid()`), except `profiles.id` which equals `auth.users.id`.
- **Money:** `bigint` paise (INR minor unit). Never float.
- **Timestamps:** `timestamptz`. Every table has `created_at`; mutable tables have `updated_at` maintained by the `set_updated_at()` trigger.
- **Soft delete:** long-lived tables carry `deleted_at`; queries filter `deleted_at is null`. Ledger/event tables (`bids`, `audit_logs`, `payment_events`) are hard-appended, never soft-deleted.
- **Audit columns:** `created_by` / `modified_by` on editable domain tables.

## Enums
`user_role`, `kyc_status`, `auction_status`, `item_condition`, `bid_source`, `notification_type`, `payment_type`, `payment_status`, `refund_status`, `complaint_status`, `delivery_status`.

## Core tables

| Table | Purpose | Key constraints |
|---|---|---|
| `profiles` | 1:1 with `auth.users`; role, KYC, contact, bank | `role` enum, `pincode` regex, protected last-super-admin trigger |
| `organizations` / `organization_members` | Multi-seller orgs | unique `(org, profile)` |
| `categories` | Hierarchical taxonomy | self-FK `parent_id`, unique `slug` |
| `auctions` | Listing / lot | `starting_bid > 0`, `reserve >= starting`, `end_time > start_time`, many indexes |
| `auction_images` | Image metadata (bytes in Storage) | one cover per auction (partial unique) |
| `bids` | Immutable bid ledger | insert only via RPC; index `(auction_id, amount desc)` |
| `auto_bids` | Private proxy config | unique `(auction_id, bidder_id)`; `max_amount` readable only by owner |
| `watchlists` | User ↔ auction | unique `(profile, auction)` |
| `notifications` / `notification_preferences` | In-app + channel prefs | index `(profile, is_read, created_at)` |
| `payments` / `payment_events` / `refunds` | Money + webhook idempotency ledger | unique `idempotency_key`, unique `gateway_event_id` |
| `inspection_reports` / `documents` | Inspection + KYC docs (private buckets) | |
| `complaints` / `delivery_orders` / `reviews` | Trust & fulfillment | rating 1–5 |
| `audit_logs` | Append-only action log | index `(entity, entity_id)` |
| `platform_settings` | Key/value config | seeded `anti_snipe`, `demo_accounts_enabled` |

## Functions / RPCs

| Function | Security | Caller | Purpose |
|---|---|---|---|
| `handle_new_user()` | definer | auth trigger | Create profile + prefs on signup |
| `is_super_admin()`, `has_role(roles)`, `current_role_value()` | definer/stable | RLS + app | Authorization helpers |
| `protect_last_super_admin()` | trigger | — | Block removing the last super_admin |
| `place_bid(auction_id, amount)` | definer | authenticated | Atomic, race-safe bid + proxy + anti-snipe |
| `configure_auto_bid(auction_id, max)` | definer | authenticated | Set private proxy max |
| `disable_auto_bid(auction_id)` | definer | authenticated | Turn off proxy |
| `close_auction(auction_id)` | definer | service_role | Settle ended auction |

## Indexes (hot paths)
`auctions`: status, end_time, start_time, category, seller, highest_bidder, featured (partial), `(state,city)`, created_at desc, title trigram, and a partial "active board" index on `end_time WHERE status='active'`.
`bids`: `(auction_id, amount desc)`, `(auction_id, created_at desc)`, `(bidder_id, created_at desc)`.
`notifications`: `(profile_id, is_read, created_at desc)`. `payments`: `(profile_id, status)`.

## Regenerating types
```bash
supabase gen types typescript --local > src/types/database.ts
```
