// SPDX-License-Identifier: Apache-2.0
// The runner. `node test.mjs <files...>` runs Node's own test runner over the
// files, with three rules the runner alone does not hold:
//
//   a test has the time its author gave it. `test(name, { timeout }, fn)`
//   is the author's word; unsaid, a test gets DEFAULT and no more, so a test
//   that waits on nothing cannot hang the suite. A timeout guards a freeze;
//   a test never waits on a clock to prove something, it waits on the event
//
//   the first red stops everything. A failing test is read at once, and the
//   minutes the rest would take are given back
//
//   the whole run is capped at CAP, so a freeze is named, not waited out
//
// The runner and every test file it starts are one process group, and a
// stop kills the group, so nothing is left running after it.
//
// Output is Node's spec reporter, unchanged. The exit code is the gate's.
import { spawn } from 'node:child_process';

const DEFAULT = Number(process.env.NERVUR_TEST_TIMEOUT ?? 5_000);
const CAP = Number(process.env.NERVUR_TEST_CAP ?? 180_000);

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('node test.mjs <files...>');
  process.exit(2);
}

const child = spawn(process.execPath, ['--test', `--test-timeout=${DEFAULT}`, '--test-reporter=spec', ...files], { stdio: ['ignore', 'pipe', 'inherit'], detached: true });

const kill = () => {
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    child.kill('SIGKILL');
  }
};

let red = false;
const stop = (why) => {
  if (red) return;
  red = true;
  console.log(`\ntest: ${why}`);
  kill();
};

process.on('SIGINT', () => {
  kill();
  process.exit(130);
});

const cap = setTimeout(() => stop(`the run passed ${CAP / 1000}s and was killed`), CAP);
cap.unref();

let held = '';
child.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
  held += chunk;
  // The spec reporter marks a failed test with this glyph at the head of a
  // line; the first one is the last thing worth reading.
  if (!red && /^\s*✖ /m.test(held)) stop('stopped at the first failing test');
  held = held.slice(-4096);
});

child.on('close', (code) => {
  clearTimeout(cap);
  process.exit(red ? 1 : (code ?? 1));
});
