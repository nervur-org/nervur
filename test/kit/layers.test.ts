// SPDX-License-Identifier: Apache-2.0
// The layers of `papers/nervur-explained.md`: each imports only the layers
// above it in the list, and only `folder/`, `tcp/`, `http/`, `node/`,
// `browser/`, `edge/`, `cli/` and `stand/` name a platform. A file
// straight under `src/` is an entry, the one place the core and the
// defaults meet, and may import any layer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Being } from '../../src/core/being/index.ts';
import * as defaults from '../../src/defaults/index.ts';
import { Dock, Harbor } from '../../src/core/harbor/index.ts';
import { PointerTerrain } from '../../src/core/pointer/index.ts';
import { Ward } from '../../src/core/ward/index.ts';
import { holds } from '../claims.ts';

// The core's layers in their order, then `defaults`, last, so no layer of
// the core can import a default.
const LAYERS = ['crypto', 'git', 'quo', 'contract', 'being', 'ward', 'harbor', 'pointer', 'proof', 'line', 'folder', 'tcp', 'http', 'node', 'browser', 'edge', 'cli', 'stand', 'defaults'];
const PLATFORM = ['folder', 'tcp', 'http', 'node', 'browser', 'edge', 'cli', 'stand'];
const src = fileURLToPath(new URL('../../src/', import.meta.url));

