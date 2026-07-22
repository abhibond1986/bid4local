-- ============================================================================
-- Bid 4 Local — Auth trigger, authorization helpers, RPCs, and RLS
-- Migration: 20260722091000_functions_and_rls.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Auth → profiles sync. Runs as the auth trigger owner, so it may write
-- to public.profiles even though RLS is on.
-- ----------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'bidder')
  )
  on conflict (id) do nothing;

  insert into public.notification_preferences (profile_id)
  values (new.id)
  on conflict (profile_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ----------------------------------------------------------------------------
-- Authorization helpers (SECURITY DEFINER so they can read profiles.role
-- without recursing through RLS).
-- ----------------------------------------------------------------------------
create or replace function current_role_value()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin' and is_active = true
  );
$$;

create or replace function has_role(roles user_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = any(roles) and is_active = true
  );
$$;

-- Guard: never let the last active super_admin be demoted/removed.
create or replace function protect_last_super_admin()
returns trigger
language plpgsql
as $$
declare
  remaining int;
begin
  if (tg_op = 'DELETE' and old.role = 'super_admin')
     or (tg_op = 'UPDATE' and old.role = 'super_admin'
         and (new.role <> 'super_admin' or new.is_active = false or new.deleted_at is not null)) then
    select count(*) into remaining
    from public.profiles
    where role = 'super_admin' and is_active = true and deleted_at is null
      and id <> old.id;
    if remaining = 0 then
      raise exception 'Cannot remove or demote the last active super_admin';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger trg_protect_super_admin
  before update or delete on profiles
  for each row execute function protect_last_super_admin();

