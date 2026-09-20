// SPDX-License-Identifier: Apache-2.0
// The unpacking law, as scenes any terrain's bodies run: a harbor is one
// package. Only the seed and the terrain's bodies stand outside it, the
// terrain keeps sealed bytes it cannot read, and the seed opens the memory,
// the dock stands the catalogue, the catalogue runs the modules `live`
// holds, the faculties and every ward stand from cells, and the dock lends.
// A scene asks a harbor by its root line alone, as whoever holds one does,
// and reads what a terrain keeps from the bodies it handed. It names no
// runtime, so it bundles.
import type { JsonObject } from '../being/index.ts';
import { Loader, Memory, type Custody, type Module } from '../contract/index.ts';
import { blob, idOf } from '../git/index.ts';
import { copyPackage, Dna, MemoryFaculty, type Defaults, type Harbor } from '../harbor/index.ts';
import { BundleLoader, CryptoEntropy, SourceLoader, VolatileMemory, World } from '../pointer/index.ts';
import type { Expect } from './expect.ts';

// The bodies a harbor stands on, and the same keeping as a new process
// would build it. `loader` runs a module's source where the engine does
// not import one it is handed, as an edge's bundle does. `defaults` are
// the dock, the ward and the faculties its harbors run where the law's
// module names none, among them a memory faculty.
export type Bodies = { custody: Custody; memory: Memory };
export type Terrain = { name: string; make(): Bodies; again(bodies: Bodies): Bodies; loader?: () => Loader; defaults: Defaults };

// The law's module, as its author writes it: one ES module that imports
// nothing but `'nervur'`, and nothing of it but the core. A shelf is a
// memory faculty's store, kept in this process by the scenes and reached
// through a registered symbol, so the module's class and the scenes read
// one shelf.
export const LAW = `import { Being, Dock, Faculty, MemoryFaculty, ownerAsk, Ward } from 'nervur';

export const module = 'org.example.law';
export const version = '1';

class Echoes extends Faculty {
  static kind = 'org.example.echoes';
}
class Echo extends Echoes {
  static kind = 'org.example.echo';
  static asks = { echo: {} };
  echo(args, asker) {
    return { echoed: args.text ?? null, to: asker.id ?? null };
  }
}

class Shop extends Being {
  static kind = 'org.example.shop';
  static cells = { sold: [] };
  static asks = { buy: {}, sold: {} };
  buy(args, asker) {
    this.cells.sold.push(String(args.item) + ' to ' + (asker.id ?? 'nobody'));
    return { bought: args.item ?? null };
  }
  sold() {
    return { sold: this.cells.sold };
  }
}

class Customer extends Being {
  static kind = 'org.example.customer';
  static asks = { join: {}, buy: {}, echo: {}, spoil: {} };
  spoil() {
    try {
      this.cells.when = new Date();
      return { kept: true };
    } catch {
      return { refused: true };
    }
  }
  async join(args) {
    return { joined: await this.stance.standings.take('shop', args.invitation) };
  }
  async buy(args) {
    return { said: (await this.stance.standings.get('shop')?.ask('buy', args)) ?? null };
  }
  async echo(args) {
    if (!this.stance.standings.get('echo')) await this.stance.lend(Echoes, 'echo');
    return { said: (await this.stance.standings.get('echo')?.ask('echo', args)) ?? null };
  }
}

// A being whose fields are her cells, and nothing else.
class Profile extends Being {
  static kind = 'org.example.profile';
  static cells = { name: '', age: 0 };
  static asks = { set: {}, get: {} };
  set(args) {
    if (typeof args.name === 'string') this.cells.name = args.name;
    if (typeof args.age === 'number') this.cells.age = args.age;
    return this.get();
  }
  get() {
    return { name: this.cells.name ?? null, age: this.cells.age ?? null };
  }
}

// A memory faculty a module brings: places on a shelf of this process, by
// the faculty's key, which outlive a harbor as a database outlives its
// client.
const shelf = (key) => globalThis[Symbol.for('org.example.shelf')](key);
class Shelf extends MemoryFaculty {
  static kind = 'org.example.shelf';
  read(place) {
    return shelf(this.stance.key).read(place);
  }
  write(place, entries) {
    return shelf(this.stance.key).write(place, entries);
  }
  places() {
    return shelf(this.stance.key).places();
  }
  forget(place) {
    return shelf(this.stance.key).forget(place);
  }
}

// A ward and a dock a module brings, each with an ask of her own.
class Steward extends Ward {
  static kind = 'org.example.steward';
  static asks = { ...Ward.asks, sign: ownerAsk('a signature of this ward') };
  sign() {
    return { signed: this.steward.pk() };
  }
}
class Quay extends Dock {
  static kind = 'org.example.quay';
  static asks = { ...Dock.asks, moor: ownerAsk('the wards moored here') };
  moor() {
    return { moored: this.hosted.map((h) => h.ward) };
  }
}

export const classes = [Echo, Shop, Customer, Profile, Shelf, Steward, Quay];
`;

export const law = { module: 'org.example.law', version: '1', source: LAW } as const;

// A module of no class, added beside the law's.
const TWIN = "export const module = 'org.example.twin';\nexport const version = '1';\nexport const classes = [];\n";

