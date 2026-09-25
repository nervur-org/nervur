// SPDX-License-Identifier: Apache-2.0
// A NodeGround's unlock: its one key, in a file its owner alone reads, or
// in the macOS keychain. A missing key is drawn fresh on first use. A file
// others may read is refused, as ssh refuses a key, and the keychain is
// handed the key on its input, never on a command line another process
// could read.
import { execFile, spawn } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NobleCrypto } from '../bodies/noble-crypto.ts';
import type { Crypto } from '../foundation.ts';
import type { Unlock } from '../ground/ground.ts';

const KEY = /^[0-9a-f]{64}$/;
const NAME = /^[A-Za-z0-9._-]{1,128}$/;
const NOT_FOUND = 44;

const fresh = (crypto: Crypto): string => Array.from(crypto.random(32), (byte) => byte.toString(16).padStart(2, '0')).join('');

const checked = (key: string, where: string): string => {
  if (!KEY.test(key)) throw new Error(`${where} holds no key of sixty-four lowercase hex digits`);
  return key;
};

/** The key in a file its owner alone reads, drawn where the file is missing. */
export class FileUnlock implements Unlock {
  readonly #path: string;
  readonly #crypto: Crypto;

  constructor(path: string | URL, crypto: Crypto = new NobleCrypto()) {
    this.#path = typeof path === 'string' ? path : fileURLToPath(path);
    this.#crypto = crypto;
  }

  async key(): Promise<string> {
    await mkdir(dirname(this.#path), { recursive: true, mode: 0o700 });
    try {
      // Where none is there yet: the one there wins.
      await writeFile(this.#path, `${fresh(this.#crypto)}\n`, { mode: 0o600, flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    if (process.platform !== 'win32' && ((await stat(this.#path)).mode & 0o077) !== 0) {
      throw new Error(`the key file ${this.#path} is readable by others than its owner`);
    }
    return checked((await readFile(this.#path, 'utf8')).trimEnd(), `the key file ${this.#path}`);
  }
}

const find = (service: string, account: string) =>
  new Promise<string | null>((resolve, reject) => {
    execFile('security', ['find-generic-password', '-s', service, '-a', account, '-w'], (error, stdout) => {
      if (error === null) resolve(stdout.trimEnd());
      else if (error.code === NOT_FOUND) resolve(null);
      else reject(error);
    });
  });

const add = (service: string, account: string, key: string) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn('security', ['-i'], { stdio: ['pipe', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.on('data', (chunk) => (err += chunk));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`security could not keep the key: ${err.trim()}`))));
    child.stdin.end(`add-generic-password -s ${service} -a ${account} -w ${key}\n`);
  });

/** The key in the macOS keychain, as a generic password under a service and an account, drawn where none is kept. */
export class KeychainUnlock implements Unlock {
  readonly #service: string;
  readonly #account: string;
  readonly #crypto: Crypto;

  constructor({ service = 'nervur', account }: { service?: string; account: string }, crypto: Crypto = new NobleCrypto()) {
    if (process.platform !== 'darwin') throw new Error('the keychain is macOS’s');
    if (!NAME.test(service) || !NAME.test(account)) throw new TypeError('a service and an account are letters, digits, dots, dashes and underscores');
    this.#service = service;
    this.#account = account;
    this.#crypto = crypto;
  }

  async key(): Promise<string> {
    const where = `the keychain's ${this.#service}/${this.#account}`;
    const found = await find(this.#service, this.#account);
    if (found !== null) return checked(found, where);
    // Where two drew one at once, the keychain keeps the first, and both read it.
    await add(this.#service, this.#account, fresh(this.#crypto)).catch(() => undefined);
    return checked((await find(this.#service, this.#account)) ?? '', where);
  }
}
