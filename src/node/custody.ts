// SPDX-License-Identifier: Apache-2.0
// A NodeGround's custody: one seed for each house, by the house's name, in
// a folder of files its owner alone reads, or in the macOS keychain.
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Keys } from '../foundation.ts';
import type { Custody } from '../ground/ground.ts';
import { FileKeys } from './file-keys.ts';
import { KeychainKeys } from './keychain-keys.ts';

const NAME = /^[a-z0-9][a-z0-9._-]{0,63}$/;

const named = (house: string) => {
  if (!NAME.test(house)) throw new TypeError(`no house is named ${house}`);
  return house;
};

/** Each house's seed in `<dir>/<house>.seed`, made on first use, the folder closed to everyone but its owner. */
export class FolderCustody implements Custody {
  readonly #dir: string;

  constructor(dir: string) {
    this.#dir = dir;
  }

  async keys({ house }: { house: string }): Promise<Keys> {
    await mkdir(this.#dir, { recursive: true, mode: 0o700 });
    return new FileKeys(join(this.#dir, `${named(house)}.seed`));
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
}
