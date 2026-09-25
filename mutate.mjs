// SPDX-License-Identifier: Apache-2.0
// The mutation run. `node mutate.mjs` runs Stryker over the house, as
// `stryker.config.json` says, and stops it at CAP, so a release waits
// twenty minutes at the most. The incremental file keeps each mutant's
// answer, so a run tests only what moved since the last one that finished.
// Stryker and every process it starts are one group, and the cap kills
// the group. The exit code is Stryker's, or 1 where the cap spoke.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CAP = Number(process.env.NERVUR_MUTATE_CAP ?? 1_200_000);
const here = fileURLToPath(new URL('.', import.meta.url));
const stryker = fileURLToPath(new URL('../../node_modules/.bin/stryker', import.meta.url));

const child = spawn(stryker, ['run', 'stryker.config.json'], { cwd: here, stdio: 'inherit', detached: true });

const cap = setTimeout(() => {
  process.stderr.write(`mutate: stopped at the cap of ${CAP / 60_000} minutes\n`);
  try {
    process.kill(-(child.pid ?? 0), 'SIGKILL');
  } catch {
    child.kill('SIGKILL');
  }
  process.exit(1);
}, CAP);

child.on('exit', (code) => {
  clearTimeout(cap);
  process.exit(code ?? 1);
});
