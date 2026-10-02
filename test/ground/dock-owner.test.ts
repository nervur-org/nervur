// An owner extends her ground's dock with classes of her own, served by a
// body of the ladder once it stands. Her steward adds to the library's and
// overrides nothing, her beings take kinds of their own and are granted
// the bodies whose entries name those kinds, and no code of hers reaches a
// seed or a secret. Classes that fail leave the dock on the library's, and
// the steward's cells say why.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Bench, BenchGround, FakeNetwork } from 'nervur/bench';
import { SiteSteward, Website } from '../fixtures/ground/dock-owner.ts';
import { Overriding } from '../fixtures/ground/dock-refused.ts';

type Json = NonNullable<Parameters<BenchGround['hand']>[0]['args']>;

const modules = {
  owner: new URL('../fixtures/ground/dock-owner.ts', import.meta.url),
  refused: new URL('../fixtures/ground/dock-refused.ts', import.meta.url),
  colliding: new URL('../fixtures/ground/dock-colliding.ts', import.meta.url),
};

const website = { blueprint: Website, object: { publish: async ({ page }: { page: string }) => ({ result: { at: `https://example.org/${page}` } }) }, kinds: ['org.example.site'] };

const open = async (t: { after(done: () => unknown): void }) => {
  const ground = await BenchGround.open({ network: new FakeNetwork(), host: 'home', modules, faculties: { website } });
  t.after(() => ground.down());
  const dock = (method: string, args?: Json, id?: string) => ground.hand({ method, ...(args === undefined ? {} : { args }), ...(id === undefined ? {} : { id }) });
  return { ground, dock };
};

const error = (answer: unknown): string => (answer as { error?: { message: string } }).error?.message ?? `no error: ${JSON.stringify(answer)}`;

test('An owner’s steward and her being stand in the dock: the being calls the body her kind is granted, and the dock opens extended again after a restart', async (t) => {
  const { ground, dock } = await open(t);
  assert.deepEqual(await dock('classesSet', { classes: { faculty: 'module', name: 'owner' } }), { result: null });
  assert.deepEqual(await dock('classesShow'), { result: { classes: { faculty: 'module', name: 'owner' } } }, 'they loaded, so no why stands');
  assert.deepEqual(await dock('sitesAdd', { id: 'site' }), { result: null }, 'her steward answers an ask she adds');
  assert.deepEqual(await dock('publish', { page: 'home' }, 'site'), { result: { at: 'https://example.org/home' } }, 'her being calls the website her kind is granted');
  assert.ok('result' in (await dock('housesList')), 'the library’s asks stand beside hers');

  await ground.down();
  await ground.up();
  assert.deepEqual(await dock('sitesCount'), { result: 1 }, 'her steward’s cells stand');
  assert.deepEqual(await dock('publish', { page: 'again' }, 'site'), { result: { at: 'https://example.org/again' } }, 'the dock opened extended at the boot');

  assert.deepEqual(await dock('classesSet', {}), { result: null });
  assert.equal(error(await dock('sitesCount')), 'no such ask', 'dropped, the dock stands on the library’s alone');
});

test('It refuses dock classes that name no body of the ladder or a body that serves no classes, and removing the body that serves them', async (t) => {
  const { dock } = await open(t);
  assert.equal(error(await dock('classesSet', { classes: { faculty: 'absent' } })), 'the dock’s classes are refused: no faculty absent is on the ladder');
  assert.equal(error(await dock('classesSet', { classes: { faculty: 'website' } })), 'the dock’s classes are refused: the faculty website serves no classes');
  assert.deepEqual(await dock('facultiesAdd', { name: 'code', make: 'module' }), { result: {} });
  assert.deepEqual(await dock('classesSet', { classes: { faculty: 'code', name: 'owner' } }), { result: null });
  assert.equal(error(await dock('facultiesRemove', { name: 'code' })), 'the faculty code is in use by the dock’s classes');
});

test('A steward that overrides an ask of the library’s, and a being of a library kind, leave the dock on the library’s, and the steward says why', async (t) => {
  const { dock } = await open(t);
  assert.deepEqual(await dock('classesSet', { classes: { faculty: 'module', name: 'refused' } }), { result: null });
  assert.deepEqual(await dock('classesShow'), { result: { classes: { faculty: 'module', name: 'refused' }, why: 'the owner’s dock classes are refused: the owner’s steward overrides the dock’s housesList, which is the library’s' } });
  assert.ok('result' in (await dock('housesList')), 'the library’s steward answers');

  assert.deepEqual(await dock('classesSet', { classes: { faculty: 'module', name: 'colliding' } }), { result: null });
  assert.deepEqual(await dock('classesShow'), {
    result: { classes: { faculty: 'module', name: 'colliding' }, why: 'the owner’s dock classes are refused: the kind org.nervur.dock.faculty is the dock’s own, and no being of the owner’s takes it' },
  });
});

test('No code of the owner’s reaches a secret: her steward asks no library being, bears no library kind or id, reaches no ground’s work and no ask that is root’s alone', async (t) => {
  const { ground, dock } = await open(t);
  assert.deepEqual(await dock('secretsSet', { name: 'token', value: 'hidden' }), { result: null });
  await dock('classesSet', { classes: { faculty: 'module', name: 'owner' } });
  const reach = async (what: string, id?: string) => error(await dock('reach', { what, ...(id === undefined ? {} : { id }) }));
  assert.equal(await reach('ask', 'secret.token'), 'the being secret.token is the dock’s own, and the owner’s code reaches her nowhere');
  assert.equal(await reach('ask', 'house.any'), 'the being house.any is the dock’s own, and the owner’s code reaches her nowhere');
  assert.equal(await reach('bear', 'mine'), 'the owner’s steward bears beings of her own kinds alone, and org.nervur.dock.secret is none');
  assert.equal(await reach('ground'), 'the ground’s work is the dock’s own');
  assert.equal(await reach('secrets'), 'secretsList is the dock’s own, and the owner’s code never calls it');
  assert.equal(error(await dock('sitesAdd', { id: 'secret.token' })), 'the being secret.token is the dock’s own, and the owner’s code reaches her nowhere');
  assert.equal(error(await ground.hand({ id: 'secret.token', cells: true })), 'a secret’s cells are shown to no one');
});

test('The bench checks an owner’s dock steward alone: her classes load, the library’s asks stand beside hers, and her examples run with no secret reached', async () => {
  const findings = await Bench.check(SiteSteward, { position: 'dock', module: modules.owner });
  assert.deepEqual(
    findings.map(({ what }) => what),
    ['her classes load in the dock', 'the hand is shown the library’s asks beside hers', 'sitesAdd, played', 'sitesCount, played', 'reach, played', 'sitesAdd, example 1', 'sitesCount, example 1: one site borne'],
  );
});

test('The bench refuses a dock steward that overrides an ask of the library’s, and says why', async () => {
  await assert.rejects(Bench.check(Overriding, { position: 'dock', module: modules.refused }), /her classes load in the dock: the owner’s dock classes are refused: the owner’s steward overrides the dock’s housesList, which is the library’s/);
});
