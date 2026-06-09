import { createClient } from '@supabase/supabase-js';

/**
 * Service-role client. Bypasses RLS — server-only, never expose to the browser.
 * Used for first-account auto-create and other privileged maintenance ops.
 */
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
