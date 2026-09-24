// A network that is slow, cut, lossy, repeating and flaky, on the bench's
// clock. An effect waits out every failure in its outbox and acts once; an
// awaited call answers within its wait or fails.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BenchGround, FakeClock, FakeNetwork } from 'nervur/bench';
import * as shop from '../fixtures/world/shop.ts';

const modules = { shop };

// Acme's tally, and Alice's sender holding a standing on it.
const world = async (seed?: string) => {
  const clock = new FakeClock();
  const network = new FakeNetwork({ clock, ...(seed === undefined ? {} : { seed }) });
  const acme = await BenchGround.open({ network, clock, host: 'acme', names: ['acme.com'], modules });
  const home = await BenchGround.open({ network, clock, host: 'home', names: ['alice.home'], modules });
  await acme.add('store', 'shop');
  await home.add('home', 'shop');
  await acme.ask({ house: 'store', method: 'bear', args: { kind: 'org.example.tally', id: 'tally' } });
  await home.ask({ house: 'home', method: 'bear', args: { kind: 'org.example.sender', id: 'alice' } });
  const offered = await acme.ask({ house: 'store', method: 'offerFor', args: { being: 'tally', occupant: 'alice' } });
  assert.ok('result' in offered);
  await home.ask({ house: 'home', id: 'alice', method: 'accept', args: { invitation: (offered.result as { handle: string }).handle } });
  const send = async (by: number) => assert.ok('result' in (await home.ask({ house: 'home', id: 'alice', method: 'send', args: { by } })));
  const tally = async () => ({
    total: ((await acme.ask({ house: 'store', id: 'tally', method: 'total' })) as { result: number }).result,
    adds: ((await acme.ask({ house: 'store', id: 'tally', method: 'adds' })) as { result: number }).result,
  });
  const log = async () => ((await home.ask({ house: 'home', id: 'alice', method: 'log' })) as { result: { heard: number[]; failed: string[] } }).result;
  return { clock, network, acme, home, send, tally, log };
};

test('An effect on a standing never described waits out a cut, and one its far side lacks is refused where it lands', async () => {
  const clock = new FakeClock();
  const network = new FakeNetwork({ clock });
  const acme = await BenchGround.open({ network, clock, host: 'acme', names: ['acme.com'], modules });
  const home = await BenchGround.open({ network, clock, host: 'home', names: ['alice.home'], modules });
  await acme.add('store', 'shop');
  await home.add('home', 'shop');
  await acme.ask({ house: 'store', method: 'bear', args: { kind: 'org.example.tally', id: 'tally' } });
  await home.ask({ house: 'home', method: 'bear', args: { kind: 'org.example.sender', id: 'alice' } });
  const offered = await acme.ask({ house: 'store', method: 'offerFor', args: { being: 'tally', occupant: 'alice' } });
  await home.ask({ house: 'home', id: 'alice', method: 'accept', args: { invitation: (offered as { result: { handle: string } }).result.handle } });
  network.partition('acme', 'home');
  assert.ok('result' in (await home.ask({ house: 'home', id: 'alice', method: 'send', args: { by: 1 } })), 'queued with no describe read');
  await network.elapse(20_000);
  network.heal();
  await network.elapse(70_000);
  assert.deepEqual(await acme.ask({ house: 'store', id: 'tally', method: 'adds' }), { result: 1 });

  // A sender whose standing is on a host, who has no `add`: her need is found wrong where the effect lands.
  await acme.ask({ house: 'store', method: 'bear', args: { kind: 'org.example.host', id: 'bob' } });
  await home.ask({ house: 'home', method: 'bear', args: { kind: 'org.example.sender', id: 'wrong' } });
  const bob = await acme.ask({ house: 'store', method: 'offerFor', args: { being: 'bob', occupant: 'wrong' } });
  await home.ask({ house: 'home', id: 'wrong', method: 'accept', args: { invitation: (bob as { result: { handle: string } }).result.handle } });
  assert.ok('result' in (await home.ask({ house: 'home', id: 'wrong', method: 'send', args: { by: 1 } })));
  await network.elapse(10_000);
  assert.deepEqual(await home.ask({ house: 'home', id: 'wrong', method: 'log' }), { result: { heard: [], failed: ['no such ask'] } });
});

