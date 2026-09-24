// Invitations that go wrong. What is refused inside the taker's own house
// is refused with its reason. What goes wrong past a door is silence, and
// the being reads every silence alike: `answered nothing`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { being, failed, groundOne, groundTwo, hand, paper, type Ask } from '../fixtures/node/grounds.ts';
import { Bob } from '../fixtures/world/bob.ts';
import { Guest } from '../fixtures/world/guest.ts';
import { Host } from '../fixtures/world/host.ts';
import { Mailbox, mailOffer } from '../fixtures/world/mailbox.ts';

// Alice's greetHost calls Bob's greet: whatever the cause, she reads this.
const SILENCE = /^greet answered nothing$/;

const bear = (ask: Ask, kind: 'host' | 'guest', id: string) => hand(ask, 'bear', { kind: `org.example.${kind}`, id });
const give = (ask: Ask, invitation: string, id: string) => ask({ id, method: 'accept', args: { invitation } });
const standingsOf = async (ask: Ask, id: string) => (await being(ask, id, 'standingsList')) as string[];

// Bob in house a on ground one, and two more houses there for Alice and a bystander.
const threeHouses = async (t: Parameters<typeof groundOne>[0]) => {
  const ground = await groundOne(t);
  const [bobs, hers, other] = [await ground.open('a'), await ground.open('b'), await ground.open('e')];
  await bear(bobs.ask, 'host', 'bob');
  await bear(hers.ask, 'guest', 'alice');
  await bear(other.ask, 'guest', 'bystander');
  return { bobs: bobs.ask, hers: hers.ask, other: other.ask, mint: () => paper(bobs.ask, 'bob', 'for-alice') };
};

// ---- refused in the taker's own house ----

test('Bytes that are no invitation are refused when taken, and no standing is made', async (t) => {
  const { hers } = await threeHouses(t);
  const notPaper = Buffer.from('{"a":1}').toString('hex');
  assert.deepEqual(await give(hers, notPaper, 'alice'), { error: { message: 'an invitation was owed and none came' } });
  assert.deepEqual(await standingsOf(hers, 'alice'), []);
});

test('A paper handed to a being that is not there is refused, and stays unspent for the right one', async (t) => {
  const { hers, mint } = await threeHouses(t);
  const given = await mint();
  const answer = await give(hers, given, 'nobody');
  assert.ok('error' in answer, JSON.stringify(answer));
  assert.deepEqual(await standingsOf(hers, 'alice'), []);
  assert.ok('result' in (await give(hers, given, 'alice')));
  assert.equal(await being(hers, 'alice', 'greetHost'), 'bob greets for-alice');
});

test('A paper spent inside Bob’s house is refused to a second being there', async (t) => {
  const ground = await groundOne(t);
  const house = await ground.open('a');
  await bear(house.ask, 'host', 'bob');
  await bear(house.ask, 'guest', 'alice');
  await bear(house.ask, 'guest', 'bystander');
  const given = await paper(house.ask, 'bob', 'for-alice');
  assert.ok('result' in (await give(house.ask, given, 'alice')));
  assert.deepEqual(await give(house.ask, given, 'bystander'), { error: { message: 'the invitation is spent or unknown' } });
  assert.deepEqual(await standingsOf(house.ask, 'bystander'), []);
});

// ---- silence past a door ----

test('A paper spent by one holder is silence to another: the first knock binds', async (t) => {
  const { hers, other, mint } = await threeHouses(t);
  const given = await mint();
  await give(hers, given, 'alice');
  await give(other, given, 'bystander');
  assert.equal(await being(hers, 'alice', 'greetHost'), 'bob greets for-alice');
  assert.match(await failed(other, 'bystander', 'greetHost'), SILENCE);
  assert.equal(await being(hers, 'alice', 'greetHost'), 'bob greets for-alice', 'the one who bound it asks on');
});

