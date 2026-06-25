import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fail loudly in dev so the missing-env case is obvious.
  // eslint-disable-next-line no-console
  console.error(
    'Missing Supabase env vars. Copy .env.local.example to .env.local and fill in VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.'
  );
}

// Same Supabase project as the desktop app → same user accounts.
export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
