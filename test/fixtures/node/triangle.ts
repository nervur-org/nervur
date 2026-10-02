// The triangle's world, shared by its fast half and its deep one. Bob's
// house stands on ground one with his mailbox, and Carol's house beside it.
// Bob comes to stand on Alice wherever she lives, and Carol's paper reaches
// her in an email to Bob.
import assert from 'node:assert/strict';
import { Bob } from '../world/bob.ts';
import { Guest } from '../world/guest.ts';
import { Host } from '../world/host.ts';
import { Mailbox, mailOffer } from '../world/mailbox.ts';
import { being, groundOne, hand, land, paper, type Ask } from './grounds.ts';

/** Bob's house on ground one, with his mailbox and Carol's house beside it. */
export const bobsGround = async (t: Parameters<typeof groundOne>[0], dials = false) => {
  const mailbox = new Mailbox();
  const ground = await groundOne(t, { dials, faculties: { mail: mailOffer(mailbox) } });
  const bobs = await ground.open('a', { beings: [Bob, Host, Guest], granted: ['mail'] });
  const carols = await ground.open('d');
  await hand(bobs.ask, 'bear', { kind: 'org.example.bob', id: 'bob' });
  await hand(carols.ask, 'bear', { kind: 'org.example.host', id: 'carol' });
  return { ground, mailbox, bobs, carols };
};

/** Bob comes to stand on Alice: her owner mints the paper, and his lands it in him. */
export const bobStandsOn = async (bob: Ask, alice: Ask) => {
  await hand(alice, 'bear', { kind: 'org.example.guest', id: 'alice' });
  await land(bob, await paper(alice, 'alice', 'for-bob'), 'bob');
};

/** Carol's paper, in an email to Bob, and what came of it. */
export const mailed = async (mailbox: Mailbox, bobs: Ask, carols: Ask, alice: Ask) => {
  await mailbox.watched;
  const answer = await mailbox.arrive(JSON.stringify({ invitation: await paper(carols, 'carol', 'for-alice') }));
  assert.deepEqual(answer, { result: null }, 'Bob took the email, and Alice took the paper');
  assert.equal((await being(alice, 'alice', 'standingsList')).length, 1, 'Alice holds the standing on Carol');
  assert.equal(await being(alice, 'alice', 'greetHost'), 'carol greets for-alice');
  assert.deepEqual(await being(carols, 'carol', 'occupantsList'), ['for-alice']);
  assert.equal((await being(bobs, 'bob', 'standingsList')).length, 1, 'Bob stands on Alice alone, never on Carol');
};
