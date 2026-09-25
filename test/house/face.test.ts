// A face's token reaches its whole occupant: asked with a method, it asks
// what that occupant may ask; asked with none, it reads her describe. A
// handle's token stays admitted to its one ask.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BenchGround, FakeNetwork } from 'nervur/bench';
import * as desk from '../fixtures/world/desk.ts';
import * as home from '../fixtures/world/home.ts';
import { Front, FrontBlueprint } from '../fixtures/world/front.ts';

const open = async (t: { after(done: () => unknown): void }) => {
  const front = new Front();
  const ground = await BenchGround.open({
    network: new FakeNetwork(),
    host: 'desk',
    modules: { desk },
    faculties: { front: { blueprint: FrontBlueprint, object: front, handler: front.handler } },
  });
  t.after(() => ground.down());
  await ground.add('desk', 'desk', { faculties: ['front'] });
  assert.deepEqual(await ground.ask({ house: 'desk', method: 'arm' }), { result: null });
  return { ground, front };
};

test('A face is told its house opened, so a door’s token answers after a restart before any being calls the face', async (t) => {
  const network = new FakeNetwork();
  const bodyOf = (front: Front) => ({ blueprint: FrontBlueprint, object: front, handler: front.handler, opened: (context: Parameters<Front['opened']>[0]) => front.opened(context) });
  const armed = new Front();
  const first = await BenchGround.open({ network, host: 'desk', modules: { desk }, faculties: { front: bodyOf(armed) } });
  await first.add('desk', 'desk', { faculties: ['front'] });
  await first.ask({ house: 'desk', method: 'arm' });
  const alice = await armed.signup('alice');
  assert.deepEqual(await armed.ask(alice, 'bump'), { result: null });
  await first.down();

  // The same ground on its machine, with a face no being has called: the steward never arms it again.
  const fresh = new Front();
  const second = await BenchGround.open({ network, host: 'desk', modules: { desk }, faculties: { front: bodyOf(fresh) }, machine: first.machine });
  t.after(() => second.down());
  assert.deepEqual(await fresh.ask(alice, 'hello'), { result: 'hello, web' }, 'her door answers at once');
  const bearer = await second.fetch(new Request('https://desk.example/hello', { method: 'POST', headers: { authorization: `Bearer ${alice}` }, body: '{}' }));
  assert.deepEqual(await bearer.json(), { result: 'hello, web' }, 'and on the listener');
  // Each call's id is drawn afresh, so a call of this life never meets an answer an earlier life got.
  assert.deepEqual(await fresh.ask(alice, 'bump'), { result: null });
  assert.deepEqual(await fresh.ask(alice, 'count'), { result: 2 }, 'both bumps acted');
});

test('A face’s token lists and asks every ask its occupant may, and nothing more', async (t) => {
  const { front } = await open(t);
  const alice = await front.signup('alice');

  const described = await front.describe(alice);
  assert.ok('describe' in described, JSON.stringify(described));
  const asks = (described.describe as { asks: { method: string }[] }).asks.map(({ method }) => method).sort();
  assert.deepEqual(asks, ['bump', 'connect', 'count', 'hello', 'leave', 'who'], 'the auditor’s ask is not shown to a person');

  assert.deepEqual(await front.ask(alice, 'hello'), { result: 'hello, web' });
  assert.deepEqual(await front.ask(alice, 'audit'), { error: { message: 'no such ask' } });
  assert.deepEqual(await front.ask(alice, undefined), { error: { message: 'a call on an occupant names its method' } });
  assert.deepEqual(await front.ask('00'.repeat(16), 'hello'), { error: { message: 'no such token' } });
});

test('A face answers HTTP on the bench’s listener, a bearer token its door', async (t) => {
  const { ground, front } = await open(t);
  const alice = await front.signup('alice');
  const bearer = { authorization: `Bearer ${alice}` };

  const described = (await (await ground.fetch(new Request('https://desk.example/', { headers: bearer }))).json()) as { describe: { asks: unknown[] } };
  assert.equal(described.describe.asks.length, 6);
  const hello = await ground.fetch(new Request('https://desk.example/hello', { method: 'POST', headers: bearer, body: '{}' }));
  assert.deepEqual(await hello.json(), { result: 'hello, web' });
  assert.equal((await ground.fetch(new Request('https://desk.example/'))).status, 401, 'no token, no door');
});

