// SPDX-License-Identifier: Apache-2.0
// The exercise, bundled as a stranger's bundler would for a neutral
// platform, and handed to each engine on this machine. Node runs it
// natively as the reference, and every engine must report the same scenes,
// all green.
import { build, type Plugin } from 'esbuild';
import { kitText } from '../../kit.mjs';
import { LAW } from '../../src/core/proof/index.ts';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Reach, Result } from './exercise.ts';
import { covering, takeWorkerd, watchChromium } from './coverage.ts';
import { bin, PKG } from '../where.mjs';
import { records } from '../records.ts';

const repo = PKG;
export const has = (name: string): boolean => existsSync(bin(name));

// An edge bundle also holds the two kits its children run, as text.
export type Bundle = { code: string; dir: string; kits?: { kit: string; scenes: string }; dispose(): Promise<void> };

// The exercise, hung on the global so a page or a worker can call it, and
// minified, so every class loses its name as a stranger's bundle loses it.
// A browser bundle reads the browser entry too, as a bundler for the
// browser picks it, and an edge bundle the edge entry, exporting the
// worker and its Durable Object classes.
const here = (path: string): string => JSON.stringify(fileURLToPath(new URL(path, import.meta.url)));
const entries = {
  neutral: `import { run } from ${here('./exercise.ts')};\nglobalThis.nervurTerrain = run;\n`,
  browser: `import ${here('../../src/browser.ts')};\nimport * as law from 'nervur:law';\nimport { run, worker } from ${here('./exercise.ts')};\nObject.assign(globalThis, { nervurTerrain: run, nervurWorker: worker });\nif (typeof document === 'undefined') globalThis.nervurLaw = law;\n`,
  edge: `import ${here('../../src/edge.ts')};\nimport { run } from ${here('./exercise.ts')};\nimport { EdgeExercise, Harbors, worker } from ${here('./shell.ts')};\nexport { EdgeExercise, Harbors };\nexport default worker(run);\n`,
};

// The law's module built by the bundler from its source, as a service
// worker carries it: `nervur:law` is that source, and its `'nervur'` the
// kit the bundle holds.
const kit = fileURLToPath(new URL('../../src/index.ts', import.meta.url));
// The arithmetic records, which every engine reproduces. `test/records.ts`
// reads them from `quo/` with the file system, which a browser and an edge
// do not have, so the bundle gets the records themselves in its place.
const recordsModule: Plugin = {
  name: 'nervur-records',
  setup(b) {
    b.onLoad({ filter: /[/\\]test[/\\]records\.ts$/ }, () => ({ contents: `export const records = ${JSON.stringify(records)};`, loader: 'js' }));
  },
};

const lawModule: Plugin = {
  name: 'nervur-law',
  setup(b) {
    b.onResolve({ filter: /^nervur:law$/ }, () => ({ path: 'law', namespace: 'nervur-law' }));
    b.onResolve({ filter: /^nervur$/, namespace: 'nervur-law' }, () => ({ path: kit }));
    b.onLoad({ filter: /.*/, namespace: 'nervur-law' }, () => ({ contents: LAW, loader: 'js' }));
  },
};

// The two kits an edge's children run, as `nervur:kit` and
// `nervur:scenes-kit` text: the kit built from the source as
// `nervur/edge/kit` is built from `dist/`, and the same with the edge
// scenes inside.
const kits = async (): Promise<{ plugin: Plugin; kit: string; scenes: string }> => {
  const parts = { edge: fileURLToPath(new URL('../../src/edge.ts', import.meta.url)), ground: fileURLToPath(new URL('../../src/core/edge/index.ts', import.meta.url)), resolveDir: repo, minify: !covering(), sourcemap: covering() !== undefined };
  const [plain, scenes] = await Promise.all([kitText(parts), kitText({ ...parts, plugins: [lawModule], extra: `export { EdgeScenes } from ${here('./edge.ts')};\n` })]);
  const texts: Record<string, string> = { 'nervur:kit': plain, 'nervur:scenes-kit': scenes };
  return {
    plugin: {
      name: 'nervur-kits',
      setup(b) {
        b.onResolve({ filter: /^nervur:(scenes-)?kit$/ }, (a) => ({ path: a.path, namespace: 'nervur-kits' }));
        b.onLoad({ filter: /.*/, namespace: 'nervur-kits' }, (a) => ({ contents: `export default ${JSON.stringify(texts[a.path])};`, loader: 'js' }));
      },
    },
    kit: plain,
    scenes,
  };
};

