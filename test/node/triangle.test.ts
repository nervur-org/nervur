// An invitation that reaches its taker through a third being. Carol mints a
// paper, and it arrives in an email to Bob's mailbox. Bob holds a standing
// on Alice, and hands her the paper unopened in an ask. Alice takes it, and
// greets Carol through it. Bob never holds a standing on Carol. Alice's
// ground here stands in this process. As a process of its own it is
// `deep/node/triangle.test.ts`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groundOne } from '../fixtures/node/grounds.ts';
import { bobsGround, bobStandsOn, mailed } from '../fixtures/node/triangle.ts';

test('Alice beside Bob on his ground: the paper passes Bob unopened, and Alice greets Carol by pointer', async (t) => {
  const { ground, mailbox, bobs, carols } = await bobsGround(t);
  const hers = await ground.open('b');
  await bobStandsOn(bobs.ask, hers.ask);
  await mailed(mailbox, bobs.ask, carols.ask, hers.ask);
});

test('Alice on another ground: Bob hands her Carol’s paper over TCP, and she greets Carol over TCP', async (t) => {
  // Bob dials Alice's ground, and she dials his, both on this machine.
  const { ground, mailbox, bobs, carols } = await bobsGround(t, true);
  const { ask: hers } = await (await groundOne(t, { dials: true })).open('main');
  await bobStandsOn(bobs.ask, hers);
  const heard = ground.heard.tcp;
  await mailed(mailbox, bobs.ask, carols.ask, hers);
  assert.ok(ground.heard.tcp > heard, 'Alice’s asks to Carol reached ground one over TCP');
});
