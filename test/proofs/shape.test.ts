// The line between the two kinds of test. A proof, under `test/proofs`,
// may reach inside the package to prove a mechanism. Every other file of
// `test`, and every file of `deep`, is a scenario or what one runs, and
// stands where an author stands: it imports the package by its public
// entries, Node's own modules and its own files outside the proofs, names
// no path into the source, builds its world through a ground, never
// through `House.open`, and waits on what it can hear, never by stepping a
// clock in a loop until something happens.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const pkg = fileURLToPath(new URL('../../', import.meta.url));
const tests = join(pkg, 'test');
const deep = join(pkg, 'deep');
const proofs = join(tests, 'proofs');

// The entries a stranger imports, as the package names them.
const entries = new Set(Object.keys((JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8')) as { exports: Record<string, unknown> }).exports).map((entry) => entry.replace(/^\./, 'nervur')));

// Every TypeScript file of a folder of scenarios, the proofs left out.
const scenarios = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return path === proofs || entry.name === 'node_modules' ? [] : scenarios(path);
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
  // A terrain's own run drives a real engine, so `deep` may use a tool that is no part of nervur.
  if (!specifier.startsWith('.') && file.startsWith(`${deep}/`) && !/^@?nervur/.test(specifier)) return null;
  if (!specifier.startsWith('.')) return `imports ${specifier}, which is no public entry of the package`;
  const target = resolve(dirname(file), specifier);
  if (target.startsWith(proofs)) return `imports ${specifier}, which is a proof's own`;
  if (!target.startsWith(`${tests}/`) && !target.startsWith(`${deep}/`)) return `imports ${specifier}, inside the package past its entries`;
  return null;
};

// A statement's whole text from where it starts: a block to its closing brace, or a line to its semicolon.
const statement = (source: string, from: number): string => {
  let depth = 0;
  for (let index = from; index < source.length; index++) {
    const char = source[index];
    if (char === '(' || char === '{' || char === '[') depth++;
    else if (char === ')' || char === ']') depth--;
    else if (char === '}') {
      depth--;
      if (depth === 0) return source.slice(from, index + 1);
    } else if (char === ';' && depth === 0) return source.slice(from, index + 1);
  }
  return source.slice(from);
};

const files = [...scenarios(tests), ...scenarios(deep)];

// Every line of every scenario that `refused` finds, as `path:line`.
const lines = (refused: (text: string) => boolean) =>
  files.flatMap((file) =>
    readFileSync(file, 'utf8')
      .split('\n')
      .flatMap((text, index) => (refused(text) ? [`${relative(pkg, file)}:${index + 1}`] : [])),
  );

test('The scenarios are found, in test and in deep', () => {
  assert.ok(files.length > 20, `${files.length} files outside the proofs`);
  assert.ok(
    files.some((file) => file.startsWith(deep)),
    'deep is read too',
  );
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

test('A scenario names no path into the source', () => {
  const found = lines((text) => !/^\s*(?:import|export)\b/.test(text) && /['"`][^'"`]*\bsrc\//.test(text));
  assert.deepEqual(found, [], 'a scenario runs what an author runs: the public entries, and the command as the package’s bin names it');
});

test('A scenario opens its houses through a ground, never through House.open', () => {
  const found = lines((text) => /\bHouse\.open\s*\(/.test(text));
  assert.deepEqual(found, [], 'a scenario builds its world as an author does: a BenchGround, a NodeGround, or a Ground written by hand');
});

test('A scenario waits on what it can hear, never stepping a clock in a loop', () => {
  const found = files.flatMap((file) => {
    const source = readFileSync(file, 'utf8');
    // A loop that defines tests, one for each case, steps nothing itself.
    return [...source.matchAll(/\b(?:for|while)\s*\(/g)].flatMap((match) => {
      const loop = statement(source, match.index);
      return /\b(?:elapse|settle|advance)\s*\(|\bturn\s*\(\s*\)/.test(loop) && !/\btest\s*\(/.test(loop) ? [`${relative(pkg, file)}:${source.slice(0, match.index).split('\n').length}`] : [];
    });
  });
  assert.deepEqual(found, [], 'wait on a watch or on what a program writes, and move the clock only as far as a retry is due');
});