export const bundle = async (target: keyof typeof entries = 'neutral'): Promise<Bundle> => {
  const dir = await mkdtemp(join(tmpdir(), 'nervur-terrain-'));
  const entry = join(dir, 'entry.ts');
  await writeFile(entry, entries[target]);
  // Under `cover` the bundle carries its own map, so an engine's ranges
  // map back to `src/`, and it is not minified: a minified function's
  // entry maps onto another declaration, so its functions would be
  // counted where they are not. `deep` runs the minified bundle, which
  // proves a harbor wakes whose classes lost their names. The map's
  // sources are relative to the repository root, which `absWorkingDir`
  // fixes.
  const edge = target === 'edge' ? await kits() : undefined;
  const plugins = edge ? [recordsModule, lawModule, edge.plugin] : [recordsModule, lawModule];
  const out = await build({ entryPoints: [entry], plugins, bundle: true, format: 'esm', platform: 'neutral', mainFields: ['module', 'main'], conditions: ['import', 'default'], target: 'es2023', external: ['cloudflare:*'], minify: !covering(), write: false, absWorkingDir: repo, ...(covering() ? { sourcemap: 'inline' as const } : {}) });
  return { code: out.outputFiles[0]!.text, dir, ...(edge ? { kits: { kit: edge.kit, scenes: edge.scenes } } : {}), dispose: () => rm(dir, { recursive: true, force: true }) };
};

const MARK = 'NERVUR';
const script = (b: Bundle, reach: Reach) => `${b.code}\nconsole.log(${JSON.stringify(MARK)} + JSON.stringify(await globalThis.nervurTerrain(${JSON.stringify(reach)})));\n`;

// How long an engine may take to run the exercise before it is killed.
export const DEADLINE = 30_000;

const lineFrom = (command: string, args: string[]): Promise<Result[]> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${command} ran past ${DEADLINE} ms: ${err.slice(0, 2000)}`));
    }, DEADLINE);
    child.stdout.on('data', (d: Buffer) => (out += d.toString()));
    child.stderr.on('data', (d: Buffer) => (err += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      const line = out.split('\n').find((l) => l.startsWith(MARK));
      if (line) resolve(JSON.parse(line.slice(MARK.length)) as Result[]);
      else reject(new Error(`${command} answered nothing (exit ${String(code)}): ${err.slice(0, 2000)}`));
    });
  });

// A script engine: the bundle and one call, one line of JSON back.
export const inScript = async (b: Bundle, reach: Reach, command: string, args: string[]): Promise<Result[]> => {
  const file = join(b.dir, `${command.split('/').at(-1)}.mjs`);
  await writeFile(file, script(b, reach));
  return lineFrom(command, [...args, file]);
};

export const inNode = (b: Bundle, reach: Reach) => inScript(b, reach, process.execPath, []);
export const inDeno = (b: Bundle, reach: Reach) => inScript(b, reach, bin('deno'), ['run', '--quiet', '--allow-net=127.0.0.1']);
export const inBun = (b: Bundle, reach: Reach) => inScript(b, reach, bin('bun'), ['run']);

const freePort = async (): Promise<number> => {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((done) => server.close(() => done()));
  return port;
};

// workerd: the edge bundle as a worker, its Durable Objects kept on this
// machine's disk under a secret binding, with a Worker Loader for their
// children, reaching the Node host through a network service that allows
// this machine. The worker runs the exercise, then the edge scenes in a
// child of an object, then hands Node the worker's base URL and a restart
// that keeps the port and the disk.
export type Restart = () => Promise<void>;
export const SECRET = 'a secret the terrain run binds';

const workerdConfig = (port: number, objects: string, texts: Record<string, string>) => `using Workerd = import "/workerd/workerd.capnp";
const config :Workerd.Config = (
  services = [
    (name = "main", worker = .nervur),
    (name = "net", network = (allow = ["public", "private", "local"])),
    (name = "disk", disk = (path = ${JSON.stringify(objects)}, writable = true)),
  ],
  sockets = [ (name = "http", address = "127.0.0.1:${String(port)}", http = (), service = "main") ],
);
const nervur :Workerd.Worker = (
  modules = [ (name = "worker", esModule = embed "worker.js") ],
  compatibilityDate = "2025-09-01",
  globalOutbound = "net",
  durableObjectNamespaces = [
    (className = "EdgeExercise", uniqueKey = "nervur-exercise"),
    (className = "Harbors", uniqueKey = "nervur-harbors"),
  ],
  durableObjectStorage = (localDisk = "disk"),
  bindings = [
    (name = "EXERCISE", durableObjectNamespace = "EdgeExercise"),
    (name = "HARBOR", durableObjectNamespace = "Harbors"),
    (name = "LOADER", workerLoader = ()),
    (name = "NERVUR_SECRET", text = ${JSON.stringify(SECRET)}),
${Object.entries(texts)
  .map(([name, text]) => `    (name = ${JSON.stringify(name)}, text = ${JSON.stringify(text)}),\n`)
  .join('')}  ],
);
`;

// `node` is what Node does around the worker: `prepare` gives the text
// bindings the worker starts with, knowing where it will be reached, and
// `after` asks it once it runs, with a restart to hand.
export type AroundWorker = {
  prepare(base: string): Promise<Record<string, string>>;
  after(base: string, restart: Restart): Promise<Result[]>;
};

export const inWorkerd = async (b: Bundle, reach: Reach, edgeReach: Reach, node: AroundWorker): Promise<Result[]> => {
  const port = await freePort();
  const base = `http://127.0.0.1:${String(port)}`;
  await writeFile(join(b.dir, 'worker.js'), b.code);
  const objects = join(b.dir, 'objects');
  await writeFile(join(b.dir, 'nervur.capnp'), workerdConfig(port, objects, await node.prepare(base)));
  await mkdir(objects, { recursive: true });
  let child: ChildProcess | undefined;
  let err = '';
  // Under `cover` the inspector is opened, and the isolate is asked what
  // it ran just before it is killed, since a restart loses it.
  let inspector: number | undefined;
  // workerd says nothing when its socket opens, so the first fetch that
  // connects is the sign; a refused one is tried again at once, bounded by
  // the run's deadline, and an exit ends it.
  const start = async (): Promise<void> => {
    inspector = covering() ? await freePort() : undefined;
    // The Worker Loader is in beta, and workerd serves it behind
    // `--experimental`.
    const started = spawn(bin('workerd'), ['serve', '--experimental', ...(inspector ? [`-i127.0.0.1:${String(inspector)}`] : []), join(b.dir, 'nervur.capnp')], { cwd: b.dir, stdio: ['ignore', 'ignore', 'pipe'] });
    child = started;
    started.stderr.on('data', (d: Buffer) => (err += d.toString()));
    const exited = new Promise<never>((_, reject) => started.once('exit', () => reject(new Error(`workerd exited: ${err}`))));
    const deadline = Date.now() + DEADLINE;
    while (Date.now() < deadline) {
      const res = await Promise.race([exited, fetch(`${base}/ready`).catch(() => undefined)]);
      if (res) return;
      await new Promise((r) => setImmediate(r));
    }
    throw new Error(`workerd never answered: ${err}`);
  };
  const stop = async (): Promise<void> => {
    const running = child;
    child = undefined;
    if (!running || running.exitCode !== null) return;
    if (inspector) await takeWorkerd(inspector, b.code, b.kits ?? { kit: '', scenes: '' }, Date.now() + DEADLINE);
    // Killed outright, as an object's host dies: workerd drains its held
    // lines on a gentler signal.
    const gone = new Promise((done) => running.once('exit', done));
    running.kill('SIGKILL');
    await gone;
  };
  const post = async (path: string, body: Reach): Promise<Result[]> => {
    try {
      return (await (await fetch(`${base}${path}`, { method: 'POST', body: JSON.stringify(body), signal: AbortSignal.timeout(DEADLINE) })).json()) as Result[];
    } catch (e) {
      throw new Error(`${path}: ${String(e)}`, { cause: e });
    }
  };
  try {
    await start();
    const results = await post('/', reach);
    results.push(...(await post('/edge?run=one', edgeReach)));
    results.push(
      ...(await node.after(base, async () => {
        await stop();
        await start();
      })),
    );
    // A scene that failed carries what workerd said.
    return results.map((r) => (r.error ? { ...r, error: `${r.error}\nworkerd: ${err.slice(-4000)}` } : r));
  } catch (e) {
    // And so does a run that broke.
    throw new Error(`${String(e)}\nworkerd: ${err.slice(-4000)}`, { cause: e });
  } finally {
    await stop();
  }
};

