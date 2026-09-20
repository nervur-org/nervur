// SPDX-License-Identifier: Apache-2.0
// Harbors unpacked from a terrain alone, in a pointer world, on the
// classes written for the core's suites, and asked by the root line alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Being, Catalogue, CarrierFaculty, Faculty, Loader, SourceLoader, BundleLoader, CryptoEntropy, UNDIALED, WARD, World, type Asker, type AskSpec, type BeingClass, type Dialed, type JsonObject, type Module, type Reply, type Stance } from '../kit.ts';
import { TEST, TestCarrier, TestDock, TestMemory } from '../classes.ts';
import { carrierIn } from '../../../src/core/harbor/index.ts';
import { hex, unhex } from '../../../src/core/crypto/index.ts';
import { blob as blobOf, idOf, isId } from '../../../src/core/git/index.ts';
import { schemeOf, WardKey } from '../../../src/core/quo/index.ts';
import { holds } from '../../claims.ts';
import { Refusing, Unreadable } from '../ward/beings.ts';
import { being, census, root } from './asks.ts';
import { genesis, me, module, shop, sold, stand } from './shop.ts';

const CATALOGUE = { class: 'org.nervur.catalogue', public: false, absent: false };
const NONE = { wards: {}, routes: {} };
const catalogue = async (harbor: Parameters<typeof root>[0], method: string, args: JsonObject = {}): Promise<JsonObject> => (await being(harbor, 'catalogue', method, args)) as JsonObject;
const wards = async (harbor: Parameters<typeof root>[0]): Promise<string[]> => Object.keys((await census(harbor)).wards as object);

test(holds('onion.from-terrain', 'harbor: a harbor opened from a terrain alone holds a box ward with the dock and its catalogue'), async () => {
  const harbor = await new World(TEST).harbor('h');
  const described = (await root(harbor)) as { asks: { name: string }[]; notes: JsonObject };
  assert.match(described.notes.pk as string, /^[0-9a-f]{128}$/);
  assert.deepEqual(described.notes, { pk: described.notes.pk, class: TestDock.kind, beings: { catalogue: CATALOGUE }, wards: {}, routes: {}, reach: [], failed: NONE, listening: [] });
  assert.deepEqual(
    described.asks.map((a) => a.name),
    ['boot', 'unboot', 'public', 'invite', 'ask', 'own', 'disown', 'become', 'hold', 'pilot', 'drop', 'stand', 'open', 'host', 'move', 'route', 'reach', 'sweep', 'heard'],
  );
  const { live, modules } = await catalogue(harbor, 'modules');
  assert.deepEqual(modules, {});
  assert.ok(isId(live), 'live names the genesis commit');
  assert.deepEqual(await root(harbor, 'open', { key: 'other', class: 'org.nervur.catalogue' }), { error: 'no such faculty' });
});

const TWIN = shop.source.replace("export const module = 'org.example.shop'", "export const module = 'org.example.twin'");
const OUTSIDE = shop.source.replace("export const module = 'org.example.shop'", "export const module = 'com.other.shop'");

