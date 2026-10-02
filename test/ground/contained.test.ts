// A faculty is one contained entity. Its blueprint and its hooks are its
// only surface, its state is its twin's cells and its own memory, and what
// it needs of its terrain is declared as data. Its version is migrated
// before it goes up, what it installed is let go of when it is removed,
// its health is asked on demand, its installers stand below it on the
// ladder, and on a bench its fake stands in its place.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Faculty, OK, type FacultyClass, type FacultyExample, type Status } from 'nervur';
import { Bench, BenchGround, FakeNetwork } from 'nervur/bench';
import type { Json } from 'nervur/being';
import { contained, Lamp } from '../fixtures/ground/contained.ts';

const open = async (t: { after(done: () => unknown): void }) => {
  const { log, held, registry } = contained();
  const network = new FakeNetwork();
  const ground = await BenchGround.open({ network, host: 'home', registry });
  t.after(() => ground.down());
  const ask = (method: string, args?: Json) => ground.hand({ method, ...(args === undefined ? {} : { args }) });
  const cells = async (name: string) => ((await ground.hand({ id: `faculty.${name}`, cells: true })) as { result: Record<string, Json> }).result;
  return { ground, network, log, held, ask, cells };
};

test('A faculty migrates before it goes up, where its version moved', async (t) => {
  const { ground, log, held, ask, cells } = await open(t);
  assert.deepEqual(await ask('facultiesAdd', { name: 'keeper', make: 'keeper' }), { result: {} });
  assert.equal((await cells('keeper')).version, '1', 'its twin keeps the version its memory was brought to');

  await ground.down();
  held.version = '2';
  await ground.up();
  assert.equal((await cells('keeper')).version, '2');

  await ground.down();
  held.version = '1';
  await ground.up();
  assert.deepEqual(log, ['up keeper 1', 'migrate 1 to 2', 'up keeper 2', 'migrate 2 to 1', 'up keeper 1'], 'a fresh entry installs and migrates nothing, then each move migrates first, forward or back');

  held.version = '3';
  held.migrateFails = true;
  assert.deepEqual(await ask('facultiesRestart', { name: 'keeper' }), { result: { why: 'it did not migrate from 1: the rows do not fit' } });
  assert.equal((await cells('keeper')).version, '1', 'a migration that failed keeps the version it came from');
  held.migrateFails = false;
  assert.deepEqual(await ask('facultiesRestart', { name: 'keeper' }), { result: {} });
  assert.deepEqual(log.slice(-2), ['migrate 1 to 3', 'up keeper 3']);
});

test('`uninstall` lets go of what install made, once the body is down', async (t) => {
  const { log, held, ask, cells } = await open(t);
  await ask('facultiesAdd', { name: 'kit', make: 'kit' });
  assert.deepEqual(await ask('facultiesRemove', { name: 'kit' }), { result: {} });
  assert.deepEqual(log, ['install kit', 'up kit', 'down kit', 'uninstall kit']);

  // An uninstall that fails is answered, and the removal stands.
  await ask('facultiesAdd', { name: 'kit', make: 'kit' });
  held.uninstallFails = true;
  assert.deepEqual(await ask('facultiesRemove', { name: 'kit' }), { result: { why: 'it did not uninstall: the folder is busy' } });
  const listed = (await ask('facultiesList')) as { result: { name: string }[] };
  assert.equal(
    listed.result.find(({ name }) => name === 'kit'),
    undefined,
    'its entry is dropped',
  );
  assert.equal(await cells('kit'), undefined, 'its twin went with it');
});

test('A body answers its health when asked, and never on a clock', async (t) => {
  const { network, log, held, ask, ground } = await open(t);
  await ask('facultiesAdd', { name: 'probe', make: 'probe' });
  await ask('facultiesAdd', { name: 'plain', make: 'plain' });
  await network.advance(3_600_000);
  assert.deepEqual(log, [], 'no clock asks it');

  assert.deepEqual(await ask('facultiesHealth', { name: 'probe' }), { result: { ok: true } });
  held.health = { ok: false, why: 'the queue is full' };
  assert.deepEqual(await ask('facultiesHealth', { name: 'probe' }), { result: { ok: false, why: 'the queue is full' } });
  assert.deepEqual(await ground.hand({ id: 'faculty.probe', method: 'health' }), { result: { ok: false, why: 'the queue is full' } }, 'its twin asks it, as the hand reaches her');
  assert.deepEqual(log, ['health', 'health', 'health'], 'once for each ask');

  assert.deepEqual(await ask('facultiesHealth', { name: 'plain' }), { result: { ok: true } }, 'a body with no health serves while it stands');
  assert.deepEqual(await ask('facultiesHealth', { name: 'absent' }), { error: { message: 'no faculty absent stands here' } });
});

