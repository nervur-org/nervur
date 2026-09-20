// SPDX-License-Identifier: Apache-2.0
// The harbor: the onion, unpacked from a terrain alone, in three levels.
// Each level stands the next and leaves it alone.
//
//   L1, the boot, the harbor's own, the core alone
//     the seed and the package    the harbor's one secret, from custody,
//                                 opens its sealed memory, the vault
//     the box ward                unpacked as every ward is, under the
//                                 harbor's seed, no being standing yet
//     the catalogue               the core's registry, stood from the core
//                                 on empty memory and from her row after;
//                                 every module the commit `live` names is
//                                 run through the terrain's loader
//     the registries              every box faculty the catalogue resolves
//                                 to a registry, where her row names the
//                                 catalogue as hers
//     the dock                    the box ward's ward, of the class her row
//                                 names through its registry, the default
//                                 dock where it does not stand; the door is
//                                 hers from here, and `open` returns
//   L2, the dock's                her `stand` ask: every other faculty, the
//                                 routes, and every hosted ward, each ward
//                                 standing on the class, the registry and
//                                 the memory the dock keeps for it
//   L3, each ward's beings        born from her rows for the asks that
//                                 reach them, and dropped after; nothing
//                                 stands them
//
// L1 is one call and no ask can make it. After it the harbor takes asks
// alone. Whoever holds a harbor has five things of it and no other:
//
//   Harbor.open(terrain?)   the boot
//   ask(request)            the root line, a ward asked as its root
//   arrive(pk, box)         a Quo box at one of its doors
//   holds(pk)               whether one of its doors is that ward's
//   close()                 every carrier asleep, and the ground let go
//
// What stands inside it, the wards, the dock, the catalogue and the
// carriers, is reached by an ask and never by a hand. The box ward's
// stance carries the harbor's `ground`, the one thing the dock, the
// catalogue and every faculty of the box are handed.
//
// The harbor fails only where the seed or the box ward's own place cannot
// be read, or the catalogue does not stand. A module, a registry, a
// faculty, a route, a hosted ward or a being that cannot stand fails
// alone, and the census names it.
//
// Genesis and wake are one path: on empty memory the box ward holds no
// catalogue, and the harbor writes her from the core; the root's asks
// write the rest, and nothing enters unasked.
import { isSilence, isWord, told, type BeingClass, type Invitation, type Json, type JsonObject } from '../being/index.ts';
import type { Carrier } from '../contract/index.ts';
import { hex, isHex, unhex } from '../crypto/index.ts';
import { unspecified, WardKey } from '../quo/index.ts';
import { DOCK, House, type Classes, type HouseParts, type Routes, type WardClass } from '../ward/index.ts';
import { Catalogue, CATALOGUE, type Cataloguing } from './catalogue.ts';
import { CarrierFaculty, UNDIALED, type Ground } from './carrying.ts';
import { BOX, Dock, hostable, type Failures, type Hosted, type Hosting } from './dock.ts';
import { Dna } from './dna.ts';
import { Package, type Keeper } from './package.ts';
import { MemoryFaculty } from './memory.ts';
import { registers, RegistryFaculty } from './registry.ts';
import { probeGround, type Probing } from './probe.ts';
import { readRootRequest } from './root-line.ts';
import { Terrain, type Defaults } from './terrain.ts';

// The box ward's ward is a dock, the terrain's default at genesis and
// while her row's kind does not resolve.
const boxWard = ({ dock }: Defaults): WardClass => ({ genesis: dock.kind, contract: 'dock', fits: (C) => Dock.fulfils(C), fallback: dock });

// A hosted ward's ward is a ward and no dock, of the kind `host` named or
// the terrain's default at genesis.
const hostedWard = ({ ward }: Defaults, kind: string = ward.kind): WardClass => ({ genesis: kind, contract: 'hosted ward', fits: hostable });

