-- ============================================================================
-- Bid 4 Local — Initial schema
-- Migration: 20260722090000_initial_schema.sql
--
-- Framework-agnostic Supabase Postgres schema. Owns identity via auth.users
-- (Supabase Auth). Every user-facing table gets: UUID PK, created_at,
-- updated_at, soft-delete (deleted_at), and created_by/modified_by where useful.
-- RLS, triggers, and RPCs live in later migrations.
-- ============================================================================

create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "pg_trgm";        -- text search on titles

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type user_role as enum (
  'super_admin',
  'organization_admin',
  'auction_manager',
  'seller',
  'bidder',
  'finance',
  'inspection_officer',
  'delivery_coordinator',
  'moderator'
);

create type kyc_status as enum ('unsubmitted', 'pending', 'verified', 'rejected');

create type auction_status as enum (
  'draft', 'scheduled', 'active', 'ended', 'sold', 'cancelled', 'unsold'
);

create type item_condition as enum ('new', 'like_new', 'good', 'fair', 'poor', 'for_parts');

create type bid_source as enum ('manual', 'auto');

create type notification_type as enum (
  'outbid', 'won', 'lost', 'auction_start', 'auction_ending',
  'auction_extended', 'payment', 'kyc', 'system', 'chat'
);

create type payment_type as enum ('emd', 'winning', 'buy_now', 'penalty');
create type payment_status as enum ('pending', 'processing', 'succeeded', 'failed', 'refunded', 'partially_refunded');
create type refund_status as enum ('requested', 'approved', 'processing', 'completed', 'rejected');
create type complaint_status as enum ('open', 'investigating', 'resolved', 'dismissed');
create type delivery_status as enum ('pending', 'scheduled', 'in_transit', 'delivered', 'failed', 'returned');

-- ----------------------------------------------------------------------------
-- Shared trigger: keep updated_at fresh
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- profiles  (1:1 with auth.users — NO passwords stored here)
-- ----------------------------------------------------------------------------
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  display_name  text,
  avatar_url    text,
  role          user_role not null default 'bidder',
  phone         text,
  bio           text,
  organization_id uuid,               -- FK added after organizations exists
  kyc_status    kyc_status not null default 'unsubmitted',
  gst_number    text,
  pan_number    text,
  address       text,
  city          text,
  state         text,
  pincode       text check (pincode is null or pincode ~ '^[1-9][0-9]{5}$'),
  bank_name     text,
  bank_account  text,
  bank_ifsc     text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index idx_profiles_role on profiles(role) where deleted_at is null;
create index idx_profiles_kyc on profiles(kyc_status) where deleted_at is null;
create trigger trg_profiles_updated before update on profiles
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- organizations
-- ----------------------------------------------------------------------------
create table organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  gst_number  text,
  address     text,
  city        text,
  state       text,
  is_active   boolean not null default true,
  created_by  uuid references profiles(id),
  modified_by uuid references profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create trigger trg_org_updated before update on organizations
  for each row execute function set_updated_at();

alter table profiles
  add constraint fk_profiles_org
  foreign key (organization_id) references organizations(id) on delete set null;

create table organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  profile_id      uuid not null references profiles(id) on delete cascade,
  role            user_role not null default 'seller',
  created_at      timestamptz not null default now(),
  unique (organization_id, profile_id)
);

-- ----------------------------------------------------------------------------
-- categories
-- ----------------------------------------------------------------------------
create table categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  icon        text,
  description text,
  parent_id   uuid references categories(id) on delete set null,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index idx_categories_parent on categories(parent_id) where deleted_at is null;
create trigger trg_categories_updated before update on categories
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- auctions  (the sellable listing / lot)
-- Monetary values stored as bigint = paise (INR minor unit) to avoid float.
-- ----------------------------------------------------------------------------
create table auctions (
  id              uuid primary key default gen_random_uuid(),
  title           text not null check (char_length(title) between 3 and 200),
  description     text not null,
  category_id     uuid references categories(id) on delete set null,
  seller_id       uuid not null references profiles(id) on delete restrict,
  organization_id uuid references organizations(id) on delete set null,

  original_price  bigint not null check (original_price >= 0),
  starting_bid    bigint not null check (starting_bid > 0),
  current_bid     bigint not null check (current_bid >= 0),
  reserve_price   bigint check (reserve_price is null or reserve_price >= starting_bid),
  bid_increment   bigint not null default 10000 check (bid_increment > 0),  -- paise
  buy_now_price   bigint check (buy_now_price is null or buy_now_price >= starting_bid),

  emd_required    boolean not null default false,
  emd_amount      bigint check (emd_amount is null or emd_amount >= 0),

  condition       item_condition not null default 'good',
  brand           text,
  model           text,
  year            integer check (year is null or (year between 1900 and 2100)),
  serial_number   text,
  quantity        integer not null default 1 check (quantity >= 1),

  location        text,
  city            text,
  state           text,
  latitude        double precision,
  longitude       double precision,

  status          auction_status not null default 'draft',
  featured        boolean not null default false,
  cover_image_url text,

  start_time      timestamptz,
  end_time        timestamptz not null,
  anti_snipe_seconds integer not null default 120 check (anti_snipe_seconds >= 0),
  extend_seconds     integer not null default 120 check (extend_seconds >= 0),

  views           integer not null default 0,
  bid_count       integer not null default 0,
  highest_bidder_id uuid references profiles(id) on delete set null,
  winner_id       uuid references profiles(id) on delete set null,

  created_by      uuid references profiles(id),
  modified_by     uuid references profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,

  constraint chk_time_order check (start_time is null or end_time > start_time),
  constraint chk_current_ge_start check (current_bid >= 0)
);

