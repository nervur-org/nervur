// SPDX-License-Identifier: Apache-2.0
// The package as a stranger meets it: packed, installed into an empty
// folder, and imported under plain Node, every entry handing over exactly
// the names its source exports.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { holds } from '../claims.ts';
import { DEFAULTS } from '../../src/kit.ts';
import { custodyScenes, expect, keeperScenes, lawScenes, memoryScenes, type Terrain } from '../../src/core/proof/index.ts';

const run = promisify(execFile);
const root = fileURLToPath(new URL('../../', import.meta.url));
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as { exports: Record<string, { types: string; default: string }> };
const scripts = (JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> }).scripts;
const SOURCE: Record<string, string> = { '.': '../../src/node.ts', './edge': '../../src/core/edge/index.ts', './browser': '../../src/core/browser/index.ts', './node': '../../src/core/node/index.ts', './folder': '../../src/core/folder/index.ts', './tcp': '../../src/core/tcp/index.ts', './http': '../../src/core/http/index.ts', './proof': '../../src/core/proof/index.ts' };

// The tarball installed once into a stranger's empty folder, for every
// test here that meets the package as she does.
let installing: Promise<string> | undefined;
const installed = (): Promise<string> =>
  (installing ??= (async () => {
    const dir = await mkdtemp(join(tmpdir(), 'nervur-package-'));
    // npm run hands its own settings down as npm_* variables; a stranger's
    // npm has none of them.
    const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('npm_'))), NPM_CONFIG_USERCONFIG: '/dev/null' };
    const { stdout } = await run('npm', ['pack', '--pack-destination', dir, '--ignore-scripts'], { cwd: root, env });
    const tarball = join(dir, stdout.trim().split('\n').at(-1)!);
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'stranger', private: true, type: 'module' }));
    await run('npm', ['install', tarball, '--no-audit', '--no-fund', '--ignore-scripts'], { cwd: dir, env });
    return dir;
  })());
after(async () => {
  if (installing) await rm(await installing, { recursive: true, force: true });
});

// A body of the stranger's own, a memory in a Map and a custody holding one
// drawn seed, held to the shipped suites and the law by her own runner.
const STRANGER = `import { Custody, DEFAULTS, Memory } from 'nervur';
import { custodyScenes, expect, keeperScenes, lawScenes, memoryScenes } from 'nervur/proof';
class MapMemory extends Memory {
  constructor(keeping) { super(); this.keeping = keeping; }
  async read(place) { return new Map([...(this.keeping.get(place) ?? [])].map(([n, b]) => [n, b.slice()])); }
  async write(place, entries) {
    const held = new Map(this.keeping.get(place) ?? []);
    for (const [n, b] of entries) b === null ? held.delete(n) : held.set(n, b.slice());
    held.size ? this.keeping.set(place, held) : this.keeping.delete(place);
  }
  async places() { return [...this.keeping.keys()]; }
  async forget(place) { this.keeping.delete(place); }
}
class DrawnCustody extends Custody {
  constructor(kept) { super(); this.kept = kept; }
  async seed() { this.kept.seed ??= crypto.getRandomValues(new Uint8Array(32)); return this.kept.seed.slice(); }
}
const two = (make) => { const k = make(); return () => [k(), k()]; };
const memories = () => { const keeping = new Map(); return () => new MapMemory(keeping); };
const custodies = () => { const kept = {}; return () => new DrawnCustody(kept); };
const scenes = [
  ...memoryScenes('MapMemory', () => { const m = memories(); return [m(), m()]; }, expect),
  ...custodyScenes('DrawnCustody', () => { const c = custodies(); return [c(), c()]; }, expect),
  ...lawScenes({ name: 'a stranger', make: () => ({ custody: custodies()(), memory: memories()() }), again: (b) => b, defaults: DEFAULTS }, expect),
  ...keeperScenes({ name: 'a stranger', make: () => ({ custody: custodies()(), memory: memories()() }), again: (b) => b, defaults: DEFAULTS }, expect),
];
for (const [, scene] of scenes) await scene();
console.log(JSON.stringify(scenes.map(([name]) => name)));
`;

