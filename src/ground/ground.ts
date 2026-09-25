// SPDX-License-Identifier: Apache-2.0
// The ground: the process houses run in, on any engine. It holds one key
// outside itself, which its unlock answers, and seals everything else in
// its drawer, its own places in its one memory. The drawer holds every
// entry, each house's seed, every secret and each house's ward. Faculties
// stand on a ladder of registries, the terrain's own first, then any a
// faculty carries. Houses open on the bodies their entries name, each
// keeping its places in its view of the ground's memory where it names
// none. The ground holds every door, every hand and every faculty, and
// closes a house through the bodies it handed it, never asking it.
import type { Json } from '../being/being.ts';
import { need, s } from '../being/index.ts';
import { blueprintOf, type Blueprint } from '../being/need.ts';
import { offered } from '../being/table.ts';
import { NobleCrypto } from '../bodies/noble-crypto.ts';
import { SeedKeys } from '../bodies/seed-keys.ts';
import { StrictTools } from '../bodies/strict-tools.ts';
import { WebClock } from '../bodies/web-clock.ts';
import type { Handler } from '../bodies/web-carry.ts';
import type { Carry, Classes, Clock, Crypto, Memory, Tools } from '../foundation.ts';
import { openHouse, type Answer, type FacultyContext, type Offer, type Opened } from '../house/house.ts';
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

/**
 * What a maker answers: an offer for beings, a handler for the listener, a
 * stop, and a registry for the rungs above it, each where it has one.
 */
export interface Faculty {
  readonly blueprint?: unknown;
  readonly object?: object;
  /** How long the faculty remembers a call id, in milliseconds. */
  readonly window?: number;
  readonly handler?: Handler;
  stop?(): void | Promise<void>;
  readonly registry?: Registry;
}

/** What a faculty's maker receives: its name, its args, the secrets its entry names, and its own sealed memory. */
export interface Made {
  readonly name: string;
  readonly args: Readonly<Record<string, Json>>;
  readonly secrets: Readonly<Record<string, string>>;
  readonly memory: Memory;
}

/** What a body's maker receives: the house's name and the body's args. */
export interface BodyMade {
  readonly house: string;
  readonly args: Readonly<Record<string, Json>>;
}

/** Code that makes faculties and bodies by name. */
export interface Registry {
  readonly faculties?: Readonly<Record<string, (made: Made) => Faculty | Promise<Faculty>>>;
  readonly memory?: Readonly<Record<string, (made: BodyMade) => Memory | Promise<Memory>>>;
  readonly classes?: Readonly<Record<string, (made: BodyMade) => Classes | Promise<Classes>>>;
}

/**
 * A terrain's registry and the one its host installs beside it, as one
 * rung. A name the terrain holds is refused to the host, never replaced.
 * No entry exports it; every shipped ground joins its first rung with it.
 */
export const joinedRegistry = (own: Registry, added: Registry = {}): Registry => {
  const join = <T>(kind: string, mine: Readonly<Record<string, T>> = {}, theirs: Readonly<Record<string, T>> = {}): Readonly<Record<string, T>> => {
    for (const name of Object.keys(theirs)) if (Object.hasOwn(mine, name)) throw new TypeError(`the registry names a ${kind} ${name}, which is the ground's own`);
    return { ...mine, ...theirs };
  };
  return { faculties: join('maker', own.faculties, added.faculties), memory: join('memory body', own.memory, added.memory), classes: join('classes body', own.classes, added.classes) };
};

/** One body in an entry: its maker, the faculty whose registry holds it, and its args. */
export interface BodyNamed {
  readonly body: string;
  readonly from?: string;
  readonly [argument: string]: Json | undefined;
}

/** One house in the drawer: its code, its memory where it takes one, its faculties, and its bound on every ask. */
export interface Entry {
  readonly classes: BodyNamed;
  readonly memory?: BodyNamed;
  readonly faculties?: readonly string[];
  readonly wait?: number;
}

