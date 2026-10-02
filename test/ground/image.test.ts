// A faculty of the image, named by its address with no `from`: the terrain
// imports it from the ground's own install and stands the one faculty its
// face shows. The bench stands what a NodeGround stands, from the same
// install, and an address that fails stays down, named. The install here
// is `@acme/parrot`, a fixture package linked into nervur's node_modules
// for the run.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { BenchGround, FakeNetwork } from 'nervur/bench';
import { NodeGround } from 'nervur/node';

const PARROT = '@acme/parrot/faculties/parrot';
const modules = fileURLToPath(new URL('../../node_modules', import.meta.url));
const made = !existsSync(modules);

// The fixture installed beside nervur, as an image installs a library, and taken away after. Where the
// package stands alone, nothing installs nervur by its name, so it is linked beside the fixture too.
const self = join(modules, 'nervur');
const linked = !existsSync(self);
before(async () => {
  await mkdir(join(modules, '@acme'), { recursive: true });
  await symlink(fileURLToPath(new URL('../fixtures/image', import.meta.url)), join(modules, '@acme', 'parrot'), 'dir');
  if (linked) await symlink(fileURLToPath(new URL('../..', import.meta.url)), self, 'dir');
});
after(async () => {
  if (linked && !made) await rm(self, { force: true });
  await rm(made ? modules : join(modules, '@acme'), { recursive: true, force: true });
});

type Hand = (request: { method: string; args?: NonNullable<Parameters<BenchGround['hand']>[0]['args']> }) => Promise<unknown>;

// What a ground answers for one entry, its call through the parrot, and the terrain's rung of the catalogue.
const proven = async (hand: Hand) => {
  const added = await hand({ method: 'facultiesAdd', args: { name: 'parrot', make: PARROT, args: { prefix: '~' } } });
  const said = await hand({ method: 'callFaculty', args: { faculty: 'parrot', method: 'say', args: { text: 'hi' } } });
  const catalog = (await hand({ method: 'facultiesCatalog' })) as { result: { from?: string; faculties: { make: string }[] }[] };
  return { added, said, terrain: catalog.result[0].faculties.map(({ make }) => make) };
};

// Each refused address, and the why its body stays down with.
const refused = async (hand: Hand) => {
  const why = async (name: string, make: string) => ((await hand({ method: 'facultiesAdd', args: { name, make } })) as { result: { why?: string } }).result.why;
  return {
    pair: await why('pair', '@acme/parrot/faculties/pair'),
    bare: await why('bare', '@acme/parrot/faculties/bare'),
    none: await why('none', '@acme/parrot/faculties/none'),
    absent: await why('absent', '@acme/absent/faculties/parrot'),
    fixed: await why('fixed', 'parrot'),
  };
};

const held = (whys: Awaited<ReturnType<typeof refused>>) => {
  assert.equal(whys.pair, 'the face of @acme/parrot/faculties/pair shows 2 faculties, not one');
  assert.equal(whys.bare, 'the face of @acme/parrot/faculties/bare shows 0 faculties, not one');
  assert.match(whys.none ?? '', /^the address @acme\/parrot\/faculties\/none did not import: /);
  assert.match(whys.absent ?? '', /^the address @acme\/absent\/faculties\/parrot did not import: /, 'a package the install lacks');
  assert.equal(whys.fixed, 'no faculty parrot in the ground’s registry', 'a make of any other shape is one of the terrain’s fixed names');
};

test('An entry with no from names a faculty of the image by its address: the terrain imports it from the ground’s own install, stands the one faculty its face shows, and facultiesCatalog shows it', async (t) => {
  const ground = await BenchGround.open({ network: new FakeNetwork(), host: 'home' });
  t.after(() => ground.down());
  const { added, said, terrain } = await proven((request) => ground.hand(request));
  assert.deepEqual(added, { result: {} });
  assert.deepEqual(said, { result: '~hi' }, 'the faculty stands on its args');
  assert.ok(terrain.includes(PARROT) && terrain.includes('module'), 'the address in the terrain’s rung, beside its fixed names');
});

test('It refuses an address whose face does not import, or shows not exactly one faculty: its body stays down, naming the address', async (t) => {
  const ground = await BenchGround.open({ network: new FakeNetwork(), host: 'home' });
  t.after(() => ground.down());
  held(await refused((request) => ground.hand(request)));
});

test('The bench imports an address as a NodeGround does: a NodeGround stands and refuses the same addresses from the same install', { timeout: 20_000 }, async (t) => {
  const folder = await mkdtemp(join(tmpdir(), 'image-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const ground = await NodeGround.open({ folder, env: { NERVUR_STATE: join(folder, 'state') } });
  t.after(() => ground.close());
  const hand: Hand = (request) => ground.ground.hand(request);
  const { added, said, terrain } = await proven(hand);
  assert.deepEqual(added, { result: {} });
  assert.deepEqual(said, { result: '~hi' });
  assert.ok(terrain.includes(PARROT) && terrain.includes('ledger'));
  held(await refused(hand));
});