// The law's module built by a bundler from its source, as a ground that
// imports no source runs it: the bundle an edge is deployed with, which
// carries the module of no class beside it.
export const lawBundle = (module: Module): BundleLoader =>
  new BundleLoader([
    { source: LAW, module },
    { source: TWIN, module: { module: 'org.example.twin', version: '1', classes: [] } },
  ]);

const STEWARD = 'org.example.steward';
const QUAY = 'org.example.quay';
const PROFILE = 'org.example.profile';
const SHELF = 'org.example.shelf';

// Every byte a memory is handed, seen from outside it, and a keep it
// refuses where `refuse` says.
class Watched extends Memory {
  readonly inner: Memory;
  readonly seen: { place: string; name: string; bytes: Uint8Array | null }[] = [];
  refuse: (place: string) => boolean = () => false;
  constructor(inner: Memory) {
    super();
    this.inner = inner;
  }
  read(place: string): Promise<Map<string, Uint8Array>> {
    return this.inner.read(place);
  }
  write(place: string, entries: ReadonlyMap<string, Uint8Array | null>): Promise<void> {
    if (this.refuse(place)) return Promise.reject(new Error('refused'));
    for (const [name, bytes] of entries) this.seen.push({ place, name, bytes: bytes && bytes.slice() });
    return this.inner.write(place, entries);
  }
  places(): Promise<string[]> {
    return this.inner.places();
  }
  forget(place: string): Promise<void> {
    return this.inner.forget(place);
  }
}

// The shelves the law module's memory faculty keeps, one per key.
const shelves = new Map<string, Watched>();
const shelfOf = (key: string): Watched => {
  let found = shelves.get(key);
  if (!found) shelves.set(key, (found = new Watched(new VolatileMemory())));
  return found;
};
(globalThis as unknown as Record<symbol, unknown>)[Symbol.for('org.example.shelf')] = shelfOf;

// The loader a scene's harbor runs its code with on this terrain.
const loaderOf = (t: Terrain): Loader => t.loader?.() ?? new SourceLoader();
const on = (t: Terrain, bodies: Partial<Bodies> = {}): Partial<Bodies> & { loader: Loader } => ({ ...bodies, loader: loaderOf(t) });

// The root line as a scene reads it: what the ward said, or the line's
// silence, word or error.
const root = async (harbor: Harbor, method?: string, args?: JsonObject, ward?: string): Promise<unknown> => {
  const out = await harbor.ask({ ...(ward === undefined ? {} : { ward }), ...(method === undefined ? {} : { method }), ...(args === undefined ? {} : { args }) });
  return 'answer' in out ? out.answer : out;
};
// What a being said, asked as the owner through her ward.
const being = async (harbor: Harbor, key: string, method: string, args: JsonObject, ward?: string): Promise<unknown> => {
  const out = (await root(harbor, 'ask', { being: key, method, args }, ward)) as JsonObject;
  return 'answer' in out ? out.answer : out;
};
type Census = { pk: string; beings: Record<string, { class: string; absent: boolean }>; wards: Record<string, JsonObject>; failed: { wards: Record<string, string>; routes: Record<string, string> } };
const census = async (harbor: Harbor, ward?: string): Promise<Census> => ((await root(harbor, undefined, undefined, ward)) as { notes: Census }).notes;
const catalogue = async (harbor: Harbor, method: string, args: JsonObject = {}): Promise<JsonObject> => (await being(harbor, 'catalogue', method, args)) as JsonObject;
// The hosted wards that stand now.
const standing = async (harbor: Harbor): Promise<string[]> => {
  const { wards, failed } = await census(harbor);
  return Object.keys(wards).filter((ward) => !Object.hasOwn(failed.wards, ward));
};

// A harbor of the world whose catalogue runs the law's module.
export const standOne = async (world: World, name: string, t: Terrain, parts: Partial<Bodies> = {}): Promise<Harbor> => {
  const harbor = await world.harbor(name, on(t, parts));
  await catalogue(harbor, 'add', { source: LAW });
  return harbor;
};
const CATALOGUE = { catalogue: { class: 'org.nervur.catalogue', public: false, absent: false } };
const NONE = { wards: {}, routes: {} };

// The places of a root memory the wards keep, the DNA's left out.
const wardPlaces = async (memory: Memory): Promise<string[]> => (await memory.places()).filter((p) => !Dna.occupies(p));

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);
const holds = (bytes: Uint8Array, part: Uint8Array): boolean => {
  outer: for (let at = 0; at + part.length <= bytes.length; at += 1) {
    for (let k = 0; k < part.length; k += 1) if (bytes[at + k] !== part[k]) continue outer;
    return true;
  }
  return false;
};
const hex = (bytes: Uint8Array): string => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
const drawn = (): string => hex(new CryptoEntropy().draw(32));

const me = (world: World, method: string, args: JsonObject = {}): Promise<unknown> => being(world.get('home'), 'me', method, args, 'alice');
const sold = async (harbor: Harbor): Promise<unknown> => ((await being(harbor, 'shop', 'sold', {}, 'shop')) as { sold: unknown }).sold;

