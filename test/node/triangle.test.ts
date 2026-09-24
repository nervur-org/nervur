// An invitation that reaches its taker through a third being. Carol mints a
// paper, and it arrives in an email to Bob's mailbox. Bob holds a standing
// on Alice, and hands her the paper unopened in an ask. Alice takes it, and
// greets Carol through it. Bob never holds a standing on Carol.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { being, groundOne, groundTwo, hand, land, paper, type Ask } from '../fixtures/node/grounds.ts';
import { Bob } from '../fixtures/world/bob.ts';
import { Guest } from '../fixtures/world/guest.ts';
import { Host } from '../fixtures/world/host.ts';
import { Mailbox, mailOffer } from '../fixtures/world/mailbox.ts';

// Bob's house on ground one, with his mailbox and Carol's house beside it.
const bobsGround = async (t: Parameters<typeof groundOne>[0], dials = false) => {
  const mailbox = new Mailbox();
  const ground = await groundOne(t, { dials, faculties: { mail: mailOffer(mailbox) } });
  const bobs = await ground.open('a', { beings: [Bob, Host, Guest], granted: ['mail'] });
  const carols = await ground.open('d');
  await hand(bobs.ask, 'bear', { kind: 'org.example.bob', id: 'bob' });
  await hand(carols.ask, 'bear', { kind: 'org.example.host', id: 'carol' });
  return { ground, mailbox, bobs, carols };
};

// Bob comes to stand on Alice: her owner mints the paper, and his lands it in him.
const bobStandsOn = async (bob: Ask, alice: Ask) => {
  await hand(alice, 'bear', { kind: 'org.example.guest', id: 'alice' });
  await land(bob, await paper(alice, 'alice', 'for-bob'), 'bob');
};

// Carol's paper, in an email to Bob, and what came of it.
const mailed = async (mailbox: Mailbox, bobs: Ask, carols: Ask, alice: Ask) => {
  const answer = await mailbox.arrive(JSON.stringify({ invitation: await paper(carols, 'carol', 'for-alice') }));
  assert.deepEqual(answer, { result: null }, 'Bob took the email, and Alice took the paper');
  assert.equal((await being(alice, 'alice', 'standingsList')).length, 1, 'Alice holds the standing on Carol');
  assert.equal(await being(alice, 'alice', 'greetHost'), 'carol greets for-alice');
  assert.deepEqual(await being(carols, 'carol', 'occupantsList'), ['for-alice']);
  assert.equal((await being(bobs, 'bob', 'standingsList')).length, 1, 'Bob stands on Alice alone, never on Carol');
};

test('Alice beside Bob on his ground: the paper passes Bob unopened, and Alice greets Carol by pointer', async (t) => {
  const { ground, mailbox, bobs, carols } = await bobsGround(t);
  const hers = await ground.open('b');
  await bobStandsOn(bobs.ask, hers.ask);
  await mailed(mailbox, bobs.ask, carols.ask, hers.ask);
});

test('Alice on another ground: Bob hands her Carol’s paper over TCP, and she greets Carol over TCP', async (t) => {
  // Bob dials Alice's ground, which stands on this machine.
  const { ground, mailbox, bobs, carols } = await bobsGround(t, true);
  const { ask: hers } = await groundTwo(t);
  await bobStandsOn(bobs.ask, hers);
  const heard = ground.heard.tcp;
  await mailed(mailbox, bobs.ask, carols.ask, hers);
  assert.ok(ground.heard.tcp > heard, 'Alice’s asks to Carol reached ground one over TCP');
});
