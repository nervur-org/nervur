// SPDX-License-Identifier: Apache-2.0
// The ground in a browser: one for its origin. Every page and the service
// worker of an origin open a BrowserGround, and the one holding the Web
// Lock runs the ground, as a NodeGround holds its folder's lock. Every other
// reaches that ground's hand over a BroadcastChannel. When the holder
// closes, the lock passes, and the next opens the ground from the same
// storage. It only dials: it listens for nothing and serves no face.
import type { Json } from '../being/being.ts';
import { JoinedCarry } from '../bodies/joined-carry.ts';
import { WebCarry } from '../bodies/web-carry.ts';
import type { Memory } from '../foundation.ts';
import { Ground, type Bodies, type Custody, type Faculty } from '../ground/ground.ts';
import type { Answer } from '../house/rows-shape.ts';
import { IndexedDbMemory } from './indexeddb-memory.ts';
import { LockedCustody } from './locked-custody.ts';
import { OriginClasses, type Load } from './origin-classes.ts';

/** What a page hands its ground: the faculties it makes, by name, and any custom body. */
export interface BrowserRecipe {
  readonly faculties?: () => Readonly<Record<string, Faculty | Promise<Faculty>>>;
  readonly bodies?: Partial<Bodies>;
  /** The kinds that hold the ground's own `houses`: its pilot. */
  readonly houses?: { readonly kinds: readonly string[] };
}

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
 * Where its seeds and its memories rest: the terrain's own, never a
 * recipe's, since the record that would name another lives in them. A
 * BrowserGround's are the origin's IndexedDB; an AppGround's are the
 * shell's. No entry exports this.
 */
export interface Stores {
  readonly custody: (name: string) => Promise<Custody>;
  readonly memory: (name: string) => Promise<Memory>;
}

const originStores: Stores = {
  custody: (custody) => LockedCustody.open(custody),
  memory: (memory) => IndexedDbMemory.open(memory),
};

let joinOn: (options: BrowserGroundOptions, stores: Stores) => Promise<BrowserGround>;

/** The origin's ground on stores of the terrain's own: an AppGround's, or a proof's in memory. No entry exports it. */
export const openOn = (options: BrowserGroundOptions, stores: Stores): Promise<BrowserGround> => joinOn(options, stores);

export interface BrowserGroundOptions {
  /** The ground's name on its origin, which names its lock, its channel and its storage. `nervur` where omitted. */
  readonly name?: string;
  readonly recipe?: BrowserRecipe;
  readonly platform?: Partial<BrowserPlatform>;
  /** The ground's bound on every ask, in milliseconds. */
  readonly wait?: number;
  /** Whether it dials private and loopback addresses, as a page on localhost does. */
  readonly allowPrivate?: boolean;
}

/** One request of the hand, as every terrain serves it. */
export interface BrowserHandRequest {
  readonly describe?: true;
  readonly faculty?: string;
  readonly house?: string;
  readonly id?: string;
  readonly method?: string;
  readonly args?: Json;
  readonly after?: Answer;
  readonly cells?: true;
}

type Said =
  | { readonly kind: 'who' }
  | { readonly kind: 'up'; readonly leader: string }
  | { readonly kind: 'ask'; readonly id: string; readonly to: string; readonly request: BrowserHandRequest }
  | { readonly kind: 'answer'; readonly id: string; readonly answer: Answer | { readonly describe: Json } };

const NAME = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const random = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) => byte.toString(16).padStart(2, '0')).join('');

// Bodies a recipe adds beside the ground's own, never in their place.
const joined = <T>(own: Readonly<Record<string, T>>, added: Readonly<Record<string, T>> = {}): Readonly<Record<string, T>> => {
  for (const name of Object.keys(added)) if (name in own) throw new TypeError(`the recipe names a body ${name}, which is the ground's own`);
  return { ...own, ...added };
};

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
  // The custody and the memories its boot opened, each closed when it closes.
  readonly #opened: unknown[] = [];
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
   * The hand: `describe`, a faculty's method, or an ask of a being in a
   * named house, answered by whichever page runs the ground.
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
      else if (said.kind === 'ask' && said.to === this.#self) void this.#answer(said.id, said.request);
      else if (said.kind === 'answer') {
        const pending = this.#pending.get(said.id);
        this.#pending.delete(said.id);
        pending?.settle(said.answer);
      }
    };
  }

  async #answer(id: string, request: BrowserHandRequest) {
    const answer = this.#ground === undefined ? { error: { message: 'the ground moved to another page; ask again' } } : await this.#local(request);
    this.#say({ kind: 'answer', id, answer });
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
        try {
          this.#ground = await this.#boot();
        } catch (error) {
          this.#failed(error);
          return;
        }
        this.#heard(this.#self);
        this.#say({ kind: 'up', leader: this.#self });
        this.#led();
        await new Promise<void>((resolve) => {
          this.#release = resolve;
        });
      })
      .catch(() => undefined);
  }

  // The boot: its own custody and memory, the recipe's faculties, and the record's houses.
  async #boot(): Promise<Ground> {
    const name = this.#name;
    const platform = this.#platform;
    const recipe = this.#options.recipe ?? {};
    // Every store it opens is kept, so its close lets each go before the lock passes.
    const kept = <T>(opened: T): T => {
      this.#opened.push(opened);
      return opened;
    };
    const stores = this.#stores;
    const custody = kept(await stores.custody(`${name}-custody`));
    const memory = kept(await stores.memory(`${name}-ground`));
    this.#persisted = await platform.persist().catch(() => false);
    // It only dials, so it writes no address into an invitation.
    const web = new WebCarry({ allowPrivate: this.#options.allowPrivate === true });
    const carry = new JoinedCarry({ https: web, http: web, wss: web, ws: web });
    const bodies: Bodies = {
      memory: joined({ indexeddb: async ({ house }) => kept(await stores.memory(`${name}-house-${house}`)) }, recipe.bodies?.memory),
      classes: joined(
        {
          origin: ({ args }) => {
            if (typeof args.at !== 'string') throw new Error('the origin body names its module in at');
            return OriginClasses.open(args.at, platform.origin, platform.load);
          },
        },
        recipe.bodies?.classes,
      ),
    };
    const wait = this.#options.wait;
    const faculties = recipe.faculties;
    return Ground.open({ custody, memory, carry, bodies, ...(faculties === undefined ? {} : { recipe: faculties }), ...(wait === undefined ? {} : { wait }), ...(recipe.houses === undefined ? {} : { houses: recipe.houses }) });
  }

  /** This page leaves: its ground closes where it ran one, and the lock passes to the next page. */
  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    this.#abort.abort();
    const ground = this.#ground;
    this.#ground = undefined;
    await ground?.close();
    // Its IndexedDB connections go with it, so the next ground in this page opens on none of its.
    for (const opened of this.#opened.splice(0)) (opened as { close?: () => void }).close?.();
    this.#release?.();
    this.#orphan(() => true);
    for (const resolve of this.#waiting) resolve();
    this.#waiting = [];
    this.#channel.close();
  }
}
