// The ground opens with one key its unlock answers, seals everything else
// in its drawer, stands its faculties on a ladder of registries, opens
// each house on the bodies its entry names, and closes a house through
// those bodies.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClassList, Ground, type Faculty, type Registry } from 'nervur';
import { FakeNetwork } from 'nervur/bench';
import { FakeClock } from '../../../src/bench/fake-clock.ts';
import { FakeMemory } from '../../../src/bench/fake-memory.ts';
import { FakeUnlock } from '../../../src/bench/fake-unlock.ts';
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

const faculty = (name: string, more: Partial<Faculty> = {}): Faculty => ({ blueprint: { name, methods: {} }, object: {}, ...more });

// One machine: its unlock, its memory, a memory apart for each house on `fake`, and one clock, kept across its opens.
const machine = (makers: NonNullable<Registry['faculties']> = {}) => {
  const memories = new Map<string, FakeMemory>();
  const registry: Registry = {
    faculties: makers,
    memory: { fake: ({ house }) => memories.get(house) ?? memories.set(house, new FakeMemory()).get(house)! },
    classes: {
      list: ({ args }) => {
        const set = SETS[args.set as string];
        if (set === undefined) throw new Error(`no set ${String(args.set)}`);
        return set;
      },
    },
  };
  const unlock = new FakeUnlock('ground');
  const memory = new FakeMemory();
  const clock = new FakeClock();
  const open = (options: { lazy?: boolean; registry?: Registry } = {}) => Ground.open({ unlock, memory, carry: new FakeNetwork().join('ground'), registry: options.registry ?? registry, clock, ...(options.lazy === undefined ? {} : { lazy: options.lazy }) });
  return { open, clock, registry, memory, memories };
};

const entry = (set: string, faculties?: string[]) => ({ classes: { body: 'list', set }, ...(faculties === undefined ? {} : { faculties }) });

test('A ground opens every house of its drawer again, on the same wards', async () => {
  const { open } = machine();
  const first = await open();
  const shop = await first.add('shop', entry('shop'));
  const home = await first.add('home', { ...entry('home'), memory: { body: 'fake' } });
  assert.ok(shop.ward !== undefined && home.ward !== undefined && shop.ward !== home.ward);
  assert.ok('result' in (await first.ask({ house: 'shop', method: 'bear', args: { kind: 'org.example.host', id: 'bob' } })));
  await first.close();

  const second = await open();
  assert.deepEqual(
    second.list().map(({ name, ward }) => ({ name, ward })),
    [
      { name: 'home', ward: home.ward },
      { name: 'shop', ward: shop.ward },
    ],
    'in the order of their names, as the drawer keeps them',
  );
  assert.deepEqual(await second.ask({ house: 'shop', id: 'bob', method: 'greet' }), { result: 'bob greets root' }, 'his places stayed in his view of the ground’s memory');
  await second.close();
});

test('Everything a ground keeps at rest is sealed, under names that say nothing', async () => {
  const { open, memory } = machine({ keeper: ({ memory: own }) => faculty('keeper', { object: { own } }) });
  const ground = await open();
  await ground.hand({ faculty: 'secrets', method: 'set', args: { name: 'stripe-key', value: 'sk_live_plain' } });
  await ground.stand('keeper', { make: 'keeper' });
  await ground.add('shop', entry('shop'));
  await ground.ask({ house: 'shop', method: 'bear', args: { kind: 'org.example.host', id: 'bob' } });
  await ground.close();
  const at = new TextDecoder();
  for (const place of await memory.list()) {
    for (const words of ['shop', 'bob', 'stripe-key', 'sk_live_plain', 'keeper', 'list', 'org.example.host']) assert.ok(!place.includes(words), `the place ${place} names ${words}`);
    const { entries } = await memory.read({ place });
    for (const [name, bytes] of Object.entries(entries)) {
      const text = at.decode(bytes);
      for (const words of ['shop', 'bob', 'sk_live_plain', 'org.example.host']) assert.ok(!text.includes(words) && !name.includes(words), `${place}/${name} holds ${words}`);
    }
  }
});

