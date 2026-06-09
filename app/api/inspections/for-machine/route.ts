import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/getSessionContext';
import { getMachine } from '@/lib/machines';
import { getSite } from '@/lib/sites';
import {
  buildMachineContext,
  templatesForMachine,
} from '@/lib/inspections/assignments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const ctx = await getSessionContext();
  const machineId = req.nextUrl.searchParams.get('machineId');
  if (!machineId) return NextResponse.json({ error: 'machineId required' }, { status: 400 });

  const machine = await getMachine(machineId, ctx.accountId);
  if (!machine) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Admin test view includes drafts so drafts can be tried before publishing.
  const templates = await templatesForMachine(ctx.accountId, machine, { includeDrafts: true });

  const site = machine.siteId ? await getSite(machine.siteId, ctx.accountId) : null;
  const machineContext = buildMachineContext(machine, site?.name ?? null);

  return NextResponse.json({ templates, machineContext });
}
