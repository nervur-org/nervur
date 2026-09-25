// SPDX-License-Identifier: Apache-2.0
// The ground on Node, for a server, a container, a desktop or a Pi. Its
// folder holds its code: a folder for each house, and each module or
// program its entries name. Its state holds the key, the ground's ledger
// and the hand's socket. Its primordial bodies are the ledger, which holds
// the state folder's lock while it stands, the key in a file or the
// keychain, and the hand on its socket. Its terrain's entries stand its
// carries, its clock, its folder, its listener and its shell, each in the
// ladder, each moved through the dock. The environment names only the
// state, the unlock and the hand's socket.
import { mkdir } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Json } from '../being/being.ts';
import { s } from '../being/schema.ts';
import { WebCarry, type Handler } from '../bodies/web-carry.ts';
import { Ground, type FacultyEntry, type HandAsk, type Registry, type Unlock } from '../ground/ground.ts';
import { bridge } from './bridge.ts';
import { FolderClasses } from './folder-classes.ts';
import { handAt, serveHand } from './hand.ts';
import { serveHttp, type Served } from './http.ts';
import { LedgerMemory } from './ledger-memory.ts';
import { takeLock } from './lock.ts';
import { shell } from './shell.ts';
import { TcpCarry } from './tcp-carry.ts';
import { FileUnlock, KeychainUnlock } from './unlock.ts';

export interface NodeGroundOptions {
  /** The folder of its code: a folder for each house, and each module or program its entries name. */
  readonly folder: string;
  /** The folder of its state; `NERVUR_STATE`, or `<folder>/state`, where none is named. */
  readonly state?: string;
  /**
   * What opens its drawer and its hand, and nothing else: `NERVUR_STATE`,
   * `NERVUR_UNLOCK` and `NERVUR_HAND`. The process's own where none are
   * named. Every other setting is an entry the dock holds.
   */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Its unlock, where the host opens the ground from its own code; `NERVUR_UNLOCK`'s, or the key file in its state, where omitted. */
  readonly unlock?: Unlock;
}

// A path its entry names, held inside the ground's folder.
const inside = (folder: string, named: Json | undefined, what: string): string => {
  if (typeof named !== 'string') throw new TypeError(`${what} names its path in at`);
  const at = resolve(folder, named);
  const within = relative(folder, at);
  if (within.startsWith('..') || isAbsolute(within)) throw new Error(`${what} stands inside ${folder}`);
  return at;
};

const strings = (value: Json | undefined): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);

const text = (value: Json | undefined): string | undefined => (typeof value === 'string' ? value : undefined);

const NONE = { args: s.object({}) } as const;
// Where a carry listens until its entry names another bind: this machine alone.
const LOOPBACK = '127.0.0.1';
const PORT = s.integer({ minimum: 0, maximum: 65_535 });
const WORDS = s.array(s.string());
const CARRY = { port: s.optional(PORT), bind: s.optional(s.string()), allowPrivate: s.optional(s.boolean()), addresses: s.optional(WORDS) };

/** The variables of the process a command run through the shell holds, where its entry names no others. */
const SHELLED = ['PATH', 'HOME', 'USER', 'LANG', 'TERM', 'SHELL', 'TMPDIR'];

/**
 * The folder's own registry, which a module and a program stand on: each
 * rooted at the folder its body was raised on.
 */
const folderRegistry = (root: string): Registry => ({
  faculties: {
    module: {
      takes: { args: s.object({ at: s.string() }) },
      up: async ({ args }) => {
        const module = (await import(pathToFileURL(inside(root, args.at, 'a module')).href)) as Registry;
        return { registry: module.faculties === undefined ? {} : { faculties: module.faculties } };
      },
    },
    bridge: {
      takes: { args: s.object({ command: s.string(), args: s.optional(WORDS), cwd: s.optional(s.string()) }) },
      up: ({ args, secrets, memory }) => {
        const cwd = args.cwd === undefined ? root : inside(root, args.cwd, 'a program’s folder');
        return bridge({ command: args.command as string, args: strings(args.args), env: secrets, cwd, memory });
      },
    },
  },
});

/**
 * The terrain's registry: the ledger, which holds the state's lock while
 * it stands, the key in a file or the keychain, the hand on its socket,
 * each house's classes from the code folder its args name, whose body
 * carries the registry of modules and programs, the TCP and web carries,
 * and the shell. The web body says the port its listener holds, which
 * its twin keeps as a cell.
 */
