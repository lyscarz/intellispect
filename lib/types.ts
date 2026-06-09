export type ActivityState = 'WORKING' | 'IDLING' | 'STOPPED' | 'UNKNOWN';
export type CriticalityState = 'NONE' | 'LOW' | 'CRITICAL';

export interface AssetLocation {
  coordinates: [number, number] | null; // [longitude, latitude]
  address: {
    street: string | null;
    city: string | null;
    country: string | null;
  } | null;
  updatedAt: string | null;
}

export interface AssetInsights {
  fuelLevel: number | null;             // percentage
  batteryStateOfChargePercent: number | null; // percentage
  cumulativeOperatingHours: number | null;    // hours
  cumulativeEngineHours: number | null;       // hours
}

/**
 * Asset attention block — Trackunit's `AssetStates.attention`.
 * `criticality` is the rollup enum that drives the red/amber badge.
 * Counts come straight from Trackunit's open event tally.
 */
export interface AssetAttention {
  criticality: CriticalityState; // NONE | LOW | CRITICAL
  criticalEventCount: number;
  lowEventCount: number;
  lastEventTime: string | null;
}

/** A Trackunit-side site reference attached to an asset. */
export interface AssetSiteRef {
  /** Trackunit's site id (sans `___Site___` prefix). */
  id: string;
  name: string;
}

/**
 * A single Trackunit event attached to an asset. Sourced from
 * `Asset.events.active.edges[].node`. Only ever populated by the
 * GraphQL ASSET_QUERY path (per-machine refresh); REST/AEMP fallback
 * leaves `Asset.events` as an empty array.
 */
export interface AssetEvent {
  /** Trackunit's event id. Bare UUID on most accounts. */
  id: string;
  /**
   * Enum value from Trackunit's `LegacyAssetEventType` (e.g. `DAMAGE_REPORT`,
   * `SERVICE`, `ENGINE_FAULT`). Render via `prettifyEventType()` for display.
   */
  type: string;
  /** Same enum as `Asset.status.criticality` — drives the row colour. */
  severity: CriticalityState;
  /** When the event first triggered. */
  openedAt: string | null;
  /** When the event was resolved/cleared. Null while still active. */
  closedAt: string | null;
  /** Boolean flag from Trackunit — true while open, false when resolved. */
  active: boolean;
  /** Aggregated occurrence count from Trackunit. Show as "×N" when > 1. */
  count: number;
  /** Generic description. Often null on non-fault events — fall back to type. */
  description: string | null;
  /** OEM-enriched description. Use as a second-choice fallback before type. */
  descriptionPoweredByOem: string | null;
}

export interface Asset {
  assetId: string;
  name: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  assetType: string;
  lastSeen: string | null;
  activity: ActivityState | null;
  imageUrl: string | null;
  location: AssetLocation | null;
  insights: AssetInsights;
  /** Kept for back-compat with older snapshots; use `attention` going forward. */
  topAlert: {
    type: string;
    criticality: CriticalityState;
  } | null;
  /** Asset.status.attention — drives the AlertsBadge. Null on legacy snapshots. */
  attention: AssetAttention | null;
  /** Asset.sites[0] — the asset's current Trackunit site. Null when unassigned. */
  trackunitSite: AssetSiteRef | null;
  /**
   * Active events from `Asset.events.active`. Populated by the per-machine
   * GraphQL refresh path only. `[]` for legacy snapshots and the REST fallback.
   */
  events: AssetEvent[];
}

// ─── DB-backed machine (IntelliCheck app) ───────────────────────────────────

export type MachineSource = 'manual' | 'trackunit';
export type MachineStatus = 'active' | 'disconnected' | 'orphaned';
export type TelematicsProvider = 'trackunit';
export type AccountRole = 'account_admin' | 'admin_user' | 'operator';

export interface Machine {
  id: string;
  accountId: string;
  source: MachineSource;
  sourceExternalId: string | null;
  sourceConnectionId: string | null;
  status: MachineStatus;
  name: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  /** Free-form site label (legacy/manual). Use `siteId` for the structured site assignment. */
  site: string | null;
  fleetId: string | null;
  siteId: string | null;
  imagePath: string | null;
  lastSnapshot: Asset | null;
  lastSyncedAt: string | null;
  createdAt: string;
  createdBy: string | null;
}

export interface Fleet {
  id: string;
  accountId: string;
  name: string;
  slug: string;
  color: string | null;
  createdAt: string;
}

export type SiteSource = 'manual' | 'trackunit';

export interface Site {
  id: string;
  accountId: string;
  fleetId: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  /** 'manual' for user-created sites, 'trackunit' for auto-imported ones. */
  source: SiteSource;
  /** Trackunit's site id; null for manual sites. Used for cron upsert idempotency. */
  sourceExternalId: string | null;
}

export interface TelematicsConnection {
  id: string;
  accountId: string;
  provider: TelematicsProvider;
  label: string | null;
  status: 'active' | 'revoked' | 'error';
  lastVerifiedAt: string | null;
  createdAt: string;
}
