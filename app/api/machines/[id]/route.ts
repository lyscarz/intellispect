import { NextResponse, type NextRequest } from 'next/server';
import { getSessionContext } from '@/lib/getSessionContext';
import { deleteMachine, getMachine, updateMachine } from '@/lib/machines';
import { deleteMachineImage } from '@/lib/storage';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getSessionContext();
  const machine = await getMachine(params.id, ctx.accountId);
  if (!machine) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ machine });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getSessionContext();
  const body = await request.json();
  const machine = await updateMachine(params.id, ctx.accountId, {
    name: body.name,
    brand: body.brand,
    model: body.model,
    serialNumber: body.serialNumber,
    site: body.site,
  });
  return NextResponse.json({ machine });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getSessionContext();
  const machine = await getMachine(params.id, ctx.accountId);
  if (!machine) return NextResponse.json({ error: 'not found' }, { status: 404 });
  await deleteMachine(params.id, ctx.accountId);
  if (machine.imagePath) await deleteMachineImage(machine.imagePath);
  return NextResponse.json({ ok: true });
}
