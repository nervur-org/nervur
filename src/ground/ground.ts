// SPDX-License-Identifier: Apache-2.0
// The ground: the process houses run in, on any engine. Every faculty has
// one lifecycle, foundation and custom alike: a registry holds it by name,
// and its `up` raises it into a body. Four are primordial, the unlock, the
// memory, crypto and tools, raised on the host's entries before the drawer
// opens. Every other body stands on the ladder from the terrain's default
// entries and the drawer's, the drawer's winning by name. The drawer holds
// every entry, each house's seed, every secret and each house's ward.
// Houses open on the bodies their entries name, each receiving what a body
// serves it. The ground closes a house through the views it handed it,
// never asking it.
import type { Json } from '../being/being.ts';
import { need, s } from '../being/index.ts';
import { blueprintOf, type Blueprint } from '../being/need.ts';
import { offered } from '../being/table.ts';
import { JoinedCarry } from '../bodies/joined-carry.ts';
import { NobleCrypto } from '../bodies/noble-crypto.ts';
import { SeedKeys } from '../bodies/seed-keys.ts';
import { StrictTools } from '../bodies/strict-tools.ts';
import { WebClock } from '../bodies/web-clock.ts';
import type { Handler } from '../bodies/web-carry.ts';
import type { Carry, Classes, Clock, Crypto, Memory, Tools } from '../foundation.ts';
import { openHouse, type Answer, type FacultyContext, type Offer, type Opened, type OpenedContext } from '../house/house.ts';
import { Rows } from '../house/rows.ts';
import { HouseCarry, HouseClock, SealedMemory, ViewMemory } from './views.ts';

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

/** The foundation contract a body fills: the four primordial, then what every house receives. */
export type Serves = 'unlock' | 'memory' | 'crypto' | 'tools' | 'carry' | 'clock' | 'classes';

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
 * registry for the rungs above it, the foundation contract it serves, and
 * what it lets go of when it goes down.
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
  /** What one house receives of a body serving `memory` or `classes`. */
  house?(options: ForHouse): unknown;
  /** Told when a house it is offered to opens, with the context that calls its tokens there. */
  opened?(context: OpenedContext): void | Promise<void>;
  down?(): void | Promise<void>;
}

/** Code a registry holds by name: `up` raises it into a body, and `install` does the slow work once for each entry. */
export interface Faculty {
  install?(made: Up): void | Promise<void>;
  up(made: Up): Body | Promise<Body>;
}

/** Code that holds faculties by name. */
export interface Registry {
  readonly faculties?: Readonly<Record<string, Faculty>>;
}

