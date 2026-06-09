import { NextResponse, type NextRequest } from 'next/server';
import { getSessionContext } from '@/lib/getSessionContext';
import { getActiveTrackunitClient } from '@/lib/telematics/get-client';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const GRAPHQL_URL = 'https://iris.trackunit.com/api/graphql/';

/**
 * Walk every step of the V2 GraphQL path field-by-field. The user runs this
 * after wiring V2 up; the response tells us exactly which step is breaking.
 *
 *   GET /api/diagnose-v2
 */
async function postGql(
  token: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<{ ok: boolean; status: number; errors?: unknown[]; data?: unknown; bodyPreview?: string }> {
  let res: Response;
  try {
    res = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query, variables }),
      cache: 'no-store',
    });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      bodyPreview: err instanceof Error ? err.message : String(err),
    };
  }
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text);
  } catch {}
  const obj = parsed as { errors?: unknown[]; data?: unknown } | null;
  const hasErrors = Array.isArray(obj?.errors) && obj!.errors!.length > 0;
  return {
    ok: res.ok && !hasErrors,
    status: res.status,
    errors: obj?.errors,
    data: obj?.data,
    bodyPreview: text.slice(0, 400),
  };
}

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

export async function GET(_req: NextRequest) {
  const ctx = await getSessionContext();
  const client = await getActiveTrackunitClient(ctx.accountId);
  if (!client) {
    return NextResponse.json({ error: 'No active Trackunit connection' }, { status: 400 });
  }

  // Test BOTH tokens side-by-side. Per docs, V2 client_credentials is the
  // intended IrisX flow; V1 password-grant might or might not carry IrisX
  // entitlement. We try a real GraphQL query with each.
  let v1Token: string | null = null;
  let v2Token: string | null = null;
  let v1Info: unknown;
  let v2Info: unknown;
  try {
    v1Token = await client.provider.getRestToken();
    const claims = decodeJwt(v1Token);
    v1Info = { acquired: true, scopes: claims?.scp ?? claims?.scope, aud: claims?.aud, iss: claims?.iss };
  } catch (err) {
    v1Info = { acquired: false, error: err instanceof Error ? err.message : String(err) };
  }
  try {
    v2Token = await client.provider.getGqlToken();
    if (v2Token) {
      const claims = decodeJwt(v2Token);
      v2Info = { acquired: true, scopes: claims?.scp ?? claims?.scope, aud: claims?.aud, iss: claims?.iss };
    } else {
      v2Info = { acquired: false, error: 'getGqlToken() returned null — V2 client_id/secret not saved on this account' };
    }
  } catch (err) {
    v2Info = { acquired: false, error: err instanceof Error ? err.message : String(err) };
  }

  // For backwards compatibility with the rest of this handler.
  const gqlToken = v1Token ?? '';
  const tokenStep = { v1: v1Info, v2: v2Info };

  // 2) Schema ping — try multiple candidate endpoint URLs to find the one
  //    that actually serves GraphQL for this token. The original PoC URL
  //    (`iris.trackunit.com/api/graphql`) returns the Trackunit Manager SPA
  //    HTML 404, so it's not the right route.
  const candidateUrls = [
    // iris.* hosts
    'https://iris.trackunit.com/api/graphql',
    'https://iris.trackunit.com/iris/v1/graphql',
    'https://iris.trackunit.com/iris/v2/graphql',
    'https://iris.trackunit.com/iris/v3/graphql',
    'https://iris.trackunit.com/iris/graphql',
    'https://iris.trackunit.com/iris-x/graphql',
    'https://iris.trackunit.com/iris-x/v1/graphql',
    'https://iris.trackunit.com/api/iris/graphql',
    'https://iris.trackunit.com/api/iris/v1/graphql',
    'https://iris.trackunit.com/api/iris/v2/graphql',
    'https://iris.trackunit.com/api/iris/v3/graphql',
    'https://iris.trackunit.com/api/iris-x/graphql',
    'https://iris.trackunit.com/api/iris-x/v1/graphql',
    'https://iris.trackunit.com/api/v2/graphql',
    'https://iris.trackunit.com/v2/graphql',
    'https://iris.trackunit.com/graphql',
    'https://iris.trackunit.com/data/v1/graphql',
    'https://iris.trackunit.com/data/graphql',
    'https://iris.trackunit.com/public/api/graphql',
    // api.* hosts (real host, different 404 HTML — worth more probing)
    'https://api.trackunit.com/iris/v1/graphql',
    'https://api.trackunit.com/iris/v2/graphql',
    'https://api.trackunit.com/iris/v3/graphql',
    'https://api.trackunit.com/iris/graphql',
    'https://api.trackunit.com/iris-x/v1/graphql',
    'https://api.trackunit.com/iris-x/graphql',
    'https://api.trackunit.com/v1/graphql',
    'https://api.trackunit.com/v2/graphql',
    'https://api.trackunit.com/v3/graphql',
    'https://api.trackunit.com/graphql',
  ];

  // Strategies: POST with Bearer (standard GraphQL), POST with X-API-Key,
  // GET (Playground / introspection landing page).
  type ProbeStrategy = 'bearer-post' | 'apikey-post' | 'get';
  const strategies: ProbeStrategy[] = ['bearer-post', 'apikey-post', 'get'];

  async function probeOne(url: string, strategy: ProbeStrategy) {
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      const init: RequestInit = { cache: 'no-store' };
      if (strategy === 'get') {
        init.method = 'GET';
      } else {
        init.method = 'POST';
        headers['Content-Type'] = 'application/json';
        if (strategy === 'bearer-post') headers.Authorization = `Bearer ${gqlToken}`;
        if (strategy === 'apikey-post') headers['X-API-Key'] = gqlToken!;
        init.body = JSON.stringify({ query: '{ __typename }' });
      }
      init.headers = headers;
      const res = await fetch(url, init);
      const ct = res.headers.get('content-type') ?? '';
      const text = await res.text();
      let parsed: unknown = null;
      if (ct.includes('application/json')) {
        try {
          parsed = JSON.parse(text);
        } catch {}
      }
      return {
        url,
        strategy,
        status: res.status,
        contentType: ct,
        isJson: !!parsed,
        hasGraphqlData: !!(parsed as { data?: unknown } | null)?.data,
        hasGraphqlErrors: Boolean(
          Array.isArray((parsed as { errors?: unknown[] } | null)?.errors) &&
            ((parsed as { errors?: unknown[] }).errors?.length ?? 0) > 0
        ),
        parsed: parsed as unknown,
        bodyPreview: text.slice(0, 200),
      };
    } catch (err) {
      return {
        url,
        strategy,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  const endpointProbes = await Promise.all(
    candidateUrls.flatMap((url) => strategies.map((s) => probeOne(url, s)))
  );

  // Try to ID the "winner" — first URL that returned JSON with either `data`
  // or proper GraphQL `errors` (i.e. the server is GraphQL-aware).
  const winner = endpointProbes.find(
    (p) => 'isJson' in p && (p.hasGraphqlData === true || p.hasGraphqlErrors === true)
  );

  const schemaPing = winner
    ? { ok: true, foundEndpoint: winner.url, status: winner.status, parsed: winner.parsed }
    : {
        ok: false,
        error:
          'None of the candidate GraphQL endpoints returned a GraphQL response. Token works (V2 issuance OK) but no URL we know serves the GraphQL API for it. See endpointProbes for per-URL detail.',
      };

  // 3) Pick a real Trackunit asset ID from this account's machines to test
  //    against. If the user hasn't imported any yet, we just skip the
  //    per-asset tests.
  const supabase = createSupabaseServerClient();
  const { data: anyMachine } = await supabase
    .from('machines')
    .select('source_external_id, serial_number')
    .eq('account_id', ctx.accountId)
    .eq('source', 'trackunit')
    .not('source_external_id', 'is', null)
    .limit(1)
    .maybeSingle();
  const sampleAssetId = (anyMachine?.source_external_id as string | undefined) ?? null;

  let minimalAssetQuery: unknown = { skipped: 'no Trackunit machine imported yet' };
  let withInsights: unknown = { skipped: 'no Trackunit machine imported yet' };
  let withLocations: unknown = { skipped: 'no Trackunit machine imported yet' };
  let withImage: unknown = { skipped: 'no Trackunit machine imported yet' };
  let withMeta: unknown = { skipped: 'no Trackunit machine imported yet' };

  if (sampleAssetId) {
    minimalAssetQuery = await postGql(
      gqlToken,
      `query Q($id: ID!) { asset(id: $id) { id name lastSeen } }`,
      { id: sampleAssetId }
    );

    withInsights = await postGql(
      gqlToken,
      `query Q($id: ID!) {
        asset(id: $id) {
          id
          insights {
            fuelLevel
            batteryStateOfChargePercent
            cumulativeOperatingHours(period: LIFETIME)
            cumulativeEngineHours(period: LIFETIME)
          }
        }
      }`,
      { id: sampleAssetId }
    );

    withLocations = await postGql(
      gqlToken,
      `query Q($id: ID!) {
        asset(id: $id) {
          id
          locations {
            latest {
              geometry { type coordinates }
              properties { address { streetAddress city country } updatedAt }
            }
          }
        }
      }`,
      { id: sampleAssetId }
    );

    withImage = await postGql(
      gqlToken,
      `query Q($id: ID!) { asset(id: $id) { id image { url } } }`,
      { id: sampleAssetId }
    );

    withMeta = await postGql(
      gqlToken,
      `query Q($id: ID!) { asset(id: $id) { id brand model serialNumber assetType } }`,
      { id: sampleAssetId }
    );
  }

  // Side-by-side: run the SAME minimal query against the GraphQL endpoint
  // using V1 token vs V2 token. The one that returns data (or returns errors
  // about specific fields rather than auth) is the right token for IrisX.
  const v1VsV2 = {
    v1: v1Token
      ? await postGql(v1Token, '{ __typename }')
      : { skipped: 'no V1 token' },
    v2: v2Token
      ? await postGql(v2Token, '{ __typename }')
      : { skipped: 'no V2 token' },
  };

  // 4) Fleet pagination — exactly the shape our cron + search rely on.
  const fleetPageOne = await postGql(
    gqlToken,
    `query FleetTest($first: Int!) {
      assets(first: $first) {
        edges { node { id name } }
        pageInfo { endCursor hasNextPage }
      }
    }`,
    { first: 1 }
  );

  // 5) Also test the fleet pagination WITH the wider field set the cron uses.
  const fleetPageOneFull = await postGql(
    gqlToken,
    `query FleetTest($first: Int!) {
      assets(first: $first) {
        edges {
          node {
            id
            name
            brand
            model
            serialNumber
            assetType
            lastSeen
            status { activity }
            image { url }
            locations { latest { geometry { type coordinates } } }
            insights {
              fuelLevel
              batteryStateOfChargePercent
              cumulativeOperatingHours(period: LIFETIME)
              cumulativeEngineHours(period: LIFETIME)
            }
          }
        }
        pageInfo { endCursor hasNextPage }
      }
    }`,
    { first: 1 }
  );

  return NextResponse.json({
    v2TokenAcquired: tokenStep,
    v1VsV2,
    schemaPing,
    endpointProbes,
    sampleAssetId,
    minimalAssetQuery,
    withInsights,
    withLocations,
    withImage,
    withMeta,
    fleetPageOne,
    fleetPageOneFull,
    note:
      'If `schemaPing.foundEndpoint` is set, that\'s the GraphQL URL we should hard-code into `GRAPHQL_URL`. The other queries still target the old `iris.trackunit.com/api/graphql` because the production code path hasn\'t been moved yet — only the endpointProbes matter for now.',
  });
}
