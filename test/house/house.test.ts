// One house on a bench ground, piloted by its owner through the hand: her
// beings are born, asked, introduced and removed, her effects and her
// faculties' answers land once, and what landed outlives a restart.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Body, Registry } from 'nervur';
import { BenchGround, FakeNetwork } from 'nervur/bench';
import { Checkout } from '../fixtures/world/checkout.ts';
import { Counter } from '../fixtures/world/counter.ts';
import { FakePayments, PaymentsOffer } from '../fixtures/world/payments.ts';
import { Reader } from '../fixtures/world/reader.ts';
import { Steward } from '../fixtures/world/steward.ts';
import { hanging, Slow, Waiter } from '../fixtures/world/waiter.ts';

type Json = NonNullable<Parameters<BenchGround['ask']>[0]['args']>;

const modules = { house: { steward: Steward, beings: [Counter, Reader, Checkout, Waiter] } };

const open = async ({ faculties = {} }: { faculties?: Record<string, Body> } = {}) => {
  const network = new FakeNetwork();
  const ground = await BenchGround.open({ network, host: 'home', modules, faculties });
  // Its memory apart, so a test has it refuse a write.
  const standing = await ground.add('house', 'house', { memory: { faculty: 'fake' }, faculties: Object.keys(faculties) });
  const ask = (request: { id?: string; method?: string; args?: Json }) => ground.ask({ house: 'house', ...request });
  const result = async (method: string, args: Json = {}) => {
    const answer = await ask({ method, args });
    assert.ok('result' in answer, JSON.stringify(answer));
    return answer.result;
  };
  // What a being answered, through her steward's `forward`.
  const being = async (id: string, method: string, args: Json = {}) => {
    const { answered } = (await result('forward', { id, method, args })) as { answered?: string };
    return answered === undefined ? undefined : JSON.parse(answered);
  };
  const bear = async (kind: string, id: string, args: Json = {}) => {
    await result('bear', { kind, id, args });
    await network.settle();
  };
  // Every ask, effect and reply started, run to its end.
  const settle = () => network.settle();
  // The clock moved on, and everything it woke run to its end.
  const tick = (ms: number) => network.advance(ms);
  return { ground, standing, ask, result, being, bear, settle, tick };
};

const payments = (fake: FakePayments) => ({ payments: { blueprint: PaymentsOffer, object: fake } });

test('The hand is the steward asked as the occupant root', async () => {
  const { standing, ask, result } = await open();
  assert.match(standing.ward!, /^[0-9a-f]{128}$/);
  assert.equal(await result('whoami'), 'root');
  const described = (await ask({})) as { describe: { lang: string; state: string; asks: { method: string }[] } };
  assert.equal(described.describe.lang, 'org.nervur.asks/1');
  assert.equal(described.describe.state, 'ready');
  const methods = described.describe.asks.map((entry) => entry.method);
  assert.ok(methods.includes('bear') && methods.includes('whoami'));
  assert.ok(!methods.includes('ping'), 'a describe shows the asker’s rows of the table alone');
});

test('born runs as the new being’s first ask, and the same id twice answers the first', async () => {
  const { being, bear, result } = await open();
  await bear('org.example.counter', 'c', { start: 5 });
  await bear('org.example.counter', 'c', { start: 9 });
  assert.equal(await being('c', 'peek'), 5);
  assert.deepEqual(await result('list'), [
    { id: 'c', kind: 'org.example.counter', absent: false, dead: [] },
    { id: 'steward', kind: 'org.example.steward', absent: false, dead: [] },
  ]);
  assert.equal(await result('count'), 2, 'the steward’s own cells land either way');
});

test('Every ask to a new being waits for her born, readOnly ones too', async () => {
  const { result, being } = await open();
  await result('bear', { kind: 'org.example.counter', id: 'c', args: { start: 5 } });
  assert.equal(await being('c', 'total'), 5, 'the steward’s ask returned, and born had run before this read');
});

test('It refuses an effect sent before its ask landed, or sent again while a call for it is pending: it leaves after her ask lands, and acts once', async () => {
  const { being, bear, settle } = await open();
  await bear('org.example.counter', 'c');
  assert.equal(await being('c', 'add', { by: 2 }), undefined, 'an effect returns nothing to its caller');
  await settle();
  assert.equal(await being('c', 'peek'), 2);
  await settle();
  assert.equal(await being('c', 'peek'), 2);
});