test('The ladder raises a faculty after its installers', async (t) => {
  const { ground, log, ask } = await open(t);
  assert.deepEqual(await ask('facultiesAdd', { name: 'pkg', make: 'pkg' }), { result: {} });
  assert.deepEqual(await ask('facultiesAdd', { name: 'fax', make: 'fax', installers: ['pkg'] }), { result: {} });
  const listed = (await ask('facultiesList')) as { result: { name: string; entry: Json; serves?: string }[] };
  assert.deepEqual(
    listed.result.find(({ name }) => name === 'fax')?.entry,
    { make: 'fax', installers: ['pkg'] },
    'the entry names its installer, a standing',
  );
  assert.equal(listed.result.find(({ name }) => name === 'pkg')?.serves, 'installer');
  assert.deepEqual(await ask('facultiesRemove', { name: 'pkg' }), { error: { message: 'the faculty pkg is in use by the faculty fax' } }, 'an installer in use stays');

  log.length = 0;
  await ground.down();
  await ground.up();
  assert.deepEqual(log, ['up pkg', 'up fax'], 'fax sorts first, and stands after its installer');
});

test('It refuses a grant naming a being the dock does not hold: an installer too, and nothing lands', async (t) => {
  const { ask } = await open(t);
  assert.deepEqual(await ask('facultiesAdd', { name: 'fax', make: 'fax', installers: ['nope'] }), { error: { message: 'the faculty fax is refused: no faculty nope is here' } });
  assert.deepEqual(await ask('facultiesAdd', { name: 'fax', make: 'fax', installers: 'pkg' }), { error: { message: 'the value.installers is not an array' } });
  const listed = (await ask('facultiesList')) as { result: { name: string }[] };
  assert.equal(
    listed.result.find(({ name }) => name === 'fax'),
    undefined,
  );
});

test('It refuses an installer named that serves no installer: the body naming it stays down with why', async (t) => {
  const { ask } = await open(t);
  await ask('facultiesAdd', { name: 'plain', make: 'plain' });
  assert.deepEqual(await ask('facultiesAdd', { name: 'fax', make: 'fax', installers: ['plain'] }), { result: { why: 'the faculty plain serves no installer' } });
});

test('On a bench, a faculty stands its fake in its place', async (t) => {
  const { log, ask } = await open(t);
  assert.deepEqual(await ask('facultiesAdd', { name: 'lamp', make: 'lamp' }), { result: {} });
  assert.deepEqual(log, ['up the fake lamp']);
  assert.deepEqual(await ask('callFaculty', { faculty: 'lamp', method: 'shine' }), { result: 'the fake lamp' });
});

test('It refuses a faculty that needs its terrain, stood on a bench without a fake: it stays down with why', async (t) => {
  const { log, ask } = await open(t);
  await ask('facultiesAdd', { name: 'pkg', make: 'pkg' });
  await ask('facultiesAdd', { name: 'box', make: 'box' });
  assert.deepEqual(await ask('facultiesAdd', { name: 'scanner', make: 'scanner', installers: ['pkg', 'box'] }), { result: { why: 'it needs its terrain, and has no fake to stand in its place' } });
  assert.deepEqual(log, ['up pkg', 'up box'], 'no installer is handed its needs, and nothing installs');
});

test('It refuses a need met by the library: no faculty a terrain stands serves an installer', async (t) => {
  const { ask } = await open(t);
  const listed = (await ask('facultiesList')) as { result: { name: string; serves?: string }[] };
  assert.deepEqual(
    listed.result.filter(({ serves }) => serves === 'installer'),
    [],
  );
  const catalog = (await ask('facultiesCatalog')) as { result: { faculties: { make: string; needs?: Json }[] }[] };
  assert.deepEqual(catalog.result[0].faculties.find(({ make }) => make === 'scanner')?.needs, { packages: { apt: 'tesseract-ocr', brew: 'tesseract' }, containers: [{ image: 'redis:7' }] }, 'the catalogue shows what a faculty needs, as data');
});

// A lamp that answers what it shines, and the contract every lamp keeps: `shine` answers the lamp by name.
const EXAMPLES: readonly FacultyExample[] = [{ method: 'shine', id: 'one', gives: { result: 'a lamp' } }];

