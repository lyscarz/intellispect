/**
 * Trackunit API layer.
 *
 * Tries the IrisX GraphQL endpoint first (requires IrisX subscription).
 * Falls back automatically to the public REST + AEMP 2.0 APIs which are
 * available on all Trackunit accounts.
 *
 * Two entry styles:
 *   - fetchFleetWith(provider, page) / fetchAssetWith(provider, id) — app code
 *   - fetchFleet(page) / fetchAsset(id) — legacy env-backed, /trackunit-debug only
 */

import {
  createTrackunitTokenProvider,
  getAccessToken,
  getGqlAccessToken,
  type TrackunitCreds,
  type TrackunitTokenProvider,
} from './trackunit-auth';
import type {
  Asset,
  AssetLocation,
  AssetInsights,
  ActivityState,
  AssetAttention,
  AssetSiteRef,
  AssetEvent,
  CriticalityState,
} from './types';

// ─── Endpoints ──────────────────────────────────────────────────────────────

// Trailing slash is REQUIRED — the gateway routes `/api/graphql` (no slash)
// to the Trackunit Manager SPA and only serves the real GraphQL endpoint at
// `/api/graphql/`. We force the trailing slash here so a stale env var
// (set before this was discovered) can't break the GraphQL path.
const GQL_ENDPOINT = ensureTrailingSlash(
  process.env.TRACKUNIT_API_URL ?? 'https://iris.trackunit.com/api/graphql/'
);
function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

const ASSET_API = 'https://iris.trackunit.com/api/asset/v2/assets';
// AEMP 2.0 (ISO 15143-3): page 0 is a metadata index, actual data starts at page 1
const AEMP_BASE = 'https://iris.trackunit.com/public/api/aemp/v2/15143/-3/Fleet';

export const PAGE_SIZE = 50;

// ─── GraphQL queries ─────────────────────────────────────────────────────────

// Shared fragment-ish field list. Note we ask for the FULL status block —
// `activity` for the existing badge plus `criticality` (NONE|LOW|CRITICAL)
// and the `attention` counts that drive the new AlertsBadge.
// `sites(first: 1)` pulls the asset's primary Trackunit site so cron can
// auto-link `machines.site_id` to a locally-imported sites row.
const FLEET_QUERY = `
  query GetFleet($first: Int!, $after: Cursor) {
    assets(first: $first, after: $after) {
      edges {
        node {
          id
          name
          brand
          model
          serialNumber
          assetType
          lastSeen
          status {
            activity
            criticality
            attention {
              criticalEventCount
              lowEventCount
              lastEventTime
            }
          }
          image { url }
          locations {
            latest {
              geometry { type coordinates }
              properties {
                address { streetAddress city country }
                updatedAt
              }
            }
          }
          insights {
            fuelLevel
            batteryStateOfChargePercent
            cumulativeOperatingHours(period: LIFETIME)
            cumulativeEngineHours(period: LIFETIME)
          }
          sites(first: 1) {
            edges { node { id name } }
          }
        }
      }
      pageInfo { endCursor hasNextPage }
    }
  }
`;

const ASSET_QUERY = `
  query GetAsset($id: ID!) {
    asset(id: $id) {
      id
      name
      brand
      model
      serialNumber
      assetType
      lastSeen
      status {
        activity
        criticality
        attention {
          criticalEventCount
          lowEventCount
          lastEventTime
        }
      }
      image { url }
      locations {
        latest {
          geometry { type coordinates }
          properties {
            address { streetAddress city country }
            updatedAt
          }
        }
      }
      insights {
        fuelLevel
        batteryStateOfChargePercent
        cumulativeOperatingHours(period: LIFETIME)
        cumulativeEngineHours(period: LIFETIME)
      }
      sites(first: 1) {
        edges { node { id name } }
      }
      # Active events only — Trackunit's EventList.active filter spares us
      # client-side filtering and skips closed/dismissed events on the wire.
      # Complexity cost: 20 × first. ASSET_QUERY only — NEVER add this to
      # FLEET_QUERY (single asset paths can afford 500-ish complexity per
      # call, fleet-wide walks at 700+ assets cannot).
      events {
        active(first: 25) {
          edges {
            node {
              id
              type
              criticality
              timeOn
              timeOff
              active
              count
              description
              descriptionPoweredByOem
            }
          }
        }
      }
    }
  }
`;

const IMAGE_QUERY = `
  query GetImages($first: Int!, $after: Cursor) {
    assets(first: $first, after: $after) {
      edges {
        node {
          serialNumber
          image { url }
        }
      }
      pageInfo { endCursor hasNextPage }
    }
  }
`;