/** The faculties every terrain holds: the library's crypto, tools and clock. */
export const libraryRegistry: Registry = {
  faculties: {
    noble: { up: () => ({ serves: 'crypto', object: new NobleCrypto() }) },
    strict: { up: () => ({ serves: 'tools', object: new StrictTools() }) },
    clock: {
      up: () => {
        const clock = new WebClock();
        return { serves: 'clock', object: clock };
      },
    },
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

/** One house in the drawer: its code, its memory where it takes one, its faculties, and its bound on every ask. */
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

/** What the ground's hand takes: a house by name, and the hand's own ask. */
export interface HandAsk {
  readonly house: string;
  readonly id?: string;
  readonly method?: string;
  readonly args?: Json;
  /** The answer the owner holds, which makes a `readOnly` ask a watch. */
  readonly after?: Answer;
  /** Her cells read, and nothing asked. */
  readonly cells?: true;
}

/** The four entries the host names, raised on the terrain's args before the drawer opens. */
export interface Primordial {
  readonly unlock: FacultyEntry;
  readonly memory: FacultyEntry;
  readonly crypto: FacultyEntry;
  readonly tools: FacultyEntry;
}

/** What `Ground.open` takes, all of it the host's. */
export interface GroundOptions {
  /** The ladder's first rung: the terrain's faculties, and whatever the host installs beside them. */
  readonly registry: Registry;
  readonly primordial: Primordial;
  /** The terrain's default entries; an entry of the same name in the drawer stands in its place. */
  readonly entries?: Readonly<Record<string, FacultyEntry>>;
  /** The ground's bound on every ask of every house, in milliseconds. */
  readonly wait?: number;
  /**
   * A ground woken per event opens a house only when something reaches it:
   * a box for its ward, or the hand. A house whose ward it never learned
   * opens at the boot. `wake()` opens every one.
   */
  readonly lazy?: boolean;
}

const HOUSES = 'houses';
const FACULTIES = 'faculties';
const SECRETS = 'secrets';
const MOVES = 'moves';
// The ground's own faculties a being may be granted, by an entry that holds kinds alone.
const GRANTED = new Set([HOUSES, FACULTIES]);
// Those the hand alone reaches.
const HAND_ALONE = new Set([SECRETS, MOVES]);
const OWN = new Set([...GRANTED, ...HAND_ALONE]);
// What a house's entry names for its memory and its code, and what every house receives.
const FOR_HOUSES = new Set<Serves>(['memory', 'classes']);
const EVERY_HOUSE = new Set<Serves>(['carry', 'clock']);
const NAME = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const NAMED = 'lowercase letters, digits, dots, dashes and underscores, at most sixty-four';
const DRAWER = 'drawer';
const body = { type: 'object', properties: { faculty: { type: 'string' } }, required: ['faculty'], additionalProperties: true } as const;
const OBJECT = { type: 'object', properties: {}, additionalProperties: true } as const;
// Every place of a memory, by its name: each entry's bytes as hex.
const PLACES = OBJECT;
const houseArgs = { name: s.string(), classes: body, memory: s.optional(body), faculties: s.optional(s.array(s.string())), wait: s.optional(s.integer({ minimum: 1 })) };
const facultyArgs = {
  name: s.string(),
  make: s.optional(s.string()),
  from: s.optional(s.string()),
  args: s.optional(OBJECT),
  secrets: s.optional(s.array(s.string())),
  faculties: s.optional(s.array(s.string())),
  kinds: s.optional(s.array(s.string())),
};

/** The blueprint of the ground's own faculty for its houses. */
export const HousesBlueprint = need(HOUSES, {
  add: {
    description: 'Opens a house on the bodies its entry names; the same name and entry answer the same ward.',
    args: s.object(houseArgs),
    result: s.object({ ward: s.string() }),
    hints: { idempotent: true },
  },
  update: {
    description: 'Lands a new entry over a house’s in one write, and opens the house again on it.',
    args: s.object(houseArgs),
    result: s.object({ ward: s.string() }),
    hints: { idempotent: true },
  },
  remove: {
    description: 'Closes a house and drops its entry; its seed and its places stay.',
    args: s.object({ name: s.string() }),
    hints: { idempotent: true },
  },
  list: {
    description: 'Every house in the drawer with its whole entry, open with its ward or closed with why.',
    result: s.array(s.object({ name: s.string(), entry: OBJECT, ward: s.optional(s.string()), why: s.optional(s.string()) })),
    hints: { readOnly: true },
  },
});

/** The blueprint of the ground's own faculty for its ladder. */
export const FacultiesBlueprint = need(FACULTIES, {
  add: {
    description: 'Raises a body from the registry its entry names; the same name and entry answer as it stands. An entry for houses or faculties holds kinds alone, and grants it.',
    args: s.object(facultyArgs),
    hints: { idempotent: true },
  },
  update: {
    description: 'Lands a new entry over a faculty’s in one write: its body goes down, installs where the entry moved, and goes up, and each house and body that uses it follows.',
    args: s.object(facultyArgs),
    hints: { idempotent: true },
  },
  restart: {
    description: 'Takes a body down and up again on its entry, and each house and body that uses it follows.',
    args: s.object({ name: s.string() }),
    hints: { idempotent: true },
  },
  remove: {
    description: 'Takes down a body no house and no body uses, and drops its entry.',
    args: s.object({ name: s.string() }),
    hints: { idempotent: true },
  },
  list: {
    description: 'Every faculty entry whole, the terrain’s and the drawer’s, standing, or down with why. An entry names its secrets and holds none.',
    result: s.array(s.object({ name: s.string(), entry: OBJECT, serves: s.optional(s.string()), why: s.optional(s.string()) })),
    hints: { readOnly: true },
  },
});

/** The blueprint of the ground's own faculty for its secrets, which the hand alone calls. */
export const SecretsBlueprint = need(SECRETS, {
  set: {
    description: 'Keeps a secret in the drawer, for the faculties whose entries name it.',
    args: s.object({ name: s.string(), value: s.string() }),
    hints: { idempotent: true },
  },
  remove: {
    description: 'Drops a secret from the drawer.',
    args: s.object({ name: s.string() }),
    hints: { idempotent: true },
  },
  list: {
    description: 'The name of every secret in the drawer, and never a value.',
    result: s.array(s.string()),
    hints: { readOnly: true },
  },
});

/** The blueprint of the ground's own faculty for moving a house, which the hand alone calls. */
export const MovesBlueprint = need(MOVES, {
  out: {
    description: 'Closes a house and drops its entry, and answers its seed and every place of its memory.',
    args: s.object({ name: s.string() }),
    result: s.object({ seed: s.string(), places: PLACES }),
    hints: { destructive: true },
  },
  in: {
    description: 'Keeps a moved seed, writes its places into an empty memory, and opens the house on the bodies its entry names.',
    args: s.object({ ...houseArgs, seed: s.string(), places: PLACES }),
    result: s.object({ ward: s.string() }),
  },
});

/** The drawer's one row: every entry, what each faculty installed, each house's seed, every secret, and each house's ward once it opened. */
interface Drawer {
  readonly houses: Record<string, Entry>;
  readonly faculties: Record<string, FacultyEntry>;
  readonly installed: Record<string, string>;
  readonly seeds: Record<string, string>;
  readonly secrets: Record<string, string>;
  readonly wards: Record<string, string>;
}

const emptyDrawer = (): Drawer => ({ houses: {}, faculties: {}, installed: {}, seeds: {}, secrets: {}, wards: {} });

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isNames = (value: unknown): value is readonly string[] => Array.isArray(value) && value.every((name) => typeof name === 'string');

const bodyOf = (held: unknown, what: string): BodyNamed | string => {
  if (!isObject(held) || typeof held.faculty !== 'string') return `an entry's ${what} names no faculty`;
  return held as BodyNamed;
};

const entryOf = (value: unknown): Entry | string => {
  if (!isObject(value)) return 'an entry is an object';
  const { memory, classes, faculties, wait, ...rest } = value;
  if (Object.keys(rest).length > 0) return `an entry names ${Object.keys(rest).join(', ')}, which no entry holds`;
  const classesNamed = bodyOf(classes, 'classes');
  if (typeof classesNamed === 'string') return classesNamed;
  const memoryNamed = memory === undefined ? undefined : bodyOf(memory, 'memory');
  if (typeof memoryNamed === 'string') return memoryNamed;
  if (faculties !== undefined && !isNames(faculties)) return "an entry's faculties are a list of names";
  if (wait !== undefined && !(Number.isSafeInteger(wait) && (wait as number) > 0)) return "an entry's wait is whole milliseconds above zero";
  return { classes: classesNamed, ...(memoryNamed === undefined ? {} : { memory: memoryNamed }), ...(faculties === undefined ? {} : { faculties }), ...(wait === undefined ? {} : { wait: wait as number }) };
};

const facultyEntryOf = (name: string, value: unknown): FacultyEntry | string => {
  if (HAND_ALONE.has(name)) return `the faculty ${name} is the hand’s alone, and takes no entry`;
  if (!isObject(value)) return 'an entry is an object';
  const { make, from, args, secrets, faculties, kinds, ...rest } = value;
  if (Object.keys(rest).length > 0) return `an entry names ${Object.keys(rest).join(', ')}, which no entry holds`;
  if (kinds !== undefined && !isNames(kinds)) return "an entry's kinds are a list of names";
  if (GRANTED.has(name)) {
    if (make !== undefined || from !== undefined || args !== undefined || secrets !== undefined || faculties !== undefined || kinds === undefined) return `the faculty ${name} is the ground’s own, and its entry holds kinds alone`;
    return { kinds };
  }
  if (typeof make !== 'string') return "a faculty's entry names it in make";
  if (from !== undefined && typeof from !== 'string') return "an entry's from is a body's name";
  if (args !== undefined && !isObject(args)) return "an entry's args are an object";
  if (secrets !== undefined && !isNames(secrets)) return "an entry's secrets are a list of names";
  if (faculties !== undefined && !isNames(faculties)) return "an entry's faculties are a list of names";
  return {
    make,
    ...(from === undefined ? {} : { from }),
    ...(args === undefined ? {} : { args: args as Readonly<Record<string, Json>> }),
    ...(secrets === undefined ? {} : { secrets }),
    ...(faculties === undefined ? {} : { faculties }),
    ...(kinds === undefined ? {} : { kinds }),
  };
};

// A foundation body's args for one house: everything its part of the entry names but the faculty.
const argsOf = ({ faculty: _faculty, ...args }: BodyNamed): Readonly<Record<string, Json>> => args as Readonly<Record<string, Json>>;

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

// The memory a primordial faculty receives: none, since the ground's memory is not open yet.
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
  /** The carry its door was hooked to, which closing unhooks it from. */
  readonly hooked?: Hooked;
  readonly why?: string;
  /** The door's and the hand's calls on it not yet ended, which closing waits for. */
  readonly flight?: Set<Promise<unknown>>;
  /** Its ward, where it stands closed until something reaches it. */
  readonly asleep?: string;
}

/** A body of the ladder as the ground holds it: standing, or down and why. */
interface Stood {
  readonly entry: FacultyEntry;
  readonly body?: Body;
  readonly why?: string;
}

// One primordial body raised on its entry, filling the contract it names, or the reason the ground cannot open.
const primordial = async <T>(registry: Registry, role: Serves, entry: FacultyEntry): Promise<{ body: Body; object: T }> => {
  const faculty = entry.make === undefined ? undefined : registry.faculties?.[entry.make];
  if (faculty === undefined) throw new Error(`no faculty ${entry.make} in the ground’s registry for its ${role}`);
  const made: Up = { name: role, args: entry.args ?? {}, secrets: {}, memory: unopened, faculties: {} };
  await faculty.install?.(made);
  const raised = await faculty.up(made);
  if (raised.serves !== role || raised.object === undefined) {
    await raised.down?.();
    throw new Error(`the faculty ${entry.make} serves no ${role}`);
  }
  return { body: raised, object: raised.object as T };
};

export class Ground {
  readonly #memory: Memory;
  readonly #registry: Registry;
  readonly #options: GroundOptions;
  readonly #crypto: Crypto;
  readonly #tools: Tools;
  readonly #primordial: readonly Body[];
  readonly #wait: number | undefined;
  readonly #keys: SeedKeys;
  readonly #rows: Rows;
  readonly #place: string;
  #drawer: Drawer;
  readonly #houses = new Map<string, Held>();
  readonly #stood = new Map<string, Stood>();
  /** The ground's own faculties, each an offer. */
  readonly #own: ReadonlyMap<string, { readonly blueprint: unknown; readonly object: object }>;
  /** The changes to each name, one at a time: two of one name never pass each other. */
  readonly #changing = new Map<string, Promise<unknown>>();

  private constructor(options: GroundOptions, registry: Registry, parts: { memory: Memory; crypto: Crypto; tools: Tools; primordial: readonly Body[] }, keys: SeedKeys, rows: Rows, place: string, drawer: Drawer) {
    this.#memory = parts.memory;
    this.#registry = registry;
    this.#crypto = parts.crypto;
    this.#tools = parts.tools;
    this.#primordial = parts.primordial;
    this.#wait = options.wait;
    this.#options = options;
    this.#keys = keys;
    this.#rows = rows;
    this.#place = place;
    this.#drawer = drawer;
    this.#own = new Map([
      [HOUSES, { blueprint: HousesBlueprint, object: this.#housesFaculty() }],
      [FACULTIES, { blueprint: FacultiesBlueprint, object: this.#facultiesFaculty() }],
      [SECRETS, { blueprint: SecretsBlueprint, object: this.#secretsFaculty() }],
      [MOVES, { blueprint: MovesBlueprint, object: this.#movesFaculty() }],
    ]);
  }

  /**
   * A ground opened on its host's registry and entries: the primordial
   * bodies go up, the key opens the drawer or writes one in a memory that
   * holds nothing, then the ladder stands and every house of the drawer
   * opens.
   */
  static async open(options: GroundOptions): Promise<Ground> {
    const registry = joinedRegistry(libraryRegistry, options.registry);
    const raised: Body[] = [];
    try {
      const unlock = await primordial<Unlock>(registry, 'unlock', options.primordial.unlock);
      raised.push(unlock.body);
      const memory = await primordial<Memory>(registry, 'memory', options.primordial.memory);
      raised.push(memory.body);
      const crypto = await primordial<Crypto>(registry, 'crypto', options.primordial.crypto);
      raised.push(crypto.body);
      const tools = await primordial<Tools>(registry, 'tools', options.primordial.tools);
      raised.push(tools.body);
      const keys = new SeedKeys(await unlock.object.key(), crypto.object);
      const rows = await Rows.open(memory.object, keys, crypto.object, tools.object);
      const place = await rows.place(DRAWER);
      let drawer = await rows.get<Drawer>(place).catch(() => null);
      if (drawer === null) {
        // A memory that holds places holds another ground's drawer, which this key does not open.
        if ((await memory.object.list()).length > 0) throw new Error('this memory holds no drawer this key opens');
        drawer = emptyDrawer();
        if (!(await rows.transact((draft) => draft.set(place, drawer)))) throw new Error('the ground’s memory refused its first write');
      }
      const ground = new Ground(options, registry, { memory: memory.object, crypto: crypto.object, tools: tools.object, primordial: raised }, keys, rows, place, { ...emptyDrawer(), ...drawer });
      await ground.#boot();
      return ground;
    } catch (error) {
      for (const one of raised.reverse()) await one.down?.();
      throw error;
    }
  }

  // The ladder, then the houses.
  async #boot(): Promise<void> {
    await this.#ladder();
    for (const [name, entry] of Object.entries(this.#drawer.houses)) {
      const ward = this.#drawer.wards[name];
      const carry = this.#carry();
      if (this.#options.lazy === true && ward !== undefined && typeof carry !== 'string') {
        // Its door is hooked unopened: the first box opens it, then goes in.
        this.#houses.set(name, { entry, asleep: ward, hooked: carry });
        await carry.listen({ ward, door: (box) => this.#door(name, box) });
        continue;
      }
      this.#houses.set(name, await this.#open(name, entry));
    }
  }

  // ---- the drawer ----

  // One change to the drawer, landed on its row as it stands. A throw inside lands nothing.
  async #change(change: (drawer: Drawer) => void): Promise<void> {
    let changed: Drawer | undefined;
    const landed = await this.#rows.transact(async (draft) => {
      const drawer = { ...emptyDrawer(), ...(await draft.get<Drawer>(this.#place)) };
      change(drawer);
      draft.set(this.#place, drawer);
      changed = drawer;
    });
    if (!landed) throw new Error('the ground’s memory refused the write: another instance may write here');
    this.#drawer = changed!;
  }

  // Changes to one name, one at a time: two of one name never pass each other.
  #byName<T>(name: string, change: () => Promise<T>): Promise<T> {
    const run = (this.#changing.get(name) ?? Promise.resolve()).then(change);
    this.#changing.set(
      name,
      run.catch(() => undefined),
    );
    return run;
  }

  // A prefix of the ground's memory for one house or one faculty: a digest of its name, which says nothing of it.
  async #prefix(of: 'house' | 'faculty', name: string): Promise<string> {
    const names = await this.#keys.derive('view-names', 32);
    const digest = await this.#crypto.sha256(new Uint8Array([...names, ...this.#tools.utf8(`${of}\n${name}`)]));
    return `${this.#tools.hex(digest.subarray(0, 8))}/`;
  }

  // Every faculty entry the ladder stands: the terrain's defaults, and the drawer's in their place.
  #entries(): Readonly<Record<string, FacultyEntry>> {
    return { ...this.#options.entries, ...this.#drawer.faculties };
  }

  // ---- the ladder ----

  // What a body waits for: the one whose registry it stands on, and each it calls.
  static #below(entry: FacultyEntry): readonly string[] {
    return [...(entry.from === undefined ? [] : [entry.from]), ...(entry.faculties ?? [])];
  }

  // Every body not standing raised in the ladder's order: each after the ones it waits for.
  async #ladder(): Promise<void> {
    const entries = this.#entries();
    const order: string[] = [];
    const cycles = new Map<string, string>();
    const seen = new Map<string, 'visiting' | 'done'>();
    const visit = (name: string, path: readonly string[]) => {
      if (seen.get(name) === 'done') return;
      if (seen.get(name) === 'visiting') {
        const cycle = [...path.slice(path.indexOf(name)), name];
        for (const one of cycle) cycles.set(one, `a cycle: ${cycle.join(' → ')}`);
        return;
      }
      seen.set(name, 'visiting');
      for (const below of Ground.#below(entries[name])) if (Object.hasOwn(entries, below) && !GRANTED.has(below)) visit(below, [...path, name]);
      seen.set(name, 'done');
      order.push(name);
    };
    for (const name of Object.keys(entries).sort()) if (!GRANTED.has(name)) visit(name, []);
    for (const name of order) {
      if (this.#stood.get(name)?.body !== undefined) continue;
      const cycle = cycles.get(name);
      this.#stood.set(name, cycle === undefined ? await this.#stand(name, entries[name]) : { entry: entries[name], why: cycle });
    }
  }

  // A body standing under a name, or why there is none.
  #standing(name: string): Body | string {
    if (OWN.has(name)) return `the faculty ${name} is the ground’s own`;
    const stood = this.#stood.get(name);
    if (stood === undefined) return `no faculty ${name} stands here`;
    return stood.body ?? `the faculty ${name} is down: ${stood.why}`;
  }

  // One body raised on its entry: installed where the entry is new, then up, or down and why.
  async #stand(name: string, entry: FacultyEntry): Promise<Stood> {
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
    const secrets: Record<string, string> = {};
    for (const secret of entry.secrets ?? []) {
      const value = this.#drawer.secrets[secret];
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
      const installed = this.#tools.canonical(entry);
      if (this.#drawer.installed[name] !== installed) {
        await faculty.install?.(made);
        await this.#change((drawer) => void (drawer.installed[name] = installed));
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
  }

  // What a raised body may not be: an offer half made, a contract filled wrong, or a second clock.
  #refused(name: string, raised: Body): string | undefined {
    if ((raised.blueprint === undefined) !== (raised.object === undefined) && raised.serves === undefined) return 'a body offers a blueprint and an object together, or neither';
    if (raised.blueprint !== undefined) offered(raised.blueprint, `the faculty ${name}`);
    if (raised.serves === undefined) return undefined;
    if (raised.blueprint !== undefined) return 'a body serves the house or offers beings, never both';
    if (raised.serves === 'unlock' || raised.serves === 'crypto' || raised.serves === 'tools') return `the ${raised.serves} is primordial, and the drawer names none`;
    if (FOR_HOUSES.has(raised.serves) && typeof raised.house !== 'function') return `a body serving ${raised.serves} serves each house through house()`;
    if (raised.serves === 'memory' && raised.object !== undefined) return 'the ground’s memory is primordial, and the drawer names none';
    if (EVERY_HOUSE.has(raised.serves) && raised.object === undefined) return `a body serving the ${raised.serves} holds it as its object`;
    if (raised.serves === 'carry' && (raised.schemes === undefined || raised.schemes.length === 0)) return 'a carry names the schemes it speaks';
    if (raised.serves === 'clock') {
      const serving = [...this.#stood].find(([one, stood]) => one !== name && stood.body?.serves === 'clock');
      if (serving !== undefined) return `the clock is served by ${serving[0]}`;
    }
    return undefined;
  }

  // Who uses a body: the houses that name it or receive it, and the bodies that stand on it or call it.
  #users(name: string): { readonly houses: readonly string[]; readonly faculties: readonly string[] } {
    const serves = this.#stood.get(name)?.body?.serves;
    const houses = Object.entries(this.#drawer.houses)
      .filter(([, entry]) => (serves !== undefined && EVERY_HOUSE.has(serves)) || (entry.faculties ?? []).includes(name) || entry.classes.faculty === name || entry.memory?.faculty === name)
      .map(([house]) => house);
    const faculties = Object.entries(this.#entries())
      .filter(([, entry]) => Ground.#below(entry).includes(name))
      .map(([faculty]) => faculty);
    return { houses, faculties };
  }

  // A body and every body above it, the callers after their callees, and every house any of them reaches.
  #above(name: string): { readonly faculties: readonly string[]; readonly houses: readonly string[] } {
    const faculties: string[] = [];
    const houses = new Set<string>();
    const visit = (one: string) => {
      if (faculties.includes(one)) return;
      faculties.push(one);
      const users = this.#users(one);
      for (const house of users.houses) houses.add(house);
      for (const faculty of users.faculties) visit(faculty);
    };
    visit(name);
    return { faculties, houses: [...houses] };
  }

  // A body taken down with everything above it, `between` run while all are down, then the ladder raised and the houses opened again.
  async #cycle(name: string, between: () => Promise<void>): Promise<{ readonly why?: string }> {
    const { faculties, houses } = this.#above(name);
    for (const house of houses) {
      const held = this.#houses.get(house);
      if (held === undefined) continue;
      this.#houses.set(house, { entry: held.entry, why: `the faculty ${name} is going down` });
      await this.#close(held);
    }
    for (const faculty of [...faculties].reverse()) {
      const stood = this.#stood.get(faculty);
      this.#stood.delete(faculty);
      await stood?.body?.down?.();
    }
    await between();
    await this.#mended();
    const why = this.#stood.get(name)?.why;
    return why === undefined ? {} : { why };
  }

  // After the ladder moves: each body down may stand now, and each house its absence kept closed opens.
  async #mended(): Promise<void> {
    for (const [name, stood] of [...this.#stood]) if (stood.body === undefined) this.#stood.delete(name);
    await this.#ladder();
    for (const [name, held] of [...this.#houses]) {
      if (held.opened !== undefined || held.asleep !== undefined) continue;
      await this.#byName(`house:${name}`, async () => {
        const now = this.#houses.get(name);
        if (now !== undefined && now.opened === undefined && now.asleep === undefined) this.#houses.set(name, await this.#open(name, now.entry));
      });
    }
  }

  #facultyEntry(name: string, given: FacultyEntry): FacultyEntry {
    if (!NAME.test(name)) throw new TypeError(`a faculty is named with ${NAMED}`);
    const entry = facultyEntryOf(name, given);
    if (typeof entry === 'string') throw new TypeError(entry);
    return entry;
  }

  /**
   * A body raised on its entry, recorded in the drawer. The same name and
   * entry answer it as it stands; another entry under a name the drawer or
   * the terrain holds is an update, and refused here.
   */
  async stand(name: string, given: FacultyEntry): Promise<{ readonly why?: string }> {
    const entry = this.#facultyEntry(name, given);
    return this.#byName(`faculty:${name}`, async () => {
      const held = this.#entries()[name];
      if (held !== undefined && this.#tools.canonical(held) !== this.#tools.canonical(entry)) throw new Error(`the faculty ${name} stands with another entry; update it`);
      if (this.#drawer.faculties[name] === undefined) await this.#change((drawer) => void (drawer.faculties[name] = entry));
      if (GRANTED.has(name)) return {};
      await this.#mended();
      const why = this.#stood.get(name)?.why;
      return why === undefined ? {} : { why };
    });
  }

  /**
   * A new entry landed over a faculty's in one write: its body and every
   * body above it go down, it installs where the entry moved, and all go up
   * again, with each house they reach.
   */
  async restand(name: string, given: FacultyEntry): Promise<{ readonly why?: string }> {
    const entry = this.#facultyEntry(name, given);
    return this.#byName(`faculty:${name}`, async () => {
      const held = this.#entries()[name];
      if (held === undefined) throw new Error(`no faculty ${name} stands here to update`);
      if (this.#tools.canonical(held) === this.#tools.canonical(entry)) {
        const why = this.#stood.get(name)?.why;
        return why === undefined ? {} : { why };
      }
      if (GRANTED.has(name)) {
        await this.#change((drawer) => void (drawer.faculties[name] = entry));
        return {};
      }
      return this.#cycle(name, () => this.#change((drawer) => void (drawer.faculties[name] = entry)));
    });
  }

  /** A body taken down and up again on its entry, with every body above it and each house they reach. */
  restart(name: string): Promise<{ readonly why?: string }> {
    return this.#byName(`faculty:${name}`, async () => {
      if (this.#entries()[name] === undefined || GRANTED.has(name)) throw new Error(`no faculty ${name} stands here to restart`);
      return this.#cycle(name, () => Promise.resolve());
    });
  }

  /** A body taken down and its entry dropped, where no house and no body uses it. */
  unstand(name: string): Promise<void> {
    return this.#byName(`faculty:${name}`, async () => {
      if (this.#drawer.faculties[name] === undefined) {
        if (this.#options.entries?.[name] !== undefined) throw new Error(`the faculty ${name} is the terrain’s; update it`);
        return;
      }
      if (!GRANTED.has(name)) {
        const { houses, faculties } = this.#users(name);
        const users = [...houses.map((house) => `the house ${house}`), ...faculties.map((faculty) => `the faculty ${faculty}`)];
        if (users.length > 0) throw new Error(`the faculty ${name} is in use by ${users.join(', ')}`);
      }
      const stood = this.#stood.get(name);
      this.#stood.delete(name);
      await stood?.body?.down?.();
      await this.#change((drawer) => {
        delete drawer.faculties[name];
        delete drawer.installed[name];
      });
      // A terrain's entry under the same name stands again in its place.
      if (this.#options.entries?.[name] !== undefined) await this.#mended();
    });
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

  #clock(): Clock | string {
    for (const stood of this.#stood.values()) if (stood.body?.serves === 'clock') return stood.body.object as Clock;
    return 'no body serves the clock';
  }

  // What a house is offered: the faculties its entry names, each with the kinds its own entry grants.
  #offers(entry: Entry): Offer[] | string {
    const offers: Offer[] = [];
    for (const name of entry.faculties ?? []) {
      if (HAND_ALONE.has(name)) return `the faculty ${name} is the hand’s alone`;
      const own = this.#own.get(name);
      if (own !== undefined) {
        offers.push({ ...own, kinds: this.#drawer.faculties[name]?.kinds ?? [] });
        continue;
      }
      const stood = this.#standing(name);
      if (typeof stood === 'string') return stood;
      const { blueprint, object, window } = stood;
      if (blueprint === undefined || object === undefined) return `the faculty ${name} offers beings nothing`;
      const kinds = this.#entries()[name]?.kinds;
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
  async #open(name: string, entry: Entry): Promise<Held> {
    try {
      const seed = this.#drawer.seeds[name];
      if (seed === undefined) return { entry, why: 'the drawer keeps no seed for it' };
      const offers = this.#offers(entry);
      if (typeof offers === 'string') return { entry, why: offers };
      const hooked = this.#carry();
      if (typeof hooked === 'string') return { entry, why: hooked };
      const ticking = this.#clock();
      if (typeof ticking === 'string') return { entry, why: ticking };
      const memory = await this.#houseMemory(name, entry);
      const classes = await this.#served<Classes>(entry.classes, 'classes', name);
      const clock = new HouseClock(ticking, name);
      const carry = new HouseCarry(hooked);
      const wait = entry.wait === undefined ? this.#wait : this.#wait === undefined ? entry.wait : Math.min(entry.wait, this.#wait);
      const opened = await openHouse(
        { keys: new SeedKeys(seed, this.#crypto), memory, classes, carry, clock, crypto: this.#crypto, tools: this.#tools },
        offers,
        wait === undefined ? {} : { wait },
      );
      await hooked.listen({ ward: opened.ward, door: (box) => this.#door(name, box) });
      if (this.#drawer.wards[name] !== opened.ward) await this.#change((drawer) => void (drawer.wards[name] = opened.ward));
      return { entry, opened, clock, carry, hooked, flight: new Set() };
    } catch (error) {
      return { entry, why: message(error) };
    }
  }

  // A house that stands closed until something reaches it, opened once, in its name's turn.
  #woken(name: string): Promise<Held | undefined> {
    const held = this.#houses.get(name);
    if (held?.asleep === undefined) return Promise.resolve(held);
    return this.#byName(`house:${name}`, async () => {
      const now = this.#houses.get(name);
      if (now?.asleep === undefined) return now;
      now.hooked?.unlisten({ ward: now.asleep });
      const opened = await this.#open(name, now.entry);
      this.#houses.set(name, opened);
      return opened;
    });
  }

  /** Every house that stands closed until reached, opened now, as a wake by alarm needs: each arms its own times again. */
  async wake(): Promise<void> {
    await Promise.all([...this.#houses.keys()].map((name) => this.#woken(name)));
  }

  // A box for a house the ground still holds open, and nothing for one it closed.
  async #door(name: string, box: Uint8Array): Promise<Uint8Array | null> {
    const held = await this.#woken(name);
    return held?.opened === undefined ? null : this.#counted(held, held.opened.door(box));
  }

  // A call on a house, in flight until it ends, so closing the house waits for it.
  #counted<T>(held: Held, call: Promise<T>): Promise<T> {
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

  /** Every house in the drawer, open with its ward, or closed and why. */
  list(): readonly Standing[] {
    return [...this.#houses].map(([name, held]) => ({
      name,
      entry: held.entry,
      ...(held.opened === undefined ? (held.asleep === undefined ? {} : { ward: held.asleep }) : { ward: held.opened.ward }),
      ...(held.why === undefined ? {} : { why: held.why }),
    }));
  }

  #houseEntry(name: string, given: Entry): Entry {
    if (!NAME.test(name)) throw new TypeError(`a house is named with ${NAMED}`);
    const entry = entryOf(given);
    if (typeof entry === 'string') throw new TypeError(entry);
    return entry;
  }

  #standingOf(name: string): Standing {
    return this.list().find((standing) => standing.name === name)!;
  }

  /**
   * A house added to the drawer and opened. Its seed is drawn on first use.
   * The same name with the same entry answers the house as it stands;
   * another entry under a name the drawer holds is an update, and refused
   * here.
   */
  async add(name: string, given: Entry): Promise<Standing> {
    const entry = this.#houseEntry(name, given);
    return this.#byName(`house:${name}`, async () => {
      const held = this.#houses.get(name);
      if (held !== undefined) {
        if (this.#tools.canonical(held.entry) !== this.#tools.canonical(entry)) throw new Error(`the house ${name} stands with another entry; update it`);
        // A house that did not open is tried again, as its entry stands.
        if (held.opened === undefined && held.asleep === undefined) this.#houses.set(name, await this.#open(name, entry));
        return this.#standingOf(name);
      }
      const fresh = this.#drawer.seeds[name] === undefined ? this.#tools.hex(this.#crypto.random(32)) : undefined;
      await this.#change((drawer) => {
        drawer.houses[name] = entry;
        if (fresh !== undefined && drawer.seeds[name] === undefined) drawer.seeds[name] = fresh;
      });
      this.#houses.set(name, await this.#open(name, entry));
      return this.#standingOf(name);
    });
  }

  /**
   * A new entry landed over a house's in one write, and the house opened
   * again on it, once every call in flight on it has ended. Its seed and
   * its places stay, so it answers as the same ward.
   */
  async update(name: string, given: Entry): Promise<Standing> {
    const entry = this.#houseEntry(name, given);
    return this.#byName(`house:${name}`, async () => {
      const held = this.#houses.get(name);
      if (held === undefined) throw new Error(`no house ${name} is here to update`);
      // The same entry answers the house as it stands, and one that did not open is tried again.
      if (this.#tools.canonical(held.entry) === this.#tools.canonical(entry)) {
        if (held.opened === undefined && held.asleep === undefined) this.#houses.set(name, await this.#open(name, entry));
        return this.#standingOf(name);
      }
      this.#houses.set(name, { entry: held.entry, why: 'it is being updated' });
      await this.#close(held);
      await this.#change((drawer) => void (drawer.houses[name] = entry));
      this.#houses.set(name, await this.#open(name, entry));
      return this.#standingOf(name);
    });
  }

  /**
   * A house closed and dropped from the drawer, once every call in flight on
   * it has ended. Its seed and its places stay, so adding it again opens the
   * same ward, and never beside the one it replaces.
   */
  remove(name: string): Promise<void> {
    return this.#byName(`house:${name}`, async () => {
      const held = this.#houses.get(name);
      if (held === undefined) return;
      this.#houses.delete(name);
      await this.#close(held);
      await this.#change((drawer) => void delete drawer.houses[name]);
    });
  }

  /** The hand: a house by its name, and a being in it by id, asked as `root`. */
  async ask({ house, ...request }: HandAsk): Promise<Answer | { readonly describe: Json }> {
    const held = await this.#woken(house);
    if (held?.opened === undefined) return { error: { message: `no house ${house} is open here` } };
    return this.#counted(held, held.opened.ask(request));
  }

  /**
   * The ground's hand, one request at a time, as every terrain serves it:
   * `describe`, a faculty's method, or an ask of a being in a named house.
   */
  hand(request: {
    readonly describe?: true;
    readonly faculty?: string;
    readonly house?: string;
    readonly id?: string;
    readonly method?: string;
    readonly args?: Json;
    readonly after?: Answer;
    readonly cells?: true;
  }): Promise<Answer | { readonly describe: Json }> {
    const { describe, faculty, house, id, method, args, after, cells } = request;
    if (describe === true) return Promise.resolve({ result: this.describe() as unknown as Json });
    if (faculty !== undefined) {
      if (method === undefined) return Promise.resolve({ error: { message: `a call on ${faculty} names a method` } });
      return this.call({ faculty, method, ...(args === undefined ? {} : { args }), ...(id === undefined ? {} : { id }) });
    }
    if (house === undefined) return Promise.resolve({ error: { message: 'the hand names a house, a faculty, or describe' } });
    return this.ask({ house, ...(id === undefined ? {} : { id }), ...(method === undefined ? {} : { method }), ...(args === undefined ? {} : { args }), ...(after === undefined ? {} : { after }), ...(cells === undefined ? {} : { cells }) });
  }

  // A faculty the hand may call: the ground's own, or a body of the ladder that offers an object.
  #callable(name: string): { readonly blueprint: unknown; readonly object: object } | string {
    const own = this.#own.get(name);
    if (own !== undefined) return own;
    const stood = this.#standing(name);
    if (typeof stood === 'string') return stood;
    const { blueprint, object } = stood;
    return blueprint === undefined || object === undefined ? `${name} offers no methods` : { blueprint, object };
  }

  /**
   * What the ground's hand shows its owner: every body with its methods, what
   * it serves, or why it is down, each method's description, args, result
   * and hints, and every house. A face reads it and needs no code of its own
   * for any of them.
   */
  describe(): { readonly faculties: Readonly<Record<string, Json>>; readonly houses: readonly Standing[] } {
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
    for (const [name, own] of this.#own) faculties[name] = shown(own.blueprint);
    for (const [name, stood] of this.#stood) {
      if (stood.body === undefined) faculties[name] = { why: stood.why ?? 'down' };
      else if (stood.body.serves !== undefined) faculties[name] = { serves: stood.body.serves, methods: {} };
      else faculties[name] = stood.body.blueprint === undefined ? { methods: {} } : shown(stood.body.blueprint);
    }
    return { faculties, houses: this.list() };
  }

  /**
   * A faculty's method called by the ground's owner, through its hand. The
   * args are held to the method's schema. It holds no token of any house,
   * so a call it makes back answers an error.
   */
  async call({ faculty: name, method, args = {}, id }: { faculty: string; method: string; args?: Json; id?: string }): Promise<Answer> {
    const faculty = this.#callable(name);
    if (typeof faculty === 'string') return { error: { message: faculty } };
    const blueprint = blueprintOf(faculty.blueprint) ?? (faculty.blueprint as Blueprint);
    const spec = blueprint.methods[method];
    const run = (faculty.object as Record<string, unknown>)[method];
    if (spec === undefined || typeof run !== 'function') return { error: { message: `${name} has no method ${method}` } };
    const why = this.#tools.check(spec.args, args);
    if (why !== null) return { error: { message: why } };
    const context: FacultyContext = {
      id: id ?? this.#tools.hex(this.#crypto.random(16)),
      call: () => Promise.resolve({ error: { message: 'the hand holds no token' } }),
      describe: () => Promise.resolve({ error: { message: 'the hand holds no token' } }),
    };
    try {
      const answered = (await (run as (args: Json, context: FacultyContext) => Promise<unknown>).call(faculty.object, args, context)) as Answer;
      return typeof answered === 'object' && answered !== null && ('result' in answered || 'error' in answered) ? answered : { error: { message: `${name} answered no answer` } };
    } catch (error) {
      return { error: { message: message(error) } };
    }
  }

  /**
   * The one handler the ground's listener chains: each standing body's
   * handler in the ladder's order, read as each request arrives, so a body
   * raised while the ground runs is served at once.
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

  // Each standing body's handler, which opens every house naming the body before it takes a request, so its tokens answer on a ground woken per event.
  #handlers(): readonly Handler[] {
    return [...this.#stood].flatMap(([name, stood]) => {
      const handler = stood.body?.handler;
      if (handler === undefined) return [];
      const naming = () => Promise.all(Object.entries(this.#drawer.houses).flatMap(([house, entry]) => ((entry.faculties ?? []).includes(name) ? [this.#woken(house)] : [])));
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
    });
  }

  /** Every house closed through its views, then every body taken down in the reverse of the ladder, the primordial last. */
  async close(): Promise<void> {
    const held = [...this.#houses.values()].reverse();
    this.#houses.clear();
    for (const one of held) await this.#close(one);
    const stood = [...this.#stood.values()].reverse();
    this.#stood.clear();
    for (const one of stood) await one.body?.down?.();
    for (const one of [...this.#primordial].reverse()) await one.down?.();
  }

  // ---- the ground's own faculties ----

  // Work answered as a faculty answers: its result, or its error.
  static async #answer(work: () => Promise<Json>): Promise<Answer> {
    try {
      return { result: await work() };
    } catch (error) {
      return { error: { message: message(error) } };
    }
  }

  static #ward(name: string, standing: Standing): { ward: string } {
    if (standing.ward === undefined) throw new Error(`the house ${name} did not open: ${standing.why}`);
    return { ward: standing.ward };
  }

  #housesFaculty(): object {
    return {
      add: ({ name, ...entry }: { name: string } & Entry) => Ground.#answer(async () => Ground.#ward(name, await this.add(name, entry))),
      update: ({ name, ...entry }: { name: string } & Entry) => Ground.#answer(async () => Ground.#ward(name, await this.update(name, entry))),
      remove: ({ name }: { name: string }) => Ground.#answer(async () => (await this.remove(name), null)),
      list: () => Ground.#answer(async () => this.list().map(({ name, entry, ward, why }) => ({ name, entry: entry as unknown as Json, ...(ward === undefined ? {} : { ward }), ...(why === undefined ? {} : { why }) }))),
    };
  }

  #facultiesFaculty(): object {
    const stood = (name: string, { why }: { readonly why?: string }): null => {
      if (why !== undefined) throw new Error(`the faculty ${name} did not stand: ${why}`);
      return null;
    };
    return {
      add: ({ name, ...entry }: { name: string } & FacultyEntry) => Ground.#answer(async () => stood(name, await this.stand(name, entry))),
      update: ({ name, ...entry }: { name: string } & FacultyEntry) => Ground.#answer(async () => stood(name, await this.restand(name, entry))),
      restart: ({ name }: { name: string }) => Ground.#answer(async () => stood(name, await this.restart(name))),
      remove: ({ name }: { name: string }) => Ground.#answer(async () => (await this.unstand(name), null)),
      list: () =>
        Ground.#answer(async () =>
          Object.entries(this.#entries()).map(([name, entry]) => {
            const held = this.#stood.get(name);
            const serves = held?.body?.serves;
            const why = held?.why;
            return { name, entry: entry as unknown as Json, ...(serves === undefined ? {} : { serves }), ...(why === undefined ? {} : { why }) };
          }),
        ),
    };
  }

  #secretsFaculty(): object {
    return {
      set: ({ name, value }: { name: string; value: string }) =>
        Ground.#answer(async () => {
          if (!NAME.test(name)) throw new TypeError(`a secret is named with ${NAMED}`);
          await this.#byName(`secret:${name}`, () => this.#change((drawer) => void (drawer.secrets[name] = value)));
          return null;
        }),
      remove: ({ name }: { name: string }) => Ground.#answer(async () => (await this.#byName(`secret:${name}`, () => this.#change((drawer) => void delete drawer.secrets[name])), null)),
      list: () => Ground.#answer(async () => Object.keys(this.#drawer.secrets)),
    };
  }

  #movesFaculty(): object {
    const tools = this.#tools;
    return {
      out: ({ name }: { name: string }) =>
        Ground.#answer(async () => {
          const held = this.#houses.get(name);
          if (held === undefined) throw new Error(`no house ${name} is here`);
          const seed = this.#drawer.seeds[name];
          if (seed === undefined) throw new Error(`the drawer keeps no seed for ${name}`);
          // Closed and out of the drawer first, so nothing lands here after the copy and no ground runs it twice.
          await this.remove(name);
          const store = await this.#houseMemory(name, held.entry);
          const places: Record<string, Record<string, string>> = {};
          for (const place of await store.list()) {
            const { entries } = await store.read({ place });
            places[place] = Object.fromEntries(Object.entries(entries).map(([key, bytes]) => [key, tools.hex(bytes)]));
          }
          return { seed, places };
        }),
      in: ({ name, seed, places, ...given }: { name: string; seed: string; places: Record<string, Record<string, string>> } & Entry) =>
        Ground.#answer(async () => {
          if (!/^[0-9a-f]{64}$/.test(seed)) throw new TypeError('a seed is sixty-four lowercase hex digits');
          if (this.#houses.has(name)) throw new Error(`the house ${name} stands here already`);
          const entry = this.#houseEntry(name, given);
          const store = await this.#houseMemory(name, entry);
          // A house moves into a memory of its own, never over another's places, and onto no other seed.
          if ((await store.list()).length > 0) throw new Error(`the memory for ${name} holds places already`);
          const held = this.#drawer.seeds[name];
          if (held !== undefined && held !== seed) throw new Error(`the drawer keeps another seed for ${name}`);
          const writes: Record<string, Record<string, Uint8Array | null>> = {};
          for (const [place, entries] of Object.entries(places)) {
            writes[place] = Object.fromEntries(
              Object.entries(entries).map(([key, text]) => {
                const bytes = tools.bytes(text);
                if (bytes === null) throw new TypeError(`the place ${place} holds no hex under ${key}`);
                return [key, bytes];
              }),
            );
          }
          if (held === undefined) await this.#change((drawer) => void (drawer.seeds[name] = seed));
          if (Object.keys(writes).length > 0 && (await store.write({ writes, expect: Object.fromEntries(Object.keys(writes).map((place) => [place, null])) })) === null) {
            throw new Error(`the memory for ${name} refused the places`);
          }
          return Ground.#ward(name, await this.add(name, entry));
        }),
    };
  }
}
