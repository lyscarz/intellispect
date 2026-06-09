import { NextResponse, type NextRequest } from 'next/server';
import { getSessionContext } from '@/lib/getSessionContext';
import { createManualMachine, listMachinesForAccount } from '@/lib/machines';

export async function GET() {
  const ctx = await getSessionContext();
  const machines = await listMachinesForAccount(ctx.accountId);
  return NextResponse.json({ machines });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  const body = await request.json();
  if (!body?.name || typeof body.name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  const machine = await createManualMachine(ctx.accountId, ctx.userId, {
    name: body.name,
    brand: body.brand ?? null,
    model: body.model ?? null,
    serialNumber: body.serialNumber ?? null,
    site: body.site ?? null,
  });
  return NextResponse.json({ machine }, { status: 201 });
}
