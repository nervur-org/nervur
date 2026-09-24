// SPDX-License-Identifier: Apache-2.0
// Keys over a seed kept in a file its owner alone reads. A missing file is
// made with a fresh seed on first use; a file others may read is refused,
// as ssh refuses a key.
import { readFile, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { NobleCrypto } from '../bodies/noble-crypto.ts';
import type { Crypto } from '../foundation.ts';
import { freshSeed, HeldKeys } from './held-keys.ts';

export class FileKeys extends HeldKeys {
  readonly #path: string;
  readonly #crypto: Crypto;

  constructor(path: string | URL, crypto: Crypto = new NobleCrypto()) {
    super(crypto);
    this.#path = typeof path === 'string' ? path : fileURLToPath(path);
    this.#crypto = crypto;
  }

  protected async fetch(): Promise<string> {
    try {
      await writeFile(this.#path, `${freshSeed(this.#crypto)}\n`, { mode: 0o600, flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    if (process.platform !== 'win32' && ((await stat(this.#path)).mode & 0o077) !== 0) {
      throw new Error(`the seed file ${this.#path} is readable by others than its owner`);
    }
    return (await readFile(this.#path, 'utf8')).trimEnd();
  }
}