const sources = async (): Promise<string[]> => (await readdir(src, { recursive: true })).filter((f) => f.endsWith('.ts')).map((f) => join(src, f));
// A file's layer: the folder under `core/` it sits in, or `defaults`, or
// none for an entry straight under `src/`.
const layerOf = (file: string): string | undefined => {
  const parts = relative(src, file).split(sep);
  if (parts[0] === 'core' && parts.length > 2) return parts[1];
  return parts.length > 1 ? parts[0] : undefined;
};
// A module's source inside a template literal, as the law's is, imports
// nothing of the file that holds it.
const imports = (text: string): string[] => [...text.replaceAll(/`(?:[^`\\]|\\.)*`/g, '``').matchAll(/^\s*(?:import|export)\b[^'"]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]!);

test(holds('kit.floor', 'layers: the source imports nothing from quo/ nor from beyond its own tree, save its two dependencies and the platform'), async () => {
  for (const file of await sources()) {
    for (const spec of imports(await readFile(file, 'utf8'))) {
      if (spec.startsWith('.')) assert.ok(!relative(src, join(dirname(file), spec)).startsWith('..'), `${relative(src, file)} imports ${spec}, outside src`);
      else assert.ok(spec.startsWith('node:') || spec.startsWith('@noble/post-quantum/') || spec.startsWith('@noble/curves/'), `${relative(src, file)} imports ${spec}`);
    }
  }
});

test(holds('layers.named', 'layers: every folder under src is a layer the paper names'), async () => {
  for (const file of await sources()) {
    const layer = layerOf(file);
    if (layer !== undefined) assert.ok(LAYERS.includes(layer), `${relative(src, file)} is in no layer`);
  }
});

test(holds('layers.order', 'layers: a layer imports only itself and the layers above it'), async () => {
  for (const file of await sources()) {
    const layer = layerOf(file);
    if (layer === undefined) continue;
    for (const spec of imports(await readFile(file, 'utf8'))) {
      if (!spec.startsWith('.')) continue;
      const target = layerOf(join(dirname(file), spec));
      assert.ok(target !== undefined, `${relative(src, file)} imports an entry, ${spec}`);
      assert.ok(LAYERS.indexOf(target) <= LAYERS.indexOf(layer), `${relative(src, file)} in ${layer} imports ${target}, below it`);
    }
  }
});

// A platform's own names, which no engine but one carries. Comments and
// strings are read past. An `import()` is the language's, and the
// pointer's loader imports the URL it makes of a module's source.
const PLATFORM_NAMES = [/\bprocess\./, /\bBuffer\b/, /\bDeno\b/, /\bBun\b/, /\brequire\(/, /\b__dirname\b/, /\bwindow\b/, /\bdocument\b/, /\bimport\.meta\b/];
const code = (text: string): string =>
  text
    .replaceAll(/\/\*[\s\S]*?\*\//g, ' ')
    .replaceAll(/\/\/.*$/gm, ' ')
    .replaceAll(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replaceAll(/`(?:[^`\\]|\\.)*`/g, '``');

test(holds('layers.entries', 'layers: the main entry reaches no platform layer, and the Node, browser and edge entries are the main entry and their ground'), async () => {
  const main = await readFile(join(src, 'index.ts'), 'utf8');
  for (const spec of imports(main)) assert.ok(!PLATFORM.includes(spec.split('/')[2]!), `index.ts imports ${spec}`);
  const entry = async (name: string): Promise<string[]> => [...new Set(imports(await readFile(join(src, name), 'utf8')))].sort();
  assert.deepEqual(await entry('node.ts'), ['./core/harbor/index.ts', './core/node/index.ts', './index.ts']);
  assert.deepEqual(await entry('browser.ts'), ['./core/browser/index.ts', './core/harbor/index.ts', './index.ts']);
  assert.deepEqual(await entry('edge.ts'), ['./core/edge/index.ts', './core/harbor/index.ts', './index.ts']);
  assert.deepEqual(await entry('cli.ts'), ['./core/cli/command.ts', './node.ts'], 'the command runs the Node entry');
});

test(holds('layers.platform', 'layers: only folder, tcp, http, node, browser, edge, cli and stand, and the command, import a platform module or name a platform'), async () => {
  for (const file of await sources()) {
    const layer = layerOf(file);
    if ((layer !== undefined && PLATFORM.includes(layer)) || relative(src, file) === 'cli.ts') continue;
    const text = await readFile(file, 'utf8');
    for (const spec of imports(text)) assert.ok(!spec.startsWith('node:'), `${relative(src, file)} imports ${spec}`);
    for (const name of PLATFORM_NAMES) assert.ok(!name.test(code(text)), `${relative(src, file)} names ${name}`);
  }
});

// A dock and a ward of nobody's library, so the harbor that stands on
// them stands on the core alone.
class BareDock extends Dock {
  static override readonly kind: string = 'com.bare.dock';
}
class BareWard extends Ward {
  static override readonly kind: string = 'com.bare.ward';
}

// The core's suites, and the helpers every suite shares, which stand on
// the core alone.
const tests = fileURLToPath(new URL('../', import.meta.url));
const SHARED = ['claims.ts', 'vectors.ts', 'verify.ts'];

test(holds('proof.core-alone', "layers: the core's suites import the core and the classes written for them, and no default, no kit and no entry"), async () => {
  const core = join(tests, 'core');
  const files = (await readdir(core, { recursive: true })).filter((f) => f.endsWith('.ts')).map((f) => join(core, f));
  assert.ok(files.length > 0, 'the core has suites');
  for (const file of files) {
    for (const spec of imports(await readFile(file, 'utf8'))) {
      if (!spec.startsWith('.')) continue;
      const target = join(dirname(file), spec);
      const inSrc = relative(src, target);
      const where = `test/${relative(tests, file)} imports ${spec}`;
      if (!inSrc.startsWith('..')) assert.ok(inSrc === 'core.ts' || inSrc.startsWith(`core${sep}`), `${where}, no part of the core`);
      else assert.ok(!relative(core, target).startsWith('..') || SHARED.includes(relative(tests, target)), `${where}, a suite beyond the core's`);
    }
  }
});

test(holds('layers.core','layers: every default is a being or a faculty, the core imports none, and a harbor stands and hosts with none of them'), async () => {
  for (const [name, C] of Object.entries(defaults)) assert.ok(typeof C === 'function' && C.prototype instanceof Being, `defaults exports ${name}, no being`);
  for (const file of await sources()) {
    if (!relative(src, file).startsWith(`core${sep}`)) continue;
    for (const spec of imports(await readFile(file, 'utf8'))) assert.ok(!spec.includes('defaults/'), `${relative(src, file)} imports ${spec}, a default`);
  }
  const harbor = await Harbor.open(new PointerTerrain({ defaults: { dock: BareDock, ward: BareWard, classes: [] } }));
  const census = async (ward?: string) => ((await harbor.ask({ ...(ward === undefined ? {} : { ward }) })).answer as { notes: { class: string; beings: object } }).notes;
  assert.equal((await census()).class, BareDock.kind);
  assert.deepEqual(Object.keys((await census()).beings), ['catalogue']);
  assert.deepEqual(await harbor.ask({ method: 'host', args: { ward: 'a' } }), { answer: { hosted: 'a' } });
  assert.equal((await census('a')).class, BareWard.kind);
  await harbor.close();
});
