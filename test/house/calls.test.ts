// A call to a faculty, as the paper says it goes: a throw is a failure to
// answer, which an awaited call reads as silence; args are checked against
// the offer the ground handed as well as her need; and a reply is asked as
// her steward would ask it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Body } from 'nervur';
import { need, s } from 'nervur/being';
import { BenchGround, FakeNetwork } from 'nervur/bench';
import { FakeFaculty } from '../fixtures/fake-faculty.ts';
import { Looker, Probe } from '../fixtures/world/prober.ts';
import { Steward } from '../fixtures/world/steward.ts';

type Json = NonNullable<Parameters<BenchGround['ask']>[0]['args']>;

// A house holding one looker, granted the probe the test hands.
const open = async (t: { after(done: () => unknown): void }, probe: Body) => {
  const network = new FakeNetwork();
  const ground = await BenchGround.open({ network, host: 'home', modules: { house: { steward: Steward, beings: [Looker] } }, faculties: { probe } });
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

test('Args are checked against the offer as well as her need, and the object never sees what its schema refuses', async (t) => {
  const Narrow = need('probe', {
    look: { hints: { idempotent: true }, args: s.object({ n: s.integer({ maximum: 3 }) }), result: s.string() },
    poke: {},
  });
  const probe = new FakeFaculty(Narrow, { look: (args) => `saw ${String((args as { n: number }).n)}`, poke: () => null });
  const { ask } = await open(t, probe.offer);
  assert.deepEqual(await ask('l', 'look', { n: 5 }), { result: 'failed: the value.n is above 3' });
  assert.deepEqual(await ask('l', 'look', { n: 2.5 }), { result: 'failed: the value.n is not an integer' });
  assert.equal(probe.calls.length, 0, 'the faculty was never called with args its offer refuses');
  assert.deepEqual(await ask('l', 'look', { n: 3 }), { result: 'saw 3' });
});

test('A reply is asked as her steward would ask it, and one her steward may not ask is kept as a dead letter', async (t) => {
  const probe = new FakeFaculty(Probe, { look: () => 'seen', poke: () => null });
  const { network, ask } = await open(t, probe.offer);
  assert.ok('result' in (await ask('l', 'poke')));
  await network.settle();
  assert.equal(probe.calls.length, 1, 'the poke left');
  const list = (await ask('steward', 'list')) as { result: { id: string; dead: string[] }[] };
  assert.deepEqual(list.result.find((one) => one.id === 'l')?.dead, ['heard: no such ask'], 'her reply is for her keeper, and the steward is none');
});
