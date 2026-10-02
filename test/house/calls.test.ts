// A call to a faculty, as the paper says it goes: a throw is a failure to
// answer, which an awaited call reads as silence; args are checked against
// the offer the ground handed as well as her need; and a reply is asked by
// the edge that answered, never by an occupant.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { need, s } from 'nervur/being';
import { BenchGround, FakeNetwork } from 'nervur/bench';
import { FakeFaculty } from '../fixtures/fake-faculty.ts';
import { house, world } from '../fixtures/house.ts';
import { Probe } from '../fixtures/world/prober.ts';
import { Steward } from '../fixtures/world/steward.ts';

type Json = NonNullable<Parameters<BenchGround['ask']>[0]['args']>;
type Body = NonNullable<Parameters<typeof BenchGround.open>[0]['faculties']>[string];

// A house holding one looker, granted the probe the test hands.
const open = async (t: { after(done: () => unknown): void }, probe: Body) => {
  const network = new FakeNetwork();
  const ground = await BenchGround.open({ network, host: 'home', modules: { house: house(Steward, [world('steward'), world('prober')]) }, faculties: { probe } });
  t.after(() => ground.down());
  await ground.add('house', 'house', { faculties: ['probe'] });
  const ask = (id: string, method: string, args: Json = {}) => ground.ask({ house: 'house', id, method, args });
  assert.ok('result' in (await ask('steward', 'bear', { kind: 'org.example.looker', id: 'l' })));
  return { network, ask };
};

test('A faculty that throws answers nothing, and an awaited call reads it as silence', async (t) => {
  const probe = new FakeFaculty(Probe, { look: (args) => `saw ${String((args as { n: number }).n)}`, poke: () => null });
  const { ask } = await open(t, probe.offer);
  probe.throwNext();
  assert.deepEqual(await ask('l', 'look', { n: 1 }), { result: 'failed: look answered nothing' }, 'the crash is no cause she reads');
  assert.deepEqual(await ask('l', 'look', { n: 1 }), { result: 'saw 1' });
});

test('An awaited call answers her as data, and never throws into her code', async (t) => {
  const probe = new FakeFaculty(Probe, { look: () => 'seen', poke: () => null });
  const { network, ask } = await open(t, probe.offer);
  probe.refuseNext('too dark');
  assert.deepEqual(await ask('l', 'look', { n: 1 }), { result: 'failed: too dark' }, 'the error reached her as a value she read');
  probe.throwNext();
  assert.deepEqual(await ask('l', 'glance', { n: 1 }), { result: 'went on' }, 'a call she never awaits fails as data, and her ask lands');
  await network.settle();
  assert.deepEqual(await ask('l', 'look', { n: 1 }), { result: 'seen' }, 'the house stands');
});

test('Args are checked against the offer as well as her need, and the object never sees what its schema refuses', async (t) => {
  const Narrow = need('probe', {
    look: { idempotent: true, args: s.object({ n: s.integer({ maximum: 3 }) }), result: s.string() },
    poke: {},
  });
  const probe = new FakeFaculty(Narrow, { look: (args) => `saw ${String((args as { n: number }).n)}`, poke: () => null });
  const { ask } = await open(t, probe.offer);
  assert.deepEqual(await ask('l', 'look', { n: 5 }), { result: 'failed: the value.n is above 3' });
  assert.deepEqual(await ask('l', 'look', { n: 2.5 }), { result: 'failed: the value.n is not an integer' });
  assert.equal(probe.calls.length, 0, 'the faculty was never called with args its offer refuses');
  assert.deepEqual(await ask('l', 'look', { n: 3 }), { result: 'saw 3' });
});

test('It refuses an ask meant for an edge out of her, asked by an occupant: the probe brings its answer, and no occupant fakes it', async (t) => {
  const probe = new FakeFaculty(Probe, { look: () => 'seen', poke: () => null });
  const { network, ask } = await open(t, probe.offer);
  assert.deepEqual(await ask('l', 'nudged', { result: null }), { error: { message: 'no such ask' } }, 'the owner herself cannot bring the probe’s answer');
  assert.ok('result' in (await ask('l', 'nudge')));
  await network.settle();
  const list = (await ask('steward', 'list')) as { result: { id: string; dead: string[] }[] };
  assert.deepEqual(list.result.find((one) => one.id === 'l')?.dead, [], 'the probe’s own answer reached her reply');
});

test('A call her need declared awaited, given a reply, fails her ask, and nothing of it leaves', async (t) => {
  const probe = new FakeFaculty(Probe, { look: () => 'seen', poke: () => null });
  const { network, ask } = await open(t, probe.offer);
  assert.deepEqual(await ask('l', 'stare', { n: 1 }), { error: { message: 'look is awaited: an awaited call answers during her ask and takes no reply' } });
  await network.settle();
  assert.equal(probe.calls.length, 0, 'the look never left');
});

test('A reply is asked by the edge that answered, and one that edge may not ask is kept as a dead letter', async (t) => {
  const probe = new FakeFaculty(Probe, { look: () => 'seen', poke: () => null });
  const { network, ask } = await open(t, probe.offer);
  assert.ok('result' in (await ask('l', 'poke')));
  await network.settle();
  assert.equal(probe.calls.length, 1, 'the poke left');
  const list = (await ask('steward', 'list')) as { result: { id: string; dead: string[] }[] };
  assert.deepEqual(list.result.find((one) => one.id === 'l')?.dead, ['heard: no such ask'], 'her reply is for her keeper, and the probe is none');
});
