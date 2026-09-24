// SPDX-License-Identifier: Apache-2.0
// Keys over a seed kept in a file its owner alone reads. A missing file is
// made with a fresh seed on first use; a file others may read is refused,
// as ssh refuses a key.
import { readFile, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { NobleCrypto } from '../bodies/noble-crypto.ts';
import type { Crypto } from '../foundation.ts';
import { freshSeed, HeldKeys } from './held-keys.ts';

// A seed written to a file its owner alone reads, where none is there yet: the one there wins.
const place = async (path: string, seed: string): Promise<void> => {
  try {
    await writeFile(path, `${seed}\n`, { mode: 0o600, flag: 'wx' });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
};

/** The seed a file holds, drawn fresh where there is none; a file others may read is refused. */
export const seedInFile = async (path: string, crypto: Crypto): Promise<string> => {
  await place(path, freshSeed(crypto));
  if (process.platform !== 'win32' && ((await stat(path)).mode & 0o077) !== 0) {
    throw new Error(`the seed file ${path} is readable by others than its owner`);
  }
  return (await readFile(path, 'utf8')).trimEnd();
};

/** A seed kept in a file, where the file holds none or the same one. */
export const keepInFile = async (path: string, seed: string): Promise<void> => {
  await place(path, seed);
  if ((await readFile(path, 'utf8')).trimEnd() !== seed) throw new Error(`the seed file ${path} holds another seed`);
};

export class FileKeys extends HeldKeys {
  readonly #path: string;
  readonly #crypto: Crypto;

  constructor(path: string | URL, crypto: Crypto = new NobleCrypto()) {
    super(crypto);
    this.#path = typeof path === 'string' ? path : fileURLToPath(path);
    this.#crypto = crypto;
  }

  protected fetch(): Promise<string> {
    return seedInFile(this.#path, this.#crypto);
  }
}
