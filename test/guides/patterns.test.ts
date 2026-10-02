// The species guide's patterns, each proven as its author would prove it:
// a saga against stand-ins, a team and an index alone and as households, and a club
// that checks who took its invitation.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Bench } from 'nervur/bench';
import { Club, Guest } from '../fixtures/guides/patterns/club.ts';
import { Listing, Search } from '../fixtures/guides/patterns/search.ts';
import { Clerk, Manager } from '../fixtures/guides/patterns/team.ts';
import { Flight, Hotel, Trip } from '../fixtures/guides/patterns/trip.ts';

const pattern = (name: string) => new URL(`../fixtures/guides/patterns/${name}.ts`, import.meta.url);

const trip = async (t: { after: (fn: () => Promise<void>) => void }) => {
  const bench = await Bench.open({
    module: pattern('trip'),
    standIns: { hotel: { need: Hotel, module: pattern('hotel') }, flight: { need: Flight, module: pattern('flight') } },
  });
  t.after(() => bench.close());
  return { bench, placed: await bench.place(Trip) };
};

test('Each pattern species keeps her table alone', async () => {
  await Bench.check(Trip, { module: pattern('trip') });
  await Bench.check(Club, { module: pattern('club') });
  await Bench.check(Guest, { module: pattern('club') });
});

test('A saga books its trip one effect at a time', async (t) => {
  const { bench, placed } = await trip(t);
  assert.deepEqual(await placed.ask('book', { seats: 2 }), { result: null });
  await bench.settle();
  assert.equal((await placed.describe())?.state, 'booked');
  assert.deepEqual(
    (await bench.heard('flight')).map(({ method }) => method),
    ['book'],
  );
});

test('A saga undoes the step before the one that failed', async (t) => {
  const { bench, placed } = await trip(t);
  await placed.ask('book', { seats: 9 });
  await bench.settle();
  assert.equal((await placed.describe())?.state, 'planning');
  assert.deepEqual(
    (await bench.heard('hotel')).map(({ method }) => method),
    ['hold', 'release'],
  );
});

test('A clerk answers her manager with an effect, so no awaited call comes back into its chain', async () => {
  await Bench.household({
    module: pattern('team'),
    beings: { manager: Manager, clerk: Clerk },
    introduce: [
      ['manager', 'clerk'],
      ['clerk', 'manager'],
    ],
  });
});

test('A team and an index work alone, on one bench that introduces them', async (t) => {
  const bench = await Bench.open({ module: pattern('team') });
  t.after(() => bench.close());
  const manager = await bench.place(Manager, { id: 'manager' });
  await bench.introduce(manager, await bench.place(Clerk, { id: 'clerk' }));
  await bench.introduce('clerk', manager);
  assert.deepEqual(await manager.ask('assign', { job: 'file' }), { result: 'on it: file' });
  assert.deepEqual(await manager.ask('report'), { result: ['file'] });

  const index = await Bench.open({ module: pattern('search') });
  t.after(() => index.close());
  const search = await index.place(Search, { id: 'search' });
  for (const [id, price] of [['flat', 3], ['loft', 2]] as const) {
    const listing = await index.place(Listing, { id });
    await index.introduce(listing, search);
    assert.deepEqual(await listing.ask('price', { price }), { result: null });
  }
  assert.deepEqual(await search.ask('cheapest'), { result: ['being:loft', 'being:flat'] }, 'each listing asks as the being she is');
});

test('An index answers a question across beings, and keeps its table as a household', async () => {
  await Bench.household({
    module: pattern('search'),
    beings: { search: Search, flat: Listing, loft: Listing },
    introduce: [
      ['flat', 'search'],
      ['loft', 'search'],
    ],
  });
});

test('A club admits whoever took its invitation only once they show its pin', async (t) => {
  const bench = await Bench.open({ module: pattern('club') });
  t.after(() => bench.close());
  const club = await bench.place(Club);
  const guest = await bench.place(Guest);
  const invited = await club.ask('admit', { name: 'ada' });
  assert.ok(invited !== null && 'result' in invited, JSON.stringify(invited));
  const { invitation, pin } = invited.result as { invitation: string; pin: string };

  assert.deepEqual(await guest.ask('join', { invitation }), { result: null });
  const early = await guest.ask('enter');
  assert.match(early !== null && 'error' in early ? early.error.message : '', /offers no enter/, 'a guest is shown no enter before the pin');
  assert.deepEqual(await guest.ask('claim', { pin: '00000000' }), { error: { message: 'That is not the pin.' } });
  assert.deepEqual(await guest.ask('claim', { pin }), { result: null });
  assert.deepEqual(await guest.ask('enter'), { result: 'Welcome, ada.' });
});
