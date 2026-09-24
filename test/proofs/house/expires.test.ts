// An invitation that waits unspent past its time never binds, and every
// mint and every bind lets go of those left so.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Json } from '../../../src/being/being.ts';
import { FakeClock } from '../../../src/bench/fake-clock.ts';
import { FakeMemory } from '../../../src/bench/fake-memory.ts';
import { ClassList } from '../../../src/bodies/class-list.ts';
import { NobleCrypto } from '../../../src/bodies/noble-crypto.ts';
import { SeedKeys } from '../../../src/bodies/seed-keys.ts';
import { StrictTools } from '../../../src/bodies/strict-tools.ts';
import { openForBench } from '../../../src/house/house.ts';
import { Room } from '../../../src/quo/room.ts';
import { Lender } from '../fixtures/lender.ts';
import { Member } from '../fixtures/member.ts';

const crypto = new NobleCrypto();
const tools = new StrictTools();
const MINUTE = 60_000;

const open = async () => {
  const clock = new FakeClock();
  const classes = new ClassList({ steward: Lender, beings: [Member] });
  const { opened: house, access } = await openForBench({ keys: new SeedKeys('a'.repeat(64), crypto), memory: new FakeMemory(), classes, clock, crypto, tools }, []);
  const ask = (method: string, args: Json = {}) => house.ask({ method, args });
  const lend = async (id: string, expires?: number, way = 'invite') => {
    const answer = await ask('lend', { way, id, ...(expires === undefined ? {} : { expires }) });
    assert.ok('result' in answer, JSON.stringify(answer));
    return (answer.result as { handle: string }).handle;
  };
  // A far holder's knock: whether the door answered it, and a knock after it on the relation it bound.
  const knock = async (hex: string) => {
    const room = new Room(new SeedKeys(tools.hex(crypto.random(32)), crypto), crypto, tools);
    const invitation = (await room.invitation(JSON.parse(tools.text(tools.bytes(hex)!)!)))!;
    const first = await room.seal(room.standing(invitation), {});
    const { standing, read } = await room.read(first.standing, first.pending, await house.door(first.box));
    const again = async () => {
      const next = await room.seal(standing, {});
      return 'object' in (await room.read(next.standing, next.pending, await house.door(next.box))).read;
    };
    return { answered: 'object' in read, again };
  };
  // The heirs an occupant holds, or undefined where she holds no such occupant.
  const heirs = async (being: string, occupant: string) => {
    let held: string[] | undefined;
    await access.patch(being, (row) => {
      const seat = row.occupants[occupant];
      held = seat === undefined ? undefined : Object.keys(seat.quo ?? {});
    });
    return held;
  };
  return { clock, ask, lend, knock, heirs };
};

test('An invitation left unspent past its time hears silence, and one without a time never expires', async () => {
  const { clock, lend, knock } = await open();
  const brief = await lend('brief', 10 * MINUTE);
  const lasting = await lend('lasting');
  clock.advance(10 * MINUTE);
  assert.equal((await knock(brief)).answered, false);
  clock.advance(365 * 24 * 60 * MINUTE);
  assert.equal((await knock(lasting)).answered, true);
});

test('An invitation spent within its time never expires after', async () => {
  const { clock, lend, knock } = await open();
  const { answered, again } = await knock(await lend('prompt', MINUTE));
  assert.equal(answered, true);
  clock.advance(60 * MINUTE);
  assert.equal(await again(), true);
});

test('A mint lets go of every heir left unspent past its time, and keeps the occupant', async () => {
  const { clock, lend, heirs } = await open();
  await lend('old', MINUTE);
  await lend('kept');
  assert.equal((await heirs('steward', 'old'))?.length, 1);
  clock.advance(2 * MINUTE);
  await lend('new', MINUTE);
  assert.deepEqual(await heirs('steward', 'old'), [], 'the heir is gone, the occupant stays');
  assert.equal((await heirs('steward', 'kept'))?.length, 1);
});

test('A knock that binds lets go of every heir left unspent past its time', async () => {
  const { clock, lend, knock, heirs } = await open();
  await lend('old', MINUTE);
  const fresh = await lend('fresh');
  clock.advance(2 * MINUTE);
  assert.equal((await knock(fresh)).answered, true);
  assert.deepEqual(await heirs('steward', 'old'), []);
});

test('A handle to one ask and a steward’s invite on another being expire alike', async () => {
  const { clock, ask, lend, knock } = await open();
  assert.ok('result' in (await ask('bear', { kind: 'org.example.member', id: 'member' })));
  const handle = await lend('ping', MINUTE, 'handle');
  const seat = await lend('member', MINUTE, 'powers');
  clock.advance(MINUTE);
  assert.equal((await knock(handle)).answered, false);
  assert.equal((await knock(seat)).answered, false);
});

test('An invitation taken inside its house past its time is refused', async () => {
  const { clock, ask, lend } = await open();
  assert.ok('result' in (await ask('bear', { kind: 'org.example.member', id: 'member' })));
  const seat = await lend('member', MINUTE, 'powers');
  clock.advance(MINUTE);
  assert.deepEqual(await ask('adopt', { invitation: seat }), { error: { message: 'the invitation is spent or unknown' } });
});

test('A time that is no whole number of milliseconds above zero is refused', async () => {
  const { ask } = await open();
  for (const expires of [0, -1, 1.5]) {
    assert.deepEqual(await ask('lend', { way: 'invite', id: `bad${expires}`, expires }), { error: { message: 'expires is a whole number of milliseconds above zero' } });
  }
});
