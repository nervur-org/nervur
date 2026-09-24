// The ground opens its own custody and memory first, keeps a record of its
// houses, opens each on the bodies its entry names, and closes a house
// through those bodies.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClassList, Ground, type Bodies, type Faculty } from 'nervur';
import { FakeNetwork } from 'nervur/bench';
import { FakeClock } from '../../../src/bench/fake-clock.ts';
import { FakeCustody } from '../../../src/bench/fake-custody.ts';
import { FakeMemory } from '../../../src/bench/fake-memory.ts';
import { Counter } from '../../fixtures/world/counter.ts';
import { Guest } from '../../fixtures/world/guest.ts';
import { Host } from '../../fixtures/world/host.ts';
import { Pilot, Stowaway } from '../../fixtures/world/pilot.ts';
import { Steward } from '../../fixtures/world/steward.ts';

// The classes each house may be handed, by the name its entry gives them.
const SETS: Record<string, ClassList> = {
  shop: new ClassList({ steward: Steward, beings: [Host, Counter] }),
  home: new ClassList({ steward: Steward, beings: [Guest] }),
  control: new ClassList({ steward: Steward, beings: [Pilot, Stowaway] }),
};

// One machine: its custody, its own memory, the memory of each house and one clock, kept across two opens.
const machine = () => {
  const memories = new Map<string, FakeMemory>();
  const bodies: Bodies = {
    memory: { fake: ({ house }) => memories.get(house) ?? memories.set(house, new FakeMemory()).get(house)! },
    classes: {
      list: ({ args }) => {
        const set = SETS[args.set as string];
        if (set === undefined) throw new Error(`no set ${String(args.set)}`);
        return set;
      },
    },
  };
  const custody = new FakeCustody('ground');
  const memory = new FakeMemory();
  const clock = new FakeClock();
  const open = (faculties: Record<string, Faculty> = {}, houses?: { kinds: readonly string[] }) =>
    Ground.open({ custody, memory, carry: new FakeNetwork().join('ground'), bodies, faculties, clock, ...(houses === undefined ? {} : { houses }) });
  return { open, clock, bodies };
};

const entry = (set: string, faculties?: string[]) => ({ memory: { body: 'fake' }, classes: { body: 'list', set }, ...(faculties === undefined ? {} : { faculties }) });

test('A ground opens every house of its record again, on the same wards', async () => {
  const { open } = machine();
  const first = await open();
  const shop = await first.add('shop', entry('shop'));
  const home = await first.add('home', entry('home'));
  assert.ok(shop.ward !== undefined && home.ward !== undefined && shop.ward !== home.ward);
  assert.ok('result' in (await first.ask({ house: 'shop', method: 'bear', args: { kind: 'org.example.host', id: 'bob' } })));
  await first.close();

  const second = await open();
  assert.deepEqual(
    second.list().map(({ name, ward }) => ({ name, ward })),
    [
      { name: 'shop', ward: shop.ward },
      { name: 'home', ward: home.ward },
    ],
  );
  assert.deepEqual(await second.ask({ house: 'shop', id: 'bob', method: 'greet' }), { result: 'bob greets root' }, 'his memory stayed');
  await second.close();
});

