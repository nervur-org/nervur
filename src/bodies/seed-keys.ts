// SPDX-License-Identifier: Apache-2.0
// Keys over a seed held in the process: sixty-four lowercase hex digits and
// nothing else. The ward key, the lock and every derived key come from it.
import type { Crypto, Keys, WardKeys } from '../foundation.ts';
import { NobleCrypto } from './noble-crypto.ts';

const SEED = /^[0-9a-f]{64}$/;

interface Held {
  readonly signing: Uint8Array;
  readonly scalar: Uint8Array;
  readonly decapsulation: Uint8Array;
  readonly ward: WardKeys;
}

export class SeedKeys implements Keys {
  readonly #seed: Uint8Array;
  readonly #crypto: Crypto;
  #held: Promise<Held> | undefined;

  constructor(seed: string | undefined, crypto: Crypto = new NobleCrypto()) {
    if (typeof seed !== 'string' || !SEED.test(seed)) throw new TypeError('a seed is sixty-four lowercase hex digits');
    this.#seed = Uint8Array.from(seed.match(/../g)!, (pair) => Number.parseInt(pair, 16));
    this.#crypto = crypto;
  }

  #keys(): Promise<Held> {
    this.#held ??= (async () => {
      const crypto = this.#crypto;
      const signing = await crypto.hkdf(this.#seed, 'quo-ward-sign', 32);
      const scalar = await crypto.hkdf(this.#seed, 'quo-ward-seal', 32);
      // The lock is the kit's: one per ward, drawn from the seed under a label of Nervur's.
      const lock = await crypto.lockPair(await crypto.hkdf(this.#seed, 'nervur-lock', 64));
      const ward = Object.freeze({ signing: await crypto.signingPublic(signing), padlock: await crypto.agreePublic(scalar), lock: lock.encapsulation });
      return { signing, scalar, decapsulation: lock.decapsulation, ward };
    })();
    return this.#held;
  }

  async ward(): Promise<WardKeys> {
    return (await this.#keys()).ward;
  }

  async sign(message: Uint8Array): Promise<Uint8Array> {
    return this.#crypto.sign((await this.#keys()).signing, message);
  }

  async agree(pk: Uint8Array): Promise<Uint8Array | null> {
    return this.#crypto.agree((await this.#keys()).scalar, pk);
  }

  async decapsulate(ciphertext: Uint8Array): Promise<Uint8Array> {
    return this.#crypto.decapsulate((await this.#keys()).decapsulation, ciphertext);
  }

  async derive(label: string, length: number): Promise<Uint8Array> {
    if (label.startsWith('quo-')) throw new TypeError('a label beginning quo- is Quo\'s');
    return this.#crypto.hkdf(this.#seed, `nervur-derive:${label}`, length);
  }
}
