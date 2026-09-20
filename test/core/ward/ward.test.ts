// SPDX-License-Identifier: Apache-2.0
// Wards with beings, inside one ward and across wards.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Invitation, JsonObject } from '../../../src/core/being/index.ts';
import { Ward } from '../../../src/core/ward/index.ts';
import { holds } from '../../claims.ts';
import { Classes, Guest, HandClock, Host, said, Wards } from './beings.ts';
import type { Clock } from '../../../src/core/contract/index.ts';
import { TestWard } from '../classes.ts';

const WARD = TestWard.kind;

const root = async (wards: Wards, name: string, method?: string, args?: JsonObject) => said(await wards.house(name).root(method, args)) as JsonObject;

// Alice's ward holds a Host, Bob's a Guest who took an invitation on her.
const pair = async (clock?: Clock) => {
  const wards = new Wards(clock);
  await wards.stand('alice');
  await wards.stand('bob');
  await root(wards, 'alice', 'boot', { key: 'host', class: 'org.example.host' });
  await root(wards, 'bob', 'boot', { key: 'guest', class: 'org.example.guest' });
  const invitation = await root(wards, 'alice', 'invite', { being: 'host', id: 'bob' });
  const joined = await root(wards, 'bob', 'ask', { being: 'guest', method: 'join', args: { invitation } });
  return { wards, joined };
};
const go = async (wards: Wards, args: JsonObject = {}) => ((await root(wards, 'bob', 'ask', { being: 'guest', method: 'go', args })).answer as JsonObject).said;

test('[ward] a ward alone answers through its ward, to the owner alone', async () => {
  const wards = new Wards();
  const ward = await wards.stand('alice');
  const described = await root(wards, 'alice');
  assert.deepEqual(described.notes, { pk: ward.pk, class: WARD, beings: {} });
  assert.deepEqual((described.asks as { name: string }[]).map((a) => a.name), ['boot', 'unboot', 'public', 'invite', 'ask', 'own', 'disown', 'become', 'hold', 'pilot', 'drop']);
  assert.deepEqual(ward.ward.describe({}), { asks: [], notes: {} });
  assert.deepEqual(said(await ward.ward.answer({ id: 'x' }, 'boot', { key: 'k', class: 'org.example.host' })), { error: 'unknown ask' });
});

// What the ward of bob's house holds under a name, asked as its owner.
const pilotOf = (wards: Wards, name: string) => async (method?: string, args?: JsonObject) => {
  const out = await root(wards, 'bob', 'pilot', { name, ...(method === undefined ? {} : { method }), ...(args === undefined ? {} : { args }) });
  return 'answer' in out ? out.answer : out;
};

test(holds('owner.pilots', 'ward: an owner pilots a ward from another ward, and only the root makes or ends one'), async () => {
  const wards = new Wards();
  const alice = await wards.stand('alice');
  await wards.stand('bob');
  const pilot = pilotOf(wards, 'alice');

  const invitation = await root(wards, 'alice', 'own', { id: 'bob' });
  assert.deepEqual(await root(wards, 'alice', 'own', { id: 'bob' }), { error: 'id taken' });
  assert.deepEqual(await root(wards, 'bob', 'hold', { name: 'alice', invitation }), { held: 'alice', ward: alice.pk });

  assert.deepEqual(await pilot('boot', { key: 'host', class: 'org.example.host' }), { booted: 'host' });
  assert.deepEqual(await pilot('ask', { being: 'host', method: 'greet' }), { answer: { hello: 'OWNER', args: {} } });
  assert.deepEqual(((await pilot()) as JsonObject).notes, { pk: alice.pk, class: WARD, beings: { host: { class: 'org.example.host', public: false, absent: false } } });
  assert.deepEqual(await pilot('own', { id: 'eve' }), { error: 'unknown ask' });
  assert.deepEqual(await pilot('disown', { id: 'bob' }), { error: 'unknown ask' });
  assert.deepEqual(((await pilot()) as { asks: { name: string }[] }).asks.map((a) => a.name), ['boot', 'unboot', 'public', 'invite', 'ask', 'become', 'hold', 'pilot', 'drop']);

  assert.deepEqual(await root(wards, 'alice', 'disown', { id: 'nobody' }), { error: 'no such owner' });
  assert.deepEqual(await root(wards, 'alice', 'disown', { id: 'bob' }), { disowned: 'bob' });
  assert.deepEqual(await pilot('boot', { key: 'other', class: 'org.example.host' }), { error: 'removed' });
});

