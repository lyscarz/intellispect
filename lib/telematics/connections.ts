import { createSupabaseServerClient } from '../supabase/server';
import { createSupabaseAdminClient } from '../supabase/admin';
import { decryptJson, encryptJson } from '../crypto';
import type { TelematicsConnection } from '../types';
import type { TrackunitCreds } from '../trackunit-auth';

interface ConnectionRow {
  id: string;
  account_id: string;
  provider: TelematicsConnection['provider'];
  label: string | null;
  credentials_encrypted: string; // Supabase returns bytea as a "\\x..." hex string by default
  credentials_nonce: string;
  status: TelematicsConnection['status'];
  last_verified_at: string | null;
  created_at: string;
}

function rowToConnection(r: ConnectionRow): TelematicsConnection {
  return {
    id: r.id,
    accountId: r.account_id,
    provider: r.provider,
    label: r.label,
    status: r.status,
    lastVerifiedAt: r.last_verified_at,
    createdAt: r.created_at,
  };
}

function bufferToPgBytea(buf: Buffer): string {
  // Postgres bytea hex format. supabase-js will pass this through as a string.
  return '\\x' + buf.toString('hex');
}

function pgByteaToBuffer(value: string): Buffer {
  // PostgREST returns bytea as "\x..." (hex) by default; tolerate base64 too.
  if (value.startsWith('\\x')) return Buffer.from(value.slice(2), 'hex');
  return Buffer.from(value, 'base64');
}

export async function getActiveConnection(
  accountId: string,
  provider: TelematicsConnection['provider']
): Promise<TelematicsConnection | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('telematics_connections')
    .select('id, account_id, provider, label, status, last_verified_at, created_at')
    .eq('account_id', accountId)
    .eq('provider', provider)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw new Error(`Failed to load connection: ${error.message}`);
  return data ? rowToConnection(data as ConnectionRow) : null;
}

export async function loadDecryptedCreds(
  accountId: string,
  provider: TelematicsConnection['provider']
): Promise<{ connection: TelematicsConnection; creds: TrackunitCreds } | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('telematics_connections')
    .select('*')
    .eq('account_id', accountId)
    .eq('provider', provider)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw new Error(`Failed to load connection: ${error.message}`);
  if (!data) return null;

  const row = data as ConnectionRow;
  const ciphertext = pgByteaToBuffer(row.credentials_encrypted);
  const nonce = pgByteaToBuffer(row.credentials_nonce);
  let creds: TrackunitCreds;
  try {
    creds = await decryptJson<TrackunitCreds>(ciphertext, nonce);
  } catch {
    throw new Error(
      'Stored Trackunit credentials are unreadable. Disconnect this account in /settings/connections and reconnect.'
    );
  }
  return { connection: rowToConnection(row), creds };
}

/**
 * Upsert the active Trackunit connection for an account. Revokes any existing
 * active row (the unique index only permits one active per provider).
 */
export async function saveTrackunitConnection(
  accountId: string,
  userId: string,
  creds: TrackunitCreds,
  label?: string | null
): Promise<TelematicsConnection> {
  const supabase = createSupabaseServerClient();

  // Revoke any existing active connection for this provider.
  const { error: revokeErr } = await supabase
    .from('telematics_connections')
    .update({ status: 'revoked' })
    .eq('account_id', accountId)
    .eq('provider', 'trackunit')
    .eq('status', 'active');
  if (revokeErr) throw new Error(`Failed to revoke previous connection: ${revokeErr.message}`);

  const { ciphertext, nonce } = await encryptJson(creds);

  const { data, error } = await supabase
    .from('telematics_connections')
    .insert({
      account_id: accountId,
      provider: 'trackunit',
      label: label ?? null,
      credentials_encrypted: bufferToPgBytea(ciphertext),
      credentials_nonce: bufferToPgBytea(nonce),
      status: 'active',
      last_verified_at: new Date().toISOString(),
      created_by: userId,
    })
    .select('id, account_id, provider, label, status, last_verified_at, created_at')
    .single();
  if (error || !data) throw new Error(`Failed to save connection: ${error?.message}`);
  return rowToConnection(data as ConnectionRow);
}

/**
 * Service-role variant for background work (cron). Bypasses RLS — caller is
 * responsible for being sure the user/system is allowed to touch this account.
 */
