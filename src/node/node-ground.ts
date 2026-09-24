// SPDX-License-Identifier: Apache-2.0
// The ground on Node, for a server, a container, a desktop or a Pi. Its
// folder holds the recipe and a folder of code for each house; its state
// holds the seeds, the record's ledger, each house's ledger and the hand's
// socket. It takes the lock, opens the ground on its own custody and
// memory, listens on TCP and on HTTP, and serves the hand.
import { access, mkdir } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { JoinedCarry } from '../bodies/joined-carry.ts';
import { WebCarry } from '../bodies/web-carry.ts';
import { Ground, type Bodies, type Custody, type Faculty } from '../ground/ground.ts';
import { FolderCustody, KeychainCustody } from './custody.ts';
import { FolderClasses } from './folder-classes.ts';
import { handAt, serveHand, type Hand } from './hand.ts';
import { serveHttp, type Served } from './http.ts';
import { LedgerMemory } from './ledger-memory.ts';
import { takeLock, type Lock } from './lock.ts';
import { TcpCarry } from './tcp-carry.ts';

/** What a ground's recipe exports: the faculties it makes, by name, and any custom body. */
export interface Recipe {
  readonly faculties?: (made: { env: Readonly<Record<string, string | undefined>>; dir: (name: string) => Promise<string> }) => Readonly<Record<string, Faculty | Promise<Faculty>>>;
  readonly bodies?: Partial<Bodies>;
}

export interface NodeGroundOptions {
  /** The folder of its code: the recipe, and a folder for each house. */
  readonly folder: string;
  /** The folder of its state; `NERVUR_STATE`, or `<folder>/state`, where none is named. */
  readonly state?: string;
  /**
   * Its settings: `NERVUR_STATE`, `NERVUR_TCP_PORT`, `NERVUR_HTTP_PORT`, `NERVUR_BIND`,
   * `NERVUR_ADDRESSES`, `NERVUR_ALLOW_PRIVATE`, `NERVUR_KEYCHAIN`,
   * `NERVUR_HAND` and `NERVUR_WAIT`. The process's own where none are named.
   */
  readonly env?: Readonly<Record<string, string | undefined>>;
}

const RECIPES = ['recipe.js', 'recipe.mjs', 'recipe.ts'];

const found = async (folder: string): Promise<Recipe> => {
  for (const name of RECIPES) {
    const at = join(folder, name);
    if (await access(at).then(() => true, () => false)) return (await import(pathToFileURL(at).href)) as Recipe;
  }
  return {};
};

const port = (value: string | undefined, fallback: number | undefined): number | undefined => {
  if (value === undefined || value === '') return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 65_535) throw new TypeError(`${value} is no port`);
  return number;
};

// Bodies the recipe adds beside the ground's own, never in their place.
const joined = <T>(own: Readonly<Record<string, T>>, added: Readonly<Record<string, T>> = {}): Readonly<Record<string, T>> => {
  for (const name of Object.keys(added)) if (name in own) throw new TypeError(`the recipe names a body ${name}, which is the ground's own`);
  return { ...own, ...added };
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

  static async open({ folder: given, state: stateGiven, env = process.env }: NodeGroundOptions): Promise<NodeGround> {
    const folder = resolve(given);
    const state = resolve(stateGiven ?? env.NERVUR_STATE ?? join(folder, 'state'));
    await mkdir(join(state, 'houses'), { recursive: true, mode: 0o700 });

    // 1. Lock.
    const lock = await takeLock(state);
    try {
      // 2. Its own custody and memory, always the terrain's.
      const custody: Custody = env.NERVUR_KEYCHAIN ? new KeychainCustody({ service: env.NERVUR_KEYCHAIN }) : new FolderCustody(join(state, 'seeds'));
      const memory = new LedgerMemory(join(state, 'ground.ledger'), { witness: join(state, 'ground.witness') });

      // The carry: TCP and the web, each writing the addresses of its schemes.
      const addresses = (env.NERVUR_ADDRESSES ?? '')
        .split(',')
        .map((address) => address.trim())
        .filter((address) => address !== '');
      const ofScheme = (...schemes: string[]) => addresses.filter((address) => schemes.some((scheme) => address.toLowerCase().startsWith(`${scheme}://`)));
      const allowPrivate = env.NERVUR_ALLOW_PRIVATE === '1';
      const bind = env.NERVUR_BIND ?? '0.0.0.0';
      const tcpNamed = ofScheme('tcp');
      const tcp = new TcpCarry({ port: port(env.NERVUR_TCP_PORT, 7300), host: bind, allowPrivate, ...(tcpNamed.length === 0 ? {} : { addresses: tcpNamed }) });
      const httpPort = port(env.NERVUR_HTTP_PORT, undefined);
      let http: Served | undefined;
      const webNamed = ofScheme('https', 'http');
      const web = new WebCarry({
        allowPrivate,
        addresses: webNamed.length > 0 ? webNamed : () => (http === undefined ? [] : [`http://${bind === '0.0.0.0' ? '127.0.0.1' : bind}:${http.port}/quo`]),
      });
      const carry = new JoinedCarry({ tcp, https: web, http: web });

      // 3 to 5. The recipe's faculties, awaited up in its order; then the record's houses.
      const recipe = await found(folder);
      const faculties: Record<string, Faculty> = {};
      const made = recipe.faculties?.({
        env,
        dir: async (name) => {
          const dir = join(state, 'faculties', name);
          await mkdir(dir, { recursive: true, mode: 0o700 });
          return dir;
        },
      });
      for (const [name, faculty] of Object.entries(made ?? {})) faculties[name] = await faculty;
      const bodies: Bodies = {
        memory: joined({ ledger: ({ house }) => new LedgerMemory(join(state, 'houses', `${house}.ledger`), { witness: join(state, 'houses', `${house}.witness`) }) }, recipe.bodies?.memory),
        classes: joined(
          {
            folder: ({ args }) => {
              const at = resolve(folder, String(args.at));
              const inside = relative(folder, at);
              if (typeof args.at !== 'string' || inside.startsWith('..') || isAbsolute(inside)) throw new Error(`a folder of code stands inside ${folder}`);
              return FolderClasses.open(at);
            },
          },
          recipe.bodies?.classes,
        ),
      };
      const wait = env.NERVUR_WAIT === undefined ? undefined : Number(env.NERVUR_WAIT);
      const ground = await Ground.open({ custody, memory, carry, bodies, faculties, ...(wait === undefined ? {} : { wait }) });

      // 6. Hook: HTTP chains the web carry and every faculty's handler, and the hand takes its socket.
      if (httpPort !== undefined) http = await serveHttp({ port: httpPort, host: bind }, [web, ...ground.handlers]);
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