test(holds('ward.hold', 'ward: a ward holds far beings of any kind under names, pilots each, and lets each go alone'), async () => {
  const wards = new Wards();
  await wards.stand('alice');
  await wards.stand('bob');
  await root(wards, 'alice', 'boot', { key: 'host', class: 'org.example.host' });
  const [host, ward] = [pilotOf(wards, 'host'), pilotOf(wards, 'alice')];

  assert.deepEqual(await host(), { error: 'host is not held' });
  assert.deepEqual(await root(wards, 'bob', 'drop', { name: 'host' }), { error: 'host is not held' });
  assert.deepEqual(await root(wards, 'bob', 'hold', { name: 'host', invitation: 'x' }), { error: 'no invitation' });
  assert.deepEqual(await root(wards, 'bob', 'hold', { name: 7, invitation: {} }), { error: 'name is text' });
  assert.deepEqual(await root(wards, 'bob', 'pilot', { name: 'host', method: 1 }), { error: 'name and method are text, args an object' });

  const onHost = await root(wards, 'alice', 'invite', { being: 'host', id: 'bob', notes: { owner: true } });
  const onWard = await root(wards, 'alice', 'own', { id: 'bob' });
  assert.deepEqual(await root(wards, 'bob', 'hold', { name: 'host', invitation: onHost }), { held: 'host', ward: wards.house('alice').pk }, 'a being that is no ward');
  assert.deepEqual(await root(wards, 'bob', 'hold', { name: 'host', invitation: onWard }), { error: 'host is held' });
  assert.deepEqual(await root(wards, 'bob', 'hold', { name: 'alice', invitation: onWard }), { held: 'alice', ward: wards.house('alice').pk }, 'a second name beside the first');

  assert.deepEqual(await host('greet', { a: 1 }), { hello: 'bob', args: { a: 1 } }, 'the far being answers her own asks');
  assert.deepEqual(await ward('ask', { being: 'host', method: 'greet' }), { answer: { hello: 'OWNER', args: {} } }, 'the far ward answers its owner');
  assert.deepEqual(await root(wards, 'bob', 'drop', { name: 'host' }), { dropped: 'host' });
  assert.deepEqual(await host('greet'), { error: 'host is not held' });
  assert.deepEqual(((await ward()) as JsonObject).notes, { pk: wards.house('alice').pk, class: WARD, beings: { host: { class: 'org.example.host', public: false, absent: false } } }, 'the other hold stands');
});

test(holds('root.through-ward', 'ward: the root boots beings and refuses what cannot stand'), async () => {
  const wards = new Wards();
  await wards.stand('alice');
  assert.deepEqual(await root(wards, 'alice', 'boot', { key: 'host', class: 'org.example.host' }), { booted: 'host' });
  assert.deepEqual(await root(wards, 'alice', 'boot', { key: 'host', class: 'org.example.host' }), { error: 'key taken' });
  assert.deepEqual(await root(wards, 'alice', 'boot', { key: 'ward', class: 'org.example.host' }), { error: 'key taken' });
  assert.deepEqual(await root(wards, 'alice', 'boot', { key: 'x', class: 'org.example.nobody' }), { error: 'no such class' });
  assert.deepEqual((await root(wards, 'alice')).notes, { pk: wards.house('alice').pk, class: WARD, beings: { host: { class: 'org.example.host', public: false, absent: false } } });
});

