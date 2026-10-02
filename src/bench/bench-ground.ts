// SPDX-License-Identifier: Apache-2.0
// A ground in memory. It joins a FakeNetwork under its host, keeps its key
// and its memory in a machine that outlives it, and opens house modules by
// name. So a test turns it off, opens it again on the same machine, or
// moves the machine to another host. Each faculty stands its fake here, so
// a faculty that needs its terrain stands only as its stand-in.
import { s } from '../being/index.ts';
import { Carry, Classes, Clock, Crypto, Faculty, Ground, Hand, Memory, OK, Unlock, type ClassesSource, type FacultyClass, type ForHouse, type Handler, type Made, type OpenedContext, type Registry, type Status } from '../index.ts';
import { FakeMemory } from './fake-memory.ts';
import { clockOf, type FakeNetwork } from './fake-network.ts';
import { FakeUnlock } from './fake-unlock.ts';
import { SeededCrypto } from './seeded.ts';
import { watchedStart } from './settle.ts';

type Entry = Parameters<Ground['add']>[1];
type Standing = Awaited<ReturnType<Ground['add']>>;

/**
 * A house module: a module file, by its URL, exporting what a folder's
 * index exports, or the modules a source names. Its classes load in the
 * house's own runner, never in the test's process.
 */
export type HouseModule = URL | string | ClassesSource;

// A house module as the runner loads it.
const sourceOf = (module: HouseModule): ClassesSource => (module instanceof URL ? { modules: [module.href] } : typeof module === 'string' ? { modules: [module] } : module);

/** A body the test writes, living: its blueprint and the object that answers it, its window, its handler, and the kinds it is granted. */
export interface Living {
  readonly blueprint: unknown;
  readonly object: object;
  readonly window?: number;
  /** What it answers on the ground's one listener, as a face does. */
  readonly handler?: Handler;
  readonly kinds?: readonly string[];
  opened?(context: OpenedContext): void | Promise<void>;
  down?(): void | Promise<void>;
}

const NONE = { args: s.object({}) } as const;

// Every method an object holds, its own and its class's, bound to it, set on a body that has none of that name.
const forward = (body: Faculty, object: object): void => {
  for (let at: object | null = object; at !== null && at !== Object.prototype; at = Object.getPrototypeOf(at) as object | null) {
    for (const name of Object.getOwnPropertyNames(at)) {
      const value = (object as Record<string, unknown>)[name];
      if (name !== 'constructor' && typeof value === 'function' && !(name in body)) (body as unknown as Record<string, unknown>)[name] = (value as (...args: unknown[]) => unknown).bind(object);
    }
  }
};

// A faculty whose body is what the test wrote: its object's methods, its window, and what it is told and lets go.
const living = ({ blueprint, object, window, handler, opened, down }: Living): FacultyClass =>
  class LivingFaculty extends Faculty {
    static override readonly blueprint = blueprint;
    static override readonly takes = NONE;
    static override readonly window = window;
    constructor(made: Made) {
      super(made);
      forward(this, object);
      if (handler !== undefined) this.handler = handler;
      if (opened !== undefined) this.opened = opened;
    }
    override async down(): Promise<void> {
      await down?.();
    }
  };

// A faculty the bench stands for a part of its machine: the contract it fills, and the object that fills it.
const part = (blueprint: unknown, object: (made: Made) => object, parts: { readonly schemes?: readonly string[]; house?(options: ForHouse): unknown } = {}): FacultyClass =>
  class Part extends Faculty {
    static override readonly blueprint = blueprint;
    static override readonly takes = NONE;
    override up(): Status {
      forward(this, object(this.made));
      if (parts.schemes !== undefined) this.schemes = parts.schemes;
      if (parts.house !== undefined) this.house = parts.house;
      return OK;
    }
  };

// Registries' faculties as one, the first first: a name one holds is refused to the next, never replaced.
const joined = (...each: readonly Readonly<Record<string, FacultyClass>>[]): Record<string, FacultyClass> => {
  const all: Record<string, FacultyClass> = {};
  for (const faculties of each) {
    for (const [name, faculty] of Object.entries(faculties)) {
      if (Object.hasOwn(all, name)) throw new TypeError(`the faculty ${name} is the bench's own`);
      all[name] = faculty;
    }
  }
  return all;
};

/** What a ground keeps across its lives: its key, its randomness, its memory, and each house's own where it names the `fake` body. */
export class Machine {
  readonly unlock: FakeUnlock;
  // One stream across every life, so a ground opened again never draws the bytes it drew before.
  readonly crypto: SeededCrypto;
  readonly memory = new FakeMemory();
  readonly houses = new Map<string, FakeMemory>();

  constructor(seed: string) {
    this.unlock = new FakeUnlock(seed);
    this.crypto = new SeededCrypto(seed);
  }

  /** The memory of a house on the `fake` body, which a test may have refuse its next writes. */
  memoryOf(house: string): FakeMemory {
    return this.houses.get(house) ?? this.houses.set(house, new FakeMemory()).get(house)!;
  }
}

export interface BenchGroundOptions {
  /** The network it joins, whose clock it reads. */
  readonly network: FakeNetwork;
  /** Its host on the network. */
  readonly host: string;
  /** The names that point at it; a ground with none is a device, and is never dialled. */
  readonly names?: readonly string[];
  /** The house modules its entries name, by name: module files, whose classes load in each house's runner. */
  readonly modules?: Readonly<Record<string, HouseModule>>;
  /** Faculties the test hands living, by name: each stands on its first up, granted the kinds it names. */
  readonly faculties?: Readonly<Record<string, Living>>;
  /** Makers beside the bench's own `module` classes and `fake` memory, as a host installs them. */
  readonly registry?: Registry;
  /** The machine it opens on; a fresh one, seeded by its host, where none is named. */
  readonly machine?: Machine;
}

