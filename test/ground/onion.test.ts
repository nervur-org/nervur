// A ground unpacks like an onion and stays pure. A NodeGround on a real
// folder raises its primordial layer, the key in its file and the ledger,
// then a ladder three rungs above its own registry, each rung taking args
// and a secret, one calling another. Two houses keep their rows in two
// memories, the ground's and one a rung serves. Every entry, secret, seed
// and setting lands as cells of the dock's beings, and every grant as a
// standing. Closed and opened again on the same state, it comes back the
// same, so nothing lived outside those cells.
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { Json } from 'nervur/being';
import { NodeGround } from 'nervur/node';
import { ups } from '../fixtures/onion/rungs.ts';

const folder = fileURLToPath(new URL('../fixtures/', import.meta.url));
const SECRETS = { 'b-key': 'bee-secret-value', 'c-key': 'sea-secret-value', 'leaf-key': 'leaf-secret-value' } as const;
const code = { faculty: 'folder', at: 'onion/house' };

// Every word no byte at rest may hold in the clear: names, kinds, args and every secret's value.
const WORDS = ['inner', 'outer', 'peeler', 'org.example', 'b-reg', 'c-reg', 'leaf', 'onion', 'greeting', 'hello', 'depth', ...Object.values(SECRETS)];

// Every file under a folder, with its bytes as text.
const files = async (root: string): Promise<Map<string, string>> => {
  const found = new Map<string, string>();
  for (const name of await readdir(root, { recursive: true, withFileTypes: true })) {
    if (name.isFile()) found.set(join(name.parentPath, name.name), await readFile(join(name.parentPath, name.name), 'latin1'));
  }
  return found;
};

