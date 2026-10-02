// A house runs in a runner of its own on every ground but the edge. The
// runner's one suite against the bench's ground, opening the fixtures'
// misbehaving house from its module file. A NodeGround's runners are
// processes, and `deep/runners.test.ts` holds it to the same suite.
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import type { FacultyContext } from 'nervur';
import { need } from 'nervur/being';
import { BenchGround, FakeNetwork } from 'nervur/bench';
import { house, world } from '../fixtures/house.ts';
import { Steward } from '../fixtures/world/steward.ts';
import { runnerSuite } from '../suites/runner.ts';

runnerSuite('BenchGround', async (t: TestContext) => {
  const ground = await BenchGround.open({ network: new FakeNetwork(), host: 'home', modules: { wild: new URL('../fixtures/runner/index.ts', import.meta.url) } });
  t.after(() => ground.down());
  await ground.add('wild');
  return { ask: (request) => ground.ask({ house: 'wild', ...request }) };
});

test('A faculty told its house opened may call the house before the opening ends', async (t) => {
  let heard: unknown;
  const ear = {
    blueprint: need('ear', {}),
    object: {},
    // It calls the house from inside the opening, and the opening waits on it.
    opened: async ({ call }: Pick<FacultyContext, 'call'>) => {
      heard = await call({ token: 'unknown', args: {}, id: 'first' });
    },
  };
  const ground = await BenchGround.open({ network: new FakeNetwork(), host: 'home', modules: { house: house(Steward, [world('steward')]) }, faculties: { ear } });
  t.after(() => ground.down());
  const standing = await ground.add('house', 'house', { faculties: ['ear'] });
  assert.equal(standing.why, undefined);
  assert.deepEqual(heard, { error: { message: 'no such token' } });
});
