// order.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Bench } from 'nervur/bench';
import { Order } from './classes/order.ts';
import { Payments, paymentsOffer } from './payments.ts';

test('Order keeps her table: every state and role shows what it owes', async () => {
  await Bench.check(Order);
});

test('An order is paid once the provider calls the handle it was given', async () => {
  const payments = new Payments();
  const bench = await Bench.open({ classes: [Order], offers: [paymentsOffer(payments)] });
  const order = await bench.place(Order, { id: 'first' });

  assert.deepEqual(await order.ask('checkout'), { error: { message: 'Add an item first.' } });
  assert.deepEqual(await order.ask('add', { sku: 'tea', price: 4 }), { result: { total: 4 } });
  assert.deepEqual(await order.ask('checkout'), { result: null });
  await bench.settle();
  assert.equal((await order.describe())?.state, 'paying', 'the charge left once checkout landed, and answered pending');

  assert.deepEqual(await payments.settle('first'), { result: null });
  await bench.settle();
  assert.equal((await order.describe())?.state, 'paid');
  assert.deepEqual(await order.ask('add', { sku: 'jam', price: 1 }), { error: { message: 'not in this state' } });
});
