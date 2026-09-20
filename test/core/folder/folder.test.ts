// SPDX-License-Identifier: Apache-2.0
// `nervur/folder`: the disk bodies pass the contract suites, a place is a
// folder of entry files, and the seed is one file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FolderCustody, FolderMemory, type Keep } from '../../../src/core/folder/index.ts';
import { CryptoEntropy } from '../../../src/core/pointer/index.ts';
import { custodySuite, memorySuite, scratch } from '../contract/suites.ts';

// A folder memory whose next keep stops after its first entry, as a
// process that dies inside a keep leaves it.
class Cutting extends FolderMemory {
  protected override async apply(dir: string, keep?: Keep): Promise<void> {
    if (keep === undefined) return super.apply(dir);
    const [first] = Object.entries(keep);
    if (first && first[1] !== null) await writeFile(join(dir, first[0]), Buffer.from(first[1], 'hex'));
    throw new Error('the run ended inside a keep');
  }
}

memorySuite(
  'FolderMemory',
  () => {
    const root = scratch();
    return [new FolderMemory(root), new FolderMemory(root)];
  },
  () => {
    const root = scratch();
    return { cut: new Cutting(root), fresh: new FolderMemory(root) };
  },
);
custodySuite('FolderCustody', () => {
  const root = scratch();
  return [new FolderCustody(root, new CryptoEntropy()), new FolderCustody(root, new CryptoEntropy())];
});

test('[folder] a harbor is a folder: its seed, and one folder of entry files per place', async () => {
  const root = scratch();
  const memory = new FolderMemory(root);
  await Promise.all([memory.write('aa', new Map([['01', Uint8Array.of(1)]])), memory.write('aa', new Map([['02', Uint8Array.of(2)]]))]);
  const seed = await new FolderCustody(root, new CryptoEntropy()).seed();
  assert.deepEqual((await readdir(root)).sort(), ['aa', 'seed']);
  assert.deepEqual((await readdir(join(root, 'aa'))).sort(), ['01', '02']);
  assert.equal((await readFile(join(root, 'seed'), 'utf8')).trim().length, 64);
  assert.equal(seed.length, 32);
  await writeFile(join(root, 'aa', '03.next'), 'half');
  assert.deepEqual([...(await memory.read('aa')).keys()].sort(), ['01', '02']);
});

test('[folder] a seed file that is not a seed is refused, never replaced', async () => {
  const root = scratch();
  const custody = new FolderCustody(root, new CryptoEntropy());
  await custody.seed();
  await writeFile(join(root, 'seed'), 'nope');
  await assert.rejects(custody.seed(), /not a seed/);
  assert.equal(await readFile(join(root, 'seed'), 'utf8'), 'nope');
});