test('[ward] a class that throws at birth stands nowhere, and the root asks only with text', async () => {
  const wards = new Wards();
  await wards.stand('alice');
  assert.deepEqual(await root(wards, 'alice', 'boot', { key: 't', class: 'org.example.thrower' }), { error: 'threw at birth' });
  assert.equal(wards.house('alice').partition.being('t'), undefined);
  for (const [method, args, error] of [
    ['boot', { key: 1 }, 'key and class are text'],
    ['unboot', { being: 'nobody' }, 'no such being'],
    ['public', { key: 1 }, 'key is text or null'],
    ['invite', { being: 1 }, 'being and id are text, notes an object'],
    ['invite', { being: 'nobody', id: 'x' }, 'not invited'],
    ['ask', { being: 1 }, 'being and method are text, args an object'],
    ['ask', {}, 'unreached'],
    ['own', { id: 1 }, 'id is text'],
  ] as const) {
    assert.deepEqual(await root(wards, 'alice', method, args), { error }, `${method} ${JSON.stringify(args)}`);
  }
});

test('[ward] a boot whose relation to its maker cannot be made makes nobody', async () => {
  const wards = new Wards();
  await wards.stand('alice');
  await root(wards, 'alice', 'boot', { key: 'guest', class: 'org.example.guest' });
  const make = async (key: string) => (await root(wards, 'alice', 'ask', { being: 'guest', method: 'make', args: { key } })).answer;
  assert.deepEqual(await make('one'), { made: 'one' });
  assert.deepEqual(await make('two'), { made: null });
  assert.equal(wards.house('alice').partition.being('two'), undefined);
});

test('[ward] a being drops a standing once, and two invites under one id make one occupant', async () => {
  const { wards } = await pair();
  const ask = async (method: string) => (await root(wards, 'bob', 'ask', { being: 'guest', method })).answer;
  assert.deepEqual(await ask('race'), { invited: 1, ids: ['same'], removed: true, again: false });
  assert.deepEqual(await ask('drop'), { dropped: true, again: false });
  assert.deepEqual(await go(wards), 'no host');
});

test('[ward] a being in one ward asks a being in another through a relation', async () => {
  const { wards, joined } = await pair();
  assert.deepEqual(joined, { answer: { joined: 'host' } });
  assert.deepEqual(await go(wards, { args: { n: 1 } }), { hello: 'bob', args: { n: 1 } });
  assert.deepEqual(await go(wards), { hello: 'bob', args: {} });
});

test(holds('ask.inside-ward', 'ward: two beings of one ward speak with no box, and no box speaks under their heir'), async () => {
  const wards = new Wards();
  const alice = await wards.stand('alice');
  await wards.stand('bob');
  const door = alice.door;
  const arrive = door.arrive.bind(door);
  let boxes = 0;
  door.arrive = (bytes) => {
    boxes += 1;
    return arrive(bytes);
  };
  await root(wards, 'alice', 'boot', { key: 'guest', class: 'org.example.guest' });
  assert.deepEqual(await root(wards, 'alice', 'ask', { being: 'guest', method: 'make', args: { key: 'made' } }), { answer: { made: 'made' } });
  assert.deepEqual(await root(wards, 'alice', 'ask', { being: 'guest', method: 'go' }), { answer: { said: { hello: 'guest', args: {} } } });

  await root(wards, 'alice', 'boot', { key: 'host', class: 'org.example.host' });
  await root(wards, 'alice', 'boot', { key: 'other', class: 'org.example.guest' });
  await root(wards, 'bob', 'boot', { key: 'guest', class: 'org.example.guest' });
  const invitation = await root(wards, 'alice', 'invite', { being: 'host', id: 'other' });
  assert.deepEqual(await root(wards, 'alice', 'ask', { being: 'other', method: 'join', args: { invitation } }), { answer: { joined: 'host' } });
  assert.equal(boxes, 0, 'no ask inside the ward reached the door');
  assert.deepEqual(await root(wards, 'bob', 'ask', { being: 'guest', method: 'join', args: { invitation } }), { answer: { joined: null } }, 'a knock under an heir taken inside is silence');
  assert.deepEqual(await root(wards, 'alice', 'ask', { being: 'other', method: 'join', args: { invitation } }), { answer: { joined: null } }, 'an heir is taken inside once');

  const again = await wards.stand('alice');
  assert.deepEqual(await root(wards, 'alice', 'ask', { being: 'other', method: 'go', args: { args: { n: 1 } } }), { answer: { said: { hello: 'other', args: { n: 1 } } } }, 'the relation stands after a restart');
  assert.deepEqual(again.partition.being('host')?.cells, { greeted: ['other'] });
  await root(wards, 'alice', 'unboot', { being: 'host' });
  assert.deepEqual(await root(wards, 'alice', 'ask', { being: 'other', method: 'go' }), { answer: { said: 'removed' } });
});