test('An effect across a cut waits in its outbox, and lands once when the cut heals', async () => {
  const { network, send, tally, log } = await world();
  network.partition('acme', 'home');
  await send(5);
  await network.elapse(20_000);
  assert.deepEqual(await tally(), { total: 0, adds: 0 }, 'nothing crossed');
  network.heal();
  await network.elapse(70_000);
  assert.deepEqual(await tally(), { total: 5, adds: 1 });
  assert.deepEqual(await log(), { heard: [5], failed: [] });
});

test('A lost reply and a box delivered twice each act once', async () => {
  const { network, send, tally, log } = await world();
  network.loseNext();
  await send(3);
  await network.elapse(10_000);
  network.duplicateNext();
  await send(4);
  await network.elapse(10_000);
  assert.deepEqual(await tally(), { total: 7, adds: 2 });
  assert.deepEqual(await log(), { heard: [3, 7], failed: [] });
  assert.ok(network.crossings.some(({ outcome }) => outcome === 'lost'));
  assert.ok(network.crossings.some(({ outcome }) => outcome === 'twice'));
});

test('A reply cut one way is retried until the way back heals, and the far side acts once', async () => {
  const { network, send, tally, log } = await world();
  network.cut('acme', 'home');
  await send(2);
  await network.elapse(30_000);
  assert.deepEqual(await tally(), { total: 2, adds: 1 }, 'the box arrived');
  assert.deepEqual(await log(), { heard: [], failed: [] }, 'no reply came back');
  network.heal();
  await network.elapse(70_000);
  assert.deepEqual(await tally(), { total: 2, adds: 1 }, 'the retries acted nothing more');
  assert.deepEqual(await log(), { heard: [2], failed: [] });
});

test('An awaited call answers within its wait on a slow link, and fails beyond it', async () => {
  const { network, home, send } = await world();
  await send(1);
  await network.elapse(5_000);
  network.link('acme', 'home', { latency: 2_000 });
  const slow = home.ask({ house: 'home', id: 'alice', method: 'read' });
  await network.elapse(10_000);
  assert.deepEqual(await slow, { result: 1 }, 'four seconds there and back');
  network.link('acme', 'home', { latency: 20_000 });
  const tooSlow = home.ask({ house: 'home', id: 'alice', method: 'read' });
  await network.elapse(60_000);
  assert.ok('error' in (await tooSlow), 'forty seconds is past the thirty an awaited call waits');
});

test('A host off while an effect waits takes it once it is on again', async () => {
  const { network, acme, send, tally, log } = await world();
  await acme.down();
  await send(6);
  await network.elapse(30_000);
  await acme.up();
  await network.elapse(70_000);
  assert.deepEqual(await tally(), { total: 6, adds: 1 });
  assert.deepEqual(await log(), { heard: [6], failed: [] });
});

test('On a flaky link every effect lands once, in the order it was sent', { timeout: 20_000 }, async () => {
  const { network, send, tally, log } = await world('flaky');
  network.link('acme', 'home', { latency: 300, drop: 0.3, lose: 0.3, duplicate: 0.2 });
  for (let by = 1; by <= 10; by++) await send(by);
  await network.elapse(30 * 60_000, { step: 5_000 });
  assert.deepEqual(await tally(), { total: 55, adds: 10 });
  assert.deepEqual(await log(), { heard: [1, 3, 6, 10, 15, 21, 28, 36, 45, 55], failed: [] });
  const outcomes = new Set(network.crossings.map(({ outcome }) => outcome));
  for (const outcome of ['dropped', 'lost', 'twice', 'answered'] as const) assert.ok(outcomes.has(outcome), `the link ${outcome} some boxes`);
});