test(holds('dna.live', 'harbor: add commits a module on live and moves live to it, and a set that does not run together is refused with live where it was'), async () => {
  const harbor = await new World(TEST).harbor('h');
  const genesisCommit = (await catalogue(harbor, 'live')).live as string;
  assert.deepEqual(await root(harbor, 'open', { key: 'echo', class: 'org.example.echo' }), { error: 'no such faculty' }, 'no module runs yet');
  assert.deepEqual(await catalogue(harbor, 'add', { source: 7 }), { error: 'source is text' });
  assert.match((await catalogue(harbor, 'add', { source: 'export const module = ;' })).error as string, /^the module did not load: /);
  assert.deepEqual(await catalogue(harbor, 'add', { source: shop.source, name: 'org.example.other' }), { error: 'the source is module org.example.shop, not org.example.other' });
  assert.deepEqual(await catalogue(harbor, 'live'), { live: genesisCommit }, 'nothing refused moved live');
  const added = await catalogue(harbor, 'add', { source: shop.source });
  assert.deepEqual({ ...added, live: isId(added.live) }, { added: module, version: '1', live: true });
  const { log } = (await catalogue(harbor, 'log')) as { log: { commit: string; parents: string[]; message: string }[] };
  assert.deepEqual(
    log.map(({ commit, parents, message }) => ({ commit, parents, message })),
    [
      { commit: added.live, parents: [genesisCommit], message: 'add org.example.shop 1' },
      { commit: genesisCommit, parents: [], message: 'genesis' },
    ],
  );
  assert.deepEqual(await catalogue(harbor, 'add', { source: TWIN }), { error: 'kind org.example.echo is in modules org.example.shop and org.example.twin' }, 'the same kinds under a second module name');
  assert.deepEqual(await catalogue(harbor, 'add', { source: OUTSIDE }), { error: 'kind org.example.echo is outside module com.other.shop' });
  assert.deepEqual(await catalogue(harbor, 'live'), { live: added.live }, 'a refused set leaves live where it was');
  assert.deepEqual(await root(harbor, 'open', { key: 'echo', class: 'org.example.echo' }), { opened: 'echo' });
  const blob = await idOf(blobOf(shop.source));
  assert.deepEqual(await catalogue(harbor, 'modules'), { live: added.live, modules: { [module]: { running: '1', blob } } });
  assert.deepEqual(await catalogue(harbor, 'sources'), { live: added.live, sources: [{ blob, source: shop.source }] });
  assert.deepEqual(await catalogue(harbor, 'remove', { module }), { error: 'a being stands on this module' });
  assert.deepEqual(await catalogue(harbor, 'remove', { module: 'org.example.none' }), { error: 'no such module' });
  assert.deepEqual(await root(harbor, 'unboot', { being: 'echo' }), { unbooted: 'echo' });
  const removed = await catalogue(harbor, 'remove', { module });
  assert.equal(removed.removed, module);
  assert.deepEqual(await catalogue(harbor, 'modules'), { live: removed.live, modules: {} });
  assert.deepEqual(await root(harbor, 'open', { key: 'echo', class: 'org.example.echo' }), { error: 'no such faculty' });
});

test(holds('catalogue.restart-missing', 'harbor: a restart whose loader does not run a module stands and says why'), async () => {
  const world = await genesis();
  const failedWith = async (loader: Loader) => {
    const home = await world.restart('home', { loader });
    assert.deepEqual(await wards(home), ['alice']);
    assert.deepEqual((await census(home)).failed, NONE, 'every hosted ward stands');
    return ((await catalogue(home, 'modules')).modules as Record<string, { failed?: string }>)[module]?.failed;
  };
  const blob = await idOf(blobOf(shop.source));
  assert.equal(await failedWith(new BundleLoader([])), `redeploy needed: blob ${blob} is no module this bundle carries, and it carries none`);
  const other = new (class extends Loader {
    async load(source: string): Promise<Module> {
      return { ...(await new SourceLoader().load(source)), module: 'org.example.other' };
    }
  })();
  assert.equal(await failedWith(other), 'modules/org.example.shop.js declares module org.example.other');
  const throwing = new (class extends Loader {
    load(): Promise<Module> {
      return Promise.reject(new Error('the disk is gone'));
    }
  })();
  assert.equal(await failedWith(throwing), 'the disk is gone', 'a loader that throws says why, and the census keeps it');
  const home = await world.restart('home', { loader: new SourceLoader() });
  assert.equal(((await catalogue(home, 'modules')).modules as Record<string, { running: string }>)[module]?.running, '1');
  assert.deepEqual(await me(world, 'echo', { text: 'y' }), { said: { echoed: 'y', to: 'lent:1' } });
  const next = shop.source.replace("export const version = '1'", "export const version = '2'");
  assert.deepEqual((await catalogue(home, 'add', { source: next })).version, '2', 'the same module again takes its new version');
  assert.equal(((await catalogue(home, 'modules')).modules as Record<string, { running: string }>)[module]?.running, '2');
});

