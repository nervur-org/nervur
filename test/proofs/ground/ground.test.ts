// The ground opens with one key its unlock answers, seals everything else
// in its dock's cells, makes every faculty from its class on a ladder of
// registries, opens each house on the bodies its entry names, and closes a
// house through those bodies.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Carry, Classes, ClassList, Clock, Crypto, Faculty, Ground, Memory, OK, Rung, Unlock, type FacultyClass, type Made, type Registry, type Status } from 'nervur';
import { FakeNetwork } from 'nervur/bench';
import { need, type Json } from 'nervur/being';
import { FakeClock } from '../../../src/bench/fake-clock.ts';
import { FakeMemory } from '../../../src/bench/fake-memory.ts';
import { FakeUnlock } from '../../../src/bench/fake-unlock.ts';
import { contained } from '../../fixtures/ground/contained.ts';
import { Grasping, Shelling } from '../../fixtures/ground/grasping.ts';
import { Counter } from '../../fixtures/world/counter.ts';
import { Guest } from '../../fixtures/world/guest.ts';
import { Host } from '../../fixtures/world/host.ts';
import { Pilot } from '../../fixtures/world/pilot.ts';
import { Looker, Probe } from '../../fixtures/world/prober.ts';
import { Steward } from '../../fixtures/world/steward.ts';
import { serving, type Parts } from '../../fixtures/serving.ts';

// The classes each house may be handed, by the name its entry gives them.
const SETS: Record<string, ClassList> = {
  shop: new ClassList({ steward: Steward, beings: [Host, Counter] }),
  home: new ClassList({ steward: Steward, beings: [Guest] }),
  control: new ClassList({ steward: Steward, beings: [Pilot] }),
  grasp: new ClassList({ steward: Steward, beings: [Grasping, Shelling] }),
  probe: new ClassList({ steward: Steward, beings: [Looker] }),
};

// A faculty offering beings a blueprint of its name and an empty object, with any part more.
const faculty = (name: string, parts: Parts = {}): FacultyClass => serving({ name, methods: {} }, () => ({}), parts);

// A faculty offering beings a blueprint of its name, whose `up` runs `up` on what it was made with.
const raised = (name: string, up: (made: Made) => unknown): FacultyClass =>
  class Raised extends Faculty {
    static override readonly blueprint = { name, methods: {} };
    override async up(): Promise<Status> {
      await up(this.made);
      return OK;
    }
  };

// A faculty that holds more faculties and serves nothing else.
const rung = (registry: Registry): FacultyClass =>
  class Held extends Faculty {
    static override readonly blueprint = Rung;
    override readonly registry = registry;
  };

const PRIMORDIAL = { unlock: { make: 'fake-unlock' }, memory: { make: 'fake-memory' }, crypto: { make: 'noble' }, tools: { make: 'strict' }, clock: { make: 'fake-clock' } } as const;
const ENTRIES = { carry: { make: 'network' }, fake: { make: 'fake' }, list: { make: 'list' } } as const;

// One machine: its unlock, its memory, a memory apart for each house on `fake`, and one clock, kept across its opens. `opened` counts each house `list` serves.
const machine = (faculties: Readonly<Record<string, FacultyClass>> = {}) => {
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
  const own = (key: Unlock): Record<string, FacultyClass> => ({
    'fake-unlock': serving(Unlock, () => key),
    'fake-memory': serving(Memory, () => counted),
    'fake-clock': serving(Clock, () => clock),
    network: serving(Carry, () => new FakeNetwork().join('ground'), { schemes: ['bench'] }),
    fake: serving(Memory, undefined, { house: ({ house }) => memories.get(house) ?? memories.set(house, new FakeMemory()).get(house)! }),
    list: serving(Classes, undefined, {
      house: ({ args }) => {
        const set = SETS[args.set as string];
        if (set === undefined) throw new Error(`no set ${String(args.set)}`);
        counts.opened++;
        return set;
      },
    }),
  });
  const open = (options: { lazy?: boolean; faculties?: Readonly<Record<string, FacultyClass>>; unlock?: Unlock } = {}) =>
    Ground.open({
      registry: { faculties: { ...own(options.unlock ?? unlock), ...(options.faculties ?? faculties) } },
      primordial: PRIMORDIAL,
      entries: ENTRIES,
      ...(options.lazy === undefined ? {} : { lazy: options.lazy }),
    });
  return { open, clock, memory, memories, counts };
};

