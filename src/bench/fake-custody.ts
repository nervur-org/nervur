// SPDX-License-Identifier: Apache-2.0
// Custody in the process: each house's seed drawn from the bench's seed and
// the house's name, so a ground opened again on it opens the same wards.
import type { Custody } from '../ground/ground.ts';
import type { Keys } from '../foundation.ts';
import { FakeKeys } from './fake-keys.ts';

export class FakeCustody implements Custody {
  readonly #seed: string;

  constructor(seed = 'custody') {
    this.#seed = seed;
  }

  keys({ house }: { house: string }): Keys {
    return new FakeKeys(`${this.#seed}:${house}`);
  }
}
