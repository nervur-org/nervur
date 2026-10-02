// The invitation's steps, shared by its fast half and its deep one. Bob
// mints a paper in his house, Alice's owner lands it in the Alice she knows
// or in one born for it, and what stands after is read from both sides.
import assert from 'node:assert/strict';
import { being, hand, land, paper, type Ask } from './grounds.ts';

/** Bob borne in a house, and his minting of a paper for an occupant. */
export const bobIn = async (house: { ask: Ask }) => {
  await hand(house.ask, 'bear', { kind: 'org.example.host', id: 'bob' });
  return (occupant: string) => paper(house.ask, 'bob', occupant);
};

/** Alice's owner lands the paper: in the Alice she knows, or in one born for it. */
export const landIn = async (ask: Ask, given: string, alice: 'known' | 'newborn') => {
  if (alice === 'known') assert.ok(((await hand(ask, 'beings')) as string[]).includes('alice'), 'the owner finds Alice by listing');
  else await hand(ask, 'bear', { kind: 'org.example.guest', id: 'alice' });
  await land(ask, given, 'alice');
};

/** Alice's house before the paper: a bystander, and Alice where her owner knows her. */
export const beforehand = async (ask: Ask, alice: 'known' | 'newborn') => {
  await hand(ask, 'bear', { kind: 'org.example.guest', id: 'bystander' });
  if (alice === 'known') await hand(ask, 'bear', { kind: 'org.example.guest', id: 'alice' });
};

/** Bob holds the occupant, Alice alone holds a standing, and her greeting reaches him. */
export const placed = async (bob: Ask, alice: Ask, occupant: string) => {
  assert.deepEqual(await being(bob, 'bob', 'occupantsList'), [occupant]);
  assert.equal((await being(alice, 'alice', 'standingsList')).length, 1, 'Alice holds the standing');
  assert.deepEqual(await being(alice, 'bystander', 'standingsList'), [], 'no other being of her house does');
  assert.equal(await being(alice, 'alice', 'greetHost'), `bob greets ${occupant}`);
};
