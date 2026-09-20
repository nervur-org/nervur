// SPDX-License-Identifier: Apache-2.0
// One suite per contract, for every body that fulfils it, the dock's
// included. Custody and Memory are the scenes of `test/contracts.ts`, which
// every engine runs too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Clock, Custody, Entropy, Loader, Memory } from '../../../src/core/contract/index.ts';
import { holds } from '../../claims.ts';
import { custodyScenes, entropyScenes, expect, loaderScenes, memoryScenes, type Cut, type Source } from '../../../src/core/proof/index.ts';

export type { Cut } from '../../../src/core/proof/index.ts';

// A fresh folder for a disk body.
export const scratch = (): string => mkdtempSync(join(tmpdir(), 'nervur-folder-'));

export const entropySuite = (name: string, make: () => Entropy): void => {
  for (const [title, scene] of entropyScenes(name, make, expect)) test(holds('contract.one-suite', title.replace('[contract] ', 'contract: ')), scene);
};

export const clockSuite = (name: string, make: () => Clock): void => {
  test(`[contract] ${name} fulfils Clock: a wait ends, and a cancelled one never does`, async () => {
    const clock = make();
    assert.ok(clock instanceof Clock);
    const before = clock.now();
    await clock.wait(10).done;
    assert.ok(clock.now() >= before);
    const cancelled = clock.wait(5);
    cancelled.cancel();
    const winner = await Promise.race([cancelled.done.then(() => 'ended'), clock.wait(30).done.then(() => 'not')]);
    assert.equal(winner, 'not');
  });
};

export const custodySuite = (name: string, make: () => [Custody, Custody]): void => {
  for (const [title, scene] of custodyScenes(name, make, expect)) test(title, scene);
};

// `make` gives a loader, a module's source it runs, and one it refuses.
export const loaderSuite = (name: string, make: () => { loader: Loader; found: Source; refused: Source }): void => {
  for (const [title, scene] of loaderScenes(name, make, expect)) test(title, scene);
};

export const memorySuite = (name: string, make: () => [Memory, Memory], half?: () => Cut): void => {
  for (const [title, scene] of memoryScenes(name, make, expect, half)) test(title, scene);
};