test('A face watches through a token, and hears the change the moment it lands', async (t) => {
  const { front } = await open(t);
  const alice = await front.signup('alice');
  const seen = await front.ask(alice, 'count');
  assert.deepEqual(seen, { result: 0 });

  const watching = front.ask(alice, 'count', {}, seen);
  assert.deepEqual(await front.ask(alice, 'bump'), { result: null });
  assert.deepEqual(await watching, { result: 1 });
});

test('A door carried home is taken by a far house, and the face’s token is let go', async (t) => {
  const network = new FakeNetwork();
  const front = new Front();
  const shop = await BenchGround.open({ network, host: 'desk', names: ['desk.example'], modules: { desk }, faculties: { front: { blueprint: FrontBlueprint, object: front } } });
  t.after(() => shop.down());
  await shop.add('desk', 'desk', { faculties: ['front'] });
  await shop.ask({ house: 'desk', method: 'arm' });
  const phone = await BenchGround.open({ network, host: 'alice', modules: { home } });
  t.after(() => phone.down());
  await phone.add('home');
  await phone.ask({ house: 'home', method: 'bear', args: { kind: 'org.example.avatar', id: 'avatar' } });

  const browser = await front.signup('alice');
  const carried = await front.carryHome(browser, 'connect');
  assert.ok('result' in carried, JSON.stringify(carried));
  const { door } = carried.result as { door: string };
  assert.ok(door.length > 64, 'the door leaves as invitation bytes, not a token');

  assert.ok('result' in (await phone.ask({ house: 'home', id: 'avatar', method: 'accept', args: { invitation: door } })));
  assert.deepEqual(await phone.ask({ house: 'home', id: 'avatar', method: 'greet' }), { result: 'hello, door-1' }, 'her house reaches the same member');
  assert.deepEqual(await front.ask(browser, 'leave'), { result: null });
  assert.deepEqual(await front.ask(browser, 'hello'), { error: { message: 'no such token' } });
  assert.deepEqual(await phone.ask({ house: 'home', id: 'avatar', method: 'greet' }), { result: 'hello, door-1' }, 'her own door stands');
});

test('Her house asks the shop by what its describe shows, with no need declared, and meets its roles', async (t) => {
  const network = new FakeNetwork();
  const front = new Front();
  const shop = await BenchGround.open({ network, host: 'desk', names: ['desk.example'], modules: { desk }, faculties: { front: { blueprint: FrontBlueprint, object: front } } });
  t.after(() => shop.down());
  await shop.add('desk', 'desk', { faculties: ['front'] });
  await shop.ask({ house: 'desk', method: 'arm' });
  const phone = await BenchGround.open({ network, host: 'alice', modules: { home } });
  t.after(() => phone.down());
  await phone.add('home');
  await phone.ask({ house: 'home', method: 'bear', args: { kind: 'org.example.avatar', id: 'avatar' } });
  const browser = await front.signup('alice');
  const { door } = ((await front.carryHome(browser, 'connect')) as { result: { door: string } }).result;
  await phone.ask({ house: 'home', id: 'avatar', method: 'accept', args: { invitation: door } });
  const use = (method: string) => phone.ask({ house: 'home', id: 'avatar', method: 'use', args: { method } });

  assert.deepEqual(await phone.ask({ house: 'home', id: 'avatar', method: 'look' }), { result: ['bump', 'connect', 'count', 'hello', 'leave', 'who'] });
  assert.deepEqual(await use('hello'), { result: '"hello, door-1"' }, 'a readOnly ask is awaited');
  const audit = await use('audit');
  assert.ok('result' in audit && /^refused: audit is not in the describe she read/.test(audit.result as string), JSON.stringify(audit));
  const seen = await front.ask(browser, 'count');
  const watching = front.ask(browser, 'count', {}, seen);
  assert.deepEqual(await use('bump'), { result: '"sent"' }, 'an ask that is no idempotent one leaves as an effect');
  assert.deepEqual(await watching, { result: 1 }, 'the effect landed at the shop');
});

test('A door let go is no token, and a handle’s token keeps to its one ask', async (t) => {
  const { front } = await open(t);
  assert.deepEqual(await front.enrollAs('arm'), { error: { message: 'no such ask' } });
  const alice = await front.signup('alice');
  const bob = await front.signup('bob');
  assert.notEqual(alice, bob);

  assert.deepEqual(await front.ask(alice, 'leave'), { result: null });
  assert.deepEqual(await front.ask(alice, 'hello'), { error: { message: 'no such token' } });
  assert.deepEqual(await front.describe(alice), { error: { message: 'no such token' } });
  assert.deepEqual(await front.ask(bob, 'hello'), { result: 'hello, web' }, 'another door stands');
});
