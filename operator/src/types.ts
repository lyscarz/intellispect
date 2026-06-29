// ---- Fleet / telematics (mirrors the desktop app's Asset shape) ----
export type ActivityState = 'WORKING' | 'IDLING' | 'STOPPED' | 'UNKNOWN';

export interface AssetLocation {
  coordinates: [number, number] | null; // [longitude, latitude]
  address: { street: string | null; city: string | null; country: string | null } | null;
  updatedAt: string | null;
}

export interface AssetInsights {
  fuelLevel: number | null;
  batteryStateOfChargePercent: number | null;
  cumulativeOperatingHours: number | null;
  cumulativeEngineHours: number | null;
}

export interface Asset {
  assetId: string;
  /** Owning Supabase account — used to scope inspection API calls correctly
   *  when the operator belongs to more than one account. */
  accountId: string | null;
  /** Owning account's display name — powers the company filter. */
  accountName: string | null;
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
}

/** Asset enriched with computed distance for the Home tab. */
export interface FleetMachine extends Asset {
  distanceKm: number | null;
}

// ---- Log (sessions) ----
export interface SessionSegments {
  drive: number; // minutes
  idle: number; // minutes
  stopped: number; // minutes
}

export interface OperatorSession {
  id: string;
  machineName: string;
  machineType: string;
  brand: string | null;
  date: string; // ISO
  segments: SessionSegments;
}

// ---- Inbox ----
export type InboxKind =
  | 'license_request'
  | 'health_report'
  | 'permission_grant'
  | 'question'
  | 'message';

export interface InboxMessage {
  id: string;
  kind: InboxKind;
  from: string;
  fromRole: string;
  title: string;
  preview: string;
  body: string;
  time: string; // ISO
  unread: boolean;
  actionable: boolean; // shows Approve/Decline
}

// ---- Profile ----
export interface Certificate {
  id: string;
  name: string;
  issuer: string;
  expires: string | null; // ISO or null = no expiry
  kind: 'license' | 'certificate';
}

export interface ExperienceEntry {
  type: string;
  hours: number;
}
