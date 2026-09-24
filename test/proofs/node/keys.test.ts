// The keys a ground on Node keeps, a file's and the keychain's, held to the
// keys contract's one suite; and the word a ground gives systemd.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { NobleCrypto } from '../../../src/bodies/noble-crypto.ts';
import { FileKeys } from '../../../src/node/file-keys.ts';
import { KeychainKeys } from '../../../src/node/keychain-keys.ts';
import { notifyReady } from '../../../src/node/notify.ts';
import { keysSuite } from '../suites/keys.ts';

const crypto = new NobleCrypto();
const folder = mkdtempSync(join(tmpdir(), 'nervur-keys-'));
after(() => rmSync(folder, { recursive: true, force: true }));

keysSuite('FileKeys', () => new FileKeys(join(folder, 'suite.seed'), crypto), crypto);

test('FileKeys makes a seed its owner alone reads, and opens the same ward on it again', async () => {
  const path = join(folder, 'made.seed');
  const ward = await new FileKeys(path, crypto).ward();
  assert.equal(statSync(path).mode & 0o777, 0o600);
  assert.match(readFileSync(path, 'utf8'), /^[0-9a-f]{64}\n$/);
  assert.deepEqual(await new FileKeys(path, crypto).ward(), ward);
});

test('FileKeys refuses a seed file others may read, and a seed that is not sixty-four hex digits', async () => {
  const loose = join(folder, 'loose.seed');
  writeFileSync(loose, `${'b'.repeat(64)}\n`, { mode: 0o644 });
  chmodSync(loose, 0o644);
  await assert.rejects(new FileKeys(loose, crypto).ward(), /readable by others/);
  const bad = join(folder, 'bad.seed');
  writeFileSync(bad, 'not a seed\n', { mode: 0o600 });
  await assert.rejects(new FileKeys(bad, crypto).ward(), /sixty-four lowercase hex digits/);
});

if (process.platform === 'darwin') {
  const account = `nervur-test-${process.pid}-${Date.now()}`;
  after(() => {
    try {
      execFileSync('security', ['delete-generic-password', '-s', 'nervur', '-a', account], { stdio: 'ignore' });
    } catch {
      // Nothing was kept.
    }
  });
  keysSuite('KeychainKeys', () => new KeychainKeys({ account }, crypto), crypto);

  test('KeychainKeys keeps one seed under its account, and opens the same ward on it again', async () => {
    const ward = await new KeychainKeys({ account }, crypto).ward();
    assert.deepEqual(await new KeychainKeys({ account }, crypto).ward(), ward);
    assert.throws(() => new KeychainKeys({ account: 'no spaces' }, crypto), TypeError);
  });
}

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