const entry = (set: string, faculties?: string[]) => ({ classes: { faculty: 'list', set }, ...(faculties === undefined ? {} : { faculties }) });

test('A ground opens every house its dock holds again, on the same wards', async () => {
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
    'in the order of their names, as the dock keeps them',
  );
  assert.deepEqual(await second.ask({ house: 'shop', id: 'bob', method: 'greet' }), { result: 'bob greets root' }, 'his places stayed in his view of the ground’s memory');
  await second.close();
});

test('Everything a ground keeps at rest is sealed, under names that say nothing', async () => {
  const { open, memory } = machine({ keeper: faculty('keeper') });
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

test('The dock holds everything in its beings’ cells: the ground’s memory holds no place outside the views it hands the dock, its houses and its faculties', async () => {
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
  assert.deepEqual(await cells('steward'), { wait: 5_000, classes: null, classesWhy: null }, 'the ground’s bound, and no dock classes of the owner’s');
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
  const { open } = machine({ pay: raised('pay', ({ secrets }) => Object.assign(given, secrets)) });
  const ground = await open();
  t.after(() => ground.close());
  assert.deepEqual(await ground.hand({ method: 'secretsSet', args: { name: 'stripe-key', value: 'sk_live_plain' } }), { result: null });
  assert.deepEqual(await ground.hand({ id: 'secret.stripe-key', cells: true }), { error: { message: 'a secret’s cells are shown to no one' } });
  const described = await ground.hand({ id: 'secret.stripe-key' });
  assert.ok(!JSON.stringify(described).includes('sk_live_plain'), 'her describe shows her asks and never her value');
  await ground.stand('pay', { make: 'pay', secrets: ['stripe-key'] });
  assert.deepEqual(given, { 'stripe-key': 'sk_live_plain' }, 'the body standing on her received it at its up');
});

test('It refuses a faculty entry naming or making `ground` or `shell`, and any entry granting `shell`: a house’s faculties alone grant the ground, and no being of another house holds the ground’s work or the shell', async (t) => {
  const { open } = machine();
  const ground = await open();
  t.after(() => ground.close());
  const work = 'the ground is the library’s: no faculty entry names it or makes it, and a house’s faculties alone grant it';
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
    ['housesAdd', { name: 'shop', ...entry('grasp', ['shell']) }, shell],
  ] as const) {
    assert.deepEqual(await ground.hand({ method, args }), { error: { message } }, `${method} ${JSON.stringify(args)}`);
  }
  await ground.add('shop', entry('grasp'));
  // A house granted the ground holds the houses of its ground, never the ground's work.
  await ground.add('granted', entry('grasp', ['ground']));
  for (const [house, kind] of [
    ['shop', 'org.example.grasping'],
    ['shop', 'org.example.shelling'],
    ['granted', 'org.example.grasping'],
  ] as const) {
    const borne = await ground.ask({ house, method: 'bear', args: { kind, id: 'x' } });
    assert.ok('error' in borne && /no offer covers her need/.test(borne.error.message), `${house} ${kind}: ${JSON.stringify(borne)}`);
  }
});

