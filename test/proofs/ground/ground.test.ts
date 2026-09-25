// The ground opens with one key its unlock answers, seals everything else
// in its drawer, raises every faculty by its `up` on a ladder of
// registries, opens each house on the bodies its entry names, and closes a
// house through those bodies.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClassList, Ground, type Body, type Faculty, type Memory, type Unlock } from 'nervur';
import { FakeNetwork } from 'nervur/bench';
import type { Json } from 'nervur/being';
import { FakeClock } from '../../../src/bench/fake-clock.ts';
import { FakeMemory } from '../../../src/bench/fake-memory.ts';
import { FakeUnlock } from '../../../src/bench/fake-unlock.ts';
import { Grasping, Shelling } from '../../fixtures/ground/grasping.ts';
import { Counter } from '../../fixtures/world/counter.ts';
import { Guest } from '../../fixtures/world/guest.ts';
import { Host } from '../../fixtures/world/host.ts';
import { Pilot } from '../../fixtures/world/pilot.ts';
import { Steward } from '../../fixtures/world/steward.ts';

// The classes each house may be handed, by the name its entry gives them.
const SETS: Record<string, ClassList> = {
  shop: new ClassList({ steward: Steward, beings: [Host, Counter] }),
  home: new ClassList({ steward: Steward, beings: [Guest] }),
  control: new ClassList({ steward: Steward, beings: [Pilot] }),
  grasp: new ClassList({ steward: Steward, beings: [Grasping, Shelling] }),
};

// A body offering beings a blueprint of its name and an empty object, with any part more.
const body = (name: string, more: Partial<Body> = {}): Body => ({ blueprint: { name, methods: {} }, object: {}, ...more });

// A faculty whose `up` answers a body of its name, with any part more.
const faculty = (name: string, more: Partial<Body> = {}): Faculty => ({ up: () => body(name, more) });

const PRIMORDIAL = { unlock: { make: 'fake-unlock' }, memory: { make: 'fake-memory' }, crypto: { make: 'noble' }, tools: { make: 'strict' }, clock: { make: 'fake-clock' } } as const;
const ENTRIES = { carry: { make: 'network' }, fake: { make: 'fake' }, list: { make: 'list' } } as const;

// One machine: its unlock, its memory, a memory apart for each house on `fake`, and one clock, kept across its opens. `opened` counts each house `list` serves.
const machine = (faculties: Readonly<Record<string, Faculty>> = {}) => {
  const memories = new Map<string, FakeMemory>();
  const unlock = new FakeUnlock('ground');
  const memory = new FakeMemory();
  const clock = new FakeClock();
  const counts = { opened: 0, writes: 0 };
  // The ground's memory, each write to it counted.
  const counted: Memory = {
    read: (options) => memory.read(options),
    list: () => memory.list(),
    write: (options) => (counts.writes++, memory.write(options)),
  };
  const own = (key: Unlock): Record<string, Faculty> => ({
    'fake-unlock': { up: () => ({ serves: 'unlock', object: key }) },
    'fake-memory': { up: () => ({ serves: 'memory', object: counted }) },
    'fake-clock': { up: () => ({ serves: 'clock', object: clock }) },
    network: { up: () => ({ serves: 'carry', schemes: ['bench'], object: new FakeNetwork().join('ground') }) },
    fake: { up: () => ({ serves: 'memory', house: ({ house }) => memories.get(house) ?? memories.set(house, new FakeMemory()).get(house)! }) },
    list: {
      up: () => ({
        serves: 'classes',
        house: ({ args }) => {
          const set = SETS[args.set as string];
          if (set === undefined) throw new Error(`no set ${String(args.set)}`);
          counts.opened++;
          return set;
        },
      }),
    },
  });
  const open = (options: { lazy?: boolean; faculties?: Readonly<Record<string, Faculty>>; unlock?: Unlock } = {}) =>
    Ground.open({
      registry: { faculties: { ...own(options.unlock ?? unlock), ...(options.faculties ?? faculties) } },
      primordial: PRIMORDIAL,
      entries: ENTRIES,
      ...(options.lazy === undefined ? {} : { lazy: options.lazy }),
    });
  return { open, clock, memory, memories, counts };
};

const entry = (set: string, faculties?: string[]) => ({ classes: { faculty: 'list', set }, ...(faculties === undefined ? {} : { faculties }) });