// Chromium: the bundle as a module in a page on localhost, a secure context.
// A browser bundle is also served as a shared worker's script and a service
// worker's.
export const inChromium = async (b: Bundle, reach: Reach): Promise<Result[]> => {
  const { chromium } = await import('playwright');
  const workerScript = `${b.code}\nglobalThis.nervurWorker(new URL(location.href).searchParams.get('where'));\n`;
  const server = createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (path === '/nervur.js' || path === '/worker.js' || path === '/sw.js') {
      res.writeHead(200, { 'content-type': 'text/javascript' });
      res.end(path === '/nervur.js' ? b.code : workerScript);
    } else {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<!doctype html><meta charset="utf-8"><script type="module" src="/nervur.js"></script>');
    }
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  // Under `cover` a debugging port is opened beside Playwright's own pipe,
  // and the browser target is watched from before the first page exists,
  // because a page's session never sees a shared or a service worker.
  const port = covering() ? await freePort() : undefined;
  const browser = await chromium.launch({ timeout: DEADLINE, ...(port ? { args: [`--remote-debugging-port=${String(port)}`] } : {}) });
  const harvest = port ? await watchChromium(port, b.code, Date.now() + DEADLINE) : undefined;
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(DEADLINE);
    await page.goto(`http://localhost:${(server.address() as AddressInfo).port}/`);
    await page.waitForFunction('typeof globalThis.nervurTerrain === "function"', undefined, { timeout: 10_000 });
    return (await page.evaluate(`globalThis.nervurTerrain(${JSON.stringify(reach)})`)) as Result[];
  } finally {
    if (harvest) await harvest();
    await browser.close();
    server.close();
  }
};
