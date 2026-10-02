// SPDX-License-Identifier: Apache-2.0
// The source export, followed for the packages a repository holds. A
// package that exports `nervur-source` beside what it ships is read from
// the TypeScript it is built from, wherever it stands outside
// node_modules: the importer's own package, or a workspace linked by name.
// So a suite needs no build first. A package installed under node_modules
// is read as it shipped, since Node strips no types there and a source it
// names may not ship at all.
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// The package a bare specifier names, and the entry inside it: `nervur/being` is `nervur` and `./being`.
const named = (specifier) => {
  const parts = specifier.split('/');
  const length = specifier.startsWith('@') ? 2 : 1;
  return { name: parts.slice(0, length).join('/'), entry: ['.', ...parts.slice(length)].join('/') };
};

const manifestOf = (folder) => JSON.parse(readFileSync(join(folder, 'package.json'), 'utf8'));

// The folder of the package a bare name reaches from an importer: its own, or the nearest node_modules holding it, by its real path.
const packageOf = (name, importer) => {
  for (let at = dirname(importer); at !== dirname(at); at = dirname(at)) {
    if (existsSync(join(at, 'package.json')) && manifestOf(at).name === name) return at;
    const linked = join(at, 'node_modules', name);
    if (existsSync(join(linked, 'package.json'))) return realpathSync(linked);
  }
  return undefined;
};

// The source an entry reaches: its own export, or a pattern's, where `*` stands for what the entry holds there, as Node reads exports.
const sourceOf = (exports, entry) => {
  const own = exports?.[entry]?.['nervur-source'];
  if (typeof own === 'string') return own;
  for (const [key, target] of Object.entries(exports ?? {})) {
    const star = key.indexOf('*');
    const source = target?.['nervur-source'];
    if (star === -1 || typeof source !== 'string') continue;
    const [before, after] = [key.slice(0, star), key.slice(star + 1)];
    if (entry.length > key.length - 1 && entry.startsWith(before) && entry.endsWith(after)) return source.replaceAll('*', entry.slice(before.length, entry.length - after.length));
  }
  return undefined;
};

registerHooks({
  resolve(specifier, context, next) {
    if (/^[./#]/.test(specifier) || specifier.includes(':') || !context.parentURL?.startsWith('file:')) return next(specifier, context);
    const { name, entry } = named(specifier);
    const folder = packageOf(name, fileURLToPath(context.parentURL));
    if (folder === undefined || folder.split(sep).includes('node_modules')) return next(specifier, context);
    const source = sourceOf(manifestOf(folder).exports, entry);
    return typeof source === 'string' ? { url: pathToFileURL(join(folder, source)).href, shortCircuit: true } : next(specifier, context);
  },
});
