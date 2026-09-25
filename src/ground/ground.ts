// SPDX-License-Identifier: Apache-2.0
// The ground: the process houses run in, on any engine. Every faculty has
// one lifecycle: a registry holds it by name, and its `up` raises it into
// a body. The primordial go up first on the host's entries: the memory,
// the unlock, crypto and tools, then the library's `ground`, whose body is
// the ground's work. The dock opens next on them alone, a house whose
// beings are the drawer: a twin for each faculty entry, a being for each
// house and one for each secret. Its steward stands the ladder and opens
// every house through the `ground` faculty, so a broken ladder is always
// mended. The hand goes up last and down first. The ground keeps nothing
// but the living bodies and the open houses, and closes a house through
// the views it handed it, never asking it.
import type { Json } from '../being/being.ts';
import { blueprintOf, type Blueprint } from '../being/need.ts';
import { s, type Schema } from '../being/schema.ts';
import { offered } from '../being/table.ts';
import { JoinedCarry } from '../bodies/joined-carry.ts';
import { NobleCrypto } from '../bodies/noble-crypto.ts';
import { SeedKeys } from '../bodies/seed-keys.ts';
import { StrictTools } from '../bodies/strict-tools.ts';
import { WebClock } from '../bodies/web-clock.ts';
import type { Handler } from '../bodies/web-carry.ts';
import type { Carry, Classes, Clock, Crypto, Memory, Tools } from '../foundation.ts';
import { openHouse, type Answer, type FacultyContext, type Offer, type Opened, type OpenedContext } from '../house/house.ts';
import { DOCK, dockClasses, GroundNeed, IDS, KINDS, ListenerNeed } from './dock.ts';
import { HouseCarry, HouseClock, LadderCarry, SealedMemory, ViewMemory } from './views.ts';

/** A door, as a carry hooks it. */
export type Door = (box: Uint8Array) => Promise<Uint8Array | null>;

/** The ground's one key, kept outside it by its host. */
export interface Unlock {
  /** Sixty-four lowercase hex digits: drawn and kept where none is kept yet. */
  key(): Promise<string>;
}

/** A carry the ground hooks doors to, and unhooks them from. */
export interface Hooked extends Carry {
  listen(options: { ward: string; door: Door }): void | Promise<void>;
  unlisten(options: { ward: string }): void;
}

/**
 * The contract a body fills: the primordial, the unlock, the memory,
 * crypto, tools, the ground's work and the hand, then what every house
 * receives.
 */
export type Serves = 'unlock' | 'memory' | 'crypto' | 'tools' | 'ground' | 'hand' | 'carry' | 'clock' | 'classes';

/** What a faculty's `up` and `install` receive: its name, its args, its secrets, its sealed memory, and the bodies it calls. */
export interface Up {
  readonly name: string;
  readonly args: Readonly<Record<string, Json>>;
  readonly secrets: Readonly<Record<string, string>>;
  readonly memory: Memory;
  /** The object of each body its entry names in `faculties`. */
  readonly faculties: Readonly<Record<string, object>>;
}

/** What one house receives of a foundation body: the house's name, and the args its entry holds. */
export interface ForHouse {
  readonly house: string;
  readonly args: Readonly<Record<string, Json>>;
}

/**
 * A faculty stood: the living instance houses and bodies use. Each part
 * where it has one: an offer to beings, a handler for the listener, a
 * registry for the rungs above it, the contract it serves, and what it
 * lets go of when it goes down.
 */
export interface Body {
  readonly blueprint?: unknown;
  readonly object?: object;
  /** How long the body remembers a call id, in milliseconds. */
  readonly window?: number;
  readonly handler?: Handler;
  readonly registry?: Registry;
  readonly serves?: Serves;
  /** The schemes of the addresses a carry body speaks. */
  readonly schemes?: readonly string[];
  /** The port its listener holds once it is up, which its twin keeps as a cell. */
  readonly port?: number;
  /** What one house receives of a body serving `memory` or `classes`. */
  house?(options: ForHouse): unknown;
  /** Told when a house it is offered to opens, with the context that calls its tokens there. */
  opened?(context: OpenedContext): void | Promise<void>;
  down?(): void | Promise<void>;
}

/**
 * What a faculty takes: the args of its entry, held to a schema in the
 * house's subset, and each secret its entry must name, by name with what
 * it holds. An entry that fails it is refused at the hand and stays down
 * at the boot.
 */
export interface Takes {
  readonly args?: Schema;
  readonly secrets?: Readonly<Record<string, string>>;
}

/** Code a registry holds by name: what it takes, `up` raising it into a body, and `install` doing the slow work once for each entry. */
export interface Faculty {
  readonly takes?: Takes;
  install?(made: Up): void | Promise<void>;
  up(made: Up): Body | Promise<Body>;
}

/** Code that holds faculties by name. */
export interface Registry {
  readonly faculties?: Readonly<Record<string, Faculty>>;
}

const NONE = { args: s.object({}) } as const;

/** The faculties every terrain holds: the library's crypto, tools, and the clock of every web engine. */
const libraryRegistry: Registry = {
  faculties: {
    noble: { takes: NONE, up: () => ({ serves: 'crypto', object: new NobleCrypto() }) },
    strict: { takes: NONE, up: () => ({ serves: 'tools', object: new StrictTools() }) },
    clock: { takes: NONE, up: () => ({ serves: 'clock', object: new WebClock() }) },
  },
};

/**
 * Registries joined as one rung, the first first. A name one holds is
 * refused to the next, never replaced. No entry exports it; every shipped
 * ground joins its first rung with it.
 */
