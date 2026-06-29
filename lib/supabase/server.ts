import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';

export function createSupabaseServerClient() {
  const cookieStore = cookies();

  // Cross-origin callers (the standalone mobile operator app) authenticate with
  // a Bearer token instead of a cookie. When present, forward it so PostgREST
  // applies RLS for that user (auth.uid()); the anon key stays the apikey.
  // Wrapped in try/catch because headers() isn't always available (e.g. some
  // server-component render paths) — those fall back to the cookie session.
  let authHeader: string | undefined;
  try {
    authHeader = headers().get('authorization') ?? undefined;
  } catch {
    authHeader = undefined;
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(authHeader ? { global: { headers: { Authorization: authHeader } } } : {}),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component — middleware will refresh on next request.
          }
        },
      },
    }
  );
}
