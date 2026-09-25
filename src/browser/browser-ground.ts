// SPDX-License-Identifier: Apache-2.0
// The ground in a browser: one for its origin. Every page and the service
// worker of an origin open a BrowserGround, and the one holding the Web
// Lock runs the ground, as a NodeGround holds its folder's lock. Every other
// reaches that ground's hand over a BroadcastChannel. When the holder
// closes, the lock passes, and the next opens the ground from the same
// storage. It only dials: it listens for nothing and serves no face.
import type { Json } from '../being/being.ts';
import { s } from '../being/schema.ts';
import { WebCarry } from '../bodies/web-carry.ts';
import type { Memory } from '../foundation.ts';
import { Ground, joinedRegistry, type Registry, type Unlock } from '../ground/ground.ts';
import type { Answer } from '../house/rows-shape.ts';
import { IndexedDbMemory } from './indexeddb-memory.ts';
import { LockedUnlock } from './locked-unlock.ts';
import { OriginClasses, type Load } from './origin-classes.ts';

/** What the ground takes of its engine. Each is the page's own where omitted. */
export interface BrowserPlatform {
  readonly locks: Pick<LockManager, 'request'>;
  readonly channel: (name: string) => Pick<BroadcastChannel, 'postMessage' | 'close'> & { onmessage: ((event: MessageEvent) => void) | null };
  /** Where its code stands; its classes load from under it alone. */
  readonly origin: string;
  /** Asks the browser to keep its storage, and answers whether it will. */
  readonly persist: () => Promise<boolean>;
  /** Loads a module of classes by URL: `import()`, or in a service worker a map of the worker's own imports. */
  readonly load: Load;
}

/**
 * Where its key and its memory rest: the terrain's own, never the
 * drawer's, since the drawer is read with them. A BrowserGround's are the
 * origin's IndexedDB; an AppGround's are the shell's. No entry exports
 * this.
 */
export interface Stores {
  readonly unlock: (name: string) => Promise<Unlock>;
  readonly memory: (name: string) => Promise<Memory>;
}

const originStores: Stores = {
  unlock: (unlock) => LockedUnlock.open(unlock),
  memory: (memory) => IndexedDbMemory.open(memory),
};

let joinOn: (options: BrowserGroundOptions, stores: Stores) => Promise<BrowserGround>;

/** The origin's ground on stores of the terrain's own: an AppGround's, or a proof's in memory. No entry exports it. */
export const openOn = (options: BrowserGroundOptions, stores: Stores): Promise<BrowserGround> => joinOn(options, stores);

export interface BrowserGroundOptions {
  /** The ground's name on its origin, which names its lock, its channel and its storage. `nervur` where omitted. */
  readonly name?: string;
  /** The page's own registry, which joins the terrain's as the ladder's first rung. */
  readonly registry?: Registry;
  readonly platform?: Partial<BrowserPlatform>;
  /** The ground's bound on every ask, in milliseconds. */
  readonly wait?: number;
  /** Whether it dials private and loopback addresses, as a page on localhost does. */
  readonly allowPrivate?: boolean;
}

/** One request of the hand, as every terrain serves it: `describe`, or an ask of a being in the house it names, or of the dock's steward where it names none. */
export interface BrowserHandRequest {
  readonly describe?: true;
  readonly house?: string;
  readonly id?: string;
  readonly method?: string;
  readonly args?: Json;
  readonly after?: Answer;
  readonly cells?: true;
  readonly call?: string;
}

type Said =
  | { readonly kind: 'who' }
  | { readonly kind: 'up'; readonly leader: string }
  | { readonly kind: 'ask'; readonly id: string; readonly to: string; readonly request: BrowserHandRequest }
  | { readonly kind: 'answer'; readonly id: string; readonly answer: Answer | { readonly describe: Json } };

const NAME = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const NONE = { args: s.object({}) } as const;
const random = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) => byte.toString(16).padStart(2, '0')).join('');

const defaults = (name: string): BrowserPlatform => ({
  locks: navigator.locks,
  channel: (channel) => new BroadcastChannel(channel),
  origin: globalThis.location?.origin ?? `nervur:${name}`,
  persist: async () => (await navigator.storage?.persist?.()) ?? false,
  load: (href) => import(href),
});