// Top-level sites list. Used by app/api/telematics/trackunit/sync-sites.
// Field list mirrors what we store in our local sites table: name + address +
// type/status for the "Trackunit" pill metadata. Requires scope `site.view`
// (same V1 token, no extra grant needed).
const SITES_QUERY = `
  query GetSites($first: Int!, $after: Cursor) {
    sites(first: $first, after: $after) {
      edges {
        node {
          id
          name
          type
          status
          city
          country
          streetAddress
          zipCode
          externalReference
        }
      }
      pageInfo { endCursor hasNextPage }
    }
  }
`;

// ─── GraphQL + REST executors (take a provider) ──────────────────────────────

async function gql<T>(
  provider: TrackunitTokenProvider,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  // Per Trackunit docs (https://developers.trackunit.com/docs/reference/getting-started/access-token/),
  // GraphQL uses the V1 password-grant token (scope=api) — the same token
  // that powers REST + AEMP. The V2 client_credentials token we mint at
  // /token/v2 with `asset.view` scope is for the IrisX App SDK, NOT for the
  // public GraphQL endpoint.
  const token = await provider.getRestToken();

  const res = await fetch(GQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`GraphQL request failed (${res.status})`);
  const json = await res.json();
  if (json.errors?.length)
    throw new Error(`GraphQL error: ${json.errors.map((e: { message: string }) => e.message).join(', ')}`);
  return json.data as T;
}

async function restGet<T>(provider: TrackunitTokenProvider, url: string): Promise<T> {
  const token = await provider.getRestToken();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    const retryAfter = res.headers.get('retry-after');
    const suffix = retryAfter ? ` (retry-after: ${retryAfter}s)` : '';
    throw new Error(`REST ${url} failed (${res.status})${suffix}`);
  }
  return res.json() as Promise<T>;
}

// ─── REST type shapes ────────────────────────────────────────────────────────

interface RestAsset {
  id: string;
  name?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  assetType?: string;
  type?: string;
  lastReportedAt?: string;
}

interface RestAssetPage {
  content: RestAsset[];
  totalPages: number;
  totalElements: number;
}

export interface AempEquipment {
  EquipmentHeader?: {
    EquipmentID?: string;
    SerialNumber?: string;
    PIN?: string;
    OEMName?: string;
    Model?: string;
  };
  Location?: { Latitude?: number; Longitude?: number; datetime?: string };
  CumulativeOperatingHours?: { Hour?: number; datetime?: string };
  CumulativeIdleHours?: { Hour?: number; datetime?: string };
  FuelRemaining?: { Percent?: number; datetime?: string };
  EngineStatus?: { Running?: boolean; datetime?: string };
}

interface AempPage {
  equipment: AempEquipment[];
  links: Array<{ href: string; rel: string }>;
}

// ─── AEMP fleet fetch (all pages) ────────────────────────────────────────────

/** Trim + upper-case, treating empty strings as null. Used on both the map-build
 * and the lookup sides so whitespace/case differences don't break the join. */
function normSerial(s: string | undefined | null): string | null {
  if (!s) return null;
  const t = s.trim().toUpperCase();
  return t.length ? t : null;
}

const AEMP_CACHE_TTL_MS = 5 * 60_000; // 5 min — AEMP positions update on the minute, plenty for our UI
const AEMP_429_COOLDOWN_MS = 5 * 60_000; // 5 minutes
const AEMP_PAGE_DELAY_MS = 300; // Sleep between page fetches to stay under Trackunit's rate limit
const AEMP_MAX_HOPS = 500; // Enough for ~25 000 machines at 50/page
const aempCache = new Map<string, { fetchedAt: number; map: Map<string, AempEquipment> }>();
/** Coalesce concurrent fetches per-account so a sync-all storm doesn't hit AEMP N times. */
const aempInFlight = new Map<string, Promise<Map<string, AempEquipment>>>();
/** Cool-down timestamps: while in cooldown, return last good (or empty) map without re-fetching. */
const aempCooldown = new Map<string, number>();

/**
 * Fetch the full AEMP fleet feed and return a Map keyed by normalized
 * SerialNumber + PIN + EquipmentID. Cached per-credentials for 30 seconds so
 * 30s polling on /fleet/[id] doesn't re-fetch the full feed every tick.
 *
 * Concurrent callers (e.g. sync-all's 8 parallel workers) all await the same
 * in-flight promise — only one network fetch happens per account per window.
 *
 * Pagination iterates `next` links (ISO 15143-3 canonical); falls back to
 * `last`-link parsing if only page 1 was returned (handles odd Trackunit
 * variants where `next` is missing but `last` is present).
 */