// Acme hosts a shop; home opens an echo, hosts alice and bob under the
// seeds named, and alice takes the shop and lends the echo.
const stand = async (world: World, t: Terrain, bodies: { acme: Bodies; home: Bodies }, seeds: { alice: string; bob: string }, expect: Expect): Promise<void> => {
  const acme = await standOne(world, 'acme', t, bodies.acme);
  const home = await standOne(world, 'home', t, bodies.home);
  expect.same(await standing(home), [], `${t.name}: a new harbor hosts nobody`);
  expect.same(await root(home, 'open', { key: 'echo', class: 'org.example.echo' }), { opened: 'echo' });
  expect.same(await root(home, 'host', { ward: 'alice', seed: seeds.alice }), { hosted: 'alice' });
  expect.same(await root(home, 'host', { ward: 'bob', seed: seeds.bob }), { hosted: 'bob' });
  expect.same(await root(home, 'boot', { key: 'me', class: 'org.example.customer' }, 'alice'), { booted: 'me' });
  expect.same(await root(acme, 'host', { ward: 'shop' }), { hosted: 'shop' });
  expect.same(await root(acme, 'boot', { key: 'shop', class: 'org.example.shop' }, 'shop'), { booted: 'shop' });
  const invitation = (await root(acme, 'invite', { being: 'shop', id: 'alice' }, 'shop')) as JsonObject;
  expect.same(await me(world, 'join', { invitation }), { joined: 'shop' });
  expect.same(await me(world, 'buy', { item: 'tea' }), { said: { bought: 'tea' } });
  expect.same(await me(world, 'echo', { text: 'hi' }), { said: { echoed: 'hi', to: 'lent:1' } });
};

// A loader that runs every source but one module's, which it refuses.
class Refusing extends Loader {
  readonly #inner: Loader;
  readonly #module: string;
  constructor(inner: Loader, module: string) {
    super();
    this.#inner = inner;
    this.#module = module;
  }
  load(source: string, id: string): Promise<Module> {
    if (source.includes(`'${this.#module}'`)) return Promise.reject(new Error(`${this.#module} is refused here`));
    return this.#inner.load(source, id);
  }
}

