// Each foundation contract has one suite, run against every body of it.
// The bodies are read from the source: every class that implements a
// contract, or extends a class that does, and is not abstract. The runs
// are read from the tests: each suite called with a name whose first word
// is the body's.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const pkg = fileURLToPath(new URL('../../', import.meta.url));

// Each contract, by the suite that holds its bodies.
const SUITES: Readonly<Record<string, string>> = {
  Keys: 'keysSuite',
  Memory: 'memorySuite',
  Classes: 'classesSuite',
  Carry: 'carrySuite',
  Clock: 'clockSuite',
  Crypto: 'cryptoSuite',
  Tools: 'toolsSuite',
  Custody: 'custodySuite',
};

const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sources(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });

// Every class of the source: what it extends, what it implements, and whether it is abstract.
const classes = new Map<string, { parent?: string; implemented: string[]; abstract: boolean }>();
for (const file of sources(join(pkg, 'src'))) {
  for (const match of readFileSync(file, 'utf8').matchAll(/^(?:export )?(abstract )?class (\w+)(?: extends (\w+))?(?: implements ([\w, ]+))? \{/gm)) {
    classes.set(match[2], { ...(match[3] === undefined ? {} : { parent: match[3] }), implemented: (match[4] ?? '').split(',').map((name) => name.trim()), abstract: match[1] !== undefined });
  }
}

// The contract a class fills, its own or its parent's.
const contractOf = (name: string): string | undefined => {
  const held = classes.get(name);
  if (held === undefined) return undefined;
  return held.implemented.find((contract) => contract in SUITES) ?? (held.parent === undefined ? undefined : contractOf(held.parent));
};

const bodies = [...classes].flatMap(([name, held]) => {
  const contract = contractOf(name);
  return contract === undefined || held.abstract ? [] : [{ name, contract }];
});

// The names each suite is run under, by their first word, across the tests and the terrains' own runs.
const runs = new Map<string, Set<string>>();
for (const file of [...sources(join(pkg, 'test')), ...sources(join(pkg, 'deep'))]) {
  for (const match of readFileSync(file, 'utf8').matchAll(/\b(\w+Suite)\(\s*[`'"](\w+)/g)) {
    const named = runs.get(match[1]) ?? new Set();
    named.add(match[2]);
    runs.set(match[1], named);
  }
}

test('The bodies of every contract are found', () => {
  for (const contract of Object.keys(SUITES)) {
    assert.ok(
      bodies.some((body) => body.contract === contract),
      `no body of ${contract}`,
    );
  }
});

test('Each foundation contract has one suite, run against every body of it', () => {
  const unrun = bodies.filter(({ name, contract }) => !runs.get(SUITES[contract])?.has(name)).map(({ name, contract }) => `${name} is a body of ${contract}, and ${SUITES[contract]} never runs against it`);
  assert.deepEqual(unrun, []);
});
