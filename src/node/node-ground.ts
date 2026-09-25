// SPDX-License-Identifier: Apache-2.0
// The ground on Node, for a server, a container, a desktop or a Pi. Its
// folder holds its code: a folder for each house, and each module or
// program its entries name. Its state holds the key, the ground's ledger
// and the hand's socket. It takes the lock, raises its primordial bodies,
// the key in a file or the keychain and the ledger, then stands its
// carries, its clock and its folder from entries its environment gives,
// the drawer's winning by name. It serves the hand.
import { mkdir } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Json } from '../being/being.ts';
import { WebCarry } from '../bodies/web-carry.ts';
import { Ground, type FacultyEntry, type Registry, type Unlock } from '../ground/ground.ts';
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
   * Its settings: `NERVUR_STATE`, `NERVUR_UNLOCK`, `NERVUR_HAND` and
   * `NERVUR_WAIT`, and the default entries of its carries, `NERVUR_TCP_PORT`,
   * `NERVUR_HTTP_PORT`, `NERVUR_BIND`, `NERVUR_ADDRESSES`, `NERVUR_ORIGINS`
   * and `NERVUR_ALLOW_PRIVATE`. The process's own where none are named.
   */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Its unlock, where the host opens the ground from its own code; `NERVUR_UNLOCK`'s, or the key file in its state, where omitted. */
  readonly unlock?: Unlock;
}

/** The ground the web carry serves, and the port its listener holds. */
interface Listener {
  ground?: Ground;
  port?: number | undefined;
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

const text = (value: Json | undefined, what: string): string | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new TypeError(`${what} is text`);
  return value;
};

const portOf = (value: Json | undefined, what: string): number | undefined => {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 65_535) throw new TypeError(`${what} is a port`);
  return value as number;
};

/**
 * The terrain's registry: the key in a file or the keychain, the ledger,
 * each house's classes from a folder, a module as a registry, a program
 * over the bridge, and the TCP and web carries. `listener` holds the
 * ground, whose one handler the web carry serves once the ground stands,
 * and the port it listens on.
 */
const nodeRegistry = (folder: string, listener: Listener, given: Unlock | undefined): Registry => ({
  faculties: {
    'file-unlock': {
      up: ({ args }) => {
        const path = text(args.path, 'a key file’s path');
        if (path === undefined) throw new TypeError('a key file names its path');
        return { serves: 'unlock', object: new FileUnlock(path) };
      },
    },
    'keychain-unlock': { up: ({ args }) => ({ serves: 'unlock', object: new KeychainUnlock({ account: text(args.account, 'a keychain account') ?? '' }) }) },
    ...(given === undefined ? {} : { 'given-unlock': { up: () => ({ serves: 'unlock', object: given }) } }),
    ledger: {
      up: ({ args }) => {
        const path = text(args.path, 'a ledger’s path');
        if (path === undefined) throw new TypeError('a ledger names its path');
        const witness = text(args.witness, 'a ledger’s witness');
        return { serves: 'memory', object: new LedgerMemory(path, witness === undefined ? {} : { witness }) };
      },
    },
    folder: { up: () => ({ serves: 'classes', house: ({ args }) => FolderClasses.open(inside(folder, args.at, 'a folder of code')) }) },
    module: {
      up: async ({ args }) => {
        const module = (await import(pathToFileURL(inside(folder, args.at, 'a module')).href)) as Registry;
        return { registry: module.faculties === undefined ? {} : { faculties: module.faculties } };
      },
    },
    bridge: {
      up: ({ args, secrets, memory }) => {
        if (typeof args.command !== 'string') throw new TypeError('a bridge names its program in command');
        const cwd = args.cwd === undefined ? folder : inside(folder, args.cwd, 'a program’s folder');
        return bridge({ command: args.command, args: strings(args.args, 'a program’s args'), env: secrets, cwd, memory });
      },
    },
    tcp: {
      up: ({ args }) => {
        const addresses = strings(args.addresses, 'a carry’s addresses');
        const carry = new TcpCarry({
          port: portOf(args.port, 'the TCP port') ?? null,
          host: text(args.bind, 'a bind address') ?? '0.0.0.0',
          allowPrivate: args.allowPrivate === true,
          ...(addresses.length === 0 ? {} : { addresses }),
        });
        return { serves: 'carry', schemes: ['tcp'], object: carry, down: () => carry.close() };
      },
    },
    web: {
      up: async ({ args }) => {
        const bind = text(args.bind, 'a bind address') ?? '0.0.0.0';
        const named = strings(args.addresses, 'a carry’s addresses');
        const listens = portOf(args.port, 'the HTTP port');
        let http: Served | undefined;
        const carry = new WebCarry({
          allowPrivate: args.allowPrivate === true,
          origins: strings(args.origins, 'the origins'),
          addresses: named.length > 0 ? named : () => (http === undefined ? [] : [`http://${bind === '0.0.0.0' ? '127.0.0.1' : bind}:${http.port}/quo`]),
        });
        // The ground's one listener, chaining this carry's handler and every face's, as the ground reads them.
        if (listens !== undefined) {
          http = await serveHttp({ port: listens, host: bind }, [
            {
              fetch: (request) => listener.ground?.handler.fetch(request) ?? Promise.resolve(null),
              upgrade: (request) => listener.ground?.handler.upgrade?.(request) ?? null,
            },
          ]);
        }
        const served = http;
        listener.port = served?.port;
        return {
          serves: 'carry',
          schemes: ['https', 'http', 'wss', 'ws'],
          object: carry,
          handler: carry,
          down: async () => {
            if (listener.port === served?.port) listener.port = undefined;
            await served?.close();
          },
        };
      },
    },
  },
});

