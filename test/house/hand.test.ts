// The hand reaches any being by id, as `root`, and the steward where it names none.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BenchGround, FakeNetwork } from 'nervur/bench';
import { Counter } from '../fixtures/world/counter.ts';
import * as shop from '../fixtures/world/shop.ts';
import { Steward } from '../fixtures/world/steward.ts';

const open = async () => {
  const ground = await BenchGround.open({ network: new FakeNetwork(), host: 'shop', modules: { shop } });
  await ground.add('shop');
  return (request: { id?: string; method: string; args?: { kind: string; id: string } }) => ground.ask({ house: 'shop', ...request });
};

test('The hand asks a being by id, and she sees root asking', async () => {
  const ask = await open();
  assert.ok('result' in (await ask({ method: 'bear', args: { kind: 'org.example.host', id: 'bob' } })));
  assert.deepEqual(await ask({ id: 'bob', method: 'greet' }), { result: 'bob greets root' });
  assert.deepEqual(await ask({ method: 'beings' }), { result: ['bob', 'steward'] }, 'no id is the steward');
});

test('The hand names a being that is not here', async () => {
  const ask = await open();
  assert.deepEqual(await ask({ id: 'nobody', method: 'greet' }), { error: { message: 'no being nobody is here' } });
});

test('The hand reads a being’s cells: her defaults under what landed', async (t) => {
  const ground = await BenchGround.open({ network: new FakeNetwork(), host: 'home', modules: { house: { steward: Steward, beings: [Counter] } } });
  t.after(() => ground.down());
  await ground.add('house');
  await ground.ask({ house: 'house', method: 'bear', args: { kind: 'org.example.counter', id: 'c', args: { start: 3 } } });
  await ground.ask({ house: 'house', id: 'c', method: 'add', args: { by: 2 } });
  assert.deepEqual(await ground.ask({ house: 'house', id: 'c', cells: true }), { result: { total: 5, state: 'open', rung: 0 } });
  assert.deepEqual(await ground.hand({ house: 'house', id: 'c', cells: true }), { result: { total: 5, state: 'open', rung: 0 } }, 'the ground’s hand reads them too');
  assert.deepEqual(await ground.ask({ house: 'house', id: 'c', cells: true, method: 'add' }), { error: { message: 'the hand reads her cells alone' } });
});
