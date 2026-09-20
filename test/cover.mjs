// SPDX-License-Identifier: Apache-2.0
// `cover`: what the source ran, counted in every engine a ground stands
// on, not in Node alone.
//
// Three runs, one count. The core, defaults and kit suites run under
// NODE_V8_COVERAGE, and so does the terrain suite, which also hands
// Chromium and workerd the bundle with an inline source map and asks each
// engine's own V8 what it ran (`test/terrain/coverage.ts` holds how). The
// ranges of the minified bundle map back through that source map to
// `src/`, Node's own map back to the files it ran, and
// `istanbul-lib-coverage` merges the lot into one number per layer of the
// paper's layer list.
//
// Two things the engines decide. Chromium answers precise coverage with
// real block ranges, so its lines, branches and functions all count.
// workerd's inspector refuses `Profiler.enable`, so its best effort, asked
// of the worker's isolate and of each child the Worker Loader made, each
// its own target, answers one range per function and a blanket range over
// the top level:
// its function counts are honest and its line and branch numbers are
// thrown away here, which is why `edge/` carries a floor of functions
// alone and stands outside the overall line and branch count.
//
// The count is filtered after the mapping, never before, so what a
// bundle dragged in from `node_modules` drops out and only `src/` counts.
//
// The run behaves as `test.mjs` and `gate.mjs` do: each step in its own
// process group, the first red the end of it, the whole thing capped, and
// nothing left running. Nothing waits on a clock to prove anything.
import libCoverage from 'istanbul-lib-coverage';
import v8toIstanbul from 'v8-to-istanbul';
import { spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PKG } from './where.mjs';

const pkg = fileURLToPath(new URL('..', import.meta.url));
const repo = PKG;
const SRC = join(pkg, 'src/');
const CAP = Number(process.env.NERVUR_COVER_CAP ?? 600_000);

// The floors, one visible table. A floor stands about a point under what
// the merged run measures, and only rises, as the work raises it: it is
// there to stop a slide and is never chased. `null` is a number no engine
// of that layer reports, so it is neither floored nor counted in the
// overall line and branch total.
const FLOORS = {
  '(root)': { lines: 99, branches: 99, functions: 99 },
  'crypto/': { lines: 99, branches: 99, functions: 99 },
  'git/': { lines: 98, branches: 99, functions: 98 },
  'quo/': { lines: 99, branches: 99, functions: 99 },
  'contract/': { lines: 99, branches: 99, functions: 99 },
  'being/': { lines: 99, branches: 99, functions: 99 },
  'ward/': { lines: 98, branches: 99, functions: 99 },
  'harbor/': { lines: 99, branches: 99, functions: 99 },
  'defaults/': { lines: 99, branches: 99, functions: 99 },
  'pointer/': { lines: 99, branches: 99, functions: 99 },
  'proof/': { lines: 99, branches: 99, functions: 98 },
  'line/': { lines: 98, branches: 99, functions: 99 },
  'folder/': { lines: 98, branches: 99, functions: 99 },
  'tcp/': { lines: 99, branches: 99, functions: 99 },
  'http/': { lines: 99, branches: 99, functions: 99 },
  'node/': { lines: 97, branches: 99, functions: 99 },
  // The browser ground's error arrows, an `onerror` that rejects and the
  // like, are functions Chromium never enters, and a scene that made it
  // enter them would be a scene written for the number.
  'browser/': { lines: 98, branches: 99, functions: 94 },
  // workerd offers nothing beside which functions ran: no precise
  // coverage, so no line and no branch number of the edge ground is
  // worth a floor. Its count is the shell's isolate and every child's the
  // Worker Loader made, where the harbor itself runs. A function it runs
  // as the module loads, before its inspector watches, reads as never
  // entered.
  'edge/': { lines: null, branches: null, functions: 93 },
  'cli/': { lines: 99, branches: 97, functions: 99 },
};

// The verifier's own stand program, which the verifier judges.
const OUTSIDE = ['stand/'];

// The overall floor over everything counted, the whole-source intent.
const WHOLE = { lines: 99, branches: 99, functions: 98 };

// One step, in its own process group, and a red one ends the run here.
let running;
const kill = () => {
  if (!running) return;
  try {
    process.kill(-running.pid, 'SIGKILL');
  } catch {
    running.kill('SIGKILL');
  }
};
process.on('SIGINT', () => {
  kill();
  process.exit(130);
});
const cap = setTimeout(() => {
  console.log(`cover: red, the run passed ${CAP / 1000}s and was killed`);
  kill();
  process.exit(1);
}, CAP);

