import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Bench } from 'nervur/bench';
import { Lobby } from '../fixtures/guides/classes/lobby.ts';
import { Order } from '../fixtures/guides/classes/order.ts';
import { Shop } from '../fixtures/guides/classes/shop.ts';
import { Dice, Liar, Tally } from '../fixtures/bench/tally.ts';
import { FakePayments, PaymentsOffer } from '../fixtures/world/payments.ts';

test('The paper’s Order, driven through the bench: every ask crosses as a box', async () => {
  const payments = new FakePayments();
  const bench = await Bench.open({ classes: [Order], offers: [{ blueprint: PaymentsOffer, object: payments }] });
  const order = await bench.place(Order);
  assert.deepEqual(await order.ask('checkout'), { error: { message: 'Add an item first.' } });
  assert.deepEqual(await order.ask('add', { sku: 'tea', price: 4 }), { result: { total: 4 } });
  assert.deepEqual(await order.ask('checkout'), { result: null });
  assert.equal(payments.calls.length, 1, 'the charge left once checkout landed');
  assert.equal((await order.cells())!.state, 'paying');
  assert.deepEqual(await payments.settle(), { result: null });
  await bench.settle();
  assert.equal((await order.cells())!.state, 'paid');
  assert.deepEqual(await order.ask('add', { sku: 'jam', price: 1 }), { error: { message: 'not in this state' } });
});

test('The bench runs every example, and the author’s documentation and her tests are one text', async () => {
  const findings = await Bench.examples(Tally);
  assert.deepEqual(
    findings.map((finding) => [finding.what, finding.ok]),
    [
      ['bump, example 1: adds to what stands', true],
      ['bump, example 2: refuses to go down', true],
      ['stop, example 1', true],
      ['read, example 1', true],
    ],
  );
});

test('The bench walks every state and role', async () => {
  const findings = await Bench.walk(Tally);
  assert.deepEqual(
    findings.map((finding) => finding.what),
    ['counting, as steward', 'counting, as keeper', 'stopped, as steward', 'stopped, as keeper'],
  );
  assert.ok(findings.every((finding) => finding.ok), JSON.stringify(findings));
  await Bench.check(Tally);
});

test('The bench flags a class whose re-run on the same cells answers differently', async () => {
  const [finding] = await Bench.examples(Dice);
  assert.deepEqual(finding, { ok: false, what: 'roll, example 1: any face', why: 'a re-run on the same cells answered differently' });
});

test('The bench names a role it cannot play', async () => {
  await assert.rejects(Bench.check(Liar), /secret, example 1: it gives \{"error":\{"message":"no such ask"\}\}/);
});

test('The bench walks a steward, playing root through the hand', async () => {
  const findings = await Bench.check(Shop, { position: 'steward', classes: [Order] });
  assert.deepEqual(
    findings.map((finding) => finding.what),
    ['ready, as pilot', 'ready, as being'],
  );
});

test('The bench walks a public being, playing a stranger by the zero head', async () => {
  const findings = await Bench.check(Lobby, { position: 'public', steward: Shop, classes: [Order] });
  assert.deepEqual(
    findings.map((finding) => finding.what),
    ['ready, as steward', 'ready, as stranger'],
  );
});

test('A stranger signs up at the public being, and her steward holds one order for them', async () => {
  const payments = new FakePayments();
  const bench = await Bench.open({ classes: [Order], steward: Shop, public: Lobby, offers: [{ blueprint: PaymentsOffer, object: payments }] });
  const shop = await bench.place(Shop);
  const lobby = await bench.place(Lobby);
  const described = (await lobby.describe({ role: 'stranger' })) as { kind?: string; asks: { method: string }[] } | null;
  assert.equal(described?.kind, undefined, 'a stranger is not told her kind');
  assert.deepEqual(
    described?.asks.map((entry) => entry.method),
    ['signup'],
  );
  const first = await lobby.ask('signup');
  assert.ok(first !== null && 'result' in first, JSON.stringify(first));
  await lobby.ask('signup');
  assert.equal(((await shop.ask('orders')) as { result: string[] }).result.length, 1, 'asked twice, one order');
});
