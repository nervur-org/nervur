// Every unlock a ground keeps its key in, held to the unlock contract's one
// suite: the bench's, a phone's, a page's, an edge's, a file's and, on
// macOS, the keychain's.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { NativeUnlock } from '../../../src/app/native.ts';
import { FakeUnlock } from '../../../src/bench/fake-unlock.ts';
import { LockedUnlock, type Shelf } from '../../../src/browser/locked-unlock.ts';
import { SecretUnlock } from '../../../src/edge/secret-unlock.ts';
import { FileUnlock, KeychainUnlock } from '../../../src/node/unlock.ts';
import { MapSecrets } from '../../fixtures/app/shell.ts';
import { unlockSuite } from '../../suites/unlock.ts';

unlockSuite('FakeUnlock', () => new FakeUnlock('suite'));

const secrets = new MapSecrets();
unlockSuite('NativeUnlock', () => new NativeUnlock(secrets));

const kept = new Map<string, unknown>();
const shelf: Shelf = {
  get: async (key) => kept.get(key),
  set: async (key, value) => {
    kept.set(key, value);
  },
};
unlockSuite('LockedUnlock', () => new LockedUnlock(shelf));

unlockSuite('SecretUnlock', () => new SecretUnlock('5e'.repeat(32)));

const folder = mkdtempSync(join(tmpdir(), 'nervur-unlock-'));
after(() => rmSync(folder, { recursive: true, force: true }));
unlockSuite('FileUnlock', () => new FileUnlock(join(folder, 'suite', 'key')));

test('FileUnlock draws a key its owner alone reads, in a folder its owner alone opens', async () => {
  const path = join(folder, 'made', 'key');
  const key = await new FileUnlock(path).key();
  assert.equal(statSync(path).mode & 0o777, 0o600);
  assert.equal(readFileSync(path, 'utf8'), `${key}\n`);
});

test('FileUnlock refuses a key file others may read, and a key that is not sixty-four hex digits', async () => {
  const loose = join(folder, 'loose');
  writeFileSync(loose, `${'b'.repeat(64)}\n`, { mode: 0o644 });
  chmodSync(loose, 0o644);
  await assert.rejects(new FileUnlock(loose).key(), /readable by others/);
  const bad = join(folder, 'bad');
  writeFileSync(bad, 'not a key\n', { mode: 0o600 });
  await assert.rejects(new FileUnlock(bad).key(), /sixty-four lowercase hex digits/);
});

test('SecretUnlock draws nothing: an edge whose secret is missing or malformed opens no drawer', () => {
  assert.throws(() => new SecretUnlock(undefined), /sixty-four lowercase hex digits/);
  assert.throws(() => new SecretUnlock('not a key'), /sixty-four lowercase hex digits/);
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
  unlockSuite('KeychainUnlock', () => new KeychainUnlock({ account }));

  test('KeychainUnlock refuses an account that leaves the rule', () => {
    assert.throws(() => new KeychainUnlock({ account: 'no spaces' }), TypeError);
  });
}
