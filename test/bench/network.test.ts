// Grounds on one FakeNetwork: a being's code is the same in one house, in
// two houses of one ground and on two grounds, and the network cuts, loses,
// turns off and moves as the world does.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BenchGround, FakeNetwork } from 'nervur/bench';
import * as shop from '../fixtures/world/shop.ts';

const modules = { shop };

const world = async () => {
  const network = new FakeNetwork();
  const acme = await BenchGround.open({ network, host: 'acme', names: ['acme.com'], modules });
  const home = await BenchGround.open({ network, host: 'alice-home', names: ['alice.home'], modules });
  const phone = await BenchGround.open({ network, host: 'alice-phone', modules });
  return { network, acme, home, phone };
};

const bear = (ground: BenchGround, house: string, kind: string, id: string) => ground.ask({ house, method: 'bear', args: { kind: `org.example.${kind}`, id } });

// A host's door handed to a guest: the host's steward mints it, the guest's owner lands it.
const link = async (from: { ground: BenchGround; house: string; host: string }, to: { ground: BenchGround; house: string; guest: string }) => {
  const offered = await from.ground.ask({ house: from.house, method: 'offerFor', args: { being: from.host, occupant: to.guest } });
  assert.ok('result' in offered, JSON.stringify(offered));
  const { handle } = offered.result as { handle: string };
  const taken = await to.ground.ask({ house: to.house, id: to.guest, method: 'accept', args: { invitation: handle } });
  assert.ok('result' in taken, JSON.stringify(taken));
};

const greet = (ground: BenchGround, house: string, guest: string) => ground.ask({ house, id: guest, method: 'greetHost' });

test('The asker’s id is true: one class greets the same in one house, in two houses of a ground, and across grounds', async () => {
  const { acme, home } = await world();
  await home.add('home', 'shop');
  await home.add('studio', 'shop');
  await acme.add('store', 'shop');
  for (const [ground, house, kind, id] of [
    [home, 'home', 'guest', 'near'],
    [home, 'home', 'guest', 'side'],
    [home, 'home', 'guest', 'far'],
    [home, 'home', 'host', 'dave'],
    [home, 'studio', 'host', 'carol'],
    [acme, 'store', 'host', 'bob'],
  ] as const)
    await bear(ground, house, kind, id);
  await link({ ground: home, house: 'home', host: 'dave' }, { ground: home, house: 'home', guest: 'near' });
  await link({ ground: home, house: 'studio', host: 'carol' }, { ground: home, house: 'home', guest: 'side' });
  await link({ ground: acme, house: 'store', host: 'bob' }, { ground: home, house: 'home', guest: 'far' });
  assert.deepEqual(await greet(home, 'home', 'near'), { result: 'dave greets near' }, 'in one house');
  assert.deepEqual(await greet(home, 'home', 'side'), { result: 'carol greets side' }, 'in two houses of one ground');
  assert.deepEqual(await greet(home, 'home', 'far'), { result: 'bob greets far' }, 'across two grounds');
});

test('A device asks a station, and a station cannot ask a device', async () => {
  const { acme, phone } = await world();
  await acme.add('store', 'shop');
  await phone.add('pocket', 'shop');
  await bear(acme, 'store', 'host', 'bob');
  await bear(acme, 'store', 'guest', 'clerk');
  await bear(phone, 'pocket', 'guest', 'alice');
  await bear(phone, 'pocket', 'host', 'pat');
  await link({ ground: acme, house: 'store', host: 'bob' }, { ground: phone, house: 'pocket', guest: 'alice' });
  await link({ ground: phone, house: 'pocket', host: 'pat' }, { ground: acme, house: 'store', guest: 'clerk' });
  assert.deepEqual(await greet(phone, 'pocket', 'alice'), { result: 'bob greets alice' }, 'the device dials');
  assert.ok('error' in (await greet(acme, 'store', 'clerk')), 'no one dials the device');
});

test('A cut stops a far ask until it heals, and a lost reply is a failure the next ask outlives', async () => {
  const { network, acme, home } = await world();
  await acme.add('store', 'shop');
  await home.add('home', 'shop');
  await bear(acme, 'store', 'host', 'bob');
  await bear(home, 'home', 'guest', 'alice');
  await link({ ground: acme, house: 'store', host: 'bob' }, { ground: home, house: 'home', guest: 'alice' });

  network.partition('acme', 'alice-home');
  assert.ok('error' in (await greet(home, 'home', 'alice')), 'cut');
  network.heal();
  assert.deepEqual(await greet(home, 'home', 'alice'), { result: 'bob greets alice' }, 'healed');

  network.loseNext();
  assert.ok('error' in (await greet(home, 'home', 'alice')), 'the reply was lost');
  assert.deepEqual(await greet(home, 'home', 'alice'), { result: 'bob greets alice' }, 'and the next one arrives');
});

test('A ground turned off and on keeps its houses, and moved to another host it keeps its wards', async () => {
  const { network, acme, home } = await world();
  const store = await acme.add('store', 'shop');
  await home.add('home', 'shop');
  await bear(acme, 'store', 'host', 'bob');
  await bear(home, 'home', 'guest', 'alice');
  await link({ ground: acme, house: 'store', host: 'bob' }, { ground: home, house: 'home', guest: 'alice' });

  await acme.down();
  assert.ok('error' in (await greet(home, 'home', 'alice')), 'off');
  await acme.up();
  assert.deepEqual(await greet(home, 'home', 'alice'), { result: 'bob greets alice' }, 'on again');

  await acme.down();
  const moved = await BenchGround.open({ network, host: 'acme-new', names: ['acme.net'], modules, machine: acme.machine });
  network.point('acme.com', 'acme-new');
  assert.equal(moved.list()[0]?.ward, store.ward, 'the same ward on another host');
  assert.deepEqual(await greet(home, 'home', 'alice'), { result: 'bob greets alice' }, 'the name followed it');
});
