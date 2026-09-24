// The order of the entries, read from the source. `nervur/being` stands
// alone. `nervur` stands on it: the house, the room, the ground, the
// foundation and the bodies of any engine. Each terrain's entry stands on
// those two, and `nervur/app` on `nervur/browser` too, since an AppGround
// is a BrowserGround. Nothing imports upward or across, so `nervur` and
// `nervur/being` run on every engine.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../../src/', import.meta.url));

const BEING = 'being';
const CORE = new Set(['index.ts', 'foundation.ts', 'house', 'quo', 'bodies', 'ground']);
const TERRAINS = new Set(['node', 'edge', 'browser', 'app', 'bench', 'serve']);
// What a terrain may stand on beside `nervur/being`, `nervur` and itself.
const BESIDE: Readonly<Record<string, readonly string[]>> = { app: ['browser'] };
// The one outside library `nervur` takes, and the terrains that speak to Node.
const NOBLE = /^@noble\/(curves|post-quantum)\//;
const NODE = new Set(['node', 'serve']);

const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });

// Each module a file names, static or dynamic, with its line.
const imports = (source: string): { specifier: string; line: number }[] => {
  const found: { specifier: string; line: number }[] = [];
  const at = (index: number) => source.slice(0, index).split('\n').length;
  for (const match of source.matchAll(/^\s*(?:import|export)\b[^'";]*?\bfrom\s*['"]([^'"]+)['"]/gm)) found.push({ specifier: match[1], line: at(match.index) });
  for (const match of source.matchAll(/^\s*import\s*['"]([^'"]+)['"]/gm)) found.push({ specifier: match[1], line: at(match.index) });
  for (const match of source.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) found.push({ specifier: match[1], line: at(match.index) });
  return found;
};

// The part of the source a file stands in: `being`, the core, or a terrain.
const partOf = (file: string): string => {
  const top = relative(src, file).split(sep)[0];
  if (top === BEING) return BEING;
  if (CORE.has(top)) return 'core';
  if (TERRAINS.has(top)) return top;
  throw new Error(`${relative(src, file)} stands in no part of the source`);
};

// Why an import breaks the order, or null where it keeps it.
const breaks = (file: string, specifier: string): string | null => {
  const from = partOf(file);
  if (specifier.startsWith('node:')) return NODE.has(from) ? null : `imports ${specifier}, and only a terrain on Node may`;
  if (!specifier.startsWith('.')) return NOBLE.test(specifier) && from === 'core' ? null : `imports ${specifier}, which only nervur's bodies may`;
  const to = partOf(resolve(dirname(file), specifier));
  if (to === from || to === BEING) return null;
  if (to === 'core') return from === BEING ? `imports ${specifier}, and nervur/being stands on nothing` : null;
  return (BESIDE[from] ?? []).includes(to) ? null : `imports ${specifier}, which is ${to}'s, upward or across`;
};

const files = sources(src);

test('The source is found', () => {
  assert.ok(files.length > 40, `${files.length} files under src`);
});

test('The ward’s code stands in one room, reached through one index, and nothing else reads its files', () => {
  const room = join(src, 'quo', 'room.ts');
  const found = files
    .filter((file) => !file.startsWith(join(src, 'quo')))
    .flatMap((file) =>
      imports(readFileSync(file, 'utf8')).flatMap(({ specifier, line }) => (specifier.startsWith('.') && resolve(dirname(file), specifier) === room ? [`src/${relative(src, file)}:${line}`] : [])),
    );
  assert.deepEqual(found, [], 'reach the room through src/quo/index.ts');
});

test('The bench stands where an adopter stands: it imports nervur, nervur/being and its own files alone', () => {
  const bench = join(src, 'bench');
  const allowed = new Set([join(src, 'index.ts'), join(src, 'being', 'index.ts')]);
  const found = files
    .filter((file) => file.startsWith(`${bench}${sep}`))
    .flatMap((file) =>
      imports(readFileSync(file, 'utf8')).flatMap(({ specifier, line }) => {
        const target = resolve(dirname(file), specifier);
        return specifier.startsWith('.') && (allowed.has(target) || dirname(target) === bench) ? [] : [`src/${relative(src, file)}:${line} imports ${specifier}`];
      }),
    );
  assert.deepEqual(found, []);
});

test('It refuses a call on the house beside House.open, door and ask: the house gives a ground openHouse alone, whose house answers its ward, its door and its hand', () => {
  const source = readFileSync(join(src, 'house', 'house.ts'), 'utf8');
  const values = [...source.matchAll(/^export (?:const|function|class|let) (\w+)/gm)].map((match) => match[1]);
  assert.deepEqual(values, ['openHouse']);
  assert.match(source, /return \{\n\s+ward: house\.ward,\n\s+door: \(box\) => house\.door\(box\),\n\s+ask: \(request\) => house\.hand\(request\),\n\s+\};/);
});

test('It refuses a ground an owner must write: each terrain’s entry ships its ground', () => {
  const grounds: Readonly<Record<string, string>> = { node: 'NodeGround', edge: 'EdgeGround', browser: 'BrowserGround', app: 'AppGround', bench: 'BenchGround' };
  const missing = Object.entries(grounds).filter(([terrain, ground]) => !new RegExp(`^export \\{[^}]*\\b${ground}\\b`, 'm').test(readFileSync(join(src, terrain, 'index.ts'), 'utf8')));
  assert.deepEqual(missing, []);
});

test('Entries import downward alone', () => {
  const found = files.flatMap((file) =>
    imports(readFileSync(file, 'utf8')).flatMap(({ specifier, line }) => {
      const why = breaks(file, specifier);
      return why === null ? [] : [`src/${relative(src, file)}:${line} ${why}`];
    }),
  );
  assert.deepEqual(found, []);
});
