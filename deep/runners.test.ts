// The runner's one suite against a NodeGround, whose runners are processes
// of this machine. The bench's ground holds the same suite at the gate.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { NodeGround } from 'nervur/node';
import { runnerSuite } from '../test/suites/runner.ts';

runnerSuite('NodeGround', async (t: TestContext) => {
  const state = await mkdtemp(join(tmpdir(), 'runner-'));
  const ground = await NodeGround.open({ folder: fileURLToPath(new URL('../test/fixtures/', import.meta.url)), env: { NERVUR_STATE: state } });
  t.after(async () => {
    await ground.close();
    await rm(state, { recursive: true, force: true });
  });
  await ground.ground.hand({ method: 'housesAdd', args: { name: 'wild', classes: { faculty: 'folder', at: 'runner' } } });
  return { ask: (request) => ground.ground.hand({ house: 'wild', ...request }) };
});
