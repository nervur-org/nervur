// SPDX-License-Identifier: Apache-2.0
// `quo/verifier/cli.js` over the stand, from the repository root. `--` in
// the arguments is where the stand goes, and `--other` where the JavaScript
// example kit goes. The run throws unless every check passed. The
// verifier's two windows, the quiet it listens to and the lateness it
// holds a frame for, are a few milliseconds here: on one machine a kit
// that writes, writes at once.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { PKG, QUO } from './where.mjs';

const run = promisify(execFile);
const STAND = [process.execPath, join(PKG, 'src/core/stand/main.ts')];
const OTHER = [join(QUO, 'examples/javascript/stand')];

export const verify = async (...args: string[]): Promise<string> => {
  const argv = args.flatMap((a) => (a === '--' ? ['--', ...STAND] : a === '--other' ? ['--', ...OTHER] : [a]));
  const { stdout } = await run(process.execPath, [join(QUO, 'verifier/cli.js'), ...argv], { cwd: PKG, env: { ...process.env, QUO_VERIFIER_QUIET_MS: '20', QUO_VERIFIER_LATE_MS: '20' }, maxBuffer: 64 * 1024 * 1024 }).catch((e: { stdout?: string }) => {
    assert.fail((e.stdout ?? String(e)).split('\n').filter((l) => l.startsWith('FAIL')).slice(0, 10).join('\n') || String(e));
  });
  assert.match(stdout.trim().split('\n').at(-1)!, /^(\d+) checks, \1 passed, 0 failed/);
  return stdout;
};
