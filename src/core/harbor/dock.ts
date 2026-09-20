// SPDX-License-Identifier: Apache-2.0
// The dock: the contract of the box ward's ward. Beside the root's asks of
// every ward, she opens faculties, hosts wards, and lends each contract a
// faculty fulfils to the wards she hosts. The core names no class of it:
// the terrain hands the harbor the one that stands at genesis. She is born
// of her stance alone, which carries her harbor as `ground`.
//
// She stands once the harbor has booted: its seed, its memory, the
// catalogue and every registry the catalogue resolves stand, and her class
// resolved through the registry her row names. The harbor hands her the
// door and is done; from there everything is an ask. Her `stand` is the
// second level, hers alone, asked by whoever holds the harbor or pilots
// it: every other faculty of the box, each once the registry it names
// stands, registries first, then memory faculties, then the rest; then
// every hosted ward, her house unpacked and her ward stood. A being of a
// hosted ward stands nowhere: she is born for the asks that reach her. It
// answers what stood, or silence where everything already stands. A
// faculty names its class and its registry, and keeps its cells in the box
// ward. A hosted ward names its class, its registry and the memory that
// keeps it.
//
//   stand                       every faculty and hosted ward that does
//                               not stand yet, stood
//   open    { key, class,       a faculty stands in the box ward, her class
//             registry? }       resolved through the registry faculty named
//                               or the catalogue, and the dock holds a
//                               standing on her under her key
//   host    { ward, seed?,      a hosted ward stands under the seed named,
//             memory?, class?,  or a drawn one, of the ward class named or
//             registry? }       the default one, resolved with every class
//                               of the ward through the registry faculty
//                               named or the catalogue, holding a standing
//                               on the dock; the dock keeps its name, its
//                               seed, its registry and the memory faculty
//                               that keeps its place, or none for the root
//                               memory
//   move    { ward, memory }    a hosted ward's place carried whole to
//                               another keeper, a memory faculty's key or
//                               null for the root memory, and forgotten
//                               where it was
//   lend    { contract }        asked by a hosted ward: an offer from a
//                               faculty that fulfils the contract
//   retract { contract, heir }  an offer that was not taken
//   route   { ward, at }        where a ward pk is reached, addresses in the
//                               order they are tried, or null to forget
//                               it; the dock keeps it and the harbor hands
//                               it to its carrier
//   hold    { name, invitation, a far being held as the ward's `hold`
//             at? }             holds it, its ward routed at the address
//                               named first
//   reach   { at }              where this harbor is reached, the
//                               addresses every invitation it gives carries
//   heard                       a push heard, told to every carrier faculty,
//                               so one that collects for this harbor
//                               collects
//
// Her census adds, for whoever pilots, what her cells keep, each hosted
// ward by name with its keeper and registry but never its seed, the routes
// and the reach; what did not stand; and every address the harbor's
// carriers listen at.
//
// A take of an invitation that carries `at` teaches the dock that ward's
// route, where the root set none.
import { Faculty, ships, WARD, type Asker, type AskSpec, type BeingClass, type Blueprint, type Invitation, type JsonObject, type Stance } from '../being/index.ts';
import { Catalogue, CATALOGUE } from './catalogue.ts';
import { MEMORY, MemoryFaculty } from './memory.ts';
import { registers } from './registry.ts';
import { readAt, readInvitation } from '../quo/index.ts';
import { ownerAsk, pilots, rootAsk, Ward, type Lender, type WardStance } from '../ward/index.ts';

