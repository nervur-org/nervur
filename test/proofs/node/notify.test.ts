// The word a ground on Node gives systemd once it is up.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { notifyReady } from '../../../src/node/notify.ts';

const folder = mkdtempSync(join(tmpdir(), 'nervur-notify-'));
after(() => rmSync(folder, { recursive: true, force: true }));

test('notifyReady tells systemd where one waits, and does nothing where none does', async (t) => {
  const saved = { socket: process.env.NOTIFY_SOCKET, path: process.env.PATH };
  t.after(() => {
    if (saved.socket === undefined) delete process.env.NOTIFY_SOCKET;
    else process.env.NOTIFY_SOCKET = saved.socket;
    process.env.PATH = saved.path;
  });
  delete process.env.NOTIFY_SOCKET;
  assert.equal(await notifyReady(), false);

  const told = join(folder, 'told');
  process.env.NOTIFY_SOCKET = told;
  process.env.PATH = `${new URL('../fixtures/bin', import.meta.url).pathname}:${saved.path}`;
  assert.equal(await notifyReady(), true);
  assert.equal(readFileSync(told, 'utf8'), `--ready\nMAINPID=${process.pid}\n`);
});