export const lawScenes = (t: Terrain, expect: Expect): [string, () => Promise<void>][] => [
  [
    `law on ${t.name}: empty memory unpacks a box ward holding the dock and her catalogue, live an empty commit, and it wakes the same`,
    async () => {
      const bodies = t.make();
      const world = new World(t.defaults);
      const harbor = await world.harbor('h', on(t, bodies));
      const { pk } = await census(harbor);
      const empty = { pk, class: t.defaults.dock.kind, beings: CATALOGUE, wards: {}, routes: {}, reach: [], failed: NONE, listening: [] };
      expect.same(await census(harbor), empty);
      const live = (await catalogue(harbor, 'live')).live as string;
      const log = (await catalogue(harbor, 'log')).log as { commit: string; parents: string[]; message: string }[];
      expect.same(
        log.map(({ commit, parents, message }) => ({ commit, parents, message })),
        [{ commit: live, parents: [], message: 'genesis' }],
      );
      const again = await world.restart('h', t.again(bodies));
      expect.same(await census(again), empty, 'the seed is the box ward');
      expect.same(await catalogue(again, 'live'), { live }, 'a wake stands live again');
    },
  ],
  [
    `law on ${t.name}: a restart whose loader does not run a module live holds stands, its beings absent, and wakes them when it runs again`,
    async () => {
      const bodies = t.make();
      const world = new World(t.defaults);
      const harbor = await standOne(world, 'h', t, bodies);
      expect.same(await root(harbor, 'open', { key: 'echo', class: 'org.example.echo' }), { opened: 'echo' });
      expect.same(await root(harbor, 'host', { ward: 'w' }), { hosted: 'w' });
      const { live } = await catalogue(harbor, 'live');
      const id = await idOf(blob(LAW));
      const lost = await world.restart('h', { ...t.again(bodies), loader: new BundleLoader([]) });
      expect.same(await standing(lost), ['w'], 'the rest of the harbor stands');
      expect.same((await census(lost)).beings.echo?.absent, true);
      expect.same(await catalogue(lost, 'modules'), {
        live,
        modules: { [law.module]: { running: null, blob: id, failed: `redeploy needed: blob ${id} is no module this bundle carries, and it carries none` } },
      });
      const again = await world.restart('h', { ...t.again(bodies), loader: loaderOf(t) });
      expect.same((await census(again)).beings.echo?.absent, false);
      expect.same(await catalogue(again, 'modules'), { live, modules: { [law.module]: { running: '1', blob: id } } });
    },
  ],
  [
    `law on ${t.name}: a module that does not load is removed only once no being stands on the kinds of its domain`,
    async () => {
      const bodies = t.make();
      const world = new World(t.defaults);
      const harbor = await standOne(world, 'h', t, bodies);
      expect.same(await root(harbor, 'open', { key: 'echo', class: 'org.example.echo' }), { opened: 'echo' });
      const lost = await world.restart('h', { ...t.again(bodies), loader: new BundleLoader([]) });
      const remove = () => catalogue(lost, 'remove', { module: law.module });
      expect.same(await remove(), { error: 'a being stands on this module' });
      expect.same(await root(lost, 'unboot', { being: 'echo' }), { unbooted: 'echo' });
      const removed = await remove();
      expect.equal(removed.removed, law.module);
      const after = await world.restart('h', t.again(bodies));
      expect.same(await catalogue(after, 'modules'), { live: removed.live!, modules: {} });
    },
  ],
  [
    `law on ${t.name}: a restart where one module does not load runs the others, and the one alone stays out`,
    async () => {
      const bodies = t.make();
      const world = new World(t.defaults);
      const harbor = await standOne(world, 'h', t, bodies);
      expect.equal((await catalogue(harbor, 'add', { source: TWIN })).added, 'org.example.twin');
      expect.same(await root(harbor, 'open', { key: 'echo', class: 'org.example.echo' }), { opened: 'echo' });
      const split = await world.restart('h', { ...t.again(bodies), loader: new Refusing(loaderOf(t), 'org.example.twin') });
      expect.same((await census(split)).beings.echo?.absent, false, 'the module beside it runs');
      const { modules } = (await catalogue(split, 'modules')) as { modules: Record<string, { running: unknown; failed?: string }> };
      expect.same([modules[law.module]?.running, modules['org.example.twin']?.running], ['1', null]);
      expect.equal(modules['org.example.twin']?.failed, 'org.example.twin is refused here');
    },
  ],
  [
    `law on ${t.name}: a hosted ward whose place does not open fails alone, and a box ward whose place does not open fails the harbor`,
    async () => {
      const bodies = t.make();
      const watched = new Watched(bodies.memory);
      const world = new World(t.defaults);
      const harbor = await standOne(world, 'h', t, { custody: bodies.custody, memory: watched });
      expect.same(await root(harbor, 'host', { ward: 'good' }), { hosted: 'good' });
      const from = watched.seen.length;
      expect.same(await root(harbor, 'host', { ward: 'bad' }), { hosted: 'bad' });
      const box = watched.seen[0]!.place;
      const bad = watched.seen.slice(from).find((s) => s.place !== box)!.place;
      const spoil = async (place: string): Promise<void> => {
        const [[name, bytes]] = [...(await watched.inner.read(place))];
        const changed = bytes!.slice();
        changed[0] = changed[0]! ^ 1;
        await watched.inner.write(place, new Map([[name!, changed]]));
      };
      await spoil(bad);
      const again = await world.restart('h', t.again(bodies));
      expect.same(await standing(again), ['good']);
      expect.same((await census(again)).failed, { wards: { bad: 'an entry the package did not seal' }, routes: {} });
      expect.same(await again.ask({ ward: 'bad' }), { error: 'the ward did not stand', reason: 'an entry the package did not seal' });
      expect.same(await root(again, 'host', { ward: 'bad' }), { error: 'bad is hosted already' }, 'its name and seed stay kept');
      await spoil(box);
      let refused = '';
      await world.restart('h', t.again(bodies)).catch((e: Error) => (refused = e.message));
      expect.equal(refused, 'an entry the package did not seal');
    },
  ],
  [
    `law on ${t.name}: a package carried to another memory stands the same harbor, its DNA with it, under the same seed`,
    async () => {
      const here = t.make();
      const there = t.make();
      const world = new World(t.defaults);
      const harbor = await standOne(world, 'here', t, here);
      expect.same(await root(harbor, 'open', { key: 'echo', class: 'org.example.echo' }), { opened: 'echo' });
      expect.same(await root(harbor, 'host', { ward: 'alice' }), { hosted: 'alice' });
      expect.same(await root(harbor, 'boot', { key: 'me', class: 'org.example.customer' }, 'alice'), { booted: 'me' });
      const pks = { box: (await census(harbor)).pk, alice: (await census(harbor, 'alice')).pk };
      const carried = await copyPackage(here.memory, there.memory);
      expect.equal(carried.filter((p) => !Dna.occupies(p)).length, 2, 'the box ward and alice, beside the DNA');
      const moved = await world.harbor('there', on(t, { custody: here.custody, memory: there.memory }));
      expect.same({ box: (await census(moved)).pk, alice: (await census(moved, 'alice')).pk }, pks);
      expect.same(await catalogue(moved, 'live'), await catalogue(harbor, 'live'));
      expect.same((await census(moved, 'alice')).beings, { me: { class: 'org.example.customer', public: false, absent: false } });
      expect.same(await being(moved, 'me', 'echo', { text: 'moved' }, 'alice'), { said: { echoed: 'moved', to: 'lent:1' } });
      const stranger = await world.harbor('stranger', on(t, { custody: t.make().custody, memory: there.memory }));
      expect.same(await standing(stranger), [], 'the bytes carried say nothing without the seed');
    },
  ],
  [
    `law on ${t.name}: the root sweeps every place the dock does not name, and nothing it does, the DNA's among them`,
    async () => {
      const bodies = t.make();
      const world = new World(t.defaults);
      const harbor = await standOne(world, 'h', t, bodies);
      expect.same(await root(harbor, 'host', { ward: 'w' }), { hosted: 'w' });
      const mine = (await bodies.memory.places()).sort();
      expect.equal((await wardPlaces(bodies.memory)).length, 2, 'the box ward and the ward it hosts');
      await bodies.memory.write('ff'.repeat(16), new Map([['ab', new Uint8Array([1, 2, 3])]]));
      expect.same(await root(harbor, 'sweep'), { swept: ['ff'.repeat(16)] });
      expect.same((await bodies.memory.places()).sort(), mine, 'what the dock names stays');
      expect.same(await root(harbor, 'sweep'), { swept: [] });
      const again = await world.restart('h', t.again(bodies));
      expect.same(await standing(again), ['w']);
      expect.same(await root(again, 'boot', { key: 'me', class: 'org.example.customer' }, 'w'), { booted: 'me' });
    },
  ],
  [
    `law on ${t.name}: a restart stands the dock, its faculties, every hosted ward and its beings, and lends, with nobody asking`,
    async () => {
      const bodies = { acme: t.make(), home: t.make() };
      const world = new World(t.defaults);
      await stand(world, t, bodies, { alice: drawn(), bob: drawn() }, expect);
      const pksOf = async (home: Harbor, acme: Harbor) => ({ box: (await census(home)).pk, alice: (await census(home, 'alice')).pk, bob: (await census(home, 'bob')).pk, shop: (await census(acme, 'shop')).pk });
      const pks = await pksOf(world.get('home'), world.get('acme'));
      const beings = await census(world.get('home'), 'alice');
      const home = await world.restart('home', t.again(bodies.home));
      const acme = await world.restart('acme', t.again(bodies.acme));
      expect.same(await standing(home), ['alice', 'bob']);
      expect.same(await standing(acme), ['shop']);
      expect.same(await pksOf(home, acme), pks);
      expect.same(await census(home, 'alice'), beings);
      expect.equal((await census(home)).beings.echo?.class, 'org.example.echo');
      expect.same(await me(world, 'buy', { item: 'cake' }), { said: { bought: 'cake' } });
      expect.same(await me(world, 'echo', { text: 'again' }), { said: { echoed: 'again', to: 'lent:1' } });
      expect.same(await sold(acme), ['tea to alice', 'cake to alice']);
    },
  ],
  [
    `law on ${t.name}: the dock holds a far ward and a far being under two names, and pilots each after a restart`,
    async () => {
      const bodies = { acme: t.make(), home: t.make() };
      const world = new World(t.defaults);
      const acme = await standOne(world, 'acme', t, bodies.acme);
      const home = await standOne(world, 'home', t, bodies.home);
      expect.same(await root(acme, 'host', { ward: 'shop' }), { hosted: 'shop' });
      expect.same(await root(acme, 'boot', { key: 'shop', class: 'org.example.shop' }, 'shop'), { booted: 'shop' });
      const onShop = (await root(acme, 'invite', { being: 'shop', id: 'home', notes: { owner: true } }, 'shop')) as JsonObject;
      const onAcme = (await root(acme, 'own', { id: 'home' })) as JsonObject;
      expect.same(await root(home, 'hold', { name: 'shop', invitation: onShop }), { held: 'shop', ward: (await census(acme, 'shop')).pk });
      expect.same(await root(home, 'hold', { name: 'acme', invitation: onAcme }), { held: 'acme', ward: (await census(acme)).pk });
      const again = await world.restart('home', t.again(bodies.home));
      expect.same(await root(again, 'pilot', { name: 'shop', method: 'buy', args: { item: 'tea' } }), { answer: { bought: 'tea' } });
      expect.same(await root(again, 'pilot', { name: 'acme', method: 'host', args: { ward: 'deli' } }), { answer: { hosted: 'deli' } });
      expect.same(await sold(acme), ['tea to home']);
      expect.same(await root(again, 'drop', { name: 'shop' }), { dropped: 'shop' });
      expect.same(await root(again, 'pilot', { name: 'shop' }), { error: 'shop is not held' });
    },
  ],
  [
    `law on ${t.name}: every root ask is a step a restart may follow, and each step wakes whole`,
    async () => {
      const bodies = t.make();
      const world = new World(t.defaults);
      await world.harbor('h', on(t, bodies));
      const step = async (ask: (h: Harbor) => Promise<unknown>, want: unknown): Promise<Harbor> => {
        expect.same(await ask(world.get('h')), want);
        return world.restart('h', t.again(bodies));
      };
      await step(async (h) => {
        const { added, version } = await catalogue(h, 'add', { source: LAW });
        return { added, version };
      }, { added: law.module, version: law.version });
      await step((h) => root(h, 'open', { key: 'echo', class: 'org.example.echo' }), { opened: 'echo' });
      await step((h) => root(h, 'host', { ward: 'alice' }), { hosted: 'alice' });
      await step((h) => root(h, 'boot', { key: 'me', class: 'org.example.customer' }, 'alice'), { booted: 'me' });
      const h = await step((x) => being(x, 'me', 'echo', { text: 'one' }, 'alice'), { said: { echoed: 'one', to: 'lent:1' } });
      expect.same(await being(h, 'me', 'echo', { text: 'two' }, 'alice'), { said: { echoed: 'two', to: 'lent:1' } });
    },
  ],
  [
    `law on ${t.name}: a ward and the dock that become a module's class stand so again after a restart, the dock once the catalogue wakes`,
    async () => {
      const bodies = t.make();
      const world = new World(t.defaults);
      const harbor = await standOne(world, 'h', t, bodies);
      expect.same(await root(harbor, 'open', { key: 'echo', class: 'org.example.echo' }), { opened: 'echo' });
      expect.same(await root(harbor, 'host', { ward: 'alice' }), { hosted: 'alice' });
      expect.same(await root(harbor, 'become', { class: STEWARD }, 'alice'), { became: STEWARD });
      expect.same(await root(harbor, 'become', { class: QUAY }), { became: QUAY });
      const again = await world.restart('h', t.again(bodies));
      expect.same(await root(again, 'sign', undefined, 'alice'), { signed: (await census(again, 'alice')).pk });
      expect.same(await root(again, 'moor'), { moored: ['alice'] });
      expect.same((await census(again)).failed, NONE);
      expect.same(await root(again, 'boot', { key: 'me', class: 'org.example.customer' }, 'alice'), { booted: 'me' });
      expect.same(await being(again, 'me', 'echo', { text: 'hi' }, 'alice'), { said: { echoed: 'hi', to: 'lent:1' } }, 'the quay lends');
    },
  ],
  [
    `law on ${t.name}: the terrain keeps the seed and sealed bytes, and reads no name, cell, hosted seed or code`,
    async () => {
      const home = t.make();
      const watched = new Watched(home.memory);
      const world = new World(t.defaults);
      const seeds = { alice: drawn(), bob: drawn() };
      await stand(world, t, { acme: t.make(), home: { custody: home.custody, memory: watched } }, seeds, expect);
      const secrets = [seeds.alice, seeds.bob].map(utf8);
      // Names of five bytes or more: a shorter one turns up in random bytes
      // of this size often enough to fail a run by chance.
      const words = ['alice', 'org.example', 'hosted', 'lent:1', 'customer', 'nervur', 'modules', 'genesis'].map(utf8);
      expect.ok(watched.seen.length > 0, 'the harbor kept something');
      for (const { place, name, bytes } of watched.seen) {
        expect.ok(/^[0-9a-f]+$/.test(place) && /^[0-9a-f]+$/.test(name), 'names are the kit hex');
        if (bytes === null) continue;
        for (const secret of secrets) expect.ok(!holds(bytes, secret), 'no hosted seed in the clear');
        for (const word of words) expect.ok(!holds(bytes, word), 'no name, cell or code in the clear');
        expect.ok(!holds(bytes, await home.custody.seed()), 'no harbor seed in memory');
      }
    },
  ],
  [
    `law on ${t.name}: another seed finds nothing of the package, and a byte changed refuses to unpack`,
    async () => {
      const bodies = t.make();
      const watched = new Watched(bodies.memory);
      const world = new World(t.defaults);
      const harbor = await standOne(world, 'h', t, { custody: bodies.custody, memory: watched });
      expect.same(await root(harbor, 'host', { ward: 'w' }), { hosted: 'w' });
      const last = [...watched.seen].reverse().find((s) => s.bytes !== null && s.bytes.length > 0)!;
      const stranger = await world.harbor('stranger', on(t, { custody: t.make().custody, memory: watched }));
      expect.same(await standing(stranger), [], 'another seed opens another package');
      const bytes = last.bytes!.slice();
      bytes[0] = bytes[0]! ^ 1;
      await watched.inner.write(last.place, new Map([[last.name, bytes]]));
      let refused = false;
      await world.restart('h', t.again(bodies)).catch(() => (refused = true));
      expect.ok(refused, 'a changed byte does not unpack');
    },
  ],
];

