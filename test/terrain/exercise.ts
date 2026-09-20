// SPDX-License-Identifier: Apache-2.0
// What every terrain runs: the arithmetic vectors, a pointer world through
// the main entry alone, and, handed where a Node host is reached, the web
// carrier against it. It names no runtime,
// so it bundles, and it reports rather than throws, so an engine hands the
// list back as JSON.
import { CryptoEntropy, DEFAULTS, grounds, Harbor, NEUTRAL, HeldCustody, PointerTerrain, SourceLoader, VolatileMemory, WebFaculty, World, type Bundled, type JsonObject, type Loader, type Module } from '../../src/index.ts';
import { custodyScenes, expect, LAW, law, keeperScenes, lawBundle, lawScenes, memoryScenes, type Terrain } from '../../src/core/proof/index.ts';
import { standOne } from '../../src/core/proof/law.ts';
import { BROWSER, IdbCustody, IdbMemory, rootOf, serveWorker } from '../../src/core/browser/index.ts';
import { records, reproduce, zeroFirst } from '../vectors.ts';
import { being, census, root } from '../core/harbor/asks.ts';

export type Result = { name: string; error?: string };

// The law's module as a bundle built it, where the engine imports no
// source it is handed: an edge, and a browser's service worker. Anywhere
// else a harbor imports its source.
const built = (): Module | undefined => (globalThis as { nervurLaw?: Module }).nervurLaw;
const loaderHere = (): Loader => {
  const module = built();
  return module ? lawBundle(module) : new SourceLoader();
};
const bundled = (): { bundle?: Bundled[] } => {
  const module = built();
  return module ? { bundle: [{ source: LAW, module }] } : {};
};

export const catalogue = async (harbor: Harbor, method: string, args: JsonObject = {}): Promise<JsonObject> => (await being(harbor, 'catalogue', method, args)) as JsonObject;

const pointer: Terrain = {
  name: 'pointer',
  make: () => ({ custody: new HeldCustody(new CryptoEntropy()), memory: new VolatileMemory() }),
  again: (bodies) => bodies,
  loader: loaderHere,
  defaults: DEFAULTS,
};

const scenes: [string, () => Promise<void>][] = [
  ...records.map((r): [string, () => Promise<void>] => [`arithmetic: ${r.name}`, () => reproduce(r, expect)]),
  ['arithmetic: a secret whose first byte is zero', () => zeroFirst(expect)],
  ...lawScenes(pointer, expect),
  ...keeperScenes(pointer, expect),
  [
    'world: a relation across harbors, a lend by contract, the cells guard, and a restart',
    async () => {
      const world = new World(DEFAULTS);
      const acme = await standOne(world, 'acme', pointer);
      const home = await standOne(world, 'home', pointer);
      expect.same(await root(home, 'open', { key: 'echo', class: 'org.example.echo' }), { opened: 'echo' });
      expect.same(await root(home, 'host', { ward: 'alice' }), { hosted: 'alice' });
      expect.same(await root(home, 'boot', { key: 'me', class: 'org.example.customer' }, 'alice'), { booted: 'me' });
      await root(acme, 'host', { ward: 'shop' });
      await root(acme, 'boot', { key: 'shop', class: 'org.example.shop' }, 'shop');
      const invitation = await root(acme, 'invite', { being: 'shop', id: 'alice' }, 'shop');
      const me = (method: string, args: JsonObject = {}) => being(world.get('home'), 'me', method, args, 'alice');
      expect.same(await me('join', { invitation }), { joined: 'shop' });
      expect.same(await me('buy', { item: 'tea' }), { said: { bought: 'tea' } });
      expect.same(await me('echo', { text: 'hi' }), { said: { echoed: 'hi', to: 'lent:1' } });
      expect.same(await me('spoil'), { refused: true });
      await world.restart('home');
      await world.restart('acme');
      expect.same(await me('buy', { item: 'cake' }), { said: { bought: 'cake' } });
      expect.same(await me('echo', { text: 'again' }), { said: { echoed: 'again', to: 'lent:1' } });
      expect.same(await being(world.get('acme'), 'shop', 'sold', {}, 'shop'), { sold: ['tea to alice', 'cake to alice'] });
    },
  ],
];

