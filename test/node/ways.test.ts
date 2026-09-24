// A being takes a paper wherever a value crosses into her under s.handle,
// whoever hands it. The hand, a being of her house and a far being in her
// args are held by invite.test.ts and triangle.test.ts. Here: a faculty in
// her args, a faculty's result, and a far being's answer in her reply.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { being, groundOne, hand, land, paper } from '../fixtures/node/grounds.ts';
import { Bell, bellOffer } from '../fixtures/world/bell.ts';
import { Collector } from '../fixtures/world/collector.ts';
import { Mailbox, mailOffer } from '../fixtures/world/mailbox.ts';

// Bob and Carol in two houses of ground one, and Alice the collector in a third.
const houses = async (t: Parameters<typeof groundOne>[0]) => {
  const mailbox = new Mailbox();
  const bell = new Bell();
  const ground = await groundOne(t, { faculties: { mail: mailOffer(mailbox), bell: bellOffer(bell) } });
  const bobs = await ground.open('a');
  const carols = await ground.open('d');
  const hers = await ground.open('b', { beings: [Collector], granted: ['mail', 'bell'] });
  await hand(bobs.ask, 'bear', { kind: 'org.example.host', id: 'bob' });
  await hand(carols.ask, 'bear', { kind: 'org.example.host', id: 'carol' });
  await hand(hers.ask, 'bear', { kind: 'org.example.collector', id: 'alice' });
  return { mailbox, bell, bobs: bobs.ask, carols: carols.ask, hers: hers.ask };
};

test('A faculty hands her a paper in her ask’s args, and she takes it', async (t) => {
  const { mailbox, carols, hers } = await houses(t);
  const answer = await mailbox.arrive(JSON.stringify({ invitation: await paper(carols, 'carol', 'for-mail') }));
  assert.deepEqual(answer, { result: null });
  assert.equal(await being(hers, 'alice', 'greetMail'), 'carol greets for-mail');
});

test('A faculty’s result carries a paper, and she takes it', async (t) => {
  const { mailbox, carols, hers } = await houses(t);
  mailbox.keep(JSON.stringify({ invitation: await paper(carols, 'carol', 'for-result') }));
  await being(hers, 'alice', 'fetch');
  assert.equal(await being(hers, 'alice', 'greetResult'), 'carol greets for-result');
});

test('A far being’s answer to her effect carries a paper, and her reply takes it', async (t) => {
  const { bell, bobs, hers } = await houses(t);
  await land(hers, await paper(bobs, 'bob', 'for-alice'), 'alice');
  await being(hers, 'alice', 'askDoor');
  await bell.rung;
  assert.equal(await being(hers, 'alice', 'greetReply'), 'bob greets door-1');
  assert.deepEqual((await being(bobs, 'bob', 'occupantsList')).sort(), ['door-1', 'for-alice']);
});