// The keepers a hosted ward's place may live with: the root memory, the
// memory faculty the defaults bring, which keeps places of the terrain's
// own memory under names longer than a ward's, and a memory faculty a
// module brings.
type Keeping = { name: string; memory?: string; kind?: string; ground?: boolean };
const keepersOf = (t: Terrain): Keeping[] => {
  const ground = t.defaults.classes.find((C) => C.prototype instanceof MemoryFaculty);
  if (!ground) throw new Error('the keeper scenes need defaults that bring a memory faculty');
  return [{ name: 'the root memory' }, { name: 'a memory faculty of the terrain', memory: 'vault', kind: ground.kind, ground: true }, { name: 'a memory faculty of a module', memory: 'shelf', kind: SHELF }];
};
const onKeeper = (k: Keeping): JsonObject => (k.memory === undefined ? {} : { memory: k.memory });

// A place of the package is thirty-two hex digits, and one a memory
// faculty of the terrain keeps is longer.
const PLACE = 32;

// The keeper opened in the box ward, where it is a memory faculty.
const openKeeper = async (harbor: Harbor, k: Keeping, expect: Expect): Promise<void> => {
  if (k.memory !== undefined) expect.same(await root(harbor, 'open', { key: k.memory, class: k.kind! }), { opened: k.memory });
};
const profile = (harbor: Harbor, method: string, args: JsonObject = {}): Promise<unknown> => being(harbor, 'me', method, args, 'ana');

