// SPDX-License-Identifier: Apache-2.0
// A ground in memory. It joins a FakeNetwork under its host, keeps its
// seeds, its record and each house's memory in a machine that outlives it,
// and opens house modules by name. So a test turns it off, opens it again
// on the same machine, or moves the machine to another host.
import { ClassList } from '../bodies/class-list.ts';
import type { BeingClass, Memory } from '../foundation.ts';
import { Ground, type Bodies, type Faculty, type HandAsk, type Standing, type Entry } from '../ground/ground.ts';
import type { FakeClock } from './fake-clock.ts';
import { FakeCustody } from './fake-custody.ts';
import { FakeMemory } from './fake-memory.ts';
import type { FakeNetwork } from './fake-network.ts';

/** A house module: what a folder's index exports. */
export interface HouseModule {
  readonly steward: BeingClass;
  readonly public?: BeingClass;
  readonly beings?: readonly BeingClass[];
}

/** What a ground keeps across its lives: its seeds, its record, and each house's memory. */
export class Machine {
  readonly custody: FakeCustody;
  readonly memory = new FakeMemory();
  readonly houses = new Map<string, FakeMemory>();

  constructor(seed: string) {
    this.custody = new FakeCustody(seed);
  }

  memoryOf(house: string): Memory {
    return this.houses.get(house) ?? this.houses.set(house, new FakeMemory()).get(house)!;
  }
}

export interface BenchGroundOptions {
  readonly network: FakeNetwork;
  /** Its host on the network. */
  readonly host: string;
  /** The names that point at it; a ground with none is a device, and is never dialled. */
  readonly names?: readonly string[];
  readonly clock: FakeClock;
  /** The house modules its entries name, by name. */
  readonly modules?: Readonly<Record<string, HouseModule>>;
  readonly faculties?: Readonly<Record<string, Faculty>>;
  /** Custom bodies beside the bench's own `fake` memory and `module` classes, as a recipe adds them. */
  readonly bodies?: Partial<Bodies>;
  /** The machine it opens on; a fresh one, seeded by its host, where none is named. */
  readonly machine?: Machine;
}

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

  /** The ground on its machine again, joined to the network, every house of its record open. */
  async up(): Promise<void> {
    if (this.#ground !== undefined) return;
    const { network, host, names = [], clock, modules = {}, faculties = {}, bodies = {} } = this.#options;
    network.up(host);
    const carry = network.join(host, { names, listens: names.length > 0 });
    // The bench's own bodies, and the test's beside them, never in their place.
    const joined = <T>(own: Readonly<Record<string, T>>, added: Readonly<Record<string, T>> = {}): Readonly<Record<string, T>> => {
      for (const name of Object.keys(added)) if (name in own) throw new TypeError(`the body ${name} is the bench's own`);
      return { ...own, ...added };
    };
    this.#ground = await Ground.open({
      custody: this.machine.custody,
      memory: this.machine.memory,
      carry,
      clock,
      faculties,
      bodies: {
        memory: joined({ fake: ({ house }) => this.machine.memoryOf(house) }, bodies.memory),
        classes: joined(
          {
            module: ({ args }) => {
              const module = modules[args.name as string];
              if (module === undefined) throw new Error(`no house module ${String(args.name)}`);
              return new ClassList({ steward: module.steward, ...(module.public === undefined ? {} : { public: module.public }), beings: module.beings ?? [] });
            },
          },
          bodies.classes,
        ),
      },
    });
  }

  /** The ground off: its houses closed, its host answering nothing. Its machine keeps everything. */
  async down(): Promise<void> {
    const ground = this.#ground;
    if (ground === undefined) return;
    this.#ground = undefined;
    await ground.close();
    this.#options.network.down(this.host);
  }

  /** A house of a module by that module's name, on fake memory. */
  /**
   * A house: of a module by that module's name, on fake memory, or on the
   * whole entry the test gives, custom bodies and all.
   */
  add(name: string, from: string | Entry = name, rest: Omit<Entry, 'memory' | 'classes'> = {}): Promise<Standing> {
    return this.#live().add(name, typeof from === 'string' ? { memory: { body: 'fake' }, classes: { body: 'module', name: from }, ...rest } : from);
  }

  remove(name: string): Promise<void> {
    return this.#live().remove(name);
  }

  list(): readonly Standing[] {
    return this.#live().list();
  }

  ask(request: HandAsk): ReturnType<Ground['ask']> {
    return this.#live().ask(request);
  }
}