/** One faculty in the drawer: its maker and where it stands, what it is handed, and its grant. */
export interface FacultyEntry {
  readonly make?: string;
  readonly from?: string;
  readonly args?: Readonly<Record<string, Json>>;
  readonly secrets?: readonly string[];
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

/** What `Ground.open` takes. The unlock, the memory and the registry are the host's, never the drawer's. */
export interface GroundOptions {
  readonly unlock: Unlock;
  readonly memory: Memory;
  readonly carry: Hooked;
  /** The ladder's first rung: the terrain's own makers, and whatever the host installs beside them. */
  readonly registry: Registry;
  readonly clock?: Clock;
  readonly crypto?: Crypto;
  readonly tools?: Tools;
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
const NAME = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const NAMED = 'lowercase letters, digits, dots, dashes and underscores, at most sixty-four';
const DRAWER = 'drawer';
const body = { type: 'object', properties: { body: { type: 'string' }, from: { type: 'string' } }, required: ['body'], additionalProperties: true } as const;
const OBJECT = { type: 'object', properties: {}, additionalProperties: true } as const;
// Every place of a memory, by its name: each entry's bytes as hex.
const PLACES = OBJECT;

/** The blueprint of the ground's own faculty for its houses. */
export const HousesBlueprint = need(HOUSES, {
  add: {
    description: 'Opens a house on the bodies its entry names; the same name and entry answer the same ward.',
    args: s.object({ name: s.string(), classes: body, memory: s.optional(body), faculties: s.optional(s.array(s.string())), wait: s.optional(s.integer({ minimum: 1 })) }),
    result: s.object({ ward: s.string() }),
    hints: { idempotent: true },
  },
  remove: {
    description: 'Closes a house and drops its entry; its seed and its places stay.',
    args: s.object({ name: s.string() }),
    hints: { idempotent: true },
  },
  list: {
    description: 'Every house in the drawer, open with its ward or closed with why.',
    result: s.array(s.object({ name: s.string(), ward: s.optional(s.string()), why: s.optional(s.string()) })),
    hints: { readOnly: true },
  },
});

/** The blueprint of the ground's own faculty for its ladder. */
export const FacultiesBlueprint = need(FACULTIES, {
  add: {
    description: 'Stands a faculty on the registry its entry names; the same name and entry answer as it stands. An entry for houses or faculties holds kinds alone, and grants it.',
    args: s.object({
      name: s.string(),
      make: s.optional(s.string()),
      from: s.optional(s.string()),
      args: s.optional(OBJECT),
      secrets: s.optional(s.array(s.string())),
      kinds: s.optional(s.array(s.string())),
    }),
    hints: { idempotent: true },
  },
  remove: {
    description: 'Stops a faculty no house and no faculty uses, and drops its entry.',
    args: s.object({ name: s.string() }),
    hints: { idempotent: true },
  },
  list: {
    description: 'Every faculty entry in the drawer, standing, or down with why.',
    result: s.array(s.object({ name: s.string(), why: s.optional(s.string()) })),
    hints: { readOnly: true },
  },
});

/** The blueprint of the ground's own faculty for its secrets, which the hand alone calls. */
export const SecretsBlueprint = need(SECRETS, {
  set: {
    description: 'Keeps a secret in the drawer, for the makers whose entries name it.',
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
    args: s.object({
      name: s.string(),
      classes: body,
      memory: s.optional(body),
      faculties: s.optional(s.array(s.string())),
      wait: s.optional(s.integer({ minimum: 1 })),
      seed: s.string(),
      places: PLACES,
    }),
    result: s.object({ ward: s.string() }),
  },
});

/** The drawer's one row: every entry, each house's seed, every secret, and each house's ward once it opened. */
interface Drawer {
  readonly houses: Record<string, Entry>;
  readonly faculties: Record<string, FacultyEntry>;
  readonly seeds: Record<string, string>;
  readonly secrets: Record<string, string>;
  readonly wards: Record<string, string>;
}

const emptyDrawer = (): Drawer => ({ houses: {}, faculties: {}, seeds: {}, secrets: {}, wards: {} });

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isNames = (value: unknown): value is readonly string[] => Array.isArray(value) && value.every((name) => typeof name === 'string');

const bodyOf = (held: unknown, what: string): BodyNamed | string => {
  if (!isObject(held) || typeof held.body !== 'string') return `an entry's ${what} names no body`;
  if (held.from !== undefined && typeof held.from !== 'string') return `an entry's ${what} names from as a faculty's name`;
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
  const { make, from, args, secrets, kinds, ...rest } = value;
  if (Object.keys(rest).length > 0) return `an entry names ${Object.keys(rest).join(', ')}, which no entry holds`;
  if (kinds !== undefined && !isNames(kinds)) return "an entry's kinds are a list of names";
  if (GRANTED.has(name)) {
    if (make !== undefined || from !== undefined || args !== undefined || secrets !== undefined || kinds === undefined) return `the faculty ${name} is the ground’s own, and its entry holds kinds alone`;
    return { kinds };
  }
  if (typeof make !== 'string') return "a faculty's entry names its maker in make";
  if (from !== undefined && typeof from !== 'string') return "an entry's from is a faculty's name";
  if (args !== undefined && !isObject(args)) return "an entry's args are an object";
  if (secrets !== undefined && !isNames(secrets)) return "an entry's secrets are a list of names";
  return {
    make,
    ...(from === undefined ? {} : { from }),
    ...(args === undefined ? {} : { args: args as Readonly<Record<string, Json>> }),
    ...(secrets === undefined ? {} : { secrets }),
    ...(kinds === undefined ? {} : { kinds }),
  };
};

// A body's args: everything its entry names but its maker and where it stands.
const argsOf = ({ body: _body, from: _from, ...args }: BodyNamed): Readonly<Record<string, Json>> => args as Readonly<Record<string, Json>>;

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

interface Held {
  readonly entry: Entry;
  readonly opened?: Opened;
  readonly clock?: HouseClock;
  readonly carry?: HouseCarry;
  readonly why?: string;
  /** The door's and the hand's calls on it not yet ended, which closing waits for. */
  readonly flight?: Set<Promise<unknown>>;
  /** Its ward, where it stands closed until something reaches it. */
  readonly asleep?: string;
}

/** A faculty of the ladder as the ground holds it: standing, or down and why. */
interface Stood {
  readonly entry: FacultyEntry;
  readonly faculty?: Faculty;
  readonly why?: string;
}

export class Ground {
  readonly #memory: Memory;
  readonly #carry: Hooked;
  readonly #registry: Registry;
  readonly #options: GroundOptions;
  readonly #clock: Clock;
  readonly #crypto: Crypto;
  readonly #tools: Tools;
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

