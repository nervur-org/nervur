// A faculty declares what it takes, and the hand holds every entry to it:
// a wrong entry is refused before it lands, an entry the code beneath it
// does not take stays down at the boot with the same reason, the
// catalogue shows what each faculty takes, and the drawer's bound on
// every ask is set through the dock and kept.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BenchGround, FakeNetwork } from 'nervur/bench';
import { s } from 'nervur/being';
import { taking, TAKES } from '../fixtures/ground/taking.ts';

type Json = NonNullable<Parameters<BenchGround['hand']>[0]['args']>;

const open = async (t: { after(done: () => unknown): void }) => {
  const { held, registry } = taking();
  const ground = await BenchGround.open({ network: new FakeNetwork(), host: 'home', registry });
  t.after(() => ground.down());
  const ask = (method: string, args?: Json) => ground.hand({ method, ...(args === undefined ? {} : { args }) });
  return { ground, held, ask };
};

const mail = (args: Json, secrets: string[] = ['mail-key']): Json => ({ name: 'mail', make: 'mail', args, secrets });

test('It refuses an entry that fails what its faculty takes, and one naming a secret not kept, at the hand: it names what failed and lands nothing', async (t) => {
  const { ask } = await open(t);
  assert.deepEqual(await ask('facultiesAdd', mail({ port: 'twenty-five' })), { error: { message: 'the faculty mail is refused: its args.port is not an integer' } }, 'an arg of the wrong type');
  assert.deepEqual(await ask('facultiesAdd', mail({ port: 70_000 })), { error: { message: 'the faculty mail is refused: its args.port is above 65535' } }, 'a port out of range');
  assert.deepEqual(await ask('facultiesAdd', mail({ port: 25, relay: true })), { error: { message: 'the faculty mail is refused: its args.relay is not allowed' } }, 'an arg it does not take');
  assert.deepEqual(await ask('facultiesAdd', mail({ port: 25 }, [])), { error: { message: 'the faculty mail is refused: its entry names no secret mail-key, which mail takes: the key the mail signs with' } }, 'a secret it takes, not named');
  assert.deepEqual(await ask('facultiesAdd', mail({ port: 25 })), { error: { message: 'the faculty mail is refused: no secret mail-key is kept' } }, 'a secret named and not kept');
  const listed = (await ask('facultiesList')) as { result: { name: string }[] };
  assert.equal(listed.result.find(({ name }) => name === 'mail'), undefined, 'no refused entry landed');

  assert.deepEqual(await ask('secretsSet', { name: 'mail-key', value: 'hush' }), { result: null });
  assert.deepEqual(await ask('facultiesAdd', mail({ port: 25 })), { result: {} }, 'the entry it takes stands');
  assert.deepEqual(await ask('facultiesUpdate', mail({ port: -1 })), { error: { message: 'the faculty mail is refused: its args.port is below 0' } }, 'an update is held the same');
  assert.deepEqual(await ask('facultiesUpdate', mail({ port: 587, host: 'mail.example' })), { result: {} });
  assert.deepEqual(await ask('facultiesUpdate', { name: 'fake', make: 'fake', args: { tick: 1 } }), { error: { message: 'the faculty fake is refused: its args.tick is not allowed' } }, 'a terrain faculty takes what it declares');
});

test('An entry the code beneath it does not take stays down at the boot, with the same reason', async (t) => {
  const { ground, held, ask } = await open(t);
  await ask('secretsSet', { name: 'mail-key', value: 'hush' });
  assert.deepEqual(await ask('facultiesAdd', mail({ port: 25 })), { result: {} });
  await ground.down();
  held.takes = { ...TAKES, args: s.object({ port: s.string() }) };
  await ground.up();
  const listed = (await ask('facultiesList')) as { result: { name: string; why?: string }[] };
  assert.equal(listed.result.find(({ name }) => name === 'mail')?.why, 'its args.port is not a string');

  await ground.down();
  held.takes = TAKES;
  await ground.up();
  assert.deepEqual(await ask('secretsRemove', { name: 'mail-key' }), { result: null });
  assert.deepEqual(await ask('facultiesRestart', { name: 'mail' }), { result: { why: 'no secret mail-key is kept' } }, 'a secret dropped keeps it down');
});

test('The catalogue shows every registry and what each faculty takes, and the secrets name who names them', async (t) => {
  const { ask } = await open(t);
  await ask('secretsSet', { name: 'mail-key', value: 'hush' });
  await ask('secretsSet', { name: 'spare', value: 'kept' });
  await ask('facultiesAdd', mail({ port: 25 }));

  const catalog = (await ask('facultiesCatalog')) as { result: { from?: string; faculties: { make: string; takes?: Json }[] }[] };
  assert.equal(catalog.result[0].from, undefined, 'the ground’s registry first');
  const made = catalog.result[0].faculties.find(({ make }) => make === 'mail');
  assert.deepEqual(made, { make: 'mail', takes: JSON.parse(JSON.stringify(TAKES)) as Json }, 'its args schema and its secrets');
  assert.deepEqual(catalog.result[0].faculties.find(({ make }) => make === 'clock')?.takes, { args: { type: 'object', properties: {}, required: [], additionalProperties: false } }, 'the library’s faculties take what they declare');

  assert.deepEqual(await ask('secretsList'), {
    result: [
      { name: 'mail-key', kept: true, entries: ['mail'] },
      { name: 'spare', kept: true, entries: [] },
    ],
  });
  assert.ok(!JSON.stringify(await ask('secretsList')).includes('hush'), 'never a value');
});

test(`It refuses a drawer's entry named for a primordial role, or making a primordial faculty`, async (t) => {
  const { ask } = await open(t);
  assert.deepEqual(await ask('facultiesAdd', { name: 'unlock', make: 'mail' }), { error: { message: 'the unlock is primordial: its entry is the host’s, and the drawer names none' } });
  assert.deepEqual(await ask('facultiesAdd', { name: 'key', make: 'bench-unlock' }), { error: { message: 'the faculty bench-unlock is the ground’s unlock, which is primordial, and the drawer names none' } });
  assert.deepEqual(await ask('facultiesUpdate', { name: 'memory', make: 'bench-memory' }), { error: { message: 'the memory is primordial: its entry is the host’s, and the drawer names none' } });
});

test('The ground’s bound on every ask is set through the dock, kept in the drawer, and dropped back to the terrain’s', async (t) => {
  const { ground, ask } = await open(t);
  assert.deepEqual(await ask('waitShow'), { result: { terrain: true } });
  assert.equal(((await ask('waitSet', { wait: 0 })) as { error?: unknown }).error !== undefined, true, 'a bound of zero is refused');
  assert.deepEqual(await ask('waitSet', { wait: 30_000 }), { result: { wait: 30_000, terrain: false } });
  await ground.down();
  await ground.up();
  assert.deepEqual(await ask('waitShow'), { result: { wait: 30_000, terrain: false } }, 'the drawer kept it');
  assert.deepEqual(await ask('waitSet', {}), { result: { terrain: true } });
});