create index idx_auctions_status      on auctions(status) where deleted_at is null;
create index idx_auctions_end_time    on auctions(end_time) where deleted_at is null;
create index idx_auctions_start_time  on auctions(start_time) where deleted_at is null;
create index idx_auctions_category    on auctions(category_id) where deleted_at is null;
create index idx_auctions_seller      on auctions(seller_id) where deleted_at is null;
create index idx_auctions_highest     on auctions(highest_bidder_id) where deleted_at is null;
create index idx_auctions_featured    on auctions(featured) where featured = true and deleted_at is null;
create index idx_auctions_location    on auctions(state, city) where deleted_at is null;
create index idx_auctions_created     on auctions(created_at desc);
create index idx_auctions_title_trgm  on auctions using gin (title gin_trgm_ops);
-- Live board: active auctions ordered by soonest to end.
create index idx_auctions_active_board on auctions(end_time) where status = 'active' and deleted_at is null;

create trigger trg_auctions_updated before update on auctions
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- auction_images  (metadata only; bytes live in Supabase Storage)
-- ----------------------------------------------------------------------------
create table auction_images (
  id          uuid primary key default gen_random_uuid(),
  auction_id  uuid not null references auctions(id) on delete cascade,
  storage_path text not null,          -- path within the auction-images bucket
  public_url  text,
  is_cover    boolean not null default false,
  sort_order  integer not null default 0,
  mime_type   text,
  size_bytes  integer check (size_bytes is null or size_bytes >= 0),
  width       integer,
  height      integer,
  created_at  timestamptz not null default now()
);
create index idx_auction_images_auction on auction_images(auction_id, sort_order);
create unique index uq_auction_cover on auction_images(auction_id) where is_cover = true;

-- ----------------------------------------------------------------------------
-- bids
-- ----------------------------------------------------------------------------
create table bids (
  id          uuid primary key default gen_random_uuid(),
  auction_id  uuid not null references auctions(id) on delete cascade,
  bidder_id   uuid not null references profiles(id) on delete restrict,
  amount      bigint not null check (amount > 0),
  source      bid_source not null default 'manual',
  created_at  timestamptz not null default now()
);
create index idx_bids_auction_amount on bids(auction_id, amount desc);
create index idx_bids_auction_time   on bids(auction_id, created_at desc);
create index idx_bids_bidder         on bids(bidder_id, created_at desc);

