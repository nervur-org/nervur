// SPDX-License-Identifier: Apache-2.0
// `Being`, the words, and the digest a being's `seen` is made of.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Being, canonical, digest, Faculty, isSilence, isWord, silence, told, word, type Asker, type JsonObject, type Stance } from '../../../src/core/being/index.ts';
import { Carrier } from '../../../src/core/contract/index.ts';
import { Catalogue, Dock, Harbor, RegistryFaculty, Terrain } from '../../../src/core/harbor/index.ts';
import { PointerTerrain } from '../../../src/core/pointer/index.ts';
import { House, Ward } from '../../../src/core/ward/index.ts';
import { holds } from '../../claims.ts';

const stance = (cells: JsonObject = {}, notes: Record<string, JsonObject> = {}): Stance => ({
  key: 'k',
  cells,
  occupants: { invite: () => Promise.resolve(null), notes: (id) => notes[id], ids: () => Object.keys(notes), remove: () => false },
  standings: { take: () => Promise.resolve(null), get: () => undefined, ids: () => [], remove: () => false },
  boot: () => Promise.resolve(null),
  lend: () => Promise.resolve(null),
});

class Shop extends Being {
  static override cells = { orders: [] as JsonObject[] };
  static override asks = {
    list: { description: 'what is for sale' },
    order: { input: { type: 'object', required: ['item'] }, for: (_: Asker, notes: JsonObject | undefined) => notes?.buyer === true },
  };
  list(): JsonObject {
    return { items: ['tea'] };
  }
  order(args: JsonObject, asker: Asker): JsonObject {
    (this.cells.orders as JsonObject[]).push({ item: args.item!, by: asker.id ?? null });
    return { ordered: args.item! };
  }
}

test('[being] cells defaults are written only where a key is missing', () => {
  const kept = { orders: [{ item: 'x' }] };
  assert.equal(new Shop(stance(kept)).cells.orders, kept.orders);
  const fresh = new Shop(stance()).cells;
  assert.deepEqual(fresh, { orders: [] });
  assert.notEqual(fresh.orders, Shop.cells.orders);
});

test('[being] the blueprint shows each asker what she may ask, in declared order', () => {
  const shop = new Shop(stance({}, { alice: { buyer: true }, bob: {} }));
  assert.deepEqual(shop.describe({ id: 'bob' }), { asks: [{ name: 'list', description: 'what is for sale', input: { type: 'object' } }], notes: {} });
  assert.deepEqual(
    shop.describe({ id: 'alice' }).asks.map((a) => a.name),
    ['list', 'order'],
  );
  assert.deepEqual(shop.describe({}).asks.map((a) => a.name), ['list']);
});

test('[being] a named ask calls her method, and one hidden or undeclared is an error object', async () => {
  const shop = new Shop(stance({}, { alice: { buyer: true }, bob: {} }));
  assert.deepEqual(await shop.answer({ id: 'alice' }, 'order', { item: 'tea' }), { ordered: 'tea' });
  assert.deepEqual(shop.cells.orders, [{ item: 'tea', by: 'alice' }]);
  assert.deepEqual(await shop.answer({ id: 'bob' }, 'order', { item: 'tea' }), { error: 'unknown ask' });
  for (const name of ['toString', 'constructor', 'answer', 'nope']) assert.deepEqual(await shop.answer({ id: 'alice' }, name, {}), { error: 'unknown ask' });
  assert.deepEqual(await shop.answer({}, undefined, {}), shop.describe({}));
});

test('[being] a class declaring a reserved or unwritten ask fails at birth', () => {
  class Reserved extends Being {
    static override asks = { describe: {} };
  }
  class Unwritten extends Being {
    static override asks = { missing: {} };
  }
  class Field extends Being {
    static override asks = { field: {} };
    field = (): JsonObject => ({});
  }
  assert.throws(() => new Reserved(stance()), /reserved/);
  assert.throws(() => new Unwritten(stance()), /no method/);
  assert.throws(() => new Field(stance()), /no method/);
});

test('[being] silence and every word are distinct values a being cannot mint by accident', () => {
  assert.ok(isSilence(silence));
  assert.equal(word('late'), word('late'));
  assert.ok(Object.isFrozen(word('late')));
  assert.ok(isWord(word('removed')) && !isWord({ late: true }) && !isWord(null));
  assert.equal(told(word('unreached')), 'unreached');
  assert.equal(told(silence), silence);
  assert.deepEqual(told({ a: 1 }), { a: 1 });
});

test('[being] the digest is SHA-256 of the canonical form: sorted keys, no whitespace', async () => {
  assert.equal(canonical({ b: [1, 'x', null], a: { d: true, c: 0.5 } }), '{"a":{"c":0.5,"d":true},"b":[1,"x",null]}');
  assert.equal(canonical({ é: 1, z: 2, Z: 3 }), '{"Z":3,"z":2,"é":1}');
  assert.equal(await digest({ b: 1, a: 2 }), await digest({ a: 2, b: 1 }));
  assert.match(await digest({}), /^44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a$/);
});

test(holds('layers.class-chain', 'being: the class chain a stranger meets, from Being to Harbor and PointerTerrain'), () => {
  const extends_ = (C: object, parent: object): boolean => Object.getPrototypeOf(C) === parent;
  assert.ok(extends_(Faculty, Being));
  assert.ok(extends_(RegistryFaculty, Faculty));
  assert.ok(extends_(Catalogue, RegistryFaculty));
  assert.ok(extends_(Ward, Being));
  assert.ok(extends_(Dock, Ward));
  assert.ok(extends_(Harbor, Function.prototype), 'a harbor is held, and extends nothing');
  assert.ok(!Object.hasOwn(Harbor.prototype, 'carry') && !(Harbor.prototype instanceof Carrier), 'it hands its wards a carrier and is none');
  assert.deepEqual(Object.getOwnPropertyNames(Harbor.prototype).sort(), ['arrive', 'ask', 'close', 'constructor', 'holds'], 'what whoever holds a harbor has of it');
  assert.ok(extends_(PointerTerrain, Terrain));
  assert.equal(typeof House.prototype.answer, 'function', 'a house is the Behind a door hands every arrival');
});
