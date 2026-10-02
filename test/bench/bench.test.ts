import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Bench } from 'nervur/bench';
import { Lobby } from '../fixtures/guides/classes/lobby.ts';
import { Order } from '../fixtures/guides/classes/order.ts';
import { Shop } from '../fixtures/guides/classes/shop.ts';
import { Desk, Ledger } from '../fixtures/bench/ledger.ts';
import { Dice, Keep, Liar, Stamp, Tally } from '../fixtures/bench/tally.ts';
import { FakePayments, PaymentsOffer } from '../fixtures/world/payments.ts';

// The module files the bench loads each class from, in the house's own runner.
const ORDER = new URL('../fixtures/guides/classes/order.ts', import.meta.url);
const CLASSES = new URL('../fixtures/guides/classes/index.ts', import.meta.url);
const TALLY = new URL('../fixtures/bench/tally.ts', import.meta.url);
const LEDGER = new URL('../fixtures/bench/ledger.ts', import.meta.url);

test('The paper’s Order, driven through the bench: every ask crosses as a box', async () => {
  const payments = new FakePayments();
  const bench = await Bench.open({ module: ORDER, offers: [{ blueprint: PaymentsOffer, object: payments }] });
  const order = await bench.place(Order);
  assert.deepEqual(await order.ask('checkout'), { error: { message: 'Add an item first.' } });
  assert.deepEqual(await order.ask('add', { sku: 'tea', price: 4 }), { result: { total: 4 } });
  assert.deepEqual(await order.ask('checkout'), { result: null });
  assert.equal(payments.calls.length, 1, 'the charge left once checkout landed');
  assert.equal((await order.describe())?.state, 'paying');
  assert.deepEqual(await payments.settle(), { result: null });
  await bench.settle();
  assert.equal((await order.describe())?.state, 'paid');
  assert.deepEqual(await order.ask('add', { sku: 'jam', price: 1 }), { error: { message: 'not in this state' } });
});

test('The bench runs every example, and the author’s documentation and her tests are one text', async () => {
  const findings = await Bench.examples(Tally, { module: TALLY });
  assert.deepEqual(
    findings.map((finding) => [finding.what, finding.ok]),
    [
      ['bump, example 1: adds to what stands', true],
      ['bump, example 2: refuses to go down', true],
      ['stop, example 1', true],
      ['read, example 1: stopped at seven', true],
    ],
  );
});

test('The bench walks every state and role, and plays every ask by every role its for names, and one naming none by every occupant, once in the first state that holds it', async () => {
  const findings = await Bench.walk(Tally, { module: TALLY });
  assert.deepEqual(
    findings.map((finding) => finding.what),
    [
      'counting, as steward',
      'counting, as keeper',
      'counting, bump as keeper',
      'counting, stop as keeper',
      'counting, read as root',
      'counting, read as steward',
      'counting, read as being',
      'stopped, as steward',
      'stopped, as keeper',
    ],
  );
  assert.ok(findings.every((finding) => finding.ok), JSON.stringify(findings));
});

test('The bench flags a class whose re-run of the same history answers differently', async () => {
  const [finding] = await Bench.examples(Dice, { module: TALLY });
  assert.deepEqual(finding, { ok: false, what: 'roll, example 1: any face', why: 'a re-run of the same history answered differently' });
});

test('The bench flags a class whose re-run of the same history leaves her cells differently', async () => {
  const [finding] = await Bench.examples(Stamp, { module: TALLY });
  assert.deepEqual(finding, { ok: false, what: 'stamp, example 1: hides a nonce', why: 'a re-run of the same history left her cells differently' });
});

test('The bench judges a role on her cells as they stand, so root plays a role her history gave it', async () => {
  const findings = await Bench.check(Keep, { module: TALLY });
  assert.deepEqual(
    findings.map((finding) => finding.what),
    ['claim, example 1', 'guard, example 1', 'open, as steward', 'open, claim as root', 'open, claim as steward', 'open, claim as being', 'kept, as steward', 'kept, as keeper', 'kept, guard as keeper'],
  );
});

