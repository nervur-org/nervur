// Two grounds on one network, a house on each, each asking the other through its door.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BenchGround, FakeNetwork } from 'nervur/bench';
import { Counter } from '../fixtures/world/counter.ts';
import { Steward } from '../fixtures/world/steward.ts';

type Json = NonNullable<Parameters<BenchGround['ask']>[0]['args']>;

const modules = { house: { steward: Steward, beings: [Counter] } };

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
