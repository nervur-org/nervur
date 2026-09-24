// A ground changes one house at a time, and never holds two of one name.
// Two adds of one name at once open one house, and a house removed is gone
// only once every ask in flight on it has ended, so a house added again is
// never beside the one it replaced on the same memory.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BenchGround, FakeNetwork } from 'nervur/bench';
import { Gauge, Latch, latch } from '../fixtures/world/gauge.ts';
import { Steward } from '../fixtures/world/steward.ts';

const modules = { house: { steward: Steward, beings: [Gauge] }, other: { steward: Steward } };

test('Two adds of one name at once open one house, and the second entry is refused', async (t) => {
  const ground = await BenchGround.open({ network: new FakeNetwork(), host: 'home', modules });
  t.after(() => ground.down());
  const added = await Promise.allSettled([ground.add('house'), ground.add('house', 'other')]);
  assert.deepEqual(
    added.map((one) => one.status),
    ['fulfilled', 'rejected'],
  );
  assert.match(String((added[1] as PromiseRejectedResult).reason), /the house house stands with another entry/);
  const twice = await Promise.all([ground.add('twin'), ground.add('twin')]);
  assert.equal(twice[0].ward, twice[1].ward);
  assert.deepEqual(
    ground.list().map(({ name }) => name),
    ['house', 'twin'],
  );
});

test('A house removed is gone once every ask in flight on it has ended, its waits ended with it', async (t) => {
  const gate = latch();
  const network = new FakeNetwork();
  const ground = await BenchGround.open({ network, host: 'home', modules, faculties: { latch: { blueprint: Latch, object: gate.object } } });
  t.after(async () => {
    gate.release();
    await ground.down();
  });
  await ground.add('house', 'house', { faculties: ['latch'] });
  assert.ok('result' in (await ground.ask({ house: 'house', method: 'bear', args: { kind: 'org.example.gauge', id: 'g' } })));
  const order: string[] = [];
  const begun = gate.begun();
  const held = ground.ask({ house: 'house', id: 'g', method: 'hold' }).then((answer) => (order.push('ask'), answer));
  await begun;
  await ground.remove('house').then(() => order.push('removed'));
  assert.deepEqual(order, ['ask', 'removed'], 'the ask in flight ended before the house was gone');
  assert.deepEqual(await held, { error: { message: 'the ask ran out of time' } }, 'its time ran out with the house');
});
