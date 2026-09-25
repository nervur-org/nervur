// SPDX-License-Identifier: Apache-2.0
// The ground on Node, for a server, a container, a desktop or a Pi. Its
// folder holds its code: a folder for each house, and each module or
// program its entries name. Its state holds the key, the ground's ledger
// and the hand's socket. It takes the lock, opens the ground on its key and
// its ledger, listens on TCP and on HTTP, and serves the hand.
import { mkdir } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Json } from '../being/being.ts';
import { JoinedCarry } from '../bodies/joined-carry.ts';
import { WebCarry } from '../bodies/web-carry.ts';
import { Ground, type Registry, type Unlock } from '../ground/ground.ts';
import { bridge } from './bridge.ts';
import { FolderClasses } from './folder-classes.ts';
import { handAt, serveHand, type Hand } from './hand.ts';
import { serveHttp, type Served } from './http.ts';
import { LedgerMemory } from './ledger-memory.ts';
import { takeLock, type Lock } from './lock.ts';
import { TcpCarry } from './tcp-carry.ts';
import { FileUnlock, KeychainUnlock } from './unlock.ts';

export interface NodeGroundOptions {
  /** The folder of its code: a folder for each house, and each module or program its entries name. */
  readonly folder: string;
  /** The folder of its state; `NERVUR_STATE`, or `<folder>/state`, where none is named. */
  readonly state?: string;
  /**
   * Its settings: `NERVUR_STATE`, `NERVUR_TCP_PORT`, `NERVUR_HTTP_PORT`, `NERVUR_BIND`,
   * `NERVUR_ADDRESSES`, `NERVUR_ORIGINS`, `NERVUR_ALLOW_PRIVATE`, `NERVUR_UNLOCK`,
   * `NERVUR_HAND` and `NERVUR_WAIT`. The process's own where none are named.
   */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Its unlock, where the host opens the ground from its own code; `NERVUR_UNLOCK`'s, or the key file in its state, where omitted. */
  readonly unlock?: Unlock;
}

const port = (value: string | undefined, fallback: number | undefined): number | undefined => {
  if (value === undefined || value === '') return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 65_535) throw new TypeError(`${value} is no port`);
  return number;
};

// A path its entry names, held inside the ground's folder.
const inside = (folder: string, named: Json | undefined, what: string): string => {
  if (typeof named !== 'string') throw new TypeError(`${what} names its path in at`);
  const at = resolve(folder, named);
  const within = relative(folder, at);
  if (within.startsWith('..') || isAbsolute(within)) throw new Error(`${what} stands inside ${folder}`);
  return at;
};

const strings = (value: Json | undefined, what: string): string[] => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) throw new TypeError(`${what} is a list of words`);
  return value;
};

// The terrain's registry: a house's classes from a folder, a module as a registry, and a program over the bridge.
const nodeRegistry = (folder: string): Registry => ({
  classes: { folder: ({ args }) => FolderClasses.open(inside(folder, args.at, 'a folder of code')) },
  faculties: {
    module: async ({ args }) => {
      const module = (await import(pathToFileURL(inside(folder, args.at, 'a module')).href)) as Registry;
      return { registry: { ...(module.faculties === undefined ? {} : { faculties: module.faculties }), ...(module.memory === undefined ? {} : { memory: module.memory }), ...(module.classes === undefined ? {} : { classes: module.classes }) } };
    },
    bridge: ({ args, secrets, memory }) => {
      if (typeof args.command !== 'string') throw new TypeError('a bridge names its program in command');
      const cwd = args.cwd === undefined ? folder : inside(folder, args.cwd, 'a program’s folder');
      return bridge({ command: args.command, args: strings(args.args, 'a program’s args'), env: secrets, cwd, memory });
    },
  },
});

// The unlock `NERVUR_UNLOCK` names: `keychain:<account>` on macOS, or the key file in its state.
const unlockOf = (named: string | undefined, state: string): Unlock => {
  if (named === undefined || named === '') return new FileUnlock(join(state, 'key'));
  const account = /^keychain:(.+)$/.exec(named)?.[1];
  if (account === undefined) throw new TypeError(`NERVUR_UNLOCK names keychain:<account>, not ${named}`);
  return new KeychainUnlock({ account });
};

