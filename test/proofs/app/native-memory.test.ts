// The memory contract's one suite, run against NativeMemory over a native
// store, and what the store's compare-and-swap adds: a write that lost a
// race to another writer lands nothing.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NativeMemory } from 'nervur/app';
import { MapStore } from '../../fixtures/app/shell.ts';
import { memorySuite } from '../suites/memory.ts';

memorySuite('NativeMemory', () => new NativeMemory(new MapStore(), 'suite'));

test('NativeMemory: two memories on one store keep apart', async () => {
  const store = new MapStore();
  const one = new NativeMemory(store, 'one');
  const two = new NativeMemory(store, 'two');
  await one.write({ writes: { p: { a: new Uint8Array([1]) } }, expect: { p: null } });
  assert.deepEqual(await two.list(), []);
  assert.deepEqual(await one.list(), ['p']);
});

test('NativeMemory: a write that lost the swap lands nothing', async () => {
  const store = new MapStore();
  const memory = new NativeMemory(store, 'raced');
  // Another writer lands between this write's read and its swap.
  const swap = store.swap.bind(store);
  let raced = false;
  store.swap = async (writes, expect) => {
    if (!raced) {
      raced = true;
      await swap({ 'nervur/raced/count': '9' }, {});
    }
    return swap(writes, expect);
  };
  assert.equal(await memory.write({ writes: { p: { a: new Uint8Array([1]) } }, expect: { p: null } }), null);
  assert.deepEqual(await memory.read({ place: 'p' }), { entries: {}, version: null });
});
