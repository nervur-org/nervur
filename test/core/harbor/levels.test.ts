// SPDX-License-Identifier: Apache-2.0
// The three levels a harbor stands in: the boot, the core alone, up to the
// registries the catalogue stands and the dock; the dock's own, every other
// faculty and every hosted ward; and each ward's own, her beings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BundleLoader, CryptoEntropy, Harbor, HeldCustody, PointerTerrain, SourceLoader, VolatileMemory, World, type JsonObject } from '../kit.ts';
import { TEST, TestDock } from '../classes.ts';
import { holds } from '../../claims.ts';
import { add, being, census, root } from './asks.ts';

// A registry the catalogue resolves, the shelf, and one only the shelf
// resolves, the annex. The dock, the gadget, the gizmo, the counter and
// the keeper are classes no module lists, so the catalogue never resolves
// them. The counter tells the scenes every birth of hers, and holds an ask
// open until the scenes let it go.
const LEVELS = `import { Being, Dock, Faculty, ownerAsk, RegistryFaculty, Ward } from 'nervur';
export const module = 'com.acme.levels';
export const version = '1';
const seen = (globalThis[Symbol.for('com.acme.levels')] ??= { births: 0, held: [] });
class Counter extends Being {
  static kind = 'com.acme.counter';
  static asks = { count: {}, hold: {} };
  constructor(stance) {
    super(stance);
    seen.births += 1;
  }
  count() {
    this.cells.n = (this.cells.n ?? 0) + 1;
    return { n: this.cells.n, version };
  }
  hold() {
    return new Promise((done) => seen.held.push(() => done({ held: true })));
  }
}
class Donald extends Dock {
  static kind = 'com.acme.donald';
  static asks = { ...Dock.asks, quack: ownerAsk('a quack') };
  quack() {
    return { quack: true };
  }
}
class Keeper extends Ward {
  static kind = 'com.acme.keeper';
}
class Gadget extends Faculty {
  static kind = 'com.acme.gadget';
}
class Gizmo extends Being {
  static kind = 'com.acme.gizmo';
}
class Annex extends RegistryFaculty {
  static kind = 'com.acme.annex';
  classOf(kind) {
    return kind === Gizmo.kind ? Gizmo : undefined;
  }
}
const SHELF = [Donald, Gadget, Gizmo, Counter, Annex, Keeper];
class Shelf extends RegistryFaculty {
  static kind = 'com.acme.shelf';
  classOf(kind) {
    return SHELF.find((C) => C.kind === kind);
  }
}
export const classes = [Shelf];
`;
const NONE = { wards: {}, routes: {} };
const KEEPER = { class: 'com.acme.keeper', registry: 'shelf' };

const absent = async (harbor: Harbor, ward?: string): Promise<Record<string, boolean>> => Object.fromEntries(Object.entries((await census(harbor, ward)).beings).map(([key, b]) => [key, b.absent]));

const stand = async (world: World, parts = {}): Promise<Harbor> => {
  const harbor = await world.harbor('h', parts);
  assert.equal(((await add(harbor, LEVELS)) as JsonObject).added, 'com.acme.levels');
  assert.deepEqual(await root(harbor, 'open', { key: 'shelf', class: 'com.acme.shelf' }), { opened: 'shelf' });
  return harbor;
};

