// SPDX-License-Identifier: Apache-2.0
// A ground in memory. It joins a FakeNetwork under its host, keeps its key
// and its memory in a machine that outlives it, and opens house modules by
// name. So a test turns it off, opens it again on the same machine, or
// moves the machine to another host.
import { ClassList, Ground, type Faculty, type Registry } from '../index.ts';
import { FakeMemory } from './fake-memory.ts';
import { clockOf, type FakeNetwork } from './fake-network.ts';
import { FakeUnlock } from './fake-unlock.ts';
import { SeededCrypto } from './seeded.ts';

type BeingClass = ConstructorParameters<typeof ClassList>[0]['steward'];
type Entry = Parameters<Ground['add']>[1];
type HandAsk = Parameters<Ground['ask']>[0];
type Standing = Awaited<ReturnType<Ground['add']>>;

/** A house module: what a folder's index exports. */
export interface HouseModule {
  readonly steward: BeingClass;
  readonly public?: BeingClass;
  readonly beings?: readonly BeingClass[];
}

/** A faculty the test writes, living, with the kinds it is granted. */
export type Living = Faculty & { readonly kinds?: readonly string[] };

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
  /** The house modules its entries name, by name. */
  readonly modules?: Readonly<Record<string, HouseModule>>;
  /** Faculties the test hands living, by name: each stands on its first up, granted the kinds it names. */
  readonly faculties?: Readonly<Record<string, Living>>;
  /** Makers beside the bench's own `module` classes and `fake` memory, as a host installs them. */
  readonly registry?: Registry;
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

  /** The ground on its machine again, joined to the network, its ladder standing and every house of its drawer open. */
  async up(): Promise<void> {
    if (this.#ground !== undefined) return;
    const { network, host, names = [], modules = {}, faculties = {}, registry = {} } = this.#options;
    network.up(host);
    const carry = network.join(host, { names, listens: names.length > 0, serve: (request) => this.fetch(request) });
    // The bench's own makers, and the test's beside them, never in their place.
    const joined = <T>(kind: string, own: Readonly<Record<string, T>>, added: Readonly<Record<string, T>> = {}): Readonly<Record<string, T>> => {
      for (const name of Object.keys(added)) if (Object.hasOwn(own, name)) throw new TypeError(`the ${kind} ${name} is the bench's own`);
      return { ...own, ...added };
    };
    const living = Object.fromEntries(Object.entries(faculties).map(([name, { kinds: _kinds, ...faculty }]) => [name, () => faculty]));
    this.#ground = await Ground.open({
      unlock: this.machine.unlock,
      memory: this.machine.memory,
      carry,
      clock: clockOf(network),
      crypto: this.machine.crypto,
      registry: {
        faculties: joined('faculty', living, registry.faculties),
        memory: joined('body', { fake: ({ house }) => this.machine.memoryOf(house) }, registry.memory),
        classes: joined(
          'body',
          {
            module: ({ args }) => {
              const module = modules[args.name as string];
              if (module === undefined) throw new Error(`no house module ${String(args.name)}`);
              return new ClassList({ steward: module.steward, ...(module.public === undefined ? {} : { public: module.public }), beings: module.beings ?? [] });
            },
          },
          registry.classes,
        ),
      },
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
    return this.#live().add(name, typeof from === 'string' ? { classes: { body: 'module', name: from }, ...rest } : from);
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

  /** The ground's hand, as its owner holds it: `describe`, a faculty's method, or an ask of a being. */
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