async function fetchAllAemp(provider: TrackunitTokenProvider): Promise<Map<string, AempEquipment>> {
  const cached = aempCache.get(provider.cacheKey);
  if (cached && Date.now() - cached.fetchedAt < AEMP_CACHE_TTL_MS) {
    return cached.map;
  }

  // If we're in 429 cooldown, serve last-known cache (even if stale) instead of
  // hammering AEMP further. Empty map if nothing cached yet.
  const cooldownUntil = aempCooldown.get(provider.cacheKey) ?? 0;
  if (Date.now() < cooldownUntil) {
    return cached?.map ?? new Map<string, AempEquipment>();
  }

  const existing = aempInFlight.get(provider.cacheKey);
  if (existing) return existing;

  const promise = (async (): Promise<Map<string, AempEquipment>> => {
    try {
      const equipment: AempEquipment[] = [];
      const seen = new Set<string>();
      let firstPageLinks: Array<{ href: string; rel: string }> | null = null;
      let url: string | null = `${AEMP_BASE}/1`;
      let firstFetchError: unknown = null;
      let pageIndex = 0;

      while (url && !seen.has(url) && seen.size < AEMP_MAX_HOPS) {
        seen.add(url);
        // Pace requests after the first page — Trackunit's rate limit caps
        // sustained throughput; brief sleeps keep us well under it.
        if (pageIndex > 0) {
          await new Promise((r) => setTimeout(r, AEMP_PAGE_DELAY_MS));
        }
        pageIndex++;
        let page: AempPage;
        try {
          page = await restGet<AempPage>(provider, url);
        } catch (err) {
          if (!firstFetchError) firstFetchError = err;
          // Set a cool-down on 429 — honor Retry-After if Trackunit provided one.
          if (err instanceof Error && /\b429\b/.test(err.message)) {
            const m = err.message.match(/retry-after: (\d+)s/);
            const retryAfterMs = m ? parseInt(m[1], 10) * 1000 : AEMP_429_COOLDOWN_MS;
            aempCooldown.set(provider.cacheKey, Date.now() + retryAfterMs);
          }
          break;
        }
        if (!firstPageLinks) firstPageLinks = page.links ?? [];
        if (page.equipment) equipment.push(...page.equipment);
        url = page.links?.find((l) => l.rel === 'next')?.href ?? null;
      }

      // Fallback: if next-link iteration only walked page 1 but there's a `last`
      // link pointing further, parse it and fetch the remaining pages in parallel.
      if (seen.size === 1 && firstPageLinks) {
        const lastLink = firstPageLinks.find((l) => l.rel === 'last');
        const lastPageNum = lastLink ? parseInt(lastLink.href.split('/').pop() ?? '1', 10) : 1;
        if (lastPageNum > 1) {
          const rest = await Promise.all(
            Array.from({ length: lastPageNum - 1 }, (_, i) =>
              restGet<AempPage>(provider, `${AEMP_BASE}/${i + 2}`).catch(
                () => ({ equipment: [], links: [] } as AempPage)
              )
            )
          );
          for (const p of rest) if (p.equipment) equipment.push(...p.equipment);
        }
      }

      // Build map: index each equipment record under EVERY identifier it has,
      // normalized. First write wins so priority is SerialNumber > PIN > EquipmentID.
      const map = new Map<string, AempEquipment>();
      for (const e of equipment) {
        const keys = [
          normSerial(e.EquipmentHeader?.SerialNumber),
          normSerial(e.EquipmentHeader?.PIN),
          normSerial(e.EquipmentHeader?.EquipmentID),
        ].filter((k): k is string => !!k);
        for (const k of keys) if (!map.has(k)) map.set(k, e);
      }

      // Only cache if we actually got data — never poison the cache with an
      // empty map from a failed/partial fetch.
      if (equipment.length > 0) {
        aempCache.set(provider.cacheKey, { fetchedAt: Date.now(), map });
        return map;
      }

      // Fresh fetch failed (e.g. 429). If we have ANY cached data — even
      // stale — return it rather than the error. Better stale coords than no
      // coords; the cooldown will throttle further attempts.
      if (firstFetchError) {
        const stale = aempCache.get(provider.cacheKey);
        if (stale) {
          console.warn(
            `[AEMP] fresh fetch failed (${firstFetchError instanceof Error ? firstFetchError.message : String(firstFetchError)}); serving stale cache from ${new Date(stale.fetchedAt).toISOString()}`
          );
          return stale.map;
        }
        // No prior cache exists — surface the error to the caller.
        throw firstFetchError;
      }
      return map;
    } finally {
      aempInFlight.delete(provider.cacheKey);
    }
  })();

  aempInFlight.set(provider.cacheKey, promise);
  return promise;
}

