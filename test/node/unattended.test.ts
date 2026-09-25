// A ground that runs unattended, `nervur up` on a folder: one instance to
// its state, asked locally through the command on a socket only the
// ground's user reads, and opened again on its key and its ledger.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { FolderClasses, serveHand, takeLock } from 'nervur/node';
import { cli } from '../fixtures/node/grounds.ts';
import { onLoopback, stop, up } from '../fixtures/node/spawned.ts';

const folder = new URL('../fixtures/node/', import.meta.url).pathname;
const classes = new URL('../fixtures/node/classes/', import.meta.url).pathname;

// The command as the owner runs it. Each run is a process of its own, so the ground answers meanwhile.
const nervur = (...args: string[]) => {
  const { NERVUR_HAND: _hand, ...env } = process.env;
  const run = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', env });
  return { code: run.status, out: run.stdout.trim() };
};

test('An unattended ground holds its state alone, is asked through the command, and opens again on what it kept', { timeout: 30_000 }, async (t) => {
  const state = mkdtempSync(join(tmpdir(), 'nervur-unattended-'));
  const start = () => up(cli, folder, { env: { NERVUR_STATE: state }, conditions: ['nervur-source'] });
  await onLoopback(folder, state);
  let first = await start();
  t.after(async () => {
    await stop(first.child);
    rmSync(state, { recursive: true, force: true });
  });
  const socket = first.line.hand;
  const at = ['--at', socket];

  assert.equal(statSync(socket).mode & 0o777, 0o600, 'the hand is the ground user’s alone');
  const added = nervur(...at, 'houses', 'add', 'name=main', 'classes={"faculty":"folder","at":"classes"}');
  assert.equal(added.code, 0, added.out);
  const ward = (JSON.parse(added.out) as { result: { ward: string } }).result.ward;
  assert.deepEqual(nervur(...at, 'ask', 'main', 'whoami'), { code: 0, out: '{"result":"root"}' });
  assert.equal(nervur(...at, 'ask', 'main', 'ping').code, 1, 'an error answered exits 1');
  assert.equal(nervur(...at, 'ask', 'main', 'pings', '[1]').code, 2, 'args that are not one object ask nothing');
  assert.equal(nervur('ask', 'main', 'pings').code, 2, 'no socket named asks nothing');
  assert.equal(nervur(...at, 'ask', 'main', 'bear', 'kind=org.example.counter', 'id=tally', 'args={"start":4}').code, 0, 'a class from the folder is borne');
  assert.deepEqual(nervur(...at, 'ask', 'main', '--id', 'tally', 'total'), { code: 0, out: '{"result":4}' }, 'and the owner asks her by id');
  assert.equal(nervur(...at, 'ask', 'main', '--id').code, 2, 'an --id naming no being asks nothing');
  assert.deepEqual(nervur(...at, 'ask', 'main', '--id', 'tally', '--cells'), { code: 0, out: '{"result":{"total":4,"state":"open","rung":0}}' }, 'the owner reads her cells');
  assert.equal(nervur(...at, 'ask', 'main', '--id', 'tally', '--cells', 'total').code, 2, 'cells are read alone');

  await assert.rejects(start(), /exited with 1/, 'a second instance on the state refuses');
  assert.deepEqual(nervur(...at, 'ask', 'main', 'count'), { code: 0, out: '{"result":1}' }, 'and the first stands');

  first.child.kill('SIGKILL');
  await stop(first.child);
  first = await start();
  assert.deepEqual(first.line.houses.map(({ name, ward: kept }) => ({ name, ward: kept })), [{ name: 'main', ward }], 'the key opens the drawer, and its seed the same ward');
  assert.equal(statSync(join(state, 'key')).mode & 0o777, 0o600, 'the key is the ground user’s alone');
  assert.deepEqual(nervur(...at, 'ask', 'main', 'count'), { code: 0, out: '{"result":1}' }, 'the ledger kept what landed, and a dead holder’s lock is taken over');

  await stop(first.child);
  assert.equal(existsSync(join(state, 'lock')) || existsSync(socket), false, 'a stop lets the lock and the socket go');
});

test('serveHand refuses a socket path longer than the kernel holds, and says so', async () => {
  const path = join(tmpdir(), 'x'.repeat(120), 'hand');
  await assert.rejects(serveHand(async () => ({ result: null }), path), /a socket's path is at most 10[37] bytes here/);
});

test('A lock refuses a second holder in the same process, and is taken again once released', async (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'nervur-lock-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const lock = await takeLock(folder);
  await assert.rejects(takeLock(folder), /holds the lock/);
  await lock.release();
  await (await takeLock(folder)).release();
});

test('FolderClasses loads the folder’s steward and beings, and says what a folder lacks', async (t) => {
  const loaded = await FolderClasses.open(classes);
  assert.equal(loaded.steward(), 'org.example.steward');
  assert.ok(await loaded.resolve({ kind: 'org.example.counter' }));
  const empty = mkdtempSync(join(tmpdir(), 'nervur-classes-'));
  t.after(() => rmSync(empty, { recursive: true, force: true }));
  await assert.rejects(FolderClasses.open(empty), /has no index\.js/);
  writeFileSync(join(empty, 'index.mjs'), '');
  await assert.rejects(FolderClasses.open(empty), /exports no steward/);
});
