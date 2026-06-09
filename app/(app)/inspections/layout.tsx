import { redirect } from 'next/navigation';
import { getSessionContext } from '@/lib/getSessionContext';

export const dynamic = 'force-dynamic';

export default async function InspectionsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getSessionContext();
  if (ctx.role === 'operator') redirect('/fleet');
  return <>{children}</>;
}