// An address resolved from where `nervur` is installed, as a NodeGround resolves it: the test's own install.
const installed = (address: string): Promise<unknown> => import(address);

export class BenchGround {
  readonly host: string;
  readonly machine: Machine;
  readonly #options: BenchGroundOptions;
  #ground: Ground | undefined;

  private constructor(options: BenchGroundOptions, machine: Machine) {
    this.host = options.host;
    this.machine = machine;
    this.#options = options;
  }

  static async open(options: BenchGroundOptions): Promise<BenchGround> {
    const bench = new BenchGround(options, options.machine ?? new Machine(options.host));
    await bench.up();
    return bench;
  }

  #live(): Ground {
    if (this.#ground === undefined) throw new Error(`the ground ${this.host} is down`);
    return this.#ground;
  }

  /** The ground on its machine again, joined to the network, its ladder standing and every house its dock holds open. */
  async up(): Promise<void> {
    if (this.#ground !== undefined) return;
    const { network, host, names = [], modules = {}, faculties = {}, registry = {} } = this.#options;
    network.up(host);
    const machine = this.machine;
    // Each living body the test hands stands through a faculty whose body is it, as any body stands.
    const lives: Record<string, FacultyClass> = Object.fromEntries(Object.entries(faculties).map(([name, body]) => [name, living(body)]));
    const own: Registry = {
      faculties: {
        'bench-unlock': part(Unlock, () => machine.unlock),
        'bench-memory': part(Memory, () => machine.memory),
        seeded: part(Crypto, () => machine.crypto),
        // The test holds the hand in its own process, so this hand listens on nothing.
        'bench-hand': part(Hand, () => ({})),
        'bench-clock': part(Clock, () => clockOf(network)),
        // Its listener on the network is the ground's one.
        'bench-carry': part(
          Carry,
          ({ listener }) => {
            const serve = async (request: Request) => (await listener.fetch(request)) ?? new Response(null, { status: 404 });
            return network.join(host, { names, listens: names.length > 0, serve });
          },
          { schemes: ['bench'] },
        ),
        fake: part(Memory, () => ({}), { house: ({ house }) => machine.memoryOf(house) }),
        module: part(Classes, () => ({}), {
          house: ({ args }) => {
            const module = modules[args.name as string];
            if (module === undefined) throw new Error(`no house module ${String(args.name)}`);
            return sourceOf(module);
          },
        }),
      },
    };
    this.#ground = await Ground.open({
      // The bench's own faculties, then the test's beside them, never in their place.
      registry: { faculties: joined(own.faculties ?? {}, lives, registry.faculties ?? {}) },
      primordial: { unlock: { make: 'bench-unlock' }, memory: { make: 'bench-memory' }, crypto: { make: 'seeded' }, tools: { make: 'strict' }, clock: { make: 'bench-clock' }, hand: { make: 'bench-hand' } },
      entries: { carry: { make: 'bench-carry' }, module: { make: 'module' }, fake: { make: 'fake' } },
      // A faculty stands its fake here, and one that needs its terrain and has none stays down.
      fakes: true,
      // An address stands what it stands on a NodeGround, imported from the test's install.
      image: installed,
      // Every house runs contained, its randomness drawn from the machine's stream, so the bench runs the same twice.
      // A house idle a second sleeps, its thread free for the next, and opens again from memory when reached.
      runner: { start: watchedStart, idle: 1_000, seed:() => Array.from(machine.crypto.random(32), (byte) => byte.toString(16).padStart(2, '0')).join('') },
    });
    // Each living faculty stands on its first up, as its owner would stand it through the hand.
    for (const [name, { kinds }] of Object.entries(faculties)) {
      const { why } = await this.#ground.stand(name, { make: name, ...(kinds === undefined ? {} : { kinds }) });
      if (why !== undefined) throw new Error(`the faculty ${name} did not stand: ${why}`);
    }
  }

  /** The ground off: its houses closed, its host answering nothing. Its machine keeps everything. */
  async down(): Promise<void> {
    const ground = this.#ground;
    if (ground === undefined) return;
    this.#ground = undefined;
    await ground.close();
    this.#options.network.down(this.host);
  }

  /**
   * A house: of a module by that module's name, keeping its places in the
   * ground's memory, or on the whole entry the test gives, custom bodies
   * and all.
   */
  add(name: string, from: string | Entry = name, rest: Omit<Entry, 'classes'> = {}): Promise<Standing> {
    return this.#live().add(name, typeof from === 'string' ? { classes: { faculty: 'module', name: from }, ...rest } : from);
  }

  remove(name: string): Promise<void> {
    return this.#live().remove(name);
  }

  list(): readonly Standing[] {
    return this.#live().list();
  }

  /** A being in a house asked as `root`, the house's steward where no id is named. */
  ask(request: Parameters<Ground['ask']>[0]): ReturnType<Ground['ask']> {
    return this.#live().ask(request);
  }

  /** The ground's hand, as its owner holds it: `describe`, or an ask of a being in a house, or of the dock's steward where no house is named. */
  hand(request: Parameters<Ground['hand']>[0]): ReturnType<Ground['hand']> {
    return this.#live().hand(request);
  }

  /**
   * A request to the ground's one listener, with no socket: each faculty's
   * handler in turn, the first answer standing, and 404 where none takes it.
   */
  async fetch(request: Request): Promise<Response> {
    return (await this.#live().handler.fetch(request)) ?? new Response(null, { status: 404 });
  }
}