export class BrowserGround {
  readonly #name: string;
  readonly #platform: BrowserPlatform;
  readonly #stores: Stores;
  readonly #options: BrowserGroundOptions;
  readonly #self = random();
  readonly #channel: ReturnType<BrowserPlatform['channel']>;
  readonly #abort = new AbortController();
  // Asks sent to another page's ground, by id, with the page they went to.
  readonly #pending = new Map<string, { readonly to: string; readonly settle: (answer: Answer | { readonly describe: Json }) => void }>();
  #ground: Ground | undefined;
  #persisted = false;
  #leader: string | undefined;
  #waiting: (() => void)[] = [];
  #release: (() => void) | undefined;
  #leading: Promise<void>;
  #led!: () => void;
  #failed!: (error: unknown) => void;
  #closed = false;

  private constructor(name: string, platform: BrowserPlatform, stores: Stores, options: BrowserGroundOptions) {
    this.#name = name;
    this.#platform = platform;
    this.#stores = stores;
    this.#options = options;
    this.#channel = platform.channel(`${name}-hand`);
    this.#leading = new Promise((resolve, reject) => {
      this.#led = resolve;
      this.#failed = reject;
    });
    this.#leading.catch(() => undefined);
  }

  /**
   * The origin's ground, joined: this page runs it where it takes the lock,
   * and reaches the page that runs it where another holds the lock.
   */
  static open(options: BrowserGroundOptions = {}): Promise<BrowserGround> {
    return BrowserGround.#join(options, originStores);
  }

  static async #join(options: BrowserGroundOptions, stores: Stores): Promise<BrowserGround> {
    const name = options.name ?? 'nervur';
    if (!NAME.test(name)) throw new TypeError(`no ground is named ${name}`);
    const platform = { ...defaults(name), ...options.platform };
    const joining = new BrowserGround(name, platform, stores, options);
    joining.#listen();
    joining.#queue();
    joining.#say({ kind: 'who' });
    return joining;
  }

  static {
    joinOn = (options, stores) => BrowserGround.#join(options, stores);
  }

  /** Whether this page runs the ground now. */
  get leading(): boolean {
    return this.#ground !== undefined;
  }

  /** The ground, where this page runs it. */
  get ground(): Ground | undefined {
    return this.#ground;
  }

  /** Resolves once this page runs the ground, and rejects where its boot failed. */
  led(): Promise<void> {
    return this.#leading;
  }

  /**
   * The hand: `describe`, or an ask of a being in a named house or of the
   * dock's steward, answered by whichever page runs the ground.
   */
  async hand(request: BrowserHandRequest): Promise<Answer | { readonly describe: Json }> {
    if (this.#closed) return { error: { message: 'the ground is closed here' } };
    if (this.#ground !== undefined) return this.#local(request);
    if (this.#leader === undefined) await new Promise<void>((resolve) => this.#waiting.push(resolve));
    if (this.#ground !== undefined) return this.#local(request);
    const id = random();
    const to = this.#leader!;
    return new Promise((settle) => {
      this.#pending.set(id, { to, settle });
      this.#say({ kind: 'ask', id, to, request });
    });
  }

  async #local(request: BrowserHandRequest): Promise<Answer | { readonly describe: Json }> {
    const answer = await this.#ground!.hand(request);
    if (request.describe === true && 'result' in answer) return { result: { ...(answer.result as Record<string, Json>), persisted: this.#persisted } };
    return answer;
  }

  #say(said: Said) {
    this.#channel.postMessage(said);
  }

  #listen() {
    this.#channel.onmessage = (event: MessageEvent) => {
      const said = event.data as Said;
      if (said.kind === 'who' && this.#ground !== undefined) this.#say({ kind: 'up', leader: this.#self });
      else if (said.kind === 'up') this.#heard(said.leader);
      else if (said.kind === 'answer') {
        const pending = this.#pending.get(said.id);
        this.#pending.delete(said.id);
        pending?.settle(said.answer);
      }
    };
  }

  // A new page runs the ground: asks sent to the one before may never be answered, so they fail, and whoever waited goes on.
  #heard(leader: string) {
    if (leader !== this.#leader) this.#orphan((to) => to !== leader);
    this.#leader = leader;
    const waiting = this.#waiting;
    this.#waiting = [];
    for (const resolve of waiting) resolve();
  }

  #orphan(lost: (to: string) => boolean) {
    for (const [id, pending] of this.#pending) {
      if (!lost(pending.to)) continue;
      this.#pending.delete(id);
      pending.settle({ error: { message: 'the page that ran the ground closed; ask again' } });
    }
  }

  // The lock, asked once and held until this page closes.
  #queue() {
    this.#platform.locks
      .request(`${this.#name}-ground`, { signal: this.#abort.signal }, async () => {
        let booted: Ground;
        try {
          booted = await this.#boot();
        } catch (error) {
          this.#failed(error);
          return;
        }
        // A page that closed while its boot ran lets the ground go at once, and the lock with it.
        if (this.#closed) {
          await booted.close();
          return;
        }
        this.#ground = booted;
        this.#heard(this.#self);
        this.#say({ kind: 'up', leader: this.#self });
        this.#led();
        await new Promise<void>((resolve) => {
          this.#release = resolve;
        });
      })
      .catch(() => undefined);
  }

  // The boot: its own unlock and memory, then the ground on them, its ladder and its drawer's houses.
  async #boot(): Promise<Ground> {
    const name = this.#name;
    const platform = this.#platform;
    const stores = this.#stores;
    this.#persisted = await platform.persist().catch(() => false);
    // Each store it opens is let go when its body goes down, so the next ground in this page opens on none of its.
    const closing = (opened: unknown) => () => (opened as { close?: () => void }).close?.();
    const own: Registry = {
      faculties: {
        'store-unlock': {
          takes: NONE,
          up: async () => {
            const unlock = await stores.unlock(`${name}-unlock`);
            return { serves: 'unlock', object: unlock, down: closing(unlock) };
          },
        },
        'store-memory': {
          takes: NONE,
          up: async () => {
            const memory = await stores.memory(`${name}-ground`);
            return { serves: 'memory', object: memory, down: closing(memory) };
          },
        },
        // The hand, for every other page of the origin: the asks sent to this page on the channel, each answered there.
        'channel-hand': {
          takes: { args: s.object({ channel: s.string(), self: s.string(), persisted: s.boolean() }) },
          up: ({ args, faculties }) => {
            const ground = faculties.ground as { hand(request: BrowserHandRequest): Promise<Answer | { readonly describe: Json }> };
            const channel = platform.channel(args.channel as string);
            let open = true;
            channel.onmessage = (event: MessageEvent) => {
              const said = event.data as Said;
              if (said.kind !== 'ask' || said.to !== args.self) return;
              // An ask this hand's close ended is answered by no one here: the page that runs the ground next is asked again.
              void ground.hand(said.request).then((answer) => {
                if (!open) return;
                channel.postMessage({
                  kind: 'answer',
                  id: said.id,
                  answer: said.request.describe === true && 'result' in answer ? { result: { ...(answer.result as Record<string, Json>), persisted: args.persisted === true } } : answer,
                } satisfies Said);
              });
            };
            return {
              serves: 'hand',
              down: () => {
                open = false;
                channel.close();
              },
            };
          },
        },
        // It only dials, so it writes no address into an invitation.
        web: {
          takes: { args: s.object({ allowPrivate: s.optional(s.boolean()) }) },
          up: ({ args }) => {
            const web = new WebCarry({ allowPrivate: args.allowPrivate === true });
            return { serves: 'carry', schemes: ['https', 'http', 'wss', 'ws'], object: web };
          },
        },
        origin: {
          takes: NONE,
          up: () => ({
            serves: 'classes',
            house: ({ args }) => {
              if (typeof args.at !== 'string') throw new Error('the origin faculty names a house’s module in at');
              return OriginClasses.open(args.at, platform.origin, platform.load);
            },
          }),
        },
      },
    };
    const wait = this.#options.wait;
    return Ground.open({
      registry: joinedRegistry(own, this.#options.registry ?? {}),
      primordial: {
        unlock: { make: 'store-unlock' },
        memory: { make: 'store-memory' },
        crypto: { make: 'noble' },
        tools: { make: 'strict' },
        clock: { make: 'clock' },
        hand: { make: 'channel-hand', args: { channel: `${name}-hand`, self: this.#self, persisted: this.#persisted }, faculties: ['ground'] },
      },
      entries: {
        origin: { make: 'origin' },
        web: { make: 'web', args: this.#options.allowPrivate === true ? { allowPrivate: true } : {} },
      },
      ...(wait === undefined ? {} : { wait }),
    });
  }

  /** This page leaves: its ground closes where it ran one, and the lock passes to the next page. */
  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    this.#abort.abort();
    const ground = this.#ground;
    this.#ground = undefined;
    await ground?.close();
    this.#release?.();
    this.#orphan(() => true);
    for (const resolve of this.#waiting) resolve();
    this.#waiting = [];
    this.#channel.close();
  }
}
