// Bob mints a paper, and Alice's owner lands it through the hand alone.
// Bob lives in one house on ground one. Alice lives in his house, in
// another house on his ground, or on another ground in this process. Her
// owner either knows her already, or has the steward bear her for the
// paper. Then the steward hands her the paper, which she takes, and she
// greets Bob through it. Alice on a ground of its own process is
// `deep/node/invite.test.ts`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { being, groundOne, hand, land } from '../fixtures/node/grounds.ts';
import { beforehand, bobIn, landIn, placed } from '../fixtures/node/invite.ts';

for (const alice of ['known', 'newborn'] as const) {
  test(`Alice in Bob's house, ${alice}: the paper binds inside the house, and nothing is carried`, async (t) => {
    const ground = await groundOne(t);
    const house = await ground.open('a');
    const mint = await bobIn(house);
    await beforehand(house.ask, alice);
    await landIn(house.ask, await mint('for-alice'), alice);
    await placed(house.ask, house.ask, 'for-alice');
    assert.equal(ground.carry.sends, 0);
  });

  test(`Alice in another house on Bob's ground, ${alice}: her asks reach Bob by pointer`, async (t) => {
    const ground = await groundOne(t);
    const bobs = await ground.open('a');
    const hers = await ground.open('b');
    const mint = await bobIn(bobs);
    await beforehand(hers.ask, alice);
    await landIn(hers.ask, await mint('for-alice'), alice);
    await placed(bobs.ask, hers.ask, 'for-alice');
    assert.ok(ground.carry.sends > 0, 'her asks went through the carry, which dials no loopback address');
  });

  test(`Alice on another ground, ${alice}: her owner there lands the paper, and her asks reach Bob over TCP`, async (t) => {
    const ground = await groundOne(t);
    const bobs = await ground.open('a');
    const mint = await bobIn(bobs);
    const { ask: hers } = await (await groundOne(t, { dials: true })).open('main');
    await beforehand(hers, alice);
    await landIn(hers, await mint('for-alice'), alice);
    await placed(bobs.ask, hers, 'for-alice');
    assert.ok(ground.heard.tcp > 0, 'Bob’s TCP listener took her asks');
    assert.equal(ground.heard.http, 0, 'TCP comes first in his paper, and answered');
  });
}

test('Bob handed his own paper takes no standing on himself, and the owner hears why', async (t) => {
  const ground = await groundOne(t);
  const house = await ground.open('a');
  const mint = await bobIn(house);
  assert.deepEqual(await house.ask({ id: 'bob', method: 'accept', args: { invitation: await mint('for-bob') } }), { error: { message: 'she takes no invitation to herself' } });
  assert.deepEqual(await being(house.ask, 'bob', 'standingsList'), []);
});

test('Alice handed the same paper twice holds one standing', async (t) => {
  const ground = await groundOne(t);
  const bobs = await ground.open('a');
  const hers = await ground.open('b');
  const given = await (await bobIn(bobs))('for-alice');
  await hand(hers.ask, 'bear', { kind: 'org.example.guest', id: 'alice' });
  await land(hers.ask, given, 'alice');
  await land(hers.ask, given, 'alice');
  assert.equal((await being(hers.ask, 'alice', 'standingsList')).length, 1);
  assert.equal(await being(hers.ask, 'alice', 'greetHost'), 'bob greets for-alice');
});
