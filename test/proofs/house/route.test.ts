// A standing keeps its route: the address of the far ward that last
// answered, where each ask goes first. It is pinned only by a reply that
// opened as the far ward's, it survives a restart, and a box that may have
// been heard goes to no second address.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClassList, House, SeedKeys } from 'nervur';
import { FakeCarry, FakeClock, FakeMemory } from 'nervur/bench';
import type { Door } from '../../../src/bench/fake-carry.ts';
import { Steward } from '../../fixtures/world/steward.ts';

// A far house reached at `fake://far`, whose invitations name `at` in that order.
const far = async (network: Map<string, Door>, at: readonly string[]) => {
  const carry = new FakeCarry({ network, address: 'fake://far', at });
  const house = await House.open({ keys: new SeedKeys('3'.repeat(64)), memory: new FakeMemory(), classes: new ClassList({ steward: Steward }), carry, clock: new FakeClock() });
  carry.listen(house);
  const offered = await house.ask({ method: 'offer' });
  assert.ok('result' in offered);
  return (offered.result as { handle: string }).handle;
};

// A near house holding a standing on the far one, over its own carry.
const near = async (network: Map<string, Door>, memory = new FakeMemory()) => {
  const carry = new FakeCarry({ network, address: 'fake://near' });
  const house = await House.open({ keys: new SeedKeys('4'.repeat(64)), memory, classes: new ClassList({ steward: Steward }), carry, clock: new FakeClock() });
  const result = async (method: string, args: Record<string, string>) => {
    const answer = await house.ask({ method, args });
    assert.ok('result' in answer, JSON.stringify(answer));
    return answer.result;
  };
  return { carry, result, memory };
};

const nothing: Door = async () => null;
const liar: Door = async () => new Uint8Array(200).fill(7);

test('The first address that answers is pinned, and every later ask goes there first', async () => {
  const network = new Map<string, Door>([['fake://dead', nothing]]);
  const invitation = await far(network, ['fake://dead', 'fake://far']);
  const { carry, result } = await near(network);
  const standing = (await result('adopt', { invitation })) as string;

  assert.equal(await result('relay', { standing }), 'far');
  // The describe `held` reads first goes in the invitation's order, passes the
  // address that did not hear, and pins the one that answered; the ask follows it.
  assert.deepEqual(carry.tried, ['fake://dead', 'fake://far', 'fake://far']);
  carry.tried.length = 0;
  assert.equal(await result('relay', { standing }), 'far');
  assert.deepEqual(carry.tried, ['fake://far'], 'the pinned address first, and alone where it answers');
});

test('A route survives a restart: it lands with the standing’s move', async () => {
  const network = new Map<string, Door>([['fake://dead', nothing]]);
  const invitation = await far(network, ['fake://dead', 'fake://far']);
  const first = await near(network);
  const standing = (await first.result('adopt', { invitation })) as string;
  assert.equal(await first.result('relay', { standing }), 'far');

  const again = await near(network, first.memory);
  assert.equal(await again.result('relay', { standing }), 'far');
  assert.deepEqual(again.carry.tried, ['fake://far', 'fake://far'], 'the describe and the ask, both to the route, never to the dead address');
});

test('A pinned address that stops answering unheard gives way to the invitation’s order, and the next that answers is pinned', async () => {
  const network = new Map<string, Door>();
  const invitation = await far(network, ['fake://far', 'fake://also']);
  network.set('fake://also', network.get('fake://far')!);
  const { carry, result } = await near(network);
  const standing = (await result('adopt', { invitation })) as string;
  assert.equal(await result('relay', { standing }), 'far');

  const door = network.get('fake://far')!;
  network.set('fake://far', nothing);
  carry.tried.length = 0;
  assert.equal(await result('relay', { standing }), 'far');
  assert.deepEqual(carry.tried, ['fake://far', 'fake://also']);

  network.set('fake://far', door);
  carry.tried.length = 0;
  assert.equal(await result('relay', { standing }), 'far');
  assert.deepEqual(carry.tried, ['fake://also'], 'the address that answered last is the route now');
});

test('A reply that does not open as the far ward’s pins nothing', async () => {
  const network = new Map<string, Door>([['fake://liar', liar]]);
  // The far door comes first in the invitation, and is away for the first ask.
  const invitation = await far(network, ['fake://far', 'fake://liar']);
  const farDoor = network.get('fake://far')!;
  network.delete('fake://far');
  const { carry, result } = await near(network);
  const standing = (await result('adopt', { invitation })) as string;
  const answer = await result('relay', { standing }).catch((error: Error) => error.message);
  assert.notEqual(answer, 'far', 'the liar answered bytes no key of the far ward sealed');
  network.set('fake://far', farDoor);
  carry.tried.length = 0;
  // The liar may have heard the knock, so the next send is the ask under its key, which the far door never bound.
  await result('relay', { standing }).catch(() => undefined);
  assert.equal(carry.tried[0], 'fake://far', 'the liar was not pinned, so the invitation’s order stands');
  assert.equal(await result('relay', { standing }), 'far', 'then the knock again, and the far door binds it');
});

test('A ward that moves tells its holder in the next reply, once, and the holder follows it when the old address dies', async () => {
  const network = new Map<string, Door>();
  const at = ['fake://far'];
  const invitation = await far(network, at);
  const farDoor = network.get('fake://far')!;
  // The length of each reply the far door gives: one that carries `at` is longer.
  const lengths: number[] = [];
  const watched: Door = async (box) => {
    const reply = await farDoor(box);
    if (reply !== null) lengths.push(reply.length);
    return reply;
  };
  network.set('fake://far', watched);
  const { carry, result } = await near(network);
  const standing = (await result('adopt', { invitation })) as string;
  assert.equal(await result('relay', { standing }), 'far');
  const plain = lengths.at(-1)!;

  // The far ground moves: it answers at a new address too, and names only that one.
  network.set('fake://moved', watched);
  at.splice(0, 1, 'fake://moved');
  assert.equal(await result('relay', { standing }), 'far');
  assert.ok(lengths.at(-1)! > plain, 'the reply carried where the ward is reached now');
  assert.equal(await result('relay', { standing }), 'far');
  assert.equal(lengths.at(-1), plain, 'the holder was told once, and the next reply carries nothing more');

  network.delete('fake://far');
  carry.tried.length = 0;
  assert.equal(await result('relay', { standing }), 'far', 'the old address is gone, and the holder reaches the new one');
  assert.deepEqual(carry.tried, ['fake://moved']);
});

test('A box that may have been heard at the route goes to no second address', async () => {
  const network = new Map<string, Door>();
  const invitation = await far(network, ['fake://far', 'fake://also']);
  network.set('fake://also', network.get('fake://far')!);
  const { carry, result } = await near(network);
  const standing = (await result('adopt', { invitation })) as string;
  assert.equal(await result('relay', { standing }), 'far');

  carry.lose = 1;
  carry.tried.length = 0;
  await result('relay', { standing }).catch(() => undefined);
  assert.deepEqual(carry.tried, ['fake://far']);
});