// A counter module of a version, whose class counts in her cells, or one
// whose class throws at birth.
const counter = (v: number, throws = false): string => `import { Being } from 'nervur';
export const module = 'org.example.counter';
export const version = '${String(v)}';
class Counter extends Being {
  static kind = 'org.example.counter';
  static asks = { count: {} };
  constructor(stance) {
    super(stance);
    if (${String(throws)}) throw new Error('no birth');
  }
  count() {
    this.cells.n = (this.cells.n ?? 0) + 1;
    return { v: ${String(v)}, n: this.cells.n };
  }
}
export const classes = [Counter];
`;

// A harbor hosting `w`, whose counter `c` runs version 1.
const counting = async (world: World) => {
  const harbor = await world.harbor('h');
  const one = (await catalogue(harbor, 'add', { source: counter(1) })).live as string;
  await root(harbor, 'host', { ward: 'w' });
  assert.deepEqual(await root(harbor, 'boot', { key: 'c', class: 'org.example.counter' }, 'w'), { booted: 'c' });
  return { harbor, one };
};
const count = async (harbor: Parameters<typeof root>[0]): Promise<unknown> => being(harbor, 'c', 'count', {}, 'w');

test(holds('catalogue.reborn', 'harbor: the next ask on a being runs the version that runs then, on the cells she kept'), async () => {
  const { harbor } = await counting(new World(TEST));
  assert.deepEqual(await count(harbor), { v: 1, n: 1 });
  await catalogue(harbor, 'add', { source: counter(2) });
  assert.deepEqual(await count(harbor), { v: 2, n: 2 }, 'the new class, on the cells she kept');
  await catalogue(harbor, 'add', { source: counter(3, true) });
  assert.deepEqual(await count(harbor), { error: 'silence' }, 'a class that throws at birth answers nothing');
  await catalogue(harbor, 'add', { source: counter(4) });
  assert.deepEqual(await count(harbor), { v: 4, n: 3 }, 'and kept nothing');
});

test(holds('dna.rollback', 'harbor: live moved back is a rollback, the next ask on a being runs the class it held on her cells, and a wake stands it'), async () => {
  const world = new World(TEST);
  const { harbor, one } = await counting(world);
  const two = (await catalogue(harbor, 'add', { source: counter(2) })).live as string;
  assert.deepEqual(await count(harbor), { v: 2, n: 1 });
  assert.deepEqual(await catalogue(harbor, 'live', { commit: one }), { live: one });
  assert.deepEqual(await count(harbor), { v: 1, n: 2 }, 'the old class, on the cells she kept');
  assert.deepEqual(await catalogue(harbor, 'live', { commit: 'f'.repeat(40) }), { error: `${'f'.repeat(40)} is no object this harbor holds` });
  assert.deepEqual(await catalogue(harbor, 'live', { commit: 'main' }), { error: 'commit is a commit id or a fetched ref' });
  const again = await world.restart('h');
  assert.deepEqual(await catalogue(again, 'live'), { live: one }, 'a wake stands live again');
  assert.deepEqual(await count(again), { v: 1, n: 3 });
  assert.deepEqual(await catalogue(again, 'live', { commit: two }), { live: two });
  assert.deepEqual(await count(again), { v: 2, n: 4 });
});

test(holds('dock.open-host', 'harbor: the root opens only faculties and hosts each ward once'), async () => {
  const harbor = await stand(new World(TEST), 'h');
  assert.deepEqual(await root(harbor, 'open', { key: 'shop', class: 'org.example.shop' }), { error: 'no such faculty' });
  assert.deepEqual(await root(harbor, 'open', { key: 'x', class: 'org.example.nobody' }), { error: 'no such faculty' });
  assert.deepEqual(await root(harbor, 'open', { key: 'echo', class: 'org.example.echoes' }), { error: 'no such faculty' });
  assert.deepEqual(await root(harbor, 'open', { key: 'echo', class: 'org.example.echo' }), { opened: 'echo' });
  assert.deepEqual(await root(harbor, 'open', { key: 'echo', class: 'org.example.echo' }), { error: 'not opened' });
  assert.deepEqual(await root(harbor, 'host', { ward: 'box' }), { error: 'box is the box ward' });
  assert.deepEqual(await root(harbor, 'host', { ward: 7 }), { error: 'ward is text' });
  assert.deepEqual(await root(harbor, 'host', { ward: 'w' }), { hosted: 'w' });
  assert.deepEqual(await root(harbor, 'host', { ward: 'w' }), { error: 'w is hosted already' });
  assert.deepEqual(await wards(harbor), ['w']);
  assert.equal((await census(harbor)).beings.echo?.class, 'org.example.echo');
  assert.deepEqual(await root(harbor, 'route', { ward: (await census(harbor, 'w')).pk, at: '127.0.0.1:1' }), { error: 'not routed' }, 'no carrier dials it');
  assert.deepEqual((await census(harbor)).routes, {});
});