test('[ward] a take inside the ward that brings no object leaves the heir fresh', async () => {
  const wards = new Wards();
  await wards.stand('alice');
  await root(wards, 'alice', 'boot', { key: 'host', class: 'org.example.host' });
  await root(wards, 'alice', 'boot', { key: 'guest', class: 'org.example.guest' });
  const invitation = (await root(wards, 'alice', 'invite', { being: 'host', id: 'guest' })) as unknown as Invitation;
  wards.catalogue = new Classes(Guest);
  const alice = await wards.stand('alice');
  assert.deepEqual(await root(wards, 'alice', 'ask', { being: 'guest', method: 'join', args: { invitation } }), { answer: { joined: null } });
  assert.deepEqual(alice.door.relations.get(invitation.heir), { state: 'fresh' });
  assert.equal(alice.partition.head.bind[invitation.heir]?.inside, undefined);
  wards.catalogue = new Classes(Host, Guest);
  await wards.stand('alice');
  assert.deepEqual(await root(wards, 'alice', 'ask', { being: 'guest', method: 'join', args: { invitation } }), { answer: { joined: 'host' } });
});

test(holds('onion.beings-from-rows', 'ward: a restart unpacks every being from her row, and relations still speak'), async () => {
  const { wards } = await pair();
  await go(wards);
  await wards.stand('alice');
  await wards.stand('bob');
  assert.deepEqual(await go(wards), { hello: 'bob', args: {} });
  assert.deepEqual(wards.house('alice').partition.being('host')?.cells, { greeted: ['bob', 'bob'] });
});

// A ward that lends her own beings what she was handed to offer, and
// writes down each offer withdrawn, as the dock lends and withdraws.
class Lending extends Ward {
  static override readonly kind: string = 'org.example.lending';
  static offered: Invitation | null = null;
  static readonly withdrawn: [string, string][] = [];
  offer(): Promise<Invitation | null> {
    return Promise.resolve(Lending.offered);
  }
  withdraw(contract: string, heir: string): Promise<void> {
    Lending.withdrawn.push([contract, heir]);
    return Promise.resolve();
  }
}

test(holds('dock.retract', 'ward: an offer a being could not take is withdrawn from the ward that lent it'), async () => {
  const wards = new Wards();
  wards.catalogue = new Classes(Host, Guest, Lending);
  await wards.stand('alice');
  const bob = await wards.stand('bob');
  await root(wards, 'bob', 'boot', { key: 'host', class: 'org.example.host' });
  Lending.offered = (await root(wards, 'bob', 'invite', { being: 'host', id: 'alice' })) as unknown as Invitation;
  assert.deepEqual(await root(wards, 'alice', 'become', { class: Lending.kind }), { became: Lending.kind });
  await root(wards, 'alice', 'boot', { key: 'guest', class: 'org.example.guest' });
  wards.cut.add(bob.pk);
  assert.deepEqual(await root(wards, 'alice', 'ask', { being: 'guest', method: 'borrow' }), { answer: { lent: null } });
  assert.deepEqual(Lending.withdrawn, [['org.example.borrowed', Lending.offered.heir]]);
});

test(holds('being.absent', 'ward: a class the catalogue lacks leaves that being absent, and the ward stands'), async () => {
  const { wards } = await pair();
  wards.catalogue = new Classes(Guest);
  await wards.stand('alice');
  assert.deepEqual((await root(wards, 'alice')).notes, { pk: wards.house('alice').pk, class: WARD, beings: { host: { class: 'org.example.host', public: false, absent: true } } });
  assert.deepEqual(await go(wards), 'silence');
  wards.catalogue = new Classes(Host, Guest);
  await wards.stand('alice');
  assert.deepEqual(await go(wards), { hello: 'bob', args: {} });
});