/** Look up an AEMP record by an asset's identifying field, using the same
 *  normalization the map was built with. */
function lookupAemp(map: Map<string, AempEquipment>, serial: string | null | undefined): AempEquipment | undefined {
  const key = normSerial(serial);
  return key ? map.get(key) : undefined;
}

/** Public: fetch the AEMP fleet map for the active provider, used by sync-all
 *  and other callers that need the raw join key map. Honors the in-memory
 *  cache + cooldown logic so callers don't have to think about rate limits. */
export async function fetchAempMap(provider: TrackunitTokenProvider): Promise<Map<string, AempEquipment>> {
  return fetchAllAemp(provider);
}

/** Build a fresh Asset by overlaying any AEMP-derived telemetry on top of the
 *  previous snapshot. AEMP is the source of truth for live telemetry, so
 *  whenever AEMP provides a field we take it. The one exception is location:
 *  we only replace lat/lng if AEMP's own location.datetime is newer than the
 *  one we already have stored (so a stale poll doesn't overwrite a fresh fix).
 *
 *  Returns `prev` unchanged when AEMP has no record for this asset. */
export function applyAempToAsset(prev: Asset, aemp: AempEquipment | undefined): Asset {
  if (!aemp) return prev;

  // Location: only replace lat/lng if AEMP's reading is newer than ours.
  let location = prev.location;
  const lat = aemp.Location?.Latitude;
  const lng = aemp.Location?.Longitude;
  if (lat != null && lng != null) {
    const aempTs = aemp.Location?.datetime;
    const prevTs = prev.location?.updatedAt;
    const newer = !prevTs || (aempTs && new Date(aempTs).getTime() > new Date(prevTs).getTime());
    if (newer || !prev.location) {
      location = {
        coordinates: [lng, lat],
        address: prev.location?.address ?? null,
        updatedAt: aempTs ?? null,
      };
    }
  }

  // Activity, fuel, hours: AEMP wins whenever it has a value.
  let activity: ActivityState | null = prev.activity;
  if (aemp.EngineStatus?.Running != null) {
    activity = aemp.EngineStatus.Running ? 'WORKING' : 'STOPPED';
  }
  const insights = { ...prev.insights };
  if (aemp.FuelRemaining?.Percent != null) {
    insights.fuelLevel = aemp.FuelRemaining.Percent;
  }
  if (aemp.CumulativeOperatingHours?.Hour != null) {
    insights.cumulativeOperatingHours = aemp.CumulativeOperatingHours.Hour;
  }

  // lastSeen = the most-recent datetime AEMP reported across its fields.
  const candidates = [
    aemp.EngineStatus?.datetime,
    aemp.Location?.datetime,
    aemp.CumulativeOperatingHours?.datetime,
    aemp.FuelRemaining?.datetime,
    prev.lastSeen ?? undefined,
  ].filter((s): s is string => !!s);
  const lastSeen =
    candidates.length === 0
      ? prev.lastSeen
      : candidates.reduce((a, b) => (new Date(a).getTime() >= new Date(b).getTime() ? a : b));

  return { ...prev, location, activity, lastSeen, insights };
}

/** Public: same normalization the AEMP map uses on its keys. Exposed so
 *  callers can look up with `aempMap.get(normalizeSerial(machine.serial_number))`. */
export function normalizeSerial(s: string | undefined | null): string | null {
  return normSerial(s);
}

// ─── Normalizers ─────────────────────────────────────────────────────────────

function normalizeGqlLocation(raw: Record<string, unknown> | null | undefined): AssetLocation | null {
  if (!raw) return null;
  const latest = raw.latest as Record<string, unknown> | null;
  if (!latest) return null;
  const geometry = latest.geometry as Record<string, unknown> | null;
  const properties = latest.properties as Record<string, unknown> | null;
  const addressRaw = properties?.address as Record<string, string | null> | null;
  const coords = geometry?.coordinates as [number, number] | null;
  return {
    coordinates: coords ?? null,
    address: addressRaw
      ? {
          street: addressRaw.streetAddress ?? null,
          city: addressRaw.city ?? null,
          country: addressRaw.country ?? null,
        }
      : null,
    updatedAt: (properties?.updatedAt as string | null) ?? null,
  };
}

function normalizeGqlInsights(raw: Record<string, unknown> | null | undefined): AssetInsights {
  return {
    fuelLevel: (raw?.fuelLevel as number | null) ?? null,
    batteryStateOfChargePercent: (raw?.batteryStateOfChargePercent as number | null) ?? null,
    cumulativeOperatingHours: (raw?.cumulativeOperatingHours as number | null) ?? null,
    cumulativeEngineHours: (raw?.cumulativeEngineHours as number | null) ?? null,
  };
}

