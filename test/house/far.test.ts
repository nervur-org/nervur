// Two grounds on one network, a house on each, each asking the other through its door.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BenchGround, FakeNetwork } from 'nervur/bench';
import { house, world } from '../fixtures/house.ts';
import { Steward } from '../fixtures/world/steward.ts';

type Json = NonNullable<Parameters<BenchGround['ask']>[0]['args']>;

const modules = { house: house(Steward, [world('steward'), world('counter')]) };

const pair = async () => {
  const network = new FakeNetwork();
  const open = async (host: string) => {
    const ground = await BenchGround.open({ network, host, names: [`${host}.example`], modules });
    await ground.add('house');
    const result = async (method: string, args: Json = {}) => {
      const answer = await ground.ask({ house: 'house', method, args });
      assert.ok('result' in answer, JSON.stringify(answer));
      return answer.result;
    };
    return { ground, result };
  };
  const a = await open('a');
  const b = await open('b');
  // A invites, B adopts: B's steward holds a standing on A's occupant `far`.
  const { handle } = (await a.result('offer')) as { handle: string };
  const standing = (await b.result('adopt', { invitation: handle })) as string;
  return { network, a, b, standing, handle };
};

test('She never holds an invitation’s bytes: a handle leaves as an invitation, and arrives as a standing id', async () => {
  const { standing, handle } = await pair();
  assert.match(standing, /^standing:[0-9a-f]{16}$/);
  const invitation = JSON.parse(Buffer.from(handle, 'hex').toString('utf8'));
  assert.deepEqual(Object.keys(invitation).sort(), ['at', 'heir', 'lock', 'secret', 'ward']);
  assert.deepEqual(invitation.at, ['bench://a.example']);
});

test('An awaited call crosses to a far house: a knock, a describe matched to her need, then the ask', async () => {
  const { network, b, standing } = await pair();
  assert.equal(await b.result('relay', { standing }), 'far');
  assert.equal(await b.result('relay', { standing }), 'far', 'the relation moved, and asks on');
  assert.ok(network.crossings.every(({ from, to }) => from === 'b' && to === 'a'), 'every box crossed from b to a');
});

test('A knock whose reply was lost bound the door, and the next ask is heard under the key it announced', async () => {
  const { network, a, b, standing } = await pair();
  network.loseNext();
  const lost = await b.ground.ask({ house: 'house', method: 'relay', args: { standing } });
  assert.deepEqual(lost, { error: { message: 'whoami answered nothing' } });
  assert.equal(await b.result('relay', { standing }), 'far', 'the door bound the knock it heard, and admits its announced key');
  assert.equal(await b.result('relay', { standing }), 'far');
  assert.equal(((await a.result('list')) as unknown[]).length, 1, 'no being was made twice');
});

test('An effect crosses once, even where its reply was lost', async () => {
  const { network, a, b, standing } = await pair();
  await b.result('relay', { standing });
  network.loseNext();
  await b.result('pingFar', { standing });
  await network.settle();
  assert.equal(await a.result('pings'), 1, 'the far door answered and the reply was lost');
  await network.elapse(1000);
  assert.equal(await a.result('pings'), 1, 'the retry is a new box with the same call id, answered from the stored answer');
});

// ---- a relation the far side let go ----

const WEEK = 7 * 86_400_000;

// A counter in house a, and in house b a holder who took an invitation to it and knocked once.
const holding = async () => {
  const network = new FakeNetwork();
  const open = async (host: string) => {
    const ground = await BenchGround.open({ network, host, names: [`${host}.example`], modules: { house: house(Steward, [world('steward'), world('counter'), world('holder')]) } });
    await ground.add('house');
    const asked = (id: string, method: string, args: Json = {}) => ground.ask({ house: 'house', id, method, args });
    const result = async (id: string, method: string, args: Json = {}) => {
      const answer = await asked(id, method, args);
      assert.ok('result' in answer, JSON.stringify(answer));
      return answer.result;
    };
    const failed = async (id: string, method: string, args: Json = {}) => {
      const answer = await asked(id, method, args);
      assert.ok('error' in answer, JSON.stringify(answer));
      return answer.error.message;
    };
    return { result, failed };
  };
  const a = await open('a');
  const b = await open('b');
  await a.result('steward', 'bear', { kind: 'org.example.counter', id: 'counter' });
  await b.result('steward', 'bear', { kind: 'org.example.holder', id: 'holder' });
  const { handle } = (await a.result('steward', 'offerFor', { being: 'counter', occupant: 'far' })) as { handle: string };
  await b.result('holder', 'take', { invitation: handle });
  assert.equal(await b.result('holder', 'total'), 0, 'her knock bound the far door');
  const [standing] = (await b.result('holder', 'holding')) as string[];
  return { network, a, b, standing };
};

test('It refuses a standing kept after the being it reaches let her go: her far door answered removed, an awaited call fails final, the standing goes, and a later call fails at once', async () => {
  const { a, b, standing } = await holding();
  await a.result('steward', 'remove', { id: 'counter' });
  assert.equal(await b.failed('holder', 'total'), 'the standing was removed');
  assert.deepEqual(await b.result('holder', 'holding'), [], 'the house dropped it in the write that landed the answer');
  assert.equal(await b.failed('holder', 'total'), `she holds no standing ${standing}`, 'a later call names the standing gone, and nothing crosses');
});

test('An answer is final, and a failure to answer is not: removed fails an effect final, with every entry queued behind it', async () => {
  const { network, a, b } = await holding();
  await a.result('steward', 'remove', { id: 'counter' });
  await b.result('holder', 'bump', { times: 2 });
  await network.settle();
  assert.deepEqual(await b.result('holder', 'replies'), ['the standing was removed', 'the standing was removed'], 'the first answered removed, and the second failed with it');
  assert.deepEqual(await b.result('holder', 'holding'), []);
});

test('Keys kept at removal answer removed for a week, and silence after, which stays transient', async () => {
  const { network, a, b, standing } = await holding();
  await a.result('steward', 'remove', { id: 'counter' });
  await network.elapse(WEEK, { step: WEEK });
  assert.equal(await b.failed('holder', 'total'), 'total answered nothing', 'past the week the door keeps nothing, and the holder hears silence');
  assert.deepEqual(await b.result('holder', 'holding'), [standing], 'silence drops nothing');
});
