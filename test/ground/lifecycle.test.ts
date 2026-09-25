// Every faculty has one lifecycle, driven through the ground's hand as an
// owner drives it: a body calls another through its entry and stands after
// it, a house's entry is updated in one write, and a TCP entry that names
// no port only dials.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { BenchGround, FakeNetwork } from 'nervur/bench';
import { loopbackGround } from '../fixtures/node/spawned.ts';
import { chain } from '../fixtures/ground/chain.ts';
import * as shop from '../fixtures/world/shop.ts';
import * as next from '../fixtures/world/host-next.ts';

type Json = NonNullable<Parameters<BenchGround['hand']>[0]['args']>;

test('A body calls another through its entry, and the ladder raises it after its callee', async (t) => {
  const { ups, registry } = chain();
  const ground = await BenchGround.open({ network: new FakeNetwork(), host: 'home', registry });
  t.after(() => ground.down());
  const faculty = (method: string, args: Json) => ground.hand({ method: `faculties${method[0].toUpperCase()}${method.slice(1)}`, args });

  const early = await faculty('add', { name: 'bell', make: 'bell', faculties: ['post'] });
  assert.deepEqual(early, { error: { message: 'the faculty bell is refused: no faculty post is here' } }, 'its callee is not there yet, and nothing lands');
  assert.deepEqual(await faculty('add', { name: 'post', make: 'post' }), { result: {} });
  assert.deepEqual(await faculty('add', { name: 'bell', make: 'bell', faculties: ['post'] }), { result: {} });
  assert.deepEqual(ups, ['post', 'bell'], 'the caller went up after its callee');
  assert.deepEqual(await ground.hand({ method: 'callFaculty', args: { faculty: 'bell', method: 'ring', args: { who: 'ada' } } }), { result: null });
  assert.deepEqual(await ground.hand({ method: 'callFaculty', args: { faculty: 'post', method: 'sent' } }), { result: ['ada rang'] }, 'the bell called the post directly');
  assert.match(JSON.stringify(await faculty('remove', { name: 'post' })), /the faculty post is in use by the faculty bell/);

  ups.length = 0;
  await ground.down();
  await ground.up();
  assert.deepEqual(ups, ['post', 'bell'], 'at the boot, the callee first, whatever their names');

  ups.length = 0;
  assert.deepEqual(await faculty('restart', { name: 'post' }), { result: {} });
  assert.deepEqual(ups, ['post', 'bell'], 'a restart takes its caller down and up with it');
});

test('A house updated through the hand lands its new entry in one write, and keeps its ward and its rows', async (t) => {
  const network = new FakeNetwork();
  const ground = await BenchGround.open({ network, host: 'shop', modules: { shop, next } });
  t.after(() => ground.down());
  const houses = (method: string, args: Json) => ground.hand({ method: `houses${method[0].toUpperCase()}${method.slice(1)}`, args });
  const added = (await houses('add', { name: 'store', classes: { faculty: 'module', name: 'shop' } })) as { result: { ward: string } };
  await ground.ask({ house: 'store', method: 'bear', args: { kind: 'org.example.host', id: 'bob' } });
  assert.deepEqual(await ground.ask({ house: 'store', id: 'bob', method: 'greet' }), { result: 'bob greets root' });

  const moved = { name: 'store', classes: { faculty: 'module', name: 'next' } };
  assert.match(JSON.stringify(await houses('add', moved)), /the house store stands with another entry; update it/, 'another entry is an update');
  assert.deepEqual(await houses('update', moved), { result: { ward: added.result.ward } }, 'the same ward');
  assert.deepEqual(await ground.ask({ house: 'store', id: 'bob', method: 'greet' }), { result: 'bob welcomes root' }, 'new code over the same row');
  assert.deepEqual(await houses('update', { name: 'absent', classes: { faculty: 'module', name: 'next' } }), { error: { message: 'no house absent is here to update' } });

  await ground.down();
  await ground.up();
  assert.deepEqual(ground.list().map(({ name, entry, ward }) => ({ name, entry, ward })), [{ name: 'store', entry: { classes: { faculty: 'module', name: 'next' } }, ward: added.result.ward }], 'the drawer kept the new entry');
});

