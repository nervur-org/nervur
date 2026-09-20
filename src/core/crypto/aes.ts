// SPDX-License-Identifier: Apache-2.0
// AES-256-GCM with a sixteen-byte tag at the end of the ciphertext.
import { own, subtle } from './subtle.ts';

export const TAG = 16;

const cipher = (key: Uint8Array, nonce: Uint8Array, additional: Uint8Array) => ({
  params: { name: 'AES-GCM', iv: own(nonce), additionalData: own(additional), tagLength: TAG * 8 },
  key: subtle().importKey('raw', own(key), 'AES-GCM', false, ['encrypt', 'decrypt']),
});

export const encrypt = async (key: Uint8Array, nonce: Uint8Array, additional: Uint8Array, plaintext: Uint8Array): Promise<Uint8Array> => {
  const c = cipher(key, nonce, additional);
  return new Uint8Array(await subtle().encrypt(c.params, await c.key, own(plaintext)));
};

// The plaintext, or null when the ciphertext does not open.
export const decrypt = async (key: Uint8Array, nonce: Uint8Array, additional: Uint8Array, ciphertext: Uint8Array): Promise<Uint8Array | null> => {
  if (ciphertext.length < TAG) return null;
  const c = cipher(key, nonce, additional);
  try {
    return new Uint8Array(await subtle().decrypt(c.params, await c.key, own(ciphertext)));
  } catch {
    return null;
  }
};
