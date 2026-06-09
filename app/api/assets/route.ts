import { NextResponse } from 'next/server';
import { fetchFleet } from '@/lib/trackunit-api';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await fetchFleet();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/api/assets]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