test('An ask lands whole or not at all', async () => {
  const { being, bear, settle } = await open();
  await bear('org.example.counter', 'c', { start: 1 });
  await being('c', 'refuse', { why: 'no' });
  await being('c', 'wrong');
  await settle();
  assert.equal(await being('c', 'peek'), 1, 'a fail lands none of her cells, and neither does a state outside to');
});

test('It refuses a readOnly ask that writes', async () => {
  const { ask, bear, being } = await open();
  await bear('org.example.counter', 'c', { start: 1 });
  assert.deepEqual(await ask({ method: 'forward', args: { id: 'c', method: 'sneaky' } }), { error: { message: 'the ask failed' } });
  assert.equal(await being('c', 'peek'), 1);
});

test('A standing is matched to a need, and an awaited call answers during her ask', async () => {
  const { bear, being, result } = await open();
  await bear('org.example.counter', 'c', { start: 3 });
  await bear('org.example.reader', 'r');
  await result('introduce', { from: 'r', to: 'c', trusted: true });
  assert.equal(await being('r', 'look', { at: 'c' }), 3);
});

test('A standing whose describe does not cover the need fails the call, and she may catch it', async () => {
  const { ask, bear, being, result } = await open();
  await bear('org.example.counter', 'c', { start: 3 });
  await bear('org.example.reader', 'r');
  await result('introduce', { from: 'r', to: 'c', trusted: false });
  assert.equal(await being('r', 'lookAway', { at: 'c' }), -1);
  const answer = await ask({ method: 'forward', args: { id: 'r', method: 'look', args: { at: 'c' } } });
  assert.ok('error' in answer && /does not cover counter/.test(answer.error.message), JSON.stringify(answer));
});

test('Args are checked at the call, inside her ask', async () => {
  const { ask, bear } = await open();
  await bear('org.example.reader', 'r');
  const answer = await ask({ method: 'forward', args: { id: 'r', method: 'look', args: {} } });
  assert.deepEqual(answer, { error: { message: 'the value.at is missing' } });
});

test('A faculty is offered, a handle crosses to it as a token, and the reply comes back as an ask', async () => {
  const fake = new FakePayments();
  const { bear, being, settle } = await open({ faculties: payments(fake) });
  await bear('org.example.shop', 'shop');
  await being('shop', 'checkout', { amount: 30 });
  await settle();
  assert.equal(fake.calls.length, 1);
  assert.match(fake.tokens[0], /^[0-9a-f]{32}$/);
  assert.deepEqual(await being('shop', 'status'), { state: 'paying', refused: '' });
  assert.deepEqual(await fake.settle(), { result: null });
  assert.deepEqual(await being('shop', 'status'), { state: 'paid', refused: '' });
  assert.deepEqual(await fake.settle('settle-2'), { error: { message: 'no such token' } }, 'once: the handle went with its first ask');
});

test('An answer is final, and a failure to answer is tried again with the same call id', async () => {
  const fake = new FakePayments();
  fake.failures = 2;
  const { bear, being, settle, tick } = await open({ faculties: payments(fake) });
  await bear('org.example.shop', 'shop');
  await being('shop', 'checkout', { amount: 30 });
  await settle();
  await tick(1000);
  await tick(2000);
  assert.equal(fake.calls.length, 3);
  assert.equal(new Set(fake.calls).size, 1, 'every attempt carries the call id drawn once');
  assert.deepEqual(await being('shop', 'status'), { state: 'paying', refused: '' });
});

test('An error the receiver answers reaches her reply', async () => {
  const fake = new FakePayments();
  fake.refusing = true;
  const { bear, being, settle } = await open({ faculties: payments(fake) });
  await bear('org.example.shop', 'shop');
  await being('shop', 'checkout', { amount: 30 });
  await settle();
  assert.deepEqual(await being('shop', 'status'), { state: 'open', refused: 'card declined' });
});

