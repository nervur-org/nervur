// SPDX-License-Identifier: Apache-2.0
// The keys of Quo: the ward key derived from a seed, and every other key
// drawn. A draw is the caller's, so this layer names no source of bytes.
import { agree, ed25519Public, hex, hkdf, lockFrom, sha256, utf8, x25519Public, type Lock } from '../crypto/index.ts';

// Drawn bytes, from whatever the caller's terrain gives.
export type Draw = (length: number) => Uint8Array;

export const LABEL = {
  seal: utf8('quo-seal'),
  edgeSeal: utf8('quo-edge-seal'),
  lock: utf8('quo-lock'),
  edge: utf8('quo-edge'),
  wardSign: utf8('quo-ward-sign'),
  wardSeal: utf8('quo-ward-seal'),
} as const;

// An Ed25519 pair: an heir, or a standing's own key.
export class SigningKey {
  readonly secret: Uint8Array;
  readonly pk: Uint8Array;
  private constructor(secret: Uint8Array, pk: Uint8Array) {
    this.secret = secret;
    this.pk = pk;
  }
  static async from(secret: Uint8Array): Promise<SigningKey> {
    return new SigningKey(secret, await ed25519Public(secret));
  }
  static draw(draw: Draw): Promise<SigningKey> {
    return SigningKey.from(draw(32));
  }
  get id(): string {
    return hex(this.pk);
  }
}

// An X25519 pair used for one box.
export class Ephemeral {
  readonly secret: Uint8Array;
  readonly pk: Uint8Array;
  private constructor(secret: Uint8Array, pk: Uint8Array) {
    this.secret = secret;
    this.pk = pk;
  }
  static async from(secret: Uint8Array): Promise<Ephemeral> {
    return new Ephemeral(secret, await x25519Public(secret));
  }
  static draw(draw: Draw): Promise<Ephemeral> {
    return Ephemeral.from(draw(32));
  }
  agree(pk: Uint8Array): Promise<Uint8Array | null> {
    return agree(this.secret, pk);
  }
}

// The ward key: a signing pair and a padlock, both from the seed.
export class WardKey {
  readonly signing: SigningKey;
  readonly sealSecret: Uint8Array;
  readonly padlock: Uint8Array;
  private constructor(signing: SigningKey, sealSecret: Uint8Array, padlock: Uint8Array) {
    this.signing = signing;
    this.sealSecret = sealSecret;
    this.padlock = padlock;
  }

  // Thirty-two bytes are the seed. Text, and bytes of any other length, are
  // hashed to it first.
  static async from(seed: Uint8Array | string): Promise<WardKey> {
    const bytes = typeof seed === 'string' ? await sha256(utf8(seed)) : seed.length === 32 ? seed : await sha256(seed);
    const sealSecret = await hkdf(bytes, LABEL.wardSeal, 32);
    return new WardKey(await SigningKey.from(await hkdf(bytes, LABEL.wardSign, 32)), sealSecret, await x25519Public(sealSecret));
  }

  get pk(): string {
    return hex(this.signing.pk) + hex(this.padlock);
  }

  open(lid: Uint8Array): Promise<Uint8Array | null> {
    return agree(this.sealSecret, lid);
  }
}

// A ward pk's two halves.
export const wardHalves = (pk: string): { signing: string; padlock: string } => ({ signing: pk.slice(0, 64), padlock: pk.slice(64) });

// A lock from sixty-four drawn bytes.
export const drawLock = (draw: Draw): Lock => {
  const bytes = draw(64);
  return lockFrom(bytes.subarray(0, 32), bytes.subarray(32));
};