test(holds('onion.fails-alone', 'harbor: a ward that cannot stand is not hosted, and leaves nothing behind'), async () => {
  const memory = new Unreadable();
  const harbor = await stand(new World(TEST), 'h', { memory });
  memory.unreadable = true;
  assert.deepEqual(await root(harbor, 'host', { ward: 'bad' }), { error: 'not hosted' });
  assert.deepEqual(await wards(harbor), []);
  memory.unreadable = false;
  assert.deepEqual(await root(harbor, 'host', { ward: 'bad' }), { hosted: 'bad' }, 'no invitation of it was left on the dock');
});

test(holds('ward.hosted-seed', 'harbor: a hosted ward stands under the seed named, and a seed another ward stands under is not hosted'), async () => {
  const harbor = await stand(new World(TEST), 'h');
  const seed = hex(new CryptoEntropy().draw(32));
  assert.deepEqual(await root(harbor, 'host', { ward: 'w', seed }), { hosted: 'w' });
  assert.equal((await census(harbor, 'w')).pk, (await WardKey.from(unhex(seed))).pk);
  assert.deepEqual(await root(harbor, 'host', { ward: 'twin', seed }), { error: 'not hosted' });
  assert.deepEqual(await root(harbor, 'host', { ward: 'short', seed: 'ab' }), { error: 'not hosted' });
  assert.deepEqual(await root(harbor, 'host', { ward: 'number', seed: 7 }), { error: 'seed is text' });
  assert.deepEqual((await census(harbor)).wards, { w: {} }, 'the census names the ward and never its seed');
});

test(holds('host.not-left', 'harbor: a host the box cannot keep is not hosted'), async () => {
  const memory = new Refusing();
  const harbor = await stand(new World(TEST), 'h', { memory });
  memory.refusing = true;
  assert.deepEqual(await root(harbor, 'host', { ward: 'w' }), { silence: true });
  memory.refusing = false;
  assert.deepEqual(await wards(harbor), []);
  assert.deepEqual(await root(harbor, 'host', { ward: 'w' }), { hosted: 'w' });
});

test('[harbor] a being in one harbor asks a being in another through the world', async () => {
  const world = await genesis();
  assert.deepEqual(await me(world, 'buy', { item: 'tea' }), { said: { bought: 'tea' } });
  assert.deepEqual(await sold(world), ['tea to alice']);
});

test(holds('faculty.lend-contract', 'harbor: a being lends a faculty by its contract and never learns the class'), async () => {
  const world = await genesis();
  assert.deepEqual(await me(world, 'echo', { text: 'hi' }), { said: { echoed: 'hi', to: 'lent:1' } });
  assert.deepEqual(await me(world, 'echo', { text: 'again' }), { said: { echoed: 'again', to: 'lent:1' } });
  assert.deepEqual(await being(world.get('home'), 'echo', 'offers'), { offers: {} }, 'the offer closed once taken');
});

test(holds('faculty.dock-alone', 'harbor: a contract nobody fulfils, or a faculty nobody opened in the box ward, lends nothing'), async () => {
  const world = await genesis();
  assert.deepEqual(await me(world, 'nothing'), { lent: null });
  const bare = await stand(world, 'bare');
  await root(bare, 'host', { ward: 'w' });
  await root(bare, 'boot', { key: 'c', class: 'org.example.customer' }, 'w');
  assert.deepEqual(await being(bare, 'c', 'echo', {}, 'w'), { said: 'nothing lent' });
  assert.deepEqual(await root(bare, 'boot', { key: 'echo', class: 'org.example.echo' }, 'w'), { error: 'no such class' }, 'a faculty stands in the box ward alone');
});