-- ----------------------------------------------------------------------------
-- auto_bids  (proxy bidding; max is private, enforced via RLS + RPC)
-- ----------------------------------------------------------------------------
create table auto_bids (
  id          uuid primary key default gen_random_uuid(),
  auction_id  uuid not null references auctions(id) on delete cascade,
  bidder_id   uuid not null references profiles(id) on delete cascade,
  max_amount  bigint not null check (max_amount > 0),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (auction_id, bidder_id)      -- one live proxy config per user per auction
);
create index idx_autobids_active on auto_bids(auction_id) where is_active = true;
create trigger trg_autobids_updated before update on auto_bids
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- watchlists
-- ----------------------------------------------------------------------------
create table watchlists (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  auction_id  uuid not null references auctions(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (profile_id, auction_id)
);
create index idx_watchlists_profile on watchlists(profile_id);

-- ----------------------------------------------------------------------------
-- notifications
-- ----------------------------------------------------------------------------
create table notifications (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  type        notification_type not null,
  title       text not null,
  message     text not null,
  link        text,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index idx_notifications_user_unread on notifications(profile_id, is_read, created_at desc);

create table notification_preferences (
  profile_id  uuid primary key references profiles(id) on delete cascade,
  email       boolean not null default true,
  sms         boolean not null default false,
  whatsapp    boolean not null default false,
  push        boolean not null default true,
  updated_at  timestamptz not null default now()
);
create trigger trg_notifprefs_updated before update on notification_preferences
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- payments / payment_events / refunds
-- ----------------------------------------------------------------------------
create table payments (
  id             uuid primary key default gen_random_uuid(),
  auction_id     uuid references auctions(id) on delete set null,
  profile_id     uuid not null references profiles(id) on delete restrict,
  amount         bigint not null check (amount >= 0),
  currency       text not null default 'INR',
  type           payment_type not null,
  status         payment_status not null default 'pending',
  gateway        text,                 -- 'razorpay' | 'stripe' | 'mock'
  gateway_order_id   text,
  gateway_payment_id text,
  idempotency_key    text unique,
  gst_amount     bigint default 0,
  invoice_number text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create index idx_payments_user_status on payments(profile_id, status);
create index idx_payments_auction on payments(auction_id);
create trigger trg_payments_updated before update on payments
  for each row execute function set_updated_at();

-- Append-only ledger for webhook idempotency and state transitions.
create table payment_events (
  id            uuid primary key default gen_random_uuid(),
  payment_id    uuid references payments(id) on delete cascade,
  event_type    text not null,
  gateway       text not null,
  gateway_event_id text unique,        -- dedupe webhook retries
  payload       jsonb,
  created_at    timestamptz not null default now()
);
create index idx_payment_events_payment on payment_events(payment_id);

create table refunds (
  id          uuid primary key default gen_random_uuid(),
  payment_id  uuid not null references payments(id) on delete restrict,
  amount      bigint not null check (amount > 0),
  status      refund_status not null default 'requested',
  reason      text,
  processed_by uuid references profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_refunds_updated before update on refunds
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- inspection_reports / documents / complaints / delivery_orders
-- ----------------------------------------------------------------------------
create table inspection_reports (
  id          uuid primary key default gen_random_uuid(),
  auction_id  uuid not null references auctions(id) on delete cascade,
  officer_id  uuid references profiles(id) on delete set null,
  summary     text,
  storage_path text,                   -- private bucket: inspection-documents
  inspected_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_inspection_updated before update on inspection_reports
  for each row execute function set_updated_at();

create table documents (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references profiles(id) on delete cascade,
  kind        text not null,           -- 'pan' | 'gst' | 'invoice' | ...
  storage_path text not null,          -- private bucket: user-documents
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index idx_documents_owner on documents(owner_id);

create table complaints (
  id            uuid primary key default gen_random_uuid(),
  complainant_id uuid not null references profiles(id) on delete cascade,
  against_id    uuid references profiles(id) on delete set null,
  auction_id    uuid references auctions(id) on delete set null,
  subject       text not null,
  body          text,
  status        complaint_status not null default 'open',
  assigned_to   uuid references profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_complaints_status on complaints(status);
create trigger trg_complaints_updated before update on complaints
  for each row execute function set_updated_at();

create table delivery_orders (
  id          uuid primary key default gen_random_uuid(),
  auction_id  uuid not null references auctions(id) on delete restrict,
  buyer_id    uuid not null references profiles(id) on delete restrict,
  coordinator_id uuid references profiles(id) on delete set null,
  status      delivery_status not null default 'pending',
  tracking_number text,
  address     text,
  scheduled_at timestamptz,
  delivered_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index idx_delivery_status on delivery_orders(status);
create trigger trg_delivery_updated before update on delivery_orders
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- reviews  (buyer/seller trust)
-- ----------------------------------------------------------------------------
create table reviews (
  id          uuid primary key default gen_random_uuid(),
  auction_id  uuid references auctions(id) on delete set null,
  reviewer_id uuid not null references profiles(id) on delete cascade,
  reviewee_id uuid not null references profiles(id) on delete cascade,
  rating      integer not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now(),
  unique (auction_id, reviewer_id, reviewee_id)
);
create index idx_reviews_reviewee on reviews(reviewee_id);

-- ----------------------------------------------------------------------------
-- audit_logs  (append-only)
-- ----------------------------------------------------------------------------
create table audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references profiles(id) on delete set null,
  action      text not null,
  entity      text not null,
  entity_id   text,
  details     jsonb,
  created_at  timestamptz not null default now()
);
create index idx_audit_entity on audit_logs(entity, entity_id);
create index idx_audit_actor on audit_logs(actor_id, created_at desc);

-- ----------------------------------------------------------------------------
-- platform_settings  (singleton-ish key/value)
-- ----------------------------------------------------------------------------
create table platform_settings (
  key         text primary key,
  value       jsonb not null,
  updated_by  uuid references profiles(id),
  updated_at  timestamptz not null default now()
);
create trigger trg_settings_updated before update on platform_settings
  for each row execute function set_updated_at();

insert into platform_settings (key, value) values
  ('anti_snipe', '{"window_seconds":120,"extend_seconds":120}'),
  ('demo_accounts_enabled', 'false')
on conflict (key) do nothing;
