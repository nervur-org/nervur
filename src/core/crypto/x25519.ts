// SPDX-License-Identifier: Apache-2.0
// X25519 agrees, by `@noble/curves` in every engine, since an engine's Web
// Crypto may refuse a secret the curve takes. A secret is thirty-two bytes,
// clamped by the function and never before.
import { x25519 } from '@noble/curves/ed25519.js';
import { zero } from './bytes.ts';

export const x25519Public = async (secret: Uint8Array): Promise<Uint8Array> => {
  if (secret.length !== 32) throw new TypeError('a secret is thirty-two bytes');
  return x25519.getPublicKey(secret);
};

// The agreement, or null for a public key that takes no seal: one whose
// agreement is thirty-two zero bytes.
export const agree = async (secret: Uint8Array, pk: Uint8Array): Promise<Uint8Array | null> => {
  if (pk.length !== 32 || secret.length !== 32) return null;
  try {
    const shared = x25519.getSharedSecret(secret, pk);
    return zero(shared) ? null : shared;
  } catch {
    return null;
  }
};
