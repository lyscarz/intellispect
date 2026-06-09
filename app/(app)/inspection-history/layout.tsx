import { getSessionContext } from '@/lib/getSessionContext';

export const dynamic = 'force-dynamic';

/** Permissive gate for now — anyone in the account can view inspection runs.
 *  Tighten with role checks later if operators should only see their own. */
export default async function InspectionHistoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await getSessionContext();
  return <>{children}</>;
}
