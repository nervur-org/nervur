// What an unattended ground stands on, held in this process: the hand's
// socket, the lock on its state and the folder of its classes. The ground
// itself, `nervur up` as a process of its own, is `deep/node/unattended.test.ts`.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { FolderClasses, serveHand, takeLock } from 'nervur/node';

const classes = new URL('../fixtures/node/classes/', import.meta.url).pathname;

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
