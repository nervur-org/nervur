// SPDX-License-Identifier: Apache-2.0
// Keys over a seed kept in the macOS keychain, as a generic password under
// a service and an account. A missing item is made with a fresh seed on
// first use. The seed is handed to `security` on its input, never on a
// command line another process could read.
import { execFile, spawn } from 'node:child_process';
import { NobleCrypto } from '../bodies/noble-crypto.ts';
import type { Crypto } from '../foundation.ts';
import { freshSeed, HeldKeys } from './held-keys.ts';

const NAME = /^[A-Za-z0-9._-]{1,128}$/;
const NOT_FOUND = 44;

const find = (service: string, account: string) =>
  new Promise<string | null>((resolve, reject) => {
    execFile('security', ['find-generic-password', '-s', service, '-a', account, '-w'], (error, stdout) => {
      if (error === null) resolve(stdout.trimEnd());
      else if (error.code === NOT_FOUND) resolve(null);
      else reject(error);
    });
  });

const add = (service: string, account: string, seed: string) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn('security', ['-i'], { stdio: ['pipe', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.on('data', (chunk) => (err += chunk));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`security could not keep the seed: ${err.trim()}`))));
    child.stdin.end(`add-generic-password -s ${service} -a ${account} -w ${seed}\n`);
  });

export class KeychainKeys extends HeldKeys {
  readonly #service: string;
  readonly #account: string;
  readonly #crypto: Crypto;

  constructor({ service = 'nervur', account }: { service?: string; account: string }, crypto: Crypto = new NobleCrypto()) {
    super(crypto);
    if (process.platform !== 'darwin') throw new Error('the keychain is macOS’s');
    if (!NAME.test(service) || !NAME.test(account)) throw new TypeError('a service and an account are letters, digits, dots, dashes and underscores');
    this.#service = service;
    this.#account = account;
    this.#crypto = crypto;
  }

  protected async fetch(): Promise<string> {
    const found = await find(this.#service, this.#account);
    if (found !== null) return found;
    // Where two made one at once, the keychain keeps the first, and both read it.
    await add(this.#service, this.#account, freshSeed(this.#crypto)).catch(() => undefined);
    return (await find(this.#service, this.#account)) ?? Promise.reject(new Error(`no seed under ${this.#service}/${this.#account}`));
  }
}