// What the box ward's stance carries: the dock hosts through it, the
// catalogue runs code through it, and every faculty of the box reaches its
// terrain and the harbor's doors through it.
export type HarborGround = Hosting & Cataloguing & Ground;

export class Harbor {
  readonly #terrain: Terrain;
  readonly #package: Package;
  readonly #wards = new Map<string, House>();
  readonly #failed: Failures = { wards: {}, routes: {} };
  readonly #ground: HarborGround;
  // Every ward speaks through the harbor: a pk of one of its doors goes to
  // that door, any other along its route or to the terrain's carrier.
  readonly #carrier: Carrier = { carry: (pk, bytes) => this.#carry(pk, bytes) };
  // Every class a row names, through the registry faculty of the box the
  // row names, or the catalogue.
  readonly #classes: Classes = { classOf: (kind, registry) => this.#classOf(kind, registry) };

  private constructor(terrain: Terrain, pack: Package) {
    const { dock, ward, classes } = terrain.defaults;
    if (!Dock.fulfils(dock)) throw new Error('the default dock is no dock');
    if (!hostable(ward)) throw new Error('the default ward is no hosted ward');
    this.#terrain = terrain;
    this.#package = pack;
    const dna = new Dna(terrain.memory, pack);
    // The kit's classes the catalogue resolves: her own, the core's alone,
    // then the defaults the terrain hands in.
    const kit = [Catalogue, dock, ward, ...classes];
    this.#ground = {
      terrain,
      dna,
      kit,
      foreground: terrain.foreground,
      arrive: (pk, bytes) => this.arrive(pk, bytes),
      host: (name, invitation, seed, memory, kind, registry) => this.#host(name, invitation, seed, memory, kind, registry),
      stand: (hosted) => this.#stand(hosted),
      move: (name, seed, from, to) => this.#move(name, seed, from, to),
      release: async (name, memory) => this.#keeper(memory).forget(await this.#package.place(name)),
      route: (pk, at) => this.#route(pk, at),
      reached: (pk, at) => {
        if (!this.#dialable(at)) this.#failed.routes[pk] = 'no carrier dials it';
      },
      keep: () => this.#box.partition.kept(),
      failures: () => this.#failures(),
      sweep: () => this.#sweep(),
      awaken: async (key) => {
        const being = this.#box.being(key);
        if (being instanceof CarrierFaculty) await being.awake();
      },
      rouse: async (key) => {
        if (terrain.wakes) await this.#ground.awaken(key);
      },
      lull: async (key) => {
        const being = this.#box.being(key);
        if (being instanceof CarrierFaculty) await being.sleep();
      },
      listening: () => this.#carriers.flatMap((carrier) => carrier.listening()),
      heard: async () => {
        await Promise.all(this.#carriers.map((carrier) => carrier.heard()));
      },
      ran: () => {
        for (const house of this.#wards.values()) house.renew();
        return Promise.resolve();
      },
      stands: (kinds) => [...this.#wards.values()].some((house) => Object.values(house.partition.beings).some((row) => kinds.includes(row.class))),
      kept: () => [...new Set([...this.#wards.values()].flatMap((house) => Object.values(house.partition.beings).map((row) => row.class)))],
    };
  }

  // A harbor on the terrain handed in, or, with none, on the ground the
  // probe finds here. A ground another run holds refuses, and what the
  // ground serves beside the harbor stands once it is whole.
  static async open(from: Terrain | Probing = {}): Promise<Harbor> {
    const terrain = from instanceof Terrain ? from : probeGround(from).terrain;
    await terrain.claim();
    let harbor: Harbor;
    try {
      harbor = await Harbor.#boot(terrain);
    } catch (e) {
      await terrain.release();
      throw e;
    }
    try {
      await terrain.stand(harbor);
    } catch (e) {
      await harbor.close();
      throw e;
    }
    return harbor;
  }

  // L1, the one call no ask makes, ending with the door handed to the dock.
  // What stands beyond it stands because someone asked `stand`.
  static async #boot(terrain: Terrain): Promise<Harbor> {
    const seed = await terrain.custody.seed();
    const harbor = new Harbor(terrain, await Package.open(terrain.memory, terrain.entropy, seed));
    const box = await harbor.#unpack(BOX, seed, { ward: boxWard(terrain.defaults), carries: { ground: harbor.#ground }, classes: harbor.#classes, stands: true });
    if (box.partition.being(CATALOGUE)) box.stand(CATALOGUE);
    else if ((await box.make(CATALOGUE, Catalogue.kind)) !== 'booted' || !(await box.partition.kept())) throw new Error('the catalogue did not stand');
    const catalogue = box.being(CATALOGUE);
    if (!(catalogue instanceof Catalogue)) throw new Error('the catalogue did not stand');
    await catalogue.wake();
    for (const [key, row] of Object.entries(box.partition.beings)) {
      if (row.registry === undefined && registers(catalogue.classOf(row.class))) box.stand(key);
    }
    await box.standWard();
    return harbor;
  }

  // The root line: one request, `{ ward?, method?, args? }`, asked of the
  // box ward or the hosted ward named as its root, and one plain JSON
  // answer, whatever front carried it.
  //
  //   { answer }             what the ward said
  //   { silence: true }      she said nothing
  //   { word }               a kit word: unreached, late, ...
  //   { error }              the request was none, or names no ward that
  //                          stands, with the reason one did not
  async ask(value: unknown): Promise<JsonObject> {
    const request = readRootRequest(value);
    if (request === null) return { error: 'not a root request' };
    const ward = request.ward === undefined ? this.#box : this.#wards.get(request.ward);
    if (ward === undefined) {
      const failed = this.#failures().wards[request.ward!];
      return failed === undefined ? { error: 'no such ward' } : { error: 'the ward did not stand', reason: failed };
    }
    const out = await ward.root(request.method, request.args);
    if (isSilence(out)) return { silence: true };
    if (isWord(out)) return { word: told(out) as string };
    return { answer: out as Json };
  }

  // Bytes for one of this harbor's doors, or for a ward a relay of this
  // harbor answers for, or nothing.
  async arrive(pk: string, bytes: Uint8Array): Promise<Uint8Array | null> {
    const ward = this.#door(pk);
    if (ward) return (await ward.door.arrive(bytes)).bytes;
    return (await this.#relayed(pk, bytes)) ?? null;
  }

  // Whether one of this harbor's doors is that ward's.
  holds(pk: string): boolean {
    return this.#door(pk) !== undefined;
  }

  // Every carrier asleep, the last opened first: nothing listens and no
  // line stays open.
  async close(): Promise<void> {
    for (const carrier of this.#carriers.reverse()) await carrier.sleep();
    await this.#terrain.release();
  }

  get #box(): House {
    return this.#wards.get(BOX)!;
  }

  get #dock(): Dock {
    return this.#box.ward as Dock;
  }

  // A kind, through the registry faculty of the box named, or the
  // catalogue. The catalogue's own kind is the core's, and resolves before
  // any registry stands.
  #classOf(kind: string, registry: string = CATALOGUE): BeingClass | undefined {
    if (kind === Catalogue.kind) return Catalogue;
    const found = this.#wards.get(BOX)?.being(registry);
    return found instanceof RegistryFaculty ? found.classOf(kind) : undefined;
  }

  // The classes of a hosted ward, every one through the registry the dock
  // keeps for it.
  #through(registry: string | undefined): Classes {
    return { classOf: (kind) => this.#classOf(kind, registry) };
  }

  // A hosted ward standing, as the dock's cells name it.
  async #stand(hosted: Hosted): Promise<boolean> {
    const fresh = !this.#wards.has(hosted.ward);
    try {
      if (fresh) await this.#unpack(hosted.ward, unhex(hosted.seed), { ward: hostedWard(this.#terrain.defaults), classes: this.#through(hosted.registry) }, this.#keeper(hosted.memory));
      await this.#wards.get(hosted.ward)!.standWard();
      delete this.#failed.wards[hosted.ward];
      return fresh;
    } catch (e) {
      this.#wards.delete(hosted.ward);
      this.#failed.wards[hosted.ward] = e instanceof Error ? e.message : String(e);
      return false;
    }
  }

  // Every place of the root memory and of each memory faculty that the
  // dock does not name there, gone. A crash inside `host` or `move` leaves
  // such a place, sealed under a seed nothing kept or kept elsewhere, and
  // nothing else writes one. A place a memory faculty keeps in the root
  // memory is the memory faculty's.
  async #sweep(): Promise<string[]> {
    const named = async (memory: string | undefined): Promise<Set<string>> => {
      const wards = this.#dock.hosted.filter((h) => h.memory === memory).map((h) => h.ward);
      return new Set(await Promise.all((memory === undefined ? [BOX, ...wards] : wards).map((name) => this.#package.place(name))));
    };
    const memories = this.#memories();
    const swept: string[] = [];
    const root = await named(undefined);
    for (const place of await this.#terrain.memory.places()) {
      if (root.has(place) || Dna.occupies(place) || memories.some(([, s]) => s.occupies(place))) continue;
      await this.#terrain.memory.forget(place);
      swept.push(place);
    }
    for (const [key, memory] of memories) {
      const mine = await named(key);
      for (const place of await memory.places()) {
        if (mine.has(place)) continue;
        await memory.forget(place);
        swept.push(place);
      }
    }
    return swept;
  }

  // A standing ward, carried whole to another keeper. The ward leaves the
  // harbor's doors while it moves, so no arrival lands on the keeper it
  // leaves.
  async #move(name: string, seed: string, from: string | undefined, to: string | undefined): Promise<string | null> {
    const ward = this.#wards.get(name);
    if (!ward) return 'the ward does not stand';
    const source = this.#keeper(from);
    const target = this.#keeper(to);
    this.#wards.delete(name);
    try {
      if (!(await ward.partition.kept())) throw new Error('the ward was not kept');
      const place = await this.#package.place(name);
      const entries = new Map<string, Uint8Array | null>(await source.read(place));
      for (const entry of (await target.read(place)).keys()) if (!entries.has(entry)) entries.set(entry, null);
      await target.write(place, entries);
      const registry = this.#dock.hosted.find((h) => h.ward === name)?.registry;
      const moved = await this.#unpack(name, unhex(seed), { ward: hostedWard(this.#terrain.defaults), classes: this.#through(registry) }, target);
      await moved.standWard();
      return null;
    } catch (e) {
      this.#wards.set(name, ward);
      return e instanceof Error ? e.message : String(e);
    }
  }

  // The root memory, or the memory faculty standing under the key named.
  #keeper(memory: string | undefined): Keeper {
    if (memory === undefined) return this.#terrain.memory;
    const being = this.#box.being(memory);
    if (being instanceof MemoryFaculty) return being;
    throw new Error(`the memory faculty ${memory} does not stand`);
  }

  #memories(): [string, MemoryFaculty][] {
    return Object.keys(this.#box.partition.beings).flatMap((key): [string, MemoryFaculty][] => {
      const being = this.#box.being(key);
      return being instanceof MemoryFaculty ? [[key, being]] : [];
    });
  }

  // What did not stand when the harbor opened, each alone, and why the box
  // ward stands the default dock where her row names another.
  #failures(): Failures {
    const fault = this.#box.fault;
    return { wards: { ...this.#failed.wards, ...(fault === null ? {} : { [BOX]: fault }) }, routes: { ...this.#failed.routes } };
  }

  // This harbor's own doors and relays first, then a route's addresses in
  // order, each to the carrier that dials it, and with no route the
  // terrain's carrier.
  async #carry(pk: string, bytes: Uint8Array): Promise<Uint8Array | null> {
    if (this.holds(pk)) return this.arrive(pk, bytes);
    const relayed = this.#relayed(pk, bytes);
    if (relayed !== undefined) return relayed;
    const at = this.#dock.routes[pk];
    if (at === undefined) return this.#terrain.carrier.carry(pk, bytes);
    for (const address of at) {
      const carrier = this.#carriers.find((c) => c.accepts(address));
      const out = carrier ? await carrier.dial(address, pk, bytes) : UNDIALED;
      if (out !== UNDIALED) return out;
    }
    return null;
  }

  // A ward the dock hosts stands now, under the seed named or a drawn one,
  // and the seed it stands under comes back. A ward whose key another ward
  // of this harbor already has does not stand.
  async #host(name: string, invitation: Invitation, seed?: string, memory?: string, kind?: string, registry?: string): Promise<string | null> {
    if (this.#wards.has(name)) return null;
    const bytes = seed === undefined ? this.#terrain.entropy.draw(32) : isHex(seed, 32) ? unhex(seed) : null;
    if (bytes === null || this.holds((await WardKey.from(bytes)).pk)) return null;
    let house: House;
    try {
      house = await this.#unpack(name, bytes, { dock: invitation, ward: hostedWard(this.#terrain.defaults, kind), classes: this.#through(registry) }, this.#keeper(memory));
      await house.standWard();
    } catch {
      this.#wards.delete(name);
      return null;
    }
    if (!house.ward.stance.standings.get(DOCK)) {
      this.#wards.delete(name);
      return null;
    }
    return hex(bytes);
  }

  // A route is taken where a carrier of this harbor dials one of its
  // addresses; forgetting one always is.
  #route(pk: string, at: readonly string[] | null): boolean {
    const taken = isHex(pk, 64) && (at === null || this.#dialable(at));
    if (taken) delete this.#failed.routes[pk];
    return taken;
  }

  // The carrier faculties standing in the box ward.
  get #carriers(): CarrierFaculty[] {
    return Object.keys(this.#box.partition.beings)
      .map((key) => this.#box.being(key))
      .filter((being): being is CarrierFaculty => being instanceof CarrierFaculty);
  }

  // The answer of the first carrier that answers for a pk no door holds,
  // or undefined where none does.
  #relayed(pk: string, bytes: Uint8Array): Promise<Uint8Array | null> | undefined {
    for (const carrier of this.#carriers) {
      const out = carrier.relay(pk, bytes);
      if (out !== null) return out;
    }
    return undefined;
  }

  #dialable(at: readonly string[]): boolean {
    return at.some((address) => this.#carriers.some((carrier) => carrier.accepts(address)));
  }

  async #unpack(name: string, seed: Uint8Array, own: Pick<HouseParts, 'dock' | 'ward' | 'carries' | 'classes' | 'stands'>, keeper?: Keeper): Promise<House> {
    const { entropy, clock } = this.#terrain;
    const ward = await House.unpack({
      seed,
      memory: await this.#package.rows(name, keeper),
      entropy,
      clock,
      carrier: this.#carrier,
      routes: this.#routes,
      ...own,
    });
    this.#wards.set(name, ward);
    return ward;
  }

  // Every ward is reached where the harbor is: where the root's `reach`
  // says, and where it said nothing, where its carriers listen, save the
  // unspecified host. What a ward learns from an invitation's `at` is the
  // dock's to keep. A ward of this harbor needs no route.
  readonly #routes: Routes = {
    reach: () => {
      if (!this.#wards.has(BOX)) return [];
      const set = this.#dock.addresses;
      return set.length > 0 ? set : this.#carriers.flatMap((carrier) => carrier.listening()).filter((address) => !unspecified(address));
    },
    learn: (ward, at) => (this.holds(ward) ? Promise.resolve() : this.#dock.learn(ward, at)),
  };

  #door(pk: string): House | undefined {
    for (const ward of this.#wards.values()) if (ward.pk === pk) return ward;
    return undefined;
  }
}
