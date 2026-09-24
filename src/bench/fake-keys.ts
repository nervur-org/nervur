// SPDX-License-Identifier: Apache-2.0
// Keys from a name: every ward of a test named, and the same each run.
import { SeedKeys, type Crypto } from '../index.ts';
import { seedOf } from './seeded.ts';

export class FakeKeys extends SeedKeys {
  constructor(name = 'fake', crypto?: Crypto) {
    super(seedOf(name), crypto);
  }
}
