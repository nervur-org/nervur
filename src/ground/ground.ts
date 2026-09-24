// SPDX-License-Identifier: Apache-2.0
// The ground: the process houses run in, on any engine. It holds its own
// custody and memory before any house, keeps a record of its houses, and
// opens each on the bodies its entry names. It holds every door, every
// hand and every faculty, and closes a house through the bodies it handed
// the house, which is never asked to close.
import type { Json } from '../being/being.ts';
import { need, s } from '../being/index.ts';
import { blueprintOf, type Blueprint } from '../being/need.ts';
import { NobleCrypto } from '../bodies/noble-crypto.ts';
import { StrictTools } from '../bodies/strict-tools.ts';
import { WebClock } from '../bodies/web-clock.ts';
import type { Handler } from '../bodies/web-carry.ts';
import type { Carry, Classes, Clock, Crypto, Keys, Memory, Sent, Tools } from '../foundation.ts';
import { openHouse, type Answer, type FacultyContext, type Offer, type Opened } from '../house/house.ts';

/** A door, as a carry hooks it. */
export type Door = (box: Uint8Array) => Promise<Uint8Array | null>;

/** The ground's seeds, one for each house by its name. A seed is drawn on first use. */
export interface Custody {
  keys(options: { house: string }): Promise<Keys> | Keys;
}

/** A carry the ground hooks doors to, and unhooks them from. */
export interface Hooked extends Carry {
  listen(options: { ward: string; door: Door }): void | Promise<void>;
  unlisten(options: { ward: string }): void;
}

/** A faculty the ground made: an offer, with a handler for its listener and a stop. */
export interface Faculty extends Offer {
  readonly handler?: Handler;
  stop?(): void | Promise<void>;
}

/** What a body's maker receives: the house's name, the entry's arguments, and the ground's settings. */
export interface BodyArgs {
  readonly house: string;
  readonly args: Readonly<Record<string, Json>>;
}

/** The makers of each kind of foundation body a house may be handed, by name. */
export interface Bodies {
  readonly memory: Readonly<Record<string, (made: BodyArgs) => Memory | Promise<Memory>>>;
  readonly classes: Readonly<Record<string, (made: BodyArgs) => Classes | Promise<Classes>>>;
}

/** One body in an entry: the maker's name, and its arguments. */
export interface BodyNamed {
  readonly body: string;
  readonly [argument: string]: Json;
}

/** One house in the record: its bodies, its faculties, and its bound on every ask. */
export interface Entry {
  readonly memory: BodyNamed;
  readonly classes: BodyNamed;
  readonly faculties?: readonly string[];
  readonly wait?: number;
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
}

/** What `Ground.open` takes. Custody and memory are the terrain's defaults, never a custom body. */
export interface GroundOptions {
  readonly custody: Custody;
  readonly memory: Memory;
  readonly carry: Hooked;
  readonly bodies: Bodies;
  /** The faculties the ground made from its recipe, by name, already living. */
  readonly faculties?: Readonly<Record<string, Faculty>>;
  readonly clock?: Clock;
  readonly crypto?: Crypto;
  readonly tools?: Tools;
  /** The ground's bound on every ask of every house, in milliseconds. */
  readonly wait?: number;
}

const RECORD = 'houses';
const HOUSES = 'houses';
const NAME = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const body = { type: 'object', properties: { body: { type: 'string' } }, required: ['body'], additionalProperties: true } as const;

/** The blueprint of the ground's own faculty: its record, changed by whoever it is granted to. */
export const HousesBlueprint = need(HOUSES, {
  add: {
    description: 'Opens a house on the bodies its entry names; the same name and entry answer the same ward.',
    args: s.object({
      name: s.string(),
      memory: body,
      classes: body,
      faculties: s.optional(s.array(s.string())),
      wait: s.optional(s.integer({ minimum: 1 })),
    }),
    result: s.object({ ward: s.string() }),
    hints: { idempotent: true },
  },
  remove: {
    description: 'Closes a house and drops its entry; its seed and memory stay.',
    args: s.object({ name: s.string() }),
    hints: { idempotent: true },
  },
  list: {
    description: 'Every house in the record, open with its ward or closed with why.',
    result: s.array(s.object({ name: s.string(), ward: s.optional(s.string()), why: s.optional(s.string()) })),
    hints: { readOnly: true },
  },
});

// The ground's clock as one house sees it: its waits named apart from every
// other house's, and all cancelled when the ground closes it.
class HouseClock implements Clock {
  readonly #clock: Clock;
  readonly #prefix: string;
  readonly #waits = new Map<string, number>();
  #turn = 0;
  #closed = false;

  constructor(clock: Clock, house: string) {
    this.#clock = clock;
    this.#prefix = `${house}\n`;
  }

  now(): number {
    return this.#clock.now();
  }

