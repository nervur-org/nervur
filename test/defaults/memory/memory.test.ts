// SPDX-License-Identifier: Apache-2.0
// The ground memory faculty, on the core and nothing else of the defaults:
// the keeper's scenes of `nervur/proof` over it, on the pointer bodies and
// on a folder, where it keeps places of the terrain's own memory behind
// its key.
import { test } from 'node:test';
import { CryptoEntropy, HeldCustody, VolatileMemory } from '../../core/kit.ts';
import { TEST, TestCarrier } from '../../core/classes.ts';
import { FolderCustody, FolderMemory } from '../../../src/core/folder/index.ts';
import { expect, keeperScenes, type Terrain } from '../../../src/core/proof/index.ts';
import { GroundMemory } from '../../../src/defaults/index.ts';
import { holds } from '../../claims.ts';
import { scratch } from '../../core/contract/suites.ts';

// The core's test classes, the ground memory faculty the memory faculty
// among them.
const GROUNDED = { ...TEST, classes: [GroundMemory, TestCarrier] };

const pointer: Terrain = {
  name: 'pointer, on the ground memory faculty',
  make: () => ({ custody: new HeldCustody(new CryptoEntropy()), memory: new VolatileMemory() }),
  again: (bodies) => bodies,
  defaults: GROUNDED,
};

const roots = new WeakMap<object, string>();
const folder: Terrain = {
  name: 'folder, on the ground memory faculty',
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
  defaults: GROUNDED,
};

for (const terrain of [pointer, folder]) {
  for (const [name, scene] of keeperScenes(terrain, expect)) test(holds('memory.keeper', name), scene);
}
