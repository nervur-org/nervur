// SPDX-License-Identifier: Apache-2.0
// The pointer bodies, each under its contract's suite. One object is the
// keeping, so both bodies of a pair are that object. The loaders run the
// shop's source: the source loader by importing it, the bundle loader and
// the edge's loader by its blob among the modules they carry.
import { AsyncLocalStorage } from 'node:async_hooks';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Being, BundleLoader, CryptoEntropy, HeldCustody, SourceLoader, SystemClock, VolatileMemory } from '../kit.ts';
import { linked } from '../../../src/core/contract/index.ts';
import { ChildCalls, EdgeLoader, EdgeMemory, type EdgeStorage } from '../../../src/core/edge/index.ts';
import { blob, idOf } from '../../../src/core/git/index.ts';
import { shop } from '../harbor/shop.ts';
import { holds } from '../../claims.ts';
import { clockSuite, custodySuite, entropySuite, loaderSuite, memorySuite } from './suites.ts';

const twice = <T>(body: T): [T, T] => [body, body];
const id = await idOf(blob(shop.source));
const broken = { source: 'export const module = ;', id: await idOf(blob('export const module = ;')) };

entropySuite('CryptoEntropy', () => new CryptoEntropy());
custodySuite('HeldCustody', () => twice(new HeldCustody(new CryptoEntropy())));
clockSuite('SystemClock', () => new SystemClock());
memorySuite('VolatileMemory', () => twice(new VolatileMemory()));
loaderSuite('SourceLoader', () => ({ loader: new SourceLoader(), found: { source: shop.source, id }, refused: broken }));
const built = await new SourceLoader().load(shop.source);
loaderSuite('BundleLoader', () => ({ loader: new BundleLoader([{ source: shop.source, module: built }]), found: { source: shop.source, id }, refused: broken }));
loaderSuite('EdgeLoader', () => ({ loader: new EdgeLoader([{ blob: id, module: built }]), found: { source: shop.source, id }, refused: broken }));

test(holds('loader.linked', "loader: a module's 'nervur' is the kit running, and a module that imports anything else is refused"), async () => {
  const loaded = await new SourceLoader().load(shop.source);
  assert.ok(loaded.classes.every((C) => (C as { prototype: unknown }).prototype instanceof Being), 'every class extends the Being this kit runs');
  assert.throws(() => linked("import { readFile } from 'node:fs';\nexport const module = 'org.example.x';"), /imports nothing but 'nervur'/);
  assert.throws(() => linked("export * from 'nervur';"), /imports nothing but 'nervur'/);
  assert.match(linked("import * as n from 'nervur';\nimport { Being as B } from \"nervur\";"), /const n = globalThis.*;\nconst \{ Being: B \} = globalThis/);
  await assert.rejects(new SourceLoader().load('export const module = 1;'), /exports no module/);
});

test(holds('edge.loader', "loader: an edge's child finds a module by its blob, keeps a miss with its source and keeps nothing after it, and refuses what the shell refused"), async () => {
  const held = new Map<string, unknown>();
  const storage: EdgeStorage = {
    get: (key) => Promise.resolve(held.get(key)),
    put: (entries) => Promise.resolve(void Object.entries(entries).forEach(([k, v]) => held.set(k, v))),
    delete: (keys) => Promise.resolve(keys.filter((k) => held.delete(k)).length),
    list: ({ prefix }) => Promise.resolve(new Map([...held].filter(([k]) => k.startsWith(prefix)))),
    transaction: (work) => work(storage),
  };
  const calls = new ChildCalls(new AsyncLocalStorage<number>());
  const loader = new EdgeLoader([{ blob: id, module: built }], calls);
  const memory = new EdgeMemory(storage, '', () => loader.missing, calls);
  assert.deepEqual(loader.carried, [id]);
  assert.equal((await loader.load('', id)).module, 'org.example.shop', 'the blob alone names it');
  await calls.run(1, () => memory.write('p', new Map([['a', new Uint8Array([1])]])));
  const other = `${shop.source}\n// one byte more\n`;
  const otherId = await idOf(blob(other));
  await calls.run(2, () => assert.rejects(loader.load(other, otherId), new RegExp(`^Error: blob ${otherId} is carried by the next child$`)));
  assert.ok(loader.missing);
  await calls.run(3, () => assert.rejects(memory.write('p', new Map([['b', new Uint8Array([2])]])), /a module was missed, so this call keeps nothing/));
  await calls.run(1, () => assert.rejects(memory.forget('p'), /keeps nothing/));
  assert.deepEqual([...(await memory.read('p')).keys()], ['a'], 'nothing kept past the miss');
  assert.deepEqual([...loader.missed()], [[otherId, other]], 'the miss, with its source');
  assert.ok(calls.again(2), 'the call that missed is asked again');
  assert.ok(calls.again(3), 'and so is a call whose keep the spent child refused');
  assert.ok(!calls.again(3), 'told once');
  assert.ok(!calls.again(1), 'a call that kept a step before it was refused is not');
  assert.ok(!calls.again(4), 'nor is a call that touched nothing');
  const fresh = new EdgeLoader();
  fresh.refuse({ [otherId]: 'the module does not load on the edge: broken' });
  assert.deepEqual([...fresh.refused.keys()], [otherId]);
  await assert.rejects(fresh.load(other, otherId), /^Error: the module does not load on the edge: broken$/);
  assert.ok(!fresh.missing, 'a refused blob is no miss');
});

test(holds('worker.bundle', 'loader: a bundle finds a module by its blob alone, and any other blob needs a redeploy naming what it carries'), async () => {
  const bundle = new BundleLoader([{ source: shop.source, module: built }]);
  const other = `${shop.source}\n// one byte more\n`;
  const otherId = await idOf(blob(other));
  await assert.rejects(bundle.load(other, otherId), new RegExp(`^Error: redeploy needed: blob ${otherId} is no module this bundle carries: it carries org.example.shop$`));
  assert.equal((await bundle.load('', id)).module, 'org.example.shop', 'the blob alone names it');
});