test(holds('dock.retract', 'harbor: an offer a hosted being could not take is retracted from the faculty that made it'), async () => {
  class Lent extends Faculty {
    static override readonly kind: string = 'org.example.lent';
  }
  // A faculty whose every offer names a ward no carrier reaches.
  class Astray extends Lent {
    static override readonly kind: string = 'org.example.astray';
    static nowhere = '';
    static retracted: unknown[] = [];
    override async answer(asker: Asker, method: string | undefined, args: JsonObject): Promise<Reply> {
      if (asker.id === WARD && method === 'retract') Astray.retracted.push(args.heir);
      const out = await super.answer(asker, method, args);
      return asker.id === WARD && method === 'offer' ? { invitation: { ...((out as JsonObject).invitation as JsonObject), ward: Astray.nowhere } } : out;
    }
  }
  class Borrower extends Being {
    static override readonly kind: string = 'org.example.borrower';
    static override asks: Record<string, AskSpec> = { borrow: {} };
    async borrow(): Promise<JsonObject> {
      return { lent: await this.stance.lend(Lent, 'lent') };
    }
  }
  Astray.nowhere = (await census(await new World(TEST).harbor('elsewhere'))).pk;
  const harbor = await new World({ ...TEST, classes: [...TEST.classes, Astray, Borrower] }).harbor('h');
  await root(harbor, 'open', { key: 'astray', class: Astray.kind });
  await root(harbor, 'host', { ward: 'w' });
  await root(harbor, 'boot', { key: 'b', class: Borrower.kind }, 'w');
  assert.deepEqual(await being(harbor, 'b', 'borrow', {}, 'w'), { lent: null });
  assert.equal(Astray.retracted.length, 1, 'the offer not taken is retracted');
  assert.deepEqual(await root(harbor, 'retract', { contract: 'x', heir: 'y' }), { error: 'unknown ask' }, 'a hosted ward asks it, and no root');
});

test(holds('carrier.relays', 'harbor: a carrier faculty that answers for a ward pk no door holds is handed its boxes, and a pk nobody answers for is nothing'), async () => {
  class Relaying extends TestCarrier {
    static override readonly kind: string = 'org.example.relaying';
    static pk = '';
    override relay(pk: string, bytes: Uint8Array): Promise<Uint8Array | null> | null {
      return pk === Relaying.pk ? Promise.resolve(Uint8Array.of(bytes.length)) : null;
    }
  }
  Relaying.pk = (await census(await new World(TEST).harbor('far'))).pk;
  const harbor = await new World({ ...TEST, classes: [...TEST.classes, Relaying] }).harbor('h');
  await root(harbor, 'open', { key: 'plain', class: TestCarrier.kind });
  assert.equal(await harbor.arrive(Relaying.pk, Uint8Array.of(1, 2)), null, 'a carrier that relays nothing answers for nobody');
  await root(harbor, 'open', { key: 'relaying', class: Relaying.kind });
  assert.deepEqual(await harbor.arrive(Relaying.pk, Uint8Array.of(1, 2)), Uint8Array.of(2));
  assert.equal(await harbor.arrive('00'.repeat(64), Uint8Array.of(1)), null);
});

test(holds('dock.heard', 'harbor: a push heard is told to every carrier faculty the box holds'), async () => {
  class Hearing extends TestCarrier {
    static override readonly kind: string = 'org.example.hearing';
    static heard = 0;
    override heard(): Promise<void> {
      Hearing.heard += 1;
      return Promise.resolve();
    }
  }
  const harbor = await new World({ ...TEST, classes: [...TEST.classes, Hearing] }).harbor('h');
  await root(harbor, 'open', { key: 'plain', class: TestCarrier.kind });
  await root(harbor, 'open', { key: 'hearing', class: Hearing.kind });
  assert.deepEqual(await root(harbor, 'heard'), { heard: true });
  assert.equal(Hearing.heard, 1, 'a carrier that collects collects, and one that does not hears it too');
});