// The scenes the installed package must run: every one the tree's own
// proof builds for those same names, and no fewer.
const stranger: Terrain = { name: 'a stranger', make: () => ({}) as never, again: (b) => b, defaults: DEFAULTS };
const SCENES = [...memoryScenes('MapMemory', () => [] as never, expect), ...custodyScenes('DrawnCustody', () => [] as never, expect), ...lawScenes(stranger, expect), ...keeperScenes(stranger, expect)].map(([name]) => name);

test(holds('proof.exported', "package: a stranger's own bodies pass the shipped suites and the law, run by her own code"), { timeout: 120_000 }, async () => {
  const dir = await installed();
  await writeFile(join(dir, 'stranger.mjs'), STRANGER);
  const { stdout } = await run(process.execPath, ['stranger.mjs'], { cwd: dir });
  assert.deepEqual(JSON.parse(stdout), SCENES);
});

test(holds('ships.entries', 'package: the tarball installs into an empty folder and every entry imports its names'), { timeout: 120_000 }, async () => {
  assert.deepEqual(Object.keys(pkg.exports).sort(), [...Object.keys(SOURCE), './edge/kit'].sort());
  const dir = await installed();
  {
    // The kit as one module's text: a module that hands over the Workers
    // entry's names and the edge ground's, as an edge's child imports it.
    const write = 'import kit from "nervur/edge/kit"; import { writeFileSync } from "node:fs"; writeFileSync("kit.mjs", kit);';
    await run(process.execPath, ['--input-type=module', '-e', write], { cwd: dir });
    const { stdout: kitNames } = await run(process.execPath, ['--input-type=module', '-e', 'import * as m from "./kit.mjs"; console.log(Object.keys(m).sort().join(","));'], { cwd: dir });
    const kitMine = [...new Set([...Object.keys((await import('../../src/edge.ts')) as object), ...Object.keys((await import('../../src/core/edge/index.ts')) as object)])].sort();
    assert.deepEqual(kitNames.trim().split(','), kitMine, 'nervur/edge/kit is the Workers entry and the edge ground');
    for (const [entry, source] of Object.entries(SOURCE)) {
      const specifier = entry === '.' ? 'nervur' : `nervur/${entry.slice(2)}`;
      const probe = `import * as m from ${JSON.stringify(specifier)}; console.log(Object.keys(m).sort().join(','));`;
      const { stdout: names } = await run(process.execPath, ['--input-type=module', '-e', probe], { cwd: dir });
      const mine = Object.keys((await import(source)) as object).sort();
      assert.deepEqual(names.trim().split(','), mine, `${specifier} hands over other names than its source`);
      assert.ok(await readFile(join(dir, 'node_modules', 'nervur', pkg.exports[entry]!.types), 'utf8'));
    }
    const probe = 'import { grounds } from "nervur"; console.log(grounds().join(","));';
    const { stdout: known } = await run(process.execPath, ['--input-type=module', '-e', probe], { cwd: dir });
    assert.equal(known.trim(), 'node,neutral', 'Node reads the entry that adds its ground');
    const harbor = join(dir, 'harbor');
    const { stdout: made } = await run(join(dir, 'node_modules', '.bin', 'nervur'), ['init', '--dir', harbor], { cwd: dir });
    assert.match(made, /^\{"pk":"[0-9a-f]{128}","owner":\{/);
  }
});

test(holds('proof.release-only', 'package: a publish outside the gated release is refused before it packs'), async () => {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'NERVUR_GATED'));
  await assert.rejects(run('sh', ['-c', scripts.prepublishOnly!], { env }), (e: { code?: number }) => e.code === 1);
  await run('sh', ['-c', scripts.prepublishOnly!], { env: { ...env, NERVUR_GATED: '1' } });
});