test('It refuses a dock opened with a key that did not seal it', async () => {
  const { open } = machine();
  const ground = await open();
  await ground.add('shop', entry('shop'));
  await ground.close();
  await assert.rejects(open({ unlock: new FakeUnlock('another') }), /this memory holds no dock this key opens/);
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

test('Another entry under a name the dock holds is refused to an addition, and is an update', async () => {
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

test('A custom faculty down never closes a house: an awaited call to it answers an error naming why, and every other ask answers', async () => {
  let fails = true;
  class Lens extends Faculty {
    static override readonly blueprint = Probe;
    override up(): Status {
      if (fails) throw new Error('its key is wrong');
      return OK;
    }
    async look({ n }: { n: number }) {
      return { result: `saw ${n}` };
    }
    async poke() {
      return { result: null };
    }
  }
  const { open } = machine({ probe: Lens });
  const ground = await open();
  assert.equal((await ground.stand('probe', { make: 'probe' })).why, 'it did not stand: its key is wrong');
  const opened = await ground.add('shop', entry('probe', ['probe']));
  assert.ok(opened.ward !== undefined && opened.why === undefined, 'the house opens beside the body that is down');
  assert.ok('result' in (await ground.ask({ house: 'shop', method: 'bear', args: { kind: 'org.example.looker', id: 'l' } })), 'a being whose need it covers is borne');
  assert.deepEqual(await ground.ask({ house: 'shop', id: 'l', method: 'look', args: { n: 1 } }), { result: 'failed: the faculty probe is down: it did not stand: its key is wrong' }, 'an awaited call answers an error naming why');
  assert.deepEqual(await ground.ask({ house: 'shop', id: 'l', method: 'glance', args: { n: 1 } }), { result: 'went on' }, 'another ask answers');
  assert.ok('result' in (await ground.ask({ house: 'shop', method: 'list' })), 'and so does her steward');
  fails = false;
  assert.deepEqual(await ground.restart('probe'), {});
  assert.deepEqual(await ground.ask({ house: 'shop', id: 'l', method: 'look', args: { n: 2 } }), { result: 'saw 2' }, 'the body standing again answers');
  await ground.close();
});

test('It refuses a grant naming a being the dock does not hold: an entry names only faculties that stand as twins, and nothing lands', async (t) => {
  const { open } = machine({ stripe: faculty('stripe') });
  const ground = await open();
  t.after(() => ground.close());
  await assert.rejects(ground.add('shop', entry('shop', ['stripe'])), /the house shop is refused: no faculty stripe is here/);
  await assert.rejects(ground.add('shop', { classes: { faculty: 'absent' } }), /the house shop is refused: no faculty absent is here/);
  await assert.rejects(ground.stand('mail', { from: 'recipe', make: 'mail' }), /the faculty mail is refused: no faculty recipe is here/);
  await assert.rejects(ground.stand('bell', { make: 'stripe', faculties: ['post'] }), /the faculty bell is refused: no faculty post is here/);
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
    ['classesSet', { classes: { faculty: 'module' } }],
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
  const { open } = machine({ pay: raised('pay', ({ name, secrets }) => (given[name] = secrets)) });
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
  assert.deepEqual(await ground.stand('lacking', { make: 'pay', secrets: ['absent'] }), {}, 'a secret named and not kept lands the entry');
  assert.deepEqual({ ...(given as Record<string, object>).lacking }, {}, 'and reaches its up absent');
  await ground.close();
});

test('A faculty stands on the registry an earlier body carries, and a cycle leaves each in it down', async () => {
  const made: string[] = [];
  const upper: Registry = {
    faculties: {
      mail: raised('mail', ({ name }) => made.push(name)),
      upper: serving(Classes, undefined, { house: () => SETS.shop }),
    },
  };
  const { open } = machine({ recipe: rung(upper), loop: rung({}) });
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
    recipe: rung({ faculties: { mail: faculty('mail', { down: () => void stopped.push('mail') }) } }),
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

test('A hook answers a status, and never throws: an `up` that throws or answers not ok leaves its body down with why, and the ground boots beside it', async () => {
  class Refusing extends Faculty {
    static override readonly blueprint = { name: 'refusing', methods: {} };
    override up(): Status {
      return { ok: false, why: 'its licence ran out' };
    }
  }
  const { open } = machine({ broken: raised('broken', () => Promise.reject(new Error('its port is taken'))), refusing: Refusing, fine: faculty('fine') });
  const first = await open();
  assert.equal((await first.stand('broken', { make: 'broken' })).why, 'it did not stand: its port is taken', 'a throw is read as not ok, its message the why');
  assert.equal((await first.stand('refusing', { make: 'refusing' })).why, 'its licence ran out', 'a status not ok gives its why as it is');
  await first.stand('fine', { make: 'fine' });
  await first.close();
  const second = await open();
  const described = (await second.describe()).faculties;
  assert.deepEqual(described.broken, { why: 'it did not stand: its port is taken' });
  assert.deepEqual(described.refusing, { why: 'its licence ran out' });
  assert.deepEqual((described.fine as { blueprint: string }).blueprint, 'fine');
  const opened = await second.add('shop', entry('shop', ['broken']));
  assert.ok(opened.ward !== undefined && opened.why === undefined, 'a house naming a custom body that is down opens');
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
      keeper: raised('keeper', async ({ memory }) => {
        if ((await memory.list()).length === 0) await memory.write({ writes: { seen: { call: new TextEncoder().encode('once') } }, expect: { seen: null } });
        kept.set('places', await memory.list());
        kept.set('seen', new TextDecoder().decode((await memory.read({ place: 'seen' })).entries.call));
      }),
    },
  });
  await second.close();
  const third = await open({
    faculties: {
      keeper: raised('keeper', async ({ memory }) => {
        kept.set('again', new TextDecoder().decode((await memory.read({ place: 'seen' })).entries.call));
      }),
    },
  });
  await third.close();
  assert.deepEqual(kept.get('places'), ['seen']);
  assert.equal(kept.get('seen'), 'once');
  assert.equal(kept.get('again'), 'once', 'the next life reads what it wrote');
});

test('A faculty derives keys of its own from the ground’s key, the same in every life and apart from every other entry', async () => {
  const derived = new Map<string, string>();
  // A faculty that derives under its label, and keeps what it derived by its entry's name and the life it stood in.
  const deriver = (life: string, label = 'ssh'): FacultyClass =>
    raised('deriver', async ({ name, derive }) => {
      derived.set(`${life}:${name}:${label}`, Buffer.from(await derive(label, 32)).toString('hex'));
    });
  const { open, memory } = machine({ deriver: deriver('first') });
  const first = await open();
  await first.stand('one', { make: 'deriver' });
  await first.stand('two', { make: 'deriver' });
  await first.close();
  const second = await open({ faculties: { deriver: deriver('second') } });
  await second.close();
  const third = await open({ faculties: { deriver: deriver('third', 'deploy') } });
  await third.close();
  const other = await machine({ deriver: deriver('other') }).open({ unlock: new FakeUnlock('another') });
  await other.stand('one', { make: 'deriver' });
  await other.close();

  const one = derived.get('first:one:ssh')!;
  assert.match(one, /^[0-9a-f]{64}$/);
  assert.equal(derived.get('second:one:ssh'), one, 'the next life derives the same bytes, and nothing was stored for them');
  assert.notEqual(derived.get('first:two:ssh'), one, 'another entry derives its own');
  assert.notEqual(derived.get('third:one:deploy'), one, 'another label derives its own');
  assert.notEqual(derived.get('other:one:ssh'), one, 'another ground’s key derives its own');
  for (const place of await memory.list()) for (const bytes of Object.values((await memory.read({ place })).entries)) assert.ok(!Buffer.from(bytes).toString('hex').includes(one), `${place} holds the derived key`);
});

test('It refuses a faculty’s key derived under no label, or shorter than thirty-two bytes: a primordial faculty derives nothing at all', async () => {
  const refused: string[] = [];
  const { open } = machine({
    short: raised('short', async ({ derive }) => {
      for (const [label, length] of [['ssh', 16], ['', 32]] as const) await derive(label, length).catch((error: Error) => refused.push(error.message));
    }),
  });
  const ground = await open();
  await ground.stand('short', { make: 'short' });
  await ground.close();
  assert.deepEqual(refused, ['a faculty derives thirty-two bytes at least', 'a faculty derives under a label']);
  await assert.rejects(
    open({ faculties: { 'fake-clock': serving(Clock, async ({ derive }) => ({ key: await derive('clock', 32) })) } }),
    /a primordial faculty derives nothing/,
  );
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

test('It refuses a faculty raised any way but its `up`, foundation or custom: one that is no class extending Faculty, or fills what its blueprint names wrong, stays down with why', async () => {
  const bare = (() => ({})) as unknown as FacultyClass;
  const { open } = machine({
    bare,
    blank: class Blank extends Faculty {},
    hollow: class Hollow extends Faculty {
      static override readonly blueprint = need('hollow', { ring: {} });
    },
    crypto: serving(Crypto, () => ({})),
    carryless: serving(Carry, () => new FakeNetwork().join('x')),
    halfway: serving(Classes),
    'second-clock': serving(Clock, () => new FakeClock()),
  });
  const ground = await open();
  assert.match((await ground.stand('bare', { make: 'bare' })).why ?? '', /^it was not made: /, 'a function is no faculty: the ground makes one from its class');
  assert.equal((await ground.stand('blank', { make: 'blank' })).why, 'a faculty offers a blueprint: a need of its own, or a contract of the foundation');
  assert.equal((await ground.stand('hollow', { make: 'hollow' })).why, 'the faculty hollow has no method ring', 'the body has every method its blueprint names');
  assert.equal((await ground.stand('minted', { make: 'crypto' })).why, 'the crypto is primordial, and the dock’s entries name none');
  await assert.rejects(ground.stand('crypto', { make: 'crypto' }), /the crypto is primordial: its entry is the host’s, and the dock’s entries name none/, 'no entry takes a primordial role’s name');
  assert.equal((await ground.stand('carryless', { make: 'carryless' })).why, 'a carry names the schemes it speaks');
  assert.equal((await ground.stand('halfway', { make: 'halfway' })).why, 'a body serving classes serves each house through house()');
  assert.equal((await ground.stand('second-clock', { make: 'second-clock' })).why, 'the clock is primordial, and the dock’s entries name none', 'the ground’s one clock is the host’s');
  assert.equal((await ground.add('shop', { classes: { faculty: 'fake' } })).why, 'the faculty fake serves no classes', 'a house takes its code from a body serving classes alone');
  await ground.close();

  // The primordial are named by the host, and made from their classes alone.
  const { open: again } = machine();
  const registry = (faculties: Readonly<Record<string, FacultyClass>>) => ({ faculties: { 'fake-memory': serving(Memory, () => new FakeMemory()), ...faculties } });
  await assert.rejects(Ground.open({ registry: registry({ key: (() => ({})) as unknown as FacultyClass }), primordial: { ...PRIMORDIAL, unlock: { make: 'key' } } }), /the faculty key serves no unlock/, 'a function names no blueprint, so it fills no contract');
  await assert.rejects(Ground.open({ registry: registry({ key: faculty('key') }), primordial: { ...PRIMORDIAL, unlock: { make: 'key' } } }), /the faculty key serves no unlock/);
  await assert.rejects(Ground.open({ registry: registry({}), primordial: { ...PRIMORDIAL, unlock: { make: 'absent' } } }), /no faculty absent in the ground’s registry for its unlock/);
  await (await again()).close();
});

test('It refuses a blueprint offering a method named after a hook or a part of every faculty: its body stays down, naming the method', async (t) => {
  const named = (method: string): FacultyClass =>
    class Named extends Faculty {
      static override readonly blueprint = need(`named-${method}`, { [method]: {} });
    };
  const hooks = ['made', 'install', 'migrate', 'up', 'health', 'down', 'uninstall', 'opened', 'house', 'blueprint', 'window', 'handler', 'registry', 'schemes', 'port'];
  const { open } = machine(Object.fromEntries(hooks.map((hook) => [hook, named(hook)])));
  const ground = await open();
  t.after(() => ground.close());
  for (const hook of hooks) assert.equal((await ground.stand(`a-${hook}`, { make: hook })).why, `the faculty a-${hook} offers a method ${hook}, which is a hook of every faculty`, hook);
});

test('A house updated lands its new entry in one write and keeps its ward; a body updated or restarted goes down and up, and each house naming it opens again', async () => {
  const ups: string[] = [];
  const installs: string[] = [];
  const downs: string[] = [];
  class Mail extends Faculty {
    static override readonly blueprint = { name: 'mail', methods: {} };
    override install(): Status {
      installs.push(String(this.made.args.from));
      return OK;
    }
    override up(): Status {
      ups.push(String(this.made.args.from));
      return OK;
    }
    override down(): void {
      downs.push(String(this.made.args.from));
    }
  }
  const { open } = machine({ mail: Mail });
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
  assert.deepEqual(second.list(), [{ name: 'shop', entry: entry('home', ['mail']), ward: shop.ward }], 'the dock holds the new entry');
  await second.close();
});

test('An installer meets each need before install, and only where install runs', async () => {
  const { log, held, registry } = contained();
  const { open } = machine(registry.faculties);
  const first = await open();
  await first.stand('pkg', { make: 'pkg' });
  await first.stand('box', { make: 'box' });
  log.length = 0;
  assert.deepEqual(await first.stand('scanner', { make: 'scanner', installers: ['pkg', 'box'], args: {} }), {});
  assert.deepEqual(log, [
    'pkg meets packages {"apt":"tesseract-ocr","brew":"tesseract"} for scanner',
    'box meets containers [{"image":"redis:7"}] for scanner',
    'install scanner',
    'up scanner',
  ]);
  const cells = await first.hand({ id: 'faculty.scanner', cells: true });
  const met = { packages: { tesseract: '/opt/pkg/bin/tesseract' }, containers: null };
  assert.deepEqual(
    'result' in cells && (cells.result as { met: Json }).met,
    { packages: { by: 'pkg', met: met.packages }, containers: { by: 'box', met: null } },
    'its twin keeps which installer met each need, and what it answered',
  );
  assert.deepEqual(held.met, met, 'its body is handed what each installer answered, by kind');
  assert.ok(Object.isFrozen(held.met), 'what it is handed it only reads');

  log.length = 0;
  held.met = undefined;
  assert.deepEqual(await first.restart('scanner'), {});
  assert.deepEqual(log, ['up scanner'], 'a restart meets nothing and installs nothing');
  assert.deepEqual(held.met, met, 'a restart hands what its twin kept');
  await first.close();
  held.met = undefined;
  const second = await open();
  assert.deepEqual(log, ['up scanner', 'up box', 'up pkg', 'up scanner'], 'a boot on an entry installed meets nothing');
  assert.deepEqual(held.met, met, 'a boot hands what its twin kept');

  log.length = 0;
  assert.deepEqual(await second.restand('scanner', { make: 'scanner', installers: ['pkg', 'box'], args: { lang: 'ron' } }), {});
  assert.deepEqual(log.slice(0, 3), ['pkg meets packages {"apt":"tesseract-ocr","brew":"tesseract"} for scanner', 'box meets containers [{"image":"redis:7"}] for scanner', 'install scanner'], 'an entry that moved meets its needs again');
  await second.close();
});

test('It refuses a need no installer its entry names meets: its body stays down, naming the kind', async () => {
  const { log, held, registry } = contained();
  const { open } = machine(registry.faculties);
  const ground = await open();
  await ground.stand('pkg', { make: 'pkg' });
  log.length = 0;
  assert.deepEqual(await ground.stand('scanner', { make: 'scanner', installers: ['pkg'] }), { why: 'no installer its entry names meets its need containers' });
  assert.deepEqual(await ground.stand('bare', { make: 'scanner' }), { why: 'no installer its entry names meets its need packages' });
  assert.ok(!log.includes('install scanner'), 'nothing installs');

  await ground.stand('box', { make: 'box' });
  held.meetFails = true;
  assert.deepEqual(await ground.restand('scanner', { make: 'scanner', installers: ['pkg', 'box'] }), { why: 'its need packages was not met by pkg: the mirror is down' });
  held.meetFails = false;
  assert.deepEqual(await ground.restart('scanner'), {}, 'a need not met is met again when the body next goes up');
  await ground.close();
});