test(holds('words.never-cross', 'ward: a throw, a kit word, a value JSON cannot hold, and an undeclared ask'), async () => {
  const { wards } = await pair();
  assert.equal(await go(wards, { method: 'broken' }), 'silence');
  assert.equal(await go(wards, { method: 'told' }), 'silence', 'a kit word a being returns never crosses the door');
  assert.equal(await go(wards, { method: 'odd' }), 'silence');
  assert.deepEqual(await go(wards, { method: 'nope' }), { error: 'unknown ask' });
  assert.deepEqual(await go(wards), { hello: 'bob', args: {} });
});

test('[ward] a being that writes what her cells cannot keep is silent, and keeps what she wrote before', async () => {
  const { wards } = await pair();
  assert.equal(await go(wards, { method: 'keep' }), 'silence');
  assert.deepEqual(wards.house('alice').partition.being('host')?.cells, { greeted: ['kept'] });
});

test(holds('cells.put-back', 'ward: a memory that refuses to keep puts back what the being wrote, and her answer is silence'), async () => {
  const { wards } = await pair();
  wards.memory.refused.add('alice');
  assert.equal(await go(wards), 'silence');
  assert.deepEqual(wards.house('alice').partition.being('host')?.cells, { greeted: [] });
  wards.memory.refused.clear();
  assert.deepEqual(await go(wards), { hello: 'bob', args: {} });
  assert.deepEqual(wards.house('alice').partition.being('host')?.cells, { greeted: ['bob'] });
});

test('[ward] a take whose knock lost its reply still takes the relation', async () => {
  const wards = new Wards();
  await wards.stand('alice');
  await wards.stand('bob');
  await root(wards, 'alice', 'boot', { key: 'host', class: 'org.example.host' });
  await root(wards, 'bob', 'boot', { key: 'guest', class: 'org.example.guest' });
  const invitation = await root(wards, 'alice', 'invite', { being: 'host', id: 'bob' });
  wards.lose = 1;
  assert.deepEqual(await root(wards, 'bob', 'ask', { being: 'guest', method: 'join', args: { invitation } }), { answer: { joined: 'host' } });
  assert.deepEqual(await go(wards), { hello: 'bob', args: {} });
});

test(holds('ask.late', 'ward: an ask that outlives its allowance is late, and the relation still speaks'), async () => {
  const clock = new HandClock();
  const { wards } = await pair(clock);
  const entered = new Promise<void>((resolve) => (Host.entered = resolve));
  try {
    const asked = go(wards, { method: 'slow' });
    // The ask reached the being who will never answer; now its allowance
    // runs out.
    await entered;
    clock.ring();
    assert.equal(await asked, 'late');
  } finally {
    Host.entered = undefined;
  }
  assert.deepEqual(await go(wards), { hello: 'bob', args: {} });
});

test(holds('root.unboot', 'ward: an unbooted being is removed to whoever held a relation on her'), async () => {
  const { wards } = await pair();
  await go(wards);
  assert.deepEqual(await root(wards, 'alice', 'unboot', { being: 'host' }), { unbooted: 'host' });
  assert.equal(await go(wards), 'removed');
});

test(holds('ask.unreached', 'ward: a cut route is unreached'), async () => {
  const { wards } = await pair();
  wards.cut.add(wards.house('alice').pk);
  assert.equal(await go(wards), 'unreached');
  wards.cut.clear();
  assert.deepEqual(await go(wards), { hello: 'bob', args: {} });
});

test(holds('root.ask-public', 'ward: the root asks the public being as nobody'), async () => {
  const { wards } = await pair();
  assert.deepEqual(await root(wards, 'alice', 'public', { key: 'host' }), { public: 'host' });
  assert.deepEqual(await root(wards, 'alice', 'ask', { method: 'greet' }), { answer: { hello: null, args: {} } });
  assert.deepEqual(await root(wards, 'alice', 'public', { key: 'nobody' }), { error: 'no such being' });
});