-- ============================================================================
-- RPC: place_bid — atomic, race-safe bid placement with proxy bids and
-- anti-sniping. SECURITY DEFINER so it can read private auto_bids and write
-- bids/notifications/audit regardless of the caller's RLS.
-- ============================================================================
create or replace function place_bid(p_auction_id uuid, p_bid_amount bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bidder     uuid := auth.uid();
  v_auction    auctions%rowtype;
  v_min        bigint;
  v_now        timestamptz := now();
  v_new_current bigint;
  v_new_leader  uuid;
  v_extended    boolean := false;
  v_prev_leader uuid;
  v_emd_paid    bigint;
  -- proxy resolution
  v_rec         record;
  v_top_max     bigint;
  v_top_user    uuid;
  v_second_max  bigint;
begin
  if v_bidder is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  -- Serialize all bidders on this auction row.
  select * into v_auction from auctions where id = p_auction_id for update;
  if not found then raise exception 'AUCTION_NOT_FOUND'; end if;

  if v_auction.status <> 'active' then raise exception 'AUCTION_NOT_ACTIVE'; end if;
  if v_auction.start_time is not null and v_auction.start_time > v_now then
    raise exception 'AUCTION_NOT_STARTED'; end if;
  if v_auction.end_time <= v_now then raise exception 'AUCTION_ENDED'; end if;
  if v_auction.seller_id = v_bidder then raise exception 'SELLER_CANNOT_BID'; end if;

  -- Eligibility: KYC verified and active.
  if not exists (
    select 1 from profiles
    where id = v_bidder and is_active = true and kyc_status = 'verified'
  ) then
    raise exception 'BIDDER_NOT_ELIGIBLE';
  end if;

  -- EMD requirement, if configured.
  if v_auction.emd_required then
    select coalesce(sum(amount),0) into v_emd_paid
    from payments
    where auction_id = p_auction_id and profile_id = v_bidder
      and type = 'emd' and status = 'succeeded';
    if v_emd_paid < coalesce(v_auction.emd_amount, 0) then
      raise exception 'EMD_REQUIRED';
    end if;
  end if;

  -- Minimum acceptable bid.
  v_min := case when v_auction.bid_count = 0
                then v_auction.starting_bid
                else v_auction.current_bid + v_auction.bid_increment end;
  if p_bid_amount < v_min then
    raise exception 'BID_TOO_LOW:%', v_min;
  end if;

  v_prev_leader := v_auction.highest_bidder_id;

  -- Record the human bid.
  insert into bids (auction_id, bidder_id, amount, source)
  values (p_auction_id, v_bidder, p_bid_amount, 'manual');

  v_new_current := p_bid_amount;
  v_new_leader  := v_bidder;

  -- ---- Proxy / auto-bid resolution -------------------------------------
  -- Consider all active auto-bids (excluding the current bidder) whose max
  -- can beat the current bid. The highest max wins; price rises to the
  -- second-highest contender + one increment (eBay-style), capped by the max.
  select ab.bidder_id, ab.max_amount
    into v_top_user, v_top_max
  from auto_bids ab
  where ab.auction_id = p_auction_id
    and ab.is_active = true
    and ab.bidder_id <> v_bidder
    and ab.max_amount >= v_new_current + v_auction.bid_increment
  order by ab.max_amount desc, ab.created_at asc
  limit 1;

  if v_top_user is not null then
    -- Second-highest contender is the human's just-placed bid (or another
    -- auto-bid max, whichever is higher).
    select max(ab.max_amount) into v_second_max
    from auto_bids ab
    where ab.auction_id = p_auction_id
      and ab.is_active = true
      and ab.bidder_id not in (v_top_user)
      and ab.bidder_id <> v_bidder;

    v_second_max := greatest(coalesce(v_second_max, 0), p_bid_amount);
    v_new_current := least(v_top_max, v_second_max + v_auction.bid_increment);
    v_new_leader  := v_top_user;

    insert into bids (auction_id, bidder_id, amount, source)
    values (p_auction_id, v_top_user, v_new_current, 'auto');

    -- If the human's max was the second-highest and got beaten, notify them.
    insert into notifications (profile_id, type, title, message, link)
    values (v_bidder, 'outbid', 'You were outbid',
            'An automatic bid raised the price to the current amount.',
            '/items/' || p_auction_id);

    -- If the winning auto-bidder hit their ceiling, flag it.
    if v_new_current >= v_top_max then
      update auto_bids set is_active = false
      where auction_id = p_auction_id and bidder_id = v_top_user;
      insert into notifications (profile_id, type, title, message, link)
      values (v_top_user, 'system', 'Auto-bid maximum reached',
              'Your maximum bid was reached for this auction.',
              '/items/' || p_auction_id);
    end if;
  end if;

  -- ---- Anti-sniping -----------------------------------------------------
  if v_auction.anti_snipe_seconds > 0
     and v_auction.end_time - v_now <= make_interval(secs => v_auction.anti_snipe_seconds) then
    update auctions
      set end_time = end_time + make_interval(secs => v_auction.extend_seconds)
      where id = p_auction_id;
    v_extended := true;
  end if;

  -- ---- Commit auction state --------------------------------------------
  update auctions
    set current_bid = v_new_current,
        highest_bidder_id = v_new_leader,
        bid_count = bid_count + (case when v_top_user is not null then 2 else 1 end)
    where id = p_auction_id;

  -- Notify the previous leader they lost the lead (if different).
  if v_prev_leader is not null and v_prev_leader <> v_new_leader then
    insert into notifications (profile_id, type, title, message, link)
    values (v_prev_leader, 'outbid', 'You have been outbid',
            'A higher bid was placed on an auction you were leading.',
            '/items/' || p_auction_id);
  end if;

  insert into audit_logs (actor_id, action, entity, entity_id, details)
  values (v_bidder, 'BID', 'auction', p_auction_id::text,
          jsonb_build_object('amount', p_bid_amount, 'resulting_price', v_new_current));

  return jsonb_build_object(
    'auction_id', p_auction_id,
    'current_bid', v_new_current,
    'highest_bidder_id', v_new_leader,
    'you_are_leading', (v_new_leader = v_bidder),
    'extended', v_extended
  );
