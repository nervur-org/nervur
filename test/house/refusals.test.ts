// What the house refuses, held where a ground meets it: a token called by
// a faculty it was not handed to, and a faculty whose blueprint leaves the
// schema subset.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClassList, type FacultyContext } from 'nervur';
import { need, s } from 'nervur/being';
import { BenchGround, FakeNetwork } from 'nervur/bench';
import { Bell, Chimes, Knocker } from '../fixtures/world/chimes.ts';
import { Counter } from '../fixtures/world/counter.ts';
import { Gauge, Latch } from '../fixtures/world/gauge.ts';
import { Broken, Lectern, Peeker, Prober, TwinOne, TwinTwo } from '../fixtures/world/prober.ts';
import { Steward } from '../fixtures/world/steward.ts';

type Json = NonNullable<Parameters<BenchGround['ask']>[0]['args']>;

// A house of probers and a counter, with a lectern as its public being, and one prober borne.
const probed = async (t: { after(done: () => unknown): void }) => {
  const ground = await BenchGround.open({ network: new FakeNetwork(), host: 'home', modules: { house: { steward: Steward, public: Lectern, beings: [Prober, Broken, Counter] } } });
  t.after(() => ground.down());
  await ground.add('house');
  const ask = (id: string, method: string, args: Json = {}) => ground.ask({ house: 'house', id, method, args });
  await ask('steward', 'bear', { kind: 'org.example.prober', id: 'p' });
  return { ground, ask };
};

const modules = { house: { steward: Steward, beings: [Chimes] } };

test('A token answers only the faculty it was handed to', async (t) => {
  let token = '';
  // Each faculty calls the one token with a call id of its own, and answers what it heard.
  const call = async (context: FacultyContext, id: string) => {
    const answered = await context.call({ token, args: {}, id });
    return { result: 'error' in answered ? answered.error.message : 'rang' };
  };
  const bell = {
    watch: ({ inbox }: { inbox: string }) => {
      token = inbox;
      return { result: null };
    },
    ring: (_args: unknown, context: FacultyContext) => call(context, 'bell'),
  };
  const knocker = { knock: (_args: unknown, context: FacultyContext) => call(context, 'knocker') };
  const ground = await BenchGround.open({
    network: new FakeNetwork(),
    host: 'home',
    modules,
    faculties: { bell: { blueprint: Bell, object: bell }, knocker: { blueprint: Knocker, object: knocker } },
  });
  t.after(() => ground.down());
  await ground.add('house', 'house', { faculties: ['bell', 'knocker'] });
  await ground.ask({ house: 'house', method: 'bear', args: { kind: 'org.example.chimes', id: 'chimes' } });
  const ask = (method: string, after?: { result: string | number }) => ground.ask({ house: 'house', id: 'chimes', method, ...(after === undefined ? {} : { after }) });
  assert.deepEqual(await ask('arm'), { result: null });
  assert.match(token, /^[0-9a-f]{32}$/);
  assert.deepEqual(await ask('knock'), { result: null });
  // A watch answers once the knock's reply has landed.
  assert.deepEqual(await ask('heard', { result: '' }), { result: 'no such token' }, 'the knocker holds the string and is no bell');
  assert.deepEqual(await ask('rings'), { result: 0 });
  assert.deepEqual(await ask('ring'), { result: null });
  assert.deepEqual(await ask('rings', { result: 0 }), { result: 1 });
});

test('A faculty whose blueprint names a keyword outside the subset stops the boot, named', async () => {
  const Mail = need('mail', { send: { args: s.object({ to: s.string() }), result: { type: 'string', format: 'email' } as never } });
  await assert.rejects(
    BenchGround.open({ network: new FakeNetwork(), host: 'home', modules, faculties: { mail: { blueprint: Mail, object: { send: () => ({ result: 'a@b' }) } } } }),
    /the faculty mail is refused: the faculty mail\.send\.result names format, outside the subset/,
  );
});

test('Her class is checked before her first ask: a class that fails leaves her absent, and the refusal says why', async (t) => {
  const { ask } = await probed(t);
  const borne = await ask('steward', 'bear', { kind: 'org.example.broken', id: 'b' });
  assert.ok('error' in borne && /org\.example\.broken is refused: its ask ghost has no method/.test(borne.error.message), JSON.stringify(borne));
});

test('It refuses a being reaching anything her position, her needs and this.house do not give: a normal being reaches no powers', async (t) => {
  const { ask } = await probed(t);
  const reached = await ask('p', 'reach');
  assert.ok('result' in reached, JSON.stringify(reached));
  const { members, house } = reached.result as { members: string[]; house: string[] };
  assert.deepEqual(members, ['id', 'position', 'asker', 'cells', 'house', 'standings', 'occupants', 'steward', 'held', 'stranger', 'handle', 'invite', 'fail']);
  assert.deepEqual(house, ['alarm', 'cancelAlarm', 'now', 'random'], 'the house gives the time, random bytes and alarms, and nothing of its foundation');
});

