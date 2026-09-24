// The hand reaches any being by id, as `root`, and the steward where it names none.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BenchGround, FakeClock, FakeNetwork } from 'nervur/bench';
import * as shop from '../fixtures/world/shop.ts';

const open = async () => {
  const clock = new FakeClock();
  const ground = await BenchGround.open({ network: new FakeNetwork({ clock }), clock, host: 'shop', modules: { shop } });
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