// Where the Node host is reached, and fresh invitations on it.
export type Reach = { post: string; held: string; tcp: string; shop: JsonObject; probe: JsonObject };

// A harbor of this engine, speaking the web alone, as a page or a worker.
const webHarbor = async (): Promise<Harbor> => {
  const harbor = await Harbor.open(new PointerTerrain({ loader: loaderHere(), defaults: DEFAULTS }));
  await root(harbor, 'open', { key: 'web', class: WebFaculty.kind });
  await catalogue(harbor, 'add', { source: LAW });
  return harbor;
};
const asked = async (harbor: Harbor, key: string, method: string, args: JsonObject = {}, ward?: string): Promise<JsonObject> => (await being(harbor, key, method, args, ward)) as JsonObject;

const wire = (reach: Reach): [string, () => Promise<void>][] => [
  [
    'probe: a harbor opened with no terrain stands on the neutral ground and asks over the web',
    async () => {
      expect.same(grounds().at(-1), NEUTRAL, 'the neutral ground is tried last');
      const harbor = await Harbor.open(bundled());
      try {
        expect.same(Object.keys((await census(harbor)).beings), ['catalogue'], 'nothing opened unasked');
        expect.same(await root(harbor, 'open', { key: 'web', class: WebFaculty.kind }), { opened: 'web' });
        const { added, version } = await catalogue(harbor, 'add', { source: LAW });
        expect.same({ added, version }, { added: law.module, version: law.version });
        await root(harbor, 'host', { ward: 'alice' });
        await root(harbor, 'boot', { key: 'me', class: 'org.example.customer' }, 'alice');
        expect.same(await asked(harbor, 'me', 'join', { invitation: reach.probe }, 'alice'), { joined: 'shop' });
        expect.same(await asked(harbor, 'me', 'buy', { item: 'bread' }, 'alice'), { said: { bought: 'bread' } });
      } finally {
        await harbor.close();
      }
    },
  ],
  [
    'web: a post and a held line to a listener on Node',
    async () => {
      const harbor = await webHarbor();
      try {
        await root(harbor, 'host', { ward: 'alice' });
        await root(harbor, 'boot', { key: 'me', class: 'org.example.customer' }, 'alice');
        expect.same(await asked(harbor, 'me', 'join', { invitation: reach.shop }, 'alice'), { joined: 'shop' }, 'by the invitation, over a post');
        expect.same(await asked(harbor, 'me', 'buy', { item: 'tea' }, 'alice'), { said: { bought: 'tea' } });
        const shop = reach.shop.ward as string;
        expect.same(await root(harbor, 'route', { ward: shop, at: [reach.held] }), { routed: shop });
        expect.same(await asked(harbor, 'me', 'buy', { item: 'cake' }, 'alice'), { said: { bought: 'cake' } }, 'on a held line');
        expect.same(await asked(harbor, 'me', 'buy', { item: 'pie' }, 'alice'), { said: { bought: 'pie' } }, 'the same line again');
      } finally {
        await harbor.close();
      }
    },
  ],
];

