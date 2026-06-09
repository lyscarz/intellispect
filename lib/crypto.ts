/**
 * Application-level encryption for telematics credentials.
 *
 * Uses libsodium's crypto_secretbox_easy with a 32-byte key from
 * process.env.TELEMATICS_ENC_KEY (base64). Each encryption uses a fresh
 * 24-byte nonce. Postgres stores nonce + ciphertext as opaque bytea.
 */

import sodium from 'libsodium-wrappers';

let ready: Promise<void> | null = null;
function ensureReady(): Promise<void> {
  if (!ready) ready = sodium.ready;
  return ready;
}

function getKey(): Uint8Array {
  const raw = process.env.TELEMATICS_ENC_KEY;
  if (!raw) throw new Error('TELEMATICS_ENC_KEY is not set in env');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error(
      `TELEMATICS_ENC_KEY must decode to 32 bytes (got ${key.length}). Generate with: openssl rand -base64 32`
    );
  }
  return new Uint8Array(key);
}

export async function encryptJson(payload: unknown): Promise<{ ciphertext: Buffer; nonce: Buffer }> {
  await ensureReady();
  const key = getKey();
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const message = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = sodium.crypto_secretbox_easy(message, nonce, key);
  return { ciphertext: Buffer.from(ciphertext), nonce: Buffer.from(nonce) };
}

export async function decryptJson<T = unknown>(ciphertext: Buffer, nonce: Buffer): Promise<T> {
  await ensureReady();
  const key = getKey();
  const plain = sodium.crypto_secretbox_open_easy(
    new Uint8Array(ciphertext),
    new Uint8Array(nonce),
    key
  );
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}
