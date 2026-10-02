// What a walk finds when it plays every ask: a breach of her own table or
// of her house, named by the ask and the role that played it. What stands
// beside her, a stand-in answering a need she declares, and her household.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Bench } from 'nervur/bench';
import { Counted, counted, Crash, Filer, Sneak, Stray } from '../fixtures/bench/breach.ts';
import { Ping, Pong } from '../fixtures/bench/household.ts';
import { Quote, Rates } from '../fixtures/bench/quote.ts';
import { Order } from '../fixtures/guides/classes/order.ts';
import { Clerk, Manager } from '../fixtures/guides/patterns/team.ts';
import { Knot } from '../fixtures/world/knot.ts';

const BREACH = new URL('../fixtures/bench/breach.ts', import.meta.url);
const HOUSEHOLD = new URL('../fixtures/bench/household.ts', import.meta.url);
const QUOTE = new URL('../fixtures/bench/quote.ts', import.meta.url);
const RATES = new URL('../fixtures/bench/rates.ts', import.meta.url);
const TEAM = new URL('../fixtures/guides/patterns/team.ts', import.meta.url);
const CLASSES =new URL('../fixtures/guides/classes/index.ts', import.meta.url);

const failed = (findings: { ok: boolean; what: string; why?: string }[]) => findings.filter((finding) => !finding.ok).map(({ what, why }) => `${what}: ${why}`);

test('A readOnly ask that writes is a finding naming the ask and the role', async () => {
  assert.deepEqual(failed(await Bench.walk(Sneak, { module: BREACH })), ['ready, peek as steward: a readOnly ask wrote']);
});

test('An ask landing in a state its to does not name is a finding naming the ask and the role', async () => {
  assert.deepEqual(failed(await Bench.walk(Stray, { module: BREACH })), ['open, close as steward: she landed in closed, which its to does not name']);
});

test('An ask that fails her house, throwing past fail, is a finding naming the ask and the role', async () => {
  assert.deepEqual(failed(await Bench.walk(Crash, { module: BREACH })), ['ready, crash as steward: it fails her house: it throws past fail']);
});

test('An edge out of her is played where her own asks reach it, and a reply her house refused is a finding naming the ask and its edge', async () => {
  assert.deepEqual(failed(await Bench.walk(Filer, { module: BREACH })), ['ready, filed as clerk: it fails her house: it throws past fail']);
});

test('A role function runs inside the runner, never in the test’s process', async () => {
  const findings = await Bench.check(Counted, { module: BREACH });
  assert.deepEqual(
    findings.map((finding) => finding.what),
    ['ready, as steward', 'ready, as keeper', 'ready, keep as keeper'],
  );
  assert.equal(counted.runs, 0, 'her role ran where her house runs, and never here');
});

test('A stand-in answers a need she declares with her author’s handlers, in the runner, and records what she asked', async (t) => {
  const bench = await Bench.open({ module: QUOTE, standIns: { rates: { need: Rates, module: RATES } } });
  t.after(() => bench.close());
  const quote = await bench.place(Quote);
  assert.deepEqual(await quote.ask('price', { from: 'eur' }), { result: 2 }, 'an awaited call on the standing her steward introduced');
  assert.deepEqual(await quote.ask('price', { from: 'nowhere' }), { error: { message: 'no rate from nowhere' } }, 'a handler that throws refuses the ask with its message');
  assert.deepEqual(await quote.ask('log', { line: 'hello' }), { result: null });
  assert.deepEqual(await quote.ask('send'), { error: { message: 'Hire a courier first.' } });
  assert.deepEqual(await quote.ask('hire', { courier: await bench.invitation('rates') }), { result: null }, 'an invitation she takes is a standing of her own');
  assert.deepEqual(await quote.ask('send'), { result: null });
  await bench.settle();
  assert.deepEqual(await bench.heard('rates'), [
    { method: 'rate', args: { from: 'eur' } },
    { method: 'note', args: { line: 'hello' } },
    { method: 'note', args: { line: 'sent' } },
  ]);
});

test('It refuses a stand-in beside a steward the test brings: the bench bears one beside its own steward alone', async () => {
  await assert.rejects(Bench.open({ module: CLASSES, steward: Order, standIns: { rates: { need: Rates, module: RATES } } }), /the bench bears a stand-in beside its own steward alone/);
});

test('An open bench introduces two beings it placed, as a steward does, beside its own steward alone', async (t) => {
  const bench = await Bench.open({ module: TEAM });
  t.after(() => bench.close());
  const manager = await bench.place(Manager, { id: 'manager' });
  const clerk = await bench.place(Clerk, { id: 'clerk' });
  assert.match(JSON.stringify(await manager.ask('assign', { job: 'file' })), /error/, 'she stands on no clerk before the introduction');
  await bench.introduce(manager, clerk);
  await bench.introduce('clerk', 'manager');
  assert.deepEqual(await manager.ask('assign', { job: 'file' }), { result: 'on it: file' });
  assert.deepEqual(await manager.ask('report'), { result: ['file'] }, 'the clerk answered back through the standing the bench introduced');

  const brought = await Bench.open({ module: TEAM, steward: Manager });
  t.after(() => brought.close());
  await assert.rejects(brought.introduce('a', 'b'), /the bench introduces beside its own steward alone/);
});

test('An open bench writes her steward’s notes on the relation it introduces, as a steward does', async (t) => {
  const bench = await Bench.open({ module: new URL('../fixtures/world/knot.ts', import.meta.url) });
  t.after(() => bench.close());
  const a = await bench.place(Knot, { id: 'a' });
  const b = await bench.place(Knot, { id: 'b' });
  await bench.introduce(a, b, { notes: { trusted: true } });
  await bench.introduce(b, a);
  assert.deepEqual(await a.ask('trusted'), { result: ['b'] });
  assert.deepEqual(await b.ask('trusted'), { result: [] }, 'a relation introduced without notes carries none');
});

test('A household walks every being of a house module in place, beside the others', async () => {
  const findings = await Bench.household({ module: CLASSES });
  assert.deepEqual(
    [...new Set(findings.map((finding) => finding.what.split(':')[0]))],
    ['com.acme.order', 'public'],
  );
});

test('A household walked in part walks the ids it names alone, the others still beside them, and refuses an id it does not hold', async () => {
  const findings = await Bench.household({ module: CLASSES, walk: ['public'] });
  assert.deepEqual([...new Set(findings.map((finding) => finding.what.split(':')[0]))], ['public']);
  await assert.rejects(Bench.household({ module: CLASSES, walk: ['nobody'] }), /the household holds no nobody to walk/);
});

test('A household walk flags an awaited call that answered nothing between two of its beings, naming both', async () => {
  await assert.rejects(
    Bench.household({ module: HOUSEHOLD, beings: { ping: Ping, pong: Pong }, introduce: [['ping', 'pong'], ['pong', 'ping']] }),
    (error: Error) => {
      assert.equal(error.message, 'the bench found 1:\n- ping: ready, ping as root: an awaited call between ping and pong answered nothing: a call came back to a being in its own chain');
      return true;
    },
  );
});
