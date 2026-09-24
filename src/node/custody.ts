// SPDX-License-Identifier: Apache-2.0
// A NodeGround's custody: one seed for each house, by the house's name, in
// a folder of files its owner alone reads, or in the macOS keychain.
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { NobleCrypto } from '../bodies/noble-crypto.ts';
import type { Keys } from '../foundation.ts';
import type { Custody } from '../ground/ground.ts';
import { FileKeys, keepInFile, seedInFile } from './file-keys.ts';
import { freshSeed } from './held-keys.ts';
import { KeychainKeys, seedInKeychain } from './keychain-keys.ts';

const NAME = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const SEED = /^[0-9a-f]{64}$/;

const named = (house: string) => {
  if (!NAME.test(house)) throw new TypeError(`no house is named ${house}`);
  return house;
};

const seeded = (seed: string) => {
  if (!SEED.test(seed)) throw new TypeError('a seed is sixty-four lowercase hex digits');
  return seed;
};

/** Each house's seed in `<dir>/<house>.seed`, made on first use, the folder closed to everyone but its owner. */
export class FolderCustody implements Custody {
  readonly #dir: string;

  constructor(dir: string) {
    this.#dir = dir;
  }

  async #path(house: string): Promise<string> {
    await mkdir(this.#dir, { recursive: true, mode: 0o700 });
    return join(this.#dir, `${named(house)}.seed`);
  }

  async keys({ house }: { house: string }): Promise<Keys> {
    return new FileKeys(await this.#path(house));
  }

  async seed({ house }: { house: string }): Promise<string> {
    return seedInFile(await this.#path(house), new NobleCrypto());
  }

  async keep({ house, seed }: { house: string; seed: string }): Promise<void> {
    await keepInFile(await this.#path(house), seeded(seed));
  }
}

/** Each house's seed in the macOS keychain, under one service and the house's name as the account. */
export class KeychainCustody implements Custody {
  readonly #service: string;

  constructor({ service = 'nervur' }: { service?: string } = {}) {
    this.#service = service;
  }

  keys({ house }: { house: string }): Keys {
    return new KeychainKeys({ service: this.#service, account: named(house) });
  }

  seed({ house }: { house: string }): Promise<string> {
    return seedInKeychain(this.#service, named(house), freshSeed(new NobleCrypto()));
  }

  async keep({ house, seed }: { house: string; seed: string }): Promise<void> {
    if ((await seedInKeychain(this.#service, named(house), seeded(seed))) !== seed) throw new Error(`the keychain holds another seed for ${house}`);
  }
}
