// The guides' shop as a ground holds it: its folder of code and its recipe's
// faculties. Its steward opens orders by the hand and hires a courier for
// one, and its lobby enrols a stranger once, however often they ask.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Bench, BenchGround, FakeClock, FakeNetwork } from 'nervur/bench';
import { FolderClasses } from 'nervur/node';
import { Lobby } from '../fixtures/guides/classes/lobby.ts';
import { Order } from '../fixtures/guides/classes/order.ts';
import { Shop } from '../fixtures/guides/classes/shop.ts';
import { Payments, paymentsOffer } from '../fixtures/guides/payments.ts';
import { faculties } from '../fixtures/guides/recipe.ts';
import { Depot } from '../fixtures/world/depot.ts';
import { Steward } from '../fixtures/world/steward.ts';

type Json = NonNullable<Parameters<BenchGround['ask']>[0]['args']>;

// The shop's ground, its code taken from the guides' folder as `nervur up` takes it, and the courier's beside it.
const world = async () => {
  const clock = new FakeClock();
  const network = new FakeNetwork({ clock });
  const shop = await BenchGround.open({
    network,
    clock,
    host: 'shop',
    names: ['shop.example'],
    faculties: faculties(),
    bodies: { classes: { folder: () => FolderClasses.open(new URL('../fixtures/guides/classes/', import.meta.url)) } },
  });
  await shop.add('shop', { memory: { body: 'fake' }, classes: { body: 'folder' }, faculties: ['payments'] });
  const courier = await BenchGround.open({ network, clock, host: 'courier', names: ['courier.example'], modules: { courier: { steward: Steward, beings: [Depot] } } });
  await courier.add('courier');
  const ask = (method: string, args: Json = {}) => shop.ask({ house: 'shop', method, args });
  const result = async (method: string, args: Json = {}) => {
    const answer = await ask(method, args);
    assert.ok('result' in answer, JSON.stringify(answer));
    return answer.result;
  };
  return { ask, result, courier };
};

test('The shop’s steward opens an order by the hand, and hands back its owner’s invitation', async () => {
  const { result } = await world();
  const { owner } = (await result('open', { id: 'first' })) as { owner: string };
  assert.match(owner, /^[0-9a-f]+$/, 'the invitation leaves the hand as hex');
  assert.deepEqual(await result('orders'), ['first']);
});

test('A stranger signs up at the lobby, and asking twice holds one order', async () => {
  const bench = await Bench.open({ classes: [Order], steward: Shop, public: Lobby, offers: [paymentsOffer(new Payments())] });
  const shop = await bench.place(Shop);
  const lobby = await bench.place(Lobby);
  const signup = async () => {
    const answer = await lobby.ask('signup');
    assert.ok(answer !== null && 'result' in answer, JSON.stringify(answer));
    return (answer.result as { invitation: string }).invitation;
  };
  assert.match(await signup(), /^[0-9a-f]+$/);
  await signup();
  assert.equal(((await shop.ask('orders')) as { result: string[] }).result.length, 1);
});

test('The owner hires a courier for an order by the hand: the steward hands the paper on, and the order takes it once', async () => {
  const { ask, result, courier } = await world();
  // The courier's own house gives the shop a paper on its depot.
  await courier.ask({ house: 'courier', method: 'bear', args: { kind: 'com.acme.depot', id: 'depot' } });
  const paper = (await courier.ask({ house: 'courier', method: 'offerFor', args: { being: 'depot', occupant: 'client-shop' } })) as { result: { handle: string } };

  await result('open', { id: 'first' });
  const standing = await result('hire', { order: 'first', courier: paper.result.handle });
  assert.match(standing as string, /^standing:[0-9a-f]{16}$/, 'the order holds the courier as a standing of her own');
  assert.equal(await result('hire', { order: 'first', courier: paper.result.handle }), standing, 'hired twice, the same standing');
  assert.ok('error' in (await ask('hire', { order: 'nobody', courier: paper.result.handle })), 'an order that is not there takes nothing');
});
