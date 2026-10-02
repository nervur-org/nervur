// A faculty declares what it takes, and the hand holds every entry's args
// to it: wrong args are refused before they land, args the code beneath
// them does not take stay down at the boot with the same reason, a body
// waits for a secret it takes until it is set, the catalogue shows what
// each faculty takes, and the ground's bound on every ask is set through
// the dock and kept.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BenchGround, FakeNetwork } from 'nervur/bench';
import { s } from 'nervur/being';
import { taking, TAKES } from '../fixtures/ground/taking.ts';

type Json = NonNullable<Parameters<BenchGround['hand']>[0]['args']>;

const open = async (t: { after(done: () => unknown): void }) => {
  const { held, signed, registry } = taking();
  const ground = await BenchGround.open({ network: new FakeNetwork(), host: 'home', registry });
  t.after(() => ground.down());
  const ask = (method: string, args?: Json) => ground.hand({ method, ...(args === undefined ? {} : { args }) });
  return { ground, held, signed, ask };
};

const mail = (args: Json, secrets: string[] = ['mail-key']): Json => ({ name: 'mail', make: 'mail', args, secrets });

const WAITING = 'it waits for the secret mail-key, which is not kept: the key the mail signs with';

test('It refuses an entry whose args fail what its faculty takes, at the hand: it names what failed and lands nothing', async (t) => {
  const { ask } = await open(t);
  assert.deepEqual(await ask('facultiesAdd', mail({ port: 'twenty-five' })), { error: { message: 'the faculty mail is refused: its args.port is not an integer' } }, 'an arg of the wrong type');
  assert.deepEqual(await ask('facultiesAdd', mail({ port: 70_000 })), { error: { message: 'the faculty mail is refused: its args.port is above 65535' } }, 'a port out of range');
  assert.deepEqual(await ask('facultiesAdd', mail({ port: 25, relay: true })), { error: { message: 'the faculty mail is refused: its args.relay is not allowed' } }, 'an arg it does not take');
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

});

test('A faculty waits for a secret it takes, and setting it raises the faculty: a secret is declared and never required, removing it lowers the faculty with why, and neither asks a restart', async (t) => {
  const { ground, signed, ask } = await open(t);
  const why = async () => ((await ask('facultiesList')) as { result: { name: string; why?: string }[] }).result.find(({ name }) => name === 'mail')?.why;
  assert.deepEqual(await ask('facultiesAdd', mail({ port: 25 })), { result: { why: WAITING } }, 'an entry naming a secret not kept lands, and its body waits');
  assert.equal(await why(), WAITING, 'its twin holds why');
  assert.deepEqual(await ask('secretsList'), { result: [{ name: 'mail-key', kept: false, entries: ['mail'] }] }, 'the secret it waits for is named, and not kept');

  await ground.down();
  await ground.up();
  assert.equal(await why(), WAITING, 'the boot keeps it waiting');

  assert.deepEqual(await ask('secretsSet', { name: 'mail-key', value: 'hush' }), { result: null });
  assert.equal(await why(), undefined, 'setting it raised the body');
  assert.deepEqual(await ask('secretsSet', { name: 'mail-key', value: 'quiet' }), { result: null });
  assert.deepEqual(signed, ['hush', 'quiet'], 'each value reached its up as it was set');

  assert.deepEqual(await ask('secretsRemove', { name: 'mail-key' }), { result: null });
  assert.equal(await why(), WAITING, 'removing it lowered the body, with why');
  assert.deepEqual(await ask('secretsList'), { result: [{ name: 'mail-key', kept: false, entries: ['mail'] }] });

  assert.deepEqual(
    await ask('facultiesUpdate', mail({ port: 25 }, [])),
    { result: { why: 'it waits for the secret mail-key, which its entry does not name: the key the mail signs with' } },
    'an entry that names no secret it takes lands, and says which to name',
  );
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

test(`It refuses an entry in the dock named for a primordial role, or making a primordial faculty`, async (t) => {
  const { ask } = await open(t);
  assert.deepEqual(await ask('facultiesAdd', { name: 'unlock', make: 'mail' }), { error: { message: 'the unlock is primordial: its entry is the host’s, and the dock’s entries name none' } });
  assert.deepEqual(await ask('facultiesAdd', { name: 'key', make: 'bench-unlock' }), { error: { message: 'the faculty bench-unlock is the ground’s unlock, which is primordial, and the dock’s entries name none' } });
  assert.deepEqual(await ask('facultiesUpdate', { name: 'memory', make: 'bench-memory' }), { error: { message: 'the memory is primordial: its entry is the host’s, and the dock’s entries name none' } });
});

test('The ground’s bound on every ask is set through the dock, kept in its cells, and dropped back to the terrain’s', async (t) => {
  const { ground, ask } = await open(t);
  assert.deepEqual(await ask('waitShow'), { result: { terrain: true } });
  assert.equal(((await ask('waitSet', { wait: 0 })) as { error?: unknown }).error !== undefined, true, 'a bound of zero is refused');
  assert.deepEqual(await ask('waitSet', { wait: 30_000 }), { result: { wait: 30_000, terrain: false } });
  await ground.down();
  await ground.up();
  assert.deepEqual(await ask('waitShow'), { result: { wait: 30_000, terrain: false } }, 'the dock’s cells kept it');
  assert.deepEqual(await ask('waitSet', {}), { result: { terrain: true } });
});
