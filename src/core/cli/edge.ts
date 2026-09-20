// SPDX-License-Identifier: Apache-2.0
// `nervur edge dev`: an edge harbor on this machine, as it will stand on
// Cloudflare. The harbor of a folder is packed under its name into the
// pack the worker imports, beside the harbors the pack holds already, and
// the worker's own `wrangler dev` runs them all, in the folder the command
// runs from, with the secret handed as `NERVUR_SECRET` through the
// environment so no listing of processes shows it. The secret is the one
// the command's environment names, or one drawn once and kept under
// `.nervur-edge`, beside the objects' storage, so a harbor landed once
// stands again across restarts, as it does on Cloudflare.
//
// wrangler is the worker's tool and never the kit's: the one who deploys
// an edge has it already, and `edge dev` finds it where npm put it.
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { hex } from '../crypto/index.ts';
import { CryptoEntropy } from '../pointer/index.ts';
import { pack } from './harbor.ts';

export const EDGE_STATE = '.nervur-edge';
// A refused fetch costs next to nothing, so wrangler is asked often and is
// found the moment it answers, within the same minute as ever.
const READY_TRIES = 2400;
const READY_EVERY = 25;

export type EdgeDev = { readonly at: string; readonly places: number; close(): Promise<void> };

const answers = (url: string): Promise<boolean> =>
  fetch(url).then(
    () => true,
    () => false,
  );

// Resolved once wrangler answers at `url`, rejected once it exits or never
// answers.
const ready = async (child: ChildProcess, url: string, said: () => string): Promise<void> => {
  let gone = false;
  child.once('exit', () => (gone = true));
  for (let i = 0; i < READY_TRIES; i += 1) {
    if (gone) throw new Error(`wrangler dev exited: ${said()}`);
    if (await answers(url)) return;
    await new Promise((r) => setTimeout(r, READY_EVERY));
  }
  throw new Error(`wrangler dev never answered at ${url}: ${said()}`);
};

// The secret `edge dev` runs under: the one named, or the one kept here.
const devSecret = async (state: string, named: string | undefined): Promise<string> => {
  if (named) return named;
  const file = join(state, 'secret');
  if (!existsSync(file)) {
    await mkdir(state, { recursive: true, mode: 0o700 });
    await writeFile(file, `${hex(new CryptoEntropy().draw(32))}\n`, { mode: 0o600, flag: 'wx' });
  }
  return (await readFile(file, 'utf8')).trim();
};

export const edgeDev = async (dir: string, file: string, name: string, cwd: string, port: number, named?: string): Promise<EdgeDev> => {
  const state = join(cwd, EDGE_STATE);
  const secret = await devSecret(state, named);
  const { places } = (await pack(dir, file, name, secret)) as { places: number };
  const child = spawn('npx', ['--no-install', 'wrangler', 'dev', '--ip', '127.0.0.1', '--port', String(port), '--persist-to', state, '--log-level', 'warn'], {
    cwd,
    env: { ...process.env, NERVUR_SECRET: secret, CLOUDFLARE_INCLUDE_PROCESS_ENV: 'true' },
    stdio: ['ignore', 'ignore', 'pipe'],
    detached: true,
  });
  let err = '';
  child.stderr!.on('data', (chunk: Buffer) => (err = `${err}${chunk.toString('utf8')}`.slice(-4000)));
  const at = `http://127.0.0.1:${String(port)}/${name}/quo`;
  const close = (): Promise<void> =>
    new Promise((done) => {
      if (child.exitCode !== null) return done();
      child.once('exit', () => done());
      process.kill(-child.pid!, 'SIGTERM');
    });
  try {
    await ready(child, at, () => err);
  } catch (e) {
    await close();
    throw e;
  }
  return { at, places, close };
};
