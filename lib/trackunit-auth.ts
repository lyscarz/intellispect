/**
 * Trackunit token service.
 *
 * Two flows:
 *   V1 (REST, scope=api):        password grant
 *   V2 (GraphQL, scope=asset.view): client_credentials (optional)
 *
 * Two ways to use it:
 *   - createTrackunitTokenProvider(creds) → per-account provider (used by app code)
 *   - getAccessToken() / getGqlAccessToken() — legacy env-backed exports kept for
 *     the /trackunit-debug page only. Do NOT use them in new code.
 */

export interface TrackunitCreds {
  /** V1 (REST) — password grant */
  tokenUrl: string;        // e.g. https://auth.trackunit.com/token
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  /** V2 (GraphQL/IrisX) — client_credentials, optional */
  gqlClientId?: string | null;
  gqlClientSecret?: string | null;
  gqlScope?: string | null; // default: 'asset.view'
}

export interface TrackunitTokenProvider {
  getRestToken(): Promise<string>;
  getGqlToken(): Promise<string | null>;
  /** Opaque per-credentials identifier used for in-memory caches (AEMP map etc). */
  cacheKey: string;
}

interface TokenCache {
  accessToken: string;
  expiresAt: number; // epoch ms
}

const V2_TOKEN_URL = 'https://auth.trackunit.com/token/v2';

async function requestRestToken(creds: TrackunitCreds): Promise<TokenCache> {
  const res = await fetch(creds.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      username: creds.username,
      password: creds.password,
    }),
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Trackunit V1 token request failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
}

async function requestGqlToken(creds: TrackunitCreds): Promise<TokenCache | null> {
  if (!creds.gqlClientId || !creds.gqlClientSecret) return null;
  const res = await fetch(V2_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: creds.gqlClientId,
      client_secret: creds.gqlClientSecret,
      scope: creds.gqlScope ?? 'asset.view',
    }),
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`[Trackunit] V2 token request failed (${res.status}): ${text}`);
    return null;
  }
  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 1200) * 1000,
  };
}

/**
 * Create a token provider scoped to a specific set of credentials. Each
 * provider has its own token cache so multiple accounts don't trample each
 * other's tokens.
 */
export function createTrackunitTokenProvider(creds: TrackunitCreds): TrackunitTokenProvider {
  let restCache: TokenCache | null = null;
  let gqlCache: TokenCache | null = null;

  return {
    cacheKey: `tu:${creds.clientId}`,
    async getRestToken() {
      if (restCache && Date.now() < restCache.expiresAt - 60_000) return restCache.accessToken;
      restCache = await requestRestToken(creds);
      return restCache.accessToken;
    },
    async getGqlToken() {
      if (gqlCache && Date.now() < gqlCache.expiresAt - 60_000) return gqlCache.accessToken;
      const fresh = await requestGqlToken(creds);
      if (!fresh) return null;
      gqlCache = fresh;
      return gqlCache.accessToken;
    },
  };
}

// ─── Legacy env-backed provider — used only by /trackunit-debug ─────────────

function readEnvCreds(): TrackunitCreds {
  const tokenUrl = process.env.TRACKUNIT_TOKEN_URL;
  const clientId = process.env.TRACKUNIT_CLIENT_ID;
  const clientSecret = process.env.TRACKUNIT_CLIENT_SECRET;
  const username = process.env.TRACKUNIT_API_USERNAME;
  const password = process.env.TRACKUNIT_API_PASSWORD;
  if (!tokenUrl || !clientId || !clientSecret || !username || !password) {
    throw new Error(
      'Missing Trackunit V1 credentials in env. Set TRACKUNIT_TOKEN_URL, TRACKUNIT_CLIENT_ID, ' +
        'TRACKUNIT_CLIENT_SECRET, TRACKUNIT_API_USERNAME, TRACKUNIT_API_PASSWORD in .env.local — ' +
        'this path is for /trackunit-debug only. App code should use the per-account provider.'
    );
  }
  return {
    tokenUrl,
    clientId,
    clientSecret,
    username,
    password,
    gqlClientId: process.env.TRACKUNIT_GQL_CLIENT_ID || null,
    gqlClientSecret: process.env.TRACKUNIT_GQL_CLIENT_SECRET || null,
    gqlScope: process.env.TRACKUNIT_GQL_SCOPES || null,
  };
}

let envProvider: TrackunitTokenProvider | null = null;
function getEnvProvider(): TrackunitTokenProvider {
  if (!envProvider) envProvider = createTrackunitTokenProvider(readEnvCreds());
  return envProvider;
}

/** @deprecated only for /trackunit-debug. Use createTrackunitTokenProvider(creds). */
export async function getAccessToken(): Promise<string> {
  return getEnvProvider().getRestToken();
}

/** @deprecated only for /trackunit-debug. Use createTrackunitTokenProvider(creds). */
export async function getGqlAccessToken(): Promise<string | null> {
  return getEnvProvider().getGqlToken();
}