/** Trackunit's GraphQL returns Relay-global ids prefixed with `___<Type>___`.
 *  Our DB stores the bare UUID, so strip any such prefix. Works for both
 *  `___Asset___<uuid>` and `___Site___<uuid>`. */
function stripGqlIdPrefix(id: unknown): string {
  if (typeof id !== 'string') return '';
  const match = /^___[A-Za-z]+___/.exec(id);
  return match ? id.slice(match[0].length) : id;
}
/** @deprecated kept temporarily for any external imports; use stripGqlIdPrefix. */
const stripGqlAssetIdPrefix = stripGqlIdPrefix;
void stripGqlAssetIdPrefix;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeGqlAttention(status: any): AssetAttention | null {
  if (!status) return null;
  const criticality = (status.criticality ?? null) as CriticalityState | null;
  const attention = status.attention ?? null;
  // Only emit an attention block if Trackunit gave us *something*. If criticality
  // is null/undefined and there are no counts, we'd be inventing data — leave null.
  if (!criticality && !attention) return null;
  return {
    criticality: criticality ?? 'NONE',
    criticalEventCount:
      typeof attention?.criticalEventCount === 'number' ? attention.criticalEventCount : 0,
    lowEventCount: typeof attention?.lowEventCount === 'number' ? attention.lowEventCount : 0,
    lastEventTime: (attention?.lastEventTime as string | null) ?? null,
  };
}