// The environment's default entries: the clock, the folder, and the two carries.
const entriesOf = (env: Readonly<Record<string, string | undefined>>): Record<string, FacultyEntry> => {
  const addresses = (env.NERVUR_ADDRESSES ?? '')
    .split(',')
    .map((address) => address.trim())
    .filter((address) => address !== '');
  const ofScheme = (...schemes: string[]) => addresses.filter((address) => schemes.some((scheme) => address.toLowerCase().startsWith(`${scheme}://`)));
  const allowPrivate = env.NERVUR_ALLOW_PRIVATE === '1';
  const bind = env.NERVUR_BIND ?? '0.0.0.0';
  const tcpPort = port(env.NERVUR_TCP_PORT, 9110);
  const httpPort = port(env.NERVUR_HTTP_PORT, undefined);
  const origins = (env.NERVUR_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin !== '');
  const common = { bind, ...(allowPrivate ? { allowPrivate } : {}) };
  return {
    clock: { make: 'clock' },
    folder: { make: 'folder' },
    tcp: { make: 'tcp', args: { ...common, ...(tcpPort === undefined ? {} : { port: tcpPort }), ...(ofScheme('tcp').length === 0 ? {} : { addresses: ofScheme('tcp') }) } },
    web: {
      make: 'web',
      args: {
        ...common,
        ...(httpPort === undefined ? {} : { port: httpPort }),
        ...(ofScheme('https', 'http', 'wss', 'ws').length === 0 ? {} : { addresses: ofScheme('https', 'http', 'wss', 'ws') }),
        ...(origins.length === 0 ? {} : { origins }),
      },
    },
  };
};

// The unlock's entry: the host's own, `keychain:<account>` on macOS, or the key file in its state.
const unlockOf = (named: string | undefined, state: string, given: Unlock | undefined): FacultyEntry => {
  if (given !== undefined) return { make: 'given-unlock' };
  if (named === undefined || named === '') return { make: 'file-unlock', args: { path: join(state, 'key') } };
  const account = /^keychain:(.+)$/.exec(named)?.[1];
  if (account === undefined) throw new TypeError(`NERVUR_UNLOCK names keychain:<account>, not ${named}`);
  return { make: 'keychain-unlock', args: { account } };
};

export class NodeGround {
  readonly ground: Ground;
  /** The socket of the ground's hand. */
  readonly hand: string;
  readonly #lock: Lock;
  readonly #served: Hand;
  readonly #listener: Listener;

  private constructor(parts: { ground: Ground; hand: string; lock: Lock; served: Hand; listener: Listener }) {
    this.ground = parts.ground;
    this.hand = parts.hand;
    this.#lock = parts.lock;
    this.#served = parts.served;
    this.#listener = parts.listener;
  }

  /** The port HTTP listens on, where its web carry listens. */
  get httpPort(): number | undefined {
    return this.#listener.port;
  }

  static async open({ folder: given, state: stateGiven, env = process.env, unlock }: NodeGroundOptions): Promise<NodeGround> {
    const folder = resolve(given);
    const state = resolve(stateGiven ?? env.NERVUR_STATE ?? join(folder, 'state'));
    await mkdir(state, { recursive: true, mode: 0o700 });

    // 1. Lock.
    const lock = await takeLock(state);
    try {
      const wait = env.NERVUR_WAIT === undefined ? undefined : Number(env.NERVUR_WAIT);
      if (wait !== undefined && !(Number.isSafeInteger(wait) && wait > 0)) throw new TypeError('NERVUR_WAIT is whole milliseconds above zero');
      const listener: Listener = {};
      // 2 to 6, which the Ground runs: the primordial bodies, the drawer, the entries, the ladder, the houses.
      const ground = await Ground.open({
        registry: nodeRegistry(folder, listener, unlock),
        primordial: {
          unlock: unlockOf(env.NERVUR_UNLOCK, state, unlock),
          memory: { make: 'ledger', args: { path: join(state, 'ground.ledger'), witness: join(state, 'ground.witness') } },
          crypto: { make: 'noble' },
          tools: { make: 'strict' },
        },
        entries: entriesOf(env),
        ...(wait === undefined ? {} : { wait }),
      });
      listener.ground = ground;
      // 7. Ready: the hand takes its socket.
      const hand = env.NERVUR_HAND ?? handAt(state);
      const served = await serveHand((request) => ground.hand(request), hand).catch(async (error: unknown) => {
        await ground.close();
        throw error;
      });
      return new NodeGround({ ground, hand, lock, served, listener });
    } catch (error) {
      await lock.release();
      throw error;
    }
  }

  /** A stop is the boot reversed: the hand, the houses and every body, then the lock. */
  async close(): Promise<void> {
    await this.#served.close();
    await this.ground.close();
    await this.#lock.release();
  }
}