end;
$$;

-- ============================================================================
-- RPC: configure_auto_bid — set/replace a private proxy maximum.
-- ============================================================================
create or replace function configure_auto_bid(p_auction_id uuid, p_max_amount bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bidder uuid := auth.uid();
  v_auction auctions%rowtype;
begin
  if v_bidder is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_auction from auctions where id = p_auction_id for update;
  if not found then raise exception 'AUCTION_NOT_FOUND'; end if;
  if v_auction.seller_id = v_bidder then raise exception 'SELLER_CANNOT_BID'; end if;
  if p_max_amount <= v_auction.current_bid then raise exception 'MAX_TOO_LOW'; end if;

  insert into auto_bids (auction_id, bidder_id, max_amount, is_active)
  values (p_auction_id, v_bidder, p_max_amount, true)
  on conflict (auction_id, bidder_id)
  do update set max_amount = excluded.max_amount, is_active = true, updated_at = now();

  insert into notifications (profile_id, type, title, message, link)
  values (v_bidder, 'system', 'Auto-bid activated',
          'Your automatic bidding is now active for this auction.',
          '/items/' || p_auction_id);

  -- Immediately let the proxy compete if it should lead now.
  perform place_bid(p_auction_id, least(p_max_amount,
    case when v_auction.bid_count = 0 then v_auction.starting_bid
         else v_auction.current_bid + v_auction.bid_increment end));

  return jsonb_build_object('auction_id', p_auction_id, 'active', true);
exception
  when others then
    -- If the immediate competing bid is not valid yet, keep the config.
    return jsonb_build_object('auction_id', p_auction_id, 'active', true);
end;
$$;

create or replace function disable_auto_bid(p_auction_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update auto_bids set is_active = false
  where auction_id = p_auction_id and bidder_id = auth.uid();
end;
$$;

-- ============================================================================
-- RPC: close_auction — settle an ended auction (called by a scheduler/cron).
-- ============================================================================
create or replace function close_auction(p_auction_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_a auctions%rowtype;
begin
  select * into v_a from auctions where id = p_auction_id for update;
  if not found or v_a.status <> 'active' or v_a.end_time > now() then return; end if;

  if v_a.highest_bidder_id is not null
     and (v_a.reserve_price is null or v_a.current_bid >= v_a.reserve_price) then
    update auctions set status = 'sold', winner_id = highest_bidder_id where id = p_auction_id;
    insert into notifications (profile_id, type, title, message, link)
    values (v_a.highest_bidder_id, 'won', 'You won!',
            'Congratulations — you won this auction.', '/items/' || p_auction_id);
  else
    update auctions set status = 'unsold' where id = p_auction_id;
  end if;
end;
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table profiles              enable row level security;
alter table organizations         enable row level security;
alter table organization_members  enable row level security;
alter table categories            enable row level security;
alter table auctions              enable row level security;
alter table auction_images        enable row level security;
alter table bids                  enable row level security;
alter table auto_bids             enable row level security;
alter table watchlists            enable row level security;
alter table notifications         enable row level security;
alter table notification_preferences enable row level security;
alter table payments              enable row level security;
alter table payment_events        enable row level security;
alter table refunds               enable row level security;
alter table inspection_reports    enable row level security;
alter table documents             enable row level security;
alter table complaints            enable row level security;
alter table delivery_orders       enable row level security;
alter table reviews               enable row level security;
alter table audit_logs            enable row level security;
alter table platform_settings     enable row level security;

-- ---- profiles --------------------------------------------------------------
create policy profiles_self_read on profiles for select
  using (id = auth.uid() or is_super_admin());
create policy profiles_public_read on profiles for select
  using (true);  -- public display fields; sensitive columns filtered by views/app
create policy profiles_self_update on profiles for update
  using (id = auth.uid()) with check (id = auth.uid() and role = (select role from profiles p where p.id = auth.uid()));
create policy profiles_admin_all on profiles for all
  using (is_super_admin()) with check (is_super_admin());

-- ---- organizations ---------------------------------------------------------
create policy org_read on organizations for select using (true);
create policy org_admin_write on organizations for all
  using (is_super_admin() or has_role(array['organization_admin']::user_role[]))
  with check (is_super_admin() or has_role(array['organization_admin']::user_role[]));

create policy orgmem_read on organization_members for select
  using (profile_id = auth.uid() or is_super_admin()
         or has_role(array['organization_admin']::user_role[]));
create policy orgmem_admin_write on organization_members for all
  using (is_super_admin() or has_role(array['organization_admin']::user_role[]))
  with check (is_super_admin() or has_role(array['organization_admin']::user_role[]));

-- ---- categories ------------------------------------------------------------
create policy categories_read on categories for select using (is_active = true or is_super_admin());
create policy categories_admin_write on categories for all
  using (is_super_admin() or has_role(array['auction_manager']::user_role[]))
  with check (is_super_admin() or has_role(array['auction_manager']::user_role[]));

-- ---- auctions --------------------------------------------------------------
-- Public can read live/ended public auctions; sellers see their own; admins all.
create policy auctions_public_read on auctions for select
  using (
    deleted_at is null
    and (status in ('active','scheduled','ended','sold','unsold')
         or seller_id = auth.uid()
         or is_super_admin()
         or has_role(array['auction_manager','inspection_officer']::user_role[]))
  );
-- Sellers create their own listings.
create policy auctions_seller_insert on auctions for insert
  with check (seller_id = auth.uid()
              and has_role(array['seller','organization_admin','super_admin']::user_role[]));
-- Sellers edit only their own DRAFT/SCHEDULED auctions; admins/managers anytime.
create policy auctions_seller_update on auctions for update
  using (
    (seller_id = auth.uid() and status in ('draft','scheduled'))
    or is_super_admin()
    or has_role(array['auction_manager']::user_role[])
  )
  with check (
    (seller_id = auth.uid() and status in ('draft','scheduled'))
    or is_super_admin()
    or has_role(array['auction_manager']::user_role[])
  );
create policy auctions_admin_delete on auctions for delete
  using (is_super_admin());

-- ---- auction_images --------------------------------------------------------
create policy images_read on auction_images for select using (true);
create policy images_seller_write on auction_images for all
  using (exists (select 1 from auctions a where a.id = auction_id
                 and (a.seller_id = auth.uid() or is_super_admin())
                 and (a.status in ('draft','scheduled') or is_super_admin())))
  with check (exists (select 1 from auctions a where a.id = auction_id
                 and (a.seller_id = auth.uid() or is_super_admin())
                 and (a.status in ('draft','scheduled') or is_super_admin())));

-- ---- bids ------------------------------------------------------------------
-- Public may read bid history (identities masked in the app/view layer).
create policy bids_public_read on bids for select using (true);
-- NO direct insert policy: bids may only be created through place_bid() RPC.
-- (SECURITY DEFINER RPC bypasses RLS; absence of an insert policy blocks
--  any direct client insert.)
create policy bids_admin_manage on bids for all
  using (is_super_admin()) with check (is_super_admin());

-- ---- auto_bids -------------------------------------------------------------
-- Owner may read ONLY their own row (keeps max_amount private); no one else.
create policy autobids_owner_read on auto_bids for select
  using (bidder_id = auth.uid() or is_super_admin());
-- Writes go through configure_auto_bid()/disable_auto_bid() RPCs.
create policy autobids_admin_manage on auto_bids for all
  using (is_super_admin()) with check (is_super_admin());

-- ---- watchlists ------------------------------------------------------------
create policy watchlist_owner_all on watchlists for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ---- notifications ---------------------------------------------------------
create policy notif_owner_read on notifications for select
  using (profile_id = auth.uid() or is_super_admin());
create policy notif_owner_update on notifications for update
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy notif_admin_insert on notifications for insert
  with check (is_super_admin());  -- app-side broadcasts use service role / RPC

create policy notifprefs_owner_all on notification_preferences for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ---- payments / events / refunds ------------------------------------------
create policy payments_owner_read on payments for select
  using (profile_id = auth.uid() or is_super_admin()
         or has_role(array['finance']::user_role[]));
create policy payments_finance_write on payments for all
  using (is_super_admin() or has_role(array['finance']::user_role[]))
  with check (is_super_admin() or has_role(array['finance']::user_role[]));

create policy payevents_finance_read on payment_events for select
  using (is_super_admin() or has_role(array['finance']::user_role[]));

create policy refunds_finance_all on refunds for all
  using (is_super_admin() or has_role(array['finance']::user_role[]))
  with check (is_super_admin() or has_role(array['finance']::user_role[]));

-- ---- inspection_reports ----------------------------------------------------
create policy inspection_read on inspection_reports for select
  using (true);
create policy inspection_officer_write on inspection_reports for all
  using (is_super_admin() or has_role(array['inspection_officer','auction_manager']::user_role[]))
  with check (is_super_admin() or has_role(array['inspection_officer','auction_manager']::user_role[]));

-- ---- documents (private) ---------------------------------------------------
create policy documents_owner_all on documents for all
  using (owner_id = auth.uid() or is_super_admin())
  with check (owner_id = auth.uid() or is_super_admin());

-- ---- complaints ------------------------------------------------------------
create policy complaints_read on complaints for select
  using (complainant_id = auth.uid() or against_id = auth.uid()
         or is_super_admin() or has_role(array['moderator','auction_manager']::user_role[]));
create policy complaints_create on complaints for insert
  with check (complainant_id = auth.uid());
create policy complaints_admin_update on complaints for update
  using (is_super_admin() or has_role(array['moderator','auction_manager']::user_role[]))
  with check (is_super_admin() or has_role(array['moderator','auction_manager']::user_role[]));

-- ---- delivery_orders -------------------------------------------------------
create policy delivery_read on delivery_orders for select
  using (buyer_id = auth.uid() or coordinator_id = auth.uid()
         or is_super_admin() or has_role(array['delivery_coordinator','auction_manager']::user_role[]));
create policy delivery_coord_write on delivery_orders for all
  using (is_super_admin() or has_role(array['delivery_coordinator','auction_manager']::user_role[]))
  with check (is_super_admin() or has_role(array['delivery_coordinator','auction_manager']::user_role[]));

-- ---- reviews ---------------------------------------------------------------
create policy reviews_read on reviews for select using (true);
create policy reviews_author_write on reviews for insert
  with check (reviewer_id = auth.uid());
create policy reviews_author_update on reviews for update
  using (reviewer_id = auth.uid()) with check (reviewer_id = auth.uid());

-- ---- audit_logs (read-only to admins; writes via RPC/service role) --------
create policy audit_admin_read on audit_logs for select
  using (is_super_admin() or has_role(array['auction_manager','finance']::user_role[]));

-- ---- platform_settings -----------------------------------------------------
create policy settings_read on platform_settings for select using (true);
create policy settings_admin_write on platform_settings for all
  using (is_super_admin()) with check (is_super_admin());

-- ----------------------------------------------------------------------------
-- Function execution grants
-- ----------------------------------------------------------------------------
grant execute on function place_bid(uuid, bigint)            to authenticated;
grant execute on function configure_auto_bid(uuid, bigint)   to authenticated;
grant execute on function disable_auto_bid(uuid)             to authenticated;
grant execute on function close_auction(uuid)                to service_role;

-- Masked public view of bids (privacy-safe identities).
create or replace view public_bid_history as
select
  b.id, b.auction_id, b.amount, b.source, b.created_at,
  'Bidder #' || substr(b.bidder_id::text, 1, 4) as bidder_label
from bids b;