test('A TCP entry that names no port only dials: its invitations name no TCP address, and it still asks a far ground over TCP', { timeout: 20_000 }, async (t) => {
  const folder = new URL('../fixtures/node/', import.meta.url).pathname;
  const open = async (name: string) => {
    const state = await mkdtemp(join(tmpdir(), `${name}-`));
    const node = await loopbackGround(folder, state);
    t.after(() => node.close());
    t.after(() => rm(state, { recursive: true, force: true }));
    const added = await node.ground.add('main', { classes: { faculty: 'folder', at: 'two' } });
    assert.ok(added.ward !== undefined, added.why ?? 'it did not open');
    return node.ground;
  };
  const far = await open('far');
  const near = await open('near');

  const dials = await near.hand({ method: 'facultiesUpdate', args: { name: 'tcp', make: 'tcp', args: { bind: '127.0.0.1', allowPrivate: true } } });
  assert.deepEqual(dials, { result: {} });
  const paper = (await near.ask({ house: 'main', method: 'offer' })) as { result: { handle: string } };
  const { at } = JSON.parse(Buffer.from(paper.result.handle, 'hex').toString('utf8')) as { at: string[] };
  assert.deepEqual(
    at.filter((address) => address.startsWith('tcp:')),
    [],
    'no TCP address',
  );

  const offered = (await far.ask({ house: 'main', method: 'offer' })) as { result: { handle: string } };
  const standing = await near.ask({ house: 'main', method: 'adopt', args: { invitation: offered.result.handle } });
  assert.ok('result' in standing, JSON.stringify(standing));
  assert.deepEqual(await near.ask({ house: 'main', method: 'relay', args: { standing: standing.result } }), { result: 'far' }, 'it dialled the far ground over TCP');
});

test('The lists answer every entry whole, and an entry names its secrets and holds none', async (t) => {
  const { registry } = chain();
  const ground = await BenchGround.open({ network: new FakeNetwork(), host: 'home', registry, modules: { shop } });
  t.after(() => ground.down());
  assert.deepEqual(await ground.hand({ method: 'secretsSet', args: { name: 'post-key', value: 'hush' } }), { result: null });
  assert.deepEqual(await ground.hand({ method: 'facultiesAdd', args: { name: 'post', make: 'post', secrets: ['post-key'] } }), { result: {} });
  await ground.add('store', 'shop', { faculties: ['post'] });

  const faculties = (await ground.hand({ method: 'facultiesList' })) as { result: { name: string; entry: Json; serves?: string }[] };
  const post = faculties.result.find(({ name }) => name === 'post');
  assert.deepEqual(post, { name: 'post', entry: { make: 'post', secrets: ['post-key'] } }, 'the secret’s name, never its value');
  assert.ok(!JSON.stringify(faculties).includes('hush'));
  assert.deepEqual(
    faculties.result.find(({ name }) => name === 'fake'),
    { name: 'fake', entry: { make: 'fake' }, terrain: true, serves: 'memory' },
    'the terrain’s entries too, marked as the terrain’s',
  );
  assert.equal(await ground.hand({ method: 'facultiesUpdate', args: { name: 'fake', make: 'fake', args: {} } }).then((answer) => JSON.stringify(answer)), '{"result":{}}');
  const replaced = (await ground.hand({ method: 'facultiesList' })) as { result: { name: string; terrain?: boolean }[] };
  assert.equal(replaced.result.find(({ name }) => name === 'fake')?.terrain, undefined, 'an entry the drawer names in its place is the owner’s');
  const houses = (await ground.hand({ method: 'housesList' })) as { result: { name: string; entry: Json }[] };
  assert.deepEqual(houses.result[0].entry, { classes: { faculty: 'module', name: 'shop' }, faculties: ['post'] });
});