/** Pick the first site edge off `asset.sites` and strip the GraphQL id prefix. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeGqlTrackunitSite(sites: any): AssetSiteRef | null {
  const node = sites?.edges?.[0]?.node;
  if (!node?.id || !node?.name) return null;
  return { id: stripGqlIdPrefix(node.id), name: String(node.name) };
}

/**
 * Map `asset.events.active.edges[].node` into our `AssetEvent[]` shape.
 * Defensive: tolerates missing fields and an absent events block. Returns
 * `[]` when Trackunit didn't send any events.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeGqlEvents(events: any): AssetEvent[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const edges = events?.active?.edges as Array<{ node: any }> | undefined;
  if (!Array.isArray(edges)) return [];
  const out: AssetEvent[] = [];
  for (const edge of edges) {
    const n = edge?.node;
    if (!n?.id || !n?.type) continue;
    out.push({
      id: stripGqlIdPrefix(n.id),
      type: String(n.type),
      severity: ((n.criticality as CriticalityState | null) ?? 'NONE') as CriticalityState,
      openedAt: (n.timeOn as string | null) ?? null,
      closedAt: (n.timeOff as string | null) ?? null,
      active: typeof n.active === 'boolean' ? n.active : true,
      count: typeof n.count === 'number' ? n.count : 1,
      description: (n.description as string | null) ?? null,
      descriptionPoweredByOem: (n.descriptionPoweredByOem as string | null) ?? null,
    });
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeGqlAsset(node: any): Asset {
  const attention = normalizeGqlAttention(node.status);
  return {
    assetId: stripGqlIdPrefix(node.id),
    name: node.name,
    brand: node.brand ?? null,
    model: node.model ?? null,
    serialNumber: node.serialNumber ?? null,
    assetType: node.assetType ?? 'MACHINE',
    lastSeen: node.lastSeen ?? null,
    activity: (node.status?.activity as ActivityState | null) ?? null,
    imageUrl: node.image?.url ?? null,
    location: normalizeGqlLocation(node.locations),
    insights: normalizeGqlInsights(node.insights),
    // Back-compat: derive a simple topAlert from criticality so any existing
    // UI that still reads `topAlert` keeps working. New code should use
    // `attention` directly.
    topAlert:
      attention && attention.criticality !== 'NONE'
        ? { type: 'attention', criticality: attention.criticality }
        : null,
    attention,
    trackunitSite: normalizeGqlTrackunitSite(node.sites),
    events: normalizeGqlEvents(node.events),
  };
}

function normalizeRestAsset(assetMeta: RestAsset, aemp?: AempEquipment): Asset {
  let location: AssetLocation | null = null;
  if (aemp?.Location?.Latitude !== undefined && aemp.Location.Longitude !== undefined) {
    location = {
      coordinates: [aemp.Location.Longitude, aemp.Location.Latitude],
      address: null,
      updatedAt: aemp.Location.datetime ?? null,
    };
  }

  const insights: AssetInsights = {
    fuelLevel: aemp?.FuelRemaining?.Percent ?? null,
    batteryStateOfChargePercent: null,
    cumulativeOperatingHours: aemp?.CumulativeOperatingHours?.Hour ?? null,
    cumulativeEngineHours: null,
  };

  let activity: ActivityState | null = null;
  if (aemp?.EngineStatus?.Running !== undefined) {
    activity = aemp.EngineStatus.Running ? 'WORKING' : 'STOPPED';
  }

  return {
    assetId: assetMeta.id,
    name: assetMeta.name ?? 'Unknown',
    brand: assetMeta.brand ?? null,
    model: assetMeta.model ?? null,
    serialNumber: assetMeta.serialNumber ?? null,
    // Prefer the specific subtype ("Trailer Mounted Boom") over the broad
    // "MACHINE" classification — Trackunit Manager shows the specific one.
    assetType: assetMeta.type ?? assetMeta.assetType ?? 'MACHINE',
    lastSeen: assetMeta.lastReportedAt ?? aemp?.CumulativeOperatingHours?.datetime ?? null,
    activity,
    imageUrl: null,
    location,
    insights,
    topAlert: null,
    // REST + AEMP path has no criticality/attention data — Trackunit's V1
    // surface doesn't expose it. The GraphQL path is where these populate.
    attention: null,
    trackunitSite: null,
    events: [],
  };
}

// ─── GQL image enrichment ────────────────────────────────────────────────────

async function fetchGqlImages(
  provider: TrackunitTokenProvider,
  serialNumbers: Set<string>
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const data = await gql<{
      assets: {
        edges: Array<{ node: { serialNumber: string | null; image: { url: string } | null } }>;
        pageInfo: { endCursor: string; hasNextPage: boolean };
      };
    }>(provider, IMAGE_QUERY, { first: 200 });

    for (const { node } of data.assets.edges) {
      if (node.serialNumber && node.image?.url && serialNumbers.has(node.serialNumber)) {
        map.set(node.serialNumber, node.image.url);
      }
    }
  } catch {
    // GQL not configured or failed — images will show as placeholders.
  }
  return map;
}

// ─── REST fleet fetch ────────────────────────────────────────────────────────

async function fetchFleetRest(
  provider: TrackunitTokenProvider,
  page: number,
  pageSize: number
): Promise<{ assets: Asset[]; totalCount: number; totalPages: number }> {
  // Both calls must succeed. If AEMP errors out we want to surface it to the
  // import / sync caller rather than silently produce assets with no location.
  const [assetPage, aempMap] = await Promise.all([
    restGet<RestAssetPage>(provider, `${ASSET_API}?size=${pageSize}&page=${page}`),
    fetchAllAemp(provider),
  ]);

  const serialNumbers = new Set(
    assetPage.content.map((a) => a.serialNumber).filter(Boolean) as string[]
  );
  const imageMap = await fetchGqlImages(provider, serialNumbers);

  const assets = assetPage.content.map((a) => {
    const aemp = lookupAemp(aempMap, a.serialNumber);
    const asset = normalizeRestAsset(a, aemp);
    if (a.serialNumber && imageMap.has(a.serialNumber)) {
      asset.imageUrl = imageMap.get(a.serialNumber) ?? null;
    }
    return asset;
  });

  return {
    assets,
    totalCount: assetPage.totalElements,
    totalPages: assetPage.totalPages,
  };
}

async function fetchAssetRest(
  provider: TrackunitTokenProvider,
  id: string
): Promise<Asset | null> {
  const assetMeta = await restGet<RestAsset>(provider, `${ASSET_API}/${id}`).catch(() => null);
  if (!assetMeta) return null;

  // Surface AEMP failures to callers — silently returning a map-less Asset
  // overwrites good DB data with null location.
  const aempMap = await fetchAllAemp(provider);
  const aemp = lookupAemp(aempMap, assetMeta.serialNumber);

  return normalizeRestAsset(assetMeta, aemp);
}

// ─── New per-account API ─────────────────────────────────────────────────────

export async function fetchFleetWith(
  provider: TrackunitTokenProvider,
  page = 0
): Promise<{ assets: Asset[]; totalCount: number; totalPages: number }> {
  return fetchFleetRest(provider, page, PAGE_SIZE);
}

export async function fetchAssetWith(
  provider: TrackunitTokenProvider,
  id: string
): Promise<Asset | null> {
  try {
    const data = await gql<{ asset: unknown | null }>(provider, ASSET_QUERY, { id });
    if (!data.asset) return null;
    return normalizeGqlAsset(data.asset);
  } catch {
    return fetchAssetRest(provider, id);
  }
}

/**
 * Walk the GraphQL fleet feed paginated 100-per-page. Returns Asset[] with
 * location + image + insights baked in by Trackunit's GraphQL — no AEMP
 * needed.
 *
 * Returns null if `gql()` immediately rejects authentication (the account
 * doesn't have GraphQL access — caller should fall back to REST+AEMP).
 * Throws on other errors so the caller can decide whether to swallow them.
 */