test(holds('levels.registry', 'levels: a faculty, a dock and a hosted ward each name the registry their class resolves through, and a registry stands through another'), async () => {
  const harbor = await stand(new World(TEST));
  assert.deepEqual(await root(harbor, 'open', { key: 'gadget', class: 'com.acme.gadget' }), { error: 'no such faculty' }, 'the catalogue resolves no class the shelf holds');
  assert.deepEqual(await root(harbor, 'open', { key: 'gadget', class: 'com.acme.gadget', registry: 'nowhere' }), { error: 'no such registry faculty' });
  assert.deepEqual(await root(harbor, 'open', { key: 'gadget', class: 'com.acme.gadget', registry: 'gadget' }), { error: 'no such registry faculty' });
  assert.deepEqual(await root(harbor, 'open', { key: 'gadget', class: 'com.acme.gadget', registry: 'shelf' }), { opened: 'gadget' });
  assert.deepEqual(await root(harbor, 'open', { key: 'annex', class: 'com.acme.annex', registry: 'shelf' }), { opened: 'annex' });
  assert.deepEqual(await root(harbor, 'become', { class: 'com.acme.donald', registry: 'annex' }), { error: 'the dock stands through the catalogue or a registry it stands' });
  assert.deepEqual(await root(harbor, 'become', { class: 'com.acme.donald' }), { error: 'no class of kind com.acme.donald runs' });
  assert.deepEqual(await root(harbor, 'become', { class: 'com.acme.donald', registry: 'shelf' }), { became: 'com.acme.donald' });
  assert.deepEqual(await root(harbor, 'quack'), { quack: true });
  assert.deepEqual(await root(harbor, 'host', { ward: 'w', ...KEEPER }), { hosted: 'w' }, 'a ward class the shelf resolves');
  assert.deepEqual(await root(harbor, 'boot', { key: 'g', class: 'com.acme.gizmo' }, 'w'), { booted: 'g' }, 'every class of the ward through its registry');
  assert.deepEqual(await root(harbor, 'host', { ward: 'v', registry: 'annex' }), { error: 'not hosted' }, 'the annex resolves no ward, not even the default');
  const { beings, wards } = await census(harbor);
  assert.equal(beings.annex?.registry, 'shelf');
  assert.equal(beings.shelf?.registry, undefined, 'the catalogue is the default and is never written');
  assert.deepEqual(wards, { w: { registry: 'shelf' } });
});

test(holds('levels.boot', 'levels: a restart stands the registries the catalogue resolves, then the dock through hers, then everything else in the order each needs'), async () => {
  const world = new World(TEST);
  const harbor = await stand(world);
  await root(harbor, 'open', { key: 'annex', class: 'com.acme.annex', registry: 'shelf' });
  await root(harbor, 'open', { key: 'gadget', class: 'com.acme.gadget', registry: 'shelf' });
  await root(harbor, 'become', { class: 'com.acme.donald', registry: 'shelf' });
  await root(harbor, 'host', { ward: 'u', ...KEEPER });
  await root(harbor, 'boot', { key: 'g', class: 'com.acme.gizmo' }, 'u');
  const again = await world.restart('h');
  assert.equal((await census(again)).class, 'com.acme.donald', 'her registry stood before her');
  assert.deepEqual(await root(again, 'quack'), { quack: true });
  assert.deepEqual(await absent(again), { catalogue: false, shelf: false, annex: false, gadget: false });
  assert.deepEqual(await absent(again, 'u'), { g: false });
  assert.deepEqual((await census(again)).failed, NONE);
});

