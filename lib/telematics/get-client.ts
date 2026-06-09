import {
  createTrackunitTokenProvider,
  type TrackunitTokenProvider,
} from '../trackunit-auth';
import { loadDecryptedCreds } from './connections';

export interface TrackunitClient {
  connectionId: string;
  provider: TrackunitTokenProvider;
}

/**
 * Returns a token provider for the account's active Trackunit connection, or
 * null if the account hasn't connected yet. Decrypts creds on the server only.
 */
export async function getActiveTrackunitClient(accountId: string): Promise<TrackunitClient | null> {
  const loaded = await loadDecryptedCreds(accountId, 'trackunit');
  if (!loaded) return null;
  return {
    connectionId: loaded.connection.id,
    provider: createTrackunitTokenProvider(loaded.creds),
  };
}