test(holds('onion.restart-same', 'harbor: a restart unpacks the same onion from memory, and nobody asks again'), async () => {
  const world = await genesis();
  await me(world, 'echo', { text: 'before' });
  const pk = (await census(world.get('home'), 'alice')).pk;
  const home = await world.restart('home');
  const acme = await world.restart('acme');
  assert.deepEqual(await wards(home), ['alice']);
  assert.equal((await census(home, 'alice')).pk, pk);
  assert.deepEqual(await wards(acme), ['shop']);
  assert.deepEqual(await me(world, 'buy', { item: 'cake' }), { said: { bought: 'cake' } });
  assert.deepEqual(await me(world, 'echo', { text: 'after' }), { said: { echoed: 'after', to: 'lent:1' } });
  assert.deepEqual(await sold(world), ['cake to alice']);
});

test(holds('world.cut', 'harbor: a harbor cut from the world is unreached, and speaks again when joined'), async () => {
  const world = await genesis();
  world.cut.add('acme');
  assert.deepEqual(await me(world, 'buy', { item: 'x' }), { said: 'unreached' });
  world.cut.delete('acme');
  assert.deepEqual(await me(world, 'buy', { item: 'y' }), { said: { bought: 'y' } });
});

// A carrier of `loop://<harbor>` addresses: a harbor of the world by name,
// with every other way of a carrier left as the contract has it.
const loopCarrier = (world: World): BeingClass =>
  class LoopCarrier extends CarrierFaculty {
    static override readonly kind: string = 'org.example.loop';
    accepts(address: string): boolean {
      return schemeOf(address) === 'loop';
    }
    dial(address: string, pk: string, bytes: Uint8Array): Promise<Dialed> {
      const name = address.slice('loop://'.length);
      if (world.cut.has(name)) return Promise.resolve(UNDIALED);
      return world.get(name).arrive(pk, bytes);
    }
  };

test(holds('carrier.opened', 'harbor: a carrier faculty the root opened carries what the harbor routes, and wakes from its row'), async () => {
  const world = new World(TEST);
  const parts = { defaults: { ...TEST, classes: [...TEST.classes, loopCarrier(world)] } };
  const acme = await world.harbor('acme', parts);
  const home = await world.harbor('home', parts);
  for (const h of [acme, home]) assert.deepEqual(await root(h, 'open', { key: 'loop', class: 'org.example.loop' }), { opened: 'loop' });
  assert.deepEqual((await census(home)).listening, []);
  for (const h of [acme, home]) await catalogue(h, 'add', { source: shop.source });
  await root(acme, 'reach', { at: ['loop://gone', 'loop://acme'] });
  await root(acme, 'host', { ward: 'shop' });
  await root(acme, 'boot', { key: 'shop', class: 'org.example.shop' }, 'shop');
  const invitation = await root(acme, 'invite', { being: 'shop', id: 'alice' }, 'shop');
  await root(home, 'host', { ward: 'alice' });
  await root(home, 'boot', { key: 'me', class: 'org.example.customer' }, 'alice');
  const mine = async (h: typeof home, method: string, args: JsonObject = {}) => being(h, 'me', method, args, 'alice');
  world.cut.add('gone');
  assert.deepEqual(await mine(home, 'join', { invitation }), { joined: 'shop' }, 'the first address is not dialed, the next one is');
  assert.deepEqual(await mine(home, 'buy', { item: 'tea' }), { said: { bought: 'tea' } });
  world.cut.add('acme');
  assert.deepEqual(await mine(home, 'buy', { item: 'late' }), { said: 'unreached' });
  world.cut.delete('acme');
  const again = await world.restart('home');
  assert.equal((await census(again)).beings.loop?.absent, false, 'the carrier woke from its row');
  await again.close();
  assert.deepEqual(await mine(again, 'buy', { item: 'cake' }), { said: { bought: 'cake' } });
});