// What the dock asks of her harbor: a ward standing, and the seed, as hex,
// it stands under.
export interface Hosting {
  host(name: string, invitation: Invitation, seed?: string, memory?: string, kind?: string, registry?: string): Promise<string | null>;
  // A hosted ward the dock's cells name, standing: its house unpacked and
  // its ward stood where they are not. Whether it stood now; one that does
  // not stand fails alone, and the census names it.
  stand(hosted: Hosted): Promise<boolean>;
  // A standing ward's place, carried to another keeper and standing from
  // there: null, or why not. Where it was stays until `release`.
  move(name: string, seed: string, from: string | undefined, to: string | undefined): Promise<string | null>;
  // A ward's place, forgotten by the keeper named.
  release(name: string, memory: string | undefined): Promise<void>;
  // Whether the harbor's carrier took the route.
  route(pk: string, at: readonly string[] | null): boolean;
  // A route the dock keeps, handed to the carrier as the harbor stands:
  // where no carrier dials it, the census names it.
  reached(pk: string, at: readonly string[]): void;
  // Whether the box ward's partition was kept.
  keep(): Promise<boolean>;
  // What did not stand when the harbor opened.
  failures(): Failures;
  // Whether the harbor lives only as long as a screen.
  readonly foreground: boolean;
  // Every place of the memory the dock does not name, gone.
  sweep(): Promise<string[]>;
  // A faculty just opened, woken where it wakes; one stood as the harbor
  // stands, woken where the harbor's carriers wake; and one about to go,
  // put to sleep.
  awaken(key: string): Promise<void>;
  rouse(key: string): Promise<void>;
  lull(key: string): Promise<void>;
  // Every address the harbor's carriers listen at now.
  listening(): string[];
  // A push heard, told to every carrier faculty.
  heard(): Promise<void>;
}

// One hosted ward, as the dock's cells keep it, with the key of the memory
// faculty that keeps its place where the root memory does not, and of the
// registry faculty its classes resolve through where the catalogue does
// not.
export type Hosted = { ward: string; seed: string; memory?: string; registry?: string };

// Each hosted ward that did not unpack and each route the carrier did not
// take, with the reason, by name and by ward pk.
export type Failures = { wards: Record<string, string>; routes: Record<string, string> };

export const BOX = 'box';
const text = (v: unknown): v is string => typeof v === 'string';
// A list of addresses, each a URI with a scheme, and at least one.
const addresses = (v: unknown): v is string[] => Array.isArray(v) && v.length > 0 && readAt(v).length === v.length;
const hosted: AskSpec['for'] = (_: Asker, notes: JsonObject | undefined) => notes?.hosted === true;

// The box ward's stance: a ward's, and the harbor she docks.
export type DockStance = WardStance & { readonly ground: Hosting };

// Whether a class is the catalogue's, which stands under `catalogue` alone.
const catalogues = (C: unknown): boolean => C === Catalogue || (typeof C === 'function' && C.prototype instanceof Catalogue);

// Whether a class may be a hosted ward's: a ward, and no dock.
export const hostable = (C: unknown): boolean => Ward.fulfils(C) && !Dock.fulfils(C);

export abstract class Dock extends Ward implements Lender {
  static override readonly kind: string = 'org.nervur.dock';
  static {
    ships(this);
  }
  static override cells: JsonObject = { hosted: [], routes: {}, reach: [] };
  static override asks: Record<string, AskSpec> = {
    ...Ward.asks,
    stand: ownerAsk('every faculty and hosted ward that does not stand yet, stood; silence where everything stands'),
    open: ownerAsk('a faculty of this harbor', { required: ['key', 'class'] }),
    host: ownerAsk('a ward this harbor hosts, kept by the root memory or by the memory faculty named', { required: ['ward'] }),
    move: ownerAsk('a hosted ward carried to a memory faculty, or to the root memory with null', { required: ['ward', 'memory'] }),
    hold: ownerAsk('an owner invitation on a far being, held under a name from now on, at the address named', { required: ['name', 'invitation'] }),
    route: ownerAsk('where a ward is reached, addresses in order, or null', { required: ['ward', 'at'] }),
    reach: ownerAsk('where this harbor is reached, the addresses every invitation carries', { required: ['at'] }),
    sweep: rootAsk('every place of the memory this harbor does not name, gone'),
    heard: ownerAsk('a push heard, told to every carrier, so one that collects for this harbor collects'),
    lend: { description: 'an offer from a faculty fulfilling a contract', input: { type: 'object', required: ['contract'] }, for: hosted },
    retract: { description: 'an offer that was not taken', input: { type: 'object', required: ['contract', 'heir'] }, for: hosted },
  };

