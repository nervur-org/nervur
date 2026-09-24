// Every custody a ground keeps its seeds in, held to the custody
// contract's one suite: the bench's, a phone's, a page's, a folder's and,
// on macOS, the keychain's.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after } from 'node:test';
import { NativeCustody } from '../../../src/app/native.ts';
import { FakeCustody } from '../../../src/bench/fake-custody.ts';
import { LockedCustody, type Shelf } from '../../../src/browser/locked-custody.ts';
import { FolderCustody, KeychainCustody } from '../../../src/node/custody.ts';
import { MapSecrets } from '../../fixtures/app/shell.ts';
import { custodySuite } from '../../suites/custody.ts';

custodySuite('FakeCustody', () => new FakeCustody('suite'));

const secrets = new MapSecrets();
custodySuite('NativeCustody', () => new NativeCustody(secrets));

const kept = new Map<string, unknown>();
const shelf: Shelf = {
  get: async (key) => kept.get(key),
  set: async (key, value) => {
    kept.set(key, value);
  },
};
custodySuite('LockedCustody', () => new LockedCustody(shelf));

const folder = mkdtempSync(join(tmpdir(), 'nervur-custody-'));
after(() => rmSync(folder, { recursive: true, force: true }));
custodySuite('FolderCustody', () => new FolderCustody(join(folder, 'seeds')));

if (process.platform === 'darwin') {
  const service = `nervur-test-${process.pid}`;
  after(() => {
    for (const account of ['shop', 'home']) {
      try {
        execFileSync('security', ['delete-generic-password', '-s', service, '-a', account], { stdio: 'ignore' });
      } catch {
        // Nothing was kept under it.
      }
    }
  });
  custodySuite('KeychainCustody', () => new KeychainCustody({ service }));
}