  private constructor(options: GroundOptions, keys: SeedKeys, rows: Rows, place: string, drawer: Drawer) {
    this.#memory = options.memory;
    this.#carry = options.carry;
    this.#registry = options.registry;
    this.#clock = options.clock ?? new WebClock();
    this.#crypto = options.crypto ?? new NobleCrypto();
    this.#tools = options.tools ?? new StrictTools();
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
   * A ground opened on its host's unlock, memory and registry: the key
   * opens the drawer, or writes one in a memory that holds nothing, then
   * the ladder stands and every house of the drawer opens.
   */
  static async open(options: GroundOptions): Promise<Ground> {
    const crypto = options.crypto ?? new NobleCrypto();
    const tools = options.tools ?? new StrictTools();
    const keys = new SeedKeys(await options.unlock.key(), crypto);
    const rows = await Rows.open(options.memory, keys, crypto, tools);
    const place = await rows.place(DRAWER);
    let drawer = await rows.get<Drawer>(place).catch(() => null);
    if (drawer === null) {
      // A memory that holds places holds another ground's drawer, which this key does not open.
      if ((await options.memory.list()).length > 0) throw new Error('this memory holds no drawer this key opens');
      drawer = emptyDrawer();
      if (!(await rows.transact((draft) => draft.set(place, drawer)))) throw new Error('the ground’s memory refused its first write');
    }
    const ground = new Ground(options, keys, rows, place, drawer);
    await ground.#boot();
    return ground;
  }

  // The ladder, then the houses. The ground's hook and ready are its terrain's.
  async #boot(): Promise<void> {
    await this.#ladder();
    for (const [name, entry] of Object.entries(this.#drawer.houses)) {
      const ward = this.#drawer.wards[name];
      if (this.#options.lazy === true && ward !== undefined) {
        // Its door is hooked unopened: the first box opens it, then goes in.
        this.#houses.set(name, { entry, asleep: ward });
        await this.#carry.listen({ ward, door: (box) => this.#door(name, box) });
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
      const drawer = (await draft.get<Drawer>(this.#place)) ?? emptyDrawer();
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

  // ---- the ladder ----

  // Every faculty of the drawer stood in the ladder's order: each after the one its `from` names.
  async #ladder(): Promise<void> {
    const entries = this.#drawer.faculties;
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
      const from = entries[name]?.from;
      if (from !== undefined && Object.hasOwn(entries, from) && !GRANTED.has(from)) visit(from, [...path, name]);
      seen.set(name, 'done');
      order.push(name);
    };
    for (const name of Object.keys(entries).sort()) if (!GRANTED.has(name)) visit(name, []);
    for (const name of order) {
      if (this.#stood.get(name)?.faculty !== undefined) continue;
      const cycle = cycles.get(name);
      this.#stood.set(name, cycle === undefined ? await this.#stand(name, entries[name]) : { entry: entries[name], why: cycle });
    }
  }

  // One faculty made on its registry, with its args, its secrets and its sealed memory, or down and why.
  async #stand(name: string, entry: FacultyEntry): Promise<Stood> {
    const down = (why: string): Stood => ({ entry, why });
    let registry = this.#registry;
    if (entry.from !== undefined) {
      if (OWN.has(entry.from)) return down(`the faculty ${entry.from} carries no registry`);
      const below = this.#stood.get(entry.from);
      if (below === undefined) return down(`no faculty ${entry.from} stands here`);
      if (below.faculty === undefined) return down(`its registry ${entry.from} is down: ${below.why}`);
      if (below.faculty.registry === undefined) return down(`the faculty ${entry.from} carries no registry`);
      registry = below.faculty.registry;
    }
    const maker = entry.make === undefined ? undefined : registry.faculties?.[entry.make];
    if (maker === undefined) return down(`no maker ${entry.make} in ${entry.from ?? 'the ground’s registry'}`);
    const secrets: Record<string, string> = {};
    for (const secret of entry.secrets ?? []) {
      const value = this.#drawer.secrets[secret];
      if (value === undefined) return down(`no secret ${secret} is kept`);
      secrets[secret] = value;
    }
    try {
      const memory = new SealedMemory(new ViewMemory(this.#memory, await this.#prefix('faculty', name)), await this.#keys.derive(`faculty:${name}`, 32), this.#crypto, this.#tools);
      const faculty = await maker({ name, args: entry.args ?? {}, secrets, memory });
      if ((faculty.blueprint === undefined) !== (faculty.object === undefined)) {
        await faculty.stop?.();
        return down('a faculty offers a blueprint and an object together, or neither');
      }
      if (faculty.blueprint !== undefined) {
        try {
          offered(faculty.blueprint, `the faculty ${name}`);
        } catch (error) {
          await faculty.stop?.();
          throw error;
        }
      }
      return { entry, faculty };
    } catch (error) {
      return down(`it did not stand: ${message(error)}`);
    }
  }

  // After a faculty stands: each one down may stand now, and each house its absence kept closed opens.
  async #mended(): Promise<void> {
    for (const [name, stood] of [...this.#stood]) if (stood.faculty === undefined) this.#stood.delete(name);
    await this.#ladder();
    for (const [name, held] of [...this.#houses]) {
      if (held.opened !== undefined || held.asleep !== undefined) continue;
      await this.#byName(`house:${name}`, async () => {
        const now = this.#houses.get(name);
        if (now !== undefined && now.opened === undefined && now.asleep === undefined) this.#houses.set(name, await this.#open(name, now.entry));
      });
    }
  }

  // Who stands on a faculty: the houses that name it, and the faculties made on its registry.
  #users(name: string): string[] {
    const houses = Object.entries(this.#drawer.houses)
      .filter(([, entry]) => (entry.faculties ?? []).includes(name) || entry.classes.from === name || entry.memory?.from === name)
      .map(([house]) => `the house ${house}`);
    const faculties = Object.entries(this.#drawer.faculties)
      .filter(([, entry]) => entry.from === name)
      .map(([faculty]) => `the faculty ${faculty}`);
    return [...houses, ...faculties];
  }

  /**
   * A faculty stood on its entry, recorded in the drawer. The same name and
   * entry answer it as it stands; another entry under a name the drawer
   * holds is refused.
   */
  async stand(name: string, given: FacultyEntry): Promise<{ readonly why?: string }> {
    if (!NAME.test(name)) throw new TypeError(`a faculty is named with ${NAMED}`);
    const entry = facultyEntryOf(name, given);
    if (typeof entry === 'string') throw new TypeError(entry);
    return this.#byName(`faculty:${name}`, async () => {
      const held = this.#drawer.faculties[name];
      if (held !== undefined && this.#tools.canonical(held) !== this.#tools.canonical(entry)) throw new Error(`the faculty ${name} stands with another entry`);
      if (held === undefined) await this.#change((drawer) => void (drawer.faculties[name] = entry));
      if (GRANTED.has(name)) return {};
      await this.#mended();
      const why = this.#stood.get(name)?.why;
      return why === undefined ? {} : { why };
    });
  }

  /** A faculty stopped and its entry dropped, where no house and no faculty stands on it. */
  unstand(name: string): Promise<void> {
    return this.#byName(`faculty:${name}`, async () => {
      if (this.#drawer.faculties[name] === undefined) return;
      const users = GRANTED.has(name) ? [] : this.#users(name);
      if (users.length > 0) throw new Error(`the faculty ${name} is in use by ${users.join(', ')}`);
      const stood = this.#stood.get(name);
      this.#stood.delete(name);
      await stood?.faculty?.stop?.();
      await this.#change((drawer) => void delete drawer.faculties[name]);
    });
  }

  // ---- houses ----

  // The registry a body's entry names: the ground's own, or that of a faculty that stands.
  #registryOf(named: BodyNamed): Registry {
    if (named.from === undefined) return this.#registry;
    const below = this.#stood.get(named.from);
    if (below?.faculty === undefined) throw new Error(`the faculty ${named.from} is ${below === undefined ? 'not here' : `down: ${below.why}`}`);
    if (below.faculty.registry === undefined) throw new Error(`the faculty ${named.from} carries no registry`);
    return below.faculty.registry;
  }

  // A body made by its maker, or the reason there is none.
  static #made<T>(maker: ((made: BodyMade) => T | Promise<T>) | undefined, kind: string, named: BodyNamed, house: string): Promise<T> {
    if (maker === undefined) return Promise.reject(new Error(`no ${kind} body ${named.body} in ${named.from ?? 'the ground’s registry'}`));
    return Promise.resolve(maker({ house, args: argsOf(named) }));
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
      const stood = this.#stood.get(name);
      if (stood === undefined) return `no faculty ${name} stands here`;
      if (stood.faculty === undefined) return `the faculty ${name} is down: ${stood.why}`;
      const { blueprint, object, window } = stood.faculty;
      if (blueprint === undefined || object === undefined) return `the faculty ${name} offers beings nothing`;
      offers.push({ blueprint, object, ...(window === undefined ? {} : { window }), ...(stood.entry.kinds === undefined ? {} : { kinds: stood.entry.kinds }) });
    }
    return offers;
  }

  // The memory a house keeps its places in: the body its entry names, or its view of the ground's.
  async #houseMemory(name: string, entry: Entry): Promise<Memory> {
    if (entry.memory === undefined) return new ViewMemory(this.#memory, await this.#prefix('house', name));
    return Ground.#made(this.#registryOf(entry.memory).memory?.[entry.memory.body], 'memory', entry.memory, name);
  }

  // One house opened on the bodies its entry names, or closed and why.
  async #open(name: string, entry: Entry): Promise<Held> {
    try {
      const seed = this.#drawer.seeds[name];
      if (seed === undefined) return { entry, why: 'the drawer keeps no seed for it' };
      const offers = this.#offers(entry);
      if (typeof offers === 'string') return { entry, why: offers };
      const memory = await this.#houseMemory(name, entry);
      const classes = await Ground.#made(this.#registryOf(entry.classes).classes?.[entry.classes.body], 'classes', entry.classes, name);
      const clock = new HouseClock(this.#clock, name);
      const carry = new HouseCarry(this.#carry);
      const wait = entry.wait === undefined ? this.#wait : this.#wait === undefined ? entry.wait : Math.min(entry.wait, this.#wait);
      const opened = await openHouse(
        { keys: new SeedKeys(seed, this.#crypto), memory, classes, carry, clock, crypto: this.#crypto, tools: this.#tools },
        offers,
        wait === undefined ? {} : { wait },
      );
      await this.#carry.listen({ ward: opened.ward, door: (box) => this.#door(name, box) });
      if (this.#drawer.wards[name] !== opened.ward) await this.#change((drawer) => void (drawer.wards[name] = opened.ward));
      return { entry, opened, clock, carry, flight: new Set() };
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
    if (ward !== undefined) this.#carry.unlisten({ ward });
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

  /**
   * A house added to the drawer and opened. Its seed is drawn on first use.
   * The same name with the same entry answers the house as it stands;
   * another entry under a name the drawer holds is refused.
   */
  async add(name: string, given: Entry): Promise<Standing> {
    if (!NAME.test(name)) throw new TypeError(`a house is named with ${NAMED}`);
    const entry = entryOf(given);
    if (typeof entry === 'string') throw new TypeError(entry);
    return this.#byName(`house:${name}`, async () => {
      const held = this.#houses.get(name);
      if (held !== undefined) {
        if (this.#tools.canonical(held.entry) !== this.#tools.canonical(entry)) throw new Error(`the house ${name} stands with another entry`);
        // A house that did not open is tried again, as its entry stands.
        if (held.opened === undefined && held.asleep === undefined) this.#houses.set(name, await this.#open(name, entry));
        return this.list().find((standing) => standing.name === name)!;
      }
      const fresh = this.#drawer.seeds[name] === undefined ? this.#tools.hex(this.#crypto.random(32)) : undefined;
      await this.#change((drawer) => {
        drawer.houses[name] = entry;
        if (fresh !== undefined && drawer.seeds[name] === undefined) drawer.seeds[name] = fresh;
      });
      this.#houses.set(name, await this.#open(name, entry));
      return this.list().find((standing) => standing.name === name)!;
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

  // A faculty the hand may call: the ground's own, or one of the ladder that stands with an object.
  #callable(name: string): { readonly blueprint: unknown; readonly object: object } | string {
    const own = this.#own.get(name);
    if (own !== undefined) return own;
    const stood = this.#stood.get(name);
    if (stood === undefined) return `no faculty ${name}`;
    if (stood.faculty === undefined) return `the faculty ${name} is down: ${stood.why}`;
    const { blueprint, object } = stood.faculty;
    return blueprint === undefined || object === undefined ? `${name} offers no methods` : { blueprint, object };
  }

  /**
   * What the ground's hand shows its owner: every faculty with its methods,
   * or why it is down, each method's description, args, result and hints,
   * and every house. A face reads it and needs no code of its own for any
   * of them.
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
      if (stood.faculty === undefined) faculties[name] = { why: stood.why ?? 'down' };
      else faculties[name] = stood.faculty.blueprint === undefined ? { methods: {} } : shown(stood.faculty.blueprint);
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
   * The one handler the ground's listener chains: each standing faculty's
   * handler in the ladder's order, read as each request arrives, so a
   * faculty stood while the ground runs is served at once.
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

  #handlers(): readonly Handler[] {
    return [...this.#stood.values()].flatMap((stood) => (stood.faculty?.handler === undefined ? [] : [stood.faculty.handler]));
  }

  /** Every house closed through its bodies, then every faculty stopped, in the reverse of the ladder. */
  async close(): Promise<void> {
    const held = [...this.#houses.values()].reverse();
    this.#houses.clear();
    for (const one of held) await this.#close(one);
    const stood = [...this.#stood.values()].reverse();
    this.#stood.clear();
    for (const one of stood) await one.faculty?.stop?.();
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

  #housesFaculty(): object {
    return {
      add: ({ name, ...entry }: { name: string } & Entry) =>
        Ground.#answer(async () => {
          const standing = await this.add(name, entry);
          if (standing.ward === undefined) throw new Error(`the house ${name} did not open: ${standing.why}`);
          return { ward: standing.ward };
        }),
      remove: ({ name }: { name: string }) => Ground.#answer(async () => (await this.remove(name), null)),
      list: () => Ground.#answer(async () => this.list().map(({ name, ward, why }) => ({ name, ...(ward === undefined ? {} : { ward }), ...(why === undefined ? {} : { why }) }))),
    };
  }

  #facultiesFaculty(): object {
    return {
      add: ({ name, ...entry }: { name: string } & FacultyEntry) =>
        Ground.#answer(async () => {
          const { why } = await this.stand(name, entry);
          if (why !== undefined) throw new Error(`the faculty ${name} did not stand: ${why}`);
          return null;
        }),
      remove: ({ name }: { name: string }) => Ground.#answer(async () => (await this.unstand(name), null)),
      list: () =>
        Ground.#answer(async () =>
          Object.keys(this.#drawer.faculties).map((name) => {
            const why = this.#stood.get(name)?.why;
            return { name, ...(why === undefined ? {} : { why }) };
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
          if (!NAME.test(name)) throw new TypeError(`a house is named with ${NAMED}`);
          if (!/^[0-9a-f]{64}$/.test(seed)) throw new TypeError('a seed is sixty-four lowercase hex digits');
          if (this.#houses.has(name)) throw new Error(`the house ${name} stands here already`);
          const entry = entryOf(given);
          if (typeof entry === 'string') throw new TypeError(entry);
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
          const standing = await this.add(name, entry);
          if (standing.ward === undefined) throw new Error(`the house ${name} did not open: ${standing.why}`);
          return { ward: standing.ward };
        }),
    };
  }
}
