// The door admits each arrival on the record the last one on its relation
// left, so boxes in flight together never lower the highest number honoured.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClassList, House, NobleCrypto, SeedKeys, StrictTools } from 'nervur';
import { FakeClock, FakeMemory } from 'nervur/bench';
import { Room } from '../../../src/quo/room.ts';
import { Steward } from '../../fixtures/world/steward.ts';

const crypto = new NobleCrypto();
const tools = new StrictTools();

test('Two boxes on one relation in flight together, out of order, and one replayed: each number acts once', async () => {
  const house = await House.open({ keys: new SeedKeys('7'.repeat(64)), memory: new FakeMemory(), classes: new ClassList({ steward: Steward }), clock: new FakeClock() });
  const offered = await house.ask({ method: 'offer' });
  assert.ok('result' in offered);
  const room = new Room(new SeedKeys('8'.repeat(64)), crypto, tools);
  const invitation = (await room.invitation(JSON.parse(tools.text(tools.bytes((offered.result as { handle: string }).handle)!)!)))!;

  // The knock binds the relation.
  const knock = await room.seal(room.standing(invitation), { method: 'ping' });
  const { standing } = await room.read(knock.standing, knock.pending, await house.door(knock.box));

  // A standing that sends two at once, as no nervur standing does.
  const five = await room.seal(standing, { method: 'ping' });
  const six = await room.seal(five.standing, { method: 'ping' });
  const count = async () => ((await house.ask({ method: 'pings' })) as { result: number }).result;
  await Promise.all([house.door(six.box), house.door(five.box)]);
  const between = await count();
  assert.ok(between === 2 || between === 3, 'six acted, and five acted only where it was judged first');

  // Whichever won, the highest never went down: neither number acts again.
  await Promise.all([house.door(six.box), house.door(five.box)]);
  await house.door(six.box);
  assert.equal(await count(), between);
});

test('Args that repeat a key are refused before anything runs, with the mark the asker’s describe carries', async () => {
  const house = await House.open({ keys: new SeedKeys('7'.repeat(64)), memory: new FakeMemory(), classes: new ClassList({ steward: Steward }), clock: new FakeClock() });
  const offered = await house.ask({ method: 'offer' });
  assert.ok('result' in offered);
  const room = new Room(new SeedKeys('8'.repeat(64)), crypto, tools);
  const invitation = (await room.invitation(JSON.parse(tools.text(tools.bytes((offered.result as { handle: string }).handle)!)!)))!;

  const knock = await room.seal(room.standing(invitation), {});
  const described = await room.read(knock.standing, knock.pending, await house.door(knock.box));
  assert.ok('object' in described.read);
  const strange = await room.seal(described.standing, { method: 'ping', args: '{"by":1,"by":2}' });
  const { read } = await room.read(strange.standing, strange.pending, await house.door(strange.box));
  assert.ok('object' in read);
  assert.deepEqual(read.object, { error: { message: 'the args repeat a key' } });
  assert.equal(read.seen, described.read.seen, 'the same mark the describe carried');
  assert.equal(((await house.ask({ method: 'pings' })) as { result: number }).result, 0, 'ping never ran');
});
