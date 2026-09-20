// SPDX-License-Identifier: Apache-2.0
// `mutate`: whether a test asserts what a line does, or only runs it.
//
// Coverage says a line ran. Mutation says the line matters: change what it
// does and a test must go red. A mutant nothing catches is a line the suite
// runs without reading, and the run prints those and nothing else. There is
// no score here and no floor, because a score invites chasing it. The list
// is assertions worth writing, and the human picks which are worth it.
//
// It runs on demand and once before a release, never at a commit, never in
// `check` and never under `deep`, since the suite runs once per mutant.
//
// `npm run mutate -- <path...>`, each path a file or a folder under `src/`.
// Told nothing it takes DEFAULT and says which part of it it could afford.
//
// Three things keep a run down to minutes.
//
// **The smallest set of judges.** A test file that never executed a line of
// a source file cannot notice that file's mutant. So before anything is
// mutated, every test file runs alone under V8 coverage and says which
// source files it touched and how long it took. A source file is mutated
// against its touchers alone, and files with the same touchers go together.
//
// **Two passes.** For a file in a core layer nearly every test is a
// toucher, and one of them, the command's, takes twenty seconds where the
// rest take one. Judging every mutant by that set is the whole cost of the
// run. So the first pass judges every mutant by the quick touchers alone,
// where most mutants die in a second, and the second pass judges only what
// lived there by the full set, one mutant at a time by its own range. A
// mutant is called a survivor only after every toucher has seen it, so this
// is the same answer as one slow pass and not an approximation of it.
//
// **A plan, before the wait.** The run says how many mutants, over which
// files, judged by how many tests, at the measured seconds one run of those
// tests takes. The mutants are counted by Stryker's own instrumenter before
// the first test runs, and the seconds are measured in the pass that built
// the touch map. Two numbers are rules of thumb and are named as such,
// SHARE and DRAG: how many mutants live into the second pass, and how much
// slower a suite runs against a mutant than against the code as it stands.
// They size a default nobody asked for and judge nothing. The second pass
// says its own cost once the first has counted what lived.
// Told nothing, a plan over BUDGET is cut to the files that fit, cheapest
// first, and the run says what was left and what to type for it. A path the
// human named is never cut: it is his ask, and he is told what it costs.
//
// Two suites stand outside the judging, and neither can kill a mutant:
// `package.test.ts` installs the built tarball, which is `dist/` and not
// `src/`, and `layers.test.ts` reads the source as text, which
// instrumentation rewrites. `src/core/stand/` is not mutated, as `cover` does
// not count it: it is the verifier's own stand program.
//
// Nothing here touches the tree. The package is copied into a sandbox under
// the system's temporary folder, with `quo/`, `papers/` and `node_modules`
// linked and `test.mjs` beside it, and Stryker mutates that copy in place.
// The run behaves as `test.mjs`, `gate.mjs` and `cover.mjs` do: every child
// in its own process group, the whole thing capped, and nothing left
// running after it.
import { Instrumenter } from '@stryker-mutator/instrumenter';
import { spawn } from 'node:child_process';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODULES, QUO } from './where.mjs';

const pkg = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(pkg, 'src/');

// Told nothing, the wire: what a mutant there changes is a byte another kit
// reads, so it is the layer worth the first look.
const DEFAULT = 'src/core/quo/';

// What no mutant is made from. `src/core/stand/` is the verifier's stand
// program, which the verifier judges and `cover` leaves out too.
const OUTSIDE = ['src/core/stand/'];

// The suites, and the two that cannot kill a mutant of `src/`.
const SUITES = ['test/core', 'test/defaults', 'test/kit'];
const NOT_JUDGES = ['package.test.ts', 'layers.test.ts'];

// A quick judge takes at most this many seconds alone. The quick ones judge
// every mutant; the whole set judges what lived.
const QUICK = Number(process.env.NERVUR_MUTATE_QUICK ?? 3);

// How many test runs stand at once. Node's own runner already spreads a
// suite over the cores, so a handful of workers fills the machine. A set
// with a slow test file in it, the command's, spawns processes of its own
// and fills the machine alone: two of those at once each take longer than
// twice one, and a thrashing run times a mutant out that nothing caught. So
// a heavy set runs one at a time, which is both quicker in the end and a
// time the plan can state and keep.
const AT_ONCE = Number(process.env.NERVUR_MUTATE_AT_ONCE ?? 4);
const HEAVY_AT_ONCE = Number(process.env.NERVUR_MUTATE_HEAVY_AT_ONCE ?? 1);