// A lamp class that shines what it is given, with a fake that shines what it is given, each held to the lamp's examples and its contract.
const lamp = (real: () => Json, fake?: () => Json, needs?: Record<string, Json>): FacultyClass => {
  class FakeLamp extends Faculty {
    static override readonly blueprint = Lamp;
    async shine() {
      return { result: fake!() };
    }
  }
  return class RealLamp extends Faculty {
    static override readonly blueprint = Lamp;
    static override readonly needs = needs;
    static override readonly fake = fake === undefined ? undefined : FakeLamp;
    static override readonly examples = EXAMPLES;
    static override async contract(body: Faculty): Promise<void> {
      const answered = await (body as unknown as { shine: (args: Json) => Promise<{ result?: unknown }> }).shine({});
      if (typeof answered.result !== 'string' || !answered.result.endsWith('lamp')) throw new Error(`shine answered ${JSON.stringify(answered)}, and a lamp answers its name`);
    }
    async shine() {
      return { result: real() };
    }
  };
};

test('`Bench.check` walks a faculty and its fake: a good faculty passes, and each broken promise is a finding', async () => {
  const good = await Bench.check(lamp(() => 'a lamp', () => 'a lamp', { packages: { apt: 'lamp-driver' } }));
  assert.ok(good.length > 0 && good.every(({ ok }) => ok), 'every finding holds');
  assert.ok(
    good.every(({ what }) => what.startsWith('its ')),
    'a faculty that needs its terrain is walked on its fake alone',
  );
  const both = await Bench.check(lamp(() => 'a lamp', () => 'a lamp', { packages: { apt: 'lamp-driver' } }), { made: { args: {} } });
  assert.ok(
    both.some(({ what }) => what.startsWith('the faculty: ')),
    'the real body is walked where the test hands its terrain',
  );
  assert.ok((await Bench.check(lamp(() => 'a lamp'))).every(({ ok }) => ok), 'a faculty that needs no terrain needs no fake');

  let shone = 0;
  await assert.rejects(
    Bench.check(lamp(() => (shone++ === 0 ? 'a lamp' : 'another lamp'))),
    /- the faculty: shine one, first life, asked again: it gave \{"result":"another lamp"\}, and its example gives \{"result":"a lamp"\}/,
    'an answer that differs on replay is a finding',
  );
  await assert.rejects(
    Bench.check(
      lamp(() => {
        throw new Error('the bulb burst');
      }),
    ),
    /- the faculty: shine one, first life: it threw: the bulb burst/,
    'a method that throws is a finding',
  );
  await assert.rejects(Bench.check(lamp(() => 'a lamp', undefined, { packages: { apt: 'lamp-driver' } })), /- its fake: it needs its terrain, and has no fake to stand in its place/, 'a faculty that needs its terrain with no fake is a finding');
  await assert.rejects(Bench.check(lamp(() => 'a lamp', () => 'a candle', { packages: {} })), /- its fake: first life: its contract: shine answered \{"result":"a candle"\}, and a lamp answers its name/, 'a stand-in that breaks the contract is found');
});

test('`Bench.check` holds every hook to a status: a hook that throws is a finding', async () => {
  class Broken extends Faculty {
    static override readonly blueprint = Lamp;
    override up(): Status {
      throw new Error('the socket is gone');
    }
    async shine() {
      return { result: 'a lamp' };
    }
  }
  await assert.rejects(Bench.check(Broken), /- the faculty: first life: up: it threw: the socket is gone/);
});

test('`Bench.raise` raises a faculty as a ground does, and answers its body, never its fake', async () => {
  let lent = '';
  const installed: string[] = [];
  class FakeKeeper extends Faculty {
    static override readonly blueprint = Lamp;
    async shine() {
      return { result: 'a fake lamp' };
    }
  }
  class Keeper extends Faculty {
    static override readonly blueprint = Lamp;
    static override readonly fake = FakeKeeper;
    override install(): Status {
      installed.push(String(this.made.args.room));
      return OK;
    }
    override async up(): Promise<Status> {
      lent = (await this.made.derive('lamp', 32)).length === 32 ? this.made.secrets.key : '';
      return OK;
    }
    override down(): void {
      lent = '';
    }
    async shine() {
      return { result: `the ${String(this.made.args.room)} lamp` };
    }
  }
  const body = await Bench.raise(Keeper, { args: { room: 'hall' }, secrets: { key: 'brass' } });
  assert.deepEqual(await (body as unknown as { shine: () => Promise<Json> }).shine(), { result: 'the hall lamp' }, 'the faculty itself, and not its fake');
  assert.deepEqual(installed, ['hall']);
  assert.equal(lent, 'brass');
  await body.down();
  assert.equal(lent, '', 'down lets go of what up opened');

  class Dark extends Faculty {
    static override readonly blueprint = Lamp;
    override up(): Status {
      return { ok: false, why: 'no bulb' };
    }
  }
  await assert.rejects(Bench.raise(Dark), /the faculty did not stand: no bulb/, 'a hook not ok throws with why');
});
