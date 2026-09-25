// SPDX-License-Identifier: Apache-2.0
// An unlock in the process: the ground's key drawn from the bench's seed, so
// a ground opened again on the same machine opens the same drawer.
import type { Unlock } from '../index.ts';
import { seedOf } from './seeded.ts';

export class FakeUnlock implements Unlock {
  readonly #key: string;

  constructor(seed = 'unlock') {
    this.#key = seedOf(`${seed}:key`);
  }

  key(): Promise<string> {
    return Promise.resolve(this.#key);
  }
}