test('A placed being’s cells are read through the hand', async () => {
  const bench = await Bench.open({ module: TALLY });
  const tally = await bench.place(Tally);
  await tally.ask('bump', { by: 4 }, { role: 'keeper' });
  assert.deepEqual(await tally.cells(), { count: 4, state: 'counting' });
});

test('The bench names a role it cannot play', async () => {
  await assert.rejects(Bench.check(Liar, { module: TALLY }), /secret, example 1: the bench cannot play friend on placed-1: no one it makes holds friend here/);
});

test('The bench walks a steward, playing root through the hand, and no role an owner could not play', async () => {
  const findings = await Bench.check(Shop, { module: CLASSES, position: 'steward' });
  assert.deepEqual(
    findings.map((finding) => finding.what),
    ['ready, as pilot', 'ready, open as pilot', 'ready, orders as pilot', 'ready, hire as pilot'],
  );
});

test('The bench walks a public being, playing a stranger from a house of its own', async () => {
  const findings = await Bench.check(Lobby, { module: CLASSES, position: 'public' });
  assert.deepEqual(
    findings.map((finding) => finding.what),
    ['ready, as steward', 'ready, as stranger', 'ready, signup as stranger'],
  );
});

test('A stranger signs up at the public being, and her steward holds one order for them', async () => {
  const payments = new FakePayments();
  const bench = await Bench.open({ module: CLASSES, steward: Shop, public: Lobby, offers: [{ blueprint: PaymentsOffer, object: payments }] });
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

test('Her steward asks through its powers: an effect answers with the reply it brings, an awaited ask with its answer, a refusal with its error', async () => {
  const bench = await Bench.open({ module: LEDGER });
  const ledger = await bench.place(Ledger);
  assert.equal(ledger.roleFor('note'), 'steward');
  assert.deepEqual(await ledger.ask('note', { line: 'tea' }), { result: 1 }, 'the reply the effect brought once it landed');
  assert.deepEqual(await ledger.ask('note', { line: 'jam' }), { result: 2 }, 'each effect is read by its own reply');
  assert.deepEqual(await ledger.ask('count', {}, { role: 'steward' }), { result: 2 });
  assert.deepEqual(await ledger.ask('check', { line: 'tea' }, { role: 'steward' }), { result: true });
  assert.deepEqual(await ledger.ask('check', { line: '' }, { role: 'steward' }), { error: { message: 'the line is empty' } });
  assert.deepEqual(
    (await ledger.describe({ role: 'steward' }))?.asks.map((entry) => entry.method),
    ['note', 'count', 'check'],
  );
  assert.deepEqual(await ledger.cells(), { lines: ['tea', 'jam'] });
});

test('A being introduced to her asks what she shows a being, and is refused what she does not', async () => {
  const bench = await Bench.open({ module: LEDGER });
  const ledger = await bench.place(Ledger);
  await ledger.ask('note', { line: 'tea' });
  assert.deepEqual(
    (await ledger.describe({ role: 'being' }))?.asks.map((entry) => entry.method),
    ['count', 'check'],
  );
  assert.deepEqual(await ledger.ask('count', {}, { role: 'being' }), { result: 1 });
  assert.deepEqual(await ledger.ask('check', { line: '' }, { role: 'being' }), { error: { message: 'the line is empty' } });
  assert.deepEqual(await ledger.ask('note', { line: 'jam' }, { role: 'being' }), { error: { message: 'no such ask' } }, 'she shows a being no note');
  assert.deepEqual(await ledger.cells(), { lines: ['tea'] });
});

test('A stranger at her public being is answered, refused where she fails, and refused an ask she does not show a stranger', async () => {
  const bench = await Bench.open({ module: LEDGER, public: Desk });
  const desk = await bench.place(Desk);
  assert.deepEqual(await desk.ask('greet', { name: 'ana' }), { result: 'welcome, ana' });
  assert.deepEqual(await desk.ask('greet', { name: '' }), { error: { message: 'a stranger names herself' } });
  assert.deepEqual(await desk.ask('close', {}, { role: 'stranger' }), { error: { message: 'no such ask' } });
});