export async function loadDecryptedCredsAsAdmin(
  accountId: string,
  provider: TelematicsConnection['provider']
): Promise<{ connection: TelematicsConnection; creds: TrackunitCreds } | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('telematics_connections')
    .select('*')
    .eq('account_id', accountId)
    .eq('provider', provider)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw new Error(`Failed to load connection: ${error.message}`);
  if (!data) return null;

  const row = data as ConnectionRow;
  const ciphertext = pgByteaToBuffer(row.credentials_encrypted);
  const nonce = pgByteaToBuffer(row.credentials_nonce);
  let creds: TrackunitCreds;
  try {
    creds = await decryptJson<TrackunitCreds>(ciphertext, nonce);
  } catch {
    throw new Error('Stored Trackunit credentials are unreadable.');
  }
  return { connection: rowToConnection(row), creds };
}

/** Service-role: list every account that has an active Trackunit connection. */
export async function listAccountsWithActiveTrackunit(): Promise<string[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('telematics_connections')
    .select('account_id')
    .eq('provider', 'trackunit')
    .eq('status', 'active');
  if (error) throw new Error(`Failed to list accounts: ${error.message}`);
  return Array.from(new Set((data ?? []).map((r) => r.account_id as string)));
}

/**
 * Read-only summary of an active connection: status + whether V2 GraphQL
 * is configured. Use from server components / pages to show UI state without
 * exposing the actual creds.
 */
export async function getConnectionInfo(
  accountId: string,
  provider: TelematicsConnection['provider']
): Promise<{ connection: TelematicsConnection; hasGql: boolean; gqlScope: string | null } | null> {
  const loaded = await loadDecryptedCreds(accountId, provider);
  if (!loaded) return null;
  return {
    connection: loaded.connection,
    hasGql: !!(loaded.creds.gqlClientId && loaded.creds.gqlClientSecret),
    gqlScope: loaded.creds.gqlScope ?? null,
  };
}

/**
 * Update the V2 (GraphQL) fields of an existing Trackunit connection without
 * touching the V1 (password grant) fields. Verifies the combined credentials
 * before saving — if the V2 fields are non-empty, Trackunit must accept them.
 */
export async function updateGqlCreds(
  accountId: string,
  partial: { gqlClientId: string; gqlClientSecret: string; gqlScope: string | null }
): Promise<void> {
  const supabase = createSupabaseServerClient();
  const loaded = await loadDecryptedCreds(accountId, 'trackunit');
  if (!loaded) throw new Error('No active Trackunit connection to update');

  const merged: TrackunitCreds = {
    ...loaded.creds,
    gqlClientId: partial.gqlClientId,
    gqlClientSecret: partial.gqlClientSecret,
    gqlScope: partial.gqlScope ?? null,
  };

  // Lazy import to avoid cycles.
  const { verifyTrackunitCreds } = await import('../trackunit-api');
  const result = await verifyTrackunitCreds(merged);
  if (!result.gql) {
    throw new Error(
      'Trackunit rejected the GraphQL credentials. Double-check client_id, client_secret, and that the API Key has the right scope (e.g. `asset.view`).'
    );
  }

  const { ciphertext, nonce } = await encryptJson(merged);
  const { error } = await supabase
    .from('telematics_connections')
    .update({
      credentials_encrypted: bufferToPgBytea(ciphertext),
      credentials_nonce: bufferToPgBytea(nonce),
      last_verified_at: new Date().toISOString(),
    })
    .eq('id', loaded.connection.id)
    .eq('account_id', accountId);
  if (error) throw new Error(`Failed to save GraphQL credentials: ${error.message}`);
}

/** Clear the V2 fields from an existing Trackunit connection. */
export async function removeGqlCreds(accountId: string): Promise<void> {
  const supabase = createSupabaseServerClient();
  const loaded = await loadDecryptedCreds(accountId, 'trackunit');
  if (!loaded) throw new Error('No active Trackunit connection');

  const merged: TrackunitCreds = {
    ...loaded.creds,
    gqlClientId: null,
    gqlClientSecret: null,
    gqlScope: null,
  };

  const { ciphertext, nonce } = await encryptJson(merged);
  const { error } = await supabase
    .from('telematics_connections')
    .update({
      credentials_encrypted: bufferToPgBytea(ciphertext),
      credentials_nonce: bufferToPgBytea(nonce),
    })
    .eq('id', loaded.connection.id)
    .eq('account_id', accountId);
  if (error) throw new Error(`Failed to remove GraphQL credentials: ${error.message}`);
}

export async function disconnectTrackunit(accountId: string): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from('telematics_connections')
    .update({ status: 'revoked' })
    .eq('account_id', accountId)
    .eq('provider', 'trackunit')
    .eq('status', 'active');
  if (error) throw new Error(`Failed to disconnect: ${error.message}`);
}
