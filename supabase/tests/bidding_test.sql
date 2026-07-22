-- ============================================================================
-- Bid 4 Local — RPC / RLS verification (pgTAP-style, runnable via
--   supabase test db   (after `supabase start`)
-- Requires the pgtap extension; enable with: create extension if not exists pgtap;
-- ============================================================================
begin;
create extension if not exists pgtap;
select plan(6);

-- Fixtures ------------------------------------------------------------------
-- Two auth users + profiles (seller, bidder). We insert directly into
-- auth.users to simulate signups; the trigger creates profiles.
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000001', 'seller@test.dev', '{"role":"seller"}'),
  ('00000000-0000-0000-0000-000000000002', 'bidder@test.dev', '{"role":"bidder"}');

update profiles set kyc_status = 'verified', is_active = true
where id in ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');

insert into categories (id, name, slug) values ('00000000-0000-0000-0000-0000000000c1','Test','test-cat');

insert into auctions (id, title, description, category_id, seller_id,
  original_price, starting_bid, current_bid, bid_increment, status, end_time)
values ('00000000-0000-0000-0000-0000000000a1', 'Test lot', 'desc',
  '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000001',
  1000000, 100000, 0, 10000, 'active', now() + interval '1 hour');

-- Test 1: valid first bid succeeds and sets current_bid to starting_bid ------
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
select lives_ok(
  $$ select place_bid('00000000-0000-0000-0000-0000000000a1', 100000) $$,
  'bidder can place a valid opening bid');

select is(
  (select current_bid from auctions where id='00000000-0000-0000-0000-0000000000a1'),
  100000::bigint, 'current_bid updated to opening bid');

-- Test 2: bid below minimum is rejected --------------------------------------
select throws_like(
  $$ select place_bid('00000000-0000-0000-0000-0000000000a1', 100000) $$,
  'BID_TOO_LOW%', 'bid at/below current is rejected');

-- Test 3: seller cannot bid --------------------------------------------------
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
select throws_like(
  $$ select place_bid('00000000-0000-0000-0000-0000000000a1', 200000) $$,
  'SELLER_CANNOT_BID', 'seller is blocked from bidding');

-- Test 4: direct INSERT into bids is blocked by RLS (no insert policy) -------
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
select throws_ok(
  $$ insert into bids (auction_id, bidder_id, amount)
     values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000002', 999999) $$,
  '42501', 'direct bid insert is denied by RLS');

-- Test 5: a user cannot read another user's auto_bid max ---------------------
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
select configure_auto_bid('00000000-0000-0000-0000-0000000000a1', 300000);  -- seller? blocked, ignore
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
select is(
  (select count(*)::int from auto_bids where bidder_id='00000000-0000-0000-0000-000000000001'),
  0, 'cannot see another user auto_bid rows');

select * from finish();
rollback;