// Acme's shop kept by `k`, home's alice on the root memory, joined, and
// every box that reaches the shop's door seen.
const shopOn = async (world: World, t: Terrain, k: Keeping, expect: Expect): Promise<{ acme: Bodies; boxes: Uint8Array[]; shop: string }> => {
  const bodies = { acme: t.make(), home: t.make() };
  const acme = await standOne(world, 'acme', t, bodies.acme);
  const home = await standOne(world, 'home', t, bodies.home);
  await openKeeper(acme, k, expect);
  expect.same(await root(acme, 'host', { ward: 'shop', ...onKeeper(k) }), { hosted: 'shop' });
  expect.same(await root(acme, 'boot', { key: 'shop', class: 'org.example.shop' }, 'shop'), { booted: 'shop' });
  expect.same(await root(home, 'host', { ward: 'alice' }), { hosted: 'alice' });
  expect.same(await root(home, 'boot', { key: 'me', class: 'org.example.customer' }, 'alice'), { booted: 'me' });
  const invitation = (await root(acme, 'invite', { being: 'shop', id: 'alice' }, 'shop')) as JsonObject;
  const shop = (await census(acme, 'shop')).pk;
  const boxes: Uint8Array[] = [];
  const carry = world.carry.bind(world);
  world.carry = (pk, bytes) => {
    if (pk === shop) boxes.push(bytes.slice());
    return carry(pk, bytes);
  };
  expect.same(await me(world, 'join', { invitation }), { joined: 'shop' });
  return { acme: bodies.acme, boxes, shop };
};