  async wait({ id, ms }: { id: string; ms: number }): Promise<boolean> {
    if (this.#closed) return false;
    const turn = ++this.#turn;
    this.#waits.set(id, turn);
    try {
      return await this.#clock.wait({ id: this.#prefix + id, ms });
    } finally {
      if (this.#waits.get(id) === turn) this.#waits.delete(id);
    }
  }

  cancel({ id }: { id: string }): void {
    this.#clock.cancel({ id: this.#prefix + id });
  }

  close(): void {
    this.#closed = true;
    for (const id of this.#waits.keys()) this.#clock.cancel({ id: this.#prefix + id });
  }
}

// The ground's carry as one house sees it: silent once the ground closes it.
class HouseCarry implements Carry {
  readonly #carry: Carry;
  #closed = false;

  constructor(carry: Carry) {
    this.#carry = carry;
  }

  send(options: { ward: string; at: readonly string[]; box: Uint8Array }): Promise<Sent> {
    return this.#closed ? Promise.resolve({ reply: null, heard: false }) : this.#carry.send(options);
  }

  at(options: { toward?: string } = {}): readonly string[] {
    return this.#carry.at(options);
  }

  close(): void {
    this.#closed = true;
  }
}

interface Held {
  readonly entry: Entry;
  readonly opened?: Opened;
  readonly clock?: HouseClock;
  readonly carry?: HouseCarry;
  readonly why?: string;
}

const entryOf = (value: unknown): Entry | string => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return 'an entry is an object';
  const { memory, classes, faculties, wait, ...rest } = value as Record<string, unknown>;
  if (Object.keys(rest).length > 0) return `an entry names ${Object.keys(rest).join(', ')}, which no entry holds`;
  const named = (held: unknown, what: string): BodyNamed | string =>
    typeof held === 'object' && held !== null && !Array.isArray(held) && typeof (held as { body?: unknown }).body === 'string' ? (held as BodyNamed) : `an entry's ${what} names no body`;
  const memoryNamed = named(memory, 'memory');
  if (typeof memoryNamed === 'string') return memoryNamed;
  const classesNamed = named(classes, 'classes');
  if (typeof classesNamed === 'string') return classesNamed;
  if (faculties !== undefined && !(Array.isArray(faculties) && faculties.every((name) => typeof name === 'string'))) return "an entry's faculties are a list of names";
  if (wait !== undefined && !(Number.isSafeInteger(wait) && (wait as number) > 0)) return "an entry's wait is whole milliseconds above zero";
  return { memory: memoryNamed, classes: classesNamed, ...(faculties === undefined ? {} : { faculties }), ...(wait === undefined ? {} : { wait: wait as number }) };
};

const argsOf = ({ body: _body, ...args }: BodyNamed): Readonly<Record<string, Json>> => args;

export class Ground {
  readonly #custody: Custody;
  readonly #memory: Memory;
  readonly #carry: Hooked;
  readonly #bodies: Bodies;
  readonly #faculties: ReadonlyMap<string, Faculty>;
  readonly #clock: Clock;
  readonly #crypto: Crypto;
  readonly #tools: Tools;
  readonly #wait: number | undefined;
  readonly #houses = new Map<string, Held>();
  // Changes of the record, one at a time, each on the version the last left.
  #turn: Promise<unknown> = Promise.resolve();
  #version: string | null = null;

  private constructor(options: GroundOptions) {
    this.#custody = options.custody;
    this.#memory = options.memory;
    this.#carry = options.carry;
    this.#bodies = options.bodies;
    this.#clock = options.clock ?? new WebClock();
    this.#crypto = options.crypto ?? new NobleCrypto();
    this.#tools = options.tools ?? new StrictTools();
    this.#wait = options.wait;
    const faculties = new Map(Object.entries(options.faculties ?? {}));
    if (faculties.has(HOUSES)) throw new TypeError(`the faculty ${HOUSES} is the ground's own`);
    faculties.set(HOUSES, { blueprint: HousesBlueprint, object: this.#housesFaculty() });
    this.#faculties = faculties;
  }

  /** A ground on its own custody and memory, every house of its record opened. */
  static async open(options: GroundOptions): Promise<Ground> {
    const ground = new Ground(options);
    await ground.#boot();
    return ground;
  }

  async #boot(): Promise<void> {
    const read = await this.#memory.read({ place: RECORD });
    this.#version = read.version;
    for (const [name, bytes] of Object.entries(read.entries)) {
      const parsed = this.#tools.parse(this.#tools.text(bytes) ?? '');
      const entry = parsed === null ? 'the record holds no JSON for it' : entryOf(parsed.value);
      if (typeof entry === 'string') {
        this.#houses.set(name, { entry: { memory: { body: '' }, classes: { body: '' } }, why: entry });
        continue;
      }
      this.#houses.set(name, await this.#open(name, entry));
    }
  }

  // One house opened on the bodies its entry names, or closed and why.
  async #open(name: string, entry: Entry): Promise<Held> {
    try {
      const memory = this.#bodies.memory[entry.memory.body];
      if (memory === undefined) return { entry, why: `no memory body ${entry.memory.body}` };
      const classes = this.#bodies.classes[entry.classes.body];
      if (classes === undefined) return { entry, why: `no classes body ${entry.classes.body}` };
      const offers: Offer[] = [];
      for (const faculty of entry.faculties ?? []) {
        const offer = this.#faculties.get(faculty);
        if (offer === undefined) return { entry, why: `no faculty ${faculty}` };
        offers.push(offer);
      }
      const clock = new HouseClock(this.#clock, name);
      const carry = new HouseCarry(this.#carry);
      const wait = entry.wait === undefined ? this.#wait : this.#wait === undefined ? entry.wait : Math.min(entry.wait, this.#wait);
      const opened = await openHouse(
        {
          keys: await this.#custody.keys({ house: name }),
          memory: await memory({ house: name, args: argsOf(entry.memory) }),
          classes: await classes({ house: name, args: argsOf(entry.classes) }),
          carry,
          clock,
          crypto: this.#crypto,
          tools: this.#tools,
        },
        offers,
        wait === undefined ? {} : { wait },
      );
      await this.#carry.listen({ ward: opened.ward, door: (box) => this.#door(name, box) });
      return { entry, opened, clock, carry };
    } catch (error) {
      return { entry, why: error instanceof Error ? error.message : String(error) };
    }
  }

  // A box for a house the ground still holds open, and nothing for one it closed.
  async #door(name: string, box: Uint8Array): Promise<Uint8Array | null> {
    const opened = this.#houses.get(name)?.opened;
    return opened === undefined ? null : opened.door(box);
  }

  #close(held: Held): void {
    held.clock?.close();
    held.carry?.close();
    if (held.opened !== undefined) this.#carry.unlisten({ ward: held.opened.ward });
  }

  // The record changed by one entry, landing on the version last read.
  #record(name: string, entry: Entry | null): Promise<void> {
    const change = this.#turn.then(async () => {
      const bytes = entry === null ? null : this.#tools.utf8(this.#tools.canonical(entry));
      const landed = await this.#memory.write({ writes: { [RECORD]: { [name]: bytes } }, expect: { [RECORD]: this.#version } });
      if (landed === null) throw new Error('the ground’s memory moved under it: another instance writes here');
      this.#version = landed[RECORD] ?? null;
    });
    this.#turn = change.catch(() => undefined);
    return change;
  }

  /** Every house in the record, open with its ward, or closed and why. */
  list(): readonly Standing[] {
    return [...this.#houses].map(([name, held]) => ({
      name,
      entry: held.entry,
      ...(held.opened === undefined ? {} : { ward: held.opened.ward }),
      ...(held.why === undefined ? {} : { why: held.why }),
    }));
  }

  /**
   * A house added to the record and opened. Its seed is drawn in custody on
   * first use. The same name with the same entry answers the house as it
   * stands; another entry under a name the record holds is refused.
   */
  async add(name: string, given: Entry): Promise<Standing> {
    if (!NAME.test(name)) throw new TypeError('a house is named with lowercase letters, digits, dots, dashes and underscores, at most sixty-four');
    const entry = entryOf(given);
    if (typeof entry === 'string') throw new TypeError(entry);
    const held = this.#houses.get(name);
    if (held !== undefined) {
      if (this.#tools.canonical(held.entry) !== this.#tools.canonical(entry)) throw new Error(`the house ${name} stands with another entry`);
      // A house that did not open is tried again, as its entry stands.
      if (held.opened === undefined) this.#houses.set(name, await this.#open(name, entry));
      return this.list().find((standing) => standing.name === name)!;
    }
    await this.#record(name, entry);
    this.#houses.set(name, await this.#open(name, entry));
    return this.list().find((standing) => standing.name === name)!;
  }

  /** A house closed and dropped from the record. Its seed and memory stay, so adding it again opens the same ward. */
  async remove(name: string): Promise<void> {
    const held = this.#houses.get(name);
    if (held === undefined) return;
    this.#houses.delete(name);
    this.#close(held);
    await this.#record(name, null);
  }

  /** The hand: a house by its name, and a being in it by id, asked as `root`. */
  async ask({ house, ...request }: HandAsk): Promise<Answer | { readonly describe: Json }> {
    const opened = this.#houses.get(house)?.opened;
    if (opened === undefined) return { error: { message: `no house ${house} is open here` } };
    return opened.ask(request);
  }

  /**
   * The ground's hand, one request at a time, as every terrain serves it:
   * `describe`, a faculty's method, or an ask of a being in a named house.
   */
  hand(request: { readonly describe?: true; readonly faculty?: string; readonly house?: string; readonly id?: string; readonly method?: string; readonly args?: Json; readonly after?: Answer }): Promise<Answer | { readonly describe: Json }> {
    const { describe, faculty, house, id, method, args, after } = request;
    if (describe === true) return Promise.resolve({ result: this.describe() as unknown as Json });
    if (faculty !== undefined) {
      if (method === undefined) return Promise.resolve({ error: { message: `a call on ${faculty} names a method` } });
      return this.call({ faculty, method, ...(args === undefined ? {} : { args }), ...(id === undefined ? {} : { id }) });
    }
    if (house === undefined) return Promise.resolve({ error: { message: 'the hand names a house, a faculty, or describe' } });
    return this.ask({ house, ...(id === undefined ? {} : { id }), ...(method === undefined ? {} : { method }), ...(args === undefined ? {} : { args }), ...(after === undefined ? {} : { after }) });
  }

  /**
   * What the ground's hand shows its owner: every faculty with its
   * methods, each method's description, args, result and hints, and every
   * house. A face reads it and needs no code of its own for any of them.
   */
  describe(): { readonly faculties: Readonly<Record<string, Json>>; readonly houses: readonly Standing[] } {
    const faculties: Record<string, Json> = {};
    for (const [name, faculty] of this.#faculties) {
      const blueprint = blueprintOf(faculty.blueprint) ?? (faculty.blueprint as Blueprint);
      faculties[name] = {
        blueprint: blueprint.name,
        methods: Object.fromEntries(
          Object.entries(blueprint.methods).map(([method, spec]) => [
            method,
            JSON.parse(JSON.stringify({ description: spec.description, args: spec.args, result: spec.result, hints: spec.hints })) as Json,
          ]),
        ),
      };
    }
    return { faculties, houses: this.list() };
  }

  /**
   * A faculty's method called by the ground's owner, through its hand. The
   * args are held to the method's schema. It holds no token of any house,
   * so a call it makes back answers an error.
   */
  async call({ faculty: name, method, args = {}, id }: { faculty: string; method: string; args?: Json; id?: string }): Promise<Answer> {
    const faculty = this.#faculties.get(name);
    if (faculty === undefined) return { error: { message: `no faculty ${name}` } };
    const blueprint = blueprintOf(faculty.blueprint) ?? (faculty.blueprint as Blueprint);
    const spec = blueprint.methods[method];
    const run = (faculty.object as Record<string, unknown>)[method];
    if (spec === undefined || typeof run !== 'function') return { error: { message: `${name} has no method ${method}` } };
    const why = this.#tools.check(spec.args, args);
    if (why !== null) return { error: { message: why } };
    const context: FacultyContext = {
      id: id ?? this.#tools.hex(this.#crypto.random(16)),
      call: () => Promise.resolve({ error: { message: 'the hand holds no token' } }),
    };
    try {
      const answered = (await (run as (args: Json, context: FacultyContext) => Promise<unknown>).call(faculty.object, args, context)) as Answer;
      return typeof answered === 'object' && answered !== null && ('result' in answered || 'error' in answered) ? answered : { error: { message: `${name} answered no answer` } };
    } catch (error) {
      return { error: { message: error instanceof Error ? error.message : String(error) } };
    }
  }

  /** The handlers of the faculties that carry one, in the order the ground was handed them. */
  get handlers(): readonly Handler[] {
    return [...this.#faculties.values()].flatMap((faculty) => (faculty.handler === undefined ? [] : [faculty.handler]));
  }

  /** Every house closed through its bodies, then every faculty stopped, in reverse. */
  async close(): Promise<void> {
    for (const held of [...this.#houses.values()].reverse()) this.#close(held);
    this.#houses.clear();
    for (const faculty of [...this.#faculties.values()].reverse()) await faculty.stop?.();
  }

  // The ground's own faculty, answering whoever the record grants it to.
  #housesFaculty(): object {
    const answer = async (work: () => Promise<Json>) => {
      try {
        return { result: await work() };
      } catch (error) {
        return { error: { message: error instanceof Error ? error.message : String(error) } };
      }
    };
    return {
      add: ({ name, ...entry }: { name: string } & Entry) =>
        answer(async () => {
          const standing = await this.add(name, entry);
          if (standing.ward === undefined) throw new Error(`the house ${name} did not open: ${standing.why}`);
          return { ward: standing.ward };
        }),
      remove: ({ name }: { name: string }) => answer(async () => (await this.remove(name), null)),
      list: () => answer(async () => this.list().map(({ name, ward, why }) => ({ name, ...(ward === undefined ? {} : { ward }), ...(why === undefined ? {} : { why }) }))),
    };
  }
}