test('It refuses a drawer opened with a key that did not seal it', async () => {
  const { open, memory, registry } = machine();
  const ground = await open();
  await ground.add('shop', entry('shop'));
  await ground.close();
  await assert.rejects(
    Ground.open({ unlock: new FakeUnlock('another'), memory, carry: new FakeNetwork().join('thief'), registry }),
    /this memory holds no drawer this key opens/,
  );
  assert.ok((await open()).list().some(({ name, ward }) => name === 'shop' && ward !== undefined), 'its own key still opens it');
});

test('A ground woken per event opens a house only when a box or the hand reaches it', async () => {
  const { registry } = machine();
  let opened = 0;
  const list = registry.classes?.list;
  assert.ok(list !== undefined);
  const counted: Registry = { ...registry, classes: { list: (made) => (opened++, list(made)) } };
  const unlock = new FakeUnlock('lazy');
  const memory = new FakeMemory();
  const open = () => Ground.open({ unlock, memory, carry: new FakeNetwork().join('lazy'), registry: counted, lazy: true });
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
      { name: 'home', ward: home.ward },
      { name: 'shop', ward: shop.ward },
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

test('A removed house answers nothing, and added again it is the same ward with its places', async () => {
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

test('Another entry under a name the drawer holds is refused', async () => {
  const { open } = machine({ first: () => faculty('first') });
  const ground = await open();
  await ground.add('shop', entry('shop'));
  await assert.rejects(ground.add('shop', entry('home')), /the house shop stands with another entry/);
  await assert.rejects(ground.add('Shop!', entry('shop')), /a house is named with lowercase letters/);
  await ground.stand('first', { make: 'first' });
  await assert.rejects(ground.stand('first', { make: 'first', kinds: ['org.example.host'] }), /the faculty first stands with another entry/);
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

test('A house whose entry names what the ground lacks stays closed, says why, and opens once the faculty stands', async () => {
  const { open } = machine({ stripe: () => faculty('stripe') });
  const ground = await open();
  const lacking = await ground.add('shop', entry('shop', ['stripe']));
  assert.equal(lacking.ward, undefined);
  assert.equal(lacking.why, 'no faculty stripe stands here');
  const home = await ground.add('home', entry('home'));
  assert.ok(home.ward !== undefined, 'the others open');
  assert.deepEqual(await ground.stand('stripe', { make: 'stripe' }), {});
  assert.ok(ground.list().find(({ name }) => name === 'shop')?.ward !== undefined, 'the house its absence kept closed opened');
  await ground.close();
});

test('The houses faculty reaches only the house its entry names and the kinds its grant names', async () => {
  const { open } = machine();
  const ground = await open();
  await ground.stand('houses', { kinds: ['org.example.pilot'] });
  await ground.add('control', entry('control', ['houses']));
  await ground.add('plain', entry('control'));
  await ground.ask({ house: 'control', method: 'bear', args: { kind: 'org.example.pilot', id: 'pilot' } });
  await ground.ask({ house: 'control', method: 'bear', args: { kind: 'org.example.stowaway', id: 'stowaway' } });
  await ground.ask({ house: 'plain', method: 'bear', args: { kind: 'org.example.pilot', id: 'pilot' } });

  const opened = await ground.ask({ house: 'control', id: 'pilot', method: 'open', args: { name: 'shop', set: 'shop' } });
  assert.ok('result' in opened);
  assert.equal(opened.result, ground.list().find(({ name }) => name === 'shop')?.ward);

  const unnamed = await ground.ask({ house: 'plain', id: 'pilot', method: 'open', args: { name: 'other', set: 'shop' } });
  assert.ok(!('result' in unnamed), 'a pilot whose house the entry does not name is absent');
  const ungranted = await ground.ask({ house: 'control', id: 'stowaway', method: 'open', args: { name: 'other', set: 'shop' } });
  assert.deepEqual(ungranted, { error: { message: 'no being stowaway is here' } }, 'a class the grant does not name is absent');
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

test('A house the grant was never given holds the ground’s own faculty for no class', async () => {
  const { open } = machine();
  const ground = await open();
  await ground.add('control', entry('control', ['houses']));
  await ground.ask({ house: 'control', method: 'bear', args: { kind: 'org.example.pilot', id: 'pilot' } });
  assert.deepEqual(await ground.ask({ house: 'control', id: 'pilot', method: 'open', args: { name: 'shop', set: 'shop' } }), { error: { message: 'no being pilot is here' } });
  await ground.close();
});

test('It refuses a faculty entry for secrets or moves, which the hand alone reaches', async () => {
  const { open } = machine();
  const ground = await open();
  for (const name of ['secrets', 'moves']) {
    await assert.rejects(ground.stand(name, { kinds: ['org.example.pilot'] }), new RegExp(`the faculty ${name} is the hand’s alone`));
    assert.deepEqual((await ground.add(`with-${name}`, entry('control', [name]))).why, `the faculty ${name} is the hand’s alone`);
  }
  await assert.rejects(ground.stand('houses', { make: 'shell', kinds: [] }), /its entry holds kinds alone/);
  await ground.close();
});

test('It refuses a secret read by a being, a describe or anyone but a maker its entry names', async () => {
  const given: Record<string, Readonly<Record<string, string>>> = {};
  const { open } = machine({ pay: ({ name, secrets }) => ((given[name] = secrets), faculty('pay')) });
  const ground = await open();
  await ground.hand({ faculty: 'secrets', method: 'set', args: { name: 'stripe-key', value: 'sk_live_plain' } });
  await ground.hand({ faculty: 'secrets', method: 'set', args: { name: 'mail-password', value: 'hunter2' } });
  await ground.stand('pay', { make: 'pay', secrets: ['stripe-key'] });
  await ground.stand('other', { make: 'pay' });
  assert.deepEqual(given, { pay: { 'stripe-key': 'sk_live_plain' }, other: {} }, 'each maker holds the secrets its entry names and no other');
  assert.deepEqual(await ground.hand({ faculty: 'secrets', method: 'list' }), { result: ['mail-password', 'stripe-key'] }, 'the hand lists names alone');
  assert.ok(!JSON.stringify(ground.describe()).includes('sk_live_plain'), 'no describe shows one');
  assert.deepEqual((await ground.add('control', entry('control', ['secrets']))).why, 'the faculty secrets is the hand’s alone', 'no being is offered them');
  assert.equal((await ground.stand('lacking', { make: 'pay', secrets: ['absent'] })).why, 'no secret absent is kept');
  await ground.close();
});

test('A faculty stands on the registry an earlier faculty carries, and a cycle leaves each in it down', async () => {
  const made: string[] = [];
  const upper: Registry = { faculties: { mail: ({ name }) => (made.push(name), faculty('mail')) }, classes: { upper: () => SETS.shop } };
  const { open } = machine({ recipe: () => ({ registry: upper }), loop: () => ({ registry: {} }) });
  const first = await open();
  assert.equal((await first.stand('mail', { from: 'recipe', make: 'mail' })).why, 'no faculty recipe stands here', 'its registry is not there yet');
  assert.deepEqual(await first.stand('recipe', { make: 'recipe' }), {});
  assert.deepEqual(made, ['mail'], 'the faculty that waited on it stood once its registry did');
  assert.ok((await first.add('shop', { classes: { from: 'recipe', body: 'upper' }, faculties: ['mail'] })).ward !== undefined, 'a house takes its code and its faculty from a rung above');
  assert.equal((await first.stand('lost', { from: 'recipe', make: 'absent' })).why, 'no maker absent in recipe');
  await first.stand('a', { from: 'b', make: 'loop' });
  await first.stand('b', { from: 'a', make: 'loop' });
  await first.close();

  made.length = 0;
  const second = await open();
  assert.deepEqual(made, ['mail'], 'the ladder stands again in its order');
  const listed = await second.hand({ faculty: 'faculties', method: 'list' });
  assert.ok('result' in listed);
  const why = Object.fromEntries((listed.result as { name: string; why?: string }[]).map(({ name, why: down }) => [name, down]));
  assert.equal(why.a, 'a cycle: a → b → a');
  assert.equal(why.b, 'a cycle: a → b → a');
  assert.equal(why.recipe, undefined);
  await second.close();
});

test('A faculty a house or a faculty uses is refused removal, and one no one uses stops and goes', async () => {
  const stopped: string[] = [];
  const { open } = machine({
    recipe: () => ({ registry: { faculties: { mail: () => faculty('mail', { stop: () => void stopped.push('mail') }) } } }),
    pay: () => faculty('pay', { stop: () => void stopped.push('pay') }),
  });
  const ground = await open();
  await ground.stand('recipe', { make: 'recipe' });
  await ground.stand('mail', { from: 'recipe', make: 'mail' });
  await ground.stand('pay', { make: 'pay' });
  await ground.add('shop', entry('shop', ['pay']));
  await assert.rejects(ground.unstand('pay'), /the faculty pay is in use by the house shop/);
  await assert.rejects(ground.unstand('recipe'), /the faculty recipe is in use by the faculty mail/);
  await ground.unstand('mail');
  assert.deepEqual(stopped, ['mail']);
  assert.deepEqual(await ground.hand({ faculty: 'mail', method: 'send' }), { error: { message: 'no faculty mail' } });
  await ground.close();
});

test('A faculty whose maker fails stays down with why, and the ground boots beside it', async () => {
  const { open } = machine({ broken: () => Promise.reject(new Error('its port is taken')), fine: () => faculty('fine') });
  const first = await open();
  assert.equal((await first.stand('broken', { make: 'broken' })).why, 'it did not stand: its port is taken');
  await first.stand('fine', { make: 'fine' });
  await first.close();
  const second = await open();
  const described = second.describe().faculties;
  assert.deepEqual(described.broken, { why: 'it did not stand: its port is taken' });
  assert.deepEqual((described.fine as { blueprint: string }).blueprint, 'fine');
  assert.deepEqual((await second.add('shop', entry('shop', ['broken']))).why, 'the faculty broken is down: it did not stand: its port is taken');
  await second.close();
});

test('A faculty keeps what it must in a memory of its own, sealed, across the ground’s lives', async () => {
  const { open } = machine({ keeper: () => faculty('keeper') });
  const first = await open();
  await first.stand('keeper', { make: 'keeper' });
  await first.close();
  const kept = new Map<string, unknown>();
  const second = await open({
    registry: {
      faculties: {
        keeper: async ({ memory }) => {
          if ((await memory.list()).length === 0) await memory.write({ writes: { seen: { call: new TextEncoder().encode('once') } }, expect: { seen: null } });
          kept.set('places', await memory.list());
          kept.set('seen', new TextDecoder().decode((await memory.read({ place: 'seen' })).entries.call));
          return faculty('keeper');
        },
      },
      classes: {},
    },
  });
  await second.close();
  const third = await open({
    registry: {
      faculties: {
        keeper: async ({ memory }) => {
          kept.set('again', new TextDecoder().decode((await memory.read({ place: 'seen' })).entries.call));
          return faculty('keeper');
        },
      },
    },
  });
  await third.close();
  assert.deepEqual(kept.get('places'), ['seen']);
  assert.equal(kept.get('seen'), 'once');
  assert.equal(kept.get('again'), 'once', 'the next life reads what it wrote');
});

test('A faculty is stopped when the ground closes, in the reverse of the ladder, and its handler is chained', async () => {
  const stopped: string[] = [];
  const response = new Response('second');
  const { open } = machine({
    first: () => faculty('first', { stop: () => void stopped.push('first') }),
    second: () => faculty('second', { handler: { fetch: async (request) => (new URL(request.url).pathname === '/second' ? response : null) }, stop: () => void stopped.push('second') }),
  });
  const ground = await open();
  await ground.stand('first', { make: 'first' });
  assert.equal(await ground.handler.fetch(new Request('http://ground/second')), null, 'nothing answers before it stands');
  await ground.stand('second', { make: 'second' });
  assert.equal(await ground.handler.fetch(new Request('http://ground/second')), response, 'a faculty stood while the ground runs is served at once');
  await ground.close();
  assert.deepEqual(stopped, ['second', 'first'], 'in reverse');
});
