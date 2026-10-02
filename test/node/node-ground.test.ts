// A NodeGround's refusals on its folder and its state, each held at the
// gate as the paper names it, and the command's unit for a folder. The
// ground standing its ladder, opening houses, keeping its dock, mending a
// port and running its shell is `deep/node/node-ground.test.ts`.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { NodeGround } from 'nervur/node';
import { cli } from '../fixtures/node/grounds.ts';

const folder = fileURLToPath(new URL('../fixtures/node-ground/', import.meta.url));
const run = promisify(execFile);

// The command, as an owner runs it on the machine: its one JSON line, and its exit.
const nervur = async (hand: string, ...args: string[]) => {
  try {
    const { stdout } = await run(process.execPath, [cli, '--at', hand, ...args]);
    return { code: 0, answer: JSON.parse(stdout) as Record<string, unknown> };
  } catch (error) {
    const failed = error as { code: number; stdout: string };
    return { code: failed.code, answer: JSON.parse(failed.stdout || 'null') as Record<string, unknown> };
  }
};

test('It refuses a setting read from the environment beyond what opens the dock and the hand: a port moved through the dock is kept across a restart', { timeout: 20_000 }, async (t) => {
  const state = await mkdtemp(join(tmpdir(), 'ground-'));
  const read = new Set<string>();
  const given: Record<string, string> = { NERVUR_TCP_PORT: '1', NERVUR_HTTP_PORT: '1', NERVUR_BIND: '10.9.9.9', NERVUR_WAIT: 'never', NERVUR_ADDRESSES: 'tcp://nowhere:1', NERVUR_ORIGINS: 'https://nowhere', NERVUR_ALLOW_PRIVATE: '1' };
  const env = new Proxy(given, {
    get: (held, name: string) => {
      read.add(name);
      return held[name];
    },
  });
  // Every entry the terrain's: its TCP stands on the loopback at 9110, or down where another ground holds it.
  let open: NodeGround | undefined = await NodeGround.open({ folder, state, env });
  t.after(() => open?.close());
  t.after(() => rm(state, { recursive: true, force: true }));
  assert.deepEqual(
    [...read].filter((name) => !['NERVUR_STATE', 'NERVUR_UNLOCK', 'NERVUR_HAND'].includes(name)),
    [],
    'the ground read only what opens its dock and its hand',
  );
  const terrain = (await nervur(open.hand, 'faculties', 'list')).answer.result as { name: string; entry: object; terrain?: boolean }[];
  assert.deepEqual(terrain.find(({ name }) => name === 'web'), { name: 'web', entry: { make: 'web', args: { bind: '127.0.0.1' } }, terrain: true, serves: 'carry' }, 'the terrain’s entry as its code fixes it, whatever the environment says');
  assert.deepEqual(terrain.find(({ name }) => name === 'tcp')?.entry, { make: 'tcp', args: { bind: '127.0.0.1', port: 9110 } }, 'a new ground listens on this machine alone, until its owner names a bind');
  assert.equal((await nervur(open.hand, 'faculties', 'update', 'name=tcp', 'make=tcp', 'args={"port":"x"}')).code, 1, 'a port that is no port is refused at the hand');
  assert.equal((await nervur(open.hand, 'faculties', 'update', 'name=tcp', 'make=tcp', 'args={"port":0,"bind":"127.0.0.1"}')).code, 0);
  await open.close();
  open = await NodeGround.open({ folder, state, env: {} });
  const kept = (await nervur(open.hand, 'faculties', 'list')).answer.result as { name: string; entry: object; terrain?: boolean }[];
  assert.deepEqual(kept.find(({ name }) => name === 'tcp'), { name: 'tcp', entry: { make: 'tcp', args: { port: 0, bind: '127.0.0.1' } }, serves: 'carry' }, 'the dock kept the owner’s port');
});

test('It refuses a second ground on the state one runs on: its ledger holds the state’s lock while it stands, and lets it go when it goes down', { timeout: 20_000 }, async (t) => {
  const state = await mkdtemp(join(tmpdir(), 'ground-'));
  t.after(() => rm(state, { recursive: true, force: true }));
  const first = await NodeGround.open({ folder, state, env: {} });
  await assert.rejects(NodeGround.open({ folder, state, env: {} }), /holds the lock of/);
  await first.close();
  const second = await NodeGround.open({ folder, state, env: {} });
  await second.close();
});

test('The command writes the unit or the job that runs a folder', async () => {
  const { stdout } = await run(process.execPath, [cli, 'service', folder]);
  assert.match(stdout, process.platform === 'darwin' ? /<string>up<\/string>/ : /ExecStart=.* up /);
  assert.ok(stdout.includes(folder.replace(/\/$/, '')), 'it names the folder');
});
