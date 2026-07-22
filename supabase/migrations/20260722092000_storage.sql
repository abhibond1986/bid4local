-- ============================================================================
-- Bid 4 Local — Storage buckets and policies
-- Migration: 20260722092000_storage.sql
-- ============================================================================

-- auction-images: public read, seller-scoped write.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('auction-images', 'auction-images', true, 5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- inspection-documents: private (signed URLs only).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inspection-documents', 'inspection-documents', false, 10485760,
        array['application/pdf','image/jpeg','image/png'])
on conflict (id) do nothing;

-- user-documents: private (KYC etc.).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('user-documents', 'user-documents', false, 10485760,
        array['application/pdf','image/jpeg','image/png'])
on conflict (id) do nothing;

-- ---- auction-images policies ----------------------------------------------
-- Convention: object path = "{auction_id}/{filename}".
create policy "auction images public read"
  on storage.objects for select
  using (bucket_id = 'auction-images');

create policy "auction images seller insert"
  on storage.objects for insert
  with check (
    bucket_id = 'auction-images'
    and exists (
      select 1 from public.auctions a
      where a.id::text = split_part(name, '/', 1)
        and (a.seller_id = auth.uid() or public.is_super_admin())
    )
  );

create policy "auction images seller delete"
  on storage.objects for delete
  using (
    bucket_id = 'auction-images'
    and exists (
      select 1 from public.auctions a
      where a.id::text = split_part(name, '/', 1)
        and (a.seller_id = auth.uid() or public.is_super_admin())
    )
  );

-- ---- user-documents policies (owner-scoped; path = "{profile_id}/...") -----
create policy "user documents owner read"
  on storage.objects for select
  using (bucket_id = 'user-documents'
         and (split_part(name, '/', 1) = auth.uid()::text or public.is_super_admin()));

create policy "user documents owner write"
  on storage.objects for insert
  with check (bucket_id = 'user-documents'
              and split_part(name, '/', 1) = auth.uid()::text);

-- ---- inspection-documents (officers/admins only) --------------------------
create policy "inspection docs staff read"
  on storage.objects for select
  using (bucket_id = 'inspection-documents'
         and (public.is_super_admin()
              or public.has_role(array['inspection_officer','auction_manager']::user_role[])));

create policy "inspection docs staff write"
  on storage.objects for insert
  with check (bucket_id = 'inspection-documents'
              and (public.is_super_admin()
                   or public.has_role(array['inspection_officer','auction_manager']::user_role[])));
