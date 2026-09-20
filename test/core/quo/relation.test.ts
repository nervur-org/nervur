// SPDX-License-Identifier: Apache-2.0
// Relations between wards, on the thinnest world: doors reached by pk.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { holds } from '../../claims.ts';
import { Holder, objectOf, Scene } from './scene.ts';

test('[relation] a knock binds, and every ask after it is answered and moves the keys', async () => {
  const scene = new Scene();
  const alice = await scene.ward('alice');
  const { heir, invitation } = await alice.door.invite();
  const bob = new Holder(scene, invitation);
  assert.deepEqual(objectOf(await bob.ask('hello', { n: 1 })), { heir, args: { n: 1 } });
  const bound = alice.relations.get(heir);
  assert.equal(bound?.state, 'spent');
  for (let n = 2; n <= 5; n += 1) assert.deepEqual(objectOf(await bob.ask('again', { n })), { heir, args: { n } });
  const now = alice.relations.get(heir);
  assert.ok(now?.state === 'spent' && now.highest === 5);
  assert.notEqual(now.held, bound.state === 'spent' ? bound.held : '');
});

test('[relation] three wards hold relations both ways and none crosses another', async () => {
  const scene = new Scene();
  const [a, b, c] = [await scene.ward('a'), await scene.ward('b'), await scene.ward('c')];
  const ab = await a.door.invite();
  const ac = await a.door.invite();
  const ba = await b.door.invite();
  const toA = { fromB: new Holder(scene, ab.invitation), fromC: new Holder(scene, ac.invitation) };
  const toB = new Holder(scene, ba.invitation);
  for (let n = 1; n <= 3; n += 1) {
    assert.deepEqual(objectOf(await toA.fromB.ask('m', { n })), { heir: ab.heir, args: { n } });
    assert.deepEqual(objectOf(await toB.ask('m', { n })), { heir: ba.heir, args: { n } });
    assert.deepEqual(objectOf(await toA.fromC.ask('m', { n })), { heir: ac.heir, args: { n } });
  }
  assert.equal(c.behind.heard.length, 0);
  assert.equal(b.behind.heard.length, 3);
});

test(holds('knock.recovered', 'relation: a knock whose reply was lost is found bound by asking under its own key'), async () => {
  const scene = new Scene();
  const alice = await scene.ward('alice');
  const { heir, invitation } = await alice.door.invite();
  const bob = new Holder(scene, invitation);
  scene.weather('lose reply');
  assert.deepEqual(await bob.ask('hello'), { nothing: true });
  assert.equal(alice.relations.get(heir)?.state, 'spent');
  assert.deepEqual(objectOf(await bob.ask('again')), { heir, args: {} });
  assert.deepEqual(objectOf(await bob.ask('after')), { heir, args: {} });
});

test('[relation] a knock that never arrived is knocked again as the same bytes', async () => {
  const scene = new Scene();
  const alice = await scene.ward('alice');
  const { heir, invitation } = await alice.door.invite();
  const bob = new Holder(scene, invitation);
  scene.weather('lose ask');
  assert.deepEqual(await bob.ask('hello'), { nothing: true });
  const knock = bob.last!.bytes;
  assert.deepEqual(await bob.ask('probe'), { silence: true });
  assert.deepEqual(objectOf(await bob.ask('ignored')), { heir, args: {} });
  assert.deepEqual(bob.last!.bytes, knock);
  assert.deepEqual(objectOf(await bob.ask('after', { n: 9 })), { heir, args: { n: 9 } });
});

test('[relation] the same box twice is answered repeated the second time', async () => {
  const scene = new Scene();
  const alice = await scene.ward('alice');
  const { invitation } = await alice.door.invite();
  const bob = new Holder(scene, invitation);
  await bob.ask('hello');
  const sent = await bob.standing.ask('once');
  scene.weather('twice');
  const { reply, twice } = await scene.carry(invitation.ward, sent!.bytes);
  assert.deepEqual(objectOf(await bob.standing.read(sent!, reply)), { heir: invitation.heir, args: {} });
  assert.deepEqual(await bob.standing.read(sent!, twice!), { quo: 'repeated' });
});

test('[relation] a knock sent twice binds once, and the second is a stranger', async () => {
  const scene = new Scene();
  const alice = await scene.ward('alice');
  const { invitation } = await alice.door.invite();
  const bob = new Holder(scene, invitation);
  scene.weather('twice');
  const sent = await bob.standing.ask('hello');
  const { reply, twice } = await scene.carry(invitation.ward, sent!.bytes);
  assert.deepEqual(objectOf(await bob.standing.read(sent!, reply)), { heir: invitation.heir, args: {} });
  assert.deepEqual(await bob.standing.read(sent!, twice!), { silence: true });
});

test('[relation] a removed relation hears removed, and a removed fresh heir is a stranger', async () => {
  const scene = new Scene();
  const alice = await scene.ward('alice');
  const spoken = await alice.door.invite();
  const unspoken = await alice.door.invite();
  const bob = new Holder(scene, spoken.invitation);
  await bob.ask('hello');
  assert.ok(alice.door.remove(spoken.heir));
  assert.ok(alice.door.remove(unspoken.heir));
  assert.equal(alice.relations.get(unspoken.heir), undefined);
  assert.deepEqual(await bob.ask('again'), { quo: 'removed' });
  assert.deepEqual(await new Holder(scene, unspoken.invitation).ask('hello'), { silence: true });
});

test('[relation] a silence moves the door and not the standing, and the relation still speaks', async () => {
  const scene = new Scene();
  const alice = await scene.ward('alice');
  const { heir, invitation } = await alice.door.invite();
  const bob = new Holder(scene, invitation);
  await bob.ask('hello');
  alice.behind.silent.add(heir);
  const key = bob.standing.state.key;
  assert.deepEqual(await bob.ask('quiet'), { silence: true });
  assert.deepEqual(await bob.ask('quiet'), { silence: true });
  assert.equal(bob.standing.state.key, key);
  alice.behind.silent.delete(heir);
  assert.deepEqual(objectOf(await bob.ask('loud')), { heir, args: {} });
  assert.notEqual(bob.standing.state.key, key);
});

test('[relation] a cut route is nothing, and the relation speaks when it heals', async () => {
  const scene = new Scene();
  const alice = await scene.ward('alice');
  const { heir, invitation } = await alice.door.invite();
  const bob = new Holder(scene, invitation);
  await bob.ask('hello');
  scene.cut.add('alice');
  assert.deepEqual(await bob.ask('lost'), { nothing: true });
  scene.cut.delete('alice');
  assert.deepEqual(objectOf(await bob.ask('found')), { heir, args: {} });
});

test('[relation] an invitation taken by another ward speaks only for whoever knocked first', async () => {
  const scene = new Scene();
  const alice = await scene.ward('alice');
  const { heir, invitation } = await alice.door.invite();
  const bob = new Holder(scene, invitation);
  const eve = new Holder(scene, invitation);
  assert.deepEqual(objectOf(await bob.ask('hello')), { heir, args: {} });
  assert.deepEqual(await eve.ask('hello'), { silence: true });
  assert.deepEqual(objectOf(await bob.ask('still')), { heir, args: {} });
});