// The slack a mutant gets over the suite's own time before it is called
// hung. Stryker adds it to the measured run, and it is generous on purpose:
// a mutant that truly loops never finishes, and every second under this is
// only a machine under load being called a killer.
const SLACK = Number(process.env.NERVUR_MUTATE_SLACK ?? 30_000);

// What a run may cost before an unasked-for default is cut, in seconds.
const BUDGET = Number(process.env.NERVUR_MUTATE_BUDGET ?? 300);

// How much slower a slow set runs against a mutant than against the code as
// it stands. A mutant makes a test wait for something that never comes,
// each wait to its own timeout, and the command's suite, which starts
// processes, waits the longest. About twice, on this suite. Like SHARE it
// sizes a plan and judges nothing.
const DRAG = Number(process.env.NERVUR_MUTATE_DRAG ?? 2);

// How much of a file's mutants live the first pass and are judged again by
// the slow one. It is a share this suite has shown, not a measurement, and
// it is used for one thing alone: sizing a default nobody asked for. No
// mutant is judged by it, and the second pass says its true cost once the
// first pass has counted what lived.
const SHARE = Number(process.env.NERVUR_MUTATE_SHARE ?? 0.25);

// Past the end of any line the source holds, for a mutation range that
// takes whole lines.
const WIDE = 10_000;

// The cap on the whole run, a freeze named rather than waited out.
const CAP = Number(process.env.NERVUR_MUTATE_CAP ?? 3_600_000);

// Every child, in its own process group, killed together.
const running = new Set();
const kill = () => {
  for (const child of running) {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      child.kill('SIGKILL');
    }
  }
  running.clear();
};
process.on('SIGINT', () => {
  kill();
  process.exit(130);
});
const cap = setTimeout(() => {
  console.log(`mutate: red, the run passed ${String(CAP / 1000)}s and was killed`);
  kill();
  process.exit(1);
}, CAP);

const run = (command, args, options) =>
  new Promise((resolve) => {
    const child = spawn(command, args, { detached: true, ...options });
    running.add(child);
    const at = Date.now();
    child.on('close', (code) => {
      running.delete(child);
      resolve({ code: code ?? 1, took: (Date.now() - at) / 1000 });
    });
  });

// A pool of at most AT_ONCE of them.
const pool = async (items, of) => {
  const answers = new Array(items.length);
  let next = 0;
  const worker = async () => {
    for (let mine = next++; mine < items.length; mine = next++) answers[mine] = await of(items[mine]);
  };
  await Promise.all(Array.from({ length: Math.min(AT_ONCE, items.length) }, worker));
  return answers;
};

let dir;
const die = async (why) => {
  console.log(`mutate: ${why}`);
  kill();
  clearTimeout(cap);
  if (dir) await rm(dir, { recursive: true, force: true });
  process.exit(1);
};

const minutes = (s) => (s < 90 ? `${s.toFixed(0)}s` : `${(s / 60).toFixed(1)}m`);

// Every source file the target names, relative to the package.
const under = async (at) => {
  const found = [];
  const walk = async (folder) => {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      if (entry.isDirectory()) await walk(join(folder, entry.name));
      else if (entry.name.endsWith('.ts')) found.push(relative(pkg, join(folder, entry.name)));
    }
  };
  if (at.endsWith('.ts')) found.push(relative(pkg, join(pkg, at)));
  else await walk(join(pkg, at));
  return found;
};

const asked = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
const targets = asked.length > 0 ? asked : [DEFAULT];
const sources = [];
for (const target of targets) {
  const each = await under(target).catch(() => die(`${target} is no file and no folder under the package`));
  for (const file of each) {
    if (!file.startsWith('src/')) await die(`${file} is not under src/`);
    if (OUTSIDE.some((out) => file.startsWith(out))) continue;
    if (!sources.includes(file)) sources.push(file);
  }
}
if (sources.length === 0) await die(`nothing to mutate in ${targets.join(' ')}`);