test('A ground woken per event opens a house only when a box or the hand reaches it', async () => {
  const { bodies } = machine();
  const custody = new FakeCustody('lazy');
  const memory = new FakeMemory();
  let opened = 0;
  const counted: Bodies = { ...bodies, classes: { list: (made) => (opened++, bodies.classes.list(made)) } };
  const open = () => Ground.open({ custody, memory, carry: new FakeNetwork().join('lazy'), bodies: counted, lazy: true });
  const first = await open();
  const shop = await first.add('shop', entry('shop'));
  const home = await first.add('home', entry('home'));
  assert.ok('result' in (await first.ask({ house: 'shop', method: 'bear', args: { kind: 'org.example.host', id: 'bob' } })));
  assert.ok('result' in (await first.ask({ house: 'home', method: 'bear', args: { kind: 'org.example.guest', id: 'alice' } })));
  const offered = await first.ask({ house: 'shop', method: 'offerFor', args: { being: 'bob', occupant: 'alice' } });
  assert.ok('result' in offered);
  assert.ok('result' in (await first.ask({ house: 'home', id: 'alice', method: 'accept', args: { invitation: (offered.result as { handle: string }).handle } })));
  await first.close();

  opened = 0;
  const second = await open();
  assert.equal(opened, 0, 'no house opened at the boot');
  assert.deepEqual(
    second.list().map(({ name, ward }) => ({ name, ward })),
    [
      { name: 'shop', ward: shop.ward },
      { name: 'home', ward: home.ward },
    ],
    'each stands with its ward, unopened',
  );
  // The hand opens home; her ask sends a box to shop's ward, whose door opens shop.
  assert.deepEqual(await second.ask({ house: 'home', id: 'alice', method: 'greetHost' }), { result: 'bob greets alice' });
  assert.equal(opened, 2, 'each opened once, when it was reached');
  await second.close();

  opened = 0;
  const third = await open();
  await third.wake();
  assert.equal(opened, 2, 'a wake opens every one');
  await third.close();
});

test('Two houses of one ground reach each other by pointer', async () => {
  const { open } = machine();
  const ground = await open();
  await ground.add('shop', entry('shop'));
  await ground.add('home', entry('home'));
  await ground.ask({ house: 'shop', method: 'bear', args: { kind: 'org.example.host', id: 'bob' } });
  await ground.ask({ house: 'home', method: 'bear', args: { kind: 'org.example.guest', id: 'alice' } });
  const offered = await ground.ask({ house: 'shop', method: 'offerFor', args: { being: 'bob', occupant: 'alice' } });
  assert.ok('result' in offered);
  const { handle } = offered.result as { handle: string };
  assert.ok('result' in (await ground.ask({ house: 'home', id: 'alice', method: 'accept', args: { invitation: handle } })));
  assert.deepEqual(await ground.ask({ house: 'home', id: 'alice', method: 'greetHost' }), { result: 'bob greets alice' });
  await ground.close();
});

test('A removed house answers nothing, and added again it is the same ward with its memory', async () => {
  const { open } = machine();
  const ground = await open();
  const shop = await ground.add('shop', entry('shop'));
  await ground.ask({ house: 'shop', method: 'bear', args: { kind: 'org.example.host', id: 'bob' } });
  await ground.remove('shop');
  assert.deepEqual(ground.list(), []);
  assert.deepEqual(await ground.ask({ house: 'shop', id: 'bob', method: 'greet' }), { error: { message: 'no house shop is open here' } });
  const again = await ground.add('shop', entry('shop'));
  assert.equal(again.ward, shop.ward);
  assert.deepEqual(await ground.ask({ house: 'shop', id: 'bob', method: 'greet' }), { result: 'bob greets root' });
  await ground.close();
});

test('Another entry under a name the record holds is refused', async () => {
  const { open } = machine();
  const ground = await open();
  await ground.add('shop', entry('shop'));
  await assert.rejects(ground.add('shop', entry('home')), /the house shop stands with another entry/);
  await assert.rejects(ground.add('Shop!', entry('shop')), /a house is named with lowercase letters/);
  await ground.close();
});

test('A closed house keeps no wait on the ground’s clock', async () => {
  const { open, clock } = machine();
  const ground = await open();
  await ground.add('shop', entry('shop'));
  await ground.ask({ house: 'shop', method: 'bear', args: { kind: 'org.example.counter', id: 'c' } });
  await ground.ask({ house: 'shop', id: 'c', method: 'ring', args: { in: 60_000 } });
  assert.notEqual(clock.next(), null, 'her alarm waits on the clock');
  await ground.remove('shop');
  assert.equal(clock.next(), null, 'closing the house cancelled it');
  await ground.close();
});

test('A house whose entry names what the ground lacks stays closed, and says why', async () => {
  const { open } = machine();
  const ground = await open();
  const lacking = await ground.add('shop', entry('shop', ['stripe']));
  assert.equal(lacking.ward, undefined);
  assert.equal(lacking.why, 'no faculty stripe');
  const home = await ground.add('home', entry('home'));
  assert.ok(home.ward !== undefined, 'the others open');
  await ground.close();
});