// `node test/cover.mjs <dir>` keeps every raw payload in that directory,
// for a look at what one engine said; named nothing, it keeps none.
const keeping = process.argv[2];
const dir = keeping ?? (await mkdtemp(join(tmpdir(), 'nervur-cover-')));
const step = (what, env, files) =>
  new Promise((resolve) => {
    console.log(`cover: ${what}`);
    running = spawn(process.execPath, [join(pkg, 'test.mjs'), ...files], { cwd: pkg, stdio: 'inherit', detached: true, env: { ...process.env, ...env, NODE_V8_COVERAGE: dir } });
    running.on('close', (code) => {
      running = undefined;
      if (code === 0) return resolve();
      console.log(`cover: red at ${what}`);
      kill();
      process.exit(1);
    });
  });

const started = Date.now();
await step('the core, defaults and kit suites', {}, ['test/core/**/*.test.ts', 'test/defaults/**/*.test.ts', 'test/kit/*.test.ts']);
await step('the terrain suites, with Chromium and workerd watched', { NERVUR_COVER: dir }, ['test/terrain/*.test.ts']);
const ran = (Date.now() - started) / 1000;

// Lines and branches merge as istanbul merges them, and only from an
// engine whose ranges are precise.
const map = libCoverage.createCoverageMap({});

// Functions are counted apart from them, because a function cannot be
// merged across runs the way a line can. A line's unmatched range is
// credited to the range that contains it, so Node's run and Chromium's
// add up; a function is matched on its span, and the span of a minified
// function maps back a character or two off and sometimes onto the
// neighbouring line, so one source function would stand twice, entered
// in one run and never entered in the other.
//
// So a file's functions are read from the one run that entered the
// largest share of them: Node's for the layers Node runs, Chromium's for
// the browser ground and workerd's for the edge, each of which no other
// engine can stand. A function only another run entered is not credited,
// which errs low, as a floor should.
//
// Inside one run a function is itself: the same source, the same
// positions, so every process of that run adds up, keyed by where the
// function is declared.
const fns = new Map();
const tally = (file, run, data) => {
  const runs = fns.get(file) ?? new Map();
  const held = runs.get(run) ?? new Map();
  for (const [key, fn] of Object.entries(data.fnMap)) {
    const at = `${String(fn.decl.start.line)}:${String(fn.decl.start.column)}`;
    held.set(at, (held.get(at) ?? false) || data.f[key] > 0);
  }
  runs.set(run, held);
  fns.set(file, runs);
};

// The run that entered the largest share of a file's functions.
const bestRun = (runs) => {
  let best = { total: 0, covered: 0, run: '', missed: [] };
  for (const [run, held] of runs) {
    const mine = { total: held.size, covered: [...held.values()].filter(Boolean).length, run, missed: [...held].filter(([, entered]) => !entered).map(([at]) => at) };
    if (mine.total === 0) continue;
    if (best.total === 0 || mine.covered / mine.total > best.covered / best.total || (mine.covered / mine.total === best.covered / best.total && mine.total > best.total)) best = mine;
  }
  return best;
};

const feed = async (run, path, source, functions, precise) => {
  const converter = v8toIstanbul(path, 0, source ? { source } : undefined);
  await converter.load();
  converter.applyCoverage(functions);
  for (const [file, data] of Object.entries(converter.toIstanbul())) {
    if (!file.startsWith(SRC)) continue;
    tally(file, run, data);
    if (precise) map.merge({ [file]: data });
  }
  converter.destroy();
};

for (const name of await readdir(dir)) {
  const payload = JSON.parse(await readFile(join(dir, name), 'utf8'));
  if (name.startsWith('engine-')) {
    // A bundle's ranges, mapped by the map inside the bundle. The path is
    // only what the map's relative sources resolve against, so it is the
    // repository root and need not exist.
    const at = join(repo, `${payload.engine}-bundle.js`);
    for (const script of payload.scripts) await feed(payload.engine, at, payload.source, script.functions, payload.precise);
    continue;
  }
  for (const script of payload.result ?? []) {
    if (!script.url.startsWith('file://')) continue;
    const at = fileURLToPath(script.url);
    if (!at.startsWith(SRC)) continue;
    await feed('node', at, undefined, script.functions, true);
  }
}

