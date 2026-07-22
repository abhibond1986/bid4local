/**
 * Service-role Supabase client — TRUSTED SERVER-SIDE ONLY.
 *
 * Bypasses RLS. Import this ONLY from server code (Route Handlers, Server
 * Actions, webhooks, scheduled jobs). Never import it into a Client Component
 * or anything that ships to the browser.
 *
 * The `import 'server-only'` guard makes the build fail if this module is ever
 * pulled into a client bundle.
 */
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
