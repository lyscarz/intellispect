import { NextResponse, type NextRequest } from 'next/server';
import { getSessionContext } from '@/lib/getSessionContext';
import { getActiveTrackunitClient } from '@/lib/telematics/get-client';

export const dynamic = 'force-dynamic';

const GRAPHQL_URL = 'https://iris.trackunit.com/api/graphql/';

/**
 * Targeted introspection of Trackunit's GraphQL schema. Returns:
 *   - All fields on the `Asset` type
 *   - All fields on the `Query` root type
 *   - Any types whose names mention site / project / alert / criticality / health
 *
 * Goal: find the right field names for "asset's site" + "asset's alerts" so
 * we can write FLEET_QUERY and ASSET_QUERY against the real schema instead
 * of guessing.
 *
 *   GET /api/diagnose-v2/schema
 */
async function postGql(token: string, query: string, variables?: Record<string, unknown>) {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  });
  const text = await res.text();
  try {
    return { status: res.status, parsed: JSON.parse(text) as unknown };
  } catch {
    return { status: res.status, raw: text.slice(0, 300) };
  }
}

interface TypeRef {
  kind: string;
  name: string | null;
  ofType?: TypeRef | null;
}
interface FieldDef {
  name: string;
  description?: string | null;
  type: TypeRef;
}

function describeType(t: TypeRef): string {
  if (!t) return '?';
  if (t.kind === 'NON_NULL') return `${describeType(t.ofType!)}!`;
  if (t.kind === 'LIST') return `[${describeType(t.ofType!)}]`;
  return t.name ?? '?';
}

export async function GET(_req: NextRequest) {
  const ctx = await getSessionContext();
  const client = await getActiveTrackunitClient(ctx.accountId);
  if (!client) return NextResponse.json({ error: 'No active Trackunit connection' }, { status: 400 });

  const token = await client.provider.getRestToken();

  // 1. Asset type fields
  const assetTypeResp = await postGql(
    token,
    `query { __type(name: "Asset") { name kind fields { name description type { kind name ofType { kind name ofType { kind name } } } } } }`
  );

  // 2. Query root fields
  const queryTypeResp = await postGql(
    token,
    `query { __schema { queryType { name fields { name description type { kind name ofType { kind name ofType { kind name } } } } } } }`
  );

  // 3. All type NAMES (so we can find Site / Alert / etc.)
  const allTypesResp = await postGql(
    token,
    `query { __schema { types { name kind } } }`
  );

  // 4. For any type matching site / alert / project / criticality / health /
  //    notification / warning / event / fault, fetch its fields via a focused
  //    __type(name: ...) lookup. One query per type, run in parallel.
  let relatedTypes: Array<{ name: string; kind: string; fields: FieldDef[]; enumValues?: string[] }> = [];
  const allTypesParsed =
    (allTypesResp as { parsed?: { data?: { __schema?: { types?: Array<{ name: string; kind: string }> } } } })
      .parsed?.data?.__schema?.types ?? [];
  const interestingNames = allTypesParsed
    .filter(
      (t) =>
        t &&
        typeof t.name === 'string' &&
        /site|project|alert|critic|health|warning|notif|status|geofence|event|fault|state/i.test(t.name) &&
        !t.name.startsWith('__')
    )
    .map((t) => t.name)
    .slice(0, 40);

  if (interestingNames.length > 0) {
    const detailResponses = await Promise.all(
      interestingNames.map((name) =>
        postGql(
          token,
          `query Detail($name: String!) {
            __type(name: $name) {
              name
              kind
              enumValues { name }
              fields { name description type { kind name ofType { kind name ofType { kind name } } } }
            }
          }`,
          { name }
        ).then((resp) => ({ name, resp }))
      )
    );
    relatedTypes = detailResponses
      .map(({ name, resp }) => {
        const t =
          (resp as {
            parsed?: {
              data?: {
                __type?: {
                  name: string;
                  kind: string;
                  fields: FieldDef[] | null;
                  enumValues: Array<{ name: string }> | null;
                };
              };
            };
          }).parsed?.data?.__type;
        if (!t) return { name, kind: 'UNKNOWN', fields: [] as FieldDef[] };
        return {
          name: t.name,
          kind: t.kind,
          fields: Array.isArray(t.fields) ? t.fields : [],
          enumValues: Array.isArray(t.enumValues) ? t.enumValues.map((e) => e.name) : undefined,
        };
      })
      .filter((t) => t.fields.length > 0 || (t.enumValues && t.enumValues.length > 0));
  }

  // Compact summaries for the most important pieces.
  const assetFields =
    (assetTypeResp as { parsed?: { data?: { __type?: { fields?: FieldDef[] } } } }).parsed?.data?.__type
      ?.fields ?? [];
  const queryFields =
    (queryTypeResp as { parsed?: { data?: { __schema?: { queryType?: { fields?: FieldDef[] } } } } }).parsed?.data
      ?.__schema?.queryType?.fields ?? [];

  return NextResponse.json({
    assetFields: assetFields.map((f) => ({ name: f.name, type: describeType(f.type), description: f.description })),
    queryRootFields: queryFields.map((f) => ({
      name: f.name,
      type: describeType(f.type),
      description: f.description,
    })),
    interestingTypeNames: interestingNames,
    relatedTypes: relatedTypes.map((t) => ({
      name: t.name,
      kind: t.kind,
      ...(t.enumValues ? { enumValues: t.enumValues } : {}),
      fields: t.fields.map((f) => ({ name: f.name, type: describeType(f.type), description: f.description })),
    })),
    note:
      'Scan `assetFields` for anything site/project/alert-ish — that\'s what we add to FLEET_QUERY and ASSET_QUERY. ' +
      'Scan `queryRootFields` for a top-level sites/projects/alerts list (used by sync-sites). ' +
      'Scan `relatedTypes` for the field shape of those types.',
  });
}
