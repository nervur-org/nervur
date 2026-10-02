// A stranger's suite, copied beside the installed package and run through
// its runner: every entry resolves to what shipped, never to a source.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { House } from 'nervur';
import { BenchGround } from 'nervur/bench';
import { Being } from 'nervur/being';

test('A stranger’s suite reads the installed package', () => {
  for (const one of [House, BenchGround, Being]) assert.equal(typeof one, 'function');
  assert.match(import.meta.resolve('nervur'), /\/node_modules\/nervur\/dist\/index\.js$/);
});
