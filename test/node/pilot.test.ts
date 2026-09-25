// A pilot on one NodeGround holds the dock of another over TCP on the
// loopback. The dock's ground restarts on the same port, and the pilot's
// standing reaches the dock again, as it reached it before.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { NodeGround } from 'nervur/node';
import { loopbackGround } from '../fixtures/node/spawned.ts';

const docked = fileURLToPath(new URL('../fixtures/node-ground/', import.meta.url));
const piloting = fileURLToPath(new URL('../fixtures/node/piloting/', import.meta.url));

// A port free on the loopback now, which the dock's ground keeps across its restart.
const freePort = () =>
  new Promise<number>((resolve) => {
    const server = createServer().listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });

test('A pilot far away reaches the dock again once its ground restarts', { timeout: 30_000 }, async (t) => {
  const [dockState, pilotState] = [await mkdtemp(join(tmpdir(), 'dock-')), await mkdtemp(join(tmpdir(), 'pilot-'))];
  t.after(() => Promise.all([rm(dockState, { recursive: true, force: true }), rm(pilotState, { recursive: true, force: true })]));
  const port = await freePort();
  let dock: NodeGround | undefined = await loopbackGround(docked, dockState, { port });
  t.after(() => dock?.close());
  const pilot = await loopbackGround(piloting, pilotState);
  t.after(() => pilot.close());
  assert.ok('result' in (await pilot.ground.hand({ method: 'housesAdd', args: { name: 'pilot', classes: { faculty: 'folder', at: 'pilot' } } })));

  const invited = (await dock.ground.hand({ method: 'pilotsInvite', args: { id: 'ada' } })) as { result: { invitation: string } };
  assert.ok('result' in (await pilot.ground.ask({ house: 'pilot', method: 'accept', args: { invitation: invited.result.invitation } })));
  assert.deepEqual(await pilot.ground.ask({ house: 'pilot', method: 'houses' }), { result: [] }, 'the pilot reads the dock');

  await dock.close();
  dock = await loopbackGround(docked, dockState, { port });
  assert.deepEqual(await pilot.ground.ask({ house: 'pilot', method: 'houses' }), { result: [] }, 'and reads it again once its ground restarts');
});