export async function fetchAllAssetsGqlWith(
  provider: TrackunitTokenProvider
): Promise<Asset[] | null> {
  const PAGE = 100;
  const assets: Asset[] = [];
  let after: string | null = null;

  // Pace between pages, same as AEMP, to avoid burst rate limits.
  let pageIndex = 0;
  // Safety cap so a broken cursor loop can't run forever.
  const MAX_PAGES = 500;

  while (pageIndex < MAX_PAGES) {
    if (pageIndex > 0) await new Promise((r) => setTimeout(r, AEMP_PAGE_DELAY_MS));
    pageIndex++;
    let data;
    try {
      data = await gql<{
        assets: {
          edges: Array<{ node: unknown }>;
          pageInfo: { endCursor: string | null; hasNextPage: boolean };
        };
      }>(provider, FLEET_QUERY, { first: PAGE, after });
    } catch (err) {
      // First page failed entirely — surface so the caller can choose to fall back.
      if (pageIndex === 1) throw err;
      // Mid-walk failure — return what we have rather than abort.
      break;
    }
    for (const { node } of data.assets.edges) {
      assets.push(normalizeGqlAsset(node));
    }
    if (!data.assets.pageInfo.hasNextPage) break;
    after = data.assets.pageInfo.endCursor;
    if (!after) break;
  }

  return assets;
}

/**
 * Walk the Asset API across all pages, returning Asset[] with metadata only
 * (no AEMP, no GraphQL, no telemetry). Used by the connect picker — which
 * only needs name/brand/model/serial to show the user a selectable list.
 *
 * This avoids hitting AEMP at all on picker load (a single AEMP walk for
 * 10k-machine fleets is 200 paged requests and was tripping rate limits).
 */
export async function fetchAllAssetsMetadataWith(
  provider: TrackunitTokenProvider
): Promise<Asset[]> {
  // Page 0 = first page (Spring Boot pagination).
  const first = await restGet<RestAssetPage>(
    provider,
    `${ASSET_API}?size=${PAGE_SIZE}&page=0`
  );
  const all: Asset[] = first.content.map((a) => normalizeRestAsset(a, undefined));
  if (first.totalPages <= 1) return all;

  // Subsequent pages, sequential with 300 ms pacing — modest enough to stay
  // well under Trackunit's per-minute REST limit even on 10k-asset fleets.
  for (let p = 1; p < first.totalPages; p++) {
    await new Promise((r) => setTimeout(r, AEMP_PAGE_DELAY_MS));
    try {
      const page = await restGet<RestAssetPage>(
        provider,
        `${ASSET_API}?size=${PAGE_SIZE}&page=${p}`
      );
      for (const a of page.content) all.push(normalizeRestAsset(a, undefined));
    } catch {
      // Skip a bad page rather than abort the whole walk.
    }
  }
  return all;
}

/** Shape used by the sync-sites pipeline. Mirrors the GraphQL Site fields we
 *  read — assembled into our local `sites` table by the upsert helper. */
export interface TrackunitSite {
  /** Trackunit's site id (sans `___Site___` Relay prefix). */
  id: string;
  name: string;
  type: string | null;
  status: string | null;
  city: string | null;
  country: string | null;
  streetAddress: string | null;
  zipCode: string | null;
  externalReference: string | null;
}

/**
 * Walk the GraphQL sites feed across all pages. Returns null if the
 * account's token lacks `site.view` (so the caller can skip site sync
 * gracefully) and throws on other errors so they surface in cron logs.
 */