test('An awaited call waits what its callee names, and never past her own ask’s wait', async () => {
  const { bear, being, settle, tick } = await open({ faculties: { slow: { blueprint: Slow, object: hanging } } });
  await bear('org.example.waiter', 'w');
  const poked = being('w', 'poke');
  await settle();
  await tick(500);
  assert.equal(await poked, 'gave up', 'the faculty named half a second, and she caught the failure');
});

test('A reply her table refuses is kept for her steward, and kept seven days', async () => {
  const fake = new FakePayments();
  fake.holding = true;
  const { bear, being, result, settle, tick } = await open({ faculties: payments(fake) });
  await bear('org.example.shop', 'shop');
  await being('shop', 'checkout', { amount: 30 });
  await settle();
  await being('shop', 'cancel');
  fake.release();
  await settle();
  const shop = async () => ((await result('list')) as { id: string; dead: string[] }[]).find((one) => one.id === 'shop')!;
  assert.deepEqual((await shop()).dead, ['charged: not in this state']);
  await tick(7 * 86_400_000 + 1);
  await being('shop', 'checkout', { amount: 1 });
  await settle();
  assert.deepEqual((await shop()).dead, [], 'gone at her next write after seven days');
});

test('The steward’s empty ask reads what a being shows her steward', async () => {
  const { bear, result } = await open();
  await bear('org.example.counter', 'c');
  const shown = (await result('shows', { id: 'c' })) as string[];
  assert.ok(shown.includes('peek'), 'an ask for the steward');
  assert.ok(shown.includes('total'), 'an ask for every occupant');
  assert.ok(!shown.includes('punch'), 'no ask for a handle');
});

test('Every need is covered, or she is absent', async () => {
  const { ask, bear } = await open();
  await bear('org.example.counter', 'c');
  const answer = await ask({ method: 'bear', args: { kind: 'org.example.shop', id: 'shop' } });
  assert.deepEqual(answer, { error: { message: 'no offer covers her need pay' } });
});

test('An alarm is kept by the house, and asks her when its time comes', async () => {
  const { ground, being, bear, settle, tick } = await open();
  await bear('org.example.counter', 'c');
  await being('c', 'ring', { in: 5000 });
  await settle();
  await ground.down();
  await ground.up();
  await tick(5000);
  assert.equal(await being('c', 'rings'), 1, 'the house re-arms on open');
});

test('remove leaves nothing of her', async () => {
  const { ask, bear, result } = await open();
  await bear('org.example.counter', 'c');
  await result('remove', { id: 'c' });
  assert.deepEqual(await result('list'), [{ id: 'steward', kind: 'org.example.steward', absent: false, dead: [] }]);
  const answer = await ask({ method: 'forward', args: { id: 'c', method: 'peek' } });
  assert.deepEqual(answer, { error: { message: 'c has no ask peek' } });
});

test('It refuses a memory opened with keys that derive another bound: the bound refuses a memory another set of keys wrote', async () => {
  const network = new FakeNetwork();
  const first = await BenchGround.open({ network, host: 'first', modules });
  assert.ok((await first.add('house', 'house', { memory: { faculty: 'fake' } })).ward !== undefined);
  // A second ground, with its own seeds, handed the memory of the first's house.
  const registry: Registry = { faculties: { shared: { up: () => ({ serves: 'memory', house: () => first.machine.memoryOf('house') }) } } };
  const second = await BenchGround.open({ network, host: 'second', modules, registry });
  await second.hand({ method: 'facultiesAdd', args: { name: 'shared', make: 'shared' } });
  assert.match((await second.add('house', { memory: { faculty: 'shared' }, classes: { faculty: 'module', name: 'house' } })).why ?? '', /bound to other keys/);
});

test('A restart loses nothing that landed', async () => {
  const { ground, being, bear, result } = await open();
  await bear('org.example.counter', 'c', { start: 7 });
  await ground.down();
  await ground.up();
  assert.equal(await being('c', 'peek'), 7);
  assert.equal(await result('count'), 1);
});

test('Where memory refuses a write, the ask answers nothing', async () => {
  const { ground, ask, result } = await open();
  ground.machine.memoryOf('house').refuseNext();
  assert.deepEqual(await ask({ method: 'bear', args: { kind: 'org.example.counter', id: 'c' } }), { error: { message: 'the house answered nothing' } });
  assert.equal(await result('count'), 0);
});
