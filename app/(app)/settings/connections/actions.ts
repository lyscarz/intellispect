'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSessionContext } from '@/lib/getSessionContext';
import { verifyTrackunitCreds } from '@/lib/trackunit-api';
import {
  disconnectTrackunit,
  removeGqlCreds,
  saveTrackunitConnection,
  updateGqlCreds,
} from '@/lib/telematics/connections';
import type { TrackunitCreds } from '@/lib/trackunit-auth';

function readCreds(formData: FormData): TrackunitCreds {
  const required = (k: string) => {
    const v = ((formData.get(k) as string | null) ?? '').trim();
    if (!v) throw new Error(`Missing ${k.replace('_', ' ')}`);
    return v;
  };
  const opt = (k: string) => {
    const v = ((formData.get(k) as string | null) ?? '').trim();
    return v || null;
  };
  return {
    tokenUrl: opt('token_url') ?? 'https://auth.trackunit.com/token',
    clientId: required('client_id'),
    clientSecret: required('client_secret'),
    username: required('username'),
    password: required('password'),
    gqlClientId: opt('gql_client_id'),
    gqlClientSecret: opt('gql_client_secret'),
    gqlScope: opt('gql_scope'),
  };
}

export type ConnectionFormState = {
  status: 'idle' | 'ok' | 'error';
  message?: string;
  gqlEnabled?: boolean;
};

export async function testTrackunitAction(
  _prev: ConnectionFormState,
  formData: FormData
): Promise<ConnectionFormState> {
  try {
    const creds = readCreds(formData);
    const result = await verifyTrackunitCreds(creds);
    return {
      status: 'ok',
      message: result.gql
        ? 'Connected. REST + GraphQL (images) both authenticated.'
        : 'Connected (REST only). Add GraphQL credentials for machine images.',
      gqlEnabled: result.gql,
    };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Connection failed' };
  }
}

export async function saveTrackunitAction(formData: FormData) {
  const ctx = await getSessionContext();
  let creds: TrackunitCreds;
  try {
    creds = readCreds(formData);
    await verifyTrackunitCreds(creds);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Connection failed';
    redirect('/settings/connections?error=' + encodeURIComponent(msg));
  }
  const label = ((formData.get('label') as string | null) ?? '').trim() || null;
  try {
    await saveTrackunitConnection(ctx.accountId, ctx.userId, creds, label);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to save connection';
    redirect('/settings/connections?error=' + encodeURIComponent(msg));
  }
  revalidatePath('/settings/connections');
  revalidatePath('/fleet');
  redirect('/settings/connections?saved=1');
}

export async function updateGqlAction(formData: FormData) {
  const ctx = await getSessionContext();
  const gqlClientId = ((formData.get('gql_client_id') as string | null) ?? '').trim();
  const gqlClientSecret = ((formData.get('gql_client_secret') as string | null) ?? '').trim();
  // Scope is hardcoded — `asset.view` is what we need for location + images.
  const gqlScope = 'asset.view';

  if (!gqlClientId || !gqlClientSecret) {
    redirect('/settings/connections?error=' + encodeURIComponent('GQL client ID and secret are required'));
  }

  try {
    await updateGqlCreds(ctx.accountId, { gqlClientId, gqlClientSecret, gqlScope });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to save GraphQL credentials';
    redirect('/settings/connections?error=' + encodeURIComponent(msg));
  }
  revalidatePath('/settings/connections');
  redirect('/settings/connections?gqlSaved=1');
}

export async function removeGqlAction(_formData?: FormData) {
  const ctx = await getSessionContext();
  try {
    await removeGqlCreds(ctx.accountId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to remove GraphQL credentials';
    redirect('/settings/connections?error=' + encodeURIComponent(msg));
  }
  revalidatePath('/settings/connections');
  redirect('/settings/connections?gqlRemoved=1');
}

export async function disconnectTrackunitAction() {
  const ctx = await getSessionContext();
  try {
    await disconnectTrackunit(ctx.accountId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to disconnect';
    redirect('/settings/connections?error=' + encodeURIComponent(msg));
  }
  revalidatePath('/settings/connections');
  revalidatePath('/fleet');
  redirect('/settings/connections?disconnected=1');
}
