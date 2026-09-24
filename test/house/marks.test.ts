// A house knows the handles it minted and no other house's: a handle
// carried to another house in a class's own module leaves there as nothing,
// even where the being answering it has the same id.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BenchGround, FakeNetwork } from 'nervur/bench';
import * as smuggler from '../fixtures/world/smuggler.ts';

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

  const away = await ground.ask({ house: 'two', id: 'twin', method: 'pass' });
  assert.deepEqual(away, { error: { message: 'a handle is owed where a value stands' } });
});