// The mutants, counted before a test runs. Stryker's own instrumenter makes
// them, so this count is the one the run will test.
const quiet = () => undefined;
const logger = { isTraceEnabled: () => false, isDebugEnabled: () => false, isInfoEnabled: () => false, isWarnEnabled: () => false, isErrorEnabled: () => false, isFatalEnabled: () => false, trace: quiet, debug: quiet, info: quiet, warn: quiet, error: quiet, fatal: quiet };
const counted = await new Instrumenter(logger).instrument(
  await Promise.all(sources.map(async (file) => ({ name: file, content: await readFile(join(pkg, file), 'utf8'), mutate: true }))),
  { ignorers: [], excludedMutations: [], plugins: null, noHeader: false },
);
const mutants = new Map(sources.map((file) => [file, 0]));
for (const mutant of counted.mutants) mutants.set(mutant.fileName, (mutants.get(mutant.fileName) ?? 0) + 1);

// The judges: every test file, run alone under coverage, saying which
// source files it executed and how long it took. A child process a test
// starts writes into the same folder, so what the command's own processes
// ran counts as that test file's too.
const judges = [];
for (const suite of SUITES) for (const name of await readdir(join(pkg, suite), { recursive: true })) if (name.endsWith('.test.ts') && !NOT_JUDGES.includes(name)) judges.push(`${suite}/${name}`);
judges.sort();

dir = await mkdtemp(join(tmpdir(), 'nervur-mutate-'));
const touched = new Map();
const seconds = new Map();
console.log(`mutate: the touch map, ${String(judges.length)} test files each run alone under coverage`);
const at = Date.now();
const mapped = await pool(judges, async (judge) => {
  const out = join(dir, 'touch', judge.replaceAll('/', '-'));
  await mkdir(out, { recursive: true });
  const answer = await run(process.execPath, [join(pkg, 'test.mjs'), judge], { cwd: pkg, stdio: 'ignore', env: { ...process.env, NODE_V8_COVERAGE: out } });
  seconds.set(judge, answer.took);
  const mine = new Set();
  for (const name of await readdir(out)) {
    const payload = JSON.parse(await readFile(join(out, name), 'utf8'));
    for (const script of payload.result ?? []) {
      if (!script.url.startsWith('file://')) continue;
      const file = fileURLToPath(script.url);
      if (!file.startsWith(SRC)) continue;
      if (script.functions.some((fn) => fn.ranges.some((range) => range.count > 0))) mine.add(relative(pkg, file));
    }
  }
  touched.set(judge, mine);
  return answer.code;
});
if (mapped.some((code) => code !== 0)) await die('a test file is red before anything was mutated');
console.log(`mutate: the touch map took ${minutes((Date.now() - at) / 1000)}\n`);

// What a set of test files costs in one run: they run together, so the
// slowest of them is the run. A mutant they kill stops at the first red, so
// this errs high, which is the side to err on before a wait.
const runs = (set) => Math.max(...set.map((judge) => seconds.get(judge)));
const heavy = (set) => runs(set) > QUICK;
const workers = (set) => (heavy(set) ? HEAVY_AT_ONCE : AT_ONCE);
const cost = (count, set) => (count * runs(set) * (heavy(set) ? DRAG : 1)) / Math.min(workers(set), Math.max(count, 1));

// One entry per file: its mutants, its touchers, and the quick ones among
// them that judge the first pass.
const entries = [];
const unjudged = [];
for (const file of sources) {
  const count = mutants.get(file) ?? 0;
  if (count === 0) continue;
  const all = judges.filter((judge) => touched.get(judge).has(file));
  if (all.length === 0) {
    unjudged.push(file);
    continue;
  }
  const quick = all.filter((judge) => seconds.get(judge) <= QUICK);
  entries.push({ file, count, all, first: quick.length > 0 ? quick : all });
}
const both = (entry) => cost(entry.count, entry.first) + cost(Math.ceil(entry.count * SHARE), entry.all);
entries.sort((a, b) => both(a) - both(b));

// The cut, and only of a default nobody asked for.
const taking = [];
let first = 0;
let whole = 0;
for (const entry of entries) {
  if (asked.length === 0 && taking.length > 0 && whole + both(entry) > BUDGET) continue;
  taking.push(entry);
  first += cost(entry.count, entry.first);
  whole += both(entry);
}
const left = entries.filter((entry) => !taking.includes(entry)).map((entry) => entry.file);

