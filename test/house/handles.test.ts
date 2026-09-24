// A door on one ask with its args bound, held in a far house. Its holder
// reads the args she sends, never the ones the bind fixes. A far standing
// she takes is hers to ask from her next ask, and one asked in the ask that
// took it is refused by name, since its knock would spend the heir on an ask
// that may land nothing.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BenchGround, FakeNetwork } from 'nervur/bench';
import type { Json } from 'nervur/being';
import { home, shop } from '../fixtures/world/booker.ts';

const open = async (t: { after(done: () => unknown): void }) => {
  const network = new FakeNetwork();
  const shops = await BenchGround.open({ network, host: 'shop', names: ['shop.example'], modules: { shop } });
  t.after(() => shops.down());
  const homes = await BenchGround.open({ network, host: 'home', modules: { home } });
  t.after(() => homes.down());
  await shops.add('shop');
  await homes.add('home');
  await shops.ask({ house: 'shop', method: 'bear', args: { kind: 'org.example.booker', id: 'booker' } });
  await homes.ask({ house: 'home', method: 'bear', args: { kind: 'org.example.planner', id: 'planner' } });
  const book = async (what: string) => {
    const booked = await shops.ask({ house: 'shop', id: 'booker', method: 'book', args: { what, date: '2026-10-10' } });
    assert.ok('result' in booked, JSON.stringify(booked));
    return (booked.result as { door: string }).door;
  };
  const planner = (method: string, args?: Json) => homes.ask({ house: 'home', id: 'planner', method, ...(args === undefined ? {} : { args }) });
  return { network, shops, book, planner };
};

test('A handle’s holder reads the args she sends, and the bind fills the rest', async (t) => {
  const { network, shops, book, planner } = await open(t);
  assert.deepEqual(await planner('take', { booking: await book('rings') }), { result: null });
  assert.deepEqual(await planner('shows'), { result: ['date', 'date!'] }, 'what the bind fixes is shown to no one');
  assert.deepEqual(await planner('move', { date: '2026-11-14' }), { result: null });
  await network.settle();
  assert.deepEqual(await shops.ask({ house: 'shop', id: 'booker', method: 'bookings' }), { result: ['rings@2026-11-14'] });
});

test('It refuses a far standing asked in the ask that took it', async (t) => {
  const { book, planner } = await open(t);
  const booking = await book('venue');
  const refused = await planner('takeAndMove', { booking, date: '2026-11-14' });
  assert.ok('error' in refused && /^standing:[0-9a-f]{16} was taken in this ask, and is asked from the next$/.test(refused.error.message), JSON.stringify(refused));
  assert.deepEqual(await planner('take', { booking }), { result: null }, 'nothing was spent, so the next ask takes it');
  assert.deepEqual(await planner('move', { date: '2026-11-14' }), { result: null });
});