test(holds('dock.hold-at', 'harbor: the dock holds a far ward at the address named, and keeps it as that ward\'s route'), async () => {
  const world = new World(TEST);
  const parts = { defaults: { ...TEST, classes: [...TEST.classes, loopCarrier(world)] } };
  const far = await world.harbor('far', parts);
  const home = await world.harbor('home', parts);
  await root(home, 'open', { key: 'loop', class: 'org.example.loop' });
  const owner = await root(far, 'own', { id: 'home' });
  const { pk } = await census(far);
  assert.deepEqual(await root(home, 'hold', { name: 'far', invitation: owner, at: 7 }), { error: 'at is an address' });
  assert.deepEqual(await root(home, 'hold', { name: 'far', invitation: owner, at: 'tcp://h:1' }), { error: 'not routed' }, 'no carrier dials it');
  assert.deepEqual(await root(home, 'hold', { name: 'far', invitation: owner, at: 'loop://far' }), { held: 'far', ward: pk });
  assert.deepEqual((await census(home)).routes, { [pk]: ['loop://far'] });
  assert.deepEqual(await root(home, 'pilot', { name: 'far', method: 'census' }), { answer: { error: 'unknown ask' } });
});

test(holds('carrier.carries', 'harbor: a front finds the carrier it opens by the carrier of Quo its class names, standing or among the classes handed it'), () => {
  class Tcp extends TestCarrier {
    static override readonly kind: string = 'org.example.tcp';
    static override readonly carries: string = 'tcp';
  }
  const classes = [...TEST.classes, Tcp];
  assert.equal(TestCarrier.carries, null, 'a carrier names none unless it says so');
  assert.deepEqual(carrierIn({ catalogue: { class: 'org.nervur.catalogue' } }, classes, 'tcp'), { key: 'tcp', open: { method: 'open', args: { key: 'tcp', class: 'org.example.tcp' } } });
  assert.deepEqual(carrierIn({ mine: { class: 'org.example.tcp' } }, classes, 'tcp'), { key: 'mine' }, 'one standing under any key');
  assert.equal(carrierIn({}, classes, 'web'), null, 'no class carries it');
});

test(holds('onion.genesis', 'harbor: on empty memory the harbor writes the catalogue from the core alone, no ask opens another, and nothing else enters unasked'), async () => {
  const world = new World(TEST);
  const beings = async (h: Parameters<typeof root>[0]) => Object.keys((await census(h)).beings);
  const harbor = await world.harbor('h', { defaults: { ...TEST, classes: [...TEST.classes, loopCarrier(world)] } });
  assert.deepEqual(await beings(harbor), ['catalogue'], 'a carrier the terrain hands enters only when asked');
  assert.deepEqual(await root(harbor, 'open', { key: 'second', class: 'org.nervur.catalogue' }), { error: 'no such faculty' });
  assert.deepEqual(await root(harbor, 'open', { key: 'loop', class: 'org.example.loop' }), { opened: 'loop' });
  assert.deepEqual(await root(harbor, 'unboot', { being: 'loop' }), { unbooted: 'loop' });
  assert.deepEqual(await beings(await world.restart('h')), ['catalogue'], 'a wake opens nothing the cells do not name');
});

test(holds('faculty.of-stance', 'harbor: a faculty of the terrain is born of the box ward stance alone, and a hosted ward boots none'), async () => {
  const harbor = await new World(TEST).harbor('a');
  assert.throws(() => new Catalogue({ cells: {} } as unknown as Stance), /stands in the box ward alone/);
  assert.throws(() => new TestMemory({ cells: {} } as unknown as Stance), /stands in the box ward alone/);
  assert.deepEqual(await root(harbor, 'open', { key: 'shelf', class: TestMemory.kind }), { opened: 'shelf' });
  assert.deepEqual(await root(harbor, 'host', { ward: 'w' }), { hosted: 'w' });
  assert.deepEqual(await root(harbor, 'boot', { key: 'm', class: TestMemory.kind }, 'w'), { error: 'no such class' }, 'a hosted ward boots no faculty');
  assert.deepEqual(await root(harbor, 'boot', { key: 'c', class: 'org.nervur.catalogue' }, 'w'), { error: 'no such class' });
});