test('The houses faculty reaches only the house its entry grants it to', async () => {
  const { open } = machine();
  const ground = await open();
  await ground.add('control', entry('control', ['houses']));
  await ground.add('plain', entry('control'));
  await ground.ask({ house: 'control', method: 'bear', args: { kind: 'org.example.pilot', id: 'pilot' } });
  await ground.ask({ house: 'plain', method: 'bear', args: { kind: 'org.example.pilot', id: 'pilot' } });

  const opened = await ground.ask({ house: 'control', id: 'pilot', method: 'open', args: { name: 'shop', set: 'shop' } });
  assert.ok('result' in opened);
  assert.equal(opened.result, ground.list().find(({ name }) => name === 'shop')?.ward);

  const refused = await ground.ask({ house: 'plain', id: 'pilot', method: 'open', args: { name: 'other', set: 'shop' } });
  assert.ok(!('result' in refused), 'a pilot without the grant is absent');
  assert.equal(
    ground.list().find(({ name }) => name === 'other'),
    undefined,
  );

  assert.ok('result' in (await ground.ask({ house: 'control', id: 'pilot', method: 'close', args: { name: 'shop' } })));
  assert.equal(
    ground.list().find(({ name }) => name === 'shop'),
    undefined,
  );
  await ground.close();
});

test('The owner grants houses by kinds to one pilot being alone', async (t) => {
  const { open } = machine();
  const ground = await open({}, { kinds: ['org.example.pilot'] });
  t.after(() => ground.close());
  await ground.add('control', entry('control', ['houses']));
  await ground.ask({ house: 'control', method: 'bear', args: { kind: 'org.example.pilot', id: 'pilot' } });
  await ground.ask({ house: 'control', method: 'bear', args: { kind: 'org.example.stowaway', id: 'stowaway' } });
  assert.ok('result' in (await ground.ask({ house: 'control', id: 'pilot', method: 'open', args: { name: 'shop', set: 'shop' } })));
  const refused = await ground.ask({ house: 'control', id: 'stowaway', method: 'open', args: { name: 'other', set: 'shop' } });
  assert.deepEqual(refused, { error: { message: 'no being stowaway is here' } }, 'a class the grant does not name is absent');
  assert.equal(
    ground.list().find(({ name }) => name === 'other'),
    undefined,
  );
});

test('The boot reads the record, then makes each faculty in its order, and one that fails stops it, named', async () => {
  const said: string[] = [];
  const kept = new FakeMemory();
  // Its own memory, which says when the record is read.
  const memory = {
    read: (options: { place: string }) => {
      said.push(`read ${options.place}`);
      return kept.read(options);
    },
    list: () => kept.list(),
    write: (options: Parameters<FakeMemory['write']>[0]) => kept.write(options),
  };
  const up = (name: string): Faculty => ({ blueprint: { name, methods: {} }, object: {}, stop: () => void said.push(`${name} stopped`) });
  const recipe = () => {
    said.push('recipe');
    return { first: Promise.resolve(up('first')), second: Promise.reject(new Error('its port is taken')), third: Promise.resolve(up('third')) };
  };
  const { bodies } = machine();
  await assert.rejects(
    Ground.open({ custody: new FakeCustody('boot'), memory, carry: new FakeNetwork().join('boot'), bodies, recipe }),
    /the faculty second did not start: its port is taken/,
  );
  assert.deepEqual(said, ['read houses', 'read wards', 'recipe', 'third stopped', 'first stopped']);
});

test('A faculty is stopped when the ground closes, and its handler is chained', async () => {
  const { open } = machine();
  const stopped: string[] = [];
  const handler = { fetch: async () => null };
  const ground = await open({
    first: { blueprint: { name: 'first', methods: {} }, object: {}, stop: () => void stopped.push('first') },
    second: { blueprint: { name: 'second', methods: {} }, object: {}, handler, stop: () => void stopped.push('second') },
  });
  assert.deepEqual(ground.handlers, [handler]);
  await ground.close();
  assert.deepEqual(stopped, ['second', 'first'], 'in reverse');
});
