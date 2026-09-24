// A write holds the rows it touches alone: a write on other rows lands
// beside it, and a write on the same row runs again on what landed first.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NobleCrypto, SeedKeys, StrictTools } from 'nervur';
import { Rows } from '../../../src/house/rows.ts';
import { GatedMemory } from '../fixtures/gated-memory.ts';

const crypto = new NobleCrypto();
const tools = new StrictTools();

const open = async () => {
  const memory = new GatedMemory();
  const rows = await Rows.open(memory, new SeedKeys('5'.repeat(64), crypto), crypto, tools);
  return { memory, rows, alice: await rows.place('being:alice'), bob: await rows.place('being:bob') };
};

test('A write held on one being’s row does not hold a write on another’s', async () => {
  const { memory, rows, alice, bob } = await open();
  memory.hold(alice);
  let first = false;
  const held = rows.transact((draft) => draft.set(alice, { total: 1 })).then((landed) => (first = landed));
  assert.equal(await rows.transact((draft) => draft.set(bob, { total: 1 })), true, 'Bob’s write landed');
  assert.equal(first, false, 'while Alice’s was still held');
  memory.release();
  assert.equal(await held, true);
  assert.deepEqual(await rows.get(alice), { total: 1 });
});

test('Two writes on one row both land, the second on what the first wrote', async () => {
  const { memory, rows, alice } = await open();
  const add = () =>
    rows.transact(async (draft) => {
      const row = await draft.get<{ total: number }>(alice);
      draft.set(alice, { total: (row?.total ?? 0) + 1 });
    });
  memory.hold(alice);
  const one = add();
  const two = add();
  memory.release();
  assert.deepEqual(await Promise.all([one, two]), [true, true]);
  assert.deepEqual(await rows.get(alice), { total: 2 }, 'neither add was lost');
});

test('A write memory refuses lands nothing, as another writer moved it', async () => {
  const { memory, rows, alice } = await open();
  memory.refuseNext();
  assert.equal(await rows.transact((draft) => draft.set(alice, { total: 1 })), false);
  assert.equal(await rows.get(alice), null);
});
