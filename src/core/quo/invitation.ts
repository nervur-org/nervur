// SPDX-License-Identifier: Apache-2.0
// The invitation: `{ ward, heir, secret, lock, at? }`. A door reads no
// route from it; `at`, when present, names where the ward is reached.
import { EK, encapsulate, isHex, unhex } from '../crypto/index.ts';
import { readAt } from './address.ts';

export type Invitation = { readonly ward: string; readonly heir: string; readonly secret: string; readonly lock: string; readonly at?: string[] };

// An invitation, or null for any other shape. A field beside the five is
// ignored, the lock is held to the modulus check, and `at` keeps the
// addresses it holds, an `at` with none or of another shape being absent.
export const readInvitation = (value: unknown): Invitation | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const { ward, heir, secret, lock, at } = value as Record<string, unknown>;
  if (!isHex(ward, 64) || !isHex(heir, 32) || !isHex(secret, 32) || !isHex(lock, EK)) return null;
  if (encapsulate(unhex(lock), new Uint8Array(32)) === null) return null;
  const addresses = readAt(at);
  return { ward, heir, secret, lock, ...(addresses.length > 0 ? { at: addresses } : {}) };
};