export const joinedRegistry = (...registries: readonly Registry[]): Registry => {
  const faculties: Record<string, Faculty> = {};
  for (const registry of registries) {
    for (const [name, faculty] of Object.entries(registry.faculties ?? {})) {
      if (Object.hasOwn(faculties, name)) throw new TypeError(`the registry names a faculty ${name}, which the ground holds already`);
      faculties[name] = faculty;
    }
  }
  return { faculties };
};

/** One foundation body a house names: the faculty that serves it, and the args it hands this house. */
export interface BodyNamed {
  readonly faculty: string;
  readonly [argument: string]: Json | undefined;
}

/** One house's entry: its code, its memory where it takes one, its faculties, and its bound on every ask. */
export interface Entry {
  readonly classes: BodyNamed;
  readonly memory?: BodyNamed;
  readonly faculties?: readonly string[];
  readonly wait?: number;
}

/** One faculty's entry: where it stands, what it is handed, the bodies it calls, and its grant. */
export interface FacultyEntry {
  readonly make?: string;
  readonly from?: string;
  readonly args?: Readonly<Record<string, Json>>;
  readonly secrets?: readonly string[];
  readonly faculties?: readonly string[];
  readonly kinds?: readonly string[];
}

/** A house as the ground holds it: open with its ward, or closed and why. */
export interface Standing {
  readonly name: string;
  readonly entry: Entry;
  readonly ward?: string;
  readonly why?: string;
}

/**
 * What the ground's hand takes, as every terrain serves it: `describe`, or
 * an ask as `root` of a being, in the house it names or in the dock where
 * it names none. With no id, the house's steward is asked.
 */
export interface HandAsk {
  readonly describe?: true;
  readonly house?: string;
  readonly id?: string;
  readonly method?: string;
  readonly args?: Json;
  /** The answer the owner holds, which makes a `readOnly` ask a watch. */
  readonly after?: Answer;
  /** Her cells read, and nothing asked. */
  readonly cells?: true;
  /** The call's id: the same id asked again answers what the first answered, and runs nothing twice. */
  readonly call?: string;
}

/** What the ground's hand shows its owner: the dock's asks, every body of the ladder, and every house. */
export interface Described {
  readonly dock: Json;
  readonly faculties: Readonly<Record<string, Json>>;
  readonly houses: readonly Standing[];
}

/** The entries the host names, raised on the terrain's args around the dock: the memory, the unlock, crypto, tools and the clock before it, and the hand after it. */
export interface Primordial {
  readonly unlock: FacultyEntry;
  readonly memory: FacultyEntry;
  readonly crypto: FacultyEntry;
  readonly tools: FacultyEntry;
  /** The ground's one clock, which the dock and every house receive. */
  readonly clock: FacultyEntry;
  /** Where the owner reaches the hand: a socket, a key, a channel. It names `ground` in its faculties. */
  readonly hand?: FacultyEntry;
}

/** What `Ground.open` takes, all of it the host's. */
export interface GroundOptions {
  /** The ladder's first rung: the terrain's faculties, and whatever the host installs beside them. */
  readonly registry: Registry;
  readonly primordial: Primordial;
  /** The terrain's default entries; an entry the owner lands under the same name stands in its place. */
  readonly entries?: Readonly<Record<string, FacultyEntry>>;
  /** The terrain's bound on every ask of every house, in milliseconds; the one the owner sets through the dock stands in its place. */
  readonly wait?: number;
  /**
   * A ground woken per event opens a house only when something reaches it:
   * a box for its ward, or the hand. A house whose ward it never learned
   * opens at the boot. `wake()` opens every one. The dock opens at every
   * boot all the same.
   */
  readonly lazy?: boolean;
}

// What a house's entry names for its memory and its code, and what every house receives.
const FOR_HOUSES = new Set<Serves>(['memory', 'classes']);
const EVERY_HOUSE = new Set<Serves>(['carry']);
const PRIMORDIAL = new Set<Serves>(['unlock', 'crypto', 'tools', 'clock', 'ground', 'hand']);
/** The library's own faculties: the ground's work, which the host never names, and the ground's one listener. */
const GROUND = 'ground';
const LISTENER = 'listener';

// A foundation body's args for one house: everything its part of the entry names but the faculty.
const argsOf = ({ faculty: _faculty, ...args }: BodyNamed): Readonly<Record<string, Json>> => args as Readonly<Record<string, Json>>;

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

// The memory a primordial faculty receives: none, since the dock is not open yet.
const unopened: Memory = {
  read: () => Promise.reject(new Error('a primordial faculty keeps nothing')),
  list: () => Promise.reject(new Error('a primordial faculty keeps nothing')),
  write: () => Promise.reject(new Error('a primordial faculty keeps nothing')),
};

interface Held {
  readonly entry: Entry;
  readonly opened?: Opened;
  readonly clock?: HouseClock;
  readonly carry?: HouseCarry;
  /** The bound it opened on, which a move of the bound opens it again for. */
  readonly bound?: number;
  /** The carry its door was hooked to, which closing unhooks it from. */
  readonly hooked?: Hooked;
  readonly why?: string;
  /** The door's and the hand's calls on it not yet ended, which closing waits for. */
  readonly flight?: Set<Promise<unknown>>;
  /** Its ward, where it stands closed until something reaches it. */
  readonly asleep?: string;
}

/** The dock as the ground holds it: open from the boot to the close, its door hooked to each carry the ladder stands. */
interface Docked {
  readonly opened: Opened;
  readonly clock: HouseClock;
  readonly carry: HouseCarry;
  readonly flight: Set<Promise<unknown>>;
  hooked?: Hooked;
}

/** A body of the ladder as the ground holds it: standing, or down and why. */
interface Stood {
  readonly entry: FacultyEntry;
  readonly body?: Body;
  readonly why?: string;
}

