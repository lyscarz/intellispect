import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function RootRedirect() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  redirect(data.user ? '/fleet' : '/login');
}
