// world.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BenchGround, FakeNetwork } from 'nervur/bench';
import { faculties } from './recipe.ts';

const shop = new URL('./classes/index.ts', import.meta.url);

test('The shop stands as a world: its owner opens an order through the hand', async (t) => {
  const ground = await BenchGround.open({ network: new FakeNetwork(), host: 'shop', modules: { shop }, registry: { faculties } });
  t.after(() => ground.down());
  await ground.hand({ method: 'facultiesAdd', args: { name: 'payments', make: 'payments' } });
  await ground.add('shop', 'shop', { faculties: ['payments'] });

  assert.ok('result' in (await ground.ask({ house: 'shop', method: 'open', args: { id: 'first' } })));
  assert.deepEqual(await ground.ask({ house: 'shop', method: 'orders' }), { result: ['first'] });
  const order = await ground.ask({ house: 'shop', id: 'first' });
  assert.equal('describe' in order && (order.describe as { state: string }).state, 'open');
});