// One primordial body raised on its entry, filling the contract it names, or the reason the ground cannot open.
const primordial = async (registry: Registry, role: Serves, entry: FacultyEntry, raised: ReadonlyMap<string, Body>): Promise<Body> => {
  const faculty = entry.make === undefined ? undefined : registry.faculties?.[entry.make];
  if (faculty === undefined) throw new Error(`no faculty ${entry.make} in the ground’s registry for its ${role}`);
  // The tools are not up yet, so the library's own check holds its args.
  const why = faculty.takes?.args === undefined ? null : new StrictTools().check(faculty.takes.args, entry.args ?? {});
  if (why !== null) throw new TypeError(`the faculty ${entry.make} is refused for its ${role}: ${why.replace(/^the value/, 'its args')}`);
  const faculties: Record<string, object> = {};
  for (const callee of entry.faculties ?? []) {
    const object = raised.get(callee)?.object;
    if (object === undefined) throw new Error(`the ${role} calls ${callee}, which stands before it nowhere`);
    faculties[callee] = object;
  }
  const made: Up = { name: role, args: entry.args ?? {}, secrets: {}, memory: unopened, faculties };
  await faculty.install?.(made);
  const body = await faculty.up(made);
  if (body.serves !== role || (body.object === undefined && role !== 'hand')) {
    await body.down?.();
    throw new Error(`the faculty ${entry.make} serves no ${role}`);
  }
  return body;
};

export class Ground {
  readonly #options: GroundOptions;
  readonly #registry: Registry;
  #memory!: Memory;
  #crypto!: Crypto;
  #tools!: Tools;
  #keys!: SeedKeys;
  /** The primordial bodies by role, in the order they went up. */
  readonly #primordial = new Map<string, Body>();
  #dock: Docked | undefined;
  readonly #houses = new Map<string, Held>();
  readonly #stood = new Map<string, Stood>();
  /** Each asleep house opening, so two boxes at once open it once. */
  readonly #waking = new Map<string, Promise<unknown>>();

