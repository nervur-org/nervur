// A being asks a far house's public being as a stranger, by its ward and
// its addresses. Her house signs for that ward with a key of its own for
// it, so every signup from one house lands on one member there.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BenchGround, FakeNetwork } from 'nervur/bench';
import * as desk from '../fixtures/world/desk.ts';
import { Front, FrontBlueprint } from '../fixtures/world/front.ts';
import * as home from '../fixtures/world/home.ts';

const MINUTE = 60_000;

test('Two signups from one house land on one member, and another house on its own', async (t) => {
  const network = new FakeNetwork();
  const front = { blueprint: FrontBlueprint, object: new Front() };
  const shop = await BenchGround.open({ network, host: 'desk', names: ['desk.example'], modules: { desk }, faculties: { front } });
  t.after(() => shop.down());
  const standing = await shop.add('desk', 'desk', { faculties: ['front'] });
  const { ward } = standing;
  assert.ok(ward !== undefined, standing.why ?? 'the desk did not open');
  const card = { ward, at: ['bench://desk.example'] };

  const homeOf = async (host: string) => {
    const ground = await BenchGround.open({ network, host, modules: { home } });
    t.after(() => ground.down());
    await ground.add('home');
    await ground.ask({ house: 'home', method: 'bear', args: { kind: 'org.example.avatar', id: 'avatar' } });
    const ask = async (method: string, args: Record<string, unknown>) => {
      const answered = await ground.ask({ house: 'home', id: 'avatar', method, args: args as never });
      assert.ok('result' in answered, JSON.stringify(answered));
      return answered.result as string;
    };
    return { join: () => ask('join', card), who: (standing: string) => ask('whoAt', { standing }) };
  };
  const alice = await homeOf('alice');
  const bob = await homeOf('bob');

  const first = await alice.join();
  // Past the lobby's ten minutes of replays, so the second signup runs again at the shop.
  await network.advance(11 * MINUTE);
  const second = await alice.join();
  assert.notEqual(first, second, 'each signup hands a door of its own');
  assert.equal(await alice.who(first), await alice.who(second), 'both doors reach one member');
  assert.notEqual(await bob.who(await bob.join()), await alice.who(first), 'another house is another member');
});

test('A being with no need declared reads what a public being shows a stranger, then asks it by name', async (t) => {
  const network = new FakeNetwork();
  const front = { blueprint: FrontBlueprint, object: new Front() };
  const shop = await BenchGround.open({ network, host: 'desk', names: ['desk.example'], modules: { desk }, faculties: { front } });
  t.after(() => shop.down());
  const { ward } = await shop.add('desk', 'desk', { faculties: ['front'] });
  const card = { ward: ward!, at: ['bench://desk.example'] };
  const alice = await BenchGround.open({ network, host: 'alice', modules: { home } });
  t.after(() => alice.down());
  await alice.add('home');
  await alice.ask({ house: 'home', method: 'bear', args: { kind: 'org.example.avatar', id: 'avatar' } });
  const ask = (method: string, args: Record<string, unknown>) => alice.ask({ house: 'home', id: 'avatar', method, args: args as never });

  assert.deepEqual(await ask('browse', card), { result: ['signup'] }, 'a stranger is shown the signup alone');
  assert.deepEqual(await ask('enter', { ...card, method: 'enroll' }), { result: 'refused: enroll is not in the describe she read of the public being' });
  assert.deepEqual(await ask('enter', { ...card, method: 'signup' }), { result: 'invitation' }, 'the signup answers by the schema its describe showed');
});

test('A stranger’s ask that is no idempotent one is refused before it leaves', async (t) => {
  const ground = await BenchGround.open({ network: new FakeNetwork(), host: 'alice', modules: { home } });
  t.after(() => ground.down());
  await ground.add('home');
  await ground.ask({ house: 'home', method: 'bear', args: { kind: 'org.example.avatar', id: 'avatar' } });
  assert.deepEqual(await ground.ask({ house: 'home', id: 'avatar', method: 'join', args: { ward: 'not a ward', at: [] } }), {
    error: { message: 'a public being is reached by its ward and its addresses' },
  });
});
