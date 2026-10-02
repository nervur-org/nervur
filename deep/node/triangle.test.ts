// The triangle with Alice's ground a process of its own: Bob hands her
// Carol's paper over TCP, and she greets Carol over TCP. With her ground in
// the test's process, and beside Bob, it is `test/node/triangle.test.ts`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groundTwo } from '../../test/fixtures/node/grounds.ts';
import { bobsGround, bobStandsOn, mailed } from '../../test/fixtures/node/triangle.ts';

test('Alice on a ground of her own process: Bob hands her Carol’s paper over TCP, and she greets Carol over TCP', async (t) => {
  const { ground, mailbox, bobs, carols } = await bobsGround(t, true);
  const { ask: hers } = await groundTwo(t);
  await bobStandsOn(bobs.ask, hers);
  const heard = ground.heard.tcp;
  await mailed(mailbox, bobs.ask, carols.ask, hers);
  assert.ok(ground.heard.tcp > heard, 'Alice’s asks to Carol reached ground one over TCP');
});
