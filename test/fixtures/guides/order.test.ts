// order.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Bench } from 'nervur/bench';
import { Lobby } from './classes/lobby.ts';
import { Courier, Order } from './classes/order.ts';
import { Shop } from './classes/shop.ts';
import { Payments, paymentsOffer } from './payments.ts';

// Her module, which the bench loads in the house's own runner.
const module = new URL('./classes/order.ts', import.meta.url);

test('Order keeps her table: every state and role shows what it owes', async () => {
  await Bench.check(Order, { module });
});

test('An order is paid once the provider calls the handle it was given', async () => {
  // The provider stands in memory.
  const payments = new Payments();
  const bench = await Bench.open({ module, offers: [paymentsOffer(payments)] });
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

test('A paid order ships through the courier she hired, whose stand-in hears her', async (t) => {
  const payments = new Payments();
  const bench = await Bench.open({
    module,
    offers: [paymentsOffer(payments)],
    // The courier's side of her standing, answered by the handlers in courier.ts.
    standIns: { courier: { need: Courier, module: new URL('./courier.ts', import.meta.url) } },
  });
  t.after(() => bench.close());
  const order = await bench.place(Order, { id: 'second' });

  // Her steward carries the invitation, and she takes it as a standing of her own.
  await order.ask('hire', { courier: await bench.invitation('courier') });
  await order.ask('add', { sku: 'tea', price: 4 });
  await order.ask('checkout');
  await payments.settle('second');
  await bench.settle();
  assert.deepEqual(await order.ask('ship'), { result: null });
  await bench.settle();
  assert.deepEqual(await bench.heard('courier'), [{ method: 'pickup', args: { items: ['tea'] } }]);
});

// The house module: its steward, its public being and its beings.
const house = new URL('./classes/index.ts', import.meta.url);

test('The steward and the lobby keep their tables where the house places them', async () => {
  await Bench.check(Shop, { module: house, position: 'steward' });
  await Bench.check(Lobby, { module: house, position: 'public' });
});

test('Her house keeps its table as one household: each being walked beside the others', async () => {
  await Bench.household({ module: house });
});