// A cell is a being's field made durable, whoever keeps it: the law's
// scenes of a being's fields, run over every keeper a hosted ward's place
// may live with.
export const keeperScenes = (t: Terrain, expect: Expect): [string, () => Promise<void>][] => [
  ...keepersOf(t).flatMap((k): [string, () => Promise<void>][] => [
    [
      `law on ${t.name}: a being's fields kept by ${k.name} come back at wake, sealed, where that keeper alone holds them`,
      async () => {
        shelves.clear();
        const bodies = t.make();
        const watched = new Watched(bodies.memory);
        const world = new World(t.defaults);
        const harbor = await standOne(world, 'h', t, { custody: bodies.custody, memory: watched });
        await openKeeper(harbor, k, expect);
        expect.same(await root(harbor, 'host', { ward: 'ana', ...onKeeper(k) }), { hosted: 'ana' });
        expect.same(await root(harbor, 'boot', { key: 'me', class: PROFILE }, 'ana'), { booted: 'me' });
        expect.same(await profile(harbor, 'set', { name: 'Anastasia', age: 31 }), { name: 'Anastasia', age: 31 });
        const again = await world.restart('h', t.again(bodies));
        expect.same(await profile(again, 'get'), { name: 'Anastasia', age: 31 });
        expect.same((await census(again)).failed, NONE);
        const places = await wardPlaces(bodies.memory);
        const shelf = await shelfOf('shelf').places();
        if (k.memory === undefined) expect.same([places.length, shelf.length], [2, 0], 'the box ward and ana, on the root memory');
        else if (k.ground) expect.same([places.length, places.filter((p) => p.length > PLACE).length, shelf.length], [2, 1, 0], 'ana behind the memory faculty of the terrain');
        else expect.same([places.length, shelf.length], [1, 1], 'the box ward on the root memory, ana on the shelf');
        const seen = [...watched.seen, ...shelfOf('shelf').seen];
        for (const { bytes } of seen) {
          if (bytes === null) continue;
          for (const word of ['Anastasia', 'org.example', 'vault'].map(utf8)) expect.ok(!holds(bytes, word), 'no field, kind or key in the clear');
        }
      },
    ],
    [
      `law on ${t.name}: an answer whose keep ${k.name} refuses is silence, and the being keeps what she had`,
      async () => {
        shelves.clear();
        const bodies = t.make();
        const watched = new Watched(bodies.memory);
        const world = new World(t.defaults);
        const harbor = await standOne(world, 'h', t, { custody: bodies.custody, memory: watched });
        const box = watched.seen[0]!.place;
        await openKeeper(harbor, k, expect);
        expect.same(await root(harbor, 'host', { ward: 'ana', ...onKeeper(k) }), { hosted: 'ana' });
        expect.same(await root(harbor, 'boot', { key: 'me', class: PROFILE }, 'ana'), { booted: 'me' });
        expect.same(await profile(harbor, 'set', { age: 31 }), { name: '', age: 31 });
        // Only the keeper named refuses, so a keep that went elsewhere
        // would answer.
        if (k.memory === undefined) watched.refuse = (place) => place !== box;
        else if (k.ground) watched.refuse = (place) => place.length > box.length;
        else shelfOf('shelf').refuse = () => true;
        expect.ok(JSON.stringify(await profile(harbor, 'set', { age: 32 })) !== JSON.stringify({ name: '', age: 32 }), 'no answer leaves an unkept keep');
        watched.refuse = () => false;
        shelfOf('shelf').refuse = () => false;
        expect.same(await profile(harbor, 'get'), { name: '', age: 31 }, 'what she wrote is put back');
        const again = await world.restart('h', t.again(bodies));
        expect.same(await profile(again, 'get'), { name: '', age: 31 });
        expect.same(await profile(again, 'set', { age: 32 }), { name: '', age: 32 });
      },
    ],
    [
      `law on ${t.name}: the door's keys and the being's cells are one keep with ${k.name}, so a box replayed after a wake is answered once`,
      async () => {
        shelves.clear();
        const world = new World(t.defaults);
        const { acme, boxes, shop } = await shopOn(world, t, k, expect);
        const from = boxes.length;
        expect.same(await me(world, 'buy', { item: 'tea' }), { said: { bought: 'tea' } });
        const replayed = boxes.slice(from);
        expect.ok(replayed.length > 0, 'the buy crossed the door');
        const again = await world.restart('acme', t.again(acme));
        expect.same(await sold(again), ['tea to alice']);
        for (const bytes of replayed) await again.arrive(shop, bytes);
        expect.same(await sold(again), ['tea to alice'], 'a replayed box does not buy again');
        expect.same(await me(world, 'buy', { item: 'cake' }), { said: { bought: 'cake' } });
        expect.same(await sold(world.get('acme')), ['tea to alice', 'cake to alice']);
      },
    ],
  ]),
  [
    `law on ${t.name}: a ward whose memory faculty does not stand at wake fails alone, and stands whole once it returns`,
    async () => {
      shelves.clear();
      const bodies = t.make();
      const world = new World(t.defaults);
      const harbor = await standOne(world, 'h', t, bodies);
      await openKeeper(harbor, keepersOf(t)[2]!, expect);
      expect.same(await root(harbor, 'host', { ward: 'ana', memory: 'shelf' }), { hosted: 'ana' });
      expect.same(await root(harbor, 'host', { ward: 'bea' }), { hosted: 'bea' });
      expect.same(await root(harbor, 'boot', { key: 'me', class: PROFILE }, 'ana'), { booted: 'me' });
      expect.same(await profile(harbor, 'set', { age: 31 }), { name: '', age: 31 });
      const lost = await world.restart('h', { ...t.again(bodies), loader: new BundleLoader([]) });
      expect.same(await standing(lost), ['bea'], 'the root and its own ward stand');
      expect.same((await census(lost)).failed, { wards: { ana: 'the memory faculty shelf does not stand' }, routes: {} });
      const back = await world.restart('h', { ...t.again(bodies), loader: loaderOf(t) });
      expect.same(await standing(back), ['ana', 'bea']);
      expect.same(await profile(back, 'get'), { name: '', age: 31 });
    },
  ],
  [
    `law on ${t.name}: a ward carried between keepers keeps its fields, its door and its key, and leaves nothing where it was`,
    async () => {
      shelves.clear();
      const world = new World(t.defaults);
      const { acme, shop } = await shopOn(world, t, keepersOf(t)[0]!, expect);
      const harbor = world.get('acme');
      for (const k of keepersOf(t).slice(1)) await openKeeper(harbor, k, expect);
      const items = ['tea', 'cake', 'bread', 'milk'];
      // The wards the root memory keeps, the places the terrain's memory
      // faculty keeps in it, and the shelf's.
      const counts = async (): Promise<number[]> => {
        const places = await wardPlaces(acme.memory);
        return [places.filter((p) => p.length === PLACE).length, places.filter((p) => p.length > PLACE).length, (await shelfOf('shelf').places()).length];
      };
      expect.same(await me(world, 'buy', { item: items[0]! }), { said: { bought: items[0]! } });
      const road: [Keeping, number[]][] = [
        [keepersOf(t)[1]!, [1, 1, 0]],
        [keepersOf(t)[2]!, [1, 0, 1]],
        [keepersOf(t)[0]!, [2, 0, 0]],
      ];
      for (const [i, [k, want]] of road.entries()) {
        expect.same(await root(world.get('acme'), 'move', { ward: 'shop', memory: k.memory ?? null }), { moved: 'shop', memory: k.memory ?? null });
        expect.same(await counts(), want, `only ${k.name} holds the shop`);
        const again = await world.restart('acme', t.again(acme));
        expect.equal((await census(again, 'shop')).pk, shop, 'the key moves with the ward');
        expect.same(await me(world, 'buy', { item: items[i + 1]! }), { said: { bought: items[i + 1]! } });
        expect.same(await sold(again), items.slice(0, i + 2).map((item) => `${item} to alice`));
      }
      expect.same(await root(world.get('acme'), 'move', { ward: 'shop', memory: null }), { error: 'shop is kept there already' });
      expect.same(await root(world.get('acme'), 'move', { ward: 'shop', memory: 'echo' }), { error: 'no such memory faculty' });
    },
  ],
  [
    `law on ${t.name}: a memory faculty keeping a ward does not go, and the root sweeps what no keeper is named for`,
    async () => {
      shelves.clear();
      const bodies = t.make();
      const world = new World(t.defaults);
      const harbor = await standOne(world, 'h', t, bodies);
      for (const k of keepersOf(t).slice(1)) await openKeeper(harbor, k, expect);
      expect.same(await root(harbor, 'host', { ward: 'ana', memory: 'vault' }), { hosted: 'ana' });
      expect.same(await root(harbor, 'host', { ward: 'bea', memory: 'shelf' }), { hosted: 'bea' });
      expect.same(await root(harbor, 'host', { ward: 'cy', memory: 'nothing' }), { error: 'no such memory faculty' });
      expect.same(await root(harbor, 'unboot', { being: 'vault' }), { error: 'a ward is kept by this memory faculty' });
      const before = [(await bodies.memory.places()).sort(), await shelfOf('shelf').places()];
      const stray = 'ee'.repeat(16);
      await bodies.memory.write(stray, new Map([['ab', new Uint8Array([1])]]));
      await shelfOf('shelf').write(stray, new Map([['ab', new Uint8Array([2])]]));
      expect.same(await root(harbor, 'sweep'), { swept: [stray, stray] });
      expect.same([(await bodies.memory.places()).sort(), await shelfOf('shelf').places()], before, 'what the dock names stays');
      expect.same(await root(harbor, 'move', { ward: 'bea', memory: null }), { moved: 'bea', memory: null });
      expect.same(await root(harbor, 'unboot', { being: 'shelf' }), { unbooted: 'shelf' });
      const again = await world.restart('h', t.again(bodies));
      expect.same(await standing(again), ['ana', 'bea']);
    },
  ],
];
