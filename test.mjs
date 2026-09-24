// SPDX-License-Identifier: Apache-2.0
// The runner. `node test.mjs <files...>` runs Node's own test runner over the
// files, under the condition `nervur-source`, so a suite that names the
// package by an entry, as a stranger does, reads the source that entry is
// built from. And with three rules the runner alone does not hold:
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
// A red says why. The spec reporter keeps a failure's message, its diff and
// its stack for the end of the run, which the kill cuts off, so a second
// reporter writes TAP to a file of its own and the first red is read from
// there: the pipe is given QUIET of silence to finish writing it, DRAIN at
// the most, then the failure's own block is printed and the group killed. A
// freeze has nothing to write and is killed where it stands.
//
// Output is Node's spec reporter with that block under it. The exit code is
// the gate's.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DEFAULT = Number(process.env.NERVUR_TEST_TIMEOUT ?? 5_000);
const CAP = Number(process.env.NERVUR_TEST_CAP ?? 180_000);
const QUIET = Number(process.env.NERVUR_TEST_QUIET ?? 400);
const DRAIN = Number(process.env.NERVUR_TEST_DRAIN ?? 4_000);

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('node test.mjs <files...>');
  process.exit(2);
}

const kept = mkdtempSync(join(tmpdir(), 'nervur-test-'));
const tap = join(kept, 'run.tap');
const swept = () => rmSync(kept, { recursive: true, force: true });
const child = spawn(
  process.execPath,
  ['--conditions=nervur-source', '--test', `--test-timeout=${DEFAULT}`, '--test-reporter=spec', '--test-reporter-destination=stdout', '--test-reporter=tap', `--test-reporter-destination=${tap}`, ...files],
  { stdio: ['ignore', 'pipe', 'inherit'], detached: true },
);

const kill = () => {
  try {
    process.kill(-(child.pid ?? 0), 'SIGKILL');
  } catch {
    child.kill('SIGKILL');
  }
  swept();
};

// The first failure as TAP holds it: the `not ok` line and the block under
// it, which carries the message, the diff and the stack.
const why = () => {
  let lines;
  try {
    lines = readFileSync(tap, 'utf8').split('\n');
  } catch {
    return '';
  }
  const at = lines.findIndex((line) => /^\s*not ok \d/.test(line));
  if (at < 0) return '';
  const out = [lines[at]];
  for (const line of lines.slice(at + 1)) {
    if (/^\s*(?:not )?ok \d/.test(line)) break;
    out.push(line);
    if (/^\s*\.\.\.\s*$/.test(line)) break;
  }
  return out.join('\n');
};

let red = false;
// A stop that waits prints and kills once the reporters fall quiet for
// QUIET, or after DRAIN, whichever comes first.
let quiet;
let drained;
let over = false;
const end = (said, reads) => {
  if (over) return;
  over = true;
  clearTimeout(quiet);
  clearTimeout(drained);
  const detail = reads ? why() : '';
  if (detail) console.log(`\n${detail}`);
  console.log(`\ntest: ${said}`);
  kill();
};
const stop = (said, reads = false) => {
  if (red) return;
  red = true;
  if (!reads) return end(said, false);
  quiet = setTimeout(() => end(said, true), QUIET);
  drained = setTimeout(() => end(said, true), DRAIN);
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
  // line, and the first one is the last thing worth reading.
  if (!red && /^\s*✖ /m.test(held)) stop('stopped at the first failing test', true);
  else if (red && !over) quiet?.refresh();
  held = held.slice(-4096);
});

child.on('close', (code) => {
  clearTimeout(cap);
  clearTimeout(quiet);
  clearTimeout(drained);
  if (!red) swept();
  process.exit(red ? 1 : (code ?? 1));
});