export async function fetchAllSitesGqlWith(
  provider: TrackunitTokenProvider
): Promise<TrackunitSite[] | null> {
  const PAGE = 100;
  const out: TrackunitSite[] = [];
  let after: string | null = null;
  let pageIndex = 0;
  const MAX_PAGES = 500;

  while (pageIndex < MAX_PAGES) {
    if (pageIndex > 0) await new Promise((r) => setTimeout(r, AEMP_PAGE_DELAY_MS));
    pageIndex++;
    let data;
    try {
      data = await gql<{
        sites: {
          edges: Array<{
            node: {
              id: string;
              name: string;
              type: string | null;
              status: string | null;
              city: string | null;
              country: string | null;
              streetAddress: string | null;
              zipCode: string | null;
              externalReference: string | null;
            };
          }>;
          pageInfo: { endCursor: string | null; hasNextPage: boolean };
        };
      }>(provider, SITES_QUERY, { first: PAGE, after });
    } catch (err) {
      // First-page failure → surface so the caller can decide (e.g. cron logs it).
      // If the token lacks site.view we expect a specific error string from gql();
      // we let it bubble rather than guess.
      if (pageIndex === 1) throw err;
      break;
    }
    for (const { node } of data.sites.edges) {
      out.push({
        id: stripGqlIdPrefix(node.id),
        name: node.name,
        type: node.type ?? null,
        status: node.status ?? null,
        city: node.city ?? null,
        country: node.country ?? null,
        streetAddress: node.streetAddress ?? null,
        zipCode: node.zipCode ?? null,
        externalReference: node.externalReference ?? null,
      });
    }
    if (!data.sites.pageInfo.hasNextPage) break;
    after = data.sites.pageInfo.endCursor;
    if (!after) break;
  }
  return out;
}

/**
 * Fetch the full Trackunit asset list across all pages. Used by the connect
 * picker so users can search across everything in their account at once.
 */
export async function fetchAllAssetsWith(provider: TrackunitTokenProvider): Promise<Asset[]> {
  // Prefer GraphQL if available — paginated fleet feed gives us location +
  // image + insights in one shape, no AEMP walk.
  try {
    const gqlAssets = await fetchAllAssetsGqlWith(provider);
    if (gqlAssets) return gqlAssets;
  } catch {
    // Fall through to REST+AEMP path.
  }

  // First page primes the AEMP cache. If AEMP fails we throw — better to
  // surface that to the import caller than silently produce empty results.
  const first = await fetchFleetRest(provider, 0, PAGE_SIZE);
  if (first.totalPages <= 1) return first.assets;

  // For pages 1+, AEMP is already cached so subsequent fetchFleetRest calls
  // are cheap. We allow individual Asset-API page failures (return empty
  // assets for that page) so a single hiccup doesn't kill the whole import.
  const restPages = await Promise.all(
    Array.from({ length: first.totalPages - 1 }, (_, i) =>
      fetchFleetRest(provider, i + 1, PAGE_SIZE).catch(() => ({ assets: [], totalCount: 0, totalPages: 0 }))
    )
  );

  return [...first.assets, ...restPages.flatMap((p) => p.assets)];
}

/**
 * Fetch a single Trackunit asset's metadata (no AEMP). Cheap: exactly one
 * Asset-API request. Used by the import flow so we don't have to do a full
 * fleet walk just to grab a handful of selected machines.
 */
export async function fetchAssetMetadataWith(
  provider: TrackunitTokenProvider,
  id: string
): Promise<Asset | null> {
  const meta = await restGet<RestAsset>(provider, `${ASSET_API}/${id}`).catch(() => null);
  if (!meta) return null;
  return normalizeRestAsset(meta, undefined);
}

/**
 * Import-time per-asset fetch. Tries GraphQL first (1 request, includes image
 * + location + insights when V2 GraphQL is configured), falls back to the
 * Asset-API metadata-only path on V1-only accounts.
 *
 * Never touches AEMP — telemetry for V1 accounts comes in on the next cron
 * tick or first home-page refresh.
 */
export async function fetchAssetForImportWith(
  provider: TrackunitTokenProvider,
  id: string
): Promise<Asset | null> {
  try {
    const data = await gql<{ asset: unknown | null }>(provider, ASSET_QUERY, { id });
    if (data.asset) return normalizeGqlAsset(data.asset);
  } catch {
    // 'no-gql-credentials' or transient GQL error — fall back to REST metadata.
  }
  return fetchAssetMetadataWith(provider, id);
}

/** Verify creds by requesting a REST token. Throws if invalid. */
export async function verifyTrackunitCreds(creds: TrackunitCreds): Promise<{ rest: true; gql: boolean }> {
  const provider = createTrackunitTokenProvider(creds);
  await provider.getRestToken();
  const gqlToken = await provider.getGqlToken();
  return { rest: true, gql: !!gqlToken };
}

// ─── Legacy env-backed exports — /trackunit-debug only ──────────────────────

const legacyEnvProvider: TrackunitTokenProvider = {
  cacheKey: 'tu:env',
  getRestToken: () => getAccessToken(),
  getGqlToken: () => getGqlAccessToken(),
};

export async function fetchFleet(page = 0) {
  return fetchFleetWith(legacyEnvProvider, page);
}

export async function fetchAsset(id: string) {
  return fetchAssetWith(legacyEnvProvider, id);
}