test('A ground unpacks like an onion and stays pure: every entry, secret, seed and setting is cells of the dock’s beings, every grant a standing, and its state comes back whole', { timeout: 60_000 }, async (t) => {
  const state = await mkdtemp(join(tmpdir(), 'onion-'));
  const side = await mkdtemp(join(tmpdir(), 'onion-side-'));
  t.after(() => Promise.all([rm(state, { recursive: true, force: true }), rm(side, { recursive: true, force: true })]));
  const env = { NERVUR_STATE: state };
  let open: NodeGround | undefined = await NodeGround.open({ folder, env });
  t.after(() => open?.close());
  const reach = (request: Parameters<NodeGround['ground']['hand']>[0]) => open!.ground.hand(request);
  const ask = (method: string, args?: Json) => reach({ method, ...(args === undefined ? {} : { args }) });
  const done = async (method: string, args?: Json): Promise<Json> => {
    const answer = await ask(method, args);
    assert.ok('result' in answer, `${method}: ${JSON.stringify(answer)}`);
    return answer.result;
  };
  const cells = async (id: string) => reach({ id, cells: true });

  // The primordial layer, then the ladder: a TCP carry on the loopback, the secrets, and three rungs above the folder's registry.
  await done('facultiesUpdate', { name: 'tcp', make: 'tcp', args: { bind: '127.0.0.1', port: 0, allowPrivate: true } });
  for (const [name, value] of Object.entries(SECRETS)) assert.deepEqual(await ask('secretsSet', { name, value }), { result: null });
  ups.length = 0;
  await done('facultiesAdd', { name: 'a', from: 'folder', make: 'module', args: { at: 'onion/rungs.ts' } });
  assert.deepEqual(await ask('facultiesAdd', { name: 'b', from: 'a', make: 'b-reg', args: { depth: 'one' }, secrets: ['b-key'] }), { error: { message: 'the faculty b is refused: its args.depth is not an integer' } }, 'a wrong arg is refused at the hand');
  assert.deepEqual(await done('facultiesAdd', { name: 'b', from: 'a', make: 'b-reg', args: { depth: 1 }, secrets: ['b-key'] }), {});
  assert.deepEqual(await done('facultiesAdd', { name: 'c', from: 'b', make: 'c-reg', args: { depth: 2 }, secrets: ['c-key'] }), {});
  assert.deepEqual(
    await ask('facultiesAdd', { name: 'leaf', from: 'c', make: 'leaf', args: { greeting: 'hi' }, faculties: ['b'] }),
    { error: { message: 'the faculty leaf is refused: its entry names no secret leaf-key, which leaf takes: the seal it keeps' } },
    'a secret it takes and does not name is refused at the hand',
  );
  assert.deepEqual(await done('facultiesAdd', { name: 'leaf', from: 'c', make: 'leaf', args: { greeting: 'hi' }, secrets: ['leaf-key'], faculties: ['b'] }), {});
  assert.deepEqual(await done('facultiesAdd', { name: 'side', from: 'a', make: 'side', args: { path: side } }), {});
  assert.deepEqual(ups, ['b', 'c', 'leaf'], 'each rung after the one it stands on');

  // Two houses, one on the ground's memory and one on the memory a rung serves, and the settings moved through the hand.
  await done('housesAdd', { name: 'inner', classes: code, faculties: ['leaf'] });
  await done('housesAdd', { name: 'outer', classes: code, memory: { faculty: 'side' }, faculties: ['leaf'] });
  await done('facultiesUpdate', { name: 'leaf', from: 'c', make: 'leaf', args: { greeting: 'hello' }, secrets: ['leaf-key'], faculties: ['b'] });
  assert.deepEqual(await done('waitSet', { wait: 20_000 }), { wait: 20_000, terrain: false });
  for (const house of ['inner', 'outer']) {
    assert.ok('result' in (await reach({ house, method: 'bear', args: { kind: 'org.example.peeler', id: 'p' } })));
    assert.deepEqual(await reach({ house, id: 'p', method: 'greet', args: { name: 'Ada' } }), { result: 'hello, Ada (signed with 16) #1' }, `${house} greets through the top rung, on its new args`);
  }

  // The catalogue shows every registry of the chain, and what each faculty takes.
  const catalog = (await done('facultiesCatalog')) as { from?: string; faculties: { make: string; takes?: { args?: Json; secrets?: Json } }[] }[];
  assert.deepEqual(
    catalog.map(({ from, faculties }) => [from ?? 'ground', faculties.map(({ make }) => make)]).slice(1),
    [
      ['folder', ['bridge', 'module']],
      ['a', ['b-reg', 'side']],
      ['b', ['c-reg']],
      ['c', ['leaf']],
    ],
  );
  assert.deepEqual(catalog[4].faculties[0].takes?.secrets, { 'leaf-key': 'the seal it keeps' });

  // Every entry, seed, secret and setting is cells of the dock's beings, and every name a standing.
  assert.deepEqual(await cells('faculty.leaf'), { result: { terrain: false, entry: { make: 'leaf', args: { greeting: 'hello' } }, installed: JSON.stringify({ args: { greeting: 'hello' }, faculties: ['b'], from: 'c', make: 'leaf', secrets: ['leaf-key'] }), why: null, serves: null, port: null } });
  const leafShown = (await reach({ id: 'faculty.leaf', method: 'shown' })) as { result: { standings: { id: string; steward: Json }[] } };
  assert.deepEqual(
    [...leafShown.result.standings].sort((a, b) => (a.id < b.id ? -1 : 1)),
    [
      { id: 'faculty.b', steward: { faculties: 0 } },
      { id: 'faculty.c', steward: { from: true } },
      { id: 'secret.leaf-key', steward: { secrets: 0 } },
    ],
    'its registry, its callee and its secret are standings',
  );
  const outer = (await cells('house.outer')) as { result: { entry: Json; seed: string; ward: string } };
  assert.deepEqual(outer.result.entry, { classes: { at: 'onion/house' }, memory: {} }, 'a house’s cells hold its args, and no name');
  assert.match(outer.result.seed, /^[0-9a-f]{64}$/, 'its seed');
  const outerShown = (await reach({ id: 'house.outer', method: 'shown' })) as { result: { standings: { id: string; steward: Json }[] } };
  assert.deepEqual(
    [...outerShown.result.standings].sort((a, b) => (a.id < b.id ? -1 : 1)),
    [
      { id: 'faculty.folder', steward: { classes: true } },
      { id: 'faculty.leaf', steward: { faculties: 0 } },
      { id: 'faculty.side', steward: { memory: true } },
    ],
  );
  assert.deepEqual(await cells('steward'), { result: { wait: 20_000 } }, 'the bound is the steward’s cell');
  assert.deepEqual(await cells('secret.b-key'), { error: { message: 'a secret’s cells are shown to no one' } });

  // Each house's rows land in its own memory: the outer's in the side ledger alone, sealed, and nothing of the inner's there.
  const sided = await files(side);
  assert.deepEqual([...sided.keys()].map((path) => path.slice(side.length + 1)), ['outer.ledger']);

  // Everything that goes back to the state after the hand is kept identical.
  const snapshot = async () => ({
    catalog: await done('facultiesCatalog'),
    faculties: await done('facultiesList'),
    houses: await done('housesList'),
    wait: await done('waitShow'),
    secrets: await done('secretsList'),
    answers: await Promise.all(['inner', 'outer'].map((house) => reach({ house, id: 'p', method: 'hello', args: { name: 'Bo' } }))),
    cells: await Promise.all(['steward', 'faculty.a', 'faculty.b', 'faculty.c', 'faculty.leaf', 'faculty.side', 'faculty.tcp', 'house.inner', 'house.outer'].map(cells)),
  });
  const before = await snapshot();
  await open.close();
  open = undefined;
  assert.deepEqual((await readdir(state)).sort(), ['ground.ledger', 'ground.witness', 'key'], 'the key and the ledger, and nothing else');
  for (const [path, text] of [...(await files(state)), ...(await files(side))]) {
    for (const word of WORDS) assert.ok(!text.includes(word), `${path} holds ${word} in the clear`);
  }

  ups.length = 0;
  open = await NodeGround.open({ folder, env });
  assert.deepEqual(ups, ['b', 'c', 'leaf'], 'the ladder stands again in the order the chain gives');
  assert.deepEqual(await snapshot(), before, 'everything came back from the dock’s cells, the same');

  // A missing secret forced into the boot leaves its rung and everything above it down, with why, and the rest stands.
  assert.deepEqual(await ask('secretsRemove', { name: 'c-key' }), { result: null });
  await open.close();
  open = await NodeGround.open({ folder, env });
  const listed = (await done('facultiesList')) as { name: string; why?: string }[];
  const why = Object.fromEntries(listed.map(({ name, why: down }) => [name, down ?? 'stands']));
  assert.deepEqual(
    { a: why.a, b: why.b, c: why.c, leaf: why.leaf, side: why.side },
    { a: 'stands', b: 'stands', c: 'no secret c-key is kept', leaf: 'its registry: the faculty c is down: no secret c-key is kept', side: 'stands' },
  );
  const houses = (await done('housesList')) as { name: string; why?: string }[];
  assert.deepEqual(
    houses.map(({ name, why: closed }) => [name, closed]),
    [
      ['inner', 'the faculty leaf is down: its registry: the faculty c is down: no secret c-key is kept'],
      ['outer', 'the faculty leaf is down: its registry: the faculty c is down: no secret c-key is kept'],
    ],
  );
  await open.close();
  open = undefined;

  // Another key opens nothing on this state.
  await assert.rejects(NodeGround.open({ folder, env, unlock: { key: async () => 'ab'.repeat(32) } }), /this memory holds no drawer this key opens/);
});
