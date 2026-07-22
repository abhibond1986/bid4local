# Bid 4 Local — Supabase Setup

## Local development
Prerequisites: Docker, Node 20+, Supabase CLI (`npm i -g supabase`).

```bash
# 1. Start the local stack (Postgres, Auth, Storage, Studio, Realtime).
supabase start

# 2. Apply migrations + seed to a clean database.
supabase db reset

# 3. Inspect running services & keys.
supabase status

# 4. Generate TypeScript types from the live local schema.
npm run db:types          # → src/types/database.ts

# 5. Copy the printed anon key / service key / URL into .env.local.
cp .env.example .env.local
# then edit .env.local with values from `supabase status`

# 6. Run the app.
npm install
npm run dev
```

`supabase status` prints local URLs: API `http://localhost:54321`, Studio `http://localhost:54323`, Inbucket (test email) `http://localhost:54324`.

### Creating a new migration
```bash
supabase migration new my_change
# edit the generated SQL file under supabase/migrations/
supabase db reset          # re-apply from scratch to verify
```

## Hosted project
```bash
# 1. Create a project at app.supabase.com; note the project ref.
# 2. Link and push migrations.
supabase link --project-ref <ref>
supabase db push           # applies supabase/migrations/ to the remote DB

# 3. Create storage buckets — the storage migration does this, but verify in
#    Dashboard → Storage that auction-images (public), inspection-documents
#    (private), user-documents (private) exist.

# 4. Auth → URL Configuration:
#    Site URL:            https://your-domain
#    Redirect URLs:       https://your-domain/auth/callback
# 5. Auth → Providers: enable Email (confirmations on), Google, Azure.
# 6. Generate prod types:
supabase gen types typescript --project-id <ref> > src/types/database.ts
```

## First super-admin (secure)
Do **not** hardcode a super-admin. After a normal signup, promote by user id from a trusted SQL console (service role):

```sql
update public.profiles set role = 'super_admin', is_active = true
where id = '<auth-user-uuid>';
```

The `protect_last_super_admin()` trigger then prevents accidentally removing the last one.