  private constructor(options: GroundOptions) {
    this.#options = options;
    // The library's own faculties first: the ground's work and its listener, then the terrain's and the host's.
    this.#registry = joinedRegistry(
      {
        faculties: {
          [GROUND]: { takes: NONE, up: () => ({ serves: 'ground', blueprint: GroundNeed, object: this.#work() }) },
          [LISTENER]: { takes: NONE, up: () => ({ blueprint: ListenerNeed, object: this.handler }) },
        },
      },
      libraryRegistry,
      options.registry,
    );
  }

  /**
   * A ground opened on its host's registry and entries: the primordial
   * bodies go up, the dock opens on them and stands the ladder and every
   * house, and the hand goes up.
   */
  static async open(options: GroundOptions): Promise<Ground> {
    const ground = new Ground(options);
    try {
      await ground.#boot();
    } catch (error) {
      await ground.close();
      throw error;
    }
    return ground;
  }

  async #boot(): Promise<void> {
    const { primordial: host } = this.#options;
    // The memory first, so a lock it takes holds before the key is drawn.
    for (const [role, entry] of [
      ['memory', host.memory],
      ['unlock', host.unlock],
      ['crypto', host.crypto],
      ['tools', host.tools],
      ['clock', host.clock],
    ] as const) {
      this.#primordial.set(role, await primordial(this.#registry, role, entry, this.#primordial));
    }
    this.#memory = this.#primordial.get('memory')!.object as Memory;
    this.#crypto = this.#primordial.get('crypto')!.object as Crypto;
    this.#tools = this.#primordial.get('tools')!.object as Tools;
    this.#keys = new SeedKeys(await (this.#primordial.get('unlock')!.object as Unlock).key(), this.#crypto);
    this.#primordial.set('ground', await primordial(this.#registry, 'ground', { make: GROUND }, this.#primordial));
    await this.#openDock();
    const booted = await this.#counted(this.#dock!, this.#dock!.opened.ask({ method: 'boot' }));
    if ('error' in booted) throw new Error(`the dock did not boot: ${booted.error.message}`);
    await this.#grantDock();
    if (host.hand !== undefined) this.#primordial.set('hand', await primordial(this.#registry, 'hand', host.hand, this.#primordial));
  }

  // ---- the dock ----

  // The dock opened on the primordial bodies alone: its seed derived from the ground's key, its places in a view of the ground's memory, and the ladder's carry and clock as they come to stand.
  async #openDock(granted: readonly Offer[] = []): Promise<void> {
    const memory = new ViewMemory(this.#memory, await this.#prefix(DOCK, DOCK));
    // A memory that holds places and no dock this key opens holds another ground's, which this key does not open.
    if ((await memory.list()).length === 0 && (await this.#memory.list()).length > 0) throw new Error('this memory holds no drawer this key opens');
    const clock = new HouseClock(this.#clock(), DOCK);
    const carry = new HouseCarry(new LadderCarry(() => this.#carry()));
    const work = this.#primordial.get('ground')!.object!;
    const offers: Offer[] = [{ blueprint: GroundNeed, object: work, kinds: [KINDS.steward, KINDS.faculty, KINDS.house] }, ...granted];
    const opened = await openHouse(
      {
        keys: new SeedKeys(this.#tools.hex(await this.#keys.derive('dock', 32)), this.#crypto),
        memory,
        classes: dockClasses(),
        carry,
        clock,
        crypto: this.#crypto,
        tools: this.#tools,
      },
      offers,
    );
    this.#dock = { opened, clock, carry, flight: new Set() };
  }

  /**
   * The dock opened again on each body its steward stands on, offered as
   * any body is offered to a house, with the kinds its twin's entry grants:
   * the terrain's shell, where it stands. The being that holds the offer is
   * borne then.
   */
  async #grantDock(): Promise<void> {
    const dock = this.#dock!;
    const read = await this.#counted(dock, dock.opened.ask({ method: 'grants' }));
    const names = 'result' in read ? (read.result as string[]) : [];
    const granted = this.#offers({ classes: { faculty: '' }, faculties: names.filter((name) => this.#stood.get(name)?.body !== undefined) });
    if (typeof granted === 'string' || granted.length === 0) return;
    await this.#counted(dock, dock.opened.ask({ method: 'housesList' }));
    await this.#closeDock();
    await this.#openDock(granted);
    // The dock opened again hooks its door to the carries the ladder stands, as the first did.
    await this.#hookDock();
    const born = await this.#counted(this.#dock!, this.#dock!.opened.ask({ method: 'granted' }));
    if ('error' in born) throw new Error(`the dock did not take its grants: ${born.error.message}`);
  }

  // The dock's door hooked to the carries standing now, and unhooked from those it held.
  async #hookDock(): Promise<void> {
    const dock = this.#dock;
    if (dock === undefined) return;
    dock.hooked?.unlisten({ ward: dock.opened.ward });
    dock.hooked = undefined;
    const carry = this.#carry();
    if (typeof carry === 'string') return;
    await carry.listen({ ward: dock.opened.ward, door: (box) => this.#dockDoor(box) });
    dock.hooked = carry;
  }

  #dockDoor(box: Uint8Array): Promise<Uint8Array | null> {
    const dock = this.#dock;
    return dock === undefined ? Promise.resolve(null) : this.#counted(dock, dock.opened.door(box));
  }

  async #closeDock(): Promise<void> {
    const dock = this.#dock;
    if (dock === undefined) return;
    this.#dock = undefined;
    dock.hooked?.unlisten({ ward: dock.opened.ward });
    dock.carry.close();
    dock.clock.close();
    await Promise.allSettled([...dock.flight]);
  }

  // A prefix of the ground's memory for one house, one faculty or the dock: a digest of its name, which says nothing of it.
  async #prefix(of: 'house' | 'faculty' | typeof DOCK, name: string): Promise<string> {
    const names = await this.#keys.derive('view-names', 32);
    const digest = await this.#crypto.sha256(new Uint8Array([...names, ...this.#tools.utf8(`${of}\n${name}`)]));
    return `${this.#tools.hex(digest.subarray(0, 8))}/`;
  }

  // A secret's value, read from its being's cells as the dock's own code, or nothing where none is kept.
  async #secret(name: string): Promise<string | undefined> {
    const dock = this.#dock;
    if (dock === undefined) return undefined;
    const read = await dock.opened.ask({ id: IDS.secret + name, cells: true });
    return 'result' in read && typeof (read.result as { value?: unknown }).value === 'string' ? (read.result as { value: string }).value : undefined;
  }

  // The bound every house opens on where the steward names none: the one in her cells, or the terrain's.
  async #bound(): Promise<number | undefined> {
    const read = this.#dock === undefined ? null : await this.#dock.opened.ask({ cells: true });
    const wait = read !== null && 'result' in read ? (read.result as { wait?: unknown }).wait : undefined;
    return typeof wait === 'number' ? wait : this.#options.wait;
  }

  // ---- the ground's work, as its faculty offers it to the dock ----

  #work(): object {
    const answered =
      <A>(run: (args: A) => unknown) =>
      async (args: A): Promise<Answer> => {
        try {
          return { result: ((await run(args)) ?? null) as Json };
        } catch (error) {
          return { error: { message: message(error) } };
        }
      };
    return {
      terrain: answered(() => ({
        entries: (this.#options.entries ?? {}) as unknown as Json,
        primordial: {
          ...Object.fromEntries(Object.entries(this.#options.primordial).map(([role, entry]) => [role, (entry as FacultyEntry).make ?? ''])),
          [GROUND]: GROUND,
        },
        lazy: this.#options.lazy === true,
        ...(this.#options.wait === undefined ? {} : { wait: this.#options.wait }),
      })),
      check: answered(({ entry }: { entry: FacultyEntry }) => {
        const registry = entry.from === undefined ? this.#registry : this.#stood.get(entry.from)?.body?.registry;
        const faculty = entry.make === undefined ? undefined : registry?.faculties?.[entry.make];
        const why = faculty === undefined ? undefined : this.#untaken(faculty, entry);
        return why === undefined ? {} : { why };
      }),
      raise: answered(({ name, entry, installed }: { name: string; entry: FacultyEntry; installed?: string }) => this.#raise(name, entry, installed)),
      lower: answered(({ name, why }: { name: string; why?: string }) => this.#lower(name, why)),
      open: answered(({ name, entry, seed, bound }: { name: string; entry: Entry; seed: string; bound?: number }) => this.#openHouse(name, entry, seed, bound)),
      close: answered(({ name, why }: { name: string; why?: string }) => this.#closeHouse(name, why)),
      sleep: answered(({ name, entry, ward }: { name: string; entry: Entry; ward: string }) => this.#sleep(name, entry, ward)),
      catalog: answered(() => this.#catalog()),
      call: answered((call: { faculty: string; method: string; args?: Json }) => this.#callFaculty(call)),
      placesOut: answered(({ name, entry }: { name: string; entry: Entry }) => this.#placesOut(name, entry)),
      placesIn: answered(({ name, entry, places }: { name: string; entry: Entry; places: Record<string, Record<string, string>> }) => this.#placesIn(name, entry, places)),
      /** The hand, as a primordial faculty serves it to the owner. It is no method of the blueprint, so no being reaches it. */
      hand: (request: HandAsk) => this.hand(request),
    };
  }

  // ---- the ladder ----

  // A body standing under a name, or why there is none.
  #standing(name: string): Body | string {
    const stood = this.#stood.get(name);
    if (stood === undefined) return `no faculty ${name} stands here`;
    return stood.body ?? `the faculty ${name} is down: ${stood.why}`;
  }

  // Why an entry fails what its faculty takes: its args against the schema, or a secret it must name and does not.
  #untaken(faculty: Faculty, entry: FacultyEntry): string | undefined {
    const { args, secrets = {} } = faculty.takes ?? {};
    if (args !== undefined) {
      const why = this.#tools.check(args, entry.args ?? {});
      if (why !== null) return why.replace(/^the value/, 'its args');
    }
    for (const [secret, what] of Object.entries(secrets)) {
      if (!(entry.secrets ?? []).includes(secret)) return `its entry names no secret ${secret}, which ${entry.make} takes: ${what}`;
    }
    return undefined;
  }

  // One body raised on its entry, where one stands under the name taken down first: installed where the entry moved, then up, or down and why.
  async #raise(name: string, entry: FacultyEntry, installed: string | undefined): Promise<{ installed?: string; why?: string; serves?: string; port?: number }> {
    await this.#lower(name);
    const now = this.#tools.canonical(entry);
    let done = installed;
    const stood = await (async (): Promise<Stood> => {
      const down = (why: string): Stood => ({ entry, why });
      let registry = this.#registry;
      if (entry.from !== undefined) {
        const below = this.#standing(entry.from);
        if (typeof below === 'string') return down(`its registry: ${below}`);
        if (below.registry === undefined) return down(`the faculty ${entry.from} carries no registry`);
        registry = below.registry;
      }
      const faculty = entry.make === undefined ? undefined : registry.faculties?.[entry.make];
      if (faculty === undefined) return down(`no faculty ${entry.make} in ${entry.from ?? 'the ground’s registry'}`);
      const refused = this.#untaken(faculty, entry);
      if (refused !== undefined) return down(refused);
      const secrets: Record<string, string> = {};
      for (const secret of entry.secrets ?? []) {
        const value = await this.#secret(secret);
        if (value === undefined) return down(`no secret ${secret} is kept`);
        secrets[secret] = value;
      }
      const faculties: Record<string, object> = {};
      for (const callee of entry.faculties ?? []) {
        const called = this.#standing(callee);
        if (typeof called === 'string') return down(called);
        if (called.object === undefined) return down(`the faculty ${callee} offers no object to call`);
        faculties[callee] = called.object;
      }
      let raised: Body | undefined;
      try {
        const memory = new SealedMemory(new ViewMemory(this.#memory, await this.#prefix('faculty', name)), await this.#keys.derive(`faculty:${name}`, 32), this.#crypto, this.#tools);
        const made: Up = { name, args: entry.args ?? {}, secrets, memory, faculties };
        if (installed !== now) {
          await faculty.install?.(made);
          done = now;
        }
        raised = await faculty.up(made);
        const why = this.#refused(name, raised);
        if (why !== undefined) {
          await raised.down?.();
          return down(why);
        }
        return { entry, body: raised };
      } catch (error) {
        // A body raised and then refused lets go of what its `up` opened.
        await raised?.down?.();
        return down(`it did not stand: ${message(error)}`);
      }
    })();
    this.#stood.set(name, stood);
    await this.#hookDock();
    return { ...(done === undefined ? {} : { installed: done }), ...(stood.why === undefined ? {} : { why: stood.why }), ...(stood.body?.serves === undefined ? {} : { serves: stood.body.serves }), ...(stood.body?.port === undefined ? {} : { port: stood.body.port }) };
  }

  // A body taken down: it stands down with why where one is given, and is gone where none is.
  async #lower(name: string, why?: string): Promise<void> {
    const stood = this.#stood.get(name);
    if (why === undefined) this.#stood.delete(name);
    else if (stood !== undefined) this.#stood.set(name, { entry: stood.entry, why });
    await stood?.body?.down?.();
    if (stood?.body?.serves === 'carry') await this.#hookDock();
  }

  // What a raised body may not be: an offer half made, a contract filled wrong, or a primordial one.
  #refused(name: string, raised: Body): string | undefined {
    if ((raised.blueprint === undefined) !== (raised.object === undefined) && raised.serves === undefined) return 'a body offers a blueprint and an object together, or neither';
    if (raised.blueprint !== undefined) offered(raised.blueprint, `the faculty ${name}`);
    if (raised.serves === undefined) return undefined;
    if (raised.blueprint !== undefined) return 'a body serves the house or offers beings, never both';
    if (PRIMORDIAL.has(raised.serves)) return `the ${raised.serves} is primordial, and the drawer names none`;
    if (FOR_HOUSES.has(raised.serves) && typeof raised.house !== 'function') return `a body serving ${raised.serves} serves each house through house()`;
    if (raised.serves === 'memory' && raised.object !== undefined) return 'the ground’s memory is primordial, and the drawer names none';
    if (EVERY_HOUSE.has(raised.serves) && raised.object === undefined) return `a body serving the ${raised.serves} holds it as its object`;
    if (raised.serves === 'carry' && (raised.schemes === undefined || raised.schemes.length === 0)) return 'a carry names the schemes it speaks';
    return undefined;
  }

  // ---- houses ----

  // The ground's carries joined by scheme, or why there is none.
  #carry(): (Hooked & Carry) | string {
    const bySchemes: Record<string, Carry> = {};
    for (const stood of this.#stood.values()) {
      if (stood.body?.serves !== 'carry') continue;
      for (const scheme of stood.body.schemes ?? []) bySchemes[scheme] = stood.body.object as Carry;
    }
    if (Object.keys(bySchemes).length === 0) return 'no body serves the carry';
    return new JoinedCarry(bySchemes);
  }

  // The ground's one clock, a primordial body.
  #clock(): Clock {
    return this.#primordial.get('clock')!.object as Clock;
  }

  // What a house is offered: the faculties its entry names, each with the kinds its own entry grants.
  #offers(entry: Entry): Offer[] | string {
    const offers: Offer[] = [];
    for (const name of entry.faculties ?? []) {
      const stood = this.#standing(name);
      if (typeof stood === 'string') return stood;
      const { blueprint, object, window } = stood;
      if (blueprint === undefined || object === undefined) return `the faculty ${name} offers beings nothing`;
      const kinds = this.#stood.get(name)?.entry.kinds;
      offers.push({
        blueprint,
        object,
        ...(window === undefined ? {} : { window }),
        ...(kinds === undefined ? {} : { kinds }),
        ...(stood.opened === undefined ? {} : { opened: stood.opened.bind(stood) }),
      });
    }
    return offers;
  }

  // What a foundation body serves one house, or why it serves it nothing.
  async #served<T>(named: BodyNamed, serves: 'memory' | 'classes', house: string): Promise<T> {
    const stood = this.#standing(named.faculty);
    if (typeof stood === 'string') throw new Error(stood);
    if (stood.serves !== serves || stood.house === undefined) throw new Error(`the faculty ${named.faculty} serves no ${serves}`);
    return (await stood.house({ house, args: argsOf(named) })) as T;
  }

  // The memory a house keeps its places in: what the body its entry names serves it, or its view of the ground's.
  async #houseMemory(name: string, entry: Entry): Promise<Memory> {
    if (entry.memory === undefined) return new ViewMemory(this.#memory, await this.#prefix('house', name));
    return this.#served<Memory>(entry.memory, 'memory', name);
  }

  // One house opened on the bodies its entry names, or closed and why.
  async #open(name: string, entry: Entry, seed: string, bound: number | undefined): Promise<Held> {
    try {
      const offers = this.#offers(entry);
      if (typeof offers === 'string') return { entry, why: offers };
      const hooked = this.#carry();
      if (typeof hooked === 'string') return { entry, why: hooked };
      const ticking = this.#clock();
      const memory = await this.#houseMemory(name, entry);
      const classes = await this.#served<Classes>(entry.classes, 'classes', name);
      const clock = new HouseClock(ticking, name);
      const carry = new HouseCarry(hooked);
      const wait = entry.wait === undefined ? bound : bound === undefined ? entry.wait : Math.min(entry.wait, bound);
      const opened = await openHouse(
        { keys: new SeedKeys(seed, this.#crypto), memory, classes, carry, clock, crypto: this.#crypto, tools: this.#tools },
        offers,
        wait === undefined ? {} : { wait },
      );
      await hooked.listen({ ward: opened.ward, door: (box) => this.#door(name, box) });
      return { entry, opened, clock, carry, hooked, flight: new Set(), ...(bound === undefined ? {} : { bound }) };
    } catch (error) {
      return { entry, why: message(error) };
    }
  }

  // A house opened on its entry where it is not open on it and its bound: what it held closed first.
  async #openHouse(name: string, entry: Entry, seed: string, given: number | undefined): Promise<{ ward?: string; why?: string }> {
    const bound = given ?? (await this.#bound());
    const held = this.#houses.get(name);
    if (held?.opened !== undefined && this.#tools.canonical(held.entry) === this.#tools.canonical(entry) && held.bound === bound) return { ward: held.opened.ward };
    if (held !== undefined) {
      this.#houses.set(name, { entry: held.entry, why: 'it is opening again' });
      await this.#close(held);
    }
    const opened = await this.#open(name, entry, seed, bound);
    this.#houses.set(name, opened);
    return opened.opened === undefined ? { why: opened.why ?? 'it did not open' } : { ward: opened.opened.ward };
  }

  // A house closed through its views: it stands closed with why where one is given, and is gone where none is.
  async #closeHouse(name: string, why: string | undefined): Promise<void> {
    const held = this.#houses.get(name);
    if (held === undefined) return;
    if (why === undefined) this.#houses.delete(name);
    else this.#houses.set(name, { entry: held.entry, why });
    await this.#close(held);
  }

  // A house held closed until something reaches it, its door hooked unopened: the first box opens it, then goes in.
  async #sleep(name: string, entry: Entry, ward: string): Promise<void> {
    const carry = this.#carry();
    if (typeof carry === 'string') {
      this.#houses.set(name, { entry, why: carry });
      return;
    }
    this.#houses.set(name, { entry, asleep: ward, hooked: carry });
    await carry.listen({ ward, door: (box) => this.#door(name, box) });
  }

  // A house that stands closed until something reaches it, opened once through its being in the dock.
  async #woken(name: string): Promise<Held | undefined> {
    const held = this.#houses.get(name);
    if (held?.asleep === undefined || this.#dock === undefined) return held;
    let waking = this.#waking.get(name);
    if (waking === undefined) {
      waking = this.#counted(this.#dock, this.#dock.opened.ask({ id: IDS.house + name, method: 'open', args: {} }));
      this.#waking.set(name, waking);
      void waking.finally(() => this.#waking.delete(name));
    }
    await waking;
    return this.#houses.get(name);
  }

  /** Every house that stands closed until reached, opened now, as a wake by alarm needs: each arms its own times again. */
  async wake(): Promise<void> {
    await Promise.all([...this.#houses.keys()].map((name) => this.#woken(name)));
    // A clock that keeps its waits in a platform's alarm ends each one due.
    await (this.#clock() as Clock & { alarm?: () => Promise<void> }).alarm?.();
  }

  // A box for a house the ground still holds open, and nothing for one it closed.
  async #door(name: string, box: Uint8Array): Promise<Uint8Array | null> {
    const held = await this.#woken(name);
    return held?.opened === undefined ? null : this.#counted(held, held.opened.door(box));
  }

  // A call on a house, in flight until it ends, so closing the house waits for it.
  #counted<T>(held: { readonly flight?: Set<Promise<unknown>> }, call: Promise<T>): Promise<T> {
    held.flight?.add(call);
    const done = () => void held.flight?.delete(call);
    call.then(done, done);
    return call;
  }

  // Its door unhooked, its sends stopped and its waits run out, then every call in flight on it ended.
  async #close(held: Held): Promise<void> {
    const ward = held.opened?.ward ?? held.asleep;
    if (ward !== undefined) held.hooked?.unlisten({ ward });
    held.carry?.close();
    held.clock?.close();
    await Promise.allSettled([...(held.flight ?? [])]);
  }

  // Every place of a house's memory, each entry's bytes as hex.
  async #placesOut(name: string, entry: Entry): Promise<{ places: Record<string, Record<string, string>> }> {
    const store = await this.#houseMemory(name, entry);
    const places: Record<string, Record<string, string>> = {};
    for (const place of await store.list()) {
      const { entries } = await store.read({ place });
      places[place] = Object.fromEntries(Object.entries(entries).map(([key, bytes]) => [key, this.#tools.hex(bytes)]));
    }
    return { places };
  }

  // Places written into a house's memory that holds none: with none given, only whether it holds none.
  async #placesIn(name: string, entry: Entry, places: Record<string, Record<string, string>>): Promise<void> {
    const store = await this.#houseMemory(name, entry);
    if ((await store.list()).length > 0) throw new Error(`the memory for ${name} holds places already`);
    const writes: Record<string, Record<string, Uint8Array | null>> = {};
    for (const [place, entries] of Object.entries(places)) {
      writes[place] = Object.fromEntries(
        Object.entries(entries).map(([key, text]) => {
          const bytes = this.#tools.bytes(text);
          if (bytes === null) throw new TypeError(`the place ${place} holds no hex under ${key}`);
          return [key, bytes];
        }),
      );
    }
    if (Object.keys(writes).length === 0) return;
    if ((await store.write({ writes, expect: Object.fromEntries(Object.keys(writes).map((place) => [place, null])) })) === null) throw new Error(`the memory for ${name} refused the places`);
  }

  /** Every house of the dock, open with its ward, or closed and why. The dock is none of them. */
  list(): readonly Standing[] {
    return [...this.#houses].map(([name, held]) => ({
      name,
      entry: held.entry,
      ...(held.opened === undefined ? (held.asleep === undefined ? {} : { ward: held.asleep }) : { ward: held.opened.ward }),
      ...(held.why === undefined ? {} : { why: held.why }),
    }));
  }

  // One ask of the dock's steward by the hand, answered, or thrown where it refused.
  async #steward(method: string, args: Json): Promise<Json> {
    const answer = await this.hand({ method, args });
    if ('error' in answer) throw new Error(answer.error.message);
    return 'result' in answer ? answer.result : null;
  }

  #standingOf(name: string): Standing {
    const found = this.list().find((standing) => standing.name === name);
    if (found === undefined) throw new Error(`no house ${name} is here`);
    return found;
  }

  /** A house added through the dock and opened, as the hand adds one. */
  async add(name: string, entry: Entry): Promise<Standing> {
    await this.#steward('housesAdd', { name, ...entry } as unknown as Json);
    return this.#standingOf(name);
  }

  /** A new entry landed over a house's through the dock, and the house opened again on it. */
  async update(name: string, entry: Entry): Promise<Standing> {
    await this.#steward('housesUpdate', { name, ...entry } as unknown as Json);
    return this.#standingOf(name);
  }

  /** A house closed and its entry dropped through the dock. Its seed and its places stay. */
  async remove(name: string): Promise<void> {
    await this.#steward('housesRemove', { name });
  }

  /** A body raised through the dock on its entry, answering why it is down where it is. */
  async stand(name: string, entry: FacultyEntry): Promise<{ readonly why?: string }> {
    return (await this.#steward('facultiesAdd', { name, ...entry })) as { why?: string };
  }

  /** A new entry landed over a faculty's through the dock. */
  async restand(name: string, entry: FacultyEntry): Promise<{ readonly why?: string }> {
    return (await this.#steward('facultiesUpdate', { name, ...entry })) as { why?: string };
  }

  /** A body taken down and up again through the dock. */
  async restart(name: string): Promise<{ readonly why?: string }> {
    return (await this.#steward('facultiesRestart', { name })) as { why?: string };
  }

  /** A body taken down and its entry dropped through the dock, where no house and no body uses it. */
  async unstand(name: string): Promise<void> {
    await this.#steward('facultiesRemove', { name });
  }

  /** A being in a house asked as `root`, by her id, or the house's steward where none is named. */
  async ask({ house, ...request }: Omit<HandAsk, 'describe' | 'house'> & { readonly house: string }): Promise<Answer | { readonly describe: Json }> {
    const held = await this.#woken(house);
    if (held?.opened === undefined) return { error: { message: `no house ${house} is open here` } };
    return this.#counted(held, held.opened.ask(request));
  }

  /**
   * The ground's hand, one request at a time, as every terrain serves it:
   * `describe`, or an ask as `root` of a being in the house it names, or of
   * a being of the dock where it names none. It is the one road into the
   * ground: every change is an ask of the dock. A secret's cells are read
   * by no one through it.
   */
  async hand({ describe, house, ...request }: HandAsk): Promise<Answer | { readonly describe: Json }> {
    if (describe === true) return { result: (await this.describe()) as unknown as Json };
    if (house !== undefined) return this.ask({ house, ...request });
    const dock = this.#dock;
    if (dock === undefined) return { error: { message: 'the ground is closed' } };
    if (request.cells === true && request.id?.startsWith(IDS.secret) === true) return { error: { message: 'a secret’s cells are shown to no one' } };
    return this.#counted(dock, dock.opened.ask(request));
  }

  /**
   * What the ground's hand shows its owner: the asks the dock's steward
   * shows `root`, every body of the ladder with its methods, what it serves,
   * or why it is down, each method's description, args, result and hints,
   * and every house. A face reads it and needs no code of its own for any
   * of them.
   */
  async describe(): Promise<Described> {
    const shown = (value: unknown): Json => {
      const blueprint = blueprintOf(value) ?? (value as Blueprint);
      return {
        blueprint: blueprint.name,
        methods: Object.fromEntries(
          Object.entries(blueprint.methods).map(([method, spec]) => [method, JSON.parse(JSON.stringify({ description: spec.description, args: spec.args, result: spec.result, hints: spec.hints })) as Json]),
        ),
      };
    };
    const faculties: Record<string, Json> = {};
    for (const [name, stood] of this.#stood) {
      if (stood.body === undefined) faculties[name] = { why: stood.why ?? 'down' };
      else if (stood.body.serves !== undefined) faculties[name] = { serves: stood.body.serves, methods: {} };
      else faculties[name] = stood.body.blueprint === undefined ? { methods: {} } : shown(stood.body.blueprint);
    }
    const read = this.#dock === undefined ? null : await this.#dock.opened.ask({});
    return { dock: read !== null && 'describe' in read ? read.describe : null, faculties, houses: this.list() };
  }

  // A method of a body of the ladder called by name, its args held to the method's schema. It holds no token of any house, so a call it makes back answers an error.
  async #callFaculty({ faculty: name, method, args = {} }: { faculty: string; method: string; args?: Json }): Promise<Json> {
    const stood = this.#standing(name);
    if (typeof stood === 'string') throw new Error(stood);
    if (stood.blueprint === undefined || stood.object === undefined) throw new Error(`${name} offers no methods`);
    const blueprint = blueprintOf(stood.blueprint) ?? (stood.blueprint as Blueprint);
    const spec = blueprint.methods[method];
    const run = (stood.object as Record<string, unknown>)[method];
    if (spec === undefined || typeof run !== 'function') throw new Error(`${name} has no method ${method}`);
    const why = this.#tools.check(spec.args, args);
    if (why !== null) throw new Error(why);
    const context: FacultyContext = {
      id: this.#tools.hex(this.#crypto.random(16)),
      call: () => Promise.resolve({ error: { message: 'the hand holds no token' } }),
      describe: () => Promise.resolve({ error: { message: 'the hand holds no token' } }),
    };
    const answered = (await (run as (args: Json, context: FacultyContext) => Promise<unknown>).call(stood.object, args, context)) as Answer;
    if (typeof answered !== 'object' || answered === null || !('result' in answered || 'error' in answered)) throw new Error(`${name} answered no answer`);
    if ('error' in answered) throw new Error(answered.error.message);
    return answered.result;
  }

  /**
   * The one handler the ground's listener chains: the hand's where it
   * serves one, then each standing body's in the ladder's order, read as
   * each request arrives, so a body raised while the ground runs is served
   * at once.
   */
  readonly handler: Handler = {
    fetch: async (request) => {
      for (const handler of this.#handlers()) {
        const response = await handler.fetch(request);
        if (response !== null) return response;
      }
      return null;
    },
    upgrade: (request) => {
      for (const handler of this.#handlers()) {
        const taken = handler.upgrade?.(request);
        if (taken !== null && taken !== undefined) return taken;
      }
      return null;
    },
  };

  // The hand's handler, then each standing body's, which opens every house naming the body before it takes a request, so its tokens answer on a ground woken per event.
  #handlers(): readonly Handler[] {
    const hand = this.#primordial.get('hand')?.handler;
    return [
      ...(hand === undefined ? [] : [hand]),
      ...[...this.#stood].flatMap(([name, stood]) => {
        const handler = stood.body?.handler;
        if (handler === undefined) return [];
        const naming = () => Promise.all([...this.#houses].flatMap(([house, held]) => ((held.entry.faculties ?? []).includes(name) ? [this.#woken(house)] : [])));
        return [
          {
            fetch: async (request: Request) => {
              await naming();
              return handler.fetch(request);
            },
            upgrade: (request: Request) => {
              void naming();
              return handler.upgrade?.(request) ?? null;
            },
          },
        ];
      }),
    ];
  }

  /** The hand down first, then every house closed through its views, the dock, every body in the reverse of the ladder, and the primordial last. */
  async close(): Promise<void> {
    const hand = this.#primordial.get('hand');
    this.#primordial.delete('hand');
    await hand?.down?.();
    // Every being of the dock is read once as her steward reads her, so each first ask a change began has run before the dock's clock closes.
    const dock = this.#dock;
    if (dock !== undefined) await this.#counted(dock, dock.opened.ask({ method: 'housesList' }));
    const held = [...this.#houses.values()].reverse();
    this.#houses.clear();
    for (const one of held) await this.#close(one);
    await this.#closeDock();
    const stood = [...this.#stood.values()].reverse();
    this.#stood.clear();
    for (const one of stood) await one.body?.down?.();
    const primordials = [...this.#primordial.values()].reverse();
    this.#primordial.clear();
    for (const one of primordials) await one.down?.();
  }

  // ---- the catalogue ----

  // Every registry of the ladder, the ground's first, then each standing body's that carries one, with each faculty it holds and what it takes.
  #catalog(): Json {
    const shown = (registry: Registry): Json =>
      Object.entries(registry.faculties ?? {})
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([make, faculty]) => ({ make, ...(faculty.takes === undefined ? {} : { takes: JSON.parse(JSON.stringify(faculty.takes)) as Json }) }));
    const bodies = [...this.#stood].flatMap(([name, stood]) => (stood.body?.registry === undefined ? [] : [{ from: name, faculties: shown(stood.body.registry) }]));
    return [{ faculties: shown(this.#registry) }, ...bodies];
  }
}
