// SPDX-License-Identifier: Apache-2.0
// The unpacking law on every terrain body the core ships: the pointer
// bodies here, and `nervur/folder` on this disk, each over the classes
// written for the core's suites. Inside every engine the terrain exercise
// runs it again. A terrain the kit ships joins this list. The keeper's
// scenes run beside it on the same bodies.
import { test } from 'node:test';
import { CryptoEntropy, HeldCustody, SourceLoader, VolatileMemory } from '../kit.ts';
import { TEST } from '../classes.ts';
import { FolderCustody, FolderMemory } from '../../../src/core/folder/index.ts';
import { expect, keeperScenes, LAW, lawBundle, lawScenes, type Terrain } from '../../../src/core/proof/index.ts';
import { holds } from '../../claims.ts';
import { scratch } from '../contract/suites.ts';

const pointer: Terrain = {
  name: 'pointer',
  make: () => ({ custody: new HeldCustody(new CryptoEntropy()), memory: new VolatileMemory() }),
  again: (bodies) => bodies,
  defaults: TEST,
};

// The pointer bodies running the law's module from a bundle, found by its
// blob alone, as an edge runs it.
const built = await new SourceLoader().load(LAW);
const bundled: Terrain = { ...pointer, name: 'pointer, bundled', loader: () => lawBundle(built) };

const roots = new WeakMap<object, string>();
const folder: Terrain = {
  name: 'folder',
  make: () => {
    const root = scratch();
    const bodies = { custody: new FolderCustody(root, new CryptoEntropy()), memory: new FolderMemory(root) };
    roots.set(bodies, root);
    return bodies;
  },
  again: (bodies) => {
    const root = roots.get(bodies)!;
    const next = { custody: new FolderCustody(root, new CryptoEntropy()), memory: new FolderMemory(root) };
    roots.set(next, root);
    return next;
  },
  defaults: TEST,
};

for (const terrain of [pointer, bundled, folder]) {
  for (const [name, scene] of lawScenes(terrain, expect)) test(holds('law.every-body', name), scene);
  for (const [name, scene] of keeperScenes(terrain, expect)) test(holds('memory.keeper', name), scene);
}
