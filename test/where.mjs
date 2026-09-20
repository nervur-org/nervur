// SPDX-License-Identifier: Apache-2.0
// Where the things a test needs from outside its own folder stand. The
// library is worked inside a repository that holds `quo/` and hoists its
// modules to the top, and published alone into a repository of its own,
// where `quo/` is a clone beside it and its modules are its own. Neither
// layout is counted in folders, since a count is right in one and wrong in
// the other and the file is the same file. Each walk goes up until it sees
// what it is looking for, so one path holds in both.
//
// JavaScript, not TypeScript, because the package's own tools are `.mjs`
// and read it too, and one finder is better than two.
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The package itself: this file's folder's folder.
export const PKG = fileURLToPath(new URL('../', import.meta.url));

const up = (from, seen) => {
  let at = from;
  for (;;) {
    const found = seen(at);
    if (found) return found;
    const over = dirname(at);
    if (over === at) return undefined;
    at = over;
  }
};

// `quo/`, the protocol's own folder or its clone.
export const QUO = /** @type {string} */ (
  up(PKG, (at) => {
    const quo = join(at, 'quo');
    return existsSync(join(quo, 'SPEC.md')) ? quo : undefined;
  }) ?? raise('no quo/ stands above this package: clone razvangherghina/quo beside it')
);

// The `node_modules` an install put nearest: the package's own when it
// stands alone, the tree's when its modules are hoisted.
export const MODULES = /** @type {string} */ (up(PKG, (at) => (existsSync(join(at, 'node_modules')) ? join(at, 'node_modules') : undefined)) ?? raise('nothing is installed: run npm install'));

// A tool's own program, by the name its package gives it.
export const bin = (/** @type {string} */ name) => join(MODULES, '.bin', name);

function raise(/** @type {string} */ why) {
  throw new Error(why);
}
