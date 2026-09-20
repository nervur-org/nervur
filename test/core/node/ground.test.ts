// SPDX-License-Identifier: Apache-2.0
// The grounds as the core holds them: the Node terrain keeps a harbor in
// its folder, serves its root line to the command and holds its folder to
// one run; a terrain handed in wins, a ground added last is tried first,
// and a probe nothing fits refuses. Every harbor stands on the classes
// written for the core's suites.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { BundleLoader, Harbor, PointerTerrain, SourceLoader, VolatileMemory, type JsonObject } from '../kit.ts';
import { TEST } from '../classes.ts';
import { request } from '../../../src/core/cli/harbor.ts';
import { probeGround } from '../../../src/core/harbor/index.ts';
import { NEUTRAL, neutralGround } from '../../../src/core/line/index.ts';
import { harborDir, NodeTerrain, nodeGround, socketOf } from '../../../src/core/node/index.ts';
import { holds } from '../../claims.ts';
import { scratch } from '../contract/suites.ts';
import { add, being, census } from '../harbor/asks.ts';
import { shop } from '../harbor/shop.ts';

test(holds('ground.node', 'ground: the Node terrain keeps a harbor in its folder, serves its root line to the command, and holds the folder to one run'), async () => {
  const dir = scratch();
  const harbor = await Harbor.open(new NodeTerrain({ dir, defaults: TEST }));
  assert.ok(existsSync(join(dir, 'seed')), 'the seed is in the folder');
  assert.deepEqual(Object.keys((await census(harbor)).beings), ['catalogue'], 'the Node ground opens nothing unasked');
  assert.equal(((await add(harbor, shop.source)) as JsonObject).added, shop.module, "a module's source, run by importing it");
  assert.ok(existsSync(socketOf(dir)));
  const { pk } = await census(harbor);
  assert.equal(((await request(dir, TEST, {})) as { answer: { notes: { pk: string } } }).answer.notes.pk, pk, 'the command asks the harbor over its root line');
  await assert.rejects(Harbor.open(new NodeTerrain({ dir, defaults: TEST })), /already served/, 'one run holds a folder');
  await harbor.close();
  assert.ok(!existsSync(socketOf(dir)), 'closed, it serves nothing');

  const again = await Harbor.open(new NodeTerrain({ dir, defaults: TEST }));
  assert.equal((await census(again)).pk, pk, 'the same harbor from its folder');
  const { modules } = (await being(again, 'catalogue', 'modules')) as { modules: Record<string, JsonObject> };
  assert.equal(modules[shop.module]!.running, shop.version, 'the module live holds wakes from the folder');
  await again.close();
});

test(holds('ground.probed', 'ground: a terrain handed in wins, the last ground added is tried first, and nothing fitting refuses'), async () => {
  const memory = new VolatileMemory();
  const handed = new PointerTerrain({ memory, defaults: TEST });
  const harbor = await Harbor.open(handed);
  assert.ok((await memory.places()).length > 0, 'the harbor stands on the terrain handed');
  await harbor.close();

  const nowhere = { name: 'nowhere', fits: () => false, terrain: () => handed };
  const known = (probe: typeof nowhere | typeof neutralGround | typeof nodeGround) => ({ probe, defaults: TEST });
  assert.throws(() => probeGround({}, [known(nowhere)]), /no ground fits here/);
  assert.equal(probeGround({ where: scratch() }, [known(neutralGround), known(nodeGround), known(nowhere)]).ground, 'node', 'tried from the last, skipped where it does not fit');

  const neutral = probeGround({}, [known(neutralGround), known(nowhere)]);
  assert.equal(neutral.ground, NEUTRAL);
  assert.ok(neutral.terrain.loader instanceof SourceLoader, 'the neutral ground imports a source');
  assert.ok(probeGround({ bundle: [] }, [known(neutralGround)]).terrain.loader instanceof BundleLoader, 'and runs a bundle it is handed');
  const bare = await Harbor.open(neutral.terrain);
  assert.deepEqual(Object.keys((await census(bare)).beings), ['catalogue'], 'the neutral ground opens nothing unasked');
  await bare.close();

  assert.equal(nodeGround.fits({}), true);
  assert.equal(harborDir({ NERVUR_DIR: '/x' }), '/x');
  assert.match(harborDir({}), /\.nervur$/);
  const dir = scratch();
  const probed = nodeGround.terrain({ where: dir }, TEST) as NodeTerrain;
  assert.equal(probed.dir, dir);
  assert.equal(probed.serves, true);
});

test(holds('ground.one-run', 'ground: a harbor whose serving fails closes, and a claim refused opens nothing'), async () => {
  const dir = scratch();
  class Unserved extends NodeTerrain {
    override stand(): Promise<void> {
      return Promise.reject(new Error('no socket'));
    }
  }
  await assert.rejects(Harbor.open(new Unserved({ dir, defaults: TEST, serves: true })), /no socket/);
  const first = await Harbor.open(new NodeTerrain({ dir, defaults: TEST }));
  class Broken extends NodeTerrain {
    override readonly custody = { seed: () => Promise.reject(new Error('no custody')) } as unknown as NodeTerrain['custody'];
  }
  await first.close();
  await assert.rejects(Harbor.open(new Broken({ dir, defaults: TEST, serves: true })), /no custody/);
  assert.ok(!existsSync(socketOf(dir)));
  const last = await Harbor.open(new NodeTerrain({ dir, defaults: TEST, serves: false }));
  assert.ok(!existsSync(socketOf(dir)), 'a terrain that serves nothing opens no socket');
  await last.close();
});