test('A ground opens every house of its drawer again, on the same wards', async () => {
  const { open } = machine();
  const first = await open();
  const shop = await first.add('shop', entry('shop'));
  const home = await first.add('home', { ...entry('home'), memory: { faculty: 'fake' } });
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
  const { open, memory } = machine({ keeper: { up: ({ memory: own }) => body('keeper', { object: { own } }) } });
  const ground = await open();
  await ground.hand({ method: 'secretsSet', args: { name: 'stripe-key', value: 'sk_live_plain' } });
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

test('The drawer is the dock’s beings’ cells: the ground’s memory holds no place outside the views it hands the dock, its houses and its faculties', async () => {
  const { open, memory } = machine({ keeper: faculty('keeper') });
  const first = await open();
  await first.hand({ method: 'secretsSet', args: { name: 'stripe-key', value: 'sk_live_plain' } });
  await first.stand('keeper', { make: 'keeper', secrets: ['stripe-key'] });
  await first.add('shop', { ...entry('shop'), memory: { faculty: 'fake' } });
  await first.hand({ method: 'waitSet', args: { wait: 5_000 } });
  await first.close();
  const places = await memory.list();
  assert.ok(
    places.every((place) => /^[0-9a-f]{16}\//.test(place)),
    'every place in a view',
  );
  assert.equal(new Set(places.map((place) => place.split('/')[0])).size, 1, 'one view, the dock’s: no row stands beside its beings’');

  const second = await open();
  const cells = async (id: string) => ((await second.hand({ id, cells: true })) as { result: Record<string, Json> }).result;
  assert.deepEqual((await cells('faculty.keeper')).entry, { make: 'keeper' }, 'the faculty’s entry, its secret a standing');
  assert.match(String((await cells('house.shop')).seed), /^[0-9a-f]{64}$/, 'the house’s seed');
  assert.deepEqual((await cells('house.shop')).entry, { classes: { set: 'shop' }, memory: {} }, 'the house’s entry, its bodies standings');
  assert.deepEqual(await cells('steward'), { wait: 5_000 }, 'the ground’s bound');
  await second.close();
});

test('A grant is a standing the dock’s steward introduces: a house whose standing on a body is dropped opens again without it', async () => {
  const { open } = machine({ pay: faculty('pay') });
  const first = await open();
  await first.stand('pay', { make: 'pay' });
  await first.add('shop', entry('shop', ['pay']));
  const shown = async (ground: Ground, id: string) => ((await ground.hand({ id, method: 'shown' })) as { result: { cells: Record<string, Json>; standings: { id: string; steward: Json }[] } }).result;
  const held = await shown(first, 'house.shop');
  assert.deepEqual(held.cells.entry, { classes: { set: 'shop' } }, 'her cells hold no name');
  assert.deepEqual(
    [...held.standings].sort((a, b) => (a.id < b.id ? -1 : 1)),
    [
      { id: 'faculty.list', steward: { classes: true } },
      { id: 'faculty.pay', steward: { faculties: 0 } },
    ],
    'her code and her body are standings, the steward’s notes naming each grant',
  );
  await assert.rejects(first.unstand('pay'), /the faculty pay is in use by the house shop/, 'a body a standing names is in use');
  await first.update('shop', entry('shop'));
  assert.deepEqual(
    (await shown(first, 'house.shop')).standings.map(({ id }) => id),
    ['faculty.list'],
    'the entry that leaves it out drops her standing on it',
  );
  await first.close();
  const second = await open();
  assert.deepEqual(second.list()[0].entry, entry('shop'), 'it opened again without the body');
  await second.unstand('pay');
  assert.equal(second.list()[0].ward !== undefined, true);
  await second.close();
});

test('It refuses a secret’s cells read through the hand: the ground reads them as the dock’s own code, for the bodies that stand on her alone', async (t) => {
  const given: Record<string, string> = {};
  const { open } = machine({ pay: { up: ({ secrets }) => (Object.assign(given, secrets), body('pay')) } });
  const ground = await open();
  t.after(() => ground.close());
  assert.deepEqual(await ground.hand({ method: 'secretsSet', args: { name: 'stripe-key', value: 'sk_live_plain' } }), { result: null });
  assert.deepEqual(await ground.hand({ id: 'secret.stripe-key', cells: true }), { error: { message: 'a secret’s cells are shown to no one' } });
  const described = await ground.hand({ id: 'secret.stripe-key' });
  assert.ok(!JSON.stringify(described).includes('sk_live_plain'), 'her describe shows her asks and never her value');
  await ground.stand('pay', { make: 'pay', secrets: ['stripe-key'] });
  assert.deepEqual(given, { 'stripe-key': 'sk_live_plain' }, 'the body standing on her received it at its up');
});

test('It refuses an entry naming, making or granting `ground` or `shell`: both are the dock’s alone, and no being of another house holds either', async (t) => {
  const { open } = machine();
  const ground = await open();
  t.after(() => ground.close());
  const work = 'the ground is the library’s: no entry names it, makes it or grants it';
  const shell = 'the shell is the dock’s alone: no entry names it, makes it or grants it';
  for (const [method, args, message] of [
    ['facultiesAdd', { name: 'ground', make: 'fake' }, work],
    ['facultiesAdd', { name: 'mine', make: 'ground' }, work],
    ['facultiesAdd', { name: 'mine', make: 'fake', faculties: ['ground'] }, work],
    ['facultiesAdd', { name: 'shell', make: 'fake' }, shell],
    ['facultiesAdd', { name: 'mine', make: 'shell' }, shell],
    ['facultiesAdd', { name: 'mine', make: 'fake', faculties: ['shell'] }, shell],
    ['facultiesUpdate', { name: 'shell', make: 'shell' }, shell],
    ['facultiesRemove', { name: 'shell' }, shell],
    ['housesAdd', { name: 'shop', ...entry('grasp', ['ground']) }, work],
    ['housesAdd', { name: 'shop', ...entry('grasp', ['shell']) }, shell],
  ] as const) {
    assert.deepEqual(await ground.hand({ method, args }), { error: { message } }, `${method} ${JSON.stringify(args)}`);
  }
  await ground.add('shop', entry('grasp'));
  for (const kind of ['org.example.grasping', 'org.example.shelling']) {
    const borne = await ground.ask({ house: 'shop', method: 'bear', args: { kind, id: 'x' } });
    assert.ok('error' in borne && /no offer covers her need/.test(borne.error.message), `${kind}: ${JSON.stringify(borne)}`);
  }
});

test('It refuses a drawer opened with a key that did not seal it', async () => {
  const { open } = machine();
  const ground = await open();
  await ground.add('shop', entry('shop'));
  await ground.close();
  await assert.rejects(open({ unlock: new FakeUnlock('another') }), /this memory holds no drawer this key opens/);
  assert.ok((await open()).list().some(({ name, ward }) => name === 'shop' && ward !== undefined), 'its own key still opens it');
});

test('A ground woken per event opens a house only when a box or the hand reaches it', async () => {
  const lazy = machine();
  const open = () => lazy.open({ lazy: true });
  const first = await open();
  const shop = await first.add('shop', entry('shop'));
  const home = await first.add('home', entry('home'));
  assert.ok('result' in (await first.ask({ house: 'shop', method: 'bear', args: { kind: 'org.example.host', id: 'bob' } })));
  assert.ok('result' in (await first.ask({ house: 'home', method: 'bear', args: { kind: 'org.example.guest', id: 'alice' } })));
  const offered = await first.ask({ house: 'shop', method: 'offerFor', args: { being: 'bob', occupant: 'alice' } });
  assert.ok('result' in offered);
  assert.ok('result' in (await first.ask({ house: 'home', id: 'alice', method: 'accept', args: { invitation: (offered.result as { handle: string }).handle } })));
  await first.close();

  lazy.counts.opened = 0;
  const second = await open();
  assert.equal(lazy.counts.opened, 0, 'no house opened at the boot');
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
  assert.equal(lazy.counts.opened, 2, 'each opened once, when it was reached');
  await second.close();

  lazy.counts.opened = 0;
  const third = await open();
  await third.wake();
  assert.equal(lazy.counts.opened, 2, 'a wake opens every one');
  await third.close();
});

test('A wake that finds nothing changed writes nothing: a boot writes a being’s cells only where what she holds moved', async () => {
  const lazy = machine({ pay: faculty('pay') });
  const open = () => lazy.open({ lazy: true });
  const first = await open();
  await first.hand({ method: 'secretsSet', args: { name: 'pay-key', value: 'hush' } });
  await first.stand('pay', { make: 'pay', secrets: ['pay-key'] });
  await first.add('shop', entry('shop', ['pay']));
  await first.hand({ method: 'waitSet', args: { wait: 5_000 } });
  await first.close();
  // The first wake after the changes may land what they left behind; the next finds nothing moved.
  await (await open()).close();
  lazy.counts.writes = 0;
  const again = await open();
  assert.equal(again.list()[0].ward !== undefined, true, 'its house stands asleep on its ward');
  await again.close();
  assert.equal(lazy.counts.writes, 0, 'no write to the ground’s memory');
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

test('Another entry under a name the drawer holds is refused to an addition, and is an update', async () => {
  const { open } = machine({ first: faculty('first') });
  const ground = await open();
  await ground.add('shop', entry('shop'));
  await assert.rejects(ground.add('shop', entry('home')), /the house shop stands with another entry; update it/);
  await assert.rejects(ground.add('Shop!', entry('shop')), /a house is named with lowercase letters/);
  await ground.stand('first', { make: 'first' });
  await assert.rejects(ground.stand('first', { make: 'first', kinds: ['org.example.host'] }), /the faculty first stands with another entry; update it/);
  await assert.rejects(ground.update('absent', entry('shop')), /no house absent is here to update/);
  await assert.rejects(ground.restand('absent', { make: 'first' }), /no faculty absent stands here to update/);
  await assert.rejects(ground.restart('absent'), /no faculty absent stands here to restart/);
  await assert.rejects(ground.unstand('carry'), /the faculty carry is the terrain’s; update it/);
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

test('A house whose entry names a body that is down stays closed, says why, and opens once the body stands', async () => {
  let fails = true;
  const { open } = machine({ stripe: { up: () => (fails ? Promise.reject(new Error('its key is wrong')) : body('stripe')) } });
  const ground = await open();
  assert.equal((await ground.stand('stripe', { make: 'stripe' })).why, 'it did not stand: its key is wrong');
  const lacking = await ground.add('shop', entry('shop', ['stripe']));
  assert.equal(lacking.ward, undefined);
  assert.equal(lacking.why, 'the faculty stripe is down: it did not stand: its key is wrong');
  const home = await ground.add('home', entry('home'));
  assert.ok(home.ward !== undefined, 'the others open');
  fails = false;
  assert.deepEqual(await ground.restart('stripe'), {});
  assert.ok(ground.list().find(({ name }) => name === 'shop')?.ward !== undefined, 'the house its absence kept closed opened');
  await ground.close();
});

test('It refuses a grant naming a being the dock does not hold: an entry names only faculties and secrets that stand as twins and secrets, and nothing lands', async (t) => {
  const { open } = machine({ stripe: faculty('stripe') });
  const ground = await open();
  t.after(() => ground.close());
  await assert.rejects(ground.add('shop', entry('shop', ['stripe'])), /the house shop is refused: no faculty stripe is here/);
  await assert.rejects(ground.add('shop', { classes: { faculty: 'absent' } }), /the house shop is refused: no faculty absent is here/);
  await assert.rejects(ground.stand('mail', { from: 'recipe', make: 'mail' }), /the faculty mail is refused: no faculty recipe is here/);
  await assert.rejects(ground.stand('bell', { make: 'stripe', faculties: ['post'] }), /the faculty bell is refused: no faculty post is here/);
  await assert.rejects(ground.stand('pay', { make: 'stripe', secrets: ['key'] }), /the faculty pay is refused: no secret key is kept/);
  assert.deepEqual(ground.list(), [], 'no house landed');
  const listed = (await ground.hand({ method: 'facultiesList' })) as { result: { name: string }[] };
  assert.deepEqual(
    listed.result.map(({ name }) => name),
    ['carry', 'fake', 'list'],
    'no faculty landed',
  );
});

test('It refuses a secret or a move asked by anyone but the hand: a pilot possesses the ground through a standing on the dock’s steward, and reaches neither', async (t) => {
  const { open } = machine();
  const ground = await open();
  t.after(() => ground.close());
  await ground.add('control', entry('control'));
  await ground.ask({ house: 'control', method: 'bear', args: { kind: 'org.example.pilot', id: 'pilot' } });
  const invited = await ground.hand({ method: 'pilotsInvite', args: { id: 'ada' } });
  assert.ok('result' in invited, JSON.stringify(invited));
  const { invitation } = invited.result as { invitation: string };
  assert.ok('result' in (await ground.ask({ house: 'control', id: 'pilot', method: 'accept', args: { invitation } })));
  const pilot = (method: string, args?: Record<string, unknown>) => ground.ask({ house: 'control', id: 'pilot', method: 'pilot', args: args === undefined ? { method } : { method, args: args as never } });

  const opened = await pilot('housesAdd', { name: 'shop', memory: { faculty: 'fake' }, classes: { faculty: 'list', set: 'shop' } });
  assert.deepEqual(opened, { result: { ward: ground.list().find(({ name }) => name === 'shop')?.ward } }, 'she adds a house as the hand would');
  assert.ok('result' in (await pilot('facultiesList')), 'and reads the ladder');
  const typed = (await ground.ask({ house: 'control', id: 'pilot', method: 'houses' })) as { result: { name: string }[] };
  assert.ok(
    typed.result.some(({ name }) => name === 'shop'),
    'the dock’s steward covers DockPilot, so a pilot holds it typed',
  );
  for (const [method, args] of [
    ['secretsSet', { name: 'stolen', value: 'hers' }],
    ['secretsList', {}],
    ['movesOut', { name: 'shop' }],
    ['pilotsInvite', { id: 'eve' }],
    ['callFaculty', { faculty: 'clock', method: 'now' }],
    ['shellRun', { command: 'true' }],
  ] as const) {
    const refused = await pilot(method, args);
    assert.ok('error' in refused && /is not in the describe she read/.test(refused.error.message), `${method}: ${JSON.stringify(refused)}`);
  }
  assert.deepEqual(await ground.hand({ method: 'secretsList' }), { result: [] }, 'no secret was kept');
  assert.ok(ground.list().some(({ name, ward }) => name === 'shop' && ward !== undefined), 'no house moved');
  assert.deepEqual(await ground.hand({ method: 'pilotsList' }), { result: ['ada'] });

  assert.ok('result' in (await pilot('housesRemove', { name: 'shop' })));
  assert.equal(
    ground.list().find(({ name }) => name === 'shop'),
    undefined,
  );
  // Let go, she reaches nothing.
  assert.deepEqual(await ground.hand({ method: 'pilotsDismiss', args: { id: 'ada' } }), { result: null });
  assert.ok('error' in (await pilot('housesList')));
});

test('It refuses an entry named dock, for a house or a faculty: the dock is the library’s', async (t) => {
  const { open } = machine();
  const ground = await open();
  t.after(() => ground.close());
  await assert.rejects(ground.add('dock', entry('shop')), /the dock is the library’s, and no entry names it/);
  await assert.rejects(ground.stand('dock', { make: 'fake' }), /the dock is the library’s, and no entry names it/);
  assert.deepEqual(await ground.hand({ method: 'housesAdd', args: { name: 'dock', ...entry('shop') } }), { error: { message: 'the dock is the library’s, and no entry names it' } });
  assert.deepEqual(await ground.hand({ method: 'facultiesAdd', args: { name: 'dock', make: 'fake' } }), { error: { message: 'the dock is the library’s, and no entry names it' } });
  assert.deepEqual(await ground.hand({ house: 'dock', method: 'bear', args: { kind: 'org.example.host', id: 'bob' } }), { error: { message: 'no house dock is open here' } }, 'no house is the dock');
  assert.deepEqual(ground.list(), [], 'the dock is none of the houses');
});

test('The dock opens before the ladder, so a ladder that does not stand is mended through it', async (t) => {
  const { open } = machine();
  const first = await open();
  await first.add('shop', entry('shop'));
  const broken = await first.hand({ method: 'facultiesUpdate', args: { name: 'carry', make: 'absent' } });
  assert.deepEqual(broken, { result: { why: 'no faculty absent in the ground’s registry' } }, 'the entry landed, and its body is down');
  await first.close();

  const second = await open();
  t.after(() => second.close());
  assert.equal(second.list()[0].why, 'no body serves the carry', 'the house stays closed on the broken ladder');
  const described = (await second.hand({ describe: true })) as { result: { dock: { asks: { method: string }[] }; faculties: Record<string, { why?: string }> } };
  assert.ok(described.result.dock.asks.some(({ method }) => method === 'facultiesUpdate'), 'the dock answers all the same');
  assert.match(described.result.faculties.carry.why ?? '', /no faculty absent/);
  assert.deepEqual(await second.hand({ method: 'facultiesUpdate', args: { name: 'carry', make: 'network' } }), { result: {} });
  assert.ok(second.list()[0].ward !== undefined, 'the house opens once its carry stands');
});

test('An ask of the dock repeated with its call id answers what the first answered, and runs nothing twice', async (t) => {
  const { open, counts } = machine();
  const ground = await open();
  t.after(() => ground.close());
  const { ward } = await ground.add('shop', entry('shop'));
  const deploy = () => ground.hand({ method: 'housesUpdate', args: { name: 'shop', ...entry('home') }, call: 'deploy-1' });
  const opened = counts.opened;
  const first = await deploy();
  assert.deepEqual(first, { result: { ward } });
  assert.equal(counts.opened, opened + 1);
  await ground.update('shop', entry('control'));
  assert.deepEqual(await deploy(), first, 'the same answer');
  assert.equal(counts.opened, opened + 2, 'the house opened for the owner’s own update alone');
  assert.deepEqual(ground.list()[0].entry, entry('control'), 'the repeat landed nothing over the later entry');
});

test('It refuses a secret read by a being, a describe or anyone but a faculty whose entry names it', async () => {
  const given: Record<string, Readonly<Record<string, string>>> = {};
  const { open } = machine({ pay: { up: ({ name, secrets }) => ((given[name] = secrets), body('pay')) } });
  const ground = await open();
  assert.deepEqual(await ground.hand({ method: 'secretsSet', args: { name: 'stripe-key', value: 'sk_live_plain' }, call: 'set-stripe' }), { result: null }, 'a secret set answers nothing');
  await ground.hand({ method: 'secretsSet', args: { name: 'mail-password', value: 'hunter2' } });
  await ground.stand('pay', { make: 'pay', secrets: ['stripe-key'] });
  await ground.stand('other', { make: 'pay' });
  assert.deepEqual(given, { pay: { 'stripe-key': 'sk_live_plain' }, other: {} }, 'each faculty holds the secrets its entry names and no other');
  assert.deepEqual(
    await ground.hand({ method: 'secretsList' }),
    {
      result: [
        { name: 'mail-password', kept: true, entries: [] },
        { name: 'stripe-key', kept: true, entries: ['pay'] },
      ],
    },
    'the hand lists names and who names them alone',
  );
  assert.ok(!JSON.stringify(await ground.describe()).includes('sk_live_plain'), 'no describe shows one');
  assert.deepEqual(await ground.hand({ method: 'secretsSet', args: { name: 'stripe-key', value: 'sk_live_plain' }, call: 'set-stripe' }), { result: null }, 'the dock remembers the call’s answer, which holds none');
  const cells = await ground.hand({ cells: true });
  assert.ok('result' in cells && !JSON.stringify(cells).includes('sk_live_plain'), 'the dock’s steward keeps none in her cells');
  await assert.rejects(ground.stand('lacking', { make: 'pay', secrets: ['absent'] }), /the faculty lacking is refused: no secret absent is kept/, 'a secret not kept is refused before the entry lands');
  await ground.close();
});

test('A faculty stands on the registry an earlier body carries, and a cycle leaves each in it down', async () => {
  const made: string[] = [];
  const upper = {
    faculties: {
      mail: { up: ({ name }) => (made.push(name), body('mail')) },
      upper: { up: () => ({ serves: 'classes', house: () => SETS.shop }) },
    } satisfies Record<string, Faculty>,
  };
  const { open } = machine({ recipe: { up: () => ({ registry: upper }) }, loop: { up: () => ({ registry: {} }) } });
  const first = await open();
  assert.deepEqual(await first.stand('recipe', { make: 'recipe' }), {});
  assert.deepEqual(await first.stand('mail', { from: 'recipe', make: 'mail' }), {});
  assert.deepEqual(made, ['mail'], 'it stood on the registry its rung below carries');
  assert.deepEqual(await first.stand('upper', { from: 'recipe', make: 'upper' }), {});
  assert.ok((await first.add('shop', { classes: { faculty: 'upper' }, faculties: ['mail'] })).ward !== undefined, 'a house takes its code and its faculty from a rung above');
  assert.equal((await first.stand('lost', { from: 'recipe', make: 'absent' })).why, 'no faculty absent in recipe');
  // A cycle is made by two updates, each naming a twin that stands.
  await first.stand('a', { make: 'loop' });
  await first.stand('b', { make: 'loop' });
  await first.restand('a', { from: 'b', make: 'loop' });
  await first.restand('b', { from: 'a', make: 'loop' });
  await first.close();

  made.length = 0;
  const second = await open();
  assert.deepEqual(made, ['mail'], 'the ladder stands again in its order');
  const listed = await second.hand({ method: 'facultiesList' });
  assert.ok('result' in listed);
  const why = Object.fromEntries((listed.result as { name: string; why?: string }[]).map(({ name, why: down }) => [name, down]));
  assert.equal(why.a, 'a cycle: a → b → a');
  assert.equal(why.b, 'a cycle: a → b → a');
  assert.equal(why.recipe, undefined);
  await second.close();
});

test('A body a house or a body uses is refused removal, and one no one uses goes down and goes', async () => {
  const stopped: string[] = [];
  const { open } = machine({
    recipe: { up: () => ({ registry: { faculties: { mail: faculty('mail', { down: () => void stopped.push('mail') }) } } }) },
    pay: faculty('pay', { down: () => void stopped.push('pay') }),
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
  assert.deepEqual(await ground.hand({ method: 'callFaculty', args: { faculty: 'mail', method: 'send' } }), { error: { message: 'no faculty mail stands here' } });
  await ground.close();
});

test('A faculty whose up fails stays down with why, and the ground boots beside it', async () => {
  const { open } = machine({ broken: { up: () => Promise.reject(new Error('its port is taken')) }, fine: faculty('fine') });
  const first = await open();
  assert.equal((await first.stand('broken', { make: 'broken' })).why, 'it did not stand: its port is taken');
  await first.stand('fine', { make: 'fine' });
  await first.close();
  const second = await open();
  const described = (await second.describe()).faculties;
  assert.deepEqual(described.broken, { why: 'it did not stand: its port is taken' });
  assert.deepEqual((described.fine as { blueprint: string }).blueprint, 'fine');
  assert.deepEqual((await second.add('shop', entry('shop', ['broken']))).why, 'the faculty broken is down: it did not stand: its port is taken');
  await second.close();
});

test('A faculty keeps what it must in a memory of its own, sealed, across the ground’s lives', async () => {
  const { open } = machine({ keeper: faculty('keeper') });
  const first = await open();
  await first.stand('keeper', { make: 'keeper' });
  await first.close();
  const kept = new Map<string, unknown>();
  const second = await open({
    faculties: {
      keeper: {
        up: async ({ memory }) => {
          if ((await memory.list()).length === 0) await memory.write({ writes: { seen: { call: new TextEncoder().encode('once') } }, expect: { seen: null } });
          kept.set('places', await memory.list());
          kept.set('seen', new TextDecoder().decode((await memory.read({ place: 'seen' })).entries.call));
          return body('keeper');
        },
      },
    },
  });
  await second.close();
  const third = await open({
    faculties: {
      keeper: {
        up: async ({ memory }) => {
          kept.set('again', new TextDecoder().decode((await memory.read({ place: 'seen' })).entries.call));
          return body('keeper');
        },
      },
    },
  });
  await third.close();
  assert.deepEqual(kept.get('places'), ['seen']);
  assert.equal(kept.get('seen'), 'once');
  assert.equal(kept.get('again'), 'once', 'the next life reads what it wrote');
});

test('A body goes down when the ground closes, in the reverse of the ladder, and its handler is chained', async () => {
  const stopped: string[] = [];
  const response = new Response('second');
  const { open } = machine({
    first: faculty('first', { down: () => void stopped.push('first') }),
    second: faculty('second', { handler: { fetch: async (request) => (new URL(request.url).pathname === '/second' ? response : null) }, down: () => void stopped.push('second') }),
  });
  const ground = await open();
  await ground.stand('first', { make: 'first' });
  assert.equal(await ground.handler.fetch(new Request('http://ground/second')), null, 'nothing answers before it stands');
  await ground.stand('second', { make: 'second' });
  assert.equal(await ground.handler.fetch(new Request('http://ground/second')), response, 'a faculty stood while the ground runs is served at once');
  await ground.close();
  assert.deepEqual(stopped, ['second', 'first'], 'in reverse');
});

test('It refuses a faculty raised any way but its `up`, foundation or custom', async () => {
  const bare = (() => body('bare')) as unknown as Faculty;
  const { open } = machine({
    bare,
    crypto: { up: () => ({ serves: 'crypto', object: {} }) },
    ledger: { up: () => ({ serves: 'memory', object: new FakeMemory(), house: () => new FakeMemory() }) },
    carryless: { up: () => ({ serves: 'carry', object: new FakeNetwork().join('x') }) },
    halfway: { up: () => ({ serves: 'classes' }) },
    both: { up: () => ({ serves: 'clock', blueprint: { name: 'both', methods: {} }, object: new FakeClock() }) },
    'second-clock': { up: () => ({ serves: 'clock', object: new FakeClock() }) },
  });
  const ground = await open();
  assert.match((await ground.stand('bare', { make: 'bare' })).why ?? '', /^it did not stand: /, 'a function is no faculty: only `up` raises one');
  assert.equal((await ground.stand('minted', { make: 'crypto' })).why, 'the crypto is primordial, and the drawer names none');
  await assert.rejects(ground.stand('crypto', { make: 'crypto' }), /the crypto is primordial: its entry is the host’s, and the drawer names none/, 'no entry takes a primordial role’s name');
  assert.equal((await ground.stand('ledger', { make: 'ledger' })).why, 'the ground’s memory is primordial, and the drawer names none');
  assert.equal((await ground.stand('carryless', { make: 'carryless' })).why, 'a carry names the schemes it speaks');
  assert.equal((await ground.stand('halfway', { make: 'halfway' })).why, 'a body serving classes serves each house through house()');
  assert.equal((await ground.stand('both', { make: 'both' })).why, 'a body serves the house or offers beings, never both');
  assert.equal((await ground.stand('second-clock', { make: 'second-clock' })).why, 'the clock is primordial, and the drawer names none', 'the ground’s one clock is the host’s');
  assert.equal((await ground.add('shop', { classes: { faculty: 'fake' } })).why, 'the faculty fake serves no classes', 'a house takes its code from a body serving classes alone');
  await ground.close();

  // The primordial are named by the host, and raised by their `up` alone.
  const { open: again } = machine();
  const registry = (faculties: Readonly<Record<string, Faculty>>) => ({ faculties: { 'fake-memory': { up: () => ({ serves: 'memory' as const, object: new FakeMemory() }) }, ...faculties } });
  await assert.rejects(Ground.open({ registry: registry({ key: (() => ({ serves: 'unlock', object: new FakeUnlock('x') })) as unknown as Faculty }), primordial: { ...PRIMORDIAL, unlock: { make: 'key' } } }), /up is not a function/);
  await assert.rejects(Ground.open({ registry: registry({ key: faculty('key') }), primordial: { ...PRIMORDIAL, unlock: { make: 'key' } } }), /the faculty key serves no unlock/);
  await assert.rejects(Ground.open({ registry: registry({}), primordial: { ...PRIMORDIAL, unlock: { make: 'absent' } } }), /no faculty absent in the ground’s registry for its unlock/);
  await (await again()).close();
});

test('A house updated lands its new entry in one write and keeps its ward; a body updated or restarted goes down and up, and each house naming it opens again', async () => {
  const ups: string[] = [];
  const installs: string[] = [];
  const downs: string[] = [];
  const { open } = machine({
    mail: {
      install: ({ args }) => void installs.push(String(args.from)),
      up: ({ args }) => (ups.push(String(args.from)), body('mail', { down: () => void downs.push(String(args.from)) })),
    },
  });
  const first = await open();
  await first.stand('mail', { make: 'mail', args: { from: 'a' } });
  const shop = await first.add('shop', entry('shop', ['mail']));
  await first.ask({ house: 'shop', method: 'bear', args: { kind: 'org.example.host', id: 'bob' } });

  const updated = await first.update('shop', entry('home', ['mail']));
  assert.equal(updated.ward, shop.ward, 'the same seed, so the same ward');
  assert.deepEqual(updated.entry, entry('home', ['mail']));
  assert.ok('result' in (await first.ask({ house: 'shop', method: 'bear', args: { kind: 'org.example.guest', id: 'alice' } })), 'it opened on its new code');

  assert.deepEqual(await first.restand('mail', { make: 'mail', args: { from: 'b' } }), {});
  assert.deepEqual(ups, ['a', 'b']);
  assert.deepEqual(downs, ['a']);
  assert.equal(first.list().find(({ name }) => name === 'shop')?.ward, shop.ward, 'the house naming it opened again, on the same ward');
  assert.deepEqual(await first.restart('mail'), {});
  assert.deepEqual(ups, ['a', 'b', 'b']);
  assert.deepEqual(installs, ['a', 'b'], 'installed once for each entry');
  assert.equal(first.list().find(({ name }) => name === 'shop')?.ward, shop.ward);
  await first.close();

  const second = await open();
  assert.deepEqual(installs, ['a', 'b'], 'a boot on an entry installed installs nothing');
  assert.deepEqual(second.list(), [{ name: 'shop', entry: entry('home', ['mail']), ward: shop.ward }], 'the drawer holds the new entry');
  await second.close();
});
