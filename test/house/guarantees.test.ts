// What the house guarantees, where two asks meet: a read beside the queue,
// two beings taking one invitation, a steward introducing twice, and an
// effect queued behind one that gives up.
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import type { Body } from 'nervur';
import { BenchGround, FakeNetwork } from 'nervur/bench';
import { Gauge, Latch, latch } from '../fixtures/world/gauge.ts';
import { Post, Sender } from '../fixtures/world/sender.ts';
import { Steward } from '../fixtures/world/steward.ts';

type Json = NonNullable<Parameters<BenchGround['ask']>[0]['args']>;

const open = async (t: TestContext, faculties: Record<string, Body>, beings: readonly string[]) => {
  const network = new FakeNetwork();
  const ground = await BenchGround.open({ network, host: 'home', modules: { house: { steward: Steward, beings: [Gauge, Sender] } }, faculties });
  t.after(() => ground.down());
  await ground.add('house', 'house', { faculties: Object.keys(faculties) });
  const ask = (id: string, method: string, args: Json = {}) => ground.ask({ house: 'house', id, method, args });
  const result = async (id: string, method: string, args: Json = {}) => {
    const answer = await ask(id, method, args);
    assert.ok('result' in answer, JSON.stringify(answer));
    return answer.result;
  };
  for (const id of beings) await result('steward', 'bear', { kind: id.startsWith('s') ? 'org.example.sender' : 'org.example.gauge', id });
  await network.elapse(0);
  return { network, ask, result };
};

const gauges = async (t: TestContext) => {
  const gate = latch();
  return { gate, ...(await open(t, { latch: { blueprint: Latch, object: gate.object } }, ['a', 'b', 'c'])) };
};

test('One ask at a time: a read beside the queue lands none of her cells', async (t) => {
  const { gate, ask, result } = await gauges(t);
  const begun = gate.begun();
  const holding = ask('a', 'hold');
  await begun;
  await result('a', 'bump');
  gate.release();
  assert.deepEqual(await holding, { result: 0 }, 'the read answers the cells it began on');
  assert.equal(await result('a', 'get'), 1, 'the bump that landed beside it stands');
});

test('Only the first holder binds an invitation, inside the house as between houses', async (t) => {
  const { ask, result } = await gauges(t);
  const { handle } = (await result('a', 'ticket')) as { handle: string };
  const taken = await Promise.all([ask('b', 'take', { invitation: handle }), ask('c', 'take', { invitation: handle })]);
  assert.equal(taken.filter((answer) => 'result' in answer).length, 1, JSON.stringify(taken));
  assert.deepEqual(
    taken.filter((answer) => 'error' in answer),
    [{ error: { message: 'the invitation is spent or unknown' } }],
  );
});

test('An invitation taken before its mint landed lands spent', async (t) => {
  const { ask, result } = await gauges(t);
  const { invitation, taken } = (await result('steward', 'spend', { on: 'a', carrier: 'b', taker: 'c' })) as { invitation: string; taken: string };
  assert.match(taken, /^standing:[0-9a-f]{16}$/);
  assert.deepEqual(await ask('b', 'take', { invitation }), { error: { message: 'the invitation is spent or unknown' } });
});

test('No being stands on herself, introduced or invited', async (t) => {
  const { ask, result } = await gauges(t);
  assert.deepEqual(await ask('steward', 'introduce', { from: 'a', to: 'a' }), { error: { message: 'no being stands on herself' } });
  const { handle } = (await result('a', 'ticket')) as { handle: string };
  assert.deepEqual(await ask('a', 'take', { invitation: handle }), { error: { message: 'she takes no invitation to herself' } });
});

test('Her notes are hers: a second introduction keeps them', async (t) => {
  const { result } = await gauges(t);
  await result('steward', 'introduce', { from: 'a', to: 'b', trusted: true });
  await result('a', 'noteStanding', { on: 'b', mine: true });
  await result('b', 'noteOccupant', { on: 'being:a', mine: true });
  await result('steward', 'introduce', { from: 'a', to: 'b', trusted: false });
  const on = (id: string) => (relations: unknown) => (relations as { id: string }[]).filter((relation) => relation.id === id);
  assert.deepEqual(on('b')(await result('a', 'standingNotes')), [{ id: 'b', mine: true, trusted: false }]);
  assert.deepEqual(on('being:a')(await result('b', 'occupantNotes')), [{ id: 'being:a', mine: true, trusted: false }]);
});

test('It refuses a write by anyone else to her notes, and by her to her steward’s: her own note leaves the steward’s as it was', async (t) => {
  const { result } = await gauges(t);
  await result('steward', 'introduce', { from: 'a', to: 'b', trusted: true });
  await result('a', 'noteStanding', { on: 'b', mine: false });
  const relations = (await result('a', 'standingNotes')) as { id: string }[];
  assert.deepEqual(
    relations.filter((relation) => relation.id === 'b'),
    [{ id: 'b', mine: false, trusted: true }],
  );
});

test('Where the first gives up, every entry queued behind it on that receiver fails with it', async (t) => {
  const received: number[] = [];
  const post = {
    blueprint: Post,
    window: 10_000,
    object: {
      send: async ({ n }: { n: number }) => {
        received.push(n);
        if (n === 1) throw new Error('the post is down');
        return { result: null };
      },
    },
  };
  const { network, result } = await open(t, { post }, ['s']);
  await result('s', 'go', { n: 1 });
  await network.elapse(5_000);
  await result('s', 'go', { n: 2 });
  await network.elapse(12_000);
  assert.equal(received.includes(2), false, `the entry behind was sent: ${JSON.stringify(received)}`);
  assert.deepEqual(await result('s', 'replies'), ['the call gave up at its deadline', 'the call gave up at its deadline']);
});
