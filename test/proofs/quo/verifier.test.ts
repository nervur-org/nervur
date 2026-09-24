// The room passes quo/verifier/cli.js alone, as a door and as an asker,
// and carries its boxes over TcpCarry and WebCarry, the post and the held
// line, as a listener and as a dialer.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { test } from 'node:test';
import { quo } from '../../fixtures/quo.ts';

const root = new URL('../', quo);
const cli = new URL('verifier/cli.js', quo);
const stand = [process.execPath, new URL('../fixtures/stand.ts', import.meta.url).pathname];

const verify = async (t: { after: (fn: () => void) => void }, args: string[]) => {
  const run = spawn(process.execPath, [cli.pathname, ...args], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => run.kill('SIGKILL'));
  let out = '';
  run.stdout.on('data', (chunk) => (out += chunk));
  run.stderr.on('data', (chunk) => (out += chunk));
  const code = await new Promise((resolve) => run.on('close', resolve));
  assert.deepEqual(
    out.split('\n').filter((line) => line.startsWith('FAIL')),
    [],
  );
  assert.equal(code, 0, out.split('\n').slice(-3).join('\n'));
  return out;
};

test('A house holds one ward of Quo, and the room passes the verifier as a door and as an asker', { timeout: 90_000 }, async (t) => {
  const out = await verify(t, ['--', ...stand]);
  assert.match(out, /judged as a tcp listener; judged as a tcp dialer; judged as an http listener; judged as an http dialer; judged as a ws listener; judged as a ws dialer/);
  assert.match(out, /reached a ward through at over tcp; reached a ward through at over http; reached a ward through at over ws/);
});

test('Two rooms carry a relation between them over TCP, judged by the verifier standing between', { timeout: 90_000 }, async (t) => {
  await verify(t, ['--two', '--', ...stand, '--', ...stand]);
});
