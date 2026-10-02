// Invitations that go wrong when a ground is a process of its own, stopped
// and started again on its state and port. Down is silence, and once it is
// back the paper binds once. Down alone, with every ground in the test's
// process, is `test/node/unhappy.test.ts`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { being, failed, groundOne, groundTwo, hand, paper, type Ask } from '../../test/fixtures/node/grounds.ts';
import { Bob } from '../../test/fixtures/world/bob.ts';
import { Guest } from '../../test/fixtures/world/guest.ts';
import { Host } from '../../test/fixtures/world/host.ts';
import { Mailbox, mailOffer } from '../../test/fixtures/world/mailbox.ts';

const SILENCE = /^greet answered nothing$/;
const bear = (ask: Ask, kind: 'host' | 'guest', id: string) => hand(ask, 'bear', { kind: `org.example.${kind}`, id });
const give = (ask: Ask, invitation: string, id: string) => ask({ id, method: 'accept', args: { invitation } });

test('Bob’s ground down is silence to Alice, and once it is back her asks reach him, bound once', async (t) => {
  const ground = await groundOne(t, { dials: true });
  const hers = await ground.open('b');
  await bear(hers.ask, 'guest', 'alice');
  const bobs = await groundTwo(t);
  await bear(bobs.ask, 'host', 'bob');
  await give(hers.ask, await paper(bobs.ask, 'bob', 'for-alice'), 'alice');

  await bobs.down();
  assert.match(await failed(hers.ask, 'alice', 'greetHost'), SILENCE);
  await bobs.up();
  const after: string[] = [];
  for (let ask = 0; ask < 3 && after.at(-1) !== 'answered'; ask++) {
    const answer = await hers.ask({ method: 'forward', args: { id: 'alice', method: 'greetHost' } });
    after.push('result' in answer ? 'answered' : 'silence');
  }
  assert.deepEqual(after, ['answered'], 'the first ask after Bob came back reaches him');
  assert.equal(await being(hers.ask, 'alice', 'greetHost'), 'bob greets for-alice');
  assert.deepEqual(await being(bobs.ask, 'bob', 'occupantsList'), ['for-alice']);
});

test('An email that finds Alice’s ground down fails to the mailbox, and the paper stays unspent for its next delivery', async (t) => {
  const mailbox = new Mailbox();
  const ground = await groundOne(t, { dials: true, faculties: { mail: mailOffer(mailbox) } });
  const bobs = await ground.open('a', { beings: [Bob, Host, Guest], granted: ['mail'] });
  const carols = await ground.open('d');
  await hand(bobs.ask, 'bear', { kind: 'org.example.bob', id: 'bob' });
  await bear(carols.ask, 'host', 'carol');
  const alices = await groundTwo(t);
  await bear(alices.ask, 'guest', 'alice');
  await give(bobs.ask, await paper(alices.ask, 'alice', 'for-bob'), 'bob');
  const body = JSON.stringify({ invitation: await paper(carols.ask, 'carol', 'for-alice') });

  await mailbox.watched;
  await alices.down();
  const lost = await mailbox.arrive(body);
  assert.ok('error' in lost && /answered nothing$/.test(lost.error.message), JSON.stringify(lost));
  await alices.up();
  assert.deepEqual(await mailbox.arrive(body), { result: null }, 'delivered again once Alice’s ground is back');
  assert.equal(await being(alices.ask, 'alice', 'greetHost'), 'carol greets for-alice');
});
