// SPDX-License-Identifier: Apache-2.0
// The crypto an edge passes: Ed25519 and X25519 from the engine's own Web
// Crypto, about ten times faster than JavaScript, and ML-KEM-768 with
// everything else as the default body has it. An edge bills each
// millisecond of CPU, so there the speed pays. A signature is still
// checked as Quo checks it: a key that is not canonical or has small
// order is refused before the engine reads it, and so is an S at or above
// the group's order. The engine's check is cofactorless, and reads R as
// written.
import { NobleCrypto } from '../bodies/noble-crypto.ts';

const subtle = globalThis.crypto.subtle;
const view = (bytes: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(bytes);
const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
const unhex = (text: string) => Uint8Array.from(text.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16));

// A private key as PKCS #8 carries it: a fixed prefix for each curve, then the thirty-two bytes.
const ED25519 = unhex('302e020100300506032b657004220420');
const X25519 = unhex('302e020100300506032b656e04220420');
const pkcs8 = (prefix: Uint8Array, secret: Uint8Array) => {
  const out = new Uint8Array(prefix.length + secret.length);
  out.set(prefix);
  out.set(secret, prefix.length);
  return out;
};

// The eight points of small order, each as its one canonical encoding.
const SMALL = new Set([
  '0100000000000000000000000000000000000000000000000000000000000000',
  'ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f',
  '0000000000000000000000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000000000000000000080',
  'c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac037a',
  'c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac03fa',
  '26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc05',
  '26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc85',
]);

// The group's order L, little-endian, as S is written.
const ORDER = unhex('edd3f55c1a631258d69cf7a2def9de1400000000000000000000000000000010');

// Whether a little-endian number of thirty-two bytes stands below `bound`.
const below = (value: Uint8Array, bound: Uint8Array): boolean => {
  for (let at = 31; at >= 0; at--) {
    if (value[at] !== bound[at]) return value[at] < bound[at];
  }
  return false;
};

// Whether y, the key's low 255 bits, stands below the prime 2^255 - 19.
const canonical = (key: Uint8Array): boolean => {
  if ((key[31] & 0x7f) !== 0x7f) return true;
  for (let at = 30; at >= 1; at--) if (key[at] !== 0xff) return true;
  return key[0] < 0xed;
};

const publicOf = async (algorithm: string, prefix: Uint8Array, secret: Uint8Array, usages: string[]): Promise<Uint8Array> => {
  const key = await subtle.importKey('pkcs8', view(pkcs8(prefix, secret)), { name: algorithm }, true, usages as KeyUsage[]);
  const { x } = (await subtle.exportKey('jwk', key)) as { x: string };
  const text = atob(x.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(text, (char) => char.charCodeAt(0));
};

export class NativeCrypto extends NobleCrypto {
  override async signingPublic(secret: Uint8Array): Promise<Uint8Array> {
    return publicOf('Ed25519', ED25519, secret, ['sign']);
  }

  override async sign(secret: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
    const key = await subtle.importKey('pkcs8', view(pkcs8(ED25519, secret)), { name: 'Ed25519' }, false, ['sign']);
    return new Uint8Array(await subtle.sign({ name: 'Ed25519' }, key, view(message)));
  }

  override async verify(pk: Uint8Array, message: Uint8Array, signature: Uint8Array): Promise<boolean> {
    if (pk.length !== 32 || signature.length !== 64) return false;
    if (!canonical(pk) || SMALL.has(hex(pk)) || !below(signature.subarray(32), ORDER)) return false;
    try {
      const key = await subtle.importKey('raw', view(pk), { name: 'Ed25519' }, false, ['verify']);
      return await subtle.verify({ name: 'Ed25519' }, key, view(signature), view(message));
    } catch {
      return false;
    }
  }

  override async agreePublic(secret: Uint8Array): Promise<Uint8Array> {
    return publicOf('X25519', X25519, secret, ['deriveBits']);
  }

  override async agree(secret: Uint8Array, pk: Uint8Array): Promise<Uint8Array | null> {
    if (pk.length !== 32) return null;
    try {
      const mine = await subtle.importKey('pkcs8', view(pkcs8(X25519, secret)), { name: 'X25519' }, false, ['deriveBits']);
      const theirs = await subtle.importKey('raw', view(pk), { name: 'X25519' }, false, []);
      const shared = new Uint8Array(await subtle.deriveBits({ name: 'X25519', public: theirs }, mine, 256));
      return shared.every((byte) => byte === 0) ? null : shared;
    } catch {
      // The engine refuses an agreement that comes to all zero.
      return null;
    }
  }
}
