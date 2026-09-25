// What the package carries, read as a stranger installs it: two
// dependencies and no others, and mechanism alone behind every entry. No
// entry exports a being, and none exports a faculty: examples stand as
// files in the guides, and every product is a class outside the library.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as core from 'nervur';
import * as app from 'nervur/app';
import * as bench from 'nervur/bench';
import * as being from 'nervur/being';
import * as browser from 'nervur/browser';
import * as edge from 'nervur/edge';
import * as node from 'nervur/node';
import * as serve from 'nervur/serve';

const manifest = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { dependencies?: Record<string, string>; peerDependencies?: Record<string, string> };

test('The package takes two dependencies, and no other lands without the human', () => {
  assert.deepEqual(Object.keys(manifest.dependencies ?? {}).sort(), ['@noble/curves', '@noble/post-quantum']);
  assert.equal(manifest.peerDependencies, undefined);
});

test('No entry exports a being or a faculty: the library ships mechanism alone', () => {
  const entries = { nervur: core, 'nervur/app': app, 'nervur/bench': bench, 'nervur/being': being, 'nervur/browser': browser, 'nervur/edge': edge, 'nervur/node': node, 'nervur/serve': serve };
  for (const [entry, exported] of Object.entries(entries)) {
    for (const [name, value] of Object.entries(exported)) {
      if (typeof value === 'function') {
        // A class of `Being.of` has a table; everything the library exports reads as none.
        assert.throws(() => being.tableOf(value as Parameters<typeof being.tableOf>[0]), Error, `${entry} exports ${name}, a being`);
      }
      if (typeof value === 'object' && value !== null) {
        assert.ok(typeof (value as { up?: unknown }).up !== 'function', `${entry} exports ${name}, a faculty`);
        assert.ok(!('faculties' in value), `${entry} exports ${name}, a registry of faculties`);
      }
    }
  }
});
