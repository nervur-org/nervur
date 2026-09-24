// A class read as the house reads her: her declaration checked and settled
// into her table, or refused with every reason.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tableOf } from 'nervur/being';
import { Order } from '../fixtures/guides/classes/order.ts';

test('tableOf reads a class as the house reads her', () => {
  const table = tableOf(Order);
  assert.equal(table.kind, 'com.acme.order');
  assert.equal(table.first, 'open');
  assert.deepEqual(table.asks.checkout.for, ['owner']);
  assert.deepEqual(table.asks.checkout.to, ['paying']);
  assert.ok(Object.isFrozen(table.asks), 'what she declared is read, and never changed');
});

test('tableOf refuses what the house would refuse, naming why', () => {
  assert.throws(() => tableOf(() => 'no class'), /it is not a class of Being\.of/);
});
