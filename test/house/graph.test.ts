// The rules of the graph, each walked as a scenario: a relation is born by
// her own invitation or by her steward's powers, and each end cuts only
// its own side.
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { BenchGround, FakeNetwork } from 'nervur/bench';
import { house, world } from '../fixtures/house.ts';
import { Steward } from '../fixtures/world/steward.ts';

type Json = NonNullable<Parameters<BenchGround['ask']>[0]['args']>;

// A house of two knots, a and b.
const knots = async (t: TestContext) => {
  const ground = await BenchGround.open({ network: new FakeNetwork(), host: 'home', modules: { house: house(Steward, [world('steward'), world('knot')]) } });
  t.after(() => ground.down());
  await ground.add('house');
  const result = async (id: string, method: string, args: Json = {}) => {
    const answer = await ground.ask({ house: 'house', id, method, args });
    assert.ok('result' in answer, JSON.stringify(answer));
    return answer.result;
  };
  for (const id of ['a', 'b']) await result('steward', 'bear', { kind: 'org.example.knot', id });
  return { result };
};

// b takes an invitation a minted to her occupant `friend`, and answers the standing it made.
const tied = async (t: TestContext) => {
  const { result } = await knots(t);
  const { handle } = (await result('a', 'mint', { occupant: 'friend' })) as { handle: string };
  const standing = (await result('b', 'take', { invitation: handle })) as string;
  return { result, standing };
};

test('A being is born holding her steward, and occupied by no one', async (t) => {
  const { result } = await knots(t);
  assert.deepEqual(await result('a', 'holds'), ['steward']);
  assert.deepEqual(await result('a', 'guests'), []);
});

test('A relation is born by her own invitation: she mints an occupant, and whoever takes it holds a standing on her', async (t) => {
  const { result, standing } = await tied(t);
  assert.match(standing, /^standing:[0-9a-f]{16}$/);
  assert.deepEqual(await result('a', 'guests'), ['friend']);
  assert.deepEqual(await result('b', 'holds'), ['steward', standing]);
  assert.equal(await result('b', 'pull', { standing }), 'friend', 'she is asked as the occupant she minted');
});

test('A relation is born by her steward’s powers: an introduction gives one a standing and the other an occupant', async (t) => {
  const { result } = await knots(t);
  await result('steward', 'introduce', { from: 'b', to: 'a' });
  assert.deepEqual(await result('b', 'holds'), ['steward', 'a']);
  assert.deepEqual(await result('a', 'guests'), ['being:b']);
  assert.equal(await result('b', 'pull', { standing: 'a' }), 'being:b');
});

test('Each end cuts its own side: a standing dropped ends her calls on it, and the far occupant stands', async (t) => {
  const { result, standing } = await tied(t);
  await result('b', 'drop', { standing });
  assert.deepEqual(await result('b', 'holds'), ['steward']);
  assert.match(String(await result('b', 'pull', { standing })), /^failed: .*standing/);
  assert.deepEqual(await result('a', 'guests'), ['friend'], 'the far side is hers to cut');
});

test('Each end cuts its own side: an occupant dismissed ends the far standing at its next call', async (t) => {
  const { result, standing } = await tied(t);
  await result('a', 'dismiss', { occupant: 'friend' });
  assert.deepEqual(await result('a', 'guests'), []);
  assert.equal(await result('b', 'pull', { standing }), 'failed: the standing was removed');
  assert.deepEqual(await result('b', 'holds'), ['steward'], 'the house drops it in the write that lands the answer');
});
