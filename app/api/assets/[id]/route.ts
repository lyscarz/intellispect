import { NextResponse } from 'next/server';
import { fetchAsset } from '@/lib/trackunit-api';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const asset = await fetchAsset(params.id);
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }
    return NextResponse.json(asset);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[/api/assets/${params.id}]`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
