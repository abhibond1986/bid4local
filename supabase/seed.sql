-- ============================================================================
-- Bid 4 Local — seed data (local/dev). Runs after migrations on `db reset`.
-- Demo auth users are created by supabase/seed_demo_users.sql or the CLI;
-- this file seeds reference data and sample auctions that don't need auth.
-- ============================================================================

-- Categories -----------------------------------------------------------------
insert into categories (name, slug, icon, description, sort_order) values
  ('Electronics',   'electronics',   'smartphone', 'Phones, laptops, gadgets', 1),
  ('Vehicles',      'vehicles',      'car',        'Cars, bikes, commercial', 2),
  ('Machinery',     'machinery',     'settings',   'Industrial & farm equipment', 3),
  ('Furniture',     'furniture',     'sofa',       'Home & office furniture', 4),
  ('Real Estate',   'real-estate',   'home',       'Plots, flats, commercial', 5),
  ('Jewellery',     'jewellery',     'gem',        'Gold, silver, precious', 6),
  ('Collectibles',  'collectibles',  'star',       'Art, antiques, rare items', 7),
  ('Other',         'other',         'package',    'Everything else', 99)
on conflict (slug) do nothing;

-- NOTE: Auctions require a seller profile (FK to profiles → auth.users).
-- To seed sample auctions locally, first create demo users, then run:
--   supabase/seed_demo_data.sql
-- This keeps `seed.sql` runnable on a clean DB without auth rows.