test(holds('levels.born-per-ask', 'levels: a being of a hosted ward is born for the asks that reach her, once for asks that overlap, and nothing stands her'), async () => {
  const seen = ((globalThis as Record<symbol, unknown>)[Symbol.for('com.acme.levels')] ??= { births: 0, held: [] }) as { births: number; held: (() => void)[] };
  const world = new World(TEST);
  const harbor = await stand(world);
  const count = (h: Harbor): Promise<unknown> => being(h, 'c', 'count', {}, 'w');
  assert.deepEqual(await root(harbor, 'host', { ward: 'w', ...KEEPER }), { hosted: 'w' });
  const before = seen.births;
  assert.deepEqual(await root(harbor, 'boot', { key: 'c', class: 'com.acme.counter' }, 'w'), { booted: 'c' });
  assert.equal(seen.births, before + 1, 'born once as she is made, for her cells');
  assert.deepEqual(await count(harbor), { n: 1, version: '1' });
  assert.deepEqual(await count(harbor), { n: 2, version: '1' }, 'her cells carry from ask to ask, kept by her ward');
  assert.equal(seen.births, before + 3, 'born again for each ask');
  const held = [being(harbor, 'c', 'hold', {}, 'w'), being(harbor, 'c', 'hold', {}, 'w')];
  while (seen.held.length < 2) await new Promise((next) => setImmediate(next));
  assert.equal(seen.births, before + 4, 'once for asks that overlap');
  for (const done of seen.held.splice(0)) done();
  await Promise.all(held);
  const again = await world.restart('h');
  assert.equal(seen.births, before + 4, 'the boot and the stand bring her to life nowhere');
  assert.deepEqual(await absent(again, 'w'), { c: false }, 'she is reached, and absent only where her class does not resolve');
  assert.equal(((await add(again, LEVELS.replace("version = '1'", "version = '2'"))) as JsonObject).version, '2');
  assert.deepEqual(await count(again), { n: 3, version: '2' }, 'the next ask is born of the class that runs now');
});

test(holds('levels.fall-back', 'levels: what does not stand falls back one level, alone, and stands again once it resolves'), async () => {
  const world = new World(TEST);
  const harbor = await stand(world);
  await root(harbor, 'open', { key: 'gadget', class: 'com.acme.gadget', registry: 'shelf' });
  await root(harbor, 'become', { class: 'com.acme.donald', registry: 'shelf' });
  await root(harbor, 'host', { ward: 'w', ...KEEPER });
  await root(harbor, 'host', { ward: 'plain' });
  const lost = await world.restart('h', { loader: new BundleLoader([]) });
  assert.equal((await census(lost)).class, TestDock.kind, 'the default dock stands in hers');
  assert.deepEqual(await absent(lost), { catalogue: false, shelf: true, gadget: true });
  assert.deepEqual(Object.keys((await census(lost)).failed!.wards).sort(), ['box', 'w']);
  assert.equal((await census(lost, 'plain')).class, TEST.ward.kind, 'a ward through the catalogue stands');
  const back = await world.restart('h', { loader: new SourceLoader() });
  assert.deepEqual(await root(back, 'quack'), { quack: true });
  assert.deepEqual(await absent(back), { catalogue: false, shelf: false, gadget: false });
  assert.deepEqual((await census(back)).failed, NONE);
});

test(holds('levels.one-call', 'levels: the boot is one call that stands the catalogue, her registries and the dock, and every other thing stands on a stand asked'), async () => {
  const entropy = new CryptoEntropy();
  const memory = new VolatileMemory();
  const custody = new HeldCustody(entropy);
  const made = await stand(new World(TEST), { entropy, memory, custody });
  await root(made, 'become', { class: 'com.acme.donald', registry: 'shelf' });
  await root(made, 'open', { key: 'gadget', class: 'com.acme.gadget', registry: 'shelf' });
  await root(made, 'host', { ward: 'u', ...KEEPER });
  await root(made, 'boot', { key: 'g', class: 'com.acme.gizmo' }, 'u');
  const booted = await Harbor.open(new PointerTerrain({ entropy, memory, custody, defaults: TEST }));
  assert.equal((await census(booted)).class, 'com.acme.donald', 'the dock stood through the registry the catalogue stands');
  assert.deepEqual(await absent(booted), { catalogue: false, shelf: false, gadget: true }, 'no other faculty');
  assert.deepEqual(await root(booted, undefined, undefined, 'u'), { error: 'no such ward' }, 'and no hosted ward');
  assert.deepEqual(await root(booted, 'stand'), { stood: ['gadget'], wards: ['u'] });
  assert.deepEqual(await absent(booted, 'u'), { g: false }, 'the ward stood her own being');
  assert.deepEqual(await root(booted, 'stand'), { silence: true }, 'asked again, it stands nothing');
});
