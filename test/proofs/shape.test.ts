// The line between the two kinds of test. A proof, under `test/proofs`,
// may reach inside the package to prove a mechanism. Every other file of
// `test` is a scenario or what one runs, and stands where an author
// stands: it imports the package by its public entries, Node's own
// modules and its own files outside the proofs, and builds its world
// through a ground, never through `House.open`.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const pkg = fileURLToPath(new URL('../../', import.meta.url));
const tests = join(pkg, 'test');
const proofs = join(tests, 'proofs');

// The entries a stranger imports, as the package names them.
const entries = new Set(Object.keys((JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8')) as { exports: Record<string, unknown> }).exports).map((entry) => entry.replace(/^\./, 'nervur')));

// Every TypeScript file of `test` outside the proofs.
const scenarios = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return path === proofs ? [] : scenarios(path);
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

// Why a module is out of a scenario's reach, or null where it is in reach.
const outOfReach = (file: string, specifier: string): string | null => {
  if (specifier.startsWith('node:') || entries.has(specifier)) return null;
  if (!specifier.startsWith('.')) return `imports ${specifier}, which is no public entry of the package`;
  const target = resolve(dirname(file), specifier);
  if (target.startsWith(proofs)) return `imports ${specifier}, which is a proof's own`;
  if (!target.startsWith(`${tests}/`)) return `imports ${specifier}, inside the package past its entries`;
  return null;
};

const files = scenarios(tests);

test('The scenarios are found', () => {
  assert.ok(files.length > 20, `${files.length} files outside the proofs`);
});

test('A scenario imports the package by its public entries alone', () => {
  const found = files.flatMap((file) => {
    const source = readFileSync(file, 'utf8');
    return imports(source).flatMap(({ specifier, line }) => {
      const why = outOfReach(file, specifier);
      return why === null ? [] : [`${relative(pkg, file)}:${line} ${why}`];
    });
  });
  assert.deepEqual(found, [], 'move the file under test/proofs, or reach what it needs through a public entry');
});

test('A scenario opens its houses through a ground, never through House.open', () => {
  const found = files.flatMap((file) =>
    readFileSync(file, 'utf8')
      .split('\n')
      .flatMap((text, index) => (/\bHouse\.open\s*\(/.test(text) ? [`${relative(pkg, file)}:${index + 1}`] : [])),
  );
  assert.deepEqual(found, [], 'a scenario builds its world as an author does: a BenchGround, a NodeGround, or a Ground written by hand');
});