test('It refuses a foundation reference handed to a being, or offered as a custom faculty', async (t) => {
  const network = new FakeNetwork();
  const spare = await BenchGround.open({ network, host: 'spare' });
  t.after(() => spare.down());
  // One memory handed to the house as its body, and offered to its beings as a faculty.
  const leaked = spare.machine.memoryOf('leaked');
  const ground = await BenchGround.open({
    network,
    host: 'home',
    modules: { house: { steward: Steward, beings: [Prober] } },
    registry: { faculties: { leaked: { up: () => ({ serves: 'memory', house: () => leaked }) } } },
    faculties: { leak: { blueprint: need('leak', { read: { args: s.object({ place: s.string() }) } }), object: leaked } },
  });
  t.after(() => ground.down());
  await ground.hand({ faculty: 'faculties', method: 'add', args: { name: 'leaked', make: 'leaked' } });
  const standing = await ground.add('house', { memory: { faculty: 'leaked' }, classes: { faculty: 'module', name: 'house' }, faculties: ['leak'] });
  assert.match(standing.why ?? '', /the offer leak is a reference of the house's foundation/);
});

test('It refuses a handle or an invitation in her cells', async (t) => {
  const { ask } = await probed(t);
  assert.deepEqual(await ask('p', 'keep', { ask: 'ping' }), { error: { message: 'a handle, an invitation or a value that is not JSON stands in her cells' } });
});

test('It refuses a standing she mints herself: standings arrive from the house', async (t) => {
  const { ask } = await probed(t);
  const reached = (await ask('p', 'reach')) as { result: { standings: string[] } };
  assert.deepEqual(reached.result.standings, ['drop', 'list', 'note'], 'she reads, notes and drops her standings, and makes none');
  assert.deepEqual(await ask('p', 'note', { standing: 'standing:made-up' }), { result: 'she holds no standing standing:made-up' });
});

test('It refuses an occupant id the house reserves, and one she already holds', async (t) => {
  const { ask } = await probed(t);
  for (const id of ['root', 'stranger', 'steward', 'handle:x', 'being:x']) assert.deepEqual(await ask('p', 'occupy', { id }), { result: `the occupant id ${id} is the house's` }, id);
  assert.deepEqual(await ask('p', 'twice'), { result: 'she holds guest already' });
});

test('It refuses a method landing in a state its to does not name', async (t) => {
  const { ask } = await probed(t);
  await ask('steward', 'bear', { kind: 'org.example.counter', id: 'c' });
  assert.deepEqual(await ask('c', 'wrong'), { error: { message: 'the ask failed' } });
  const described = await ask('c', 'total');
  assert.deepEqual(described, { result: 0 });
  assert.deepEqual(await ask('c', 'close'), { result: null }, 'her state stood open, so an ask that names closed lands');
});

test('It refuses two offers covering one need for one kind, and a kind two sources claim', async (t) => {
  const object = { wait: () => ({ result: null }) };
  const ground = await BenchGround.open({
    network: new FakeNetwork(),
    host: 'home',
    modules: { house: { steward: Steward, beings: [Gauge] } },
    faculties: { one: { blueprint: Latch, object }, two: { blueprint: Latch, object } },
  });
  t.after(() => ground.down());
  const standing = await ground.add('house', 'house', { faculties: ['one', 'two'] });
  assert.match(standing.why ?? '', /two offers of latch serve one kind/);
  assert.throws(() => new ClassList({ steward: Steward, beings: [TwinOne, TwinTwo] }), /two classes claim the kind org\.example\.twin/);
});

test('It refuses an invite from a public being', async (t) => {
  const { ask } = await probed(t);
  assert.deepEqual(await ask('public', 'open'), { result: 'a public being cannot invite' });
});

test('It refuses her cells read by anyone but the hand: her steward’s powers answer her describe', async (t) => {
  const ground = await BenchGround.open({ network: new FakeNetwork(), host: 'home', modules: { house: { steward: Peeker, beings: [Counter] } } });
  t.after(() => ground.down());
  await ground.add('house');
  await ground.ask({ house: 'house', method: 'bear', args: { kind: 'org.example.counter', id: 'c' } });
  assert.deepEqual(await ground.ask({ house: 'house', method: 'peek', args: { id: 'c' } }), { result: ['asks', 'state'] });
  assert.ok('result' in (await ground.ask({ house: 'house', id: 'c', cells: true })), 'the hand reads them');
});

test('It refuses a faculty in a house’s code: what the house’s code exports never covers a need', async (t) => {
  // The module carries an object with the need's method, beside its classes; the ground grants no offer.
  const house = { steward: Steward, beings: [Gauge], latch: { wait: () => ({ result: null }) } };
  const ground = await BenchGround.open({ network: new FakeNetwork(), host: 'home', modules: { house } });
  t.after(() => ground.down());
  await ground.add('house');
  assert.deepEqual(await ground.ask({ house: 'house', method: 'bear', args: { kind: 'org.example.gauge', id: 'g' } }), { error: { message: 'no offer covers her need latch' } });
});
