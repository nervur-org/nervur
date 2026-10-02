// A house knows the handles it minted and no other house's: a handle a
// class keeps in its own module never reaches another house, since each
// house loads the module in a runner of its own.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BenchGround, FakeNetwork } from 'nervur/bench';

const smuggler = new URL('../fixtures/world/smuggler.ts', import.meta.url);

test('A handle minted in one house is no handle in another, under the same id', async () => {
  const ground = await BenchGround.open({ network: new FakeNetwork(), host: 'estate', modules: { smuggler } });
  for (const house of ['one', 'two']) {
    await ground.add(house, 'smuggler');
    const borne = await ground.ask({ house, method: 'bear', args: { kind: 'org.example.smuggler', id: 'twin' } });
    assert.ok('result' in borne, JSON.stringify(borne));
  }

  const kept = await ground.ask({ house: 'one', id: 'twin', method: 'keep' });
  assert.ok('result' in kept, JSON.stringify(kept));
  const home = await ground.ask({ house: 'one', id: 'twin', method: 'pass' });
  assert.ok('result' in home, `the house that minted it hands it on: ${JSON.stringify(home)}`);

  // Each house loads the module in its own runner, so the other house's module holds nothing smuggled.
  const away = await ground.ask({ house: 'two', id: 'twin', method: 'pass' });
  assert.deepEqual(away, { error: { message: 'the value.handle is missing' } });
});
