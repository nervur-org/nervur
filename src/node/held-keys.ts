// SPDX-License-Identifier: Apache-2.0
// Keys over a seed that is fetched once, where it is first needed. A body
// that keeps the seed somewhere, a file or a keychain, says only how to
// fetch it, and everything else is the seed's.
import { NobleCrypto } from '../bodies/noble-crypto.ts';
import { SeedKeys } from '../bodies/seed-keys.ts';
import type { Crypto, Keys, WardKeys } from '../foundation.ts';

export abstract class HeldKeys implements Keys {
  readonly #crypto: Crypto;
  #keys: Promise<SeedKeys> | undefined;

  constructor(crypto: Crypto = new NobleCrypto()) {
    this.#crypto = crypto;
  }

  /** The seed as it is kept, made and kept first where there is none. */
  protected abstract fetch(): Promise<string>;

  #held(): Promise<SeedKeys> {
    this.#keys ??= this.fetch().then((seed) => new SeedKeys(seed, this.#crypto));
    // A fetch that failed is tried again on the next call.
    this.#keys.catch(() => (this.#keys = undefined));
    return this.#keys;
  }

  async ward(): Promise<WardKeys> {
    return (await this.#held()).ward();
  }

  async sign(message: Uint8Array): Promise<Uint8Array> {
    return (await this.#held()).sign(message);
  }

  async agree(pk: Uint8Array): Promise<Uint8Array | null> {
    return (await this.#held()).agree(pk);
  }

  async decapsulate(ciphertext: Uint8Array): Promise<Uint8Array> {
    return (await this.#held()).decapsulate(ciphertext);
  }

  async derive(label: string, length: number): Promise<Uint8Array> {
    return (await this.#held()).derive(label, length);
  }
}

/** Sixty-four lowercase hex digits, fresh. */
export const freshSeed = (crypto: Crypto): string => Array.from(crypto.random(32), (byte) => byte.toString(16).padStart(2, '0')).join('');
