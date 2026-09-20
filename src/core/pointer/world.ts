// SPDX-License-Identifier: Apache-2.0
// The pointer world: harbors in one process, an address book from ward pk
// to harbor that stands in for the internet, and weather between them. A
// restart drops a harbor and opens a new one on the terrain the world
// keeps for it, so only what its memory kept comes back.
import { Carrier, type Clock, type Custody, type Entropy, type Loader, type Memory } from '../contract/index.ts';
import { Harbor, Terrain, type Defaults, type Sockets, type WebServe } from '../harbor/index.ts';
import { CryptoEntropy, HeldCustody, SourceLoader, SystemClock, VolatileMemory } from './bodies.ts';

// A carrier that reaches no one: a harbor alone.
export class NoCarrier extends Carrier {
  carry(): Promise<Uint8Array | null> {
    return Promise.resolve(null);
  }
}

// Bytes to whichever harbor of a world holds the ward pk.
export class PointerCarrier extends Carrier {
  readonly #world: World;
  constructor(world: World) {
    super();
    this.#world = world;
  }
  carry(pk: string, bytes: Uint8Array): Promise<Uint8Array | null> {
    return this.#world.carry(pk, bytes);
  }
}

// The bodies a pointer terrain is built of, each the pointer's own where
// none is handed, save the defaults, which the core never names and an
// entry always hands.
export type PointerParts = {
  entropy?: Entropy;
  clock?: Clock;
  custody?: Custody;
  memory?: Memory;
  carrier?: Carrier;
  loader?: Loader;
  tcp?: () => Sockets;
  web?: WebServe;
  defaults: Defaults;
  wakes?: boolean;
};

export class PointerTerrain extends Terrain {
  readonly entropy: Entropy;
  readonly clock: Clock;
  readonly custody: Custody;
  readonly memory: Memory;
  readonly carrier: Carrier;
  readonly loader: Loader;
  readonly defaults: Defaults;
  override readonly tcp: (() => Sockets) | undefined;
  override readonly web: WebServe | undefined;
  override readonly wakes: boolean;

  constructor(parts: PointerParts) {
    super();
    this.entropy = parts.entropy ?? new CryptoEntropy();
    this.clock = parts.clock ?? new SystemClock();
    this.custody = parts.custody ?? new HeldCustody(this.entropy);
    this.memory = parts.memory ?? new VolatileMemory();
    this.carrier = parts.carrier ?? new NoCarrier();
    this.loader = parts.loader ?? new SourceLoader();
    this.defaults = parts.defaults;
    this.tcp = parts.tcp;
    this.web = parts.web;
    this.wakes = parts.wakes ?? true;
  }
}

type Place = { harbor: Harbor; terrain: Terrain };

// Bodies a harbor of a world is built of beside the world's own.
export type WorldParts = Partial<Omit<PointerParts, 'carrier'>>;

export class World {
  readonly #places = new Map<string, Place>();
  readonly #defaults: Defaults;
  // Harbors the world reaches no one in, nor anyone out of.
  readonly cut = new Set<string>();

  // A world whose harbors run the defaults handed, unless one is handed
  // others.
  constructor(defaults: Defaults) {
    this.#defaults = defaults;
  }

  // A harbor of this world. `parts` replaces the pointer bodies, a folder's
  // memory and custody among them, and a bundle's loader for an engine
  // that imports no source. The harbor runs only the modules its catalogue
  // was told to add. The world holds it as a program does, so once it
  // opens the world asks its `stand`.
  async harbor(name: string, parts: WorldParts = {}): Promise<Harbor> {
    if (this.#places.has(name)) throw new Error(`a harbor named ${name} stands`);
    const terrain = new PointerTerrain({ defaults: this.#defaults, ...parts, carrier: new PointerCarrier(this) });
    const harbor = await World.#standing(terrain);
    this.#places.set(name, { harbor, terrain });
    return harbor;
  }

  static async #standing(terrain: Terrain): Promise<Harbor> {
    const harbor = await Harbor.open(terrain);
    await harbor.ask({ method: 'stand' });
    return harbor;
  }

  get(name: string): Harbor {
    const place = this.#places.get(name);
    if (!place) throw new Error(`no harbor named ${name}`);
    return place.harbor;
  }

  // The harbor opened again on its own terrain. `parts` replaces bodies of
  // the terrain, as a new process would build them over the same disk, or
  // with other code.
  async restart(name: string, parts?: WorldParts): Promise<Harbor> {
    const place = this.#places.get(name);
    if (!place) throw new Error(`no harbor named ${name}`);
    const t = place.terrain;
    const kept = { entropy: t.entropy, clock: t.clock, custody: t.custody, memory: t.memory, loader: t.loader, defaults: t.defaults, ...(t.tcp ? { tcp: t.tcp } : {}), ...(t.web ? { web: t.web } : {}) };
    const terrain = parts ? new PointerTerrain({ ...kept, ...parts, carrier: t.carrier }) : t;
    const harbor = await World.#standing(terrain);
    this.#places.set(name, { harbor, terrain });
    return harbor;
  }

  carry(pk: string, bytes: Uint8Array): Promise<Uint8Array | null> {
    for (const [name, { harbor }] of this.#places) {
      if (harbor.holds(pk)) return this.cut.has(name) ? Promise.resolve(null) : harbor.arrive(pk, bytes);
    }
    return Promise.resolve(null);
  }
}
