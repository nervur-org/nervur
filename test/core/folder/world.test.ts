// SPDX-License-Identifier: Apache-2.0
// The same world on disk: every harbor restarts as a new process would,
// from its folder alone, and the folder shows nothing but the seed and
// sealed entries.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CryptoEntropy } from '../kit.ts';
import { FolderCustody, FolderMemory } from '../../../src/core/folder/index.ts';
import { Dna } from '../../../src/core/harbor/index.ts';
import { scratch } from '../contract/suites.ts';
import { census } from '../harbor/asks.ts';
import { genesis, me, sold } from '../harbor/shop.ts';

const disk = (root: string) => {
  const entropy = new CryptoEntropy();
  return { entropy, memory: new FolderMemory(root), custody: new FolderCustody(root, entropy) };
};

test('[folder] a world on disk restarts from its folders, and every relation and lend still speaks', async () => {
  const roots = { acme: scratch(), home: scratch() };
  const world = await genesis({ acme: disk(roots.acme), home: disk(roots.home) });
  await me(world, 'buy', { item: 'tea' });
  await me(world, 'echo', { text: 'before' });
  const pk = (await census(world.get('home'), 'alice')).pk;

  const acme = await world.restart('acme', disk(roots.acme));
  const home = await world.restart('home', disk(roots.home));
  assert.equal((await census(home, 'alice')).pk, pk);
  assert.deepEqual(Object.keys((await census(acme)).wards!), ['shop']);
  assert.deepEqual(await me(world, 'buy', { item: 'cake' }), { said: { bought: 'cake' } });
  assert.deepEqual(await me(world, 'echo', { text: 'after' }), { said: { echoed: 'after', to: 'lent:1' } });
  assert.deepEqual(await sold(world), ['tea to alice', 'cake to alice']);

  const places = (await readdir(roots.home)).filter((name) => name !== 'seed');
  assert.equal(places.filter((p) => !Dna.occupies(p)).length, 2, 'the box ward and alice');
  assert.ok(places.some((p) => Dna.occupies(p)), 'beside the DNA');
  for (const place of places) {
    assert.match(place, /^[0-9a-f]+$/);
    for (const entry of await readdir(join(roots.home, place))) {
      assert.match(entry, /^[0-9a-f]{32}$/);
      const text = (await readFile(join(roots.home, place, entry))).toString('latin1');
      for (const word of ['alice', 'org.example', 'hosted', 'Customer']) assert.ok(!text.includes(word), word);
    }
  }
});