const nodeRegistry = (given: Unlock | undefined): Registry => ({
  faculties: {
    'file-unlock': { takes: { args: s.object({ path: s.string() }) }, up: ({ args }) => ({ serves: 'unlock', object: new FileUnlock(args.path as string) }) },
    'keychain-unlock': { takes: { args: s.object({ account: s.string() }) }, up: ({ args }) => ({ serves: 'unlock', object: new KeychainUnlock({ account: args.account as string }) }) },
    ...(given === undefined ? {} : { 'given-unlock': { takes: NONE, up: () => ({ serves: 'unlock', object: given }) } }),
    ledger: {
      takes: { args: s.object({ path: s.string(), witness: s.optional(s.string()) }) },
      // One instance for its folder: the lock is taken before the ledger opens, and let go when its body goes down.
      up: async ({ args }) => {
        const path = args.path as string;
        await mkdir(dirname(path), { recursive: true, mode: 0o700 });
        const lock = await takeLock(dirname(path));
        const witness = text(args.witness);
        return { serves: 'memory', object: new LedgerMemory(path, witness === undefined ? {} : { witness }), down: () => lock.release() };
      },
    },
    'socket-hand': {
      takes: { args: s.object({ path: s.string() }) },
      up: async ({ args, faculties }) => {
        const ground = faculties.ground as { hand(request: HandAsk): Promise<unknown> };
        const served = await serveHand((request) => ground.hand(request), args.path as string);
        return { serves: 'hand', down: () => served.close() };
      },
    },
    folder: {
      takes: { args: s.object({ root: s.string() }) },
      up: ({ args }) => {
        const root = args.root as string;
        return { serves: 'classes', house: ({ args: named }) => FolderClasses.open(inside(root, named.at, 'a folder of code')), registry: folderRegistry(root) };
      },
    },
    tcp: {
      takes: { args: s.object(CARRY) },
      up: async ({ args }) => {
        const addresses = strings(args.addresses);
        const carry = new TcpCarry({
          port: (args.port as number | undefined) ?? null,
          host: text(args.bind) ?? LOOPBACK,
          allowPrivate: args.allowPrivate === true,
          ...(addresses.length === 0 ? {} : { addresses }),
        });
        // It binds here, so a port another holds keeps this body down with why, and the ground boots beside it.
        await carry.open();
        return { serves: 'carry', schemes: ['tcp'], object: carry, down: () => carry.close() };
      },
    },
    web: {
      takes: { args: s.object({ ...CARRY, origins: s.optional(WORDS) }) },
      up: async ({ args, faculties }) => {
        const bind = text(args.bind) ?? LOOPBACK;
        const named = strings(args.addresses);
        const listens = args.port as number | undefined;
        let http: Served | undefined;
        const carry = new WebCarry({
          allowPrivate: args.allowPrivate === true,
          origins: strings(args.origins),
          addresses: named.length > 0 ? named : () => (http === undefined ? [] : [`http://${bind === '0.0.0.0' ? '127.0.0.1' : bind}:${http.port}/quo`]),
        });
        // The ground's one listener, as the body its entry calls offers it: this carry's handler and every face's, chained.
        const listener = faculties.listener as Handler | undefined;
        if (listens !== undefined) {
          if (listener === undefined) throw new Error('a web carry listens on a port where its entry names the listener in its faculties');
          http = await serveHttp({ port: listens, host: bind }, [listener]);
        }
        const served = http;
        return {
          serves: 'carry',
          schemes: ['https', 'http', 'wss', 'ws'],
          object: carry,
          handler: carry,
          ...(served === undefined ? {} : { port: served.port }),
          down: () => served?.close(),
        };
      },
    },
    shell: {
      takes: { args: s.object({ root: s.string(), env: s.optional(WORDS) }) },
      up: ({ args }) => shell({ root: args.root as string, env: args.env === undefined ? SHELLED : strings(args.env) }),
    },
  },
});

/**
 * The terrain's default entries, fixed here: the clock, the folder of its
 * code, the listener, the TCP carry on the loopback at 9110, the web
 * carry dialling alone, and the shell. Nothing listens beyond the machine
 * until the owner names another bind. The owner moves any but the shell
 * through the dock, and the dock keeps it.
 */
const entriesOf = (folder: string): Readonly<Record<string, FacultyEntry>> => ({
  folder: { make: 'folder', args: { root: folder } },
  listener: { make: 'listener' },
  tcp: { make: 'tcp', args: { bind: LOOPBACK, port: 9110 } },
  web: { make: 'web', args: { bind: LOOPBACK }, faculties: ['listener'] },
  // Granted to the dock's being that holds the shell, and to no other class.
  shell: { make: 'shell', args: { root: folder, env: SHELLED }, kinds: ['org.nervur.dock.shell'] },
});

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

  private constructor(parts: { ground: Ground; hand: string }) {
    this.ground = parts.ground;
    this.hand = parts.hand;
  }

  /** The port HTTP listens on, where its web carry listens: a cell of the web's twin, read through the hand. */
  async port(): Promise<number | undefined> {
    const read = await this.ground.hand({ id: 'faculty.web', cells: true });
    const port = 'result' in read ? (read.result as { port?: unknown }).port : undefined;
    return typeof port === 'number' ? port : undefined;
  }

  static async open({ folder: given, state: stateGiven, env = process.env, unlock }: NodeGroundOptions): Promise<NodeGround> {
    const folder = resolve(given);
    const state = resolve(stateGiven ?? env.NERVUR_STATE ?? join(folder, 'state'));
    const hand = env.NERVUR_HAND ?? handAt(state);
    const ground = await Ground.open({
      registry: nodeRegistry(unlock),
      primordial: {
        unlock: unlockOf(env.NERVUR_UNLOCK, state, unlock),
        memory: { make: 'ledger', args: { path: join(state, 'ground.ledger'), witness: join(state, 'ground.witness') } },
        crypto: { make: 'noble' },
        tools: { make: 'strict' },
        clock: { make: 'clock' },
        hand: { make: 'socket-hand', args: { path: hand }, faculties: ['ground'] },
      },
      entries: entriesOf(folder),
    });
    return new NodeGround({ ground, hand });
  }

  /** A stop is the boot reversed: the hand, the houses and every body, then the ledger and its lock. */
  async close(): Promise<void> {
    await this.ground.close();
  }
}