// Every file of the source, whether it ran anywhere or not: a file no
// engine loaded is a hole, and a hole counts.
const sources = [];
const walk = async (at) => {
  for (const entry of await readdir(at, { withFileTypes: true })) {
    if (entry.isDirectory()) await walk(join(at, entry.name));
    else if (entry.name.endsWith('.ts')) sources.push(join(at, entry.name));
  }
};
await walk(SRC);

const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// A file's layer: the folder under `core/` it sits in, `defaults/`, or the
// entries straight under `src/`.
const layerOf = (file) => {
  const parts = file.slice(SRC.length).split('/');
  if (parts[0] === 'core' && parts.length > 2) return `${parts[1]}/`;
  return parts.length > 1 ? `${parts[0]}/` : '(root)';
};

// One layer's three counts, each a total and how much of it ran.
const zero = () => ({ lines: { total: 0, covered: 0 }, branches: { total: 0, covered: 0 }, functions: { total: 0, covered: 0 } });
const add = (into, metric, of) => {
  into[metric].total += of.total;
  into[metric].covered += of.covered;
};

const layers = new Map();
const missing = [];
// Each file's functions its best run never entered, by line and column,
// so a red floor of functions is read as the functions and not a number.
const unentered = new Map();
for (const file of sources.sort(byName)) {
  const layer = layerOf(file);
  if (OUTSIDE.includes(layer)) continue;
  if (!fns.has(file)) {
    missing.push(file.slice(SRC.length));
    continue;
  }
  const counts = layers.get(layer) ?? zero();
  if (map.files().includes(file)) {
    const summary = map.fileCoverageFor(file).toSummary();
    add(counts, 'lines', summary.lines);
    add(counts, 'branches', summary.branches);
  }
  const best = bestRun(fns.get(file));
  add(counts, 'functions', best);
  if (best.missed.length) unentered.set(file.slice(SRC.length), best);
  layers.set(layer, counts);
}

const whole = zero();
const pct = (counts, metric) => (counts[metric].total === 0 ? 100 : (counts[metric].covered / counts[metric].total) * 100);

const red = [];
const show = (n) => `${n.toFixed(2)}%`.padStart(7);
console.log(`\ncover: ${String(sources.length - missing.length)} files of src/ counted, ${String(sources.length)} in the tree, in ${ran.toFixed(1)}s\n`);
console.log('  layer        lines            branches         functions');
for (const layer of layers.keys()) if (!FLOORS[layer]) throw new Error(`cover: no floor names the layer ${layer}`);
// The paper's order, which is the order a layer may import in.
for (const [layer, floors] of Object.entries(FLOORS)) {
  const counts = layers.get(layer);
  if (!counts) throw new Error(`cover: the floor names the layer ${layer}, which the source has not`);
  const cells = [];
  for (const metric of ['lines', 'branches', 'functions']) {
    const floor = floors[metric];
    if (floor === null) {
      cells.push('  -               ');
      continue;
    }
    const measured = pct(counts, metric);
    add(whole, metric, counts[metric]);
    if (measured < floor) red.push(`${layer} ${metric} ${measured.toFixed(2)}% under its floor of ${String(floor)}%`);
    cells.push(`${show(measured)} of ${String(floor).padEnd(3)}${measured < floor ? ' RED ' : '     '}`);
  }
  console.log(`  ${layer.padEnd(11)}${cells.join('')}`);
}
const totals = [];
for (const metric of ['lines', 'branches', 'functions']) {
  const measured = pct(whole, metric);
  if (measured < WHOLE[metric]) red.push(`the whole source's ${metric} ${measured.toFixed(2)}% under its floor of ${String(WHOLE[metric])}%`);
  totals.push(`${metric} ${show(measured)} of ${String(WHOLE[metric])}`);
}
console.log(`\n  the whole source, ${OUTSIDE.join(' and ')} aside: ${totals.join('   ')}`);
if (missing.length) red.push(`nothing loaded ${String(missing.length)} file(s) of src/: ${missing.join(', ')}`);

if (!keeping) await rm(dir, { recursive: true, force: true });
clearTimeout(cap);
if (red.length === 0) {
  console.log('\ncover: green');
  process.exit(0);
}
for (const line of red) console.log(`cover: ${line}`);
for (const [file, best] of unentered) {
  if (!red.some((line) => line.startsWith(`${layerOf(SRC + file)} functions`))) continue;
  console.log(`cover: ${file}, by ${best.run}, never entered the functions at ${best.missed.join(' ')}`);
}
console.log('\ncover: red');
process.exit(1);
