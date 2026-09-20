// SPDX-License-Identifier: Apache-2.0
// The cells guard: what a being writes is a value a memory can keep, or a
// throw in her own frame.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { JsonObject } from '../../../src/core/being/index.ts';
import { Cells, DEPTH } from '../../../src/core/ward/cells.ts';
import { holds } from '../../claims.ts';

const guarded = () => {
  const raw: JsonObject = {};
  let wrote = 0;
  const cells = new Cells(() => (wrote += 1)).guard(raw);
  return { raw, cells, wrote: () => wrote };
};

test(holds('cells.guard', 'cells: a value is written as a copy, and every write is told'), () => {
  const { raw, cells, wrote } = guarded();
  const list = [1, { a: 'b' }];
  cells.list = list;
  list.push(new Date() as never);
  assert.deepEqual(raw, { list: [1, { a: 'b' }] });
  (cells.list as JsonObject[]).push({ c: null });
  ((cells.list as JsonObject[])[1] as JsonObject).d = true;
  delete cells.gone;
  assert.deepEqual(raw, { list: [1, { a: 'b', d: true }, { c: null }] });
  assert.equal(wrote(), 5);
});

test('[cells] reading one container twice gives the same object', () => {
  const { cells } = guarded();
  cells.o = { x: [] };
  assert.equal(cells.o, cells.o);
  assert.equal((cells.o as JsonObject).x, (cells.o as JsonObject).x);
});

test('[cells] anything JSON would drop or rewrite throws where it was written, and nothing is kept', () => {
  const { raw, cells } = guarded();
  const cycle: JsonObject = {};
  cycle.self = cycle;
  for (const bad of [undefined, NaN, -0, Infinity, () => 1, new Date(), new Map(), 1n, '\ud800', cycle, new Array(2)]) {
    assert.throws(() => {
      cells.x = bad as never;
    }, TypeError);
  }
  assert.throws(() => {
    (cells as Record<symbol, unknown>)[Symbol('s')] = 1;
  }, TypeError);
  assert.throws(() => Object.defineProperty(cells, 'g', { get: () => 1 }), TypeError);
  assert.throws(() => Object.setPrototypeOf(cells, null), TypeError);
  assert.deepEqual(raw, {});
});

test('[cells] a list grows at its end and never gets a hole', () => {
  const { raw, cells } = guarded();
  cells.l = [1, 2, 3];
  const l = cells.l as number[];
  l.push(4);
  l.pop();
  l.shift();
  l.splice(0, 1);
  l.length = 0;
  assert.deepEqual(raw.l, []);
  assert.throws(() => {
    l[1] = 1;
  }, TypeError);
  assert.throws(() => {
    l.length = 3;
  }, TypeError);
  assert.throws(() => {
    (l as unknown as Record<string, unknown>).name = 'x';
  }, TypeError);
});

test('[cells] a key named __proto__ is her own key and touches no prototype', () => {
  const { raw, cells } = guarded();
  cells.__proto__ = { polluted: true };
  assert.ok(Object.hasOwn(raw, '__proto__'));
  assert.equal(Object.getPrototypeOf(raw), Object.prototype);
  assert.equal(({} as JsonObject).polluted, undefined);
});

test('[cells] nesting is bounded from the root of her cells', () => {
  const { cells } = guarded();
  const nest = (n: number): JsonObject => (n === 0 ? {} : { n: nest(n - 1) });
  cells.ok = nest(DEPTH - 2);
  assert.throws(() => {
    cells.deep = nest(DEPTH);
  }, TypeError);
  let inner = cells.ok as JsonObject;
  while (Object.keys(inner).length > 0) inner = inner.n as JsonObject;
  assert.throws(() => {
    inner.more = {};
  }, TypeError);
});
