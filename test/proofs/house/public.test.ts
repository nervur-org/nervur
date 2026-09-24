// A stranger across a door: the zero head, the public being and signup.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Json } from '../../../src/being/being.ts';
import { FakeCarry, type Door } from '../../../src/bench/fake-carry.ts';
import { FakeClock } from '../../../src/bench/fake-clock.ts';
import { FakeMemory } from '../../../src/bench/fake-memory.ts';
import { ClassList } from '../../../src/bodies/class-list.ts';
import { NobleCrypto } from '../../../src/bodies/noble-crypto.ts';
import { SeedKeys } from '../../../src/bodies/seed-keys.ts';
import { StrictTools } from '../../../src/bodies/strict-tools.ts';
import { openHouse } from '../../../src/house/house.ts';
import { Room } from '../../../src/quo/room.ts';
import { Steward } from '../../fixtures/world/steward.ts';
import { Lobby } from '../fixtures/lobby.ts';
import { Member } from '../fixtures/member.ts';

const crypto = new NobleCrypto();
const tools = new StrictTools();
const network = new Map<string, Door>();

const open = async (name: string, seed: string, withLobby: boolean) => {
  const carry = new FakeCarry({ network, address: `fake://${name}` });
  const classes = new ClassList({ steward: Steward, ...(withLobby ? { public: Lobby } : {}), beings: [Member] });
  const memory = new FakeMemory();
  const house = await openHouse({ keys: new SeedKeys(seed, crypto), memory, classes, carry, clock: new FakeClock(), crypto, tools }, []);
  carry.listen(house);
  const result = async (method: string, args: Json = {}) => {
    const answer = await house.ask({ method, args });
    assert.ok('result' in answer, JSON.stringify(answer));
    return answer.result;
  };
  return { house, result, memory };
};

// A stranger: a key of their own, and the room's zero head.
const stranger = (secret = crypto.random(32)) => {
  const room = new Room(new SeedKeys('9'.repeat(64), crypto), crypto, tools);
  const ask = async (house: { ward: string; door: Door }, method: string, args?: Json) => {
    const sealed = await room.stranger(house.ward, tools.hex(secret), { method, ...(args === undefined ? {} : { args: tools.canonical(args) }) });
    const reply = await house.door(sealed.box);
    return { read: await room.strangerRead(house.ward, sealed.lid, reply), box: sealed.box };
  };
  return { ask, room };
};

test('Nothing speaks on the zero head where a house has no public being', async () => {
  const a = await open('a0', 'f'.repeat(64), false);
  const reply = await a.house.door(crypto.random(400));
  assert.ok(reply !== null && reply.length === 32 + 16 + 16 + 64, 'a stranger hears silence, sixteen bytes sealed and signed');
});

test('Public signup awaits its steward, and a stranger who asks twice holds one being', async () => {
  const a = await open('a1', 'a'.repeat(64), true);
  const b = await open('b1', 'b'.repeat(64), false);
  const alice = stranger();
  const { read } = await alice.ask(a.house, 'signup');
  assert.ok('object' in read, JSON.stringify(read));
  const { result } = read.object as { result: { invitation: string } };
  const standing = (await b.result('adopt', { invitation: result.invitation })) as string;
  const owner = (await b.result('relay', { standing })) as string;
  assert.match(owner, /^owner-[0-9a-f]{8}$/, 'the invitation reaches the member as the owner her steward invited');

  await alice.ask(a.house, 'signup');
  const members = ((await a.result('list')) as { id: string }[]).filter((being) => being.id.startsWith('member-'));
  assert.equal(members.length, 1);
});

test('The house answers a replayed stranger’s box from a cache', async () => {
  const a = await open('a2', 'c'.repeat(64), true);
  const bob = stranger();
  const first = await bob.ask(a.house, 'signup');
  const again = await a.house.door(first.box);
  assert.ok(again !== null);
  assert.equal((await a.result('list') as unknown[]).length, 3, 'the steward, the lobby and one member: nothing ran twice');
});

test('Where memory refuses the public being’s write, the zero head answers nothing', async () => {
  const a = await open('a4', 'e'.repeat(64), true);
  const carol = stranger();
  a.memory.refuseNext();
  assert.deepEqual((await carol.ask(a.house, 'visit')).read, { nothing: true });
  const { read } = await carol.ask(a.house, 'visit');
  assert.ok('object' in read);
  assert.deepEqual(read.object, { result: 1 }, 'the number went unspent, and asking again lands once');
});

test('An ask a stranger reaches is idempotent, or it is not shown to them', async () => {
  const a = await open('a3', 'd'.repeat(64), true);
  const { read } = await stranger().ask(a.house, 'effect');
  assert.ok('object' in read);
  assert.deepEqual(read.object, { error: { message: 'no such ask' } });
});

test('A stranger is told what they may ask, and not her kind or her description', async () => {
  const a = await open('a4', 'e'.repeat(64), true);
  const { room } = stranger();
  const sealed = await room.stranger(a.house.ward, tools.hex(crypto.random(32)), {});
  const read = await room.strangerRead(a.house.ward, sealed.lid, await a.house.door(sealed.box));
  assert.ok('object' in read);
  const describe = read.object as { kind?: string; description?: string; asks: { method: string }[] };
  assert.equal(describe.kind, undefined);
  assert.equal(describe.description, undefined);
  assert.deepEqual(
    describe.asks.map((entry) => entry.method),
    ['signup', 'visit'],
  );
});
