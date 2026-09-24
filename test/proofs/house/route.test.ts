// A standing keeps its route: the address of the far ward that last
// answered, where each ask goes first. It is pinned only by a reply that
// opened as the far ward's, it survives a restart, and a box that may have
// been heard goes to no second address.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClassList, House, SeedKeys } from 'nervur';
import { FakeNetwork } from 'nervur/bench';
import { FakeClock } from '../../../src/bench/fake-clock.ts';
import { FakeMemory } from '../../../src/bench/fake-memory.ts';
import type { Door } from '../../../src/ground/ground.ts';
import { Steward } from '../../fixtures/world/steward.ts';

// A far house on its host, whose invitations and replies name `names` in
// that order, as a ground names its addresses, whichever host each points at.
const far = async (network: FakeNetwork, names: string[], host = 'far') => {
  const carry = { ...network.join(host, { names }), at: () => names.map((name) => `bench://${name}`) };
  const house = await House.open({ keys: new SeedKeys('3'.repeat(64)), memory: new FakeMemory(), classes: new ClassList({ steward: Steward }), carry, clock: new FakeClock() });
  carry.listen(house);
  const offered = await house.ask({ method: 'offer' });
  assert.ok('result' in offered);
  return { invitation: (offered.result as { handle: string }).handle, house, carry };
};

// A near house on the host `near`, holding a standing on the far one.
const near = async (network: FakeNetwork, memory = new FakeMemory()) => {
  const carry = network.join('near');
  const house = await House.open({ keys: new SeedKeys('4'.repeat(64)), memory, classes: new ClassList({ steward: Steward }), carry, clock: new FakeClock() });
  const result = async (method: string, args: Record<string, string>) => {
    const answer = await house.ask({ method, args });
    assert.ok('result' in answer, JSON.stringify(answer));
    return answer.result;
  };
  return { result, memory };
};

// Each host the near house's boxes reached since the crossing `since`, in order.
const tried = (network: FakeNetwork, since = 0) =>
  network.crossings
    .slice(since)
    .filter((crossing) => crossing.from === 'near')
    .map((crossing) => crossing.to);

// A host of its own, answering the far ward with `door` under `name`.
const other = (network: FakeNetwork, name: string, ward: string, door: Door) => {
  network.join(name).listen({ ward, door });
  network.point(name, name);
};

const nothing: Door = async () => null;
const liar: Door = async () => new Uint8Array(200).fill(7);

test('The first address that answers is pinned, and every later ask goes there first', async () => {
  const network = new FakeNetwork();
  const { invitation, house } = await far(network, ['dead', 'far']);
  other(network, 'dead', house.ward, nothing);
  const { result } = await near(network);
  const standing = (await result('adopt', { invitation })) as string;

  assert.equal(await result('relay', { standing }), 'far');
  // The describe `held` reads first goes in the invitation's order, passes the
  // address that did not hear, and pins the one that answered; the ask follows it.
  assert.deepEqual(tried(network), ['dead', 'far', 'far']);
  const since = network.crossings.length;
  assert.equal(await result('relay', { standing }), 'far');
  assert.deepEqual(tried(network, since), ['far'], 'the pinned address first, and alone where it answers');
});

test('A route survives a restart: it lands with the standing’s move', async () => {
  const network = new FakeNetwork();
  const { invitation, house } = await far(network, ['dead', 'far']);
  other(network, 'dead', house.ward, nothing);
  const first = await near(network);
  const standing = (await first.result('adopt', { invitation })) as string;
  assert.equal(await first.result('relay', { standing }), 'far');

  const since = network.crossings.length;
  const again = await near(network, first.memory);
  assert.equal(await again.result('relay', { standing }), 'far');
  assert.deepEqual(tried(network, since), ['far', 'far'], 'the describe and the ask, both to the route, never to the dead address');
});

test('A pinned address that stops answering unheard gives way to the invitation’s order, and the next that answers is pinned', async () => {
  const network = new FakeNetwork();
  const { invitation, house, carry } = await far(network, ['far', 'also']);
  other(network, 'also', house.ward, (box) => house.door(box));
  const { result } = await near(network);
  const standing = (await result('adopt', { invitation })) as string;
  assert.equal(await result('relay', { standing }), 'far');

  carry.listen({ ward: house.ward, door: nothing });
  let since = network.crossings.length;
  assert.equal(await result('relay', { standing }), 'far');
  assert.deepEqual(tried(network, since), ['far', 'also']);

  carry.listen(house);
  since = network.crossings.length;
  assert.equal(await result('relay', { standing }), 'far');
  assert.deepEqual(tried(network, since), ['also'], 'the address that answered last is the route now');
});

test('A reply that does not open as the far ward’s pins nothing', async () => {
  const network = new FakeNetwork();
  // The far door comes first in the invitation, and is away for the first ask.
  const { invitation, house, carry } = await far(network, ['far', 'liar']);
  other(network, 'liar', house.ward, liar);
  carry.unlisten({ ward: house.ward });
  const { result } = await near(network);
  const standing = (await result('adopt', { invitation })) as string;
  const answer = await result('relay', { standing }).catch((error: Error) => error.message);
  assert.notEqual(answer, 'far', 'the liar answered bytes no key of the far ward sealed');
  carry.listen(house);
  const since = network.crossings.length;
  // The liar may have heard the knock, so the next send is the ask under its key, which the far door never bound.
  await result('relay', { standing }).catch(() => undefined);
  assert.equal(tried(network, since)[0], 'far', 'the liar was not pinned, so the invitation’s order stands');
  assert.equal(await result('relay', { standing }), 'far', 'then the knock again, and the far door binds it');
});

test('A ward that moves tells its holder in the next reply, once, and the holder follows it when the old address dies', async () => {
  const network = new FakeNetwork();
  const names = ['far'];
  const { invitation, house, carry } = await far(network, names, 'home');
  // The length of each reply the far door gives: one that carries `at` is longer.
  const lengths: number[] = [];
  const watched: Door = async (box) => {
    const reply = await house.door(box);
    if (reply !== null) lengths.push(reply.length);
    return reply;
  };
  carry.listen({ ward: house.ward, door: watched });
  const { result } = await near(network);
  const standing = (await result('adopt', { invitation })) as string;
  assert.equal(await result('relay', { standing }), 'far');
  const plain = lengths.at(-1)!;

  // The far ground moves: the old name still answers from a host of its own, and the ward names only the new one.
  other(network, 'old', house.ward, watched);
  network.point('far', 'old');
  network.point('moved', 'home');
  names.splice(0, 1, 'moved');
  assert.equal(await result('relay', { standing }), 'far');
  assert.ok(lengths.at(-1)! > plain, 'the reply carried where the ward is reached now');
  assert.equal(await result('relay', { standing }), 'far');
  assert.equal(lengths.at(-1), plain, 'the holder was told once, and the next reply carries nothing more');

  network.down('old');
  const since = network.crossings.length;
  assert.equal(await result('relay', { standing }), 'far', 'the old address is gone, and the holder reaches the new one');
  assert.deepEqual(tried(network, since), ['home']);
});

test('A box that may have been heard at the route goes to no second address', async () => {
  const network = new FakeNetwork();
  const { invitation, house } = await far(network, ['far', 'also']);
  other(network, 'also', house.ward, (box) => house.door(box));
  const { result } = await near(network);
  const standing = (await result('adopt', { invitation })) as string;
  assert.equal(await result('relay', { standing }), 'far');

  network.loseNext();
  const since = network.crossings.length;
  await result('relay', { standing }).catch(() => undefined);
  assert.deepEqual(tried(network, since), ['far']);
});
