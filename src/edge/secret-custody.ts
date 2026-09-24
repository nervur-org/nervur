// SPDX-License-Identifier: Apache-2.0
// An edge's custody: one seed for each house, sealed with AES-GCM in
// Durable Object storage under a key drawn from the Worker's one secret.
// Storage alone opens no seed, and the secret alone holds none.
import { KeptCustody, type Secrets } from '../bodies/kept.ts';
import type { DurableStorage } from './durable.ts';

const SECRET = /^[0-9a-f]{64}$/;
const IV = 12;

const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
const bytes = (text: string) => new Uint8Array(text.match(/../g)?.map((pair) => parseInt(pair, 16)) ?? []);

// Secrets sealed in storage, each under its name, so one never opens as another.
const sealed = (storage: DurableStorage, secret: string): Secrets => {
  let key: Promise<CryptoKey> | undefined;
  const keyed = () =>
    (key ??= (async () => {
      const drawn = await crypto.subtle.importKey('raw', bytes(secret), 'HKDF', false, ['deriveKey']);
      return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: new TextEncoder().encode('nervur-custody') }, drawn, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    })());
  return {
    get: async (name) => {
      const held = await storage.get(name);
      if (typeof held !== 'string') return null;
      const whole = bytes(held);
      const opened = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: whole.subarray(0, IV), additionalData: new TextEncoder().encode(name) }, await keyed(), whole.subarray(IV));
      return new TextDecoder().decode(opened);
    },
    set: async (name, value) => {
      const iv = crypto.getRandomValues(new Uint8Array(IV));
      const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(name) }, await keyed(), new TextEncoder().encode(value)));
      await storage.put({ [name]: hex(iv) + hex(data) });
    },
  };
};

export class SecretCustody extends KeptCustody {
  /** `secret` is the Worker's, sixty-four lowercase hex digits, set as a secret and never in its code. */
  constructor(storage: DurableStorage, secret: string | undefined) {
    if (typeof secret !== 'string' || !SECRET.test(secret)) throw new TypeError('the edge’s secret is sixty-four lowercase hex digits');
    super(sealed(storage, secret));
  }
}