console.log(`mutate: ${String(counted.mutants.length)} mutants over ${String(sources.length)} file(s) of ${targets.join(' ')}, ${String(AT_ONCE)} quick test runs at a time and ${String(HEAVY_AT_ONCE)} slow one(s)\n`);
for (const entry of taking) console.log(`  ${String(entry.count).padStart(4)} mutants  ${entry.file}\n               first by ${String(entry.first.length)} quick test file(s), ${runs(entry.first).toFixed(1)}s a run, about ${minutes(cost(entry.count, entry.first))}; what lives, by all ${String(entry.all.length)}, ${runs(entry.all).toFixed(1)}s a healthy run and about ${String(DRAG)} times that against a mutant`);
for (const file of unjudged) console.log(`  no test file executes ${file}, so no mutant of it can be killed; nothing is mutated there`);
console.log(`\nmutate: about ${minutes(first)} for the first pass, and about ${minutes(whole)} in all if ${String(SHARE * 100)} in a hundred mutants live into the second, which says its own cost once it knows`);
if (left.length > 0) console.log(`mutate: ${targets.join(' ')} passes the budget of ${minutes(BUDGET)}, so the rest waits. Type: npm run mutate -- ${left.join(' ')}`);
if (taking.length === 0) await die('nothing to mutate');

// The sandbox. The tree is never mutated; a copy of the package is, in
// place, where Stryker restores it and nobody reads it after.
const sandbox = join(dir, 'sandbox');
const box = join(sandbox, 'packages/nervur');
await mkdir(box, { recursive: true });
for (const name of ['src', 'test', 'dist', 'test.mjs', 'package.json', 'tsconfig.json', 'tsconfig.base.json', 'tsconfig.build.json', 'README.md', 'KIT-SPEC.md']) await cp(join(pkg, name), join(box, name), { recursive: true }).catch(() => undefined);
// What a test reads from outside the package: the verifier and its example
// kits, found by the walk up from the copy, as in any layout.
await symlink(QUO, join(sandbox, 'quo'));
await symlink(MODULES, join(sandbox, 'node_modules'));
// `nervur` by its own name resolves to the copy, not to the tree.
await mkdir(join(box, 'node_modules'), { recursive: true });
await symlink('..', join(box, 'node_modules/nervur'));

const stryker = join(MODULES, '@stryker-mutator/core/bin/stryker.js');
let passes = 0;

// One Stryker pass: `what` is the files or the mutation ranges to mutate,
// `by` the test files that judge them. It answers every mutant that lived.
const pass = async (what, by, note) => {
  const report = join(dir, `mutation-${String(passes)}.json`);
  const config = join(box, `mutate-${String(passes)}.json`);
  passes += 1;
  await writeFile(
    config,
    `${JSON.stringify(
      {
        testRunner: 'command',
        commandRunner: { command: `node test.mjs ${by.join(' ')}` },
        mutate: what,
        inPlace: true,
        coverageAnalysis: 'off',
        // `progress` so the wait is watchable, `json` so the survivors come
        // back as a file this script reads.
        reporters: ['progress', 'json'],
        jsonReporter: { fileName: report },
        concurrency: workers(by),
        timeoutMS: SLACK,
        tempDirName: join(dir, `stryker-${String(passes)}`),
        logLevel: 'warn',
      },
      null,
      2,
    )}\n`,
  );
  console.log(`\nmutate: ${note}`);
  const { code } = await run(process.execPath, [stryker, 'run', config], { cwd: box, stdio: 'inherit' });
  if (code !== 0) await die(`Stryker came back ${String(code)}`);
  const read = JSON.parse(await readFile(report, 'utf8'));
  const seen = [];
  for (const [file, held] of Object.entries(read.files)) {
    const lines = held.source.split('\n');
    for (const mutant of held.mutants) seen.push({ file, mutant, line: lines[mutant.location.start.line - 1] ?? '' });
  }
  return seen;
};

// A mutant is itself: its file, its place, what it changed and into what. A
// range holds every mutant of that place, and two mutants can share one, so
// a pass is read back by this and not by a count.
const which = ({ file, mutant }) => `${file}:${String(mutant.location.start.line)}:${String(mutant.location.start.column)}-${String(mutant.location.end.line)}:${String(mutant.location.end.column)} ${mutant.mutatorName} ${mutant.replacement}`;

