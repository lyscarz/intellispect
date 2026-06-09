import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Decode a JWT payload without verifying the signature */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(payload, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export async function GET() {
  // ── 1. Get access token ─────────────────────────────────────────────────────
  let accessToken: string | null = null;
  let tokenError: string | null = null;

  try {
    const tokenRes = await fetch(process.env.TRACKUNIT_TOKEN_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: process.env.TRACKUNIT_CLIENT_ID!,
        client_secret: process.env.TRACKUNIT_CLIENT_SECRET!,
        username: process.env.TRACKUNIT_API_USERNAME!,
        password: process.env.TRACKUNIT_API_PASSWORD!,
      }),
      cache: 'no-store',
    });
    if (tokenRes.ok) {
      const tj = await tokenRes.json();
      accessToken = tj.access_token ?? null;
    } else {
      tokenError = `${tokenRes.status} ${await tokenRes.text().catch(() => '')}`;
    }
  } catch (e) {
    tokenError = String(e);
  }

  if (!accessToken) return NextResponse.json({ step: 'token', error: tokenError ?? 'no token' });

  // ── 2. Decode JWT claims (shows scopes) ──────────────────────────────────────
  const claims = decodeJwtPayload(accessToken);

  // ── 3. Test all known GraphQL endpoints ──────────────────────────────────────
  const h = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
  const gqlBody = JSON.stringify({ query: '{ __typename }' });

  const gqlCandidates = [
    'https://iris.trackunit.com/api/graphql',
    'https://iris.trackunit.com/public/api/graphql',
    'https://iris.trackunit.com/graphql',
    'https://iris.trackunit.com/public/graphql',
  ];

  const gqlResults: Record<string, unknown> = {};
  for (const url of gqlCandidates) {
    try {
      const res = await fetch(url, { method: 'POST', headers: h, body: gqlBody, cache: 'no-store' });
      const text = await res.text();
      gqlResults[url] = { status: res.status, body: text.slice(0, 300) };
    } catch (e) {
      gqlResults[url] = { error: String(e) };
    }
  }

  // ── 4. Quick REST sanity check ────────────────────────────────────────────────
  let restStatus: number | string;
  try {
    const restRes = await fetch('https://iris.trackunit.com/api/asset/v2/assets?size=1', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    restStatus = restRes.status;
  } catch (e) {
    restStatus = String(e);
  }

  // ── 5. Test V2 client_credentials token (if configured) ─────────────────────
  let v2Result: Record<string, unknown> = { configured: false };
  const gqlClientId = process.env.TRACKUNIT_GQL_CLIENT_ID;
  const gqlClientSecret = process.env.TRACKUNIT_GQL_CLIENT_SECRET;

  if (gqlClientId && gqlClientSecret) {
    try {
      const v2Res = await fetch('https://auth.trackunit.com/token/v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: gqlClientId,
          client_secret: gqlClientSecret,
          scope: process.env.TRACKUNIT_GQL_SCOPES ?? 'asset.view',
        }),
        cache: 'no-store',
      });
      const v2Json = await v2Res.json();
      if (v2Res.ok && v2Json.access_token) {
        const v2Claims = decodeJwtPayload(v2Json.access_token);
        // Test GraphQL with this token
        const gqlRes = await fetch(process.env.TRACKUNIT_API_URL ?? 'https://iris.trackunit.com/api/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${v2Json.access_token}` },
          body: JSON.stringify({ query: '{ __typename }' }),
          cache: 'no-store',
        });
        const gqlText = await gqlRes.text();
        v2Result = {
          configured: true,
          tokenOk: true,
          scopes: v2Claims?.scp ?? v2Claims?.scope,
          graphql: { status: gqlRes.status, body: gqlText.slice(0, 200) },
        };
      } else {
        v2Result = { configured: true, tokenOk: false, error: v2Json };
      }
    } catch (e) {
      v2Result = { configured: true, tokenOk: false, error: String(e) };
    }
  }

  return NextResponse.json({
    v1: {
      tokenOk: true,
      tokenClaims: {
        scp: claims?.scp,
        aud: claims?.aud,
        iss: claims?.iss,
        sub: claims?.sub,
      },
      restAssetApi: restStatus,
      graphql: gqlResults,
    },
    v2: v2Result,
  });
}
