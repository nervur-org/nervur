// SPDX-License-Identifier: Apache-2.0
// Custody in the process: each house's seed drawn from the bench's seed and
// the house's name, so a ground opened again on it opens the same wards. A
// house moved in keeps the seed it brought.
import { SeedKeys, type Custody, type Keys } from '../index.ts';
import { FakeKeys } from './fake-keys.ts';
import { seedOf } from './seeded.ts';

const NAME = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const SEED = /^[0-9a-f]{64}$/;

const named = (house: string) => {
  if (!NAME.test(house)) throw new TypeError(`no house is named ${house}`);
  return house;
};

export class FakeCustody implements Custody {
  readonly #seed: string;
  // Each house's seed once it has one: drawn from the bench's seed on first use, or kept as a move brought it.
  readonly #held = new Map<string, string>();

  constructor(seed = 'custody') {
    this.#seed = seed;
  }

  keys({ house }: { house: string }): Keys {
    const seed = this.seed({ house });
    return seed === seedOf(`${this.#seed}:${house}`) ? new FakeKeys(`${this.#seed}:${house}`) : new SeedKeys(seed);
  }

  seed({ house }: { house: string }): string {
    const held = this.#held.get(named(house)) ?? seedOf(`${this.#seed}:${house}`);
    this.#held.set(house, held);
    return held;
  }

  keep({ house, seed }: { house: string; seed: string }): void {
    if (!SEED.test(seed)) throw new TypeError('a seed is sixty-four lowercase hex digits');
    const held = this.#held.get(named(house));
    if (held !== undefined && held !== seed) throw new Error(`the house ${house} holds another seed`);
    this.#held.set(house, seed);
  }
}
