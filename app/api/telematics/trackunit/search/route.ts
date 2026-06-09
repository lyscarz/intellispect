import { NextResponse, type NextRequest } from 'next/server';
import { getSessionContext } from '@/lib/getSessionContext';
import { getActiveTrackunitClient } from '@/lib/telematics/get-client';
import { fetchAllAssetsMetadataWith } from '@/lib/trackunit-api';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Asset } from '@/lib/types';

export interface AssetSummary {
  assetId: string;
  name: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { fetchedAt: number; assets: Asset[] }>();

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext();
  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.trim().toLowerCase() ?? '';

  const client = await getActiveTrackunitClient(ctx.accountId);
  if (!client) {
    return NextResponse.json(
      { error: 'No active Trackunit connection. Add one in /settings/connections.' },
      { status: 400 }
    );
  }

  const cached = cache.get(ctx.accountId);
  let assets: Asset[];
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    assets = cached.assets;
  } else {
    try {
      // Metadata-only walk — Asset API, no AEMP/GraphQL. Picker only needs
      // name/brand/model/serial to show selectable rows.
      assets = await fetchAllAssetsMetadataWith(client.provider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch Trackunit fleet';
      return NextResponse.json({ error: msg }, { status: 502 });
    }
    cache.set(ctx.accountId, { fetchedAt: Date.now(), assets });
  }

  // Find which assetIds are already imported for this account.
  const supabase = createSupabaseServerClient();
  const { data: imported } = await supabase
    .from('machines')
    .select('source_external_id')
    .eq('account_id', ctx.accountId)
    .eq('source', 'trackunit')
    .not('source_external_id', 'is', null);
  const importedIds = new Set((imported ?? []).map((r) => r.source_external_id as string));

  // Filter client-side based on q.
  const filtered = q
    ? assets.filter((a) => {
        const hay = `${a.name} ${a.brand ?? ''} ${a.model ?? ''} ${a.serialNumber ?? ''}`.toLowerCase();
        return hay.includes(q);
      })
    : assets;

  const summary: AssetSummary[] = filtered.map((a) => ({
    assetId: a.assetId,
    name: a.name,
    brand: a.brand,
    model: a.model,
    serialNumber: a.serialNumber,
  }));

  return NextResponse.json({
    assets: summary,
    alreadyImportedIds: Array.from(importedIds),
    totalCount: assets.length,
    filteredCount: summary.length,
  });
}