// What no test went red on. A mutant Stryker could neither run nor judge is
// listed too, with its status, rather than passed over in silence.
const LIVING = ['Survived', 'NoCoverage', 'RuntimeError', 'CompileError'];
const alive = ({ mutant }) => LIVING.includes(mutant.status);

// A mutant that hung is caught: it changed what the code does enough to
// stop it. But a timeout is measured against the suite's own time, and four
// suites on one machine make each of them slower, so a run under load can
// call a mutant caught that nothing caught. The first pass therefore hands
// every timeout on to the second, where three mutants run alone and the
// clock is honest, and a timeout there is a kill.
const carried = (one) => alive(one) || one.mutant.status === 'Timeout';

// The first pass, one Stryker run for each set of quick judges, over the
// files that share it.
const started = Date.now();
const together = new Map();
for (const entry of taking) {
  const key = entry.first.join(' ');
  const held = together.get(key) ?? { by: entry.first, files: [], count: 0 };
  held.files.push(entry.file);
  held.count += entry.count;
  together.set(key, held);
}
const lived = [];
let tested = 0;
for (const held of together.values()) {
  const seen = await pass(held.files, held.by, `the first pass, ${String(held.count)} mutants of ${held.files.join(' ')} by ${String(held.by.length)} quick test file(s)`);
  tested += seen.length;
  lived.push(...seen.filter(carried));
}

// The second pass: what lived, judged by every toucher, one mutation range
// each. A range is the mutant's own place, and a place can hold more than
// one mutant, so the pass is read back by each mutant's own identity and
// not by a count. A mutant the second pass never judged is not called a
// survivor: the run stops and says so.
const survivors = [];
if (lived.length > 0) {
  const byJudges = new Map();
  for (const one of lived) {
    const entry = taking.find((each) => each.file === one.file);
    const key = entry.all.join(' ');
    const held = byJudges.get(key) ?? { by: entry.all, ranges: [], wanted: [], count: 0 };
    const place = one.mutant.location;
    // Whole lines, not the mutant's own columns: a range is read one way at
    // one end of Stryker and written another at the other, and a line is
    // the same number in both. What else the lines carry is judged again
    // and thrown away by the identity below.
    held.ranges.push(`${one.file}:${String(place.start.line)}:1-${String(place.end.line)}:${String(WIDE)}`);
    held.wanted.push(which(one));
    held.count += 1;
    byJudges.set(key, held);
  }
  const second = [...byJudges.values()].reduce((sum, held) => sum + cost(held.count, held.by), 0);
  console.log(`\nmutate: ${String(lived.length)} mutants lived the first pass, so the second costs about ${minutes(second)}`);
  for (const held of byJudges.values()) {
    const seen = await pass(held.ranges, held.by, `the second pass, ${String(held.count)} mutants by all ${String(held.by.length)} test file(s)`);
    const back = new Map(seen.map((one) => [which(one), one]));
    for (const wanted of held.wanted) if (!back.has(wanted)) await die(`the second pass never judged ${wanted}; nothing is called a survivor on that`);
    survivors.push(...held.wanted.map((wanted) => back.get(wanted)).filter(alive));
  }
}
const ran = (Date.now() - started) / 1000;

await rm(dir, { recursive: true, force: true });
clearTimeout(cap);

console.log(`\nmutate: ${String(tested)} mutants tested in ${minutes(ran)}, ${String(survivors.length)} survived\n`);
if (survivors.length === 0) {
  console.log('mutate: every mutant was caught. Nothing here asks for an assertion.');
  process.exit(0);
}
console.log('  The lines a test runs without reading. Each says what was changed, and nothing went red.\n');
let shown;
for (const { file, mutant, line } of survivors.sort((a, b) => (a.file === b.file ? a.mutant.location.start.line - b.mutant.location.start.line : a.file < b.file ? -1 : 1))) {
  if (shown !== file) console.log(`  ${file}`);
  shown = file;
  const how = mutant.status === 'Survived' ? '' : `  [${mutant.status}]`;
  console.log(`    ${String(mutant.location.start.line).padStart(4)}  ${mutant.mutatorName} to ${JSON.stringify(mutant.replacement)}${how}`);
  console.log(`          ${line.trim()}`);
}
// A survivor is a report, never a red: this carries no floor and gates
// nothing.
process.exit(0);