// A keep that aborts at its second entry, as a tab closed inside one.
class CutIdb extends IdbMemory {
  #puts = 0;
  protected override put(store: IDBObjectStore, key: [string, string], bytes: ArrayBuffer | null): void {
    this.#puts += 1;
    if (this.#puts === 4) throw new Error('the tab closed inside a keep');
    super.put(store, key, bytes);
  }
}

let databases = 0;
const database = (): string => `nervur-exercise-${String(Date.now())}-${String((databases += 1))}`;

const indexeddb: Terrain = {
  name: 'indexeddb',
  make: () => {
    const name = database();
    return { custody: new IdbCustody(name), memory: new IdbMemory(name) };
  },
  again: (bodies) => {
    const name = (bodies.memory as IdbMemory).name;
    return { custody: new IdbCustody(name), memory: new IdbMemory(name) };
  },
  defaults: DEFAULTS,
};

// Where the browser ground is known: its bodies under the contract and
// law scenes in this engine, and a harbor opened with no terrain on it.
const browser = (): [string, () => Promise<void>][] => ([

  ...custodyScenes('IdbCustody', () => {
    const name = database();
    return [new IdbCustody(name), new IdbCustody(name)];
  }, expect),
  ...memoryScenes(
    'IdbMemory',
    () => {
      const name = database();
      return [new IdbMemory(name), new IdbMemory(name)];
    },
    expect,
    () => {
      const name = database();
      return { cut: new CutIdb(name), fresh: new IdbMemory(name) };
    },
  ),
  ...lawScenes(indexeddb, expect),
  ...keeperScenes(indexeddb, expect),
  [
    'browser: tabs reach one harbor in a shared worker',
    async () => {
      const url = `/worker.js?where=${database()}`;
      const [a, b] = [new SharedWorker(url, { type: 'module' }), new SharedWorker(url, { type: 'module' })];
      const [askA, askB] = [rootOf(a.port), rootOf(b.port)];
      const pk = ((await askA({})) as { answer: { notes: { pk: string } } }).answer.notes.pk;
      expect.equal(((await askB({})) as { answer: { notes: { pk: string } } }).answer.notes.pk, pk, 'the same harbor from another tab');
      expect.equal(((await askA({})) as { answer: { notes: { foreground?: boolean } } }).answer.notes.foreground, undefined, 'a shared worker outlives a tab, so its census marks nothing');
      expect.same(await askA({ method: 'host', args: { ward: 'w' } }), { answer: { hosted: 'w' } });
      expect.ok('answer' in (await askB({ ward: 'w' })), 'what one tab did, another sees');
      expect.same(await askB({ ward: 'nobody' }), { error: 'no such ward' });
      a.port.close();
      b.port.close();
    },
  ],
  [
    'browser: a harbor opened with no terrain keeps itself in IndexedDB, one run at a time',
    async () => {
      expect.same(grounds(), [BROWSER, NEUTRAL]);
      const where = database();
      const harbor = await Harbor.open({ where });
      expect.same(Object.keys((await census(harbor)).beings), ['catalogue'], 'nothing opened unasked');
      expect.equal((await census(harbor)).foreground, true, 'a harbor in a tab stands on the browser ground, and its census says it lives with the tab');
      let refused = '';
      await Harbor.open({ where }).catch((e: Error) => (refused = e.message));
      expect.ok(/already open/.test(refused), 'one run holds a database');
      expect.same(await catalogue(harbor, 'add', { source: "import { readFile } from 'node:fs';" }), { error: "a module imports nothing but 'nervur'" });
      expect.equal((await catalogue(harbor, 'add', { source: LAW })).added, law.module, 'a source run from a Blob URL');
      await root(harbor, 'host', { ward: 'alice' });
      await root(harbor, 'boot', { key: 'me', class: 'org.example.customer' }, 'alice');
      const { pk } = await census(harbor);
      await harbor.close();
      const again = await Harbor.open({ where });
      expect.equal((await census(again)).pk, pk, 'the same harbor from its database');
      expect.same(await root(again, undefined, undefined, 'alice'), { error: 'no such ward' }, 'the boot stands no hosted ward');
      await root(again, 'stand');
      expect.same((await census(again, 'alice')).beings, { me: { class: 'org.example.customer', public: false, absent: false } }, 'live stands again from the database');
      await again.close();
    },
  ],
] as [string, () => Promise<void>][]).map(([name, scene]) => [name.startsWith('browser:') ? name : `browser: ${name}`, scene]);

// A worker's script: its harbor, served to every tab, running the modules
// its script carries, since a service worker imports nothing once it runs.
export const worker = (where: string): void => serveWorker(Harbor.open({ where, ...bundled() }));

export const run = async (reach?: Reach): Promise<Result[]> => {
  const results: Result[] = [];
  for (const [name, scene] of [...scenes, ...(reach ? wire(reach) : []), ...(grounds().includes(BROWSER) ? browser() : [])]) {
    try {
      await scene();
      results.push({ name });
    } catch (e) {
      results.push({ name, error: String((e as Error)?.stack ?? e) });
    }
  }
  return results;
};
