/**
 * Session-refresh + route-protection helper for Next.js middleware.
 * Keeps the Supabase auth cookie fresh on every request and redirects
 * unauthenticated users away from protected route prefixes.
 */
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';

const PROTECTED_PREFIXES = ['/admin', '/profile', '/my-bids', '/my-auctions', '/watchlist', '/sell'];
const ADMIN_PREFIXES = ['/admin'];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: getUser() (not getSession()) validates the JWT with the server.
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p));
  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', path);
    return NextResponse.redirect(url);
  }

  // Server-side admin gate (defense in depth; RLS is the real backstop).
  if (user && ADMIN_PREFIXES.some((p) => path.startsWith(p))) {
    const { data } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single();
    // Cast because the generated DB types are a placeholder stub until
    // `supabase gen types typescript` is run against the live schema.
    const profile = data as { role: string | null; is_active: boolean | null } | null;
    const adminRoles = ['super_admin', 'organization_admin', 'auction_manager', 'finance', 'moderator', 'inspection_officer', 'delivery_coordinator'];
    if (!profile || !profile.is_active || !adminRoles.includes(profile.role as string)) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  return response;
}