  readonly #hosting: Hosting;

  constructor(stance: Stance) {
    super(stance);
    this.#hosting = (stance as DockStance).ground;
  }

  // The second level: every faculty of the box that does not stand yet,
  // each once the registry she names stands, registries first, then
  // memory faculties, then the rest; every route handed to the carrier;
  // then every hosted ward and her ward. Asked once the harbor boots, and
  // again whenever the code that runs moves, so it stands only what does
  // not stand yet, and answers silence where everything already stands.
  async stand(): Promise<JsonObject | undefined> {
    const stood = [...(await this.#standFaculties(registers)), ...(await this.#standFaculties((C) => C.prototype instanceof MemoryFaculty)), ...(await this.#standFaculties(() => true))];
    for (const [pk, at] of Object.entries(this.routes)) this.#hosting.reached(pk, at);
    const wards: string[] = [];
    for (const row of this.hosted) if (await this.#hosting.stand(row)) wards.push(row.ward);
    return stood.length + wards.length > 0 ? { stood, wards } : undefined;
  }

  // The absent faculties whose class resolves now and fits, stood, again
  // and again while one more stands, since a registry stood makes the
  // classes named through it resolve.
  async #standFaculties(fits: (C: BeingClass) => boolean): Promise<string[]> {
    const stood: string[] = [];
    for (let more = true; more; ) {
      more = false;
      for (const [key, being] of Object.entries(this.steward.beings())) {
        const C = being.absent ? this.steward.classOf(being.class, being.registry) : undefined;
        if (!C || !fits(C) || this.steward.stand(key) !== 'booted') continue;
        more = true;
        stood.push(key);
        await this.#hosting.rouse(key);
      }
    }
    return stood;
  }

  // The census adds what did not stand, for whoever pilots, and whether
  // the harbor lives only as long as a screen.
  override describe(asker: Asker): Blueprint {
    const blueprint = super.describe(asker);
    if (!pilots(asker, this.notes(asker))) return blueprint;
    const notes = blueprint.notes as JsonObject;
    notes.wards = Object.fromEntries(this.hosted.map(({ ward, memory, registry }) => [ward, { ...(memory === undefined ? {} : { memory }), ...(registry === undefined ? {} : { registry }) }]));
    notes.routes = this.routes;
    notes.reach = this.addresses;
    notes.failed = this.#hosting.failures();
    notes.listening = this.#hosting.listening();
    if (this.#hosting.foreground) notes.foreground = true;
    return blueprint;
  }

  async heard(): Promise<JsonObject> {
    await this.#hosting.heard();
    return { heard: true };
  }

  get hosted(): Hosted[] {
    return (this.cells.hosted as Hosted[]).map(({ ward, seed, memory, registry }) => ({
      ward,
      seed,
      ...(memory === undefined ? {} : { memory }),
      ...(registry === undefined ? {} : { registry }),
    }));
  }

  // Whether a key names a memory faculty the dock opened.
  #memory(key: unknown): key is string {
    return text(key) && this.#fulfilling(MEMORY).includes(key);
  }

  // The registry an ask names: none for the catalogue, the key of a
  // registry faculty standing in the box, or no registry at all.
  #registry(named: unknown): { registry: string | undefined } | null {
    if (named === undefined || named === null || named === CATALOGUE) return { registry: undefined };
    if (!text(named)) return null;
    const being = this.steward.beings()[named];
    const C = being && !being.absent ? this.steward.classOf(being.class, being.registry) : undefined;
    return registers(C) ? { registry: named } : null;
  }

  get routes(): Record<string, string[]> {
    return Object.fromEntries(Object.entries(this.cells.routes as Record<string, string[]>).map(([pk, at]) => [pk, [...at]]));
  }

  // Where this harbor is reached, in the order a caller tries it.
  get addresses(): string[] {
    return [...(this.cells.reach as string[])];
  }

  route(args: JsonObject): JsonObject {
    const { ward } = args;
    const at = typeof args.at === 'string' ? [args.at] : args.at;
    if (!text(ward) || (at !== null && !addresses(at)) || !this.#hosting.route(ward, at)) return { error: 'not routed' };
    const routes = this.cells.routes as Record<string, string[]>;
    if (at === null) delete routes[ward];
    else routes[ward] = [...at];
    return { routed: ward };
  }

  reach(args: JsonObject): JsonObject {
    if (!addresses(args.at)) return { error: 'at is a list of addresses' };
    this.cells.reach = [...args.at];
    return { reach: [...args.at] };
  }

  // A far ward held at the address named is routed there first, so the
  // take reaches it where its invitation says nothing.
  override async hold(args: JsonObject): Promise<JsonObject> {
    if (args.at !== undefined) {
      if (!addresses([args.at])) return { error: 'at is an address' };
      const ward = readInvitation(args.invitation)?.ward;
      if (ward === undefined) return { error: 'no invitation' };
      const routed = this.route({ ward, at: [args.at] });
      if (routed.error !== undefined) return routed;
    }
    return super.hold(args);
  }

  // A route learned from an invitation's `at`, where the root set none,
  // and where the carrier dials one of its addresses.
  async learn(ward: string, at: readonly string[]): Promise<void> {
    const routes = this.cells.routes as Record<string, string[]>;
    if (Object.hasOwn(routes, ward) || !this.#hosting.route(ward, at)) return;
    routes[ward] = [...at];
    await this.#hosting.keep();
  }

  // The dock born again of a class, resolved through the catalogue or a
  // registry the catalogue stands, since she stands before any other.
  override become(args: JsonObject): JsonObject {
    if (!text(args.class)) return { error: 'class is text' };
    const through = this.#registry(args.registry);
    if (through === null) return { error: 'no such registry faculty' };
    const { registry } = through;
    if (registry !== undefined && this.steward.beings()[registry]!.registry !== undefined) return { error: 'the dock stands through the catalogue or a registry it stands' };
    const refused = this.steward.become(args.class, registry);
    return refused === null ? { became: args.class } : { error: refused };
  }

  // The box ward holds faculties alone, and a faculty stands by `open`,
  // which takes a standing on her.
  override boot(): Promise<JsonObject> {
    return Promise.resolve({ error: 'a faculty is opened, and nothing else stands in the box ward' });
  }

  // A faculty that goes stops listening first, and a memory faculty
  // keeping a ward's place does not go.
  override async unboot(args: JsonObject): Promise<JsonObject> {
    if (this.hosted.some((h) => h.memory !== undefined && h.memory === args.being)) return { error: 'a ward is kept by this memory faculty' };
    if (typeof args.being === 'string') await this.#hosting.lull(args.being);
    return super.unboot(args);
  }

  // A faculty of any class the registry named resolves: a kit faculty
  // resolves only where this ground ships it. The catalogue is the core's,
  // and no ask opens one.
  async open(args: JsonObject): Promise<JsonObject> {
    if (!text(args.key) || !text(args.class)) return { error: 'key and class are text' };
    const through = this.#registry(args.registry);
    if (through === null) return { error: 'no such registry faculty' };
    const { registry } = through;
    const C = this.steward.classOf(args.class, registry);
    if (!Faculty.fulfils(C) || catalogues(C)) return { error: 'no such faculty' };
    if ((await this.steward.boot(args.key, args.class, registry)) !== 'booted') return { error: 'not opened' };
    const invitation = await this.steward.invite(args.key, WARD, {});
    if (invitation === null || (await this.stance.standings.take(args.key, invitation)) === null) {
      this.steward.unboot(args.key);
      return { error: 'not opened' };
    }
    await this.#hosting.awaken(args.key);
    return { opened: args.key };
  }

  async sweep(): Promise<JsonObject> {
    return { swept: await this.#hosting.sweep() };
  }

  async host(args: JsonObject): Promise<JsonObject> {
    const name = args.ward;
    if (!text(name)) return { error: 'ward is text' };
    if (name === BOX) return { error: 'box is the box ward' };
    if (this.hosted.some((h) => h.ward === name)) return { error: `${name} is hosted already` };
    if (args.seed !== undefined && !text(args.seed)) return { error: 'seed is text' };
    const memory = args.memory ?? undefined;
    if (memory !== undefined && !this.#memory(memory)) return { error: 'no such memory faculty' };
    const through = this.#registry(args.registry);
    if (through === null) return { error: 'no such registry faculty' };
    const { registry } = through;
    const kind = args.class ?? undefined;
    if (kind !== undefined && (!text(kind) || !hostable(this.steward.classOf(kind, registry)))) return { error: 'no such ward class' };
    const invitation = await this.stance.occupants.invite(name, { hosted: true });
    if (invitation === null) return { error: 'not hosted' };
    const seed = await this.#hosting.host(name, invitation, args.seed, memory, kind, registry);
    if (seed === null) {
      this.stance.occupants.remove(name);
      return { error: 'not hosted' };
    }
    (this.cells.hosted as Hosted[]).push({ ward: name, seed, ...(memory === undefined ? {} : { memory }), ...(registry === undefined ? {} : { registry }) });
    return { hosted: name };
  }

  // The place is written where it goes before the dock's cells say so, and
  // forgotten where it was only once they are kept, so a cut at any step
  // leaves the ward whole under the keeper the cells name.
  async move(args: JsonObject): Promise<JsonObject> {
    const rows = this.cells.hosted as Hosted[];
    const row = rows.find((h) => h.ward === args.ward);
    if (!row) return { error: 'no such ward' };
    const to = args.memory ?? undefined;
    if (to !== undefined && !this.#memory(to)) return { error: 'no such memory faculty' };
    const from = row.memory;
    if (from === to) return { error: `${row.ward} is kept there already` };
    const refused = await this.#hosting.move(row.ward, row.seed, from, to);
    if (refused !== null) return { error: refused };
    const set = (memory: string | undefined): void => {
      if (memory === undefined) delete row.memory;
      else row.memory = memory;
    };
    set(to);
    if (!(await this.#hosting.keep())) {
      set(from);
      await this.#hosting.move(row.ward, row.seed, to, from);
      return { error: 'not kept' };
    }
    await this.#hosting.release(row.ward, from);
    return { moved: row.ward, memory: to ?? null };
  }

  async lend(args: JsonObject): Promise<JsonObject> {
    if (!text(args.contract)) return { error: 'contract is text' };
    const invitation = await this.offer(args.contract);
    return invitation ? { invitation } : { error: 'nothing lent' };
  }

  async retract(args: JsonObject): Promise<JsonObject> {
    if (!text(args.contract) || !text(args.heir)) return { error: 'contract and heir are text' };
    await this.withdraw(args.contract, args.heir);
    return { retracted: args.heir };
  }

  // Lender: the first standing faculty that fulfils the contract offers.
  async offer(contract: string): Promise<Invitation | null> {
    for (const key of this.#fulfilling(contract)) {
      const out = await this.stance.standings.get(key)?.ask('offer');
      const invitation = readInvitation((out as { invitation?: unknown } | undefined)?.invitation);
      if (invitation) return invitation;
    }
    return null;
  }

  async withdraw(contract: string, heir: string): Promise<void> {
    for (const key of this.#fulfilling(contract)) await this.stance.standings.get(key)?.ask('retract', { heir });
  }

  #fulfilling(contract: string): string[] {
    const beings = this.steward.beings();
    return this.stance.standings.ids().filter((key) => {
      const being = beings[key];
      const C = being && !being.absent ? this.steward.classOf(being.class, being.registry) : undefined;
      return Faculty.fulfils(C) && Faculty.contracts(C).includes(contract);
    });
  }
}
