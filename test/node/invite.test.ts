// Bob mints a paper, and Alice's owner lands it through the hand alone.
// Bob lives in one house on ground one. Alice lives in his house, in
// another house on his ground, or on ground two. Her owner either knows
// her already, or has the steward bear her for the paper. Then the steward
// hands her the paper, which she takes, and she greets Bob through it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { being, groundOne, groundTwo, hand, land, paper, type Ask } from '../fixtures/node/grounds.ts';

const bobIn = async (house: { ask: Ask }) => {
  await hand(house.ask, 'bear', { kind: 'org.example.host', id: 'bob' });
  return (occupant: string) => paper(house.ask, 'bob', occupant);
};

// Alice's owner lands the paper: in the Alice she knows, or in one born for it.
const landIn = async (ask: Ask, given: string, alice: 'known' | 'newborn') => {
  if (alice === 'known') assert.ok(((await hand(ask, 'beings')) as string[]).includes('alice'), 'the owner finds Alice by listing');
  else await hand(ask, 'bear', { kind: 'org.example.guest', id: 'alice' });
  await land(ask, given, 'alice');
};

// Alice's house before the paper: a bystander, and Alice where her owner knows her.
const beforehand = async (ask: Ask, alice: 'known' | 'newborn') => {
  await hand(ask, 'bear', { kind: 'org.example.guest', id: 'bystander' });
  if (alice === 'known') await hand(ask, 'bear', { kind: 'org.example.guest', id: 'alice' });
};

// Bob holds the occupant, Alice alone holds a standing, and her greeting reaches him.
const placed = async (bob: Ask, alice: Ask, occupant: string) => {
  assert.deepEqual(await being(bob, 'bob', 'occupantsList'), [occupant]);
  assert.equal((await being(alice, 'alice', 'standingsList')).length, 1, 'Alice holds the standing');
  assert.deepEqual(await being(alice, 'bystander', 'standingsList'), [], 'no other being of her house does');
  assert.equal(await being(alice, 'alice', 'greetHost'), `bob greets ${occupant}`);
};

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
    const { ask: hers } = await groundTwo(t);
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