export class NodeGround {
  readonly ground: Ground;
  /** The socket of the ground's hand. */
  readonly hand: string;
  readonly #tcp: TcpCarry;
  readonly #lock: Lock;
  readonly #served: Hand;
  readonly #http: Served | undefined;

  private constructor(parts: { ground: Ground; hand: string; tcp: TcpCarry; lock: Lock; served: Hand; http: Served | undefined }) {
    this.ground = parts.ground;
    this.hand = parts.hand;
    this.#tcp = parts.tcp;
    this.#lock = parts.lock;
    this.#served = parts.served;
    this.#http = parts.http;
  }

  /** The port HTTP listens on, where it listens. */
  get httpPort(): number | undefined {
    return this.#http?.port;
  }

  static async open({ folder: given, state: stateGiven, env = process.env, unlock }: NodeGroundOptions): Promise<NodeGround> {
    const folder = resolve(given);
    const state = resolve(stateGiven ?? env.NERVUR_STATE ?? join(folder, 'state'));
    await mkdir(state, { recursive: true, mode: 0o700 });

    // 1. Lock.
    const lock = await takeLock(state);
    try {
      // The carry: TCP and the web, each writing the addresses of its schemes.
      const addresses = (env.NERVUR_ADDRESSES ?? '')
        .split(',')
        .map((address) => address.trim())
        .filter((address) => address !== '');
      const ofScheme = (...schemes: string[]) => addresses.filter((address) => schemes.some((scheme) => address.toLowerCase().startsWith(`${scheme}://`)));
      const allowPrivate = env.NERVUR_ALLOW_PRIVATE === '1';
      const bind = env.NERVUR_BIND ?? '0.0.0.0';
      const tcpNamed = ofScheme('tcp');
      const tcp = new TcpCarry({ port: port(env.NERVUR_TCP_PORT, 9110), host: bind, allowPrivate, ...(tcpNamed.length === 0 ? {} : { addresses: tcpNamed }) });
      const httpPort = port(env.NERVUR_HTTP_PORT, undefined);
      let http: Served | undefined;
      const webNamed = ofScheme('https', 'http', 'wss', 'ws');
      // The pages of other origins it answers, by commas: a page of its own host needs none.
      const origins = (env.NERVUR_ORIGINS ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin !== '');
      const web = new WebCarry({
        allowPrivate,
        origins,
        addresses: webNamed.length > 0 ? webNamed : () => (http === undefined ? [] : [`http://${bind === '0.0.0.0' ? '127.0.0.1' : bind}:${http.port}/quo`]),
      });
      // The web carries the post and the held line alike, so it speaks all four of its schemes.
      const carry = new JoinedCarry({ tcp, https: web, http: web, wss: web, ws: web });

      const wait = env.NERVUR_WAIT === undefined ? undefined : Number(env.NERVUR_WAIT);
      if (wait !== undefined && !(Number.isSafeInteger(wait) && wait > 0)) throw new TypeError('NERVUR_WAIT is whole milliseconds above zero');
      // 2 to 5, which the Ground runs: the key, the drawer on the ledger, the ladder, then the drawer's houses.
      const ground = await Ground.open({
        unlock: unlock ?? unlockOf(env.NERVUR_UNLOCK, state),
        memory: new LedgerMemory(join(state, 'ground.ledger'), { witness: join(state, 'ground.witness') }),
        carry,
        registry: nodeRegistry(folder),
        ...(wait === undefined ? {} : { wait }),
      });

      // 6. Hook: HTTP chains the web carry and every faculty's handler, and the hand takes its socket.
      if (httpPort !== undefined) http = await serveHttp({ port: httpPort, host: bind }, [web, ground.handler]);
      const hand = env.NERVUR_HAND ?? handAt(state);
      const served = await serveHand((request) => ground.hand(request), hand);
      return new NodeGround({ ground, hand, tcp, lock, served, http });
    } catch (error) {
      await lock.release();
      throw error;
    }
  }

  /** A stop is the boot reversed: the listeners, the houses and faculties, the carry, the lock. */
  async close(): Promise<void> {
    await this.#http?.close();
    await this.#served.close();
    await this.ground.close();
    await this.#tcp.close();
    await this.#lock.release();
  }
}