test('Two holders knock at once, and exactly one binds', async (t) => {
  const { bobs, hers, other, mint } = await threeHouses(t);
  const given = await mint();
  await give(hers, given, 'alice');
  await give(other, given, 'bystander');
  const answers = await Promise.all([hers({ method: 'forward', args: { id: 'alice', method: 'greetHost' } }), other({ method: 'forward', args: { id: 'bystander', method: 'greetHost' } })]);
  assert.equal(answers.filter((answer) => 'result' in answer).length, 1, JSON.stringify(answers));
  assert.deepEqual(await being(bobs, 'bob', 'occupantsList'), ['for-alice']);
});

test('An occupant Bob dismissed before Alice knocked is silence to her', async (t) => {
  const { bobs, hers, mint } = await threeHouses(t);
  const given = await mint();
  await being(bobs, 'bob', 'dismiss', { id: 'for-alice' });
  await give(hers, given, 'alice');
  assert.match(await failed(hers, 'alice', 'greetHost'), SILENCE);
});

test('Bob removed is silence to Alice, before her knock and after it', async (t) => {
  const { bobs, hers, other, mint } = await threeHouses(t);
  const first = await mint();
  const second = await paper(bobs, 'bob', 'for-bystander');
  await give(hers, first, 'alice');
  assert.equal(await being(hers, 'alice', 'greetHost'), 'bob greets for-alice');
  await give(other, second, 'bystander');
  await hand(bobs, 'remove', { id: 'bob' });
  assert.match(await failed(hers, 'alice', 'greetHost'), SILENCE, 'after her knock bound');
  assert.match(await failed(other, 'bystander', 'greetHost'), SILENCE, 'before any knock');
});

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

// ---- the triangle ----

const triangle = async (t: Parameters<typeof groundOne>[0], dials: boolean) => {
  const mailbox = new Mailbox();
  const ground = await groundOne(t, { dials, faculties: { mail: mailOffer(mailbox) } });
  const bobs = await ground.open('a', { beings: [Bob, Host, Guest], granted: ['mail'] });
  const carols = await ground.open('d');
  await hand(bobs.ask, 'bear', { kind: 'org.example.bob', id: 'bob' });
  await bear(carols.ask, 'host', 'carol');
  const standOn = async (alice: Ask) => {
    await bear(alice, 'guest', 'alice');
    await give(bobs.ask, await paper(alice, 'alice', 'for-bob'), 'bob');
  };
  return { ground, mailbox, carols: carols.ask, standOn };
};

test('The same email twice leaves Alice one standing on Carol', async (t) => {
  const { ground, mailbox, carols, standOn } = await triangle(t, false);
  const hers = (await ground.open('b')).ask;
  await standOn(hers);
  const body = JSON.stringify({ invitation: await paper(carols, 'carol', 'for-alice') });
  assert.deepEqual(await mailbox.arrive(body), { result: null });
  assert.deepEqual(await mailbox.arrive(body), { result: null });
  assert.equal((await standingsOf(hers, 'alice')).length, 1);
  assert.equal(await being(hers, 'alice', 'greetHost'), 'carol greets for-alice');
});

test('An email that finds Alice’s ground down fails to the mailbox, and the paper stays unspent for its next delivery', async (t) => {
  const { mailbox, carols, standOn } = await triangle(t, true);
  const alices = await groundTwo(t);
  await standOn(alices.ask);
  const body = JSON.stringify({ invitation: await paper(carols, 'carol', 'for-alice') });

  await alices.down();
  const lost = await mailbox.arrive(body);
  assert.ok('error' in lost && /answered nothing$/.test(lost.error.message), JSON.stringify(lost));
  await alices.up();
  assert.deepEqual(await mailbox.arrive(body), { result: null }, 'delivered again once Alice’s ground is back');
  assert.equal(await being(alices.ask, 'alice', 'greetHost'), 'carol greets for-alice');
});
